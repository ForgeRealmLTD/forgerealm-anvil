import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiGet, apiPost } from '../utils/api';
import { formatCurrency } from '../utils/currency';
import { useMonth, monthLabel, currentMonth } from '../utils/useMonth';
import MonthSelector from '../components/MonthSelector';
import ShelfHeatmap from '../components/minimall/ShelfHeatmap';
import SellThroughBars from '../components/minimall/SellThroughBars';
import ProductSheet from '../components/minimall/ProductSheet';
import CloseMonthSheet from '../components/minimall/CloseMonthSheet';
import type { MmOverview, MmProductRow } from '../types-anvil';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-card border border-glass-border shadow-card p-4 md:p-6 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-glass-border shadow-card p-4 md:p-5">
      <span className="block text-[11px] uppercase tracking-widest text-gray-500">{label}</span>
      <span
        className={`block font-display text-2xl md:text-4xl font-semibold mt-1 tabular-nums
          ${tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-white'}`}
      >
        {value}
      </span>
      {sub && <span className="block text-xs text-gray-500 mt-1">{sub}</span>}
    </div>
  );
}

export default function MiniMall() {
  const [month, setMonth] = useMonth();
  const [data, setData] = useState<MmOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MmProductRow | null>(null);
  const [closing, setClosing] = useState(false);
  const [openingCycle, setOpeningCycle] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const overview = await apiGet<MmOverview>(`/mini-mall/overview?month=${month}`);
      setData(overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const startCycle = async () => {
    if (openingCycle) return;
    setOpeningCycle(true);
    try {
      await apiPost('/mini-mall/months', { month });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open month');
    } finally {
      setOpeningCycle(false);
    }
  };

  const monthName = monthLabel(month);
  const record = data?.month_record ?? null;
  const rollup = data?.rollup;
  const hasShelf = (data?.slots.length ?? 0) > 0;
  const flagged = (data?.products ?? []).filter((p) => p.flag);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 min-w-0 w-full max-w-6xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-28 md:pb-12 space-y-4 md:space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">Mini Mall</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">
            Bay MM12 · Merrion Centre
            {record && (
              <span
                className={`ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium align-middle
                  ${record.status === 'open' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.06] text-gray-400'}`}
              >
                {record.status === 'open' ? 'Cycle open' : 'Cycle closed'}
              </span>
            )}
          </p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 md:h-28 rounded-2xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card className="text-center py-10">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => { setLoading(true); void load(); }} className="mt-3 text-xs text-gold hover:text-gold-light">
            Try again
          </button>
        </Card>
      ) : !hasShelf ? (
        <Card className="text-center py-14">
          <img src="/logo.png" alt="" className="w-16 h-16 rounded-2xl mx-auto opacity-60" />
          <h2 className="font-display text-xl text-white mt-4">The shelf is empty</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            No MM12 slots exist yet. Run the sample seed, or add slots to lay out the five-tier
            shelf with your bay codes.
          </p>
        </Card>
      ) : (
        <>
          {/* Monthly rollup */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="Units sold" value={String(rollup?.units_sold ?? 0)} sub={monthName} />
            <StatCard label="Gross revenue" value={formatCurrency(rollup?.gross_revenue ?? 0)} sub={monthName} />
            <StatCard
              label="Shelf fee"
              value={rollup?.shelf_fee ? formatCurrency(rollup.shelf_fee) : '—'}
              sub={rollup?.shelf_fee ? 'From Expenses' : 'No expense recorded'}
            />
            <StatCard
              label="Net after fee"
              value={formatCurrency(rollup?.net ?? 0)}
              sub={
                rollup?.paid_for_itself === null
                  ? 'Add the shelf fee to judge'
                  : rollup?.paid_for_itself
                    ? 'The bay paid for itself'
                    : 'Below the shelf fee'
              }
              tone={rollup?.paid_for_itself === null ? undefined : rollup?.paid_for_itself ? 'good' : 'bad'}
            />
          </div>

          {/* Cycle state */}
          {!record && (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-white">No cycle open for {monthName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Opening a cycle snapshots today’s display and back-stock counts as the month’s
                  opening position — sold units are derived from there.
                </p>
              </div>
              {month <= currentMonth() && (
                <button
                  onClick={startCycle}
                  disabled={openingCycle}
                  className="px-4 py-2.5 rounded-xl bg-gradient-gold text-navy text-sm font-semibold shadow-glow-gold-sm active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {openingCycle ? 'Opening…' : `Open ${monthName} cycle`}
                </button>
              )}
            </Card>
          )}
          {record?.status === 'open' && (
            <Card className="flex flex-wrap items-center justify-between gap-3 !py-3.5">
              <p className="text-xs text-gray-400">
                Sold figures are provisional — derived against the live shelf until you close the
                month with a physical count.
              </p>
              <button
                onClick={() => setClosing(true)}
                className="px-4 py-2 rounded-xl border border-gold/40 text-gold text-xs font-semibold hover:bg-gold/10 transition-colors"
              >
                Close {monthName}…
              </button>
            </Card>
          )}

          {/* Restock alerts */}
          {flagged.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {flagged.map((p) => (
                <button
                  key={p.product_id}
                  onClick={() => setSelected(p)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-transform active:scale-95
                    ${p.flag === 'restock'
                      ? 'border-gold/30 bg-gold/[0.07] text-gold'
                      : 'border-red-400/30 bg-red-400/[0.07] text-red-300'}`}
                >
                  <span className="font-mono text-[10px] opacity-70">{p.bay_code}</span>
                  <span className="font-medium">{p.name}</span>
                  <span className="opacity-80">{p.flag === 'restock' ? 'restock' : 'print'}</span>
                </button>
              ))}
            </div>
          )}

          {/* The shelf */}
          <Card>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-white">The shelf</h2>
              <span className="text-[11px] text-gray-500">Units sold · {monthName}</span>
            </div>
            <ShelfHeatmap slots={data!.slots} products={data!.products} onSelect={setSelected} />
          </Card>

          {/* Sell-through ranking */}
          <Card>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-white">Sell-through</h2>
              <span className="text-[11px] text-gray-500">sold ÷ available · best to worst</span>
            </div>
            <SellThroughBars products={data!.products} />
          </Card>

          {/* Stock detail */}
          <Card className="!p-0 overflow-hidden">
            <div className="p-4 md:p-6 pb-0 md:pb-0 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold text-white">Stock</h2>
              <span className="text-[11px] text-gray-500">Tap a row for actions</span>
            </div>
            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-white/[0.04] mt-3">
              {data!.products.map((p) => (
                <button
                  key={p.product_id}
                  onClick={() => setSelected(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/[0.03]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white truncate">{p.name}</span>
                      {p.flag && (
                        <span className={`shrink-0 w-2 h-2 rounded-full ${p.flag === 'restock' ? 'bg-gold' : 'bg-red-400'}`} />
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-gray-600">
                      {p.bay_code}
                      {p.colour ? ` · ${p.colour}` : ''}
                      {p.price !== null ? ` · ${formatCurrency(p.price)}` : ''}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-sm text-white tabular-nums">
                      {p.display_qty} <span className="text-gray-600">/</span> {p.back_qty}
                    </span>
                    <span className="block text-[10px] text-gray-500">disp / back</span>
                  </div>
                  <div className="text-right shrink-0 w-14">
                    <span className="block text-sm text-gold tabular-nums">{p.units_sold ?? '—'}</span>
                    <span className="block text-[10px] text-gray-500">sold</span>
                  </div>
                </button>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-500">
                    {['Bay', 'Product', 'Colour', 'Price', 'Display', 'Back', 'Sold', 'Revenue', 'Sell-through', ''].map((h) => (
                      <th key={h} className="text-left font-medium px-6 py-2 first:pl-6 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data!.products.map((p) => (
                    <tr
                      key={p.product_id}
                      onClick={() => setSelected(p)}
                      className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-2.5 font-mono text-xs text-gray-500">{p.bay_code}</td>
                      <td className="px-6 py-2.5 text-gray-200">
                        {p.name}
                        {p.not_for_sale && <span className="ml-2 text-[10px] text-gray-500">not for sale</span>}
                      </td>
                      <td className="px-6 py-2.5 text-gray-400 text-xs">{p.colour ?? '—'}</td>
                      <td className="px-6 py-2.5 tabular-nums text-gray-300">
                        {p.price !== null ? formatCurrency(p.price) : '—'}
                      </td>
                      <td className="px-6 py-2.5 tabular-nums text-gray-200">{p.display_qty}</td>
                      <td className="px-6 py-2.5 tabular-nums text-gray-200">{p.back_qty}</td>
                      <td className="px-6 py-2.5 tabular-nums text-gold">{p.units_sold ?? '—'}</td>
                      <td className="px-6 py-2.5 tabular-nums text-gray-200">
                        {p.units_sold !== null ? formatCurrency(p.revenue) : '—'}
                      </td>
                      <td className="px-6 py-2.5 tabular-nums text-gray-300">
                        {p.sell_through !== null ? `${Math.round(p.sell_through * 100)}%` : '—'}
                      </td>
                      <td className="px-6 py-2.5">
                        {p.flag && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium
                              ${p.flag === 'restock' ? 'bg-gold/10 text-gold' : 'bg-red-400/10 text-red-300'}`}
                          >
                            {p.flag === 'restock' ? 'Restock' : 'Needs printing'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {selected && (
        <ProductSheet product={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />
      )}
      {closing && record && (
        <CloseMonthSheet
          month={record}
          monthName={monthName}
          products={data!.products}
          onClose={() => setClosing(false)}
          onChanged={() => void load()}
        />
      )}
    </motion.div>
  );
}
