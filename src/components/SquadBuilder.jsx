import React from 'react';
import { Shield, X } from 'lucide-react';
import PlayerCard from './PlayerCard.jsx';
import CollectionGrid from './CollectionGrid.jsx';
import { teamRatings, SQUAD_SIZE } from '../game/battle.js';

const RatingBar = ({ label, value }) => (
  <div className="rating-row">
    <span>{label}</span>
    <div className="rating-bar">
      <div className="rating-fill" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
    <strong>{Math.round(value)}</strong>
  </div>
);

/** Pick a legal 5-a-side squad (1 GK, ≥1 DEF, ≥1 FWD) from owned cards. */
export default function SquadBuilder({ collection, squadApi }) {
  const { squad, squadIds, problems, isLegal, toggle, clear } = squadApi;
  const ratings = squad.length > 0 ? teamRatings(squad) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 className="text-gradient section-title">
            <Shield size={18} /> STARTING FIVE ({squad.length}/{SQUAD_SIZE})
          </h2>
          {squad.length > 0 && (
            <button className="chip" onClick={clear}>
              <X size={12} /> CLEAR
            </button>
          )}
        </div>

        <div className="card-grid squad-grid">
          {squad.map((card) => (
            <PlayerCard key={card.id} card={card} compact selected onClick={() => toggle(card.id)} />
          ))}
          {Array.from({ length: SQUAD_SIZE - squad.length }).map((_, i) => (
            <div key={`empty-${i}`} className="squad-slot-empty">
              EMPTY
              <br />
              SLOT
            </div>
          ))}
        </div>

        {isLegal ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <RatingBar label="ATTACK" value={ratings.attack} />
            <RatingBar label="MIDFIELD" value={ratings.midfield} />
            <RatingBar label="DEFENSE" value={ratings.defense} />
            <span style={{ fontSize: 12, color: 'var(--accent-current)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
              ✓ SQUAD READY — HEAD TO THE ARENA
            </span>
          </div>
        ) : (
          <ul className="squad-problems">
            {(problems.length ? problems : ['Pick your five: exactly 1 GK, at least 1 DEF and 1 FWD.']).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>

      <CollectionGrid collection={collection} selectedIds={squadIds} onToggle={toggle} title="PICK FROM YOUR CLUB" />
    </div>
  );
}
