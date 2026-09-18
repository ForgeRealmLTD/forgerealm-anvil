import { Router, Request, Response } from 'express';
import { query, pool } from '../db';

const router = Router();

// Every pound the business spends, by month. Recurring costs (the MM12 shelf
// fee, software subscriptions) live as templates in recurring_expenses and
// are materialised into real expense rows the first time a month is viewed —
// no scheduler required, which suits the Netlify serverless deploy.

const CHANNELS = ['mini_mall', 'kirkgate', 'artsmix', 'general'];
const KINDS = ['one_off', 'asset', 'recurring_instance'];

function parseMonth(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return null;
  return `${raw}-01`;
}

// Insert any missing recurring instances for the month. Idempotent: the
// NOT EXISTS guard (backed by a unique partial index) means each template
// materialises at most once per month. Future months are left alone.
async function materialiseRecurring(monthStart: string): Promise<void> {
  await query(
    `INSERT INTO expenses
       (date, category_id, vendor, description, amount, kind, channel, recurring_template_id)
     SELECT ($1::date + (r.day_of_month - 1) * INTERVAL '1 day')::date,
            r.category_id, r.vendor, r.description, r.amount,
            'recurring_instance', r.channel, r.id
     FROM recurring_expenses r
     WHERE r.active
       AND date_trunc('month', r.starts_on::timestamp) <= $1::timestamp
       AND $1::date <= date_trunc('month', CURRENT_DATE)::date
       AND NOT EXISTS (
         SELECT 1 FROM expenses e
         WHERE e.recurring_template_id = r.id
           AND date_trunc('month', e.date::timestamp) = $1::timestamp
       )`,
    [monthStart]
  );
}

// ── Categories ────────────────────────────────────────────────────────────

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM expense_categories ORDER BY sort_order, name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing categories:', err);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

// Add a category beyond the eight seeded ones. Sorts after them by default.
router.post('/categories', async (req: Request, res: Response) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const result = await query(
      `INSERT INTO expense_categories (name, sort_order)
       VALUES ($1, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM expense_categories))
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ── Recurring templates ───────────────────────────────────────────────────

router.get('/recurring', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, c.name AS category_name
       FROM recurring_expenses r
       JOIN expense_categories c ON c.id = r.category_id
       ORDER BY r.active DESC, c.sort_order, r.description`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing recurring expenses:', err);
    res.status(500).json({ error: 'Failed to list recurring expenses' });
  }
});

router.post('/recurring', async (req: Request, res: Response) => {
  const { category_id, vendor, description, amount, day_of_month, channel, starts_on } = req.body;
  if (!category_id || !description || amount === undefined) {
    res.status(400).json({ error: 'category_id, description and amount are required' });
    return;
  }
  if (channel && !CHANNELS.includes(channel)) {
    res.status(400).json({ error: 'Invalid channel' });
    return;
  }
  try {
    const result = await query(
      `INSERT INTO recurring_expenses
         (category_id, vendor, description, amount, day_of_month, channel, starts_on)
       VALUES ($1, $2, $3, $4, COALESCE($5, 1), COALESCE($6, 'general'), COALESCE($7, CURRENT_DATE))
       RETURNING *`,
      [category_id, vendor || null, description, amount, day_of_month, channel, starts_on]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating recurring expense:', err);
    res.status(500).json({ error: 'Failed to create recurring expense' });
  }
});

router.patch('/recurring/:id', async (req: Request, res: Response) => {
  const allowed = ['category_id', 'vendor', 'description', 'amount', 'day_of_month', 'channel', 'active', 'starts_on'];
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in req.body) {
      values.push(req.body[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }
  if (sets.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }
  values.push(req.params.id);
  try {
    const result = await query(
      `UPDATE recurring_expenses SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Recurring expense not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating recurring expense:', err);
    res.status(500).json({ error: 'Failed to update recurring expense' });
  }
});

router.delete('/recurring/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM recurring_expenses WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting recurring expense:', err);
    res.status(500).json({ error: 'Failed to delete recurring expense' });
  }
});

// ── Summary: the chart data ───────────────────────────────────────────────
//
// Per-category totals for the selected month and the month before, the total
// delta, and a 12-month running spend series ending at the selected month.

router.get('/summary', async (req: Request, res: Response) => {
  const monthStart = parseMonth(req.query.month);
  if (!monthStart) {
    res.status(400).json({ error: 'month=YYYY-MM is required' });
    return;
  }
  try {
    await materialiseRecurring(monthStart);
    // The previous month needs its recurring instances too or the comparison
    // is misleading.
    const prevRes = await query(
      `SELECT to_char($1::date - INTERVAL '1 month', 'YYYY-MM-DD') AS prev`,
      [monthStart]
    );
    const prevStart = prevRes.rows[0].prev;
    await materialiseRecurring(prevStart);

    const [byCategory, trend] = await Promise.all([
      query(
        `SELECT c.id, c.name, c.sort_order,
                COALESCE(SUM(e.amount) FILTER (
                  WHERE e.date >= $1::date AND e.date < ($1::date + INTERVAL '1 month')
                ), 0) AS this_month,
                COALESCE(SUM(e.amount) FILTER (
                  WHERE e.date >= ($1::date - INTERVAL '1 month') AND e.date < $1::date
                ), 0) AS last_month
         FROM expense_categories c
         LEFT JOIN expenses e ON e.category_id = c.id
         GROUP BY c.id, c.name, c.sort_order
         ORDER BY c.sort_order, c.name`,
        [monthStart]
      ),
      query(
        `SELECT to_char(date_trunc('month', e.date), 'YYYY-MM') AS month,
                SUM(e.amount) AS total
         FROM expenses e
         WHERE e.date >= ($1::date - INTERVAL '11 months')
           AND e.date < ($1::date + INTERVAL '1 month')
         GROUP BY 1 ORDER BY 1`,
        [monthStart]
      ),
    ]);

    const categories = byCategory.rows.map((r) => ({
      id: r.id,
      name: r.name,
      this_month: Number(r.this_month),
      last_month: Number(r.last_month),
    }));
    const thisTotal = +categories.reduce((n, c) => n + c.this_month, 0).toFixed(2);
    const lastTotal = +categories.reduce((n, c) => n + c.last_month, 0).toFixed(2);

    res.json({
      month: req.query.month,
      categories,
      totals: {
        this_month: thisTotal,
        last_month: lastTotal,
        delta: +(thisTotal - lastTotal).toFixed(2),
        delta_pct: lastTotal > 0 ? +(((thisTotal - lastTotal) / lastTotal) * 100).toFixed(1) : null,
      },
      trend: trend.rows.map((r) => ({ month: r.month, total: Number(r.total) })),
    });
  } catch (err) {
    console.error('Error building expenses summary:', err);
    res.status(500).json({ error: 'Failed to build expenses summary' });
  }
});

// ── Expenses CRUD ─────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const monthStart = parseMonth(req.query.month);
  if (!monthStart) {
    res.status(400).json({ error: 'month=YYYY-MM is required' });
    return;
  }
  try {
    await materialiseRecurring(monthStart);
    const result = await query(
      `SELECT e.*, c.name AS category_name
       FROM expenses e
       JOIN expense_categories c ON c.id = e.category_id
       WHERE e.date >= $1::date AND e.date < ($1::date + INTERVAL '1 month')
       ORDER BY e.date DESC, e.created_at DESC`,
      [monthStart]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing expenses:', err);
    res.status(500).json({ error: 'Failed to list expenses' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { date, category_id, vendor, description, amount, receipt_ref, kind, channel } = req.body;
  if (!date || !category_id || !description || amount === undefined) {
    res.status(400).json({ error: 'date, category_id, description and amount are required' });
    return;
  }
  if (kind && !KINDS.includes(kind)) {
    res.status(400).json({ error: 'Invalid kind' });
    return;
  }
  if (channel && !CHANNELS.includes(channel)) {
    res.status(400).json({ error: 'Invalid channel' });
    return;
  }
  try {
    const result = await query(
      `INSERT INTO expenses (date, category_id, vendor, description, amount, receipt_ref, kind, channel)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'one_off'), COALESCE($8, 'general'))
       RETURNING *`,
      [date, category_id, vendor || null, description, amount, receipt_ref || null, kind, channel]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  const allowed = ['date', 'category_id', 'vendor', 'description', 'amount', 'receipt_ref', 'kind', 'channel'];
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in req.body) {
      values.push(req.body[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }
  if (sets.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }
  values.push(req.params.id);
  try {
    const result = await query(
      `UPDATE expenses SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
