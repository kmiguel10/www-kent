import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { RelationshipGraph, MetricKey, GraphEdge } from '@/lib/athlete-os/types';
import { METRICS } from '@/lib/athlete-os/metrics/registry';

/**
 * Health Relationship Graph — an Obsidian-style concept map. Nodes are metrics
 * (size = importance), edges are discovered correlations (thickness = |r|,
 * colour = sign). Layout is a small deterministic force simulation run once;
 * pan/zoom/hover/search/click are handled with plain SVG + pointer events, so
 * no graph library is pulled in for a ~10-node graph.
 */

const W = 720;
const H = 460;

type Pos = { x: number; y: number };

/** Deterministic force-directed layout (fixed iterations, seeded on a circle). */
function layout(graph: RelationshipGraph): Record<string, Pos> {
  const nodes = graph.nodes;
  const n = nodes.length;
  const pos: Record<string, Pos> = {};
  nodes.forEach((node, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    pos[node.id] = { x: W / 2 + Math.cos(a) * 150, y: H / 2 + Math.sin(a) * 110 };
  });
  if (n === 0) return pos;

  const adj = graph.edges.map((e) => ({ s: e.source, t: e.target, w: Math.abs(e.weight) }));
  const REPULSION = 42000;
  const CENTER = 0.015;

  for (let iter = 0; iter < 320; iter++) {
    const disp: Record<string, Pos> = {};
    nodes.forEach((nd) => (disp[nd.id] = { x: 0, y: 0 }));

    // Repulsion between every pair.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = Math.random(); dy = Math.random(); }
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
        disp[nodes[i].id].x += (dx / d) * f; disp[nodes[i].id].y += (dy / d) * f;
        disp[nodes[j].id].x -= (dx / d) * f; disp[nodes[j].id].y -= (dy / d) * f;
      }
    }
    // Spring attraction along edges (stronger edges pull closer).
    for (const e of adj) {
      const a = pos[e.s], b = pos[e.t];
      if (!a || !b) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 150 - e.w * 70;
      const f = (d - target) * 0.05;
      disp[e.s].x -= (dx / d) * f; disp[e.s].y -= (dy / d) * f;
      disp[e.t].x += (dx / d) * f; disp[e.t].y += (dy / d) * f;
    }
    // Centering + integrate with cooling.
    const cool = 1 - iter / 320;
    for (const nd of nodes) {
      disp[nd.id].x += (W / 2 - pos[nd.id].x) * CENTER;
      disp[nd.id].y += (H / 2 - pos[nd.id].y) * CENTER;
      const dx = disp[nd.id].x, dy = disp[nd.id].y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const step = Math.min(len, 24 * cool);
      pos[nd.id].x += (dx / len) * step;
      pos[nd.id].y += (dy / len) * step;
      pos[nd.id].x = Math.max(40, Math.min(W - 40, pos[nd.id].x));
      pos[nd.id].y = Math.max(40, Math.min(H - 40, pos[nd.id].y));
    }
  }
  return pos;
}

export default function RelationshipGraph({ graph }: { graph: RelationshipGraph }) {
  const positions = useMemo(() => layout(graph), [graph]);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState<MetricKey | null>(null);
  const [selected, setSelected] = useState<MetricKey | null>(null);
  const [query, setQuery] = useState('');
  const drag = useRef<{ x: number; y: number } | null>(null);

  const neighbors = useMemo(() => {
    const focus = hover ?? selected;
    if (!focus) return null;
    const set = new Set<MetricKey>([focus]);
    graph.edges.forEach((e) => {
      if (e.source === focus) set.add(e.target);
      if (e.target === focus) set.add(e.source);
    });
    return set;
  }, [hover, selected, graph.edges]);

  const q = query.trim().toLowerCase();
  const matches = (id: MetricKey) => (q ? METRICS[id].label.toLowerCase().includes(q) : true);

  const selectedEdges: GraphEdge[] = useMemo(
    () => (selected ? graph.edges.filter((e) => e.source === selected || e.target === selected) : []),
    [selected, graph.edges],
  );

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const k = Math.max(0.5, Math.min(2.5, view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
    setView((v) => ({ ...v, k }));
  };
  const onDown = (e: PointerEvent) => { drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }; };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
  };
  const onUp = () => { drag.current = null; };

  if (graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-sm text-gray-11">No relationships discovered yet.</p>
        <p className="text-xs text-gray-10">Edges appear once enough overlapping days exist to correlate metrics.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Search */}
      <div className="absolute left-3 top-3 z-10">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search metric…"
          className="w-40 rounded-md border border-gray-6 bg-gray-2/90 px-2.5 py-1.5 text-xs text-gray-12 outline-none backdrop-blur focus:border-gray-8"
        />
      </div>
      <div className="absolute right-3 top-3 z-10 text-[10px] text-gray-10">scroll to zoom · drag to pan</div>

      <svg
        width="100%" viewBox={`0 0 ${W} ${H}`} className="touch-none select-none"
        onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* Edges */}
          {graph.edges.map((e, i) => {
            const a = positions[e.source], b = positions[e.target];
            if (!a || !b) return null;
            const active = !neighbors || (neighbors.has(e.source) && neighbors.has(e.target));
            const dim = (neighbors && !active) || (q && !(matches(e.source) || matches(e.target)));
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={e.weight >= 0 ? '#22c55e' : '#f43f5e'}
                strokeWidth={1 + Math.abs(e.weight) * 5}
                strokeOpacity={dim ? 0.06 : 0.35}
                strokeDasharray={e.weight < 0 ? '4 3' : undefined}
              />
            );
          })}
          {/* Nodes */}
          {graph.nodes.map((nd) => {
            const p = positions[nd.id];
            if (!p) return null;
            const r = 12 + nd.importance * 20;
            const focused = neighbors ? neighbors.has(nd.id) : true;
            const dim = (neighbors && !focused) || !matches(nd.id);
            return (
              <g
                key={nd.id}
                transform={`translate(${p.x} ${p.y})`}
                style={{ cursor: 'pointer', opacity: dim ? 0.2 : 1 }}
                onPointerEnter={() => setHover(nd.id)}
                onPointerLeave={() => setHover(null)}
                onClick={() => setSelected((s) => (s === nd.id ? null : nd.id))}
              >
                <circle r={r} fill={nd.color} fillOpacity={0.18} stroke={nd.color} strokeWidth={selected === nd.id ? 3 : 1.5} />
                <text textAnchor="middle" y={r + 13} className="fill-gray-11" style={{ fontSize: 11, fontWeight: 500 }}>
                  {nd.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Detail panel */}
      {selected && (
        <div className="absolute bottom-3 right-3 z-10 w-60 rounded-lg border border-gray-6 bg-gray-2/95 p-3 text-xs backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: METRICS[selected].color }} />
            <span className="font-medium text-gray-12">{METRICS[selected].label}</span>
          </div>
          <p className="mb-2 text-gray-10">{METRICS[selected].hint}</p>
          <div className="flex flex-col gap-1">
            {selectedEdges.length === 0 && <span className="text-gray-10">No strong relationships.</span>}
            {selectedEdges.slice(0, 6).map((e, i) => {
              const other = e.source === selected ? e.target : e.source;
              return (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-gray-11">{METRICS[other].label}{e.lagDays > 0 ? ` (+${e.lagDays}d)` : ''}</span>
                  <span className="font-medium tabular-nums" style={{ color: e.weight >= 0 ? '#22c55e' : '#f43f5e' }}>
                    {e.weight >= 0 ? '+' : ''}{e.weight.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
