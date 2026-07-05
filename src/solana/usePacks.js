import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { openPack, randomSeed } from '../game/packs.js';
import { readWalletJson, writeWalletJson, isStringArray } from '../game/storage.js';
import { fetchConfig, fetchPacks, fetchPacksBought, buildBuyPackIx } from './packs.js';

/**
 * The connected wallet's pack collection for a single edition. Source depends
 * on the edition:
 *  - on-chain (edition.programId set): packs are Pack PDAs of that program;
 *    buying sends a buy_pack transaction and cards derive from the seed.
 *  - free play (no program): packs live in localStorage with random seeds,
 *    so the edition is playable with zero SOL.
 *
 * All state is namespaced by edition id, so editions never cross.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function usePacks(edition) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const pubkey = publicKey?.toBase58() ?? null;

  const { id: editionId, pools, programId, hasProgram: onChain } = edition;
  const packsNs = `packs:${editionId}`;
  const hydrate = useCallback((packs) => packs.map((p) => ({ ...p, cards: openPack(p.seed, pools) })), [pools]);

  const [packs, setPacks] = useState([]); // [{ index, seed, cards }]
  const [packPriceLamports, setPackPriceLamports] = useState(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState(null);
  const [lastOpened, setLastOpened] = useState(null); // cards of the newest pack
  // Staleness token: a slow fetch for a previous wallet/edition must never
  // overwrite the current state.
  const requestRef = useRef(0);

  // A different wallet or edition must never inherit the previous reveal.
  useEffect(() => setLastOpened(null), [pubkey, editionId]);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!publicKey) {
      setPacks([]);
      return;
    }
    setError(null);
    if (!onChain) {
      const seeds = readWalletJson(packsNs, pubkey, [], isStringArray);
      if (requestRef.current !== requestId) return;
      setPacks(seeds.map((seed, index) => ({ index, seed, cards: openPack(seed, pools) })));
      return;
    }
    setLoading(true);
    try {
      const [config, result] = await Promise.all([
        fetchConfig(connection, programId),
        fetchPacks(connection, programId, publicKey),
      ]);
      if (requestRef.current !== requestId) return;
      if (config) setPackPriceLamports(config.packPriceLamports);
      setPacks(hydrate(result.packs));
      if (result.packs.length < result.count) {
        setError('Some packs failed to load from the RPC — refresh to retry.');
      }
    } catch (e) {
      if (requestRef.current === requestId) setError(e?.message || 'Could not load your packs from devnet.');
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [publicKey, pubkey, connection, onChain, programId, packsNs, pools, hydrate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const buyPack = useCallback(async () => {
    if (!publicKey || buying) return;
    setBuying(true);
    setError(null);
    try {
      if (!onChain) {
        const seeds = readWalletJson(packsNs, pubkey, [], isStringArray);
        const seed = randomSeed();
        writeWalletJson(packsNs, pubkey, [...seeds, seed]);
        setLastOpened(openPack(seed, pools));
        await refresh();
        return;
      }
      // Re-fetch the price at purchase time and carry it in the instruction:
      // the program rejects the buy if the on-chain price was raised above
      // what the buyer was shown.
      const config = await fetchConfig(connection, programId);
      if (!config) throw new Error('This edition is not initialized on-chain yet.');
      setPackPriceLamports(config.packPriceLamports);
      const index = await fetchPacksBought(connection, programId, publicKey);
      const ix = buildBuyPackIx({ programId, buyer: publicKey, index, maxPriceLamports: config.packPriceLamports });
      const sig = await sendTransaction(new Transaction().add(ix), connection);
      await connection.confirmTransaction(sig, 'confirmed');
      // RPC reads can lag the confirmation — wait for the counter to move
      // before deriving the reveal, so the buyer always sees their pack.
      for (let attempt = 0; attempt < 8; attempt++) {
        if ((await fetchPacksBought(connection, programId, publicKey)) > index) break;
        await sleep(500);
      }
      const result = await fetchPacks(connection, programId, publicKey);
      const newest = result.packs.find((p) => p.index === index);
      if (newest) setLastOpened(openPack(newest.seed, pools));
      setPacks(hydrate(result.packs));
    } catch (e) {
      setError(e?.message || 'Pack purchase failed or was rejected.');
      if (onChain) refresh();
    } finally {
      setBuying(false);
    }
  }, [publicKey, pubkey, connection, onChain, programId, packsNs, pools, buying, sendTransaction, refresh, hydrate]);

  /** Unique owned cards with duplicate counts, best overall first. */
  const collection = useMemo(() => {
    const byId = new Map();
    for (const pack of packs) {
      for (const card of pack.cards) {
        const entry = byId.get(card.id);
        if (entry) entry.count += 1;
        else byId.set(card.id, { card, count: 1 });
      }
    }
    return [...byId.values()].sort((a, b) => b.card.overall - a.card.overall);
  }, [packs]);

  const packPriceSol = onChain && packPriceLamports != null ? packPriceLamports / LAMPORTS_PER_SOL : null;

  return {
    onChain,
    packs,
    collection,
    packPriceSol,
    loading,
    buying,
    error,
    buyPack,
    lastOpened,
    clearLastOpened: () => setLastOpened(null),
    refresh,
  };
}
