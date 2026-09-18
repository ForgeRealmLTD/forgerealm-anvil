import { motion } from 'framer-motion';
import { formatCurrency } from '../../utils/currency';
import type { ExpensesSummary } from '../../types-anvil';

interface CategoryBarsProps {
  summary: ExpensesSummary;
  monthName: string;
  prevMonthName: string;
}

// Grouped horizontal bars, this month vs last, per category. Answers the
// tab's headline question: am I spending more or less than last month, and
// on what?
export default function CategoryBars({ summary, monthName, prevMonthName }: CategoryBarsProps) {
  const withSpend = summary.categories.filter((c) => c.this_month > 0 || c.last_month > 0);
  const max = Math.max(1, ...withSpend.flatMap((c) => [c.this_month, c.last_month]));

  if (withSpend.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        Nothing recorded for {monthName} or {prevMonthName} yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-gradient-gold inline-block" /> {monthName}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-white/[0.12] inline-block" /> {prevMonthName}
        </span>
      </div>
      {withSpend.map((c, i) => {
        const delta = c.this_month - c.last_month;
        return (
          <div key={c.id}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-gray-300">{c.name}</span>
              <span
                className={`text-[11px] tabular-nums font-medium
                  ${delta === 0 ? 'text-gray-600' : delta < 0 ? 'text-emerald-300' : 'text-gold'}`}
              >
                {delta === 0 ? '±0' : `${delta < 0 ? '−' : '+'}${formatCurrency(Math.abs(delta))}`}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 rounded bg-white/[0.02] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.this_month / max) * 100}%` }}
                    transition={{ delay: i * 0.04, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded bg-gradient-gold"
                  />
                </div>
                <span className="w-16 text-right text-xs tabular-nums text-gray-200">
                  {formatCurrency(c.this_month)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 rounded bg-white/[0.02] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.last_month / max) * 100}%` }}
                    transition={{ delay: i * 0.04 + 0.08, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded bg-white/[0.12]"
                  />
                </div>
                <span className="w-16 text-right text-xs tabular-nums text-gray-500">
                  {formatCurrency(c.last_month)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
