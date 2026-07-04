import { describe, it, expect } from 'vitest';
import { PLAYERS, PLAYERS_BY_RARITY, PLAYER_BY_ID, RARITIES, overallOf, rarityOf } from './players.js';

describe('player card database', () => {
  it('has unique ids', () => {
    expect(new Set(PLAYERS.map((p) => p.id)).size).toBe(PLAYERS.length);
  });

  it('keeps every stat in the 1–99 range', () => {
    for (const p of PLAYERS) {
      for (const v of Object.values(p.stats)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });

  it('computes overall and rarity consistently', () => {
    for (const p of PLAYERS) {
      expect(p.overall).toBe(overallOf(p));
      expect(p.rarity).toBe(rarityOf(p.overall));
    }
  });

  it('rates the WC22 Golden Ball and Golden Boot winners as legends', () => {
    expect(PLAYER_BY_ID.get('messi').rarity).toBe('LEGEND');
    expect(PLAYER_BY_ID.get('mbappe').rarity).toBe('LEGEND');
  });

  it('has cards in every rarity tier', () => {
    for (const rarity of RARITIES) {
      expect(PLAYERS_BY_RARITY[rarity].length).toBeGreaterThan(0);
    }
  });

  it('records real WC stat lines (apps ≥ 1, non-negative goals/assists)', () => {
    for (const p of PLAYERS) {
      expect(p.wc.apps).toBeGreaterThanOrEqual(1);
      expect(p.wc.goals).toBeGreaterThanOrEqual(0);
      expect(p.wc.assists).toBeGreaterThanOrEqual(0);
    }
  });

  it('can field a full squad from the low tiers and from the high tiers', () => {
    // Pack luck must never make squads impossible: both the amateur pool
    // (COMMON+RARE) and the world pool (ELITE+LEGEND+RARE) need all positions.
    for (const rarities of [['COMMON', 'RARE'], ['ELITE', 'LEGEND', 'RARE']]) {
      const pool = PLAYERS.filter((p) => rarities.includes(p.rarity));
      for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
        expect(pool.some((p) => p.pos === pos)).toBe(true);
      }
    }
  });
});
