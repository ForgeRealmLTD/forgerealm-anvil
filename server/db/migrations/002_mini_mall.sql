-- 002_mini_mall: bay MM12 at the Merrion Centre.
--
-- The Mini Mall has no till feed: sales are derived from stock counts.
-- Model: a monthly cycle (mm_months) brackets opening and closing counts
-- (mm_counts); restocks and print runs during the month are recorded as
-- movements (mm_movements). Units sold for a month =
--   opening display + moved-to-display during the month − closing display.
--
-- Mini Mall stock is deliberately independent of global_stock (the central
-- pool the POS stalls draw from) — the two never interact.

-- Retail-friendly colour name shown on Mini Mall views ("Marigold Yellow").
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN colour VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- The physical shelf: five tiers, positions within a tier. bay_number is the
-- printed label ("MM12.14" = bay_number 14). Tier/position drive the shelf
-- heatmap; both are editable so the model can be corrected to match the real
-- merchandising layout at any time.
CREATE TABLE IF NOT EXISTS mm_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bay_number INTEGER UNIQUE NOT NULL CHECK (bay_number > 0),
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
  position INTEGER NOT NULL CHECK (position > 0),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  display_qty INTEGER NOT NULL DEFAULT 0 CHECK (display_qty >= 0),
  price DECIMAL(10, 2) CHECK (price >= 0),
  not_for_sale BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tier, position)
);
CREATE INDEX IF NOT EXISTS idx_mm_slots_product ON mm_slots(product_id);

-- Storage at the back of the store, ready to replenish the display.
CREATE TABLE IF NOT EXISTS mm_back_stock (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per monthly reconciliation cycle. month is always the 1st.
CREATE TABLE IF NOT EXISTS mm_months (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month DATE UNIQUE NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Every stock movement, dated — these make the sold-units maths work.
--   print_in       new prints arriving into back stock            (qty > 0)
--   to_display     back stock → shelf                             (qty > 0)
--   off_display    shelf → back stock                             (qty > 0)
--   adjust_display correction to display qty (signed)
--   adjust_back    correction to back stock (signed)
CREATE TABLE IF NOT EXISTS mm_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (
    type IN ('print_in', 'to_display', 'off_display', 'adjust_display', 'adjust_back')
  ),
  quantity INTEGER NOT NULL CHECK (quantity <> 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mm_movements_product ON mm_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_mm_movements_occurred ON mm_movements(occurred_at);

-- Opening/closing stock counts per product per month.
CREATE TABLE IF NOT EXISTS mm_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month_id UUID NOT NULL REFERENCES mm_months(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('opening', 'closing')),
  display_qty INTEGER NOT NULL CHECK (display_qty >= 0),
  back_qty INTEGER CHECK (back_qty >= 0),
  counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (month_id, product_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_mm_counts_month ON mm_counts(month_id);
