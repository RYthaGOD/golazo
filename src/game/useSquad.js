import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PLAYER_BY_ID } from './players.js';
import { validateSquad, SQUAD_SIZE } from './battle.js';
import { readWalletJson, writeWalletJson, isStringArray } from './storage.js';

/** The wallet's saved 5-card squad (card ids in localStorage). */
export function useSquad(ownedIds) {
  const { publicKey } = useWallet();
  const pubkey = publicKey?.toBase58() ?? null;

  const [ids, setIds] = useState(() => readWalletJson('squad', pubkey, [], isStringArray));

  // The wallet connects after mount (pubkey: null → key) and can switch
  // between wallets — reload that wallet's saved squad whenever it changes.
  useEffect(() => {
    setIds(readWalletJson('squad', pubkey, [], isStringArray));
  }, [pubkey]);

  // Cards can only be fielded if they are actually owned.
  const squadIds = useMemo(() => ids.filter((id) => ownedIds.has(id) && PLAYER_BY_ID.has(id)), [ids, ownedIds]);
  const squad = useMemo(() => squadIds.map((id) => PLAYER_BY_ID.get(id)), [squadIds]);
  const problems = useMemo(() => validateSquad(squad), [squad]);

  // Toggle against the owned-filtered squad, not the raw saved list: ids for
  // cards no longer owned must not invisibly fill the 5 slots (that would
  // lock the builder), and each write prunes them from storage.
  const toggle = useCallback(
    (id) => {
      setIds((prev) => {
        const effective = prev.filter((x) => ownedIds.has(x) && PLAYER_BY_ID.has(x));
        const next = effective.includes(id)
          ? effective.filter((x) => x !== id)
          : effective.length < SQUAD_SIZE
            ? [...effective, id]
            : effective;
        writeWalletJson('squad', pubkey, next);
        return next;
      });
    },
    [pubkey, ownedIds],
  );

  const clear = useCallback(() => {
    setIds([]);
    writeWalletJson('squad', pubkey, []);
  }, [pubkey]);

  return { squad, squadIds, problems, isLegal: problems.length === 0 && squad.length === SQUAD_SIZE, toggle, clear };
}
