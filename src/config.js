import { clusterApiUrl } from '@solana/web3.js';

/**
 * Centralized, validated access to frontend configuration.
 * Only VITE_* vars exist in the browser bundle — never secrets.
 */

const VALID_CLUSTERS = ['devnet', 'testnet', 'mainnet-beta'];

const rawCluster = import.meta.env.VITE_SOLANA_CLUSTER || 'devnet';
export const SOLANA_CLUSTER = VALID_CLUSTERS.includes(rawCluster) ? rawCluster : 'devnet';

export const SOLANA_RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL?.trim() || clusterApiUrl(SOLANA_CLUSTER);

/** Deployed golazo pack program id. Empty => free-play mode (local packs). */
export const PACK_PROGRAM_ID = (import.meta.env.VITE_PACK_PROGRAM_ID || '').trim();

/** True when pack purchases go through the on-chain program. */
export const HAS_PACK_PROGRAM = PACK_PROGRAM_ID.length > 0;

/** Golazo data service base URL (TxODDS TxLINE proxy). Empty => LIVE tab hidden. */
export const DATA_API_URL = (import.meta.env.VITE_DATA_API_URL || '').trim().replace(/\/$/, '');

/** True when the TxODDS match center is available. */
export const HAS_DATA_API = DATA_API_URL.length > 0;
