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
      <div className="panel" style={{ padding: 20 }}>
        <p style={{ color: 'var(--muted-2)' }}>This match used cards from an edition not loaded here.</p>
        <button style={{ marginTop: 12 }} onClick={onClose}>Close</button>
      </div>
    );
  }

  const { r, iWon } = view;
  const payout = iWon ? `+◎ ${sol(match.stake)}` : `−◎ ${sol(match.stake)}`;
  return (
    <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="section-head">
        <h3 className="section-title" style={{ fontSize: 17 }}>
          <Trophy size={16} /> Match result
        </h3>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="scoreboard" style={{ padding: '8px 0' }}>
        <span className="score-team">Your five</span>
        <span className="score-num">{r.homeScore}–{r.awayScore}</span>
        <span className="score-team">Rival</span>
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
        <Trophy size={17} />
        {iWon ? 'You won the pot' : 'Rival took the pot'} · {payout}
      </div>
      {r.wentToPens && <p className="empty-note" style={{ padding: 0, fontSize: 12 }}>Settled on penalties.</p>}
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
      <div className="panel arena-empty">
        <Coins size={26} />
        <p>Build a legal squad in the squad tab to stake a wager.</p>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {result && <ResultView match={result} me={me} onClose={() => setResult(null)} />}

      {/* Create a challenge */}
      <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="section-head">
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, maxWidth: '62ch' }}>
            Stake devnet SOL and open a challenge. When a rival accepts, the program rolls the winner{' '}
            <strong style={{ color: 'var(--pitch-bright)' }}>on-chain</strong> — weighted by squad power — and
            pays the whole pot to the victor.
          </p>
          <span className="pill pill-mono">Squad power {squadPower(squad)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Stake</span>
          {STAKES.map((s) => (
            <button key={s} className={stake === s ? 'chip active' : 'chip'} onClick={() => setStake(s)}>
              ◎ {s}
            </button>
          ))}
          <button
            className="btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={() => wager.create(stake)}
            disabled={wager.busy}
          >
            {wager.busy ? 'Confirming…' : `Stake ◎ ${stake}`}
          </button>
        </div>
        {wager.error && <div role="alert" className="error-note">{wager.error}</div>}
      </div>

      {/* Open challenges */}
      <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="section-head">
          <h3 className="section-title" style={{ fontSize: 17 }}>
            <Swords size={16} /> Open challenges
          </h3>
          <button className="chip" onClick={wager.refresh} disabled={wager.loading}>
            {wager.loading ? <Loader size={12} className="spin" /> : 'Refresh'}
          </button>
        </div>

        {openFromOthers.length === 0 && myOpen.length === 0 && (
          <p className="empty-note">
            No open challenges. Create one above and share the arena — first to accept plays for the pot.
          </p>
        )}

        {myOpen.map((m) => (
          <div key={m.pubkey} className="wager-row mine">
            <span className="wager-tag"><span className="dot gold" /> Yours · waiting</span>
            <span className="wager-sol">◎ {sol(m.stake)}</span>
            <span className="wager-pow">PWR {m.creatorPower}</span>
            <button className="chip" onClick={() => wager.cancel(m)} disabled={wager.busy}>
              Cancel
            </button>
          </div>
        ))}

        {openFromOthers.map((m) => (
          <div key={m.pubkey} className="wager-row">
            <span className="mono" style={{ color: 'var(--muted)' }}>{short(m.creator)}</span>
            <span className="wager-sol">◎ {sol(m.stake)}</span>
            <span className="wager-pow">PWR {m.creatorPower}</span>
            <button className="btn-primary" style={{ padding: '9px 18px' }} onClick={() => doJoin(m)} disabled={wager.busy}>
              {wager.busy ? '…' : 'Accept'}
            </button>
          </div>
        ))}
      </div>

      {/* Recent results */}
      {resolved.length > 0 && (
        <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 className="section-title" style={{ fontSize: 17, marginBottom: 4 }}>
            <Trophy size={16} /> Your results
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
                <span className={`wager-outcome ${iWon ? 'won' : 'lost'}`}>{iWon ? 'Won' : 'Lost'}</span>
                <span style={{ color: 'var(--muted-2)' }}>
                  vs <span className="mono">{short(m.creator === me ? m.opponent : m.creator)}</span>
                </span>
                <span className="wager-pow">POT ◎ {sol(m.stake * 2)}</span>
                <span className="wager-sol" style={{ color: iWon ? 'var(--pitch-bright)' : '#ffb4ab' }}>
                  {iWon ? `+◎ ${sol(m.stake)}` : `−◎ ${sol(m.stake)}`}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
