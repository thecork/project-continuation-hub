import { useEffect, useMemo, useRef, useState } from "react";
import type { Entity, EntityEdge } from "../lib/types";
import { EDGE_LABELS } from "../lib/types";
import { entityTypeColor } from "../lib/utils";

interface GraphNode {
  id: string;
  entity: Entity;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  edge: EntityEdge;
  source: GraphNode;
  target: GraphNode;
}

export function SimGraph({
  entities,
  edges,
  onNodeClick,
  height = 420,
}: {
  entities: Entity[];
  edges: EntityEdge[];
  onNodeClick?: (entity: Entity) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hovered, setHovered] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Seed node positions on a circle.
  useEffect(() => {
    if (entities.length === 0) {
      setNodes([]);
      return;
    }
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.3;
    setNodes(
      entities.map((entity, i) => {
        const angle = (i / entities.length) * Math.PI * 2;
        return {
          id: entity.id,
          entity,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          vx: 0,
          vy: 0,
        };
      }),
    );
  }, [entities, width, height]);

  // Force simulation: repulsion, edge springs, center gravity.
  useEffect(() => {
    if (nodes.length === 0) return;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const simEdges = edges
      .map((e) => {
        const source = nodeMap.get(e.source_id);
        const target = nodeMap.get(e.target_id);
        return source && target ? { edge: e, source, target } : null;
      })
      .filter((e): e is GraphEdge => e !== null);

    let frame = 0;
    const maxFrames = 200;
    const cx = width / 2;
    const cy = height / 2;

    const tick = () => {
      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n }));
        const nMap = new Map(next.map((n) => [n.id, n]));
        const sEdges = simEdges
          .map((e) => {
            const source = nMap.get(e.source.id);
            const target = nMap.get(e.target.id);
            return source && target ? { edge: e.edge, source, target } : null;
          })
          .filter((e): e is GraphEdge => e !== null);

        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i];
            const b = next[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 6000 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }

        const idealDist = 130;
        for (const e of sEdges) {
          const dx = e.target.x - e.source.x;
          const dy = e.target.y - e.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - idealDist) * 0.02;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          e.source.vx += fx;
          e.source.vy += fy;
          e.target.vx -= fx;
          e.target.vy -= fy;
        }

        for (const n of next) {
          n.vx += (cx - n.x) * 0.005;
          n.vy += (cy - n.y) * 0.005;
          n.vx *= 0.85;
          n.vy *= 0.85;
          n.x += n.vx;
          n.y += n.vy;
          const pad = 40;
          n.x = Math.max(pad, Math.min(width - pad, n.x));
          n.y = Math.max(pad, Math.min(height - pad, n.y));
        }

        return next;
      });

      frame++;
      if (frame < maxFrames) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodes.length, width, height]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const visibleEdges = edges
    .map((e) => {
      const source = nodeMap.get(e.source_id);
      const target = nodeMap.get(e.target_id);
      return source && target ? { edge: e, source, target } : null;
    })
    .filter((e): e is GraphEdge => e !== null);

  if (entities.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center rounded-xl border border-ink-800 bg-ink-900/30 text-sm text-ink-500"
        style={{ height }}
      >
        No entities to display in this graph yet.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-ink-800 bg-ink-900/30"
      style={{ height }}
    >
      <svg width={width} height={height} className="absolute inset-0">
        {visibleEdges.map(({ edge, source, target }) => {
          const isActive = hovered === source.id || hovered === target.id;
          return (
            <g key={edge.id}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isActive ? "#4e5662" : "#373c43"}
                strokeWidth={isActive ? 2 : 1}
                strokeDasharray={
                  edge.type === "mentioned_with" ? "4 4" : undefined
                }
              />
              {isActive && (
                <text
                  x={(source.x + target.x) / 2}
                  y={(source.y + target.y) / 2}
                  fill="#818a94"
                  fontSize={10}
                  textAnchor="middle"
                  dy={-4}
                >
                  {EDGE_LABELS[edge.type] ?? edge.type}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map((n) => {
          const color = entityTypeColor(n.entity.type);
          const isHovered = hovered === n.id;
          const r = isHovered ? 22 : 18;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onNodeClick?.(n.entity)}
              style={{ cursor: onNodeClick ? "pointer" : "default" }}
            >
              <circle
                r={r}
                fill={color}
                fillOpacity={isHovered ? 0.25 : 0.15}
                stroke={color}
                strokeWidth={isHovered ? 2 : 1.5}
              />
              <text
                textAnchor="middle"
                dy={4}
                fill={color}
                fontSize={11}
                fontWeight={600}
              >
                {n.entity.name.slice(0, 2)}
              </text>
              <text
                textAnchor="middle"
                dy={r + 14}
                fill="#aeb4bb"
                fontSize={10}
                fontWeight={500}
              >
                {n.entity.name.length > 18
                  ? n.entity.name.slice(0, 17) + "..."
                  : n.entity.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
