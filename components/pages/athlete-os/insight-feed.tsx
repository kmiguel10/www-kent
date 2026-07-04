import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Clock, Link2, TrendingUp } from 'lucide-react';
import type { Insight, InsightKind } from '@/lib/athlete-os/types';

/**
 * Insight feed — renders the natural-language findings produced by the
 * insight-generation service. Purely presentational.
 */

const KIND_META: Record<InsightKind, { icon: React.ReactNode; color: string }> = {
  status:  { icon: <Activity size={15} />, color: '#10b981' },
  driver:  { icon: <Link2 size={15} />, color: '#0090FF' },
  timing:  { icon: <Clock size={15} />, color: '#a855f7' },
  warning: { icon: <AlertTriangle size={15} />, color: '#f97316' },
  trend:   { icon: <TrendingUp size={15} />, color: '#14b8a6' },
};

export default function InsightFeed({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-11">
        No insights yet — they appear as more days of data accumulate.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-gray-6">
      {insights.map((ins, i) => {
        const meta = KIND_META[ins.kind];
        return (
          <motion.div
            key={ins.id}
            className="flex gap-3 p-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4) }}
          >
            <div
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-6"
              style={{ color: meta.color, background: 'var(--gray-2)' }}
            >
              {meta.icon}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-gray-12">{ins.title}</span>
              <span className="text-sm text-gray-11">{ins.detail}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
