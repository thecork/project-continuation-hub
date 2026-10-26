import type { Entity } from "../lib/types";
import { ENTITY_TYPE_LABELS } from "../lib/types";

const TYPE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  corporation: { bg: "bg-sky-500/10", text: "text-sky-300", ring: "ring-sky-500/30" },
  politician: { bg: "bg-rose-500/10", text: "text-rose-300", ring: "ring-rose-500/30" },
  person: { bg: "bg-amber-500/10", text: "text-amber-300", ring: "ring-amber-500/30" },
  superpac: { bg: "bg-violet-500/10", text: "text-violet-300", ring: "ring-violet-500/30" },
  legislation: { bg: "bg-accent-500/10", text: "text-accent-300", ring: "ring-accent-500/30" },
  agency: { bg: "bg-orange-500/10", text: "text-orange-300", ring: "ring-orange-500/30" },
  other: { bg: "bg-ink-700/30", text: "text-ink-300", ring: "ring-ink-600/40" },
};

export const ENTITY_TYPE_STYLES = TYPE_STYLES;

export function EntityBadge({
  entity,
  context,
  onClick,
}: {
  entity: Entity;
  context?: string;
  onClick?: () => void;
}) {
  const style = TYPE_STYLES[entity.type] ?? TYPE_STYLES.other;
  const label =
    ENTITY_TYPE_LABELS[entity.type as keyof typeof ENTITY_TYPE_LABELS] ??
    entity.type;

  const inner = (
    <>
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${style.bg} ${style.text} ring-1 ${style.ring}`}
      >
        {label[0] ?? "•"}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-50">
          {entity.name}
        </span>
        <span className={`text-xs ${style.text}`}>{entity.subtitle}</span>
        {context && (
          <p className="mt-1 line-clamp-2 text-xs text-ink-400">{context}</p>
        )}
        <span className="mt-1 inline-block text-[10px] uppercase tracking-wider text-ink-500">
          {label}
        </span>
      </div>
    </>
  );

  const className = `flex w-full items-start gap-3 rounded-lg ${style.bg} p-3 text-left ring-1 ${style.ring} transition-all ${
    onClick ? "cursor-pointer hover:scale-[1.01] hover:ring-2" : ""
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}
