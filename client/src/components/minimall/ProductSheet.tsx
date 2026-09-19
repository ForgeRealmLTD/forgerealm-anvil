import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiPost } from '../../utils/api';
import { formatCurrency } from '../../utils/currency';
import type { MmProductRow } from '../../types-anvil';

interface ProductSheetProps {
  product: MmProductRow | null;
  onClose: () => void;
  onChanged: () => void;
  onEdit?: (product: MmProductRow) => void;
}

type Action = 'to_display' | 'print_in' | 'off_display';

const ACTION_LABELS: Record<Action, { title: string; hint: string; cta: string }> = {
  to_display: {
    title: 'Restock display',
    hint: 'Moves units from back stock onto the shelf. Recorded with today’s date so the sold-units maths stays right.',
    cta: 'Move to display',
  },
  print_in: {
    title: 'Add prints to back stock',
    hint: 'New prints arriving into storage at the back of the store.',
    cta: 'Add to back stock',
  },
  off_display: {
    title: 'Take off display',
    hint: 'Moves units from the shelf back into storage.',
    cta: 'Move to back stock',
  },
};

// Slot detail + stock actions. Bottom sheet on mobile (one-handed in front
// of the shelf), centred modal on desktop.
export default function ProductSheet({ product, onClose, onChanged, onEdit }: ProductSheetProps) {
  const [action, setAction] = useState<Action>('to_display');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setAction(product.back_qty > 0 ? 'to_display' : 'print_in');
      setQty(1);
      setError(null);
    }
  }, [product?.product_id]);

  if (!product) return null;

  const max =
    action === 'to_display' ? product.back_qty : action === 'off_display' ? product.display_qty : 99;

  const submit = async () => {
    if (saving || qty < 1) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost('/mini-mall/movements', {
        product_id: product.product_id,
        type: action,
        quantity: qty,
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 38 }}
        className="fixed z-[80] inset-x-0 bottom-0 md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
          bg-card border border-white/[0.08] rounded-t-2xl md:rounded-2xl shadow-glass
          max-h-[88vh] overflow-y-auto md:w-[26rem]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
      >
        <div className="md:hidden w-10 h-1 rounded-full bg-white/15 mx-auto mt-2.5" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono text-gold/80">{product.bay_code}</span>
              <h3 className="font-display text-xl font-semibold text-white leading-tight">
                {product.name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {product.colour ? `${product.colour} · ` : ''}
                {product.price !== null ? formatCurrency(product.price) : 'No price'}
                {product.not_for_sale ? ' · Not for sale' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onEdit && (
                <button
                  onClick={() => onEdit(product)}
                  className="text-gray-500 hover:text-gold p-1.5"
                  aria-label="Edit bay"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11 15l-4 1 1-4 9.6-9.4z" />
                  </svg>
                </button>
              )}
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1.5" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'On display', value: product.display_qty },
              { label: 'Back stock', value: product.back_qty },
              { label: 'Sold this month', value: product.units_sold ?? '—' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-glass border border-glass-border p-3 text-center">
                <span className="block font-display text-2xl font-semibold text-white tabular-nums">
                  {stat.value}
                </span>
                <span className="block text-[10px] text-gray-500 mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>

          {product.flag && (
            <div
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                product.flag === 'restock'
                  ? 'bg-gold/10 text-gold border border-gold/25'
                  : 'bg-red-400/10 text-red-300 border border-red-400/25'
              }`}
            >
              {product.flag === 'restock'
                ? 'Low on display — back stock available, needs restocking.'
                : 'Low on display and no back stock — needs printing.'}
            </div>
          )}

          {/* Action switcher */}
          <div className="flex rounded-xl bg-white/[0.04] p-1 gap-1">
            {(Object.keys(ACTION_LABELS) as Action[]).map((a) => (
              <button
                key={a}
                onClick={() => { setAction(a); setQty(1); setError(null); }}
                className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors
                  ${action === a ? 'bg-gradient-gold text-navy' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {a === 'to_display' ? 'Restock' : a === 'print_in' ? 'Prints in' : 'Take off'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 -mt-2">{ACTION_LABELS[action].hint}</p>

          {/* Quantity stepper — big targets for one-handed use */}
          <div className="flex items-center justify-center gap-5">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-12 h-12 rounded-xl border border-white/[0.08] text-gray-300 text-xl active:scale-95 transition-transform"
            >
              −
            </button>
            <span className="font-display text-4xl font-semibold text-white w-16 text-center tabular-nums">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(max, q + 1))}
              className="w-12 h-12 rounded-xl border border-white/[0.08] text-gray-300 text-xl active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
          {action === 'to_display' && product.back_qty === 0 && (
            <p className="text-xs text-center text-red-300">No back stock to restock from.</p>
          )}
          {error && <p className="text-xs text-center text-red-300">{error}</p>}

          <button
            onClick={submit}
            disabled={saving || qty < 1 || qty > max}
            className="w-full py-3.5 rounded-xl bg-gradient-gold hover:bg-gradient-gold-hover text-navy font-semibold text-sm
              disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.99] shadow-glow-gold-sm"
          >
            {saving ? 'Saving…' : `${ACTION_LABELS[action].cta} · ${qty}`}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
