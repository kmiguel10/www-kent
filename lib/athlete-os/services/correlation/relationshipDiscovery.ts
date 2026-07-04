import type {
  Correlation,
  CorrelationMethod,
  DailyMatrix,
  GraphEdge,
  GraphNode,
  MetricKey,
  RelationshipGraph,
  RollingWindow,
} from '@/lib/athlete-os/types';
import { METRICS, ANALYSIS_METRIC_KEYS } from '@/lib/athlete-os/metrics/registry';

import { analyzePair } from './correlationEngine';

/**
 * Relationship discovery — runs the correlation engine across every metric pair
 * and distils the results into a concept graph (nodes = metrics, edges =
 * discovered relationships). This is what the Obsidian-style graph renders and
 * what the insight layer mines.
 */

export interface DiscoveryOptions {
  method?: CorrelationMethod;
  window?: RollingWindow;
  /** Minimum |r| for an edge to be kept. */
  minStrength?: number;
  /** Drop relationships below this confidence. */
  minConfidence?: 'high' | 'moderate' | 'low';
  keys?: MetricKey[];
}

const CONF_RANK = { insufficient: 0, low: 1, moderate: 2, high: 3 } as const;

export function discoverRelationships(
  matrix: DailyMatrix,
  opts: DiscoveryOptions = {},
): Correlation[] {
  const method = opts.method ?? 'pearson';
  const window = opts.window ?? 90;
  const minStrength = opts.minStrength ?? 0.25;
  const minConf = CONF_RANK[opts.minConfidence ?? 'low'];
  const keys = opts.keys ?? ANALYSIS_METRIC_KEYS;

  const results: Correlation[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const c = analyzePair(matrix, keys[i], keys[j], { method, window, lag: 'auto' });
      if (
        Math.abs(c.correlation) >= minStrength &&
        c.confidence.level !== 'insufficient' &&
        CONF_RANK[c.confidence.level] >= minConf
      ) {
        results.push(c);
      }
    }
  }
  // Strongest relationships first.
  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

/** Build the concept graph from discovered correlations. */
export function buildGraph(correlations: Correlation[], keys: MetricKey[] = ANALYSIS_METRIC_KEYS): RelationshipGraph {
  // Importance = summed |r| of a node's edges (degree-weighted centrality).
  const strengthByNode = new Map<MetricKey, number>();
  for (const c of correlations) {
    strengthByNode.set(c.metricA, (strengthByNode.get(c.metricA) ?? 0) + Math.abs(c.correlation));
    strengthByNode.set(c.metricB, (strengthByNode.get(c.metricB) ?? 0) + Math.abs(c.correlation));
  }
  const maxStrength = Math.max(1, ...Array.from(strengthByNode.values()));

  const connected = new Set<MetricKey>();
  correlations.forEach((c) => { connected.add(c.metricA); connected.add(c.metricB); });

  const nodes: GraphNode[] = keys
    .filter((k) => connected.has(k))
    .map((k) => ({
      id: k,
      label: METRICS[k].label,
      category: METRICS[k].category,
      color: METRICS[k].color,
      importance: (strengthByNode.get(k) ?? 0) / maxStrength,
    }));

  const edges: GraphEdge[] = correlations.map((c) => ({
    source: c.metricA,
    target: c.metricB,
    weight: c.correlation,
    lagDays: c.lagDays,
    confidence: c.confidence.level === 'insufficient' ? 'low' : c.confidence.level,
  }));

  return { nodes, edges };
}
