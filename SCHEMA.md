# ForgeRealm Anvil — database schema

Reference for the tables behind the **Mini Mall** and **Expenses** tabs, plus the
existing Point of Sale tables they sit alongside.

Everything here is created for you by `npm run migrate`, which applies the numbered
files in `server/db/migrations/` once each and records them in `schema_migrations`.
This document is the human-readable version: what each table is for, how they relate,
and the exact SQL if you'd rather create them by hand.

**Nothing in here is destructive.** Migrations only add tables and columns; no existing
POS table is altered beyond one new nullable column (`products.colour`).

---

## Map

```
                    ┌──────────────┐
                    │   products   │  shared: POS and Mini Mall both point at it
                    └──────┬───────┘
          ┌────────────────┼────────────────────────┐
          │                │                        │
   ┌──────▼──────┐  ┌──────▼────────┐        ┌──────▼─────────┐
   │ global_stock│  │   mm_slots    │        │ mm_back_stock  │
   │ (POS pool)  │  │ (the shelf)   │        │ (storage)      │
   └─────────────┘  └───────────────┘        └────────────────┘
                            │
                     ┌──────▼───────┐   ┌──────────────┐
                     │ mm_movements │   │  mm_months   │
                     │  (ledger)    │   │  (cycles)    │
                     └──────────────┘   └──────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │  mm_counts   │
                                        └──────────────┘

   ┌─────────────────────┐      ┌──────────────────────┐
   │ expense_categories  │◄─────┤       expenses       │
   └─────────────────────┘      └──────────┬───────────┘
                                           │ recurring_template_id
                                ┌──────────▼───────────┐
                                │  recurring_expenses  │
                                └──────────────────────┘
```

**Mini Mall stock is separate from POS stock by design.** `global_stock` is the central
pool the market stalls draw from. `mm_slots` and `mm_back_stock` belong to bay MM12
only. Selling at Kirkgate never moves a Merrion Centre number, and vice versa. The only
thing the two share is the `products` catalogue.

---

## Mini Mall

### `mm_slots` — the physical shelf

One row per bay position on the five-tier unit. This is what the shelf heatmap renders.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `bay_number` | INTEGER, unique | The number in the printed label — `14` means `MM12.14` |
| `tier` | INTEGER 1–5 | Which shelf. 1 = top |
| `position` | INTEGER | Left-to-right slot within the tier. Unique with `tier` |
| `product_id` | UUID → products, nullable | NULL = empty bay |
| `display_qty` | INTEGER ≥ 0 | What's physically out on the shelf right now |
| `price` | DECIMAL(10,2), nullable | Mini Mall price. Independent of `products.default_price`, because MM12 prices differ from stall prices |
| `not_for_sale` | BOOLEAN | Display-only pieces (e.g. `MM12.23` Haku). Excluded from sold/sell-through maths |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

`tier` and `position` are ordinary editable data — if the real merchandising layout
doesn't match, correct it in the UI rather than in code.

### `mm_back_stock` — storage at the back of the store

| Column | Type | Notes |
|---|---|---|
| `product_id` | UUID PK → products | |
| `quantity` | INTEGER ≥ 0 | Units held in the back, ready to replenish the display |
| `updated_at` | TIMESTAMPTZ | |

### `mm_months` — the monthly reconciliation cycle

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `month` | DATE, unique | Always the 1st of the month |
| `status` | `open` \| `closed` | |
| `notes` | TEXT | |
| `closed_at` | TIMESTAMPTZ | |

### `mm_movements` — the dated stock ledger

This is what makes derived sales possible: without knowing when units were added to the
display, you can't tell a sale from a restock.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `product_id` | UUID → products | |
| `type` | see below | |
| `quantity` | INTEGER ≠ 0 | |
| `occurred_at` | TIMESTAMPTZ | The date is load-bearing — it decides which month the movement counts toward |
| `note` | TEXT | |

| `type` | Meaning | Effect |
|---|---|---|
| `print_in` | New prints arriving | back stock **+** |
| `to_display` | Restocking the shelf | back stock **−**, display **+** |
| `off_display` | Pulling stock off the shelf | display **−**, back stock **+** |
| `adjust_display` | Correction (signed) | display ± |
| `adjust_back` | Correction (signed) | back stock ± |

Only `to_display` enters the sold calculation.

### `mm_counts` — opening and closing physical counts

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `month_id` | UUID → mm_months | |
| `product_id` | UUID → products | |
| `kind` | `opening` \| `closing` | Unique with `month_id` + `product_id` |
| `display_qty` | INTEGER ≥ 0 | |
| `back_qty` | INTEGER, nullable | |
| `counted_at` | TIMESTAMPTZ | |

### How units sold is derived

The Mini Mall gives no transaction data, so sales come out of the stock arithmetic:

```
units sold   = opening display + Σ(to_display this month) − closing display
revenue      = units sold × slot price
sell-through = units sold ÷ (opening display + Σ to_display)
```

While a month is **open**, the live `mm_slots.display_qty` stands in for the closing
count, so the figures update as you restock — provisional but useful. **Closing** the
month writes real `closing` counts, and those numbers also become the new live display
and back-stock quantities.

### `products.colour`

One new nullable column on the existing table: a retail-friendly colour name
("Marigold Yellow") shown throughout the Mini Mall views. POS ignores it.

---

## Expenses

### `expense_categories`

Seeded with eight categories; you can add your own from the expense form.

`Filament & materials` · `Stall & pitch fees` · `Mini Mall shelf fee` ·
`Equipment & assets` · `Packaging & consumables` · `Software, hosting & domains` ·
`Compliance & certification` · `Other`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | VARCHAR(100), unique | |
| `sort_order` | INTEGER | Display order |

### `expenses`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `date` | DATE | Which month it lands in |
| `category_id` | UUID → expense_categories | |
| `vendor` | VARCHAR(255) | Supplier |
| `description` | TEXT | |
| `amount` | DECIMAL(10,2) ≥ 0 | |
| `receipt_ref` | VARCHAR(255) | Optional receipt/invoice reference |
| `kind` | `one_off` \| `asset` \| `recurring_instance` | `asset` marks equipment purchases so they can be separated from running costs |
| `channel` | `mini_mall` \| `kirkgate` \| `artsmix` \| `general` | Drives per-channel profitability, and how the Mini Mall tab finds its shelf fee |
| `recurring_template_id` | UUID → recurring_expenses, nullable | Set on materialised instances |

### `recurring_expenses` — monthly templates

So the MM12 shelf fee isn't re-entered twelve times a year.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `category_id` | UUID → expense_categories | |
| `vendor` / `description` | | |
| `amount` | DECIMAL(10,2) ≥ 0 | |
| `day_of_month` | INTEGER 1–28 | Capped at 28 so every month has the date |
| `channel` | as above | |
| `active` | BOOLEAN | Pause without deleting history |
| `starts_on` | DATE | No instances before this month |

**Materialisation:** instances are created the first time a month is viewed, not by a
scheduler (nothing to run on a serverless deploy). A unique partial index on
`(recurring_template_id, date_trunc('month', date))` makes it idempotent — viewing a
month fifty times still produces one shelf-fee row. Future months are never
pre-materialised.

### How Mini Mall finds its shelf fee

The Mini Mall rollup sums expenses in the selected month where
`channel = 'mini_mall'` **and** category is `Mini Mall shelf fee`. So the shelf fee is
entered once, in Expenses, and both tabs agree on the number.

---

## Creating the tables by hand

If you'd rather not use the migration runner, the SQL is in:

- `server/db/migrations/001_baseline.sql` — existing POS schema (idempotent; safe to
  re-run on a database that already has it)
- `server/db/migrations/002_mini_mall.sql` — everything under **Mini Mall** above
- `server/db/migrations/003_expenses.sql` — everything under **Expenses** above

Apply them in order:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f server/db/migrations/001_baseline.sql \
  -f server/db/migrations/002_mini_mall.sql \
  -f server/db/migrations/003_expenses.sql
```

If you do this, also record them so the runner doesn't repeat the work later:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (name) VALUES
  ('001_baseline.sql'), ('002_mini_mall.sql'), ('003_expenses.sql')
ON CONFLICT DO NOTHING;
```

---

## Getting data in

All of it is typed in through the app — there is no fake seed data.

**Mini Mall** → *Add bay*: bay code, tier and position, product (pick an existing one or
create it inline with a colour and category), Mini Mall price, what's on display, and
what's in back stock. The form stays open and advances the bay number, so entering the
whole shelf is one pass. After that, day-to-day input is the restock sheet
(restock / prints in / take off) and the close-month count.

**Expenses** → *Add*: date, category, supplier, description, amount, optional receipt
reference, channel, and whether it's a one-off asset. Tick *Repeats monthly* to create a
template instead — the MM12 shelf fee is the obvious one.

One optional helper exists for the initial shelf load:

```bash
cd server && npm run import:catalogue
```

It creates the 50 MM12 bays with the real bay codes, product names and prices, all at
**zero quantities**, so you only have to walk the shelf and type the counts. It skips
any bay that already exists, so it's safe to re-run.
