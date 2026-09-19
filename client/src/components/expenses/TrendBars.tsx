import { motion } from 'framer-motion';
import { formatCurrency } from '../../utils/currency';
import { monthLabel } from '../../utils/useMonth';
import type { ExpensesSummary } from '../../types-anvil';

interface TrendBarsProps {
  summary: ExpensesSummary;
}

// Twelve months of total spend, ending at the selected month.
export default function TrendBars({ summary }: TrendBarsProps) {
  const points = summary.trend;
  if (points.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center">No spend recorded in the last year.</p>;
  }
  const max = Math.max(1, ...points.map((p) => p.total));

  return (
    <div>
      <div className="flex items-end gap-1.5 md:gap-2 h-36">
        {points.map((p, i) => {
          const isSelected = p.month === summary.month;
          return (
            <div key={p.month} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <span className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] tabular-nums text-gray-300 whitespace-nowrap pointer-events-none">
                {formatCurrency(p.total)}
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max((p.total / max) * 100, 2)}%` }}
                transition={{ delay: i * 0.03, duration: 0.45, ease: 'easeOut' }}
                className={`w-full rounded-t-md ${isSelected ? 'bg-gradient-gold shadow-glow-gold-sm' : 'bg-white/[0.1] group-hover:bg-white/[0.18]'} transition-colors`}
              />
              <span className={`mt-1.5 text-[9px] ${isSelected ? 'text-gold' : 'text-gray-600'}`}>
                {monthLabel(p.month).slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
