import React from 'react';
import { EDITIONS } from '../game/editions.js';

/** Switch the active card edition (each is a separate collection + game). */
export default function EditionSwitcher({ editionId, onChange }) {
  return (
    <div className="edition-switcher" role="group" aria-label="Card edition">
      {EDITIONS.map((e) => (
        <button
          key={e.id}
          className={e.id === editionId ? 'edition-tab active' : 'edition-tab'}
          onClick={() => onChange(e.id)}
          title={e.tagline}
        >
          {e.short}
        </button>
      ))}
    </div>
  );
}
