import React, { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { DATA_API_URL } from '../config.js';

const POLL_MS = 60_000;

const kickoff = (ts) =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * World Cup match center. All data comes from TxODDS TxLINE via the Golazo
 * data service — scores, teams, and match clocks are read from the same
 * wallet-gated feed, nothing else.
 */
export default function LiveScores() {
  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${DATA_API_URL}/api/live`);
        if (!res.ok) throw new Error(`data service responded ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not reach the data service.');
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 className="text-gradient section-title">
          <Radio size={18} /> WORLD CUP MATCH CENTER
        </h2>
        <span className="pill">DATA: TXODDS TXLINE</span>
      </div>

      {error && (
        <div role="alert" className="error-note">
          {error}
        </div>
      )}

      {rows === null && !error && (
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1, fontSize: 13 }}>
          FETCHING MATCHES…
        </p>
      )}

      {rows?.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>No covered fixtures right now — check back soon.</p>
      )}

      {rows?.length > 0 && (
        <div className="live-list">
          {rows.map((m) => (
            <div key={m.fixtureId} className={`live-row${m.status === 'LIVE' ? ' is-live' : ''}`}>
              <span className={`live-status live-${m.status.toLowerCase()}`}>
                {m.status === 'LIVE' ? `${m.minute}'` : m.status}
              </span>
              <span className="live-team home">{m.home}</span>
              <span className="live-score">
                {m.status === 'UPCOMING' ? 'vs' : `${m.homeGoals} – ${m.awayGoals}`}
              </span>
              <span className="live-team away">{m.away}</span>
              <span className="live-kickoff">{kickoff(m.startTime)}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
        Match data is served exclusively by TxODDS TxLINE (wallet-gated World Cup feed, ~60s delay).
      </p>
    </div>
  );
}
