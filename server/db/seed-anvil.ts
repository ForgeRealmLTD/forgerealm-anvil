import 'dotenv/config';
import { pool } from './index';

// Seeds the Mini Mall (bay MM12) and Expenses areas with realistic sample
// data so the shelf heatmap and expense charts can be judged properly.
//
// The MM12 bay codes, product names and prices are the real catalogue; the
// QUANTITIES AND SOLD NUMBERS ARE INVENTED, as are all expense amounts.
//
// Refuses to run against a remote database unless ALLOW_REMOTE_SEED=1, so it
// can't accidentally pollute production with fake numbers.

const dbUrl = process.env.DATABASE_URL || '';
const isRemote = /neon\.tech|render\.com|amazonaws|sslmode=require/.test(dbUrl);
if (isRemote && process.env.ALLOW_REMOTE_SEED !== '1') {
  console.error(
    'DATABASE_URL looks like a remote/production database.\n' +
      'This seed inserts FAKE sales and expense data. If you really want it\n' +
      'there, re-run with ALLOW_REMOTE_SEED=1.'
  );
  process.exit(1);
}

// The real MM12 catalogue: [bay, name, price, category, notForSale?]
const CATALOGUE: [number, string, number, string, boolean?][] = [
  [1, 'Cat', 3, 'Articulated'],
  [2, 'Celestial Dragon', 15, 'Articulated'],
  [3, 'Dog', 6, 'Articulated'],
  [4, 'Medium Dragon', 8, 'Articulated'],
  [5, 'Mini T-Rex', 7, 'Articulated'],
  [6, 'Mini Winged Dragon', 3, 'Articulated'],
  [7, 'Octa Ring', 12, 'Fidgets'],
  [8, 'Octopus', 5, 'Articulated'],
  [9, 'Penguin', 3, 'Articulated'],
  [10, 'Red Panda', 3, 'Articulated'],
  [11, 'Winged Dragon', 10, 'Articulated'],
  [12, 'Clicker', 4, 'Fidgets'],
  [13, 'XL Spiral Cones', 12, 'Fidgets'],
  [14, 'Hexagon Fidget', 5, 'Fidgets'],
  [15, 'Large Spiral Cone', 8, 'Fidgets'],
  [16, 'Mushroom Fidget', 5, 'Fidgets'],
  [17, 'Spiral Cone', 4, 'Fidgets'],
  [18, 'Lamp Shade', 12, 'Home & Decor'],
  [19, 'Koi Fish Pen Holder', 12, 'Home & Decor'],
  [20, 'Gothic Corset Make-Up Holder', 7, 'Home & Decor'],
  [21, 'Mermaid Tail Jewellery Tray', 13, 'Home & Decor'],
  [22, 'Butterfly Trinket Tray', 7, 'Home & Decor'],
  [23, 'Haku', 13, 'Home & Decor', true],
  [24, 'Mini Dragon', 3, 'Keyrings'],
  [25, 'Hexagon Keychain', 3, 'Keyrings'],
  [26, 'Small Dragon Keychain', 2, 'Keyrings'],
  [27, 'Dragon Egg', 8, 'Home & Decor'],
  [28, 'Giant Dragon Egg', 20, 'Home & Decor'],
  [29, 'Lamp', 25, 'Home & Decor'],
  [30, 'Earrings Sun Mandala', 5, 'Jewellery'],
  [31, 'Cat Earrings', 4, 'Jewellery'],
  [32, 'Bunny Tealight', 3, 'Home & Decor'],
  [33, 'Voronoi Elephant Tealight (Large)', 6, 'Home & Decor'],
  [34, 'Voronoi Cat', 5, 'Home & Decor'],
  [35, 'Voronoi Elephant', 4, 'Home & Decor'],
  [36, 'Voronoi Small Cat', 3, 'Home & Decor'],
  [37, 'Lion of Africa Art', 6, 'Wall Art'],
  [38, 'Mother Africa Art', 5, 'Wall Art'],
  [39, 'Wildlife Wall Art', 5, 'Wall Art'],
  [40, 'Waves Necklace', 4, 'Jewellery'],
  [41, 'Spikey Dragon', 12, 'Articulated'],
  [42, 'Gold Pup', 4, 'Keyrings'],
  [43, 'Giant Hexagon Fidget', 12, 'Fidgets'],
  [44, 'Lion Statue', 12, 'Home & Decor'],
  [45, 'Crab', 3, 'Articulated'],
  [46, 'Pikachu Clicker', 3, 'Fidgets'],
  [47, 'Paw Clicker', 3, 'Fidgets'],
  [48, 'XXL Snake', 25, 'Articulated'],
  [49, 'Large Snake', 10, 'Articulated'],
  [50, 'Medium Snake', 8, 'Articulated'],
];

const COLOURS = [
  'Marigold Yellow', 'Midnight Navy', 'Dragonfire Red', 'Forest Emerald',
  'Silk Pearl', 'Amethyst Purple', 'Ocean Teal', 'Rose Quartz',
  'Copper Bronze', 'Glacier Blue', 'Obsidian Black', 'Sunset Coral',
];

// Deterministic PRNG so re-running the seed produces the same picture.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monthStart(offset: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 8) + '01';
}

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const prevMonth = monthStart(-1);
    const curMonth = monthStart(0);

    // Wipe only anvil sample tables (never POS data), so re-seeding is clean.
    await client.query('DELETE FROM mm_counts');
    await client.query('DELETE FROM mm_movements');
    await client.query('DELETE FROM mm_months');
    await client.query('DELETE FROM mm_back_stock');
    await client.query('DELETE FROM mm_slots');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM recurring_expenses');

    // ── Products + slots + stock ─────────────────────────────────────────
    const prevMonthId = (
      await client.query(
        `INSERT INTO mm_months (month, status, closed_at) VALUES ($1, 'closed', $1::date + INTERVAL '1 month') RETURNING id`,
        [prevMonth]
      )
    ).rows[0].id;
    const curMonthId = (
      await client.query(`INSERT INTO mm_months (month, status) VALUES ($1, 'open') RETURNING id`, [curMonth])
    ).rows[0].id;

    for (const [bay, name, price, category, notForSale] of CATALOGUE) {
      const rand = mulberry32(bay * 7919);
      const tier = Math.ceil(bay / 10);
      const position = ((bay - 1) % 10) + 1;

      // Reuse an existing product with the same name, otherwise create one.
      let productId: string;
      const existing = await client.query('SELECT id FROM products WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
      if (existing.rows.length > 0) {
        productId = existing.rows[0].id;
        await client.query(
          `UPDATE products SET colour = COALESCE(colour, $2) WHERE id = $1`,
          [productId, COLOURS[bay % COLOURS.length]]
        );
      } else {
        productId = (
          await client.query(
            `INSERT INTO products (name, default_price, category, colour) VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, price, category, COLOURS[bay % COLOURS.length]]
          )
        ).rows[0].id;
      }

      // Invented monthly cycle. Eye-level tiers (2 and 3) sell better and
      // cheap items shift more units — so the heatmap has a story to tell.
      const tierBoost = tier === 2 || tier === 3 ? 1.6 : tier === 1 ? 1.0 : 0.6;
      const priceDrag = price <= 4 ? 1.5 : price <= 8 ? 1.0 : 0.55;

      const prevOpening = 2 + Math.floor(rand() * 9);
      const prevRestock = Math.floor(rand() * 4);
      const maxPrevSold = prevOpening + prevRestock;
      const prevSold = notForSale
        ? 0
        : Math.min(maxPrevSold, Math.floor(rand() * maxPrevSold * 0.55 * tierBoost * priceDrag));
      const prevClosing = maxPrevSold - prevSold;

      const curOpening = prevClosing;
      const curRestock = rand() > 0.55 ? 1 + Math.floor(rand() * 3) : 0;
      const maxCurSold = curOpening + curRestock;
      const curSold = notForSale
        ? 0
        : Math.min(maxCurSold, Math.floor(rand() * maxCurSold * 0.4 * tierBoost * priceDrag));
      const displayNow = maxCurSold - curSold;
      // Some products deliberately have zero back stock so "needs printing"
      // flags show up alongside "needs restocking".
      const backNow = rand() > 0.3 ? Math.floor(rand() * 11) : 0;

      await client.query(
        `INSERT INTO mm_slots (bay_number, tier, position, product_id, display_qty, price, not_for_sale)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [bay, tier, position, productId, displayNow, price, !!notForSale]
      );
      if (backNow > 0) {
        await client.query(
          `INSERT INTO mm_back_stock (product_id, quantity) VALUES ($1, $2)
           ON CONFLICT (product_id) DO UPDATE SET quantity = $2`,
          [productId, backNow]
        );
      }

      // Counts for both cycles.
      await client.query(
        `INSERT INTO mm_counts (month_id, product_id, kind, display_qty, back_qty) VALUES
           ($1, $3, 'opening', $4, $5),
           ($1, $3, 'closing', $6, $7),
           ($2, $3, 'opening', $6, $7)`,
        [prevMonthId, curMonthId, productId, prevOpening, backNow + prevRestock + curRestock, prevClosing, backNow + curRestock]
      );

      // Movements that explain the numbers.
      if (prevRestock > 0) {
        await client.query(
          `INSERT INTO mm_movements (product_id, type, quantity, occurred_at, note)
           VALUES ($1, 'to_display', $2, $3::date + INTERVAL '14 days', 'Mid-month top-up')`,
          [productId, prevRestock, prevMonth]
        );
      }
      if (curRestock > 0) {
        await client.query(
          `INSERT INTO mm_movements (product_id, type, quantity, occurred_at, note)
           VALUES ($1, 'to_display', $2, $3::date + INTERVAL '4 days', 'Weekend restock')`,
          [productId, curRestock, curMonth]
        );
      }
      if (rand() > 0.7) {
        await client.query(
          `INSERT INTO mm_movements (product_id, type, quantity, occurred_at, note)
           VALUES ($1, 'print_in', $2, $3::date + INTERVAL '2 days', 'Fresh print run')`,
          [productId, 2 + Math.floor(rand() * 6), curMonth]
        );
      }
    }

    // ── Expenses ─────────────────────────────────────────────────────────
    const cat = async (name: string) =>
      (await client.query('SELECT id FROM expense_categories WHERE name = $1', [name])).rows[0].id;

    const catFilament = await cat('Filament & materials');
    const catStall = await cat('Stall & pitch fees');
    const catShelf = await cat('Mini Mall shelf fee');
    const catEquip = await cat('Equipment & assets');
    const catPack = await cat('Packaging & consumables');
    const catSoft = await cat('Software, hosting & domains');
    const catComp = await cat('Compliance & certification');

    // Recurring MM12 shelf fee, materialised into every seeded month below.
    const shelfTemplate = (
      await client.query(
        `INSERT INTO recurring_expenses (category_id, vendor, description, amount, day_of_month, channel, starts_on)
         VALUES ($1, 'Merrion Centre Mini Mall', 'MM12 shelf fee', 45.00, 1, 'mini_mall', $2::date)
         RETURNING id`,
        [catShelf, monthStart(-9)]
      )
    ).rows[0].id;

    for (let offset = -9; offset <= 0; offset++) {
      const m = monthStart(offset);
      const rand = mulberry32(1000 - offset);
      const ins = (
        catId: string, day: number, vendor: string, desc: string, amount: number,
        kind = 'one_off', channel = 'general', templateId: string | null = null
      ) =>
        client.query(
          `INSERT INTO expenses (date, category_id, vendor, description, amount, kind, channel, recurring_template_id)
           VALUES ($1::date + ($2 - 1) * INTERVAL '1 day', $3, $4, $5, $6, $7, $8, $9)`,
          [m, day, catId, vendor, desc, amount, kind, channel, templateId]
        );

      await ins(catShelf, 1, 'Merrion Centre Mini Mall', 'MM12 shelf fee', 45.0, 'recurring_instance', 'mini_mall', shelfTemplate);
      await ins(catFilament, 3 + Math.floor(rand() * 6), 'Elegoo', 'PLA 1kg spools ×3', +(35 + rand() * 20).toFixed(2));
      if (rand() > 0.4) {
        await ins(catFilament, 14 + Math.floor(rand() * 6), 'Elegoo', 'PLA Silk 1kg spools ×2', +(26 + rand() * 14).toFixed(2));
      }
      await ins(catStall, 6 + Math.floor(rand() * 4), 'Leeds Kirkgate Market', 'Casual stall pitch', 28.0, 'one_off', 'kirkgate');
      if (rand() > 0.35) {
        await ins(catStall, 19 + Math.floor(rand() * 4), 'Artsmix Leeds', 'Albion Place pitch', 35.0, 'one_off', 'artsmix');
      }
      await ins(catPack, 9 + Math.floor(rand() * 8), 'RAJA / eBay', 'Bags, tissue, labels', +(6 + rand() * 12).toFixed(2));
      await ins(catSoft, 22, 'Netlify / Namecheap', 'Hosting & domain', 9.99);

      if (offset === -5) {
        await ins(catEquip, 11, 'Elegoo', 'Neptune 4 Pro printer', 249.99, 'asset');
      }
      if (offset === -2) {
        await ins(catEquip, 8, 'IKEA', 'Display shelving for MM12', 62.5, 'asset', 'mini_mall');
      }
      if (offset === -3) {
        await ins(catComp, 16, 'UKCA Testing Ltd', 'Toy safety testing + technical file', 120.0);
      }
    }

    await client.query('COMMIT');
    console.log('Anvil sample data seeded: MM12 shelf, two monthly cycles, 10 months of expenses.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
