import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { entitiesQueryOptions } from "@/lib/queries";
import { ENTITY_TYPE_LABELS, type EntityType } from "@/lib/types";
import { ENTITY_TYPE_STYLES } from "@/components/EntityBadge";

export const Route = createFileRoute("/entities")({
  head: () => ({
    meta: [
      { title: "Entity knowledge graph — Accountability Engine" },
      {
        name: "description",
        content:
          "Every person, company, agency, Super PAC and piece of legislation tracked across analyzed news stories, filterable by type.",
      },
      {
        property: "og:title",
        content: "Entity knowledge graph — Accountability Engine",
      },
      {
        property: "og:description",
        content:
          "People, companies, legislation and organizations mapped across all analyzed coverage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(entitiesQueryOptions()),
  component: EntitiesPage,
});

function EntitiesPage() {
  const { data: entities } = useSuspenseQuery(entitiesQueryOptions());
  const types = ["all", ...new Set(entities.map((e) => e.type))];
  const filter = new URLSearchParams(window.location.search).get("type") ?? "all";
  const filtered =
    filter === "all" ? entities : entities.filter((e) => e.type === filter);

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-4 py-8 sm:px-6">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Network className="h-5 w-5 text-accent-400" />
          <h1 className="font-serif text-2xl font-bold text-ink-50">
            Entity Knowledge Graph
          </h1>
        </div>
        <p className="text-sm text-ink-400">
          People, companies, legislation, and organizations tracked across all
          analyzed stories.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {types.map((t) => (
          <Link
            key={t}
            to="/entities"
            search={t === "all" ? {} : { type: t }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === t
                ? "bg-ink-100 text-ink-900"
                : "bg-ink-800 text-ink-400 hover:text-ink-100"
            }`}
          >
            {t === "all"
              ? "All"
              : ENTITY_TYPE_LABELS[t as EntityType] ?? t}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900/30 py-16 text-center">
          <p className="text-sm text-ink-500">
            No entities yet. They appear here once stories are processed.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entity) => {
            const style = ENTITY_TYPE_STYLES[entity.type] ?? ENTITY_TYPE_STYLES.other;
            const label = ENTITY_TYPE_LABELS[entity.type] ?? entity.type;
            return (
              <Link
                key={entity.id}
                to="/entity/$id"
                params={{ id: entity.id }}
                className={`group rounded-lg ${style.bg} p-4 ring-1 ${style.ring} transition-all hover:scale-[1.01] hover:ring-2`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${style.bg} ${style.text} ring-1 ${style.ring}`}
                  >
                    {label[0] ?? "•"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-50">
                      {entity.name}
                    </p>
                    <p className={`truncate text-xs ${style.text}`}>
                      {entity.subtitle}
                    </p>
                    <span className="mt-1 inline-block text-[10px] uppercase tracking-wider text-ink-500">
                      {label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
