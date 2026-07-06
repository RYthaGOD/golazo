import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function SolanaLogin() {
  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'var(--bg-deep)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div className="glass-panel" style={{
        padding: '60px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        <h1 className="text-gradient" style={{
          fontFamily: 'var(--font-display)',
          fontSize: '42px',
          textTransform: 'uppercase',
          letterSpacing: '4px',
          margin: 0
        }}>
          Golazo
        </h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '15px' }}>
          The World Cup player trading-card game on Solana devnet. Open packs,
          collect cards rated from real World Cup stats, and battle 5v5.
        </p>

        <div className="login-art" aria-hidden="true">
          <img src="/cards/gk.webp" alt="" loading="lazy" />
          <img src="/cards/def.webp" alt="" loading="lazy" />
          <img src="/cards/mid.webp" alt="" loading="lazy" />
          <img src="/cards/fwd.webp" alt="" loading="lazy" />
        </div>

        <ol className="login-steps">
          <li>Connect a wallet set to <strong>devnet</strong></li>
          <li>Grab free devnet SOL with the in-app airdrop</li>
          <li>Open packs, build your five, hit the arena</li>
        </ol>

        <div style={{ marginTop: '8px' }}>
          <WalletMultiButton style={{
            backgroundColor: 'var(--accent-current)',
            border: '1px solid var(--accent-current)',
            borderRadius: '10px',
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#05130b',
            fontWeight: 700,
            boxShadow: '0 8px 26px rgba(34, 197, 94, 0.4)'
          }} />
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '40px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
        POWERED BY SOLANA · WORLD CUP 2026 &amp; 2022
      </div>
    </div>
  );
}
