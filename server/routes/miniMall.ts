import { Router, Request, Response } from 'express';
import { query, pool } from '../db';

const router = Router();

// Bay MM12 at the Merrion Centre. No till feed exists: sales are derived by
// reconciling stock counts across a monthly cycle. See 002_mini_mall.sql for
// the model. Mini Mall stock never touches global_stock (the POS stall pool).

const BAY_PREFIX = 'MM12';
// At or below this many units on display, a slot is flagged for restocking
// (if back stock exists) or printing (if it doesn't).
const LOW_DISPLAY_THRESHOLD = 2;

function parseMonth(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return null;
  return `${raw}-01`;
}

// ── Overview: everything the Mini Mall tab needs in one call ─────────────

router.get('/overview', async (req: Request, res: Response) => {
  const monthStart = parseMonth(req.query.month);
  if (!monthStart) {
    res.status(400).json({ error: 'month=YYYY-MM is required' });
    return;
  }
  try {
    const [monthRes, slotsRes, backRes] = await Promise.all([
      query(`SELECT * FROM mm_months WHERE month = $1`, [monthStart]),
      query(`
        SELECT s.id, s.bay_number, s.tier, s.position, s.display_qty, s.price,
               s.not_for_sale, s.product_id,
               p.name AS product_name, p.colour, p.category
        FROM mm_slots s
        LEFT JOIN products p ON p.id = s.product_id
        ORDER BY s.tier, s.position`),
      query(`SELECT product_id, quantity FROM mm_back_stock`),
    ]);

    const monthRecord = monthRes.rows[0] || null;

    // Restocks (back → display) that happened inside the selected month.
    const restockRes = await query(
      `SELECT product_id, SUM(quantity)::int AS restocked
       FROM mm_movements
       WHERE type = 'to_display'
         AND occurred_at >= $1::date
         AND occurred_at < ($1::date + INTERVAL '1 month')
       GROUP BY product_id`,
      [monthStart]
    );

    const counts = monthRecord
      ? (
          await query(
            `SELECT product_id, kind, display_qty, back_qty
             FROM mm_counts WHERE month_id = $1`,
            [monthRecord.id]
          )
        ).rows
      : [];

    const backByProduct = new Map<string, number>(
      backRes.rows.map((r) => [r.product_id, Number(r.quantity)])
    );
    const restockedByProduct = new Map<string, number>(
      restockRes.rows.map((r) => [r.product_id, Number(r.restocked)])
    );
    const openingByProduct = new Map<string, number>();
    const closingByProduct = new Map<string, number>();
    for (const c of counts) {
      if (c.kind === 'opening') openingByProduct.set(c.product_id, Number(c.display_qty));
      else closingByProduct.set(c.product_id, Number(c.display_qty));
    }

    const products = slotsRes.rows
      .filter((s) => s.product_id)
      .map((s) => {
        const opening = openingByProduct.has(s.product_id)
          ? openingByProduct.get(s.product_id)!
          : null;
        const restocked = restockedByProduct.get(s.product_id) || 0;
        // For an open month the live display count is the provisional closing
        // count; a closed month uses the recorded closing count.
        const closing =
          monthRecord?.status === 'closed' && closingByProduct.has(s.product_id)
            ? closingByProduct.get(s.product_id)!
            : Number(s.display_qty);

        const price = s.price !== null ? Number(s.price) : null;
        let sold: number | null = null;
        let sellThrough: number | null = null;
        if (opening !== null && !s.not_for_sale) {
          sold = Math.max(0, opening + restocked - closing);
          const available = opening + restocked;
          sellThrough = available > 0 ? sold / available : null;
        }
        const backQty = backByProduct.get(s.product_id) || 0;
        const lowDisplay = Number(s.display_qty) <= LOW_DISPLAY_THRESHOLD && !s.not_for_sale;

        return {
          product_id: s.product_id,
          name: s.product_name,
          colour: s.colour,
          category: s.category,
          slot_id: s.id,
          bay_number: s.bay_number,
          bay_code: `${BAY_PREFIX}.${s.bay_number}`,
          tier: s.tier,
          position: s.position,
          not_for_sale: s.not_for_sale,
          price,
          display_qty: Number(s.display_qty),
          back_qty: backQty,
          opening_display: opening,
          restocked,
          closing_display: closing,
          units_sold: sold,
          revenue: sold !== null && price !== null ? +(sold * price).toFixed(2) : 0,
          sell_through: sellThrough,
          flag: lowDisplay ? (backQty > 0 ? 'restock' : 'print') : null,
        };
      });

    // Shelf fee for this month comes from the Expenses tab (mini_mall channel).
    const feeRes = await query(
      `SELECT COALESCE(SUM(e.amount), 0) AS fee
       FROM expenses e
       JOIN expense_categories c ON c.id = e.category_id
       WHERE e.channel = 'mini_mall'
         AND c.name = 'Mini Mall shelf fee'
         AND e.date >= $1::date
         AND e.date < ($1::date + INTERVAL '1 month')`,
      [monthStart]
    );
    const shelfFee = Number(feeRes.rows[0].fee);
    const unitsSold = products.reduce((n, p) => n + (p.units_sold || 0), 0);
    const grossRevenue = +products.reduce((n, p) => n + p.revenue, 0).toFixed(2);

    res.json({
      month: req.query.month,
      month_record: monthRecord,
      slots: slotsRes.rows.map((s) => ({
        ...s,
        bay_code: `${BAY_PREFIX}.${s.bay_number}`,
        display_qty: Number(s.display_qty),
        price: s.price !== null ? Number(s.price) : null,
      })),
      products,
      back_stock: backRes.rows.map((r) => ({ ...r, quantity: Number(r.quantity) })),
      rollup: {
        units_sold: unitsSold,
        gross_revenue: grossRevenue,
        shelf_fee: shelfFee,
        net: +(grossRevenue - shelfFee).toFixed(2),
        paid_for_itself: shelfFee > 0 ? grossRevenue >= shelfFee : null,
      },
    });
  } catch (err) {
    console.error('Error building mini mall overview:', err);
    res.status(500).json({ error: 'Failed to load mini mall overview' });
  }
});

// ── Slots ─────────────────────────────────────────────────────────────────

router.post('/slots', async (req: Request, res: Response) => {
  const { bay_number, tier, position, product_id, price, display_qty, not_for_sale } = req.body;
  if (!bay_number || !tier || !position) {
    res.status(400).json({ error: 'bay_number, tier and position are required' });
    return;
  }
  try {
    const result = await query(
      `INSERT INTO mm_slots (bay_number, tier, position, product_id, price, display_qty, not_for_sale)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), COALESCE($7, false))
       RETURNING *`,
      [bay_number, tier, position, product_id || null, price ?? null, display_qty, not_for_sale]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ error: 'That bay number or shelf position is already taken' });
      return;
    }
    console.error('Error creating slot:', err);
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

router.patch('/slots/:id', async (req: Request, res: Response) => {
  const allowed = ['bay_number', 'tier', 'position', 'product_id', 'price', 'display_qty', 'not_for_sale'];
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
      `UPDATE mm_slots SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Slot not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ error: 'That bay number or shelf position is already taken' });
      return;
    }
    console.error('Error updating slot:', err);
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

router.delete('/slots/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM mm_slots WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting slot:', err);
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

// ── Movements: the ledger that makes derived-sold work ───────────────────

router.get('/movements', async (req: Request, res: Response) => {
  const monthStart = parseMonth(req.query.month);
  try {
    const result = await query(
      `SELECT m.*, p.name AS product_name
       FROM mm_movements m
       JOIN products p ON p.id = m.product_id
       ${monthStart ? `WHERE m.occurred_at >= $1::date AND m.occurred_at < ($1::date + INTERVAL '1 month')` : ''}
       ORDER BY m.occurred_at DESC
       LIMIT 200`,
      monthStart ? [monthStart] : []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing movements:', err);
    res.status(500).json({ error: 'Failed to list movements' });
  }
});

router.post('/movements', async (req: Request, res: Response) => {
  const { product_id, type, quantity, note, occurred_at } = req.body;
  const qty = Math.trunc(Number(quantity));
  const validTypes = ['print_in', 'to_display', 'off_display', 'adjust_display', 'adjust_back'];
  if (!product_id || !validTypes.includes(type) || !Number.isFinite(qty) || qty === 0) {
    res.status(400).json({ error: 'product_id, valid type and non-zero quantity are required' });
    return;
  }
  const signed = ['adjust_display', 'adjust_back'].includes(type);
  if (!signed && qty < 0) {
    res.status(400).json({ error: `${type} quantity must be positive` });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (type === 'to_display' || type === 'off_display') {
      const slotRes = await client.query(
        `SELECT id, display_qty FROM mm_slots WHERE product_id = $1 FOR UPDATE`,
        [product_id]
      );
      if (slotRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Product has no shelf slot — assign one first' });
        return;
      }
      const slot = slotRes.rows[0];

      if (type === 'to_display') {
        const backRes = await client.query(
          `UPDATE mm_back_stock SET quantity = quantity - $2, updated_at = NOW()
           WHERE product_id = $1 AND quantity >= $2 RETURNING quantity`,
          [product_id, qty]
        );
        if (backRes.rows.length === 0) {
          await client.query('ROLLBACK');
          res.status(400).json({ error: 'Not enough back stock for that restock' });
          return;
        }
        await client.query(
          `UPDATE mm_slots SET display_qty = display_qty + $2, updated_at = NOW() WHERE id = $1`,
          [slot.id, qty]
        );
      } else {
        if (Number(slot.display_qty) < qty) {
          await client.query('ROLLBACK');
          res.status(400).json({ error: 'Not enough units on display to take off' });
          return;
        }
        await client.query(
          `UPDATE mm_slots SET display_qty = display_qty - $2, updated_at = NOW() WHERE id = $1`,
          [slot.id, qty]
        );
        await client.query(
          `INSERT INTO mm_back_stock (product_id, quantity) VALUES ($1, $2)
           ON CONFLICT (product_id) DO UPDATE SET quantity = mm_back_stock.quantity + $2, updated_at = NOW()`,
          [product_id, qty]
        );
      }
    } else if (type === 'print_in') {
      await client.query(
        `INSERT INTO mm_back_stock (product_id, quantity) VALUES ($1, $2)
         ON CONFLICT (product_id) DO UPDATE SET quantity = mm_back_stock.quantity + $2, updated_at = NOW()`,
        [product_id, qty]
      );
    } else if (type === 'adjust_display') {
      const upd = await client.query(
        `UPDATE mm_slots SET display_qty = GREATEST(display_qty + $2, 0), updated_at = NOW()
         WHERE product_id = $1 RETURNING id`,
        [product_id, qty]
      );
      if (upd.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Product has no shelf slot — assign one first' });
        return;
      }
    } else if (type === 'adjust_back') {
      await client.query(
        `INSERT INTO mm_back_stock (product_id, quantity)
         VALUES ($1, GREATEST($2, 0))
         ON CONFLICT (product_id)
         DO UPDATE SET quantity = GREATEST(mm_back_stock.quantity + $2, 0), updated_at = NOW()`,
        [product_id, qty]
      );
    }

    const movement = await client.query(
      `INSERT INTO mm_movements (product_id, type, quantity, note, occurred_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, NOW())) RETURNING *`,
      [product_id, type, qty, note || null, occurred_at || null]
    );

    await client.query('COMMIT');
    res.status(201).json(movement.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording movement:', err);
    res.status(500).json({ error: 'Failed to record movement' });
  } finally {
    client.release();
  }
});

// ── Monthly cycle ─────────────────────────────────────────────────────────

router.get('/months', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM mm_months ORDER BY month DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing months:', err);
    res.status(500).json({ error: 'Failed to list months' });
  }
});

// Open a month: creates the cycle and snapshots opening counts from the
// current live display/back quantities of every product on the shelf or in
// back stock.
router.post('/months', async (req: Request, res: Response) => {
  const monthStart = parseMonth(req.body.month);
  if (!monthStart) {
    res.status(400).json({ error: 'month=YYYY-MM is required' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const monthRes = await client.query(
      `INSERT INTO mm_months (month, notes) VALUES ($1, $2) RETURNING *`,
      [monthStart, req.body.notes || null]
    );
    const month = monthRes.rows[0];

    await client.query(
      `INSERT INTO mm_counts (month_id, product_id, kind, display_qty, back_qty)
       SELECT $1, p.id, 'opening',
              COALESCE(s.display_qty, 0),
              COALESCE(b.quantity, 0)
       FROM products p
       LEFT JOIN mm_slots s ON s.product_id = p.id
       LEFT JOIN mm_back_stock b ON b.product_id = p.id
       WHERE s.product_id IS NOT NULL OR COALESCE(b.quantity, 0) > 0`,
      [month.id]
    );

    await client.query('COMMIT');
    res.status(201).json(month);
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err?.code === '23505') {
      res.status(409).json({ error: 'That month is already open' });
      return;
    }
    console.error('Error opening month:', err);
    res.status(500).json({ error: 'Failed to open month' });
  } finally {
    client.release();
  }
});

// Close a month with a physical closing count. Counted values become the
// recorded closing counts AND reconcile the live display/back quantities.
router.post('/months/:id/close', async (req: Request, res: Response) => {
  const { counts } = req.body as {
    counts: { product_id: string; display_qty: number; back_qty?: number }[];
  };
  if (!Array.isArray(counts)) {
    res.status(400).json({ error: 'counts array is required' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const monthRes = await client.query(
      `SELECT * FROM mm_months WHERE id = $1 AND status = 'open' FOR UPDATE`,
      [req.params.id]
    );
    if (monthRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Open month not found' });
      return;
    }

    for (const c of counts) {
      const displayQty = Math.max(0, Math.trunc(Number(c.display_qty) || 0));
      const backQty = c.back_qty === undefined ? null : Math.max(0, Math.trunc(Number(c.back_qty) || 0));
      await client.query(
        `INSERT INTO mm_counts (month_id, product_id, kind, display_qty, back_qty)
         VALUES ($1, $2, 'closing', $3, $4)
         ON CONFLICT (month_id, product_id, kind)
         DO UPDATE SET display_qty = $3, back_qty = $4, counted_at = NOW()`,
        [req.params.id, c.product_id, displayQty, backQty]
      );
      await client.query(
        `UPDATE mm_slots SET display_qty = $2, updated_at = NOW() WHERE product_id = $1`,
        [c.product_id, displayQty]
      );
      if (backQty !== null) {
        await client.query(
          `INSERT INTO mm_back_stock (product_id, quantity) VALUES ($1, $2)
           ON CONFLICT (product_id) DO UPDATE SET quantity = $2, updated_at = NOW()`,
          [c.product_id, backQty]
        );
      }
    }

    const closed = await client.query(
      `UPDATE mm_months SET status = 'closed', closed_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json(closed.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error closing month:', err);
    res.status(500).json({ error: 'Failed to close month' });
  } finally {
    client.release();
  }
});

export default router;
