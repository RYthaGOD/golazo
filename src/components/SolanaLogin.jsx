import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SOLANA_CLUSTER } from '../config.js';

// Five legend-tier faces, staggered into a rail under the headline.
const HERO_ART = [
  'wc26-10040792.jpg',
  'wc26-49673.png',
  'wc26-889209.jpg',
  'wc26-463984.jpg',
  'wc26-453928.jpg',
];

const TAPE = [
  ['Cards per pack', '5'],
  ['Final slot', 'Rare or better'],
  ['Rated from', 'Real World Cup data'],
  ['Editions', 'WC26 & WC22'],
  ['Winner', 'Rolled on-chain'],
  ['Network', 'Solana devnet'],
];

const STEPS = [
  ['Connect', 'Point a wallet at Solana devnet. Free SOL is one click away in the in-app airdrop.'],
  ['Rip packs', 'Five cards a pack, each rated from real World Cup appearances, starts and goals. The last slot is always rare or better.'],
  ['Pick your five', 'One keeper, at least one defender, at least one forward. Attack, midfield and defense ratings update as you pick.'],
  ['Play for the pot', 'Battle the AI for nothing, or stake devnet SOL against a rival and let the program roll the winner.'],
];

export default function SolanaLogin() {
  return (
    <div className="landing">
      <header className="nav">
        <div className="nav-inner">
          <span className="nav-logo">Golazo</span>
          <span className="nav-badge">TCG</span>
          <span className="nav-spacer" />
          <a className="nav-link" href="#how">How it works</a>
          <a className="nav-link" href="https://ante-bet.xyz" target="_blank" rel="noreferrer">ANTE ↗</a>
          <span className="pill" style={{ marginLeft: 4 }}>{SOLANA_CLUSTER}</span>
          <WalletMultiButton />
        </div>
      </header>

      <section className="hero">
        <span className="hero-eyebrow">Player trading cards · Solana {SOLANA_CLUSTER}</span>

        {/* Explicit line blocks: Anton at hero scale wraps mid-sentence
            otherwise, and the break has to land on the full stop. */}
        <h1 className="hero-title">
          <span>Collect the <em>World Cup</em>.</span>
          <span>Stake your five.</span>
        </h1>

        <p className="hero-sub">
          Every Golazo card is rated from <strong>real World Cup data</strong> — appearances, starts,
          goals. Open packs on Solana devnet, pick your five, then stake them against a rival. The
          winner is rolled on-chain, so nobody has to take the result on trust.
        </p>

        <div className="hero-cta">
          <WalletMultiButton />
          <a className="btn-ghost" href="#how" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            See how it works
          </a>
        </div>

        <div className="hero-facts">
          <span className="hero-fact"><span className="dot" /> Live on devnet</span>
          <span className="hero-fact"><span className="dot gold" /> Rated from TxODDS</span>
          <span className="hero-fact"><span className="dot" /> Built on Solana</span>
        </div>

        <div className="hero-rail" aria-hidden="true">
          {HERO_ART.map((f) => (
            <img key={f} src={`/cards/players/${f}`} alt="" loading="lazy" />
          ))}
        </div>
      </section>

      <div className="tape-marquee" aria-hidden="true">
        <div className="tape-track">
          {[0, 1].map((dup) => (
            <React.Fragment key={dup}>
              {TAPE.map(([label, value]) => (
                <span className="tape-item" key={`${dup}-${label}`}>
                  <b>{label}</b> {value}
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <section className="flow" id="how">
        {STEPS.map(([title, body], i) => (
          <div className="flow-step" key={title}>
            <span className="flow-num">{i + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </section>

      <footer className="landing-footer">
        Powered by Solana · World Cup 2026 &amp; 2022 · Devnet only, no real money
      </footer>
    </div>
  );
}
