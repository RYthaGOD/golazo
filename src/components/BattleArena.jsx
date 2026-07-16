import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
export default function BattleArena({ squadApi, edition }) {
  const { publicKey } = useWallet();
  const { squad, isLegal } = squadApi;
  const pubkey = publicKey?.toBase58() ?? null;
  const recordNs = `record:${edition.id}`;

  const [tier, setTier] = useState('amateur');
  const [battle, setBattle] = useState(null); // { result, aiSquad, tierLabel }
  const [revealed, setRevealed] = useState(0);
  const [record, setRecord] = useState(() => readWalletJson(recordNs, pubkey, NO_RECORD, isWinLossRecord));
  const recordedRef = useRef(false);
  const logRef = useRef(null);

  // Wallet or edition switches must swap in that record — otherwise the next
  // result writes the previous record's numbers under the new key.
  useEffect(() => {
    setRecord(readWalletJson(recordNs, pubkey, NO_RECORD, isWinLossRecord));
  }, [pubkey, recordNs]);

  const fullLog = battle?.result.log ?? [];
  const done = battle && revealed >= fullLog.length;

  // Follow the commentary as it lands.
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealed]);

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
    writeWalletJson(recordNs, pubkey, next);
    setRecord(next);
  }, [done, battle, record, pubkey, recordNs]);

  const fight = () => {
    const aiSquad = buildAiSquad(tier, randomSeed(), edition.players);
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
      <div className="panel arena-empty">
        <Swords size={26} />
        <p>Field a legal squad first — five cards: 1 keeper, 1+ defender, 1+ forward.</p>
      </div>
    );
  }

  const visibleLog = fullLog.slice(0, revealed);
  const score = visibleLog.reduce(
    (s, e) => (e.type === 'GOAL' ? { ...s, [e.side]: s[e.side] + 1 } : s),
    { home: 0, away: 0 },
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="panel" style={{ padding: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>Opponent</span>
        {Object.entries(AI_TIERS).map(([key, { label }]) => (
          <button key={key} className={tier === key ? 'chip active' : 'chip'} onClick={() => setTier(key)} disabled={battle && !done}>
            {label}
          </button>
        ))}
        <span className="pill pill-mono" style={{ marginLeft: 'auto' }}>
          Record {record.w}W–{record.l}L
        </span>
        <button className="btn-primary" onClick={fight} disabled={battle && !done}>
          {battle && !done ? 'Match in play…' : battle ? 'Rematch' : 'Kick off'}
        </button>
      </div>

      {battle && (
        <>
          <div className="panel scoreboard">
            <span className="score-team">Your five</span>
            <span className="score-num">
              {score.home}–{score.away}
            </span>
            <span className="score-team">{battle.tierLabel}</span>
            {!done && (
              <button className="icon-button" onClick={() => setRevealed(fullLog.length)} title="Skip to full time" aria-label="Skip to full time">
                <FastForward size={16} />
              </button>
            )}
          </div>

          <div className="panel tape" aria-label="Tale of the tape">
            {[
              ['ATT', 'attack'],
              ['MID', 'midfield'],
              ['DEF', 'defense'],
            ].map(([label, key]) => {
              const home = Math.round(battle.result.ratings.home[key]);
              const away = Math.round(battle.result.ratings.away[key]);
              const total = Math.max(1, home + away);
              return (
                <div key={key} className="tape-row">
                  <strong className={home >= away ? 'lead' : undefined}>{home}</strong>
                  <div className="tape-bar">
                    <span className="tape-home" style={{ width: `${(home / total) * 100}%` }} />
                    <span className="tape-label">{label}</span>
                    <span className="tape-away" style={{ width: `${(away / total) * 100}%` }} />
                  </div>
                  <strong className={away > home ? 'lead' : undefined}>{away}</strong>
                </div>
              );
            })}
          </div>

          <div className="panel battle-log" role="log" ref={logRef}>
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
                <Trophy size={17} />
                {battle.result.winner === 'home' ? 'Victory' : 'Defeat'} · MVP {battle.result.mvp.name}
              </div>
            )}
          </div>

          <div className="panel" style={{ padding: 24 }}>
            <span className="eyebrow">Opponent · {battle.tierLabel}</span>
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
