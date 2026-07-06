import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { HAS_WAGER } from '../config.js';
import {
  deriveMatchPda,
  buildCreateMatchIx,
  buildJoinMatchIx,
  buildCancelMatchIx,
  fetchOpenMatches,
  fetchMyMatches,
} from './wager.js';

/** Sum of the squad's card overalls — the power committed on-chain. */
export const squadPower = (squad) => squad.reduce((s, c) => s + c.overall, 0);

/**
 * PvP staked battles. Create an open challenge (stake + your squad), join
 * someone else's (the program rolls the winner on-chain and pays the pot),
 * or cancel your own while it's still open.
 */
export function useWager(squad) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [open, setOpen] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const enabled = HAS_WAGER;
  const power = useMemo(() => squadPower(squad), [squad]);
  const squadIds = useMemo(() => squad.map((c) => c.id).join(','), [squad]);

  const refresh = useCallback(async () => {
    if (!enabled || !publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const [o, m] = await Promise.all([fetchOpenMatches(connection), fetchMyMatches(connection, publicKey)]);
      setOpen(o);
      setMine(m);
    } catch (e) {
      setError(e?.message || 'Could not load matches from devnet.');
    } finally {
      setLoading(false);
    }
  }, [enabled, publicKey, connection]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const send = useCallback(
    async (ix) => {
      const sig = await sendTransaction(new Transaction().add(ix), connection);
      await connection.confirmTransaction(sig, 'confirmed');
      return sig;
    },
    [sendTransaction, connection],
  );

  const create = useCallback(
    async (stakeSol) => {
      if (!publicKey || busy || squad.length !== 5) return;
      setBusy(true);
      setError(null);
      try {
        const nonce = Date.now();
        await send(
          buildCreateMatchIx({
            creator: publicKey,
            nonce,
            stakeLamports: Math.round(stakeSol * LAMPORTS_PER_SOL),
            power,
            squad: squadIds,
          }),
        );
        await refresh();
      } catch (e) {
        setError(e?.message || 'Could not create the challenge.');
      } finally {
        setBusy(false);
      }
    },
    [publicKey, busy, squad.length, power, squadIds, send, refresh],
  );

  /** Join returns the resolved match (with winner + seed) for the replay. */
  const join = useCallback(
    async (match) => {
      if (!publicKey || busy || squad.length !== 5) return null;
      setBusy(true);
      setError(null);
      try {
        const { PublicKey } = await import('@solana/web3.js');
        await send(
          buildJoinMatchIx({
            matchPda: new PublicKey(match.pubkey),
            creator: new PublicKey(match.creator),
            opponent: publicKey,
            power,
            squad: squadIds,
          }),
        );
        const updated = await fetchMyMatches(connection, publicKey);
        await refresh();
        return updated.find((m) => m.pubkey === match.pubkey) ?? null;
      } catch (e) {
        setError(e?.message || 'Could not join the challenge.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [publicKey, busy, squad.length, power, squadIds, connection, send, refresh],
  );

  const cancel = useCallback(
    async (match) => {
      if (!publicKey || busy) return;
      setBusy(true);
      setError(null);
      try {
        const { PublicKey } = await import('@solana/web3.js');
        await send(buildCancelMatchIx({ matchPda: new PublicKey(match.pubkey), creator: publicKey }));
        await refresh();
      } catch (e) {
        setError(e?.message || 'Could not cancel the challenge.');
      } finally {
        setBusy(false);
      }
    },
    [publicKey, busy, send, refresh],
  );

  return { enabled, open, mine, loading, busy, error, power, create, join, cancel, refresh, deriveMatchPda };
}
