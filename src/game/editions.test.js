import { describe, it, expect } from 'vitest';
import { EDITIONS, getEdition, DEFAULT_EDITION_ID } from './editions.js';
import { openPack, PACK_SIZE } from './packs.js';
import { RARITIES } from './players.js';
import { validateSquad } from './battle.js';

const rank = (r) => RARITIES.indexOf(r);

describe('editions', () => {
  it('exposes wc26 and wc22, defaulting to wc26', () => {
    expect(EDITIONS.map((e) => e.id)).toContain('wc26');
    expect(EDITIONS.map((e) => e.id)).toContain('wc22');
    expect(DEFAULT_EDITION_ID).toBe('wc26');
    expect(getEdition('nope').id).toBe(EDITIONS[0].id); // safe fallback
  });

  it('each edition can be fielded and packed (all rarity tiers, every position)', () => {
    for (const e of EDITIONS) {
      for (const r of RARITIES) expect(e.pools[r].length).toBeGreaterThan(0);
      for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
        expect(e.players.some((p) => p.pos === pos)).toBe(true);
      }
    }
  });

  it('derives WC26 cards from live data with the expected shape and legends', () => {
    const wc26 = getEdition('wc26');
    expect(wc26.players.length).toBeGreaterThan(400); // full squads across 24 nations
    for (const c of wc26.players) {
      expect(c.id.startsWith('wc26-')).toBe(true);
      expect(['GK', 'DEF', 'MID', 'FWD']).toContain(c.pos);
      expect(c.overall).toBeGreaterThanOrEqual(1);
      expect(c.overall).toBeLessThanOrEqual(99);
    }
    expect(wc26.players.some((c) => c.rarity === 'LEGEND')).toBe(true);
  });

  it('opens a deterministic WC26 pack whose final slot is RARE or better', () => {
    const wc26 = getEdition('wc26');
    const a = openPack('wc26-seed', wc26.pools).map((c) => c.id);
    const b = openPack('wc26-seed', wc26.pools).map((c) => c.id);
    expect(a).toEqual(b);
    for (let i = 0; i < 100; i++) {
      const cards = openPack(`wc26-${i}`, wc26.pools);
      expect(cards).toHaveLength(PACK_SIZE);
      expect(rank(cards[PACK_SIZE - 1].rarity)).toBeGreaterThanOrEqual(rank('RARE'));
      for (const c of cards) expect(c.id.startsWith('wc26-')).toBe(true);
    }
  });

  it('can assemble a legal 5-a-side from WC26 cards', () => {
    const wc26 = getEdition('wc26');
    const gk = wc26.players.find((p) => p.pos === 'GK');
    const def = wc26.players.find((p) => p.pos === 'DEF');
    const mid = wc26.players.find((p) => p.pos === 'MID');
    const fwd = wc26.players.filter((p) => p.pos === 'FWD').slice(0, 2);
    expect(validateSquad([gk, def, mid, ...fwd])).toEqual([]);
  });
});
