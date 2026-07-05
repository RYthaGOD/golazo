import React, { useState } from 'react';
import { Users } from 'lucide-react';
import PlayerCard from './PlayerCard.jsx';
import { POSITIONS, RARITIES } from '../game/players.js';

/**
 * The wallet's card collection with position/rarity filters.
 * When `onToggle` is provided (squad building) cards become selectable.
 */
export default function CollectionGrid({ collection, selectedIds, onToggle, edition, title = 'MY CLUB' }) {
  const totalCards = edition?.players.length ?? collection.length;
  const [posFilter, setPosFilter] = useState('ALL');
  const [rarityFilter, setRarityFilter] = useState('ALL');

  const filtered = collection.filter(
    ({ card }) =>
      (posFilter === 'ALL' || card.pos === posFilter) &&
      (rarityFilter === 'ALL' || card.rarity === rarityFilter),
  );

  return (
    <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 className="text-gradient section-title">
          <Users size={18} /> {title}
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
          {collection.length}/{totalCards} UNIQUE CARDS
        </span>
      </div>

      <div className="filter-row">
        {['ALL', ...POSITIONS].map((pos) => (
          <button key={pos} className={posFilter === pos ? 'chip active' : 'chip'} onClick={() => setPosFilter(pos)}>
            {pos}
          </button>
        ))}
        <span className="filter-divider" />
        {['ALL', ...RARITIES].map((rarity) => (
          <button
            key={rarity}
            className={rarityFilter === rarity ? 'chip active' : 'chip'}
            data-rarity={rarity === 'ALL' ? undefined : rarity}
            onClick={() => setRarityFilter(rarity)}
          >
            {rarity}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
          {collection.length === 0
            ? 'No cards yet — rip open your first pack in the shop.'
            : 'No cards match these filters.'}
        </p>
      ) : (
        <div className="card-grid">
          {filtered.map(({ card, count }) => (
            <PlayerCard
              key={card.id}
              card={card}
              count={count}
              selected={selectedIds?.includes(card.id)}
              onClick={onToggle ? () => onToggle(card.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
