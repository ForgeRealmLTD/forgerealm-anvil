import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiPost, apiPatch } from '../../utils/api';
import type { Expense, ExpenseCategory, ExpenseChannel } from '../../types-anvil';

interface ExpenseFormProps {
  categories: ExpenseCategory[];
  editing: Expense | null; // null = create
  defaultMonth: string; // YYYY-MM
  onClose: () => void;
  onChanged: () => void;
}

const CHANNELS: { value: ExpenseChannel; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'mini_mall', label: 'Mini Mall' },
  { value: 'kirkgate', label: 'Kirkgate' },
  { value: 'artsmix', label: 'Artsmix' },
];

const inputCls =
  'w-full h-11 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-sm text-white ' +
  'focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30 placeholder:text-gray-600';

// Add/edit a single expense, or create a recurring monthly template.
export default function ExpenseForm({ categories, editing, defaultMonth, onClose, onChanged }: ExpenseFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = defaultMonth === today.slice(0, 7) ? today : `${defaultMonth}-01`;

  const [form, setForm] = useState({
    date: editing?.date?.slice(0, 10) || defaultDate,
    category_id: editing?.category_id || categories[0]?.id || '',
    vendor: editing?.vendor || '',
    description: editing?.description || '',
    amount: editing ? String(editing.amount) : '',
    receipt_ref: editing?.receipt_ref || '',
    channel: (editing?.channel || 'general') as ExpenseChannel,
    is_asset: editing?.kind === 'asset',
    recurring: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local copy so a category added here is selectable immediately, before the
  // parent refetches.
  const [cats, setCats] = useState(categories);
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const addCategory = async () => {
    const name = (newCategory || '').trim();
    if (!name) { setNewCategory(null); return; }
    try {
      const created = await apiPost<ExpenseCategory>('/expenses/categories', { name });
      setCats((c) => [...c, created]);
      setForm((f) => ({ ...f, category_id: created.id }));
      setNewCategory(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount < 0) {
      setError('A description and a valid amount are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (form.recurring && !editing) {
        await apiPost('/expenses/recurring', {
          category_id: form.category_id,
          vendor: form.vendor.trim() || null,
          description: form.description.trim(),
          amount,
          day_of_month: Math.min(28, new Date(form.date + 'T00:00:00').getDate()),
          channel: form.channel,
          starts_on: form.date,
        });
      } else if (editing) {
        await apiPatch(`/expenses/${editing.id}`, {
          date: form.date,
          category_id: form.category_id,
          vendor: form.vendor.trim() || null,
          description: form.description.trim(),
          amount,
          receipt_ref: form.receipt_ref.trim() || null,
          channel: form.channel,
          kind: form.is_asset ? 'asset' : editing.kind === 'recurring_instance' ? 'recurring_instance' : 'one_off',
        });
      } else {
        await apiPost('/expenses', {
          date: form.date,
          category_id: form.category_id,
          vendor: form.vendor.trim() || null,
          description: form.description.trim(),
          amount,
          receipt_ref: form.receipt_ref.trim() || null,
          channel: form.channel,
          kind: form.is_asset ? 'asset' : 'one_off',
        });
      }
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
      <motion.form
        key="sheet"
        onSubmit={submit}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        className="fixed z-[80] inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2
          bg-card border border-white/[0.08] rounded-t-2xl md:rounded-2xl shadow-glass
          max-h-[90vh] overflow-y-auto md:w-[28rem] p-5 space-y-3.5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="md:hidden w-10 h-1 rounded-full bg-white/15 mx-auto -mt-2.5 mb-1" />
        <h3 className="font-display text-xl font-semibold text-white">
          {editing ? 'Edit expense' : 'Add expense'}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-gray-500">Date</span>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} required />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">Amount (£)</span>
            <input
              type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
              value={form.amount} onChange={(e) => set('amount', e.target.value)} className={inputCls} required
            />
          </label>
        </div>

        <div className="block">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-gray-500">Category</span>
            <button
              type="button"
              onClick={() => setNewCategory(newCategory === null ? '' : null)}
              className="text-[11px] text-gold hover:text-gold-light"
            >
              {newCategory === null ? '+ New category' : 'Cancel'}
            </button>
          </div>
          {newCategory === null ? (
            <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className={inputCls}>
              {cats.map((c) => (
                <option key={c.id} value={c.id} className="bg-card">{c.name}</option>
              ))}
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addCategory(); } }}
                placeholder="e.g. Travel & fuel"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => void addCategory()}
                className="shrink-0 px-4 h-11 rounded-lg bg-gradient-gold text-navy text-xs font-semibold active:scale-95 transition-transform"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <label className="block">
          <span className="text-[11px] text-gray-500">Description</span>
          <input
            value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="e.g. PLA Silk 1kg ×2" className={inputCls} required
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-gray-500">Supplier / vendor</span>
            <input value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="Optional" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">Receipt ref</span>
            <input value={form.receipt_ref} onChange={(e) => set('receipt_ref', e.target.value)} placeholder="Optional" className={inputCls} />
          </label>
        </div>

        <div>
          <span className="text-[11px] text-gray-500">Channel</span>
          <div className="flex rounded-xl bg-white/[0.04] p-1 gap-1 mt-1">
            {CHANNELS.map((ch) => (
              <button
                type="button" key={ch.value}
                onClick={() => set('channel', ch.value)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors
                  ${form.channel === ch.value ? 'bg-gradient-gold text-navy' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox" checked={form.is_asset}
              onChange={(e) => set('is_asset', e.target.checked)}
              className="accent-[#d4a843] w-4 h-4"
            />
            One-off asset
          </label>
          {!editing && (
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox" checked={form.recurring}
                onChange={(e) => set('recurring', e.target.checked)}
                className="accent-[#d4a843] w-4 h-4"
              />
              Repeats monthly
            </label>
          )}
        </div>
        {form.recurring && !editing && (
          <p className="text-[11px] text-gray-500 -mt-1">
            Creates a recurring template — an instance lands in every month automatically from{' '}
            {form.date} onward, on day {Math.min(28, new Date(form.date + 'T00:00:00').getDate())}.
          </p>
        )}

        {error && <p className="text-xs text-red-300">{error}</p>}

        <button
          type="submit" disabled={saving}
          className="w-full py-3.5 rounded-xl bg-gradient-gold hover:bg-gradient-gold-hover text-navy font-semibold text-sm
            disabled:opacity-40 transition-all active:scale-[0.99] shadow-glow-gold-sm"
        >
          {saving ? 'Saving…' : editing ? 'Save changes' : form.recurring ? 'Create recurring expense' : 'Add expense'}
        </button>
      </motion.form>
    </AnimatePresence>
  );
}
