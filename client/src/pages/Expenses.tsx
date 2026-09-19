import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiGet, apiDelete, apiPatch } from '../utils/api';
import { formatCurrency } from '../utils/currency';
import { useMonth, monthLabel, shiftMonth } from '../utils/useMonth';
import MonthSelector from '../components/MonthSelector';
import CategoryBars from '../components/expenses/CategoryBars';
import TrendBars from '../components/expenses/TrendBars';
import ExpenseForm from '../components/expenses/ExpenseForm';
import type { Expense, ExpenseCategory, ExpensesSummary, RecurringExpense } from '../types-anvil';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-card border border-glass-border shadow-card p-4 md:p-6 ${className}`}>
      {children}
    </div>
  );
}

const CHANNEL_LABELS: Record<string, string> = {
  mini_mall: 'Mini Mall',
  kirkgate: 'Kirkgate',
  artsmix: 'Artsmix',
  general: '',
};

export default function Expenses() {
  const [month, setMonth] = useMonth();
  const [summary, setSummary] = useState<ExpensesSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [showRecurring, setShowRecurring] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sum, list, cats, rec] = await Promise.all([
        apiGet<ExpensesSummary>(`/expenses/summary?month=${month}`),
        apiGet<Expense[]>(`/expenses?month=${month}`),
        apiGet<ExpenseCategory[]>('/expenses/categories'),
        apiGet<RecurringExpense[]>('/expenses/recurring'),
      ]);
      setSummary(sum);
      setExpenses(list);
      setCategories(cats);
      setRecurring(rec);
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

  const removeExpense = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    await apiDelete(`/expenses/${id}`);
    void load();
  };

  const toggleRecurring = async (r: RecurringExpense) => {
    await apiPatch(`/expenses/recurring/${r.id}`, { active: !r.active });
    void load();
  };

  const monthName = monthLabel(month);
  const prevMonthName = monthLabel(shiftMonth(month, -1));
  const totals = summary?.totals;
  const spendingLess = (totals?.delta ?? 0) <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 min-w-0 w-full max-w-5xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-28 md:pb-12 space-y-4 md:space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">Expenses</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">Every pound out, by month</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-white/[0.03] animate-pulse" />
          <div className="h-64 rounded-2xl bg-white/[0.03] animate-pulse" />
        </div>
      ) : error ? (
        <Card className="text-center py-10">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => { setLoading(true); void load(); }} className="mt-3 text-xs text-gold hover:text-gold-light">
            Try again
          </button>
        </Card>
      ) : (
        <>
          {/* Headline: total + delta vs last month */}
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="block text-[11px] uppercase tracking-widest text-gray-500">
                  Total spend · {monthName}
                </span>
                <span className="block font-display text-4xl md:text-5xl font-semibold text-white mt-1 tabular-nums">
                  {formatCurrency(totals?.this_month ?? 0)}
                </span>
              </div>
              <div className="text-right">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums
                    ${spendingLess ? 'bg-emerald-400/10 text-emerald-300' : 'bg-gold/10 text-gold'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d={spendingLess ? 'M19 14l-7 7m0 0l-7-7m7 7V3' : 'M5 10l7-7m0 0l7 7m-7-7v18'} />
                  </svg>
                  {formatCurrency(Math.abs(totals?.delta ?? 0))}
                  {totals?.delta_pct !== null && totals?.delta_pct !== undefined && (
                    <span className="opacity-75">({Math.abs(totals.delta_pct)}%)</span>
                  )}
                </div>
                <span className="block text-[11px] text-gray-500 mt-1.5">
                  vs {prevMonthName} · {formatCurrency(totals?.last_month ?? 0)}
                </span>
              </div>
            </div>
          </Card>

          {/* This month vs last, by category */}
          <Card>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-white">By category</h2>
              <span className="text-[11px] text-gray-500">{monthName} vs {prevMonthName}</span>
            </div>
            <CategoryBars summary={summary!} monthName={monthName} prevMonthName={prevMonthName} />
          </Card>

          {/* 12-month trend */}
          <Card>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-white">Twelve months</h2>
              <span className="text-[11px] text-gray-500">total spend per month</span>
            </div>
            <TrendBars summary={summary!} />
          </Card>

          {/* Ledger */}
          <Card className="!p-0 overflow-hidden">
            <div className="p-4 md:p-6 pb-2 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-white">{monthName} ledger</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRecurring((v) => !v)}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors
                    ${showRecurring ? 'border-gold/40 text-gold bg-gold/[0.06]' : 'border-white/[0.08] text-gray-400 hover:text-gray-200'}`}
                >
                  Recurring ({recurring.filter((r) => r.active).length})
                </button>
                <button
                  onClick={() => { setEditing(null); setFormOpen(true); }}
                  className="px-3.5 py-2 rounded-xl bg-gradient-gold text-navy text-xs font-semibold shadow-glow-gold-sm active:scale-95 transition-transform"
                >
                  + Add
                </button>
              </div>
            </div>

            {showRecurring && (
              <div className="mx-4 md:mx-6 mb-3 rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
                {recurring.length === 0 && (
                  <p className="text-xs text-gray-500 p-3">
                    No recurring expenses yet — tick “Repeats monthly” when adding one.
                  </p>
                )}
                {recurring.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <span className={`block text-xs truncate ${r.active ? 'text-gray-200' : 'text-gray-600 line-through'}`}>
                        {r.description}
                      </span>
                      <span className="block text-[10px] text-gray-600">
                        {r.category_name} · day {r.day_of_month}
                        {CHANNEL_LABELS[r.channel] ? ` · ${CHANNEL_LABELS[r.channel]}` : ''}
                      </span>
                    </div>
                    <span className="text-xs tabular-nums text-gray-300">{formatCurrency(Number(r.amount))}/mo</span>
                    <button
                      onClick={() => void toggleRecurring(r)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors
                        ${r.active
                          ? 'border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10'
                          : 'border-white/[0.1] text-gray-500 hover:text-gray-300'}`}
                    >
                      {r.active ? 'Active' : 'Paused'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {expenses.length === 0 ? (
              <div className="text-center py-12 px-4">
                <img src="/logo.png" alt="" className="w-14 h-14 rounded-2xl mx-auto opacity-50" />
                <p className="text-sm text-gray-500 mt-3">Nothing spent in {monthName} — the owl approves.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 md:px-6 py-3 group">
                    <div className="w-9 text-center shrink-0">
                      <span className="block font-display text-base text-gray-300 tabular-nums">
                        {new Date(e.date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-gray-200 truncate">{e.description}</span>
                        {e.kind === 'asset' && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-white/[0.06] text-gray-400">ASSET</span>
                        )}
                        {e.kind === 'recurring_instance' && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-gold/10 text-gold">↻</span>
                        )}
                      </div>
                      <span className="block text-[10px] text-gray-600 truncate">
                        {e.category_name}
                        {e.vendor ? ` · ${e.vendor}` : ''}
                        {CHANNEL_LABELS[e.channel] ? ` · ${CHANNEL_LABELS[e.channel]}` : ''}
                        {e.receipt_ref ? ` · #${e.receipt_ref}` : ''}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-gray-100 shrink-0">
                      {formatCurrency(Number(e.amount))}
                    </span>
                    <div className="flex gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditing(e); setFormOpen(true); }}
                        className="p-1.5 text-gray-500 hover:text-gold" aria-label="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11 15l-4 1 1-4 9.6-9.4z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => void removeExpense(e.id)}
                        className="p-1.5 text-gray-500 hover:text-red-300" aria-label="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {formOpen && (
        <ExpenseForm
          categories={categories}
          editing={editing}
          defaultMonth={month}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onChanged={() => void load()}
        />
      )}
    </motion.div>
  );
}
