import { Link } from "@tanstack/react-router";
import type { Story } from "../lib/types";
import { formatRelativeTime, getDomainFromUrl } from "../lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-ink-700 text-ink-300",
  processing:
    "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30 animate-pulse-slow",
  complete: "bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/30",
  failed: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
};

export function StoryCard({ story }: { story: Story }) {
  const biasCount = story.bias_summary
    ? Object.values(story.bias_summary).filter(Boolean).length
    : 0;

  return (
    <Link
      to="/story/$id"
      params={{ id: story.id }}
      className="group block animate-slide-up rounded-xl border border-ink-800 bg-ink-900/50 p-5 transition-all hover:border-ink-700 hover:bg-ink-900"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-ink-400">
        <span
          className={`rounded px-2 py-0.5 font-medium ${
            STATUS_STYLES[story.status] ?? STATUS_STYLES.pending
          }`}
        >
          {story.status}
        </span>
        <span>•</span>
        <span>{formatRelativeTime(story.created_at)}</span>
      </div>

      <h3 className="mb-2 line-clamp-2 font-serif text-lg font-semibold text-ink-50 transition-colors group-hover:text-accent-300">
        {story.title || getDomainFromUrl(story.source_url)}
      </h3>

      {story.status === "complete" && story.objective_summary && (
        <p className="mb-3 line-clamp-3 text-sm text-ink-300">
          {story.objective_summary}
        </p>
      )}

      {story.status === "processing" && (
        <p className="mb-3 text-sm text-ink-400 italic">
          Analyzing sources and extracting entities...
        </p>
      )}

      {story.status === "failed" && (
        <p className="mb-3 text-sm text-rose-400/80 italic">
          Processing failed. See story detail for error.
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-ink-500">
        <span className="truncate">{getDomainFromUrl(story.source_url)}</span>
        {story.status === "complete" && biasCount > 0 && (
          <>
            <span>•</span>
            <span>{biasCount} bias perspectives</span>
          </>
        )}
      </div>
    </Link>
  );
}
