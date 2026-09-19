import 'dotenv/config';
import { pool } from './index';

// One-shot helper for the initial MM12 shelf layout.
//
// Creates the 50 bays with the real bay codes, product names and prices, all
// at ZERO quantities — the counts get typed in from the app after walking the
// shelf. Nothing here is invented: no stock numbers, no sales, no expenses.
//
// Safe to re-run: bays that already exist are skipped, so it never overwrites
// a count you've entered.
//
// Shelf layout assumption: 10 bays per tier, tier 1 = top (MM12.14 → tier 2,
// position 4). Both are editable per bay in the app if the real unit differs.

const SLOTS_PER_TIER = 10;

// [bay, name, price, category, notes, notForSale?]
const CATALOGUE: [number, string, number, string, string, boolean?][] = [
  [1, 'Cat', 3, 'Articulated', 'Articulated cat'],
  [2, 'Celestial Dragon', 15, 'Articulated', 'Premium large dragon'],
  [3, 'Dog', 6, 'Articulated', 'Articulated dog'],
  [4, 'Medium Dragon', 8, 'Articulated', 'Mid-size dragon'],
  [5, 'Mini T-Rex', 7, 'Articulated', 'Small articulated T-Rex'],
  [6, 'Mini Winged Dragon', 3, 'Articulated', 'Small dragon with wings'],
  [7, 'Octa Ring', 12, 'Fidgets', 'Octagon-link articulated ring'],
  [8, 'Octopus', 5, 'Articulated', 'Articulated octopus'],
  [9, 'Penguin', 3, 'Articulated', 'Articulated penguin'],
  [10, 'Red Panda', 3, 'Articulated', 'Articulated red panda'],
  [11, 'Winged Dragon', 10, 'Articulated', 'Dragon with wings'],
  [12, 'Clicker', 4, 'Fidgets', 'Fidget clicker toy'],
  [13, 'XL Spiral Cones', 12, 'Fidgets', 'Large spinning fidget'],
  [14, 'Hexagon Fidget', 5, 'Fidgets', 'Hexagon-shaped fidget toy'],
  [15, 'Large Spiral Cone', 8, 'Fidgets', 'Mid-size spinning fidget'],
  [16, 'Mushroom Fidget', 5, 'Fidgets', 'Mushroom-shaped fidget toy'],
  [17, 'Spiral Cone', 4, 'Fidgets', 'Standard spinning fidget'],
  [18, 'Lamp Shade', 12, 'Home & Decor', 'Decorative 3D print lampshade'],
  [19, 'Koi Fish Pen Holder', 12, 'Home & Decor', 'Pen holder, koi fish shape'],
  [20, 'Gothic Corset Make-Up Holder', 7, 'Home & Decor', 'Make-up holder, gothic corset design'],
  [21, 'Mermaid Tail Jewellery Tray', 13, 'Home & Decor', 'Trinket tray, mermaid tail shape'],
  [22, 'Butterfly Trinket Tray', 7, 'Home & Decor', 'Trinket tray, butterfly shape'],
  [23, 'Haku', 13, 'Home & Decor', 'Idol figure — NOT FOR SALE', true],
  [24, 'Mini Dragon', 3, 'Keyrings', 'Dragon-shaped keyring'],
  [25, 'Hexagon Keychain', 3, 'Keyrings', 'Hexagon-shaped keyring'],
  [26, 'Small Dragon Keychain', 2, 'Keyrings', 'Small dragon-shaped keyring'],
  [27, 'Dragon Egg', 8, 'Home & Decor', 'Large decorative egg'],
  [28, 'Giant Dragon Egg', 20, 'Home & Decor', 'Extra-large decorative egg'],
  [29, 'Lamp', 25, 'Home & Decor', 'Decorative 3D print lamp, includes stand and bulb'],
  [30, 'Earrings Sun Mandala', 5, 'Jewellery', 'Sun mandala design earrings'],
  [31, 'Cat Earrings', 4, 'Jewellery', 'Cat-shaped earrings'],
  [32, 'Bunny Tealight', 3, 'Home & Decor', 'Bunny-shaped tealight'],
  [33, 'Voronoi Elephant Tealight (Large)', 6, 'Home & Decor', 'Larger elephant tealight'],
  [34, 'Voronoi Cat', 5, 'Home & Decor', 'Voronoi-pattern cat figure'],
  [35, 'Voronoi Elephant', 4, 'Home & Decor', 'Voronoi-pattern elephant figure'],
  [36, 'Voronoi Small Cat', 3, 'Home & Decor', 'Small voronoi-pattern cat'],
  [37, 'Lion of Africa Art', 6, 'Wall Art', 'African-themed lion art'],
  [38, 'Mother Africa Art', 5, 'Wall Art', 'African-themed wall art'],
  [39, 'Wildlife Wall Art', 5, 'Wall Art', 'Wildlife-themed wall art'],
  [40, 'Waves Necklace', 4, 'Jewellery', 'Japanese waves necklace'],
  [41, 'Spikey Dragon', 12, 'Articulated', 'Our spikiest dragon yet, similar size to a celestial dragon'],
  [42, 'Gold Pup', 4, 'Keyrings', 'Golden puppy keychain'],
  [43, 'Giant Hexagon Fidget', 12, 'Fidgets', '20cm version of the hexagon fidget'],
  [44, 'Lion Statue', 12, 'Home & Decor', 'Lion statue'],
  [45, 'Crab', 3, 'Articulated', 'Tiny crab'],
  [46, 'Pikachu Clicker', 3, 'Fidgets', 'Pikachu clicker'],
  [47, 'Paw Clicker', 3, 'Fidgets', 'Clicker with paw print'],
  [48, 'XXL Snake', 25, 'Articulated', 'Largest articulated item we have'],
  [49, 'Large Snake', 10, 'Articulated', 'Large articulated snake'],
  [50, 'Medium Snake', 8, 'Articulated', 'Medium articulated snake'],
];

async function importCatalogue(): Promise<void> {
  const client = await pool.connect();
  let created = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');

    for (const [bay, name, price, category, , notForSale] of CATALOGUE) {
      const exists = await client.query('SELECT 1 FROM mm_slots WHERE bay_number = $1', [bay]);
      if (exists.rowCount) {
        skipped++;
        continue;
      }

      // Reuse a product of the same name if the POS catalogue already has one.
      const existing = await client.query(
        'SELECT id FROM products WHERE LOWER(name) = LOWER($1) LIMIT 1',
        [name]
      );
      const productId =
        existing.rows[0]?.id ??
        (
          await client.query(
            `INSERT INTO products (name, default_price, category) VALUES ($1, $2, $3) RETURNING id`,
            [name, price, category]
          )
        ).rows[0].id;

      await client.query(
        `INSERT INTO mm_slots (bay_number, tier, position, product_id, display_qty, price, not_for_sale)
         VALUES ($1, $2, $3, $4, 0, $5, $6)`,
        [
          bay,
          Math.min(5, Math.ceil(bay / SLOTS_PER_TIER)),
          ((bay - 1) % SLOTS_PER_TIER) + 1,
          productId,
          price,
          !!notForSale,
        ]
      );
      created++;
    }

    await client.query('COMMIT');
    console.log(
      `MM12 catalogue imported: ${created} bays created, ${skipped} already existed.\n` +
        'All quantities are zero — enter the real counts from the Mini Mall tab.'
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Catalogue import failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

importCatalogue();
