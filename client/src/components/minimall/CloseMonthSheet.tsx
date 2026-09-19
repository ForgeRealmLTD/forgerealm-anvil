import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiPost } from '../../utils/api';
import type { MmProductRow, MmMonth } from '../../types-anvil';

interface CloseMonthSheetProps {
  month: MmMonth;
  monthName: string;
  products: MmProductRow[];
  onClose: () => void;
  onChanged: () => void;
}

// Closing count entry: walk the shelf, count what's left, type it in.
// Pre-filled with the live quantities so untouched rows cost nothing.
export default function CloseMonthSheet({ month, monthName, products, onClose, onChanged }: CloseMonthSheetProps) {
  const [counts, setCounts] = useState<Record<string, { display: string; back: string }>>(() =>
    Object.fromEntries(
      products.map((p) => [p.product_id, { display: String(p.display_qty), back: String(p.back_qty) }])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost(`/mini-mall/months/${month.id}/close`, {
        counts: products.map((p) => ({
          product_id: p.product_id,
          display_qty: Math.max(0, parseInt(counts[p.product_id]?.display || '0', 10) || 0),
          back_qty: Math.max(0, parseInt(counts[p.product_id]?.back || '0', 10) || 0),
        })),
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close the month');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        className="fixed z-[80] inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-8
          bg-card border border-white/[0.08] rounded-t-2xl md:rounded-2xl shadow-glass
          max-h-[90vh] md:w-[34rem] flex flex-col"
      >
        <div className="md:hidden w-10 h-1 rounded-full bg-white/15 mx-auto mt-2.5" />
        <div className="p-5 pb-3">
          <h3 className="font-display text-xl font-semibold text-white">Close {monthName}</h3>
          <p className="text-xs text-gray-500 mt-1">
            Enter the closing count for each bay. Units sold this month are derived from these
            numbers, and they become the live stock going forward.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 space-y-1.5">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 text-[10px] uppercase tracking-widest text-gray-500 pb-1 sticky top-0 bg-card">
            <span>Product</span>
            <span className="text-center">Display</span>
            <span className="text-center">Back</span>
          </div>
          {products.map((p) => (
            <div key={p.product_id} className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 items-center">
              <div className="min-w-0">
                <span className="block text-xs text-gray-300 truncate">{p.name}</span>
                <span className="block text-[10px] font-mono text-gray-600">{p.bay_code}</span>
              </div>
              {(['display', 'back'] as const).map((field) => (
                <input
                  key={field}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={counts[p.product_id]?.[field] ?? ''}
                  onChange={(e) =>
                    setCounts((c) => ({
                      ...c,
                      [p.product_id]: { ...c[p.product_id], [field]: e.target.value },
                    }))
                  }
                  className="h-11 rounded-lg bg-white/[0.04] border border-white/[0.08] text-center text-sm text-white
                    focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30 tabular-nums"
                />
              ))}
            </div>
          ))}
        </div>
        <div className="p-5 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}>
          {error && <p className="text-xs text-center text-red-300 mb-2">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-gradient-gold hover:bg-gradient-gold-hover text-navy font-semibold text-sm
              disabled:opacity-40 transition-all active:scale-[0.99] shadow-glow-gold-sm"
          >
            {saving ? 'Closing…' : 'Close month & lock counts'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
