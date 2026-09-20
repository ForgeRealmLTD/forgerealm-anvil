import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPost } from '../../utils/api';
import type { MmBackRoomRow } from '../../types-anvil';

interface ProductOption {
  id: string;
  name: string;
  category: string | null;
  colour?: string | null;
}

interface BackStockFormProps {
  // Set when topping up or recounting a line that's already in the back;
  // null when adding something new.
  editing: MmBackRoomRow | null;
  onClose: () => void;
  onChanged: () => void;
}

const inputCls =
  'w-full h-11 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-sm text-white ' +
  'focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30 placeholder:text-gray-600';

const labelCls = 'text-[11px] text-gray-500';

// Putting stock into the back of the store. Two ways in, because they answer
// different questions: units that have just arrived get added to what's there,
// while a stock-take replaces it with what was actually counted.
export default function BackStockForm({ editing, onClose, onChanged }: BackStockFormProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [mode, setMode] = useState<'add' | 'set'>(editing ? 'set' : 'add');
  const [qty, setQty] = useState(editing ? editing.back_qty : 1);
  const [productId, setProductId] = useState(editing?.product_id ?? '');
  const [productQuery, setProductQuery] = useState(editing?.name ?? '');
  const [colour, setColour] = useState(editing?.colour ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [note, setNote] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<ProductOption[]>('/products')
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  const matches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [products, productQuery]);

  const exactMatch = products.find(
    (p) => p.name.toLowerCase() === productQuery.trim().toLowerCase()
  );

  const chooseProduct = (p: ProductOption) => {
    setProductId(p.id);
    setProductQuery(p.name);
    setColour((c) => c || p.colour || '');
    setCategory((c) => c || p.category || '');
    setPickerOpen(false);
  };

  const name = productQuery.trim();
  const current = editing?.back_qty ?? 0;
  const resulting = mode === 'set' ? qty : current + qty;

  const submit = async () => {
    if (saving) return;
    if (!productId && !name) {
      setError('Pick a product or type a name to create one');
      return;
    }
    if (mode === 'add' && qty < 1) {
      setError('Add at least one unit');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost('/mini-mall/back-stock', {
        product_id: productId || undefined,
        product_name: name,
        colour: colour.trim() || undefined,
        category: category.trim() || undefined,
        quantity: qty,
        mode,
        note: note.trim() || undefined,
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
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
        className="fixed z-[80] inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2
          bg-card border border-white/[0.08] rounded-t-2xl md:rounded-2xl shadow-glass
          max-h-[92vh] overflow-y-auto md:w-[28rem]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="md:hidden w-10 h-1 rounded-full bg-white/15 mx-auto mt-2.5" />
        <div className="p-5 space-y-3.5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">
                {editing ? editing.name : 'Into the back'}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {editing
                  ? `${editing.back_qty} in the back right now${editing.bay_code ? ` · ${editing.bay_code}` : ' · no bay yet'}`
                  : 'Storage at the back of the store. No bay needed.'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 -m-1" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Product */}
          {!editing && (
            <div className="relative">
              <span className={labelCls}>Product</span>
              <input
                value={productQuery}
                onChange={(e) => { setProductQuery(e.target.value); setPickerOpen(true); setProductId(''); }}
                onFocus={() => setPickerOpen(true)}
                placeholder="Search existing, or type a new name"
                className={inputCls}
              />
              {productId && !pickerOpen && (
                <span className="absolute right-3 top-[1.85rem] text-[10px] text-emerald-300">existing</span>
              )}
              {pickerOpen && (
                <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl bg-card border border-white/[0.1] shadow-glass overflow-hidden">
                  {matches.map((p) => (
                    <button
                      key={p.id} type="button" onClick={() => chooseProduct(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-white/[0.05] flex items-center justify-between gap-2"
                    >
                      <span className="text-xs text-gray-200 truncate">{p.name}</span>
                      <span className="text-[10px] text-gray-600 shrink-0">{p.category || '—'}</span>
                    </button>
                  ))}
                  {name && !exactMatch && (
                    <button
                      type="button" onClick={() => { setProductId(''); setPickerOpen(false); }}
                      className="w-full text-left px-3 py-2.5 bg-gold/[0.07] hover:bg-gold/[0.12] text-xs text-gold"
                    >
                      + Create “{name}”
                    </button>
                  )}
                  {matches.length === 0 && !name && (
                    <p className="px-3 py-2.5 text-[11px] text-gray-600">Start typing to search or create.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!editing && !productId && name && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Colour</span>
                <input
                  value={colour} onChange={(e) => setColour(e.target.value)}
                  placeholder="e.g. Marigold Yellow" className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Category</span>
                <input
                  value={category} onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Fidgets" className={inputCls}
                />
              </label>
            </div>
          )}

          {/* How the number should be read */}
          <div className="flex rounded-xl bg-white/[0.04] p-1 gap-1">
            {([
              ['add', 'Arrived'],
              ['set', 'Counted'],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setQty(m === 'set' ? current : 1); setError(null); }}
                className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors
                  ${mode === m ? 'bg-gradient-gold text-navy' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            {mode === 'add'
              ? 'New units going into the back, added to whatever is already there.'
              : 'What you have just counted in the back. Replaces the current number.'}
          </p>

          {/* Quantity */}
          <div className="flex items-center justify-center gap-5">
            <button
              onClick={() => setQty((n) => Math.max(mode === 'add' ? 1 : 0, n - 1))}
              className="w-12 h-12 rounded-xl border border-white/[0.08] text-gray-300 text-xl active:scale-95 transition-transform"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={mode === 'add' ? 1 : 0}
              value={qty}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setQty(Number.isFinite(n) ? Math.max(0, n) : 0);
              }}
              className="font-display text-4xl font-semibold text-white w-24 text-center tabular-nums
                bg-transparent border-0 focus:outline-none focus:ring-0 [appearance:textfield]
                [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => setQty((n) => n + 1)}
              className="w-12 h-12 rounded-xl border border-white/[0.08] text-gray-300 text-xl active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
          <p className="text-[11px] text-center text-gray-500">
            {mode === 'add'
              ? `${current} in the back → ${resulting} after this`
              : current === qty
                ? 'Same as the current count'
                : `${current} in the back → ${resulting}`}
          </p>

          <label className="block">
            <span className={labelCls}>Note (optional)</span>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'add' ? 'e.g. weekend print run' : 'e.g. found a bag in the back room'}
              className={inputCls}
            />
          </label>

          {error && <p className="text-xs text-center text-red-300">{error}</p>}

          <button
            onClick={submit}
            disabled={saving || (mode === 'add' && qty < 1)}
            className="w-full py-3.5 rounded-xl bg-gradient-gold hover:bg-gradient-gold-hover text-navy font-semibold text-sm
              disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.99] shadow-glow-gold-sm"
          >
            {saving ? 'Saving…' : mode === 'add' ? `Add ${qty} to the back` : `Set the back count to ${qty}`}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
