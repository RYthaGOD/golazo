/**
 * Wallet-scoped localStorage. One mechanism owns key derivation, JSON
 * parsing, and shape validation, so per-wallet state (packs, squad, record)
 * cannot diverge between features and valid-but-wrong JSON in storage
 * degrades to the fallback instead of crashing the render.
 */

const storageKey = (ns, pubkey) => `golazo:${ns}:${pubkey}`;

export function readWalletJson(ns, pubkey, fallback, isValid) {
  if (!pubkey) return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(ns, pubkey)) ?? 'null');
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeWalletJson(ns, pubkey, value) {
  if (!pubkey) return;
  try {
    localStorage.setItem(storageKey(ns, pubkey), JSON.stringify(value));
  } catch {
    // Storage full or blocked — losing persistence is preferable to crashing.
  }
}

export const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

export const isWinLossRecord = (v) =>
  Boolean(v) && typeof v === 'object' && Number.isInteger(v.w) && Number.isInteger(v.l);
