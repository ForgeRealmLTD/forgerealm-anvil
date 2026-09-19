import { motion } from 'framer-motion';
import type { MmProductRow } from '../../types-anvil';

interface SellThroughBarsProps {
  products: MmProductRow[];
}

// Horizontal sell-through ranking, best to worst. Secondary chart to the
// shelf heatmap: the heatmap answers "where sells", this answers "what".
export default function SellThroughBars({ products }: SellThroughBarsProps) {
  const ranked = products
    .filter((p) => !p.not_for_sale && p.sell_through !== null)
    .sort((a, b) => (b.sell_through ?? 0) - (a.sell_through ?? 0));

  if (ranked.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        Sell-through appears once the month has an opening count.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {ranked.map((p, i) => {
        const pct = Math.round((p.sell_through ?? 0) * 100);
        return (
          <div key={p.product_id} className="flex items-center gap-3">
            <div className="w-32 md:w-44 shrink-0 text-right">
              <span className="block text-xs text-gray-300 truncate">{p.name}</span>
              <span className="block text-[10px] font-mono text-gray-600">{p.bay_code}</span>
            </div>
            <div className="flex-1 h-5 rounded-md bg-white/[0.03] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 2)}%` }}
                transition={{ delay: i * 0.03, duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-md"
                style={{
                  background:
                    pct >= 60
                      ? 'linear-gradient(90deg, #b8912e, #ffc45e)'
                      : pct >= 30
                        ? 'linear-gradient(90deg, #8a6d23, #d4a843)'
                        : 'linear-gradient(90deg, #2a3649, #4a5568)',
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-sm font-display font-semibold tabular-nums text-gray-200">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
