import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Swords, Trophy, FastForward } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import PlayerCard from './PlayerCard.jsx';
import { simulateBattle, buildAiSquad, AI_TIERS } from '../game/battle.js';
import { randomSeed } from '../game/packs.js';
import { readWalletJson, writeWalletJson, isWinLossRecord } from '../game/storage.js';

const REVEAL_MS = 1000;
const NO_RECORD = { w: 0, l: 0 };

/** 5v5 simulated battles vs seeded AI squads, with animated play-by-play. */
export default function BattleArena({ squadApi }) {
  const { publicKey } = useWallet();
  const { squad, isLegal } = squadApi;
  const pubkey = publicKey?.toBase58() ?? null;

  const [tier, setTier] = useState('amateur');
  const [battle, setBattle] = useState(null); // { result, aiSquad, tierLabel }
  const [revealed, setRevealed] = useState(0);
  const [record, setRecord] = useState(() => readWalletJson('record', pubkey, NO_RECORD, isWinLossRecord));
  const recordedRef = useRef(false);

  // Wallet switches mid-session must swap in that wallet's own record —
  // otherwise the next result writes the old wallet's numbers under the new key.
  useEffect(() => {
    setRecord(readWalletJson('record', pubkey, NO_RECORD, isWinLossRecord));
  }, [pubkey]);

  const fullLog = battle?.result.log ?? [];
  const done = battle && revealed >= fullLog.length;

  useEffect(() => {
    if (!battle || done) return undefined;
    const t = setInterval(() => setRevealed((n) => Math.min(n + 1, fullLog.length)), REVEAL_MS);
    return () => clearInterval(t);
  }, [battle, done, fullLog.length]);

  useEffect(() => {
    if (!done || recordedRef.current || !pubkey) return;
    recordedRef.current = true;
    const key = battle.result.winner === 'home' ? 'w' : 'l';
    const next = { ...record, [key]: record[key] + 1 };
    writeWalletJson('record', pubkey, next);
    setRecord(next);
  }, [done, battle, record, pubkey]);

  const fight = () => {
    const aiSquad = buildAiSquad(tier, randomSeed());
    const result = simulateBattle(squad, aiSquad, randomSeed(), {
      home: 'YOUR FIVE',
      away: AI_TIERS[tier].label.toUpperCase(),
    });
    recordedRef.current = false;
    setBattle({ result, aiSquad, tierLabel: AI_TIERS[tier].label });
    setRevealed(1);
  };

  if (!isLegal) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <Swords size={28} style={{ opacity: 0.6 }} />
        <p style={{ marginTop: 12, fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
          FIELD A LEGAL SQUAD FIRST — 5 CARDS: 1 GK, 1+ DEF, 1+ FWD.
        </p>
      </div>
    );
  }

  const visibleLog = fullLog.slice(0, revealed);
  const score = visibleLog.reduce(
    (s, e) => (e.type === 'GOAL' ? { ...s, [e.side]: s[e.side] + 1 } : s),
    { home: 0, away: 0 },
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 className="text-gradient section-title">
            <Swords size={18} /> BATTLE ARENA
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
            RECORD: {record.w}W – {record.l}L
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(AI_TIERS).map(([key, { label }]) => (
            <button key={key} className={tier === key ? 'chip active' : 'chip'} onClick={() => setTier(key)} disabled={battle && !done}>
              {label.toUpperCase()}
            </button>
          ))}
          <button
            className="glow-border"
            style={{ padding: '10px 24px', marginLeft: 'auto' }}
            onClick={fight}
            disabled={battle && !done}
          >
            {battle && !done ? 'MATCH IN PLAY…' : battle ? 'REMATCH' : 'KICK OFF'}
          </button>
        </div>
      </div>

      {battle && (
        <>
          <div className="glass-panel scoreboard">
            <span className="score-team">YOUR FIVE</span>
            <span className="score-num">
              {score.home} – {score.away}
            </span>
            <span className="score-team">{battle.tierLabel.toUpperCase()}</span>
            {!done && (
              <button className="icon-button" onClick={() => setRevealed(fullLog.length)} title="Skip to full time" aria-label="Skip to full time">
                <FastForward size={16} />
              </button>
            )}
          </div>

          <div className="glass-panel battle-log" role="log">
            {visibleLog.map((entry, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className={`log-entry log-${entry.type.toLowerCase()}${entry.side ? ` log-${entry.side}` : ''}`}
              >
                <span className="log-minute">{entry.minute}&apos;</span>
                <span>{entry.text}</span>
              </motion.div>
            ))}
            {done && (
              <div className={`battle-result ${battle.result.winner === 'home' ? 'won' : 'lost'}`}>
                <Trophy size={18} />
                {battle.result.winner === 'home' ? 'VICTORY!' : 'DEFEAT.'} MVP: {battle.result.mvp.name}
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 className="section-title" style={{ color: 'var(--text-muted)' }}>
              OPPONENT: {battle.tierLabel.toUpperCase()}
            </h3>
            <div className="card-grid squad-grid" style={{ marginTop: 12 }}>
              {battle.aiSquad.map((card) => (
                <PlayerCard key={card.id} card={card} compact />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
