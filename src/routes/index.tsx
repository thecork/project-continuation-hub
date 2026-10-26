import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { storiesQueryOptions } from "@/lib/queries";
import { StoryCard } from "@/components/StoryCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accountability Engine — News, stripped of spin" },
      {
        name: "description",
        content:
          "Automated, source-grounded news analysis: an objective summary, a left/center/right framing breakdown, and a knowledge graph of the entities behind every story.",
      },
      { property: "og:title", content: "Accountability Engine" },
      {
        property: "og:description",
        content:
          "A news story is cross-referenced across the political spectrum, then reduced to verifiable facts — with the framing of left, center and right coverage laid side by side.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(storiesQueryOptions()),
  component: HomePage,
});

function HomePage() {
  const { data: stories } = useSuspenseQuery(storiesQueryOptions());

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="mb-10 animate-fade-in">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-300 ring-1 ring-accent-500/30">
            Phase 2 · MVP
          </span>
        </div>
        <h1 className="mb-3 font-serif text-3xl font-bold text-ink-50 sm:text-4xl">
          News, stripped of spin.
        </h1>
        <p className="max-w-2xl text-ink-400">
          The Accountability Engine takes a news story, finds coverage across the
          political spectrum, and produces a purely objective, fact-grounded
          summary — plus a breakdown of how left, center, and right outlets each
          frame it. Key entities are tagged and mapped.
        </p>
      </section>

      {stories.length === 0 ? (
        <div className="animate-fade-in rounded-xl border border-dashed border-ink-700 bg-ink-900/30 py-20 text-center">
          <FileText className="mx-auto mb-4 h-10 w-10 text-ink-600" />
          <h2 className="mb-2 font-serif text-xl text-ink-200">No stories yet</h2>
          <p className="text-sm text-ink-500">
            Use the Admin tab to add a news story URL for analysis.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  );
}
