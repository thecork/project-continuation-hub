import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Link2, FileText, Loader2, Trash2, Plus } from "lucide-react";
import { entityQueryOptions, entitiesQueryOptions } from "@/lib/queries";
import { addRelationship, deleteRelationship } from "@/lib/despun.functions";
import { SimGraph } from "@/components/SimGraph";
import { ENTITY_TYPE_LABELS, EDGE_TYPES, EDGE_LABELS, type Entity } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { ENTITY_TYPE_STYLES } from "@/components/EntityBadge";

export const Route = createFileRoute("/entity/$id")({
  head: () => ({
    meta: [
      { title: "Entity profile — Accountability Engine" },
      {
        name: "description",
        content:
          "A tracked person, company, agency, Super PAC or piece of legislation: known facts, mapped relationships, and every story it appears in.",
      },
      { property: "og:title", content: "Entity profile — Accountability Engine" },
      {
        property: "og:description",
        content:
          "Known facts, mapped relationships, and the coverage an entity appears in.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(entityQueryOptions(params.id)),
  component: EntityDetailPage,
});

function EntityDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(entityQueryOptions(id));
  const { data: allEntities } = useSuspenseQuery(entitiesQueryOptions());
  const createEdge = useServerFn(addRelationship);
  const removeEdge = useServerFn(deleteRelationship);

  const [targetId, setTargetId] = useState("");
  const [edgeType, setEdgeType] = useState<string>("funds");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [edgeError, setEdgeError] = useState<string | null>(null);

  const { entity, edges, connected, storyLinks } = data;

  if (!entity) {
    return (
      <div className="mx-auto max-w-2xl py-24 text-center">
        <p className="text-ink-400">Entity not found.</p>
        <Link
          to="/entities"
          className="mt-4 inline-block text-accent-400 hover:underline"
        >
          Back to entities
        </Link>
      </div>
    );
  }

  const style = ENTITY_TYPE_STYLES[entity.type] ?? ENTITY_TYPE_STYLES.other;
  const label = ENTITY_TYPE_LABELS[entity.type] ?? entity.type;
  const graphEntities = [entity, ...connected];

  const submitEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setEdgeError(null);
    try {
      await createEdge({
        data: { sourceId: entity.id, targetId, type: edgeType, amount, note },
      });
      setTargetId("");
      setAmount("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["entity", id] });
      await queryClient.invalidateQueries({ queryKey: ["entities"] });
    } catch (err) {
      setEdgeError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (edgeId: string) => {
    try {
      await removeEdge({ data: { id: edgeId } });
      await queryClient.invalidateQueries({ queryKey: ["entity", id] });
    } catch (err) {
      setEdgeError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-4 py-8 sm:px-6">
      <Link
        to="/entities"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" /> All entities
      </Link>

      <div className="mb-8 flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${style.bg} ${style.text} ring-1 ${style.ring}`}
        >
          {label[0] ?? "•"}
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink-50">
            {entity.name}
          </h1>
          <p className={`text-sm ${style.text}`}>{entity.subtitle}</p>
          <span className="mt-1 inline-block rounded-full bg-ink-800 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
            {label}
          </span>
        </div>
      </div>

      {Object.keys(entity.properties).length > 0 && (
        <section className="mb-8 rounded-xl border border-ink-800 bg-ink-900/50 p-5">
          <h2 className="mb-3 font-serif text-base font-semibold text-ink-50">
            Known Facts
          </h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(entity.properties).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <dt className="shrink-0 capitalize text-ink-500">
                  {key.replace(/_/g, " ")}:
                </dt>
                <dd className="text-ink-200">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {graphEntities.length >= 2 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-ink-300" />
            <h2 className="font-serif text-lg font-semibold text-ink-50">
              Relationship Network
            </h2>
          </div>
          <SimGraph
            entities={graphEntities}
            edges={edges}
            height={400}
            onNodeClick={(next: Entity) =>
              navigate({ to: "/entity/$id", params: { id: next.id } })
            }
          />
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink-50">
          Add a Relationship
        </h2>
        <form
          onSubmit={submitEdge}
          className="rounded-xl border border-ink-800 bg-ink-900/40 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 focus:border-accent-500 focus:outline-none"
            >
              <option value="">Connect to…</option>
              {allEntities
                .filter((other) => other.id !== entity.id)
                .map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name} ({ENTITY_TYPE_LABELS[other.type] ?? other.type})
                  </option>
                ))}
            </select>
            <select
              value={edgeType}
              onChange={(e) => setEdgeType(e.target.value)}
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 focus:border-accent-500 focus:outline-none"
            >
              {EDGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EDGE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (optional)"
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note or disclosure link (optional)"
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
            />
          </div>
          {edgeError && (
            <p className="mt-3 text-sm text-rose-300">{edgeError}</p>
          )}
          <button
            type="submit"
            disabled={!targetId || saving}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Save relationship
          </button>
        </form>
      </section>

      {edges.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 font-serif text-lg font-semibold text-ink-50">
            Relationships
          </h2>
          <div className="space-y-2">
            {edges.map((edge) => {
              const isSource = edge.source_id === entity.id;
              const otherId = isSource ? edge.target_id : edge.source_id;
              const other = connected.find((e) => e.id === otherId);
              if (!other) return null;
              const direction = isSource ? "→" : "←";
              return (
                <div
                  key={edge.id}
                  className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-900/40 px-4 py-3"
                >
                  <Link
                    to="/entity/$id"
                    params={{ id: other.id }}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:underline"
                  >
                    <span className="truncate text-ink-500">{entity.name}</span>
                    <span className="rounded bg-ink-800 px-2 py-0.5 text-xs text-ink-300">
                      {direction} {EDGE_LABELS[edge.type] ?? edge.type}
                    </span>
                    <span className="truncate text-ink-100">{other.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(edge.id)}
                    className="shrink-0 rounded-md p-1.5 text-ink-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                    aria-label="Remove relationship"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {storyLinks.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-ink-300" />
            <h2 className="font-serif text-lg font-semibold text-ink-50">
              Appears In
            </h2>
          </div>
          <div className="space-y-2">
            {storyLinks.map((se) => (
              <Link
                key={se.id}
                to="/story/$id"
                params={{ id: se.story_id }}
                className="block rounded-lg border border-ink-800 bg-ink-900/40 px-4 py-3 transition-colors hover:border-ink-700"
              >
                <p className="text-sm text-ink-100">
                  {se.story?.title || se.story?.source_url || "Untitled story"}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {se.story ? formatRelativeTime(se.story.created_at) : ""}
                  {se.context && ` · ${se.context}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {edges.length === 0 && storyLinks.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-700 bg-ink-900/30 py-12 text-center">
          <p className="text-sm text-ink-500">
            No relationships or stories linked to this entity yet.
          </p>
        </div>
      )}
    </div>
  );
}
