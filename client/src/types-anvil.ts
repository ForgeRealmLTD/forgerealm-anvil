// Types for the Mini Mall and Expenses areas. Kept separate from types.ts so
// the POS type surface is untouched.

export type MmFlag = 'restock' | 'print' | null;

export interface MmSlot {
  id: string;
  bay_number: number;
  bay_code: string;
  tier: number;
  position: number;
  product_id: string | null;
  product_name: string | null;
  colour: string | null;
  category: string | null;
  display_qty: number;
  price: number | null;
  not_for_sale: boolean;
}

export interface MmProductRow {
  product_id: string;
  name: string;
  colour: string | null;
  category: string | null;
  slot_id: string;
  bay_number: number;
  bay_code: string;
  tier: number;
  position: number;
  not_for_sale: boolean;
  price: number | null;
  display_qty: number;
  back_qty: number;
  total_qty: number;
  opening_display: number | null;
  restocked: number;
  closing_display: number;
  units_sold: number | null;
  revenue: number;
  sell_through: number | null;
  flag: MmFlag;
}

// A line in storage at the back of the store: stock that isn't on the shelf
// but that staff can put out. `shelved` is false when the product has no bay
// yet, which is the one case that blocks a restock.
export interface MmBackRoomRow {
  product_id: string;
  name: string;
  colour: string | null;
  category: string | null;
  back_qty: number;
  display_qty: number;
  total_qty: number;
  slot_id: string | null;
  bay_number: number | null;
  bay_code: string | null;
  shelved: boolean;
  needs_restock: boolean;
  updated_at: string;
}

// Seed values for a bay being created from a product that already has back
// stock but no shelf position yet.
export interface MmSlotPreset {
  product_id: string;
  name: string;
  colour: string | null;
  category: string | null;
  back_qty: number;
}

export interface MmMonth {
  id: string;
  month: string;
  status: 'open' | 'closed';
  notes: string | null;
  closed_at: string | null;
}

export interface MmOverview {
  month: string;
  month_record: MmMonth | null;
  slots: MmSlot[];
  products: MmProductRow[];
  back_stock: { product_id: string; quantity: number }[];
  back_room: MmBackRoomRow[];
  stock: {
    on_display: number;
    in_back: number;
    total: number;
    unshelved_lines: number;
  };
  rollup: {
    units_sold: number;
    gross_revenue: number;
    shelf_fee: number;
    net: number;
    paid_for_itself: boolean | null;
  };
}

export interface MmMovement {
  id: string;
  product_id: string;
  product_name?: string;
  type: 'print_in' | 'to_display' | 'off_display' | 'adjust_display' | 'adjust_back';
  quantity: number;
  occurred_at: string;
  note: string | null;
}

export type ExpenseChannel = 'mini_mall' | 'kirkgate' | 'artsmix' | 'general';
export type ExpenseKind = 'one_off' | 'asset' | 'recurring_instance';

export interface ExpenseCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface Expense {
  id: string;
  date: string;
  category_id: string;
  category_name?: string;
  vendor: string | null;
  description: string;
  amount: number | string;
  receipt_ref: string | null;
  kind: ExpenseKind;
  channel: ExpenseChannel;
  recurring_template_id: string | null;
}

export interface RecurringExpense {
  id: string;
  category_id: string;
  category_name?: string;
  vendor: string | null;
  description: string;
  amount: number | string;
  day_of_month: number;
  channel: ExpenseChannel;
  active: boolean;
  starts_on: string;
}

export interface ExpensesSummary {
  month: string;
  categories: { id: string; name: string; this_month: number; last_month: number }[];
  totals: {
    this_month: number;
    last_month: number;
    delta: number;
    delta_pct: number | null;
  };
  trend: { month: string; total: number }[];
}
