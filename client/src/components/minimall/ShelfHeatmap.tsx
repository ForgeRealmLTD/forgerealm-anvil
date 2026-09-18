import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { heatColor, heatTextColor } from '../../utils/heat';
import type { MmProductRow, MmSlot } from '../../types-anvil';

interface ShelfHeatmapProps {
  slots: MmSlot[];
  products: MmProductRow[];
  onSelect?: (row: MmProductRow) => void;
}

const TIER_LABELS: Record<number, string> = {
  1: 'Top',
  2: 'Eye level',
  3: 'Eye level',
  4: 'Waist',
  5: 'Bottom',
};

// The five-tier MM12 shelf rendered as a shelf: one row per tier, each slot
// coloured by units sold this month on the navy→amber ramp. Reads like a
// performance map — hot eye-level rows vs a cold bottom tier are visible at
// a glance.
export default function ShelfHeatmap({ slots, products, onSelect }: ShelfHeatmapProps) {
  const byProduct = useMemo(
    () => new Map(products.map((p) => [p.product_id, p])),
    [products]
  );
  const maxSold = useMemo(
    () => Math.max(1, ...products.map((p) => p.units_sold ?? 0)),
    [products]
  );

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

  if (slots.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {tiers.map(([tier, tierSlots], tierIdx) => (
        <div key={tier}>
          <div className="flex items-baseline gap-2 mb-1 px-0.5">
            <span className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">
              Tier {tier}
            </span>
            <span className="text-[10px] text-gray-600">{TIER_LABELS[tier] || ''}</span>
          </div>
          {/* One shelf: scrolls horizontally on mobile so cells stay tappable */}
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="flex gap-1.5 min-w-max md:min-w-0 md:grid md:grid-cols-10">
              {tierSlots.map((slot, i) => {
                const row = slot.product_id ? byProduct.get(slot.product_id) : undefined;
                const sold = row?.units_sold ?? null;
                const t = sold !== null ? sold / maxSold : 0;
                const empty = !slot.product_id;
                const dead = slot.not_for_sale;

                return (
                  <motion.button
                    key={slot.id}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: tierIdx * 0.05 + i * 0.015, duration: 0.25 }}
                    onClick={() => row && onSelect?.(row)}
                    disabled={!row}
                    className={`relative w-[92px] md:w-auto h-[74px] rounded-lg border text-left p-1.5 overflow-hidden transition-transform duration-150
                      ${empty ? 'border-dashed border-white/[0.08]' : 'border-white/[0.06]'}
                      ${row ? 'active:scale-95 md:hover:ring-1 md:hover:ring-gold/50 cursor-pointer' : 'cursor-default'}`}
                    style={{
                      backgroundColor: empty ? 'transparent' : dead ? '#151d2b' : heatColor(t),
                    }}
                  >
                    <span
                      className="block text-[9px] font-mono tracking-tight"
                      style={{ color: empty || dead ? 'rgba(255,255,255,0.35)' : heatTextColor(t) }}
                    >
                      {slot.bay_code}
                    </span>
                    {empty ? (
                      <span className="block text-[10px] text-gray-600 mt-1.5">Empty</span>
                    ) : (
                      <>
                        <span
                          className="block text-[10px] font-medium leading-tight mt-0.5 line-clamp-2"
                          style={{ color: dead ? 'rgba(255,255,255,0.4)' : heatTextColor(t) }}
                        >
                          {slot.product_name}
                        </span>
                        <span
                          className="absolute bottom-1 right-1.5 font-display text-sm font-semibold tabular-nums"
                          style={{ color: dead ? 'rgba(255,255,255,0.3)' : heatTextColor(t) }}
                        >
                          {dead ? '—' : sold === null ? '·' : sold}
                        </span>
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
          {/* The shelf plank */}
          <div className="h-1 rounded-full bg-gradient-to-r from-white/[0.03] via-gold/20 to-white/[0.03]" />
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">0 sold</span>
          <div
            className="h-2 w-28 rounded-full"
            style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(1)})` }}
          />
          <span className="text-[10px] text-gray-500">{maxSold} sold</span>
        </div>
        <span className="text-[10px] text-gray-600">Tap a slot for detail & restock</span>
      </div>
    </div>
  );
}
