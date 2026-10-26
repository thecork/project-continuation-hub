import { createServerFn } from "@tanstack/react-start";
import { normalizeArticleUrl } from "./utils";
import { ENTITY_TYPES, EDGE_TYPES } from "./types";

/**
 * De-spun pipeline.
 *
 * Everything here runs server-side only. The OpenAI and Tavily keys are read
 * from the project's encrypted secrets inside the handlers, so they never reach
 * the browser bundle. Writes go through the service-role client, which is the
 * only role allowed to modify the tables — the public site is read-only.
 */

const OPENAI_MODEL = () => process.env["OPENAI_MODEL"] ?? "gpt-4.1-mini";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured for this project.`);
  return value;
}

async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs = 30000,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${url} failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

interface TavilySearchResponse {
  results: TavilyResult[];
}

interface TavilyExtractResponse {
  results: { url: string; raw_content: string }[];
}

function tavilySearch(query: string): Promise<TavilySearchResponse> {
  const key = requireEnv("TAVILY_API_KEY");
  return postJson<TavilySearchResponse>(
    "https://api.tavily.com/search",
    { api_key: key, query, search_depth: "advanced", max_results: 8, include_answer: false },
    { Authorization: `Bearer ${key}` },
  );
}

function tavilyExtract(urls: string[]): Promise<TavilyExtractResponse> {
  const key = requireEnv("TAVILY_API_KEY");
  return postJson<TavilyExtractResponse>(
    "https://api.tavily.com/extract",
    { api_key: key, urls },
    { Authorization: `Bearer ${key}` },
  );
}

const ENTITY_SYSTEM_PROMPT = `You are a cold, hyper-literal, non-sentimental data isolation system that analyzes news coverage objectively.

ROLE: You analyze a news story and its cross-referenced source articles, then produce a purely factual, objective summary and a media-bias breakdown.

OPERATIONAL DIRECTIVES:
1. Read the primary story and all provided source articles.
2. Produce an "objective_summary": a plain-English summary using ONLY verifiable facts, numbers, dates, named entities, and policy actions from the sources. Strip all qualitative adjectives, adverbs, and emotional framing. No opinion words. No "groundbreaking", "unfortunate", "historic", etc. If facts conflict across sources, present each factual claim with which sources support it.
3. Produce a "bias_breakdown" object with up to three keys: "left", "center", "right". For each lean that is represented among the sources, write a short summary noting HOW those sources frame the story — word choice, emphasis, omitted context, tone. Do not judge the framing; describe it neutrally. Include the outlet names that fall under each lean.
4. Produce an "entities" array tagging every key entity mentioned in the story. Each entity object has: "type" (one of: corporation, politician, person, superpac, legislation, agency, other), "name" (exact proper name), "subtitle" (role/title/org, short), "context" (one sentence on why this entity is relevant to THIS story), and "properties" (any structured facts: ticker, party, district, bill_number, etc.).
5. STRICT CONSTRAINT: Output ONLY valid JSON. No introductory text, no commentary. Use this schema:
{"objective_summary": string, "bias_breakdown": {"left"?: {"summary": string, "sources": string[]}, "center"?: {"summary": string, "sources": string[]}, "right"?: {"summary": string, "sources": string[]}}, "entities": [{"type": string, "name": string, "subtitle": string, "context": string, "properties": object}]}`;

interface EntityTag {
  type: string;
  name: string;
  subtitle: string;
  context: string;
  properties?: Record<string, unknown>;
}

interface AnalysisResponse {
  objective_summary: string;
  bias_breakdown: {
    left?: { summary: string; sources?: string[] };
    center?: { summary: string; sources?: string[] };
    right?: { summary: string; sources?: string[] };
  };
  entities: EntityTag[];
}

async function analyzeWithOpenAI(sourceTexts: string): Promise<AnalysisResponse> {
  const key = requireEnv("OPENAI_API_KEY");
  const data = await postJson<{
    choices?: { message?: { content?: string } }[];
  }>(
    "https://api.openai.com/v1/chat/completions",
    {
      model: OPENAI_MODEL(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ENTITY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze the following news story and its related coverage. Produce the objective summary, bias breakdown, and entity tags.\n\n${sourceTexts}`,
        },
      ],
    },
    { Authorization: `Bearer ${key}` },
    60000,
  );

  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as Partial<AnalysisResponse>;
    return {
      objective_summary: parsed.objective_summary ?? "",
      bias_breakdown: parsed.bias_breakdown ?? {},
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
    };
  } catch {
    throw new Error("The analysis model returned malformed JSON. Try again.");
  }
}

function sanitizeType(type: string): string {
  return (ENTITY_TYPES as readonly string[]).includes(type) ? type : "other";
}

// ---------------------------------------------------------------------------
// createStory — insert the row and return its id immediately.
// ---------------------------------------------------------------------------

export const createStory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const sourceUrl = normalizeArticleUrl(
      typeof (input as { sourceUrl?: unknown })?.sourceUrl === "string"
        ? (input as { sourceUrl: string }).sourceUrl
        : "",
    );
    return { sourceUrl };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("stories")
      .insert({ source_url: data.sourceUrl, status: "pending" })
      .select("id")
      .single();
    if (error || !row) {
      throw new Error(error?.message ?? "Failed to create the story row.");
    }
    return { storyId: row.id };
  });

// ---------------------------------------------------------------------------
// runPipeline — extract, cross-reference, analyze, persist.
// ---------------------------------------------------------------------------

export const runPipeline = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const storyId = (input as { storyId?: unknown })?.storyId;
    if (typeof storyId !== "string" || !storyId) {
      throw new Error("storyId is required.");
    }
    return { storyId };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const storyId = data.storyId;

    const markFailed = async (message: string) => {
      await supabaseAdmin
        .from("stories")
        .update({ status: "failed", error_message: message.slice(0, 1000) })
        .eq("id", storyId);
    };

    const { data: story, error: storyErr } = await supabaseAdmin
      .from("stories")
      .select("id, source_url, status")
      .eq("id", storyId)
      .maybeSingle();
    if (storyErr) throw new Error(storyErr.message);
    if (!story) throw new Error("Story not found.");

    await supabaseAdmin.from("stories").update({ status: "processing" }).eq("id", storyId);

    try {
      // 1. Pull the original article.
      let originalContent = "";
      try {
        const extracted = await tavilyExtract([story.source_url]);
        originalContent = extracted.results?.[0]?.raw_content ?? "";
      } catch {
        // Extraction can fail on paywalled pages; search still gives us coverage.
      }

      // 2. Find related coverage across the political spectrum.
      const searchQuery = originalContent
        ? originalContent.slice(0, 400)
        : story.source_url;
      const search = await tavilySearch(
        `news coverage analysis: ${searchQuery.slice(0, 400)}`,
      );

      // 3. Pull full text for up to five related articles.
      const relatedUrls = (search.results ?? [])
        .map((r) => r.url)
        .filter((u) => u !== story.source_url)
        .slice(0, 5);

      let relatedContents: { url: string; title: string; content: string }[] = [];
      if (relatedUrls.length > 0) {
        const relatedExtract = await tavilyExtract(relatedUrls);
        const byUrl = new Map(
          (relatedExtract.results ?? []).map((r) => [r.url, r.raw_content]),
        );
        relatedContents = (search.results ?? [])
          .filter((r) => relatedUrls.includes(r.url) && byUrl.has(r.url))
          .slice(0, 5)
          .map((r) => ({
            url: r.url,
            title: r.title,
            content: byUrl.get(r.url) ?? r.content,
          }));
      }

      if (!originalContent && relatedContents.length === 0) {
        throw new Error(
          "No article text could be retrieved from that URL or from related coverage.",
        );
      }

      // 4. Analyze.
      const sourceTexts = [
        `=== PRIMARY STORY (${story.source_url}) ===\n${originalContent.slice(0, 4000)}`,
        ...relatedContents.map(
          (s, i) =>
            `=== SOURCE ${i + 1}: ${s.title} (${s.url}) ===\n${s.content.slice(0, 3000)}`,
        ),
      ].join("\n\n---\n\n");

      const analysis = await analyzeWithOpenAI(sourceTexts);

      // 5. Persist sources, tagging each with the lean the model attributed it.
      const leanFor = (name: string): "left" | "center" | "right" | "unknown" => {
        const needle = name.toLowerCase().trim();
        if (!needle) return "unknown";
        for (const lean of ["left", "center", "right"] as const) {
          const entry = analysis.bias_breakdown?.[lean];
          if (entry?.sources?.some((s) => s.toLowerCase().includes(needle))) {
            return lean;
          }
        }
        return "unknown";
      };

      const sourceRows = [
        {
          story_id: storyId,
          url: story.source_url,
          outlet: "Primary source",
          outlet_lean: "unknown",
          title: story.source_url,
          content: originalContent.slice(0, 8000),
        },
        ...relatedContents.map((s) => {
          const outlet = new URL(s.url).hostname.replace(/^www\./, "");
          return {
            story_id: storyId,
            url: s.url,
            outlet,
            outlet_lean: leanFor(outlet),
            title: s.title,
            content: s.content.slice(0, 8000),
          };
        }),
      ];
      await supabaseAdmin.from("sources").delete().eq("story_id", storyId);
      if (sourceRows.length > 0) {
        await supabaseAdmin.from("sources").insert(sourceRows);
      }

      // 6. Upsert entities and tag them to this story.
      const entityTags = (analysis.entities ?? []).filter(
        (e) => typeof e?.name === "string" && e.name.trim().length > 0,
      );
      let entityCount = 0;
      for (const tag of entityTags) {
        const type = sanitizeType(tag.type);
        const name = tag.name.trim().slice(0, 200);
        const { data: existing } = await supabaseAdmin
          .from("entities")
          .select("id")
          .eq("name", name)
          .eq("type", type)
          .maybeSingle();

        let entityId = existing?.id;
        if (entityId) {
          await supabaseAdmin
            .from("entities")
            .update({
              subtitle: tag.subtitle ?? "",
              properties: tag.properties ?? {},
            })
            .eq("id", entityId);
        } else {
          const { data: created } = await supabaseAdmin
            .from("entities")
            .insert({
              type,
              name,
              subtitle: tag.subtitle ?? "",
              properties: tag.properties ?? {},
            })
            .select("id")
            .single();
          entityId = created?.id;
        }

        if (entityId) {
          entityCount += 1;
          await supabaseAdmin
            .from("story_entities")
            .upsert(
              {
                story_id: storyId,
                entity_id: entityId,
                context: tag.context ?? "",
              },
              { onConflict: "story_id,entity_id" },
            );
        }
      }

      // 7. Finalize the story.
      const title =
        relatedContents.find((s) => s.title)?.title ??
        search.results?.[0]?.title ??
        story.source_url;

      const { error: finalErr } = await supabaseAdmin
        .from("stories")
        .update({
          status: "complete",
          title: String(title).slice(0, 200),
          objective_summary: analysis.objective_summary,
          bias_summary: analysis.bias_breakdown,
          raw_text: originalContent.slice(0, 20000) || null,
          error_message: null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", storyId);
      if (finalErr) throw new Error(finalErr.message);

      return {
        success: true,
        storyId,
        objective_summary: analysis.objective_summary,
        entityCount,
        sourceCount: sourceRows.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(message).catch(() => {});
      throw new Error(message);
    }
  });

// ---------------------------------------------------------------------------
// Relationship editing (the knowledge-graph edges).
// ---------------------------------------------------------------------------

export const addRelationship = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const body = (input ?? {}) as Record<string, unknown>;
    const { sourceId, targetId, type } = body;
    if (typeof sourceId !== "string" || typeof targetId !== "string") {
      throw new Error("Pick two entities to connect.");
    }
    if (sourceId === targetId) throw new Error("An entity cannot relate to itself.");
    if (typeof type !== "string" || !(EDGE_TYPES as readonly string[]).includes(type)) {
      throw new Error("Choose a valid relationship type.");
    }
    const amount =
      typeof body.amount === "string" && body.amount.trim()
        ? Number(body.amount)
        : undefined;
    const properties: Record<string, unknown> = {};
    if (amount !== undefined && Number.isFinite(amount)) properties.amount = amount;
    if (typeof body.note === "string" && body.note.trim()) {
      properties.note = body.note.trim().slice(0, 500);
    }
    return { sourceId, targetId, type, properties };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("entity_edges").upsert(
      {
        source_id: data.sourceId,
        target_id: data.targetId,
        type: data.type,
        properties: data.properties,
      },
      { onConflict: "source_id,target_id,type" },
    );
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteRelationship = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const id = (input as { id?: unknown })?.id;
    if (typeof id !== "string" || !id) throw new Error("Edge id is required.");
    return { id };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("entity_edges")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
