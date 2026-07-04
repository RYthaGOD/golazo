import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SOLANA_CLUSTER } from '../config.js';

/**
 * The connected wallet's SOL balance, plus a one-click devnet airdrop so
 * players can fund themselves without leaving the app. The faucet rate-limits
 * aggressively; failures surface a pointer to faucet.solana.com instead of
 * a raw RPC error.
 */
export function useBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [lamports, setLamports] = useState(null);
  const [airdropping, setAirdropping] = useState(false);
  const [airdropError, setAirdropError] = useState(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setLamports(null);
      return;
    }
    try {
      setLamports(await connection.getBalance(publicKey));
    } catch {
      // Keep the previous value; the balance pill is informational.
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canAirdrop = SOLANA_CLUSTER !== 'mainnet-beta';

  const requestAirdrop = useCallback(async () => {
    if (!publicKey || airdropping || !canAirdrop) return;
    setAirdropping(true);
    setAirdropError(null);
    try {
      const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, 'confirmed');
      await refresh();
    } catch {
      setAirdropError('Faucet is rate-limited right now — grab devnet SOL at faucet.solana.com instead.');
    } finally {
      setAirdropping(false);
    }
  }, [publicKey, connection, airdropping, canAirdrop, refresh]);

  return {
    lamports,
    sol: lamports != null ? lamports / LAMPORTS_PER_SOL : null,
    refresh,
    canAirdrop,
    requestAirdrop,
    airdropping,
    airdropError,
  };
}
