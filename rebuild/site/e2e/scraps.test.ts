// Offcut matching rules. Run: npx tsx e2e/scraps.test.ts
import assert from 'node:assert/strict';
import { fits, matchScraps, type Scrap } from '../src/lib/scraps';

const mk = (o: Partial<Scrap>): Scrap => ({ id: 'x', category: 'sheet', material: 'MDF مكسي (ميلامين)', brand: 'جودوود', code: '1021', color: '', thick: 18, len: 100, wid: 40, qty: 1, cond: 'new', edge: false, grain: false, price_mode: 'ask', price: null, area: '', note: '', imgs: [], created_at: '2026-10-01T00:00:00Z', ...o });
const q = { category: 'sheet' as const, thick: 18, len: 70, wid: 25 };

assert.equal(fits(mk({}), q), 100 * 40 - 70 * 25, 'fits directly');
assert.equal(fits(mk({ len: 30, wid: 80 }), q), 30 * 80 - 70 * 25, 'fits when turned 90°');
assert.equal(fits(mk({ len: 30, wid: 80, grain: true }), q), null, 'no turning when the board has a grain');
assert.equal(fits(mk({ len: 30, wid: 80 }), { ...q, rotate: false }), null, 'no turning when the customer forbids it');
assert.equal(fits(mk({ len: 60, wid: 40 }), q), null, 'too short');

const list = [
  mk({ id: 'a' }),                                           // same code, fits
  mk({ id: 'b', code: '2002', len: 90, wid: 30 }),           // other colour, fits
  mk({ id: 'c', len: 67, wid: 30 }),                         // same code, 3 cm short
  mk({ id: 'd', thick: 16 }),                                // wrong thickness
  mk({ id: 'e', material: 'HDF', code: '1021' }),            // other material
  mk({ id: 'f', category: 'solid', material: 'زان', code: '', thick: 18 }),
];
const hits = matchScraps(list, { ...q, code: '1021', material: 'MDF مكسي (ميلامين)' });
assert.deepEqual(hits.map(h => [h.s.id, h.level]), [['a', 1], ['c', 2], ['b', 3]]);
assert.equal(matchScraps(list, { ...q, code: '١٠٢١ ' }).filter(h => h.level === 1).some(h => h.s.id === 'a'), true, 'code ignores spaces and Arabic digits');
assert.equal(matchScraps(list, { ...q }).every(h => h.s.thick === 18), true, 'thickness must match');

const alu = [mk({ id: 'p', category: 'alu', material: 'قطاع دلف', thick: null, wid: null, len: 300, code: '' }), mk({ id: 'q', category: 'alu', material: 'زاوية', thick: null, wid: null, len: 300, code: '' })];
assert.deepEqual(matchScraps(alu, { category: 'alu', len: 250, material: 'قطاع دلف' }).map(h => h.s.id), ['p']);
assert.equal(matchScraps(alu, { category: 'alu', len: 350 }).length, 0);
console.log('scraps: all good');
