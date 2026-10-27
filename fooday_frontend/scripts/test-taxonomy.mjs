// Quick contract test for the two-level dish taxonomy.
// Run with: npm run test:taxonomy
//
// It checks the rules that are easy to break (a drink must not be stolen by
// "đồ khô", "bánh mì" must not become a drink, a shop name must never win over
// the dish name) and, when Supabase env vars are present, that the live
// catalog has no unclassified dish.

import assert from 'node:assert/strict';
import { groupOf, subGroupOf, DISH_GROUPS } from '../src/lib/taxonomy.ts';

const food = (name, restaurant = '', category = 'Foods') => ({
  name,
  restaurant,
  category,
  categories: null,
  dishes: null,
  tag: null,
});

const cases = [
  // [name, restaurant, category, expectedGroup, expectedSub]
  ['Trà sữa trân châu', 'Toco Toco', 'Foods', 'uong', 'traSua'],
  ['Trà đá', '', 'Foods', 'uong', 'traSua'],
  ['Cà phê sữa đá', 'Highlands', 'Foods', 'uong', 'caPhe'],
  ['Cà phê muối', '', 'Foods', 'uong', 'caPhe'],
  ['Bạc xỉu', '', 'Foods', 'uong', 'caPhe'],
  ['Sinh tố bơ', '', 'Foods', 'uong', 'sinhTo'],
  ['Nước ép cam', '', 'Foods', 'uong', 'sinhTo'],
  ['Trà sữa', '', 'Drinks', 'uong', 'traSua'],
  ['Bia Tiger', '', 'Foods', 'uong', 'biaRuou'],
  ['Cocktail mojito', '', 'Foods', 'uong', 'biaRuou'],

  // Drinks must never steal real dishes.
  ['Bánh mì chảo', '', 'Foods', 'kho', 'banh'],
  ['Bánh mì', 'Bánh mì Long Khánh', 'Foods', 'kho', 'banh'],
  ['Cơm', 'Cơm trà nhật Saku', 'Foods', 'kho', 'com'],
  ['Bún bò Huế', 'Phở Cường', 'Foods', 'nuoc', 'bunNuoc'],
  ['Phở gà', 'Phở Cường', 'Foods', 'nuoc', 'pho'],
  ['Mì', 'Mì Quảng 1', 'Foods', 'nuoc', 'miChao'],
  ['Hamburger', 'Burger Lab', 'Foods', 'kho', 'ngoai'],
  ['Tacos', 'Taetna', 'Foods', 'kho', 'ngoai'],
  ['Nướng', 'King BBQ', 'Foods', 'lau', 'nuong'],
  ['Buffet', 'Shogun (nướng)', 'Foods', 'buffet', 'buffetNuong'],
  ['Buffet', 'Haan Vegan (chay)', 'Foods', 'buffet', 'buffetChay'],

  // Snacks, both tagged and untagged.
  ['Xiên bẩn', '', 'Foods', 'anVat', 'xien'],
  ['Xiên bẩn', 'Xiên bẩn của cô', 'Snacks', 'anVat', 'xien'],
  ['Chè thái', '', 'Foods', 'anVat', 'che'],
  ['Bánh ngọt', '', 'Foods', 'anVat', 'banhNgot'],
  ['Kem tươi', '', 'Foods', 'anVat', 'kem'],
];

let failed = 0;
for (const [name, restaurant, category, expectedGroup, expectedSub] of cases) {
  const item = food(name, restaurant, category);
  const group = groupOf(item);
  const sub = group ? subGroupOf(item, group) : null;
  const ok = group === expectedGroup && sub === expectedSub;
  if (!ok) failed += 1;
  console.log(
    `${ok ? '  ok ' : ' FAIL'}  ${name.padEnd(22)} ${String(category).padEnd(7)} → ${String(group).padEnd(6)} ${String(sub).padEnd(11)} (want ${expectedGroup}/${expectedSub})`,
  );
}

// Every branch must declare a translation slot: ids are used as i18n keys.
const groupIds = new Set(DISH_GROUPS.map((group) => group.id));
assert.equal(groupIds.size, DISH_GROUPS.length, 'duplicate group id');
for (const group of DISH_GROUPS) {
  for (const sub of group.subs ?? []) {
    assert.ok(sub.words.length > 0, `sub ${sub.id} has no words`);
  }
}

// Live catalog (optional): no dish may fall through unclassified.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (url && key) {
  const res = await fetch(
    `${url}/rest/v1/foods?select=id,name,restaurant,category,dishes,tag`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const rows = await res.json();
  const counts = new Map();
  const unclassified = [];
  for (const row of rows) {
    const group = groupOf(row);
    if (!group) {
      unclassified.push(`${row.name} @ ${row.restaurant}`);
      continue;
    }
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  console.log(`\nlive catalog: ${rows.length} dishes →`, Object.fromEntries(counts));
  if (unclassified.length > 0) {
    failed += unclassified.length;
    console.log(' FAIL  unclassified:', unclassified);
  }
} else {
  console.log('\nlive catalog: skipped (no Supabase env)');
}

if (failed > 0) {
  console.error(`\n${failed} failing case(s)`);
  process.exit(1);
}
console.log('\nall taxonomy checks passed');
