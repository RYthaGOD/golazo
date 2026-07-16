import React, { useState, useEffect } from 'react';
import { DATA_API_URL } from '../config.js';

const POLL_MS = 60_000;

const kickoff = (ts) =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * World Cup results, straight from the TxODDS TxLINE feed via the Golazo data
 * service — the same wallet-gated data the WC26 cards are rated from. The
 * dev-tier feed exposes the 2026 group stage (all played), so rows show as FT;
 * a fixture inside its play window would badge LIVE automatically.
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

  const liveCount = rows?.filter((m) => m.status === 'LIVE').length ?? 0;

  return (
    <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="section-head">
        <span className="eyebrow">
          {rows ? `${rows.length} fixtures` : 'Loading'}
          {liveCount > 0 && ` · ${liveCount} live`}
        </span>
        <span className="pill">
          {liveCount > 0 && <span className="dot live" />}
          Data · TxODDS TxLINE
        </span>
      </div>

      {error && (
        <div role="alert" className="error-note">
          {error}
        </div>
      )}

      {rows === null && !error && <p className="empty-note">Fetching matches…</p>}

      {rows?.length === 0 && <p className="empty-note">No fixtures in the covered feed right now.</p>}

      {rows?.length > 0 && (
        <div className="live-list">
          {rows.map((m) => (
            <div key={m.fixtureId} className={`live-row${m.status === 'LIVE' ? ' is-live' : ''}`}>
              <span className={`live-status live-${m.status.toLowerCase()}`}>
                {m.status === 'LIVE' ? `${m.minute}'` : m.status}
              </span>
              <span className="live-team home">{m.home}</span>
              <span className="live-score">
                {m.status === 'UPCOMING' ? 'vs' : `${m.homeGoals}–${m.awayGoals}`}
              </span>
              <span className="live-team away">{m.away}</span>
              <span className="live-kickoff">{kickoff(m.startTime)}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--muted-2)', lineHeight: 1.6 }}>
        Real World Cup 2026 results from the TxODDS TxLINE feed (wallet-gated) — the same data the WC26
        cards are rated from.
      </p>
    </div>
  );
}
