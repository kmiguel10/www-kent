# Athlete OS

A system for understanding how recovery, sleep, training load, and running
performance relate to each other — surfacing correlations and insights across
Garmin, WHOOP, and Strava that no single platform shows on its own.

Lives at **`/athlete-os`**. It is fully isolated from the production `/fitness`
dashboard: it shares only the read-only Supabase client factory and adds an
additive nav entry. No existing `/fitness` file is modified.

## Architecture

```
lib/athlete-os/
  types/                      Type contracts (MetricKey, DailyMatrix, Correlation, …)
  metrics/registry.ts         Metric metadata (label, source, direction, colour) — single source of truth
  services/
    correlation/
      normalization.ts        Daily alignment, z-score, 0–100 scaling, pairing, windowing
      correlationEngine.ts    Pearson + Spearman + per-pair analysis
      lagAnalysis.ts          Best-lag scan across 0/1/2/3/7/14 days
      confidenceScoring.ts    Sample size + significance → high/moderate/low/insufficient
      relationshipDiscovery.ts All-pairs discovery → concept graph
      insightGeneration.ts    Correlation/score outputs → natural-language findings
    scoring/
      trainingLoad.ts         Derived daily load (suffer score + HR-weighted TRIMP proxy)
      athleteScore.ts         Composite 0–100 daily readiness + contributors
      marathonReadiness.ts    Derived readiness index (base + freshness + consistency + sleep)
components/pages/athlete-os/   Presentational: orb, insight-feed, correlation-explorer, relationship-graph
pages/api/athlete-os/metrics.ts  Read-only data adapter → normalized daily matrix + scores
pages/athlete-os/index.tsx     Route
```

### Data flow

```
Supabase (sleep_records, recovery_records, whoop_*, activities)
  → pages/api/athlete-os/metrics.ts   (normalize to one aligned daily matrix + derive scores)
  → athlete-os-dashboard.tsx          (fetch once)
  → services/correlation/*            (PURE — run client-side; recompute on window/lag change)
  → orb / insights / explorer / graph (render only)
```

The correlation engine has **no React imports** and is unit-testable in
isolation. Components never contain statistics.

## Derived metrics (honest composites)

Several metrics have no native data source, so they are documented composites of
real signals — never fabricated:

- **Training Load** — `suffer_score` when present, else an HR-weighted TRIMP-like
  proxy from duration × intensity. See `scoring/trainingLoad.ts`.
- **Athlete Score (0–100)** — weighted blend of recovery, HRV, sleep score, sleep
  performance, training readiness, body battery, resting HR, minus a fatigue
  penalty from elevated load. Weights in `scoring/athleteScore.ts`.
- **Marathon Readiness (0–100)** — 35% aerobic base (28-day mileage) + 30%
  freshness (recovery/HRV) + 20% consistency + 15% sleep. A relative trend
  signal, not a race-time predictor. See `scoring/marathonReadiness.ts`.

## Data coverage (as of build)

Deep history from Garmin/Strava (~170–340 days): sleep, HRV, resting HR, body
battery, stress, training readiness, mileage, run pace, training load. WHOOP
metrics (recovery %, strain, sleep performance) are recent and will deepen over
time — correlations involving them stay low-confidence until enough overlap
accrues, which the confidence scorer surfaces explicitly.

Not yet available (would need new syncs): Runna plans, VO₂ max, cycling/running
power, strength volume, Oura/Apple Health/Fitbit.

## Extending

- **Add a metric/source:** add an entry to `metrics/registry.ts` and populate it
  in `pages/api/athlete-os/metrics.ts`. The engine, explorer, and graph pick it
  up automatically.
- **Add a visualization:** drop a component in `components/pages/athlete-os/` and
  add a `Panel` in `athlete-os-dashboard.tsx`.

## Library choices

- **Athlete Orb** — SVG + framer-motion (already a dependency; no 3D needed).
- **Correlation Explorer** — recharts `ScatterChart` + regression `ReferenceLine`
  (house charting lib; zero new deps).
- **Relationship Graph** — custom SVG + a small deterministic force simulation
  (~10 nodes; avoids pulling in a graph library).

Net new dependencies added: **none.**
