import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  AlertCircle,
  Newspaper,
  Scale,
  Tag,
  Network,
  Loader2,
} from "lucide-react";
import { storyQueryOptions } from "@/lib/queries";
import { EntityBadge } from "@/components/EntityBadge";
import { SimGraph } from "@/components/SimGraph";
import { formatRelativeTime, getDomainFromUrl } from "@/lib/utils";
import type { Entity } from "@/lib/types";

export const Route = createFileRoute("/story/$id")({
  head: () => ({
    meta: [
      { title: "Story analysis — Accountability Engine" },
      {
        name: "description",
        content:
          "An objective, fact-only summary of one news story, with a left/center/right framing breakdown, tagged entities, and every source analyzed.",
      },
      { property: "og:title", content: "Story analysis — Accountability Engine" },
      {
        property: "og:description",
        content:
          "One story, cross-referenced across the political spectrum and reduced to verifiable facts.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(storyQueryOptions(params.id)),
  component: StoryDetailPage,
});

const BIAS_STYLES = {
  left: {
    label: "Left",
    color: "text-sky-300",
    bg: "bg-sky-500/10",
    ring: "ring-sky-500/30",
  },
  center: {
    label: "Center",
    color: "text-accent-300",
    bg: "bg-accent-500/10",
    ring: "ring-accent-500/30",
  },
  right: {
    label: "Right",
    color: "text-rose-300",
    bg: "bg-rose-500/10",
    ring: "ring-rose-500/30",
  },
};

function StoryDetailPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(storyQueryOptions(id));
  const { story, sources, storyEntities, edges } = data;

  if (!story) {
    return (
      <div className="mx-auto max-w-2xl py-24 text-center">
        <p className="text-ink-400">Story not found.</p>
        <Link to="/" className="mt-4 inline-block text-accent-400 hover:underline">
          Back to stories
        </Link>
      </div>
    );
  }

  const entities = storyEntities
    .map((se) => se.entity)
    .filter(Boolean) as Entity[];

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" /> All stories
      </Link>

      {(story.status === "processing" || story.status === "pending") && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-amber-500/10 p-4 ring-1 ring-amber-500/30">
          <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
          <p className="text-sm text-amber-200">
            Analyzing this story across multiple sources. This takes about 30-60
            seconds.
          </p>
        </div>
      )}

      {story.status === "failed" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-rose-500/10 p-4 ring-1 ring-rose-500/30">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <p className="text-sm font-medium text-rose-200">Processing failed</p>
            <p className="mt-1 text-xs text-rose-300/70">{story.error_message}</p>
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center gap-2 text-xs text-ink-500">
        <span>{formatRelativeTime(story.created_at)}</span>
        <span>•</span>
        <a
          href={story.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-ink-400 hover:text-ink-100"
        >
          {getDomainFromUrl(story.source_url)}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <h1 className="mb-6 font-serif text-2xl font-bold text-ink-50 sm:text-3xl">
        {story.title || getDomainFromUrl(story.source_url)}
      </h1>

      {story.status === "complete" && (
        <>
          <section className="mb-8 animate-slide-up rounded-xl border border-ink-800 bg-ink-900/50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Scale className="h-5 w-5 text-accent-400" />
              <h2 className="font-serif text-lg font-semibold text-ink-50">
                Objective Summary
              </h2>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-ink-200">
              {story.objective_summary}
            </p>
          </section>

          {Object.keys(story.bias_summary ?? {}).length > 0 && (
            <section className="mb-8 animate-slide-up">
              <div className="mb-4 flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-ink-300" />
                <h2 className="font-serif text-lg font-semibold text-ink-50">
                  Media Framing Breakdown
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {(["left", "center", "right"] as const).map((lean) => {
                  const entry = story.bias_summary?.[lean];
                  if (!entry) return null;
                  const style = BIAS_STYLES[lean];
                  return (
                    <div
                      key={lean}
                      className={`rounded-lg ${style.bg} p-4 ring-1 ${style.ring}`}
                    >
                      <div className={`mb-2 text-sm font-semibold ${style.color}`}>
                        {style.label}
                      </div>
                      <p className="text-sm leading-relaxed text-ink-300">
                        {entry.summary}
                      </p>
                      {entry.sources && entry.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.sources.map((s, i) => (
                            <span
                              key={i}
                              className="rounded bg-ink-800/60 px-1.5 py-0.5 text-[10px] text-ink-400"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {entities.length > 0 && (
            <section className="mb-8 animate-slide-up">
              <div className="mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5 text-ink-300" />
                <h2 className="font-serif text-lg font-semibold text-ink-50">
                  Tagged Entities
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {storyEntities.map((se) => (
                  <EntityBadge
                    key={se.id}
                    entity={se.entity!}
                    context={se.context}
                  />
                ))}
              </div>
            </section>
          )}

          {entities.length >= 2 && (
            <section className="mb-8 animate-slide-up">
              <div className="mb-4 flex items-center gap-2">
                <Network className="h-5 w-5 text-ink-300" />
                <h2 className="font-serif text-lg font-semibold text-ink-50">
                  Entity Relationship Graph
                </h2>
              </div>
              <SimGraph
                entities={entities}
                edges={edges}
                height={edges.length > 0 ? 400 : 300}
              />
              <p className="mt-2 text-xs text-ink-500">
                {edges.length > 0
                  ? `${edges.length} relationships mapped between ${entities.length} entities.`
                  : `${entities.length} entities appear in this story. No mapped relationships yet — add connections from the Entities page.`}
              </p>
            </section>
          )}

          {sources.length > 0 && (
            <section className="mb-8 animate-slide-up">
              <h2 className="mb-4 font-serif text-lg font-semibold text-ink-50">
                Sources Analyzed
              </h2>
              <div className="space-y-2">
                {sources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/40 px-4 py-3 transition-colors hover:border-ink-700"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink-100">
                        {source.title || source.url}
                      </p>
                      <p className="text-xs text-ink-500">
                        {source.outlet} · {getDomainFromUrl(source.url)}
                        {source.outlet_lean !== "unknown" &&
                          ` · ${source.outlet_lean}`}
                      </p>
                    </div>
                    <ExternalLink className="ml-2 h-4 w-4 shrink-0 text-ink-500" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
