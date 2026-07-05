import React from 'react';
import { CARD_ART } from '../game/cardArt.js';

const STAT_LABELS = [
  ['att', 'ATT'],
  ['pas', 'PAS'],
  ['def', 'DEF'],
  ['phy', 'PHY'],
];

/**
 * Card art: a per-player image when one exists (public/cards/players/, tracked
 * by the CARD_ART manifest), else the shared position archetype. Either way
 * the art is an original anime character — no real player likeness; only the
 * name, nation, and stats are factual.
 */
const POSITION_ART = {
  GK: '/cards/gk.webp',
  DEF: '/cards/def.webp',
  MID: '/cards/mid.webp',
  FWD: '/cards/fwd.webp',
};

const artFor = (card) => {
  const file = CARD_ART.get(card.id);
  return file ? `/cards/players/${file}` : POSITION_ART[card.pos];
};

// The WC line depends on the edition: WC26 cards are rated from tournament
// appearances/starts, WC22 cards from final goals/assists.
const wcLine = (card) =>
  card.id.startsWith('wc26-')
    ? `WC26 · ${card.wc.apps} ${card.wc.apps === 1 ? 'app' : 'apps'} · ${card.wc.starts ?? 0} starts`
    : `WC22 · ${card.wc.apps} apps · ${card.wc.goals}G ${card.wc.assists}A`;

/**
 * The Golazo card face. Rarity drives the frame via [data-rarity] CSS.
 * Renders as a <button> when clickable (squad picking), else a <div>.
 */
export default function PlayerCard({ card, count = 1, onClick, selected = false, compact = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`player-card${selected ? ' selected' : ''}${compact ? ' compact' : ''}`}
      data-rarity={card.rarity}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
    >
      <div className="pc-top">
        <span className="pc-overall">{card.overall}</span>
        <span className="pc-pos">{card.pos}</span>
        <span className="pc-flag" role="img" aria-label={card.nation}>
          {card.flag}
        </span>
      </div>
      {!compact && (
        <div className="pc-art">
          <img
            src={artFor(card)}
            alt=""
            loading="lazy"
            onError={(e) => {
              // Manifest lists it but the file 404s → fall back to archetype.
              const t = e.currentTarget;
              if (!t.dataset.fallback) {
                t.dataset.fallback = '1';
                t.src = POSITION_ART[card.pos];
              }
            }}
          />
        </div>
      )}
      <div className="pc-name">{card.name}</div>
      {!compact && (
        <>
          <div className="pc-stats">
            {STAT_LABELS.map(([key, label]) => (
              <div key={key} className="pc-stat">
                <span>{label}</span>
                <strong>{card.stats[key]}</strong>
              </div>
            ))}
          </div>
          <div className="pc-wc">{wcLine(card)}</div>
        </>
      )}
      <div className="pc-rarity">{card.rarity}</div>
      {count > 1 && <div className="pc-count">×{count}</div>}
    </Tag>
  );
}
