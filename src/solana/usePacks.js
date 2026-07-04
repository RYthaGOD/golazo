import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { HAS_PACK_PROGRAM } from '../config.js';
import { openPack, randomSeed } from '../game/packs.js';
import { readWalletJson, writeWalletJson, isStringArray } from '../game/storage.js';
import { fetchConfig, fetchPacks, fetchPacksBought, buildBuyPackIx } from './packs.js';

/**
 * The wallet's pack collection, from one of two sources:
 *  - on-chain (VITE_PACK_PROGRAM_ID set): packs are Pack PDAs; buying sends
 *    a buy_pack transaction and the cards derive from the committed seed.
 *  - free play (no program): packs live in localStorage with random seeds,
 *    so the whole game is playable with zero SOL.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hydrate = (packs) => packs.map((p) => ({ ...p, cards: openPack(p.seed) }));

export function usePacks() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const pubkey = publicKey?.toBase58() ?? null;

  const [packs, setPacks] = useState([]); // [{ index, seed, cards }]
  const [packPriceLamports, setPackPriceLamports] = useState(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState(null);
  const [lastOpened, setLastOpened] = useState(null); // cards of the newest pack
  // Staleness token: a slow fetch for a previous wallet must never overwrite
  // the current wallet's state after a switch.
  const requestRef = useRef(0);

  const onChain = HAS_PACK_PROGRAM;

  // A different wallet must never inherit the previous wallet's pack reveal.
  useEffect(() => setLastOpened(null), [pubkey]);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!publicKey) {
      setPacks([]);
      return;
    }
    setError(null);
    if (!onChain) {
      const seeds = readWalletJson('packs', pubkey, [], isStringArray);
      if (requestRef.current !== requestId) return;
      setPacks(seeds.map((seed, index) => ({ index, seed, cards: openPack(seed) })));
      return;
    }
    setLoading(true);
    try {
      const [config, result] = await Promise.all([
        fetchConfig(connection),
        fetchPacks(connection, publicKey),
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
  }, [publicKey, pubkey, connection, onChain]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const buyPack = useCallback(async () => {
    if (!publicKey || buying) return;
    setBuying(true);
    setError(null);
    try {
      if (!onChain) {
        const seeds = readWalletJson('packs', pubkey, [], isStringArray);
        const seed = randomSeed();
        writeWalletJson('packs', pubkey, [...seeds, seed]);
        setLastOpened(openPack(seed));
        await refresh();
        return;
      }
      // Re-fetch the price at purchase time and carry it in the instruction:
      // the program rejects the buy if the on-chain price was raised above
      // what the buyer was shown.
      const config = await fetchConfig(connection);
      if (!config) throw new Error('The pack program is not initialized on this cluster.');
      setPackPriceLamports(config.packPriceLamports);
      const index = await fetchPacksBought(connection, publicKey);
      const ix = buildBuyPackIx({ buyer: publicKey, index, maxPriceLamports: config.packPriceLamports });
      const sig = await sendTransaction(new Transaction().add(ix), connection);
      await connection.confirmTransaction(sig, 'confirmed');
      // RPC reads can lag the confirmation — wait for the counter to move
      // before deriving the reveal, so the buyer always sees their pack.
      for (let attempt = 0; attempt < 8; attempt++) {
        if ((await fetchPacksBought(connection, publicKey)) > index) break;
        await sleep(500);
      }
      const result = await fetchPacks(connection, publicKey);
      const newest = result.packs.find((p) => p.index === index);
      if (newest) setLastOpened(openPack(newest.seed));
      setPacks(hydrate(result.packs));
    } catch (e) {
      setError(e?.message || 'Pack purchase failed or was rejected.');
      // The tx may still have landed (confirm timeout), or another tab took
      // this pack index — resync so the UI shows what the chain actually did.
      if (onChain) refresh();
    } finally {
      setBuying(false);
    }
  }, [publicKey, pubkey, connection, onChain, buying, sendTransaction, refresh]);

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
