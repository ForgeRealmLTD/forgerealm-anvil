import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { heatColor, heatTextColor } from '../../utils/heat';
import type { MmProductRow, MmSlot } from '../../types-anvil';

type Metric = 'sold' | 'revenue' | 'stock' | 'sell_through';

interface ShelfHeatmapProps {
  slots: MmSlot[];
  products: MmProductRow[];
  monthName: string;
  onSelect?: (row: MmProductRow) => void;
}

const TIER_LABELS: Record<number, string> = {
  1: 'Top',
  2: 'Eye level',
  3: 'Eye level',
  4: 'Waist',
  5: 'Bottom',
};

const METRICS: { key: Metric; short: string; caption: string }[] = [
  { key: 'sold', short: 'Sold', caption: 'Units sold' },
  { key: 'revenue', short: 'Revenue', caption: 'Revenue taken' },
  { key: 'stock', short: 'Stock', caption: 'Units on display' },
  { key: 'sell_through', short: 'Sell-thru', caption: 'Sell-through rate' },
];

function valueOf(row: MmProductRow | undefined, metric: Metric): number | null {
  if (!row) return null;
  switch (metric) {
    case 'sold':
      return row.units_sold;
    case 'revenue':
      return row.units_sold === null ? null : row.revenue;
    case 'stock':
      return row.display_qty;
    case 'sell_through':
      return row.sell_through;
  }
}

function formatValue(v: number | null, metric: Metric): string {
  if (v === null) return '–';
  if (metric === 'revenue') return `£${Math.round(v)}`;
  if (metric === 'sell_through') return `${Math.round(v * 100)}%`;
  return String(v);
}

// Tier totals answer the merchandising question directly ("do eye-level slots
// out-earn the bottom shelf?") instead of leaving the eye to add up a row.
function summarise(values: (number | null)[], metric: Metric): string | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  if (metric === 'sell_through') {
    const mean = present.reduce((a, b) => a + b, 0) / present.length;
    return `${Math.round(mean * 100)}% avg`;
  }
  const total = present.reduce((a, b) => a + b, 0);
  if (metric === 'revenue') return `£${Math.round(total)}`;
  return `${total} ${metric === 'stock' ? 'out' : 'sold'}`;
}

// The MM12 shelf drawn as a shelf. Each slot is coloured on the navy→amber
// ramp by whichever metric is selected — sales data is the point, but stock
// keeps the grid useful before a month has ever been closed.
export default function ShelfHeatmap({ slots, products, monthName, onSelect }: ShelfHeatmapProps) {
  const [metric, setMetric] = useState<Metric>('sold');

  const byProduct = useMemo(() => new Map(products.map((p) => [p.product_id, p])), [products]);

  const tiers = useMemo(() => {
    const grouped = new Map<number, MmSlot[]>();
    for (const slot of slots) {
      if (!grouped.has(slot.tier)) grouped.set(slot.tier, []);
      grouped.get(slot.tier)!.push(slot);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tier, list]) => [tier, list.sort((a, b) => a.position - b.position)] as const);
  }, [slots]);

  const cols = useMemo(() => Math.max(1, ...slots.map((s) => s.position)), [slots]);

  const max = useMemo(() => {
    let m = 0;
    for (const slot of slots) {
      const v = valueOf(slot.product_id ? byProduct.get(slot.product_id) : undefined, metric);
      if (v !== null && v > m) m = v;
    }
    return m;
  }, [slots, byProduct, metric]);

  // A ramp across zeroes is a lie — fall back to flat cells and say why.
  const hasSpread = max > 0;
  const active = METRICS.find((m) => m.key === metric)!;

  if (slots.length === 0) return null;

  return (
    <div>
      {/* Header + metric switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">The shelf</h2>
          <p className="text-[11px] text-gray-500">
            {active.caption} · {monthName}
          </p>
        </div>
        <div className="flex rounded-xl bg-white/[0.04] p-1 gap-0.5 w-full sm:w-auto">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap
                ${metric === m.key ? 'bg-gradient-gold text-navy' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {m.short}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {tiers.map(([tier, tierSlots], tierIdx) => {
          const tierValues = tierSlots.map((s) =>
            valueOf(s.product_id ? byProduct.get(s.product_id) : undefined, metric)
          );
          const tierTotal = summarise(tierValues, metric);

          return (
            <div key={tier}>
              <div className="flex items-baseline justify-between mb-1 px-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">
                    Tier {tier}
                  </span>
                  <span className="text-[10px] text-gray-600">{TIER_LABELS[tier] || ''}</span>
                </div>
                {tierTotal && (
                  <span className="text-[10px] tabular-nums text-gray-400 font-medium">{tierTotal}</span>
                )}
              </div>

              {/* One shelf. Scrolls horizontally on mobile so cells stay tappable. */}
              <div className="overflow-x-auto pb-1 -mx-1 px-1">
                <div
                  className="flex gap-1.5 min-w-max md:min-w-0 md:grid"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {tierSlots.map((slot, i) => {
                    const row = slot.product_id ? byProduct.get(slot.product_id) : undefined;
                    const v = valueOf(row, metric);
                    const t = hasSpread && v !== null ? v / max : 0;
                    const empty = !slot.product_id;
                    const dead = slot.not_for_sale;
                    const lit = hasSpread && v !== null && v > 0;
                    const fg = lit ? heatTextColor(t) : 'rgba(255,255,255,0.72)';

                    return (
                      <motion.button
                        key={slot.id}
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: tierIdx * 0.04 + i * 0.012, duration: 0.22 }}
                        onClick={() => row && onSelect?.(row)}
                        disabled={!row}
                        title={slot.product_name || undefined}
                        className={`relative w-[104px] md:w-auto h-[86px] rounded-lg border text-left p-2 overflow-hidden transition-all duration-150
                          ${empty ? 'border-dashed border-white/[0.08]' : 'border-white/[0.06]'}
                          ${row ? 'active:scale-95 md:hover:ring-1 md:hover:ring-gold/50 md:hover:border-gold/30 cursor-pointer' : 'cursor-default'}`}
                        style={{
                          backgroundColor: empty
                            ? 'transparent'
                            : dead
                              ? '#151d2b'
                              : lit
                                ? heatColor(t)
                                : '#0f1d32',
                        }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className="text-[9px] font-mono tracking-tight"
                            style={{ color: empty || dead ? 'rgba(255,255,255,0.3)' : lit ? fg : 'rgba(255,255,255,0.4)' }}
                          >
                            {slot.bay_code}
                          </span>
                          {row?.flag && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${
                                row.flag === 'restock' ? 'bg-gold' : 'bg-red-400'
                              }`}
                              title={row.flag === 'restock' ? 'Needs restocking' : 'Needs printing'}
                            />
                          )}
                        </div>

                        {empty ? (
                          <span className="block text-[10px] text-gray-600 mt-2">Empty bay</span>
                        ) : (
                          <>
                            <span
                              className="block text-[10.5px] font-medium leading-[1.25] mt-1 line-clamp-2"
                              style={{ color: dead ? 'rgba(255,255,255,0.4)' : fg }}
                            >
                              {slot.product_name}
                            </span>
                            <div className="absolute bottom-1.5 left-2 right-2 flex items-end justify-between gap-1">
                              <span
                                className="text-[9px] tabular-nums"
                                style={{ color: lit ? fg : 'rgba(255,255,255,0.3)', opacity: lit ? 0.75 : 1 }}
                              >
                                {slot.price !== null ? `£${slot.price}` : ''}
                              </span>
                              <span
                                className="font-display text-base font-semibold tabular-nums leading-none"
                                style={{ color: dead ? 'rgba(255,255,255,0.3)' : fg }}
                              >
                                {dead ? '—' : formatValue(v, metric)}
                              </span>
                            </div>
                          </>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div className="h-1 rounded-full bg-gradient-to-r from-white/[0.03] via-gold/20 to-white/[0.03]" />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
        {hasSpread ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">{formatValue(0, metric)}</span>
            <div
              className="h-2 w-28 rounded-full"
              style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(1)})` }}
            />
            <span className="text-[10px] text-gray-500">{formatValue(max, metric)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-500">
            {metric === 'stock'
              ? 'No stock on display yet — tap a bay to enter counts.'
              : `No ${active.caption.toLowerCase()} for ${monthName} yet. Try Stock, or open a cycle and enter counts.`}
          </span>
        )}
        <span className="text-[10px] text-gray-600">Tap a slot for detail &amp; restock</span>
      </div>
    </div>
  );
}
