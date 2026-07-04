import { describe, it, expect } from 'vitest';
import { openPack, hashSeed, createRng, randomSeed, PACK_SIZE } from './packs.js';
import { RARITIES } from './players.js';

const rarityRank = (r) => RARITIES.indexOf(r);

describe('pack engine', () => {
  it('always yields a full pack of valid cards', () => {
    for (let i = 0; i < 50; i++) {
      const cards = openPack(`seed-${i}`);
      expect(cards).toHaveLength(PACK_SIZE);
      for (const c of cards) expect(c.id).toBeTruthy();
    }
  });

  it('is deterministic: same seed, same cards', () => {
    const a = openPack('golazo-devnet-seed').map((c) => c.id);
    const b = openPack('golazo-devnet-seed').map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('accepts byte-array seeds (the on-chain format)', () => {
    const seed = Uint8Array.from({ length: 32 }, (_, i) => i * 7);
    expect(openPack(seed).map((c) => c.id)).toEqual(openPack(seed).map((c) => c.id));
  });

  it('guarantees the final slot is RARE or better', () => {
    for (let i = 0; i < 300; i++) {
      const cards = openPack(`hit-slot-${i}`);
      expect(rarityRank(cards[PACK_SIZE - 1].rarity)).toBeGreaterThanOrEqual(rarityRank('RARE'));
    }
  });

  it('pulls commons more often than legends over many packs', () => {
    const counts = { COMMON: 0, RARE: 0, ELITE: 0, LEGEND: 0 };
    for (let i = 0; i < 500; i++) {
      for (const c of openPack(`dist-${i}`)) counts[c.rarity]++;
    }
    expect(counts.COMMON).toBeGreaterThan(counts.LEGEND);
    expect(counts.RARE).toBeGreaterThan(counts.LEGEND);
    expect(counts.LEGEND).toBeGreaterThan(0); // legends must actually be pullable
  });

  it('hashSeed and createRng are stable across calls', () => {
    expect(hashSeed('golazo')).toBe(hashSeed('golazo'));
    const r1 = createRng('x');
    const r2 = createRng('x');
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it('randomSeed returns 64 hex chars', () => {
    expect(randomSeed()).toMatch(/^[0-9a-f]{64}$/);
  });
});
