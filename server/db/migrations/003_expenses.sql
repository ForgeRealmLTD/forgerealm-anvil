-- 003_expenses: every pound the business spends, by month.

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO expense_categories (name, sort_order) VALUES
  ('Filament & materials', 1),
  ('Stall & pitch fees', 2),
  ('Mini Mall shelf fee', 3),
  ('Equipment & assets', 4),
  ('Packaging & consumables', 5),
  ('Software, hosting & domains', 6),
  ('Compliance & certification', 7),
  ('Other', 8)
ON CONFLICT (name) DO NOTHING;

-- Templates for costs that repeat every month (e.g. the MM12 shelf fee).
-- Instances are materialised into `expenses` when a month is first viewed,
-- so no scheduler is needed.
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  vendor VARCHAR(255),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  day_of_month INTEGER NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  channel VARCHAR(20) NOT NULL DEFAULT 'general'
    CHECK (channel IN ('mini_mall', 'kirkgate', 'artsmix', 'general')),
  active BOOLEAN NOT NULL DEFAULT true,
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  vendor VARCHAR(255),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  receipt_ref VARCHAR(255),
  -- one_off: ordinary spend | asset: one-off equipment/asset purchase
  -- recurring_instance: materialised from a recurring_expenses template
  kind VARCHAR(20) NOT NULL DEFAULT 'one_off'
    CHECK (kind IN ('one_off', 'asset', 'recurring_instance')),
  -- Channel tag so Mini Mall can pull its shelf fee and profitability can
  -- eventually be split per channel.
  channel VARCHAR(20) NOT NULL DEFAULT 'general'
    CHECK (channel IN ('mini_mall', 'kirkgate', 'artsmix', 'general')),
  recurring_template_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_channel ON expenses(channel);

-- One instance per template per month — makes materialisation idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_recurring_month
  ON expenses (recurring_template_id, date_trunc('month', date::timestamp))
  WHERE recurring_template_id IS NOT NULL;
