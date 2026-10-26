import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { createStory, runPipeline } from "@/lib/despun.functions";
import { storiesQueryOptions } from "@/lib/queries";
import { StoryCard } from "@/components/StoryCard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · Add a story — Accountability Engine" },
      {
        name: "description",
        content:
          "Submit a news article URL for de-spinning: extraction, cross-referenced coverage, objective summary and entity tagging.",
      },
      {
        property: "og:title",
        content: "Admin · Add a story — Accountability Engine",
      },
      {
        property: "og:description",
        content: "Submit an article URL to the de-spun analysis pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(storiesQueryOptions()),
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const submitStory = useServerFn(createStory);
  const runAnalysis = useServerFn(runPipeline);
  const { data: stories } = useSuspenseQuery(storiesQueryOptions());

  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const { storyId } = await submitStory({ data: { sourceUrl: trimmed } });

      // The pipeline takes 30-60s, so it is kicked off without waiting on the
      // response. The story row reports its own progress and the list below
      // polls until the analysis lands.
      void runAnalysis({ data: { storyId } }).catch(() => {});

      setSubmitSuccess(
        "Story submitted. The engine is extracting the article and cross-referencing coverage — results appear below in about 30-60 seconds.",
      );
      setUrl("");
      await queryClient.invalidateQueries({ queryKey: ["stories"] });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="mb-2 font-serif text-2xl font-bold text-ink-50">
          Admin · Add Story
        </h1>
        <p className="text-sm text-ink-400">
          Paste a news article URL. The engine will extract the article, search
          for related coverage across the political spectrum, produce an
          objective summary, a media-framing breakdown, and tag key entities.
          This takes about 30-60 seconds.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/news-article"
            required
            className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-ink-50 transition-colors placeholder:text-ink-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
          <button
            type="submit"
            disabled={submitting || !url.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Analyze Story
              </>
            )}
          </button>
        </div>

        {submitError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 ring-1 ring-rose-500/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <p className="text-sm text-rose-200">{submitError}</p>
          </div>
        )}

        {submitSuccess && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-accent-500/10 p-3 ring-1 ring-accent-500/30">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-300" />
            <p className="text-sm text-accent-200">{submitSuccess}</p>
          </div>
        )}
      </form>

      <div>
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink-100">
          All Stories
        </h2>
        {stories.length === 0 ? (
          <p className="text-sm text-ink-500">No stories submitted yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
