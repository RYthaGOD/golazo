import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Swords, Trophy, X, Loader } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWager, squadPower } from '../solana/useWager.js';
import { resolveSquad } from '../game/editions.js';
import { simulateBattle, validateSquad } from '../game/battle.js';
import { createRng } from '../game/packs.js';

const STAKES = [0.05, 0.1, 0.25];
const short = (k) => `${k.slice(0, 4)}…${k.slice(-4)}`;
const sol = (lamports) => (lamports / LAMPORTS_PER_SOL).toFixed(2);

/**
 * Build a play-by-play that AGREES with the on-chain winner. The pot was
 * decided by the program's roll; we search seeds derived from the committed
 * seed until the local sim produces the same winner, so the visualised match
 * never contradicts the payout.
 */
function replay(homeSquad, awaySquad, seedBytes, homeShouldWin, names) {
  const base = seedBytes.reduce((a, b) => (a * 31 + b) >>> 0, 7);
  const rng = createRng(base);
  for (let i = 0; i < 200; i++) {
    const seed = `wager-${base}-${Math.floor(rng() * 1e9)}`;
    const result = simulateBattle(homeSquad, awaySquad, seed, names);
    if ((result.winner === 'home') === homeShouldWin) return result;
  }
  return simulateBattle(homeSquad, awaySquad, `wager-${base}`, names);
}

function ResultView({ match, me, onClose }) {
  const view = useMemo(() => {
    const iAmCreator = match.creator === me;
    const homeIds = iAmCreator ? match.creatorSquad : match.opponentSquad;
    const awayIds = iAmCreator ? match.opponentSquad : match.creatorSquad;
    const home = resolveSquad(homeIds);
    const away = resolveSquad(awayIds);
    if (validateSquad(home).length || validateSquad(away).length) return null;
    const iWon = match.winner === me;
    const r = replay(home, away, match.seed, iWon, { home: 'YOUR FIVE', away: 'RIVAL' });
    return { r, iWon, home, away };
  }, [match, me]);

  if (!view) {
    return (
      <div className="glass-panel" style={{ padding: 20 }}>
        <p style={{ color: 'var(--text-muted)' }}>This match used cards from an edition not loaded here.</p>
        <button style={{ marginTop: 12 }} onClick={onClose}>CLOSE</button>
      </div>
    );
  }

  const { r, iWon } = view;
  const payout = iWon ? `+${sol(match.stake * 2 - match.stake)} SOL` : `-${sol(match.stake)} SOL`;
  return (
    <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="section-title">
          <Trophy size={16} /> MATCH RESULT
        </h3>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="scoreboard" style={{ padding: '8px 0' }}>
        <span className="score-team">YOUR FIVE</span>
        <span className="score-num">{r.homeScore} – {r.awayScore}</span>
        <span className="score-team">RIVAL</span>
      </div>
      <div className="tape">
        {[['ATT', 'attack'], ['MID', 'midfield'], ['DEF', 'defense']].map(([label, key]) => {
          const h = Math.round(r.ratings.home[key]);
          const a = Math.round(r.ratings.away[key]);
          const t = Math.max(1, h + a);
          return (
            <div key={key} className="tape-row">
              <strong className={h >= a ? 'lead' : undefined}>{h}</strong>
              <div className="tape-bar">
                <span className="tape-home" style={{ width: `${(h / t) * 100}%` }} />
                <span className="tape-label">{label}</span>
                <span className="tape-away" style={{ width: `${(a / t) * 100}%` }} />
              </div>
              <strong className={a > h ? 'lead' : undefined}>{a}</strong>
            </div>
          );
        })}
      </div>
      <div className={`battle-result ${iWon ? 'won' : 'lost'}`}>
        <Trophy size={18} />
        {iWon ? 'YOU WON THE POT' : 'RIVAL TOOK THE POT'} · {payout}
      </div>
      {r.wentToPens && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Settled on penalties.</p>}
    </div>
  );
}

/** PvP staked battles: stake SOL, the winner is rolled on-chain, pot to victor. */
export default function WagerArena({ squadApi }) {
  const { publicKey } = useWallet();
  const me = publicKey?.toBase58() ?? '';
  const { squad, isLegal } = squadApi;
  const wager = useWager(squad);
  const [stake, setStake] = useState(STAKES[0]);
  const [result, setResult] = useState(null);

  if (!isLegal) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <Coins size={26} style={{ opacity: 0.6 }} />
        <p style={{ marginTop: 12, fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
          BUILD A LEGAL SQUAD IN THE SQUAD TAB TO STAKE A WAGER.
        </p>
      </div>
    );
  }

  const openFromOthers = wager.open.filter((m) => m.creator !== me);
  const myOpen = wager.open.filter((m) => m.creator === me);
  const resolved = wager.mine.filter((m) => m.state === 1);

  const doJoin = async (m) => {
    const settled = await wager.join(m);
    if (settled) setResult(settled);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {result && <ResultView match={result} me={me} onClose={() => setResult(null)} />}

      {/* Create a challenge */}
      <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 className="text-gradient section-title">
            <Coins size={18} /> WAGER ARENA
          </h2>
          <span className="pill">YOUR SQUAD POWER: {squadPower(squad)}</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          Stake devnet SOL and open a challenge. When a rival accepts, the program rolls the winner{' '}
          <strong>on-chain</strong> (weighted by squad power) and pays the whole pot to the victor.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {STAKES.map((s) => (
            <button key={s} className={stake === s ? 'chip active' : 'chip'} onClick={() => setStake(s)}>
              {s} SOL
            </button>
          ))}
          <button
            className="glow-border"
            style={{ padding: '12px 26px', marginLeft: 'auto' }}
            onClick={() => wager.create(stake)}
            disabled={wager.busy}
          >
            {wager.busy ? 'CONFIRMING…' : `STAKE ${stake} SOL`}
          </button>
        </div>
        {wager.error && <div role="alert" className="error-note">{wager.error}</div>}
      </div>

      {/* Open challenges */}
      <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="section-title" style={{ fontSize: 15 }}>
            <Swords size={16} /> OPEN CHALLENGES
          </h3>
          <button className="chip" onClick={wager.refresh} disabled={wager.loading}>
            {wager.loading ? <Loader size={12} className="spin" /> : 'REFRESH'}
          </button>
        </div>

        {openFromOthers.length === 0 && myOpen.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            No open challenges. Create one above and share the arena — first to accept plays for the pot.
          </p>
        )}

        {myOpen.map((m) => (
          <div key={m.pubkey} className="wager-row mine">
            <span className="wager-tag">YOURS · WAITING</span>
            <span>{sol(m.stake)} SOL</span>
            <span className="wager-pow">PWR {m.creatorPower}</span>
            <button className="chip" onClick={() => wager.cancel(m)} disabled={wager.busy}>
              CANCEL
            </button>
          </div>
        ))}

        {openFromOthers.map((m) => (
          <div key={m.pubkey} className="wager-row">
            <span>{short(m.creator)}</span>
            <span>{sol(m.stake)} SOL</span>
            <span className="wager-pow">PWR {m.creatorPower}</span>
            <button className="glow-border" style={{ padding: '8px 18px' }} onClick={() => doJoin(m)} disabled={wager.busy}>
              {wager.busy ? '…' : 'ACCEPT'}
            </button>
          </div>
        ))}
      </div>

      {/* Recent results */}
      {resolved.length > 0 && (
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 className="section-title" style={{ fontSize: 15 }}>
            <Trophy size={16} /> YOUR RESULTS
          </h3>
          {resolved.slice(0, 8).map((m) => {
            const iWon = m.winner === me;
            return (
              <motion.button
                key={m.pubkey}
                className={`wager-row result ${iWon ? 'won' : 'lost'}`}
                onClick={() => setResult(m)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span>{iWon ? 'WON' : 'LOST'}</span>
                <span>vs {short(m.creator === me ? m.opponent : m.creator)}</span>
                <span className="wager-pow">POT {sol(m.stake * 2)} SOL</span>
                <span>{iWon ? `+${sol(m.stake)}` : `-${sol(m.stake)}`} SOL</span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
