import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../utils/api';
import type { MmProductRow, MmSlot } from '../../types-anvil';

interface ProductOption {
  id: string;
  name: string;
  category: string | null;
  colour?: string | null;
  default_price: number | string;
}

interface SlotFormProps {
  editing: MmProductRow | null; // null = adding a new bay
  slots: MmSlot[];
  slotsPerTier: number;
  onClose: () => void;
  onChanged: () => void;
}

const inputCls =
  'w-full h-11 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-sm text-white ' +
  'focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30 placeholder:text-gray-600';

const labelCls = 'text-[11px] text-gray-500';

// Add or edit a bay on the MM12 shelf. Everything a bay needs lives here:
// where it sits, what's in it, the Mini Mall price, and both stock counts —
// so laying out the shelf is one pass through this form rather than a tour of
// four screens. "Save & add next" keeps it open and advances the bay number.
export default function SlotForm({ editing, slots, slotsPerTier, onClose, onChanged }: SlotFormProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const takenBays = useMemo(
    () => new Set(slots.filter((s) => s.id !== editing?.slot_id).map((s) => s.bay_number)),
    [slots, editing?.slot_id]
  );

  const nextFreeBay = useMemo(() => {
    let n = 1;
    while (takenBays.has(n)) n++;
    return n;
  }, [takenBays]);

  const [form, setForm] = useState(() => ({
    bay_number: String(editing?.bay_number ?? nextFreeBay),
    tier: String(editing?.tier ?? Math.ceil(nextFreeBay / slotsPerTier)),
    position: String(editing?.position ?? ((nextFreeBay - 1) % slotsPerTier) + 1),
    product_id: editing?.product_id ?? '',
    product_name: editing?.name ?? '',
    colour: editing?.colour ?? '',
    category: editing?.category ?? '',
    price: editing?.price != null ? String(editing.price) : '',
    display_qty: String(editing?.display_qty ?? 0),
    back_qty: String(editing?.back_qty ?? 0),
    not_for_sale: editing?.not_for_sale ?? false,
  }));
  const [productQuery, setProductQuery] = useState(editing?.name ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    void apiGet<ProductOption[]>('/products')
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Typing a bay number fills in tier/position on the standard layout; both
  // stay editable for shelves that don't follow it.
  const onBayChange = (raw: string) => {
    const n = parseInt(raw, 10);
    setForm((f) => ({
      ...f,
      bay_number: raw,
      ...(Number.isFinite(n) && n > 0
        ? { tier: String(Math.min(5, Math.ceil(n / slotsPerTier))), position: String(((n - 1) % slotsPerTier) + 1) }
        : {}),
    }));
  };

  const matches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [products, productQuery]);

  const exactMatch = products.find(
    (p) => p.name.toLowerCase() === productQuery.trim().toLowerCase()
  );

  const chooseProduct = (p: ProductOption) => {
    setProductQuery(p.name);
    setForm((f) => ({
      ...f,
      product_id: p.id,
      product_name: p.name,
      colour: f.colour || p.colour || '',
      category: f.category || p.category || '',
      price: f.price || String(p.default_price ?? ''),
    }));
    setPickerOpen(false);
  };

  const useAsNew = () => {
    setForm((f) => ({ ...f, product_id: '', product_name: productQuery.trim() }));
    setPickerOpen(false);
  };

  const reset = (bay: number) => {
    setForm({
      bay_number: String(bay),
      tier: String(Math.min(5, Math.ceil(bay / slotsPerTier))),
      position: String(((bay - 1) % slotsPerTier) + 1),
      product_id: '',
      product_name: '',
      colour: '',
      category: '',
      price: '',
      display_qty: '0',
      back_qty: '0',
      not_for_sale: false,
    });
    setProductQuery('');
  };

  const submit = async (addAnother: boolean) => {
    const bay = parseInt(form.bay_number, 10);
    const name = (form.product_id ? form.product_name : productQuery).trim();
    if (!Number.isFinite(bay) || bay < 1) {
      setError('A bay number is required');
      return;
    }
    if (!form.product_id && !name) {
      setError('Pick a product or type a name to create one');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      bay_number: bay,
      tier: Math.max(1, Math.min(5, parseInt(form.tier, 10) || 1)),
      position: Math.max(1, parseInt(form.position, 10) || 1),
      product_id: form.product_id || undefined,
      product_name: name,
      colour: form.colour.trim() || undefined,
      category: form.category.trim() || undefined,
      price: form.price === '' ? null : parseFloat(form.price),
      display_qty: Math.max(0, parseInt(form.display_qty, 10) || 0),
      back_qty: Math.max(0, parseInt(form.back_qty, 10) || 0),
      not_for_sale: form.not_for_sale,
    };

    try {
      if (editing) {
        await apiPatch(`/mini-mall/slots/${editing.slot_id}`, payload);
      } else {
        await apiPost('/mini-mall/slots', payload);
      }
      onChanged();
      if (addAnother && !editing) {
        setJustSaved(`MM12.${bay} saved`);
        window.setTimeout(() => setJustSaved(null), 2200);
        let next = bay + 1;
        while (takenBays.has(next)) next++;
        reset(next);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async () => {
    if (!editing) return;
    if (!window.confirm(`Clear bay ${editing.bay_code}? The product and its back stock are kept.`)) return;
    setSaving(true);
    try {
      await apiDelete(`/mini-mall/slots/${editing.slot_id}`);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear bay');
      setSaving(false);
    }
  };

  const bayTaken = takenBays.has(parseInt(form.bay_number, 10));

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
          max-h-[92vh] overflow-y-auto md:w-[30rem]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="md:hidden w-10 h-1 rounded-full bg-white/15 mx-auto mt-2.5" />
        <div className="p-5 space-y-3.5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">
                {editing ? `Edit ${editing.bay_code}` : 'Add a bay'}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {editing ? 'Bay position, product, price and both stock counts.' : 'MM12 shelf position and what sits in it.'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 -m-1" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Position */}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={labelCls}>Bay (MM12.)</span>
              <input
                type="number" inputMode="numeric" min={1}
                value={form.bay_number} onChange={(e) => onBayChange(e.target.value)}
                className={`${inputCls} ${bayTaken ? 'border-red-400/50' : ''}`}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Tier (1–5)</span>
              <input
                type="number" inputMode="numeric" min={1} max={5}
                value={form.tier} onChange={(e) => set('tier', e.target.value)} className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Position</span>
              <input
                type="number" inputMode="numeric" min={1}
                value={form.position} onChange={(e) => set('position', e.target.value)} className={inputCls}
              />
            </label>
          </div>
          {bayTaken && <p className="text-[11px] text-red-300 -mt-1.5">Bay MM12.{form.bay_number} already exists.</p>}

          {/* Product */}
          <div className="relative">
            <span className={labelCls}>Product</span>
            <input
              value={productQuery}
              onChange={(e) => { setProductQuery(e.target.value); setPickerOpen(true); set('product_id', ''); }}
              onFocus={() => setPickerOpen(true)}
              placeholder="Search existing, or type a new name"
              className={inputCls}
            />
            {form.product_id && !pickerOpen && (
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
                {productQuery.trim() && !exactMatch && (
                  <button
                    type="button" onClick={useAsNew}
                    className="w-full text-left px-3 py-2.5 bg-gold/[0.07] hover:bg-gold/[0.12] text-xs text-gold"
                  >
                    + Create “{productQuery.trim()}”
                  </button>
                )}
                {matches.length === 0 && !productQuery.trim() && (
                  <p className="px-3 py-2.5 text-[11px] text-gray-600">Start typing to search or create.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Colour</span>
              <input
                value={form.colour} onChange={(e) => set('colour', e.target.value)}
                placeholder="e.g. Marigold Yellow" className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Category</span>
              <input
                value={form.category} onChange={(e) => set('category', e.target.value)}
                placeholder="e.g. Fidgets" className={inputCls}
              />
            </label>
          </div>

          {/* Price + stock */}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={labelCls}>Price (£)</span>
              <input
                type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
                value={form.price} onChange={(e) => set('price', e.target.value)} className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>On display</span>
              <input
                type="number" inputMode="numeric" min={0}
                value={form.display_qty} onChange={(e) => set('display_qty', e.target.value)} className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Back stock</span>
              <input
                type="number" inputMode="numeric" min={0}
                value={form.back_qty} onChange={(e) => set('back_qty', e.target.value)} className={inputCls}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox" checked={form.not_for_sale}
              onChange={(e) => set('not_for_sale', e.target.checked)}
              className="accent-[#d4a843] w-4 h-4"
            />
            Display only — not for sale
          </label>

          {error && <p className="text-xs text-red-300">{error}</p>}
          <AnimatePresence>
            {justSaved && (
              <motion.p
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-emerald-300"
              >
                {justSaved} — next bay ready.
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex gap-2 pt-1">
            {editing && (
              <button
                onClick={removeSlot} disabled={saving}
                className="px-4 py-3.5 rounded-xl border border-red-400/30 text-red-300 text-sm font-medium hover:bg-red-400/10 transition-colors disabled:opacity-40"
              >
                Clear
              </button>
            )}
            {!editing && (
              <button
                onClick={() => void submit(true)} disabled={saving || bayTaken}
                className="flex-1 py-3.5 rounded-xl border border-gold/40 text-gold text-sm font-semibold hover:bg-gold/10 transition-colors disabled:opacity-40"
              >
                Save & add next
              </button>
            )}
            <button
              onClick={() => void submit(false)} disabled={saving || bayTaken}
              className="flex-1 py-3.5 rounded-xl bg-gradient-gold hover:bg-gradient-gold-hover text-navy font-semibold text-sm
                disabled:opacity-40 transition-all active:scale-[0.99] shadow-glow-gold-sm"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save bay'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
