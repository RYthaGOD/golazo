import { PLAYERS as WC22_PLAYERS } from './players.js';
import { PLAYERS as WC26_PLAYERS } from './players2026.js';
import { buildPools } from './packs.js';
import { PACK_PROGRAM_ID_2022, PACK_PROGRAM_ID_2026 } from '../config.js';

/**
 * Card editions. Each is an independent game: its own card set, its own pack
 * derivation pools, its own on-chain program (so packs, collections, and
 * squads never cross editions), and its own localStorage namespace.
 *
 * WC26 cards are generated from the live TxODDS feed (see scripts/gen-wc26.mjs);
 * WC22 is the original hand-authored set.
 */
const RAW = [
  {
    id: 'wc26',
    label: 'World Cup 2026',
    short: 'WC26',
    tagline: 'Rated live from this tournament',
    players: WC26_PLAYERS,
    programId: PACK_PROGRAM_ID_2026,
  },
  {
    id: 'wc22',
    label: 'World Cup 2022',
    short: 'WC22',
    tagline: 'The 2022 classics',
    players: WC22_PLAYERS,
    programId: PACK_PROGRAM_ID_2022,
  },
];

export const EDITIONS = RAW.map((e) => ({
  ...e,
  pools: buildPools(e.players),
  hasProgram: e.programId.length > 0,
}));

export const DEFAULT_EDITION_ID = EDITIONS[0].id;

export const getEdition = (id) => EDITIONS.find((e) => e.id === id) ?? EDITIONS[0];

// Global card lookup across every edition — a wager stores card ids only, so
// replaying a match needs to resolve ids from whichever edition they belong to.
const CARD_BY_ID = new Map(EDITIONS.flatMap((e) => e.players.map((p) => [p.id, p])));
export const getCard = (id) => CARD_BY_ID.get(id);
export const resolveSquad = (ids) => ids.map(getCard).filter(Boolean);
