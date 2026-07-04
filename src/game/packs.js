import { PLAYERS_BY_RARITY } from './players.js';

/**
 * Pack engine. A pack is fully determined by its seed: the on-chain program
 * commits a seed when a pack is bought, and any client re-derives the same
 * five cards from it. Free-play mode uses locally generated random seeds.
 *
 * ⚠ The card DATABASE is part of the derivation function. Pool sizes and
 * order in players.js feed `pickFrom`, so editing, reordering, or re-rating
 * players re-derives every historical pack to different cards. Treat
 * players.js as frozen per "edition"; a new edition needs a new program
 * deployment (or an edition tag in the Pack account) — never an in-place edit.
 *
 * Note: seeds are folded to 32 bits (hashSeed) before keying the PRNG, so
 * there are 2^32 distinct pack outcomes — plenty for gameplay, but two
 * different on-chain seeds can collide into identical (not exploitable,
 * just duplicate) packs. Kept as-is because changing the fold would itself
 * re-derive all existing packs.
 */

export const PACK_SIZE = 5;

/** Per-slot rarity odds (percent). Slots 1–4. */
export const SLOT_ODDS = [
  ['COMMON', 50],
  ['RARE', 32],
  ['ELITE', 14],
  ['LEGEND', 4],
];

/** The last slot is the "hit" slot: guaranteed RARE or better. */
export const FINAL_SLOT_ODDS = [
  ['RARE', 62],
  ['ELITE', 28],
  ['LEGEND', 10],
];

/** FNV-1a hash of a seed (hex string, byte array, or plain string) → uint32. */
export function hashSeed(seed) {
  const bytes =
    typeof seed === 'string'
      ? new TextEncoder().encode(seed)
      : seed instanceof Uint8Array
        ? seed
        : Uint8Array.from(seed);
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic PRNG over a uint32 state. */
export function createRng(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollRarity(rng, odds) {
  const roll = rng() * 100;
  let acc = 0;
  for (const [rarity, weight] of odds) {
    acc += weight;
    if (roll < acc) return rarity;
  }
  return odds[odds.length - 1][0];
}

function pickFrom(rng, pool) {
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Derive the 5 cards of a pack from its seed. Deterministic: the same seed
 * always yields the same cards. Duplicates within a pack are re-rolled a few
 * times, then allowed (small pools can legitimately repeat).
 */
export function openPack(seed) {
  const rng = createRng(seed);
  const cards = [];
  for (let slot = 0; slot < PACK_SIZE; slot++) {
    const odds = slot === PACK_SIZE - 1 ? FINAL_SLOT_ODDS : SLOT_ODDS;
    const rarity = rollRarity(rng, odds);
    const pool = PLAYERS_BY_RARITY[rarity];
    let card = pickFrom(rng, pool);
    for (let retry = 0; retry < 4 && cards.some((c) => c.id === card.id); retry++) {
      card = pickFrom(rng, pool);
    }
    cards.push(card);
  }
  return cards;
}

/** A random 32-byte seed as a hex string (free-play packs). */
export function randomSeed() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
