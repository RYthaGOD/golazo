/**
 * Golazo data service — a thin proxy over TxODDS TxLINE, the app's sole
 * source of match data. TxLINE access is wallet-gated (the API token and
 * guest JWT come from an on-chain subscription), so the credentials live
 * here, server-side, never in the browser bundle.
 *
 * Zero dependencies: node:http + global fetch.
 *
 *   GET /api/health  → { ok, source, fixtures }
 *   GET /api/live    → [{ fixtureId, home, away, homeGoals, awayGoals,
 *                         status, minute, startTime }]
 *
 * Credentials (first match wins, so secrets never sit on a command line):
 *   TXLINE_SESSION_JSON — the activated-session JSON as a string
 *   TXLINE_SESSION_FILE — path to the activated-session JSON file
 *   TXLINE_JWT + TXLINE_API_TOKEN — raw values
 * Other env: TXLINE_API_ORIGIN, TXLINE_FIXTURE_RANGE ("first-last" id scan
 * window), CORS_ORIGIN, PORT.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';

function loadSession() {
  try {
    const raw = process.env.TXLINE_SESSION_JSON
      ? process.env.TXLINE_SESSION_JSON
      : process.env.TXLINE_SESSION_FILE
        ? readFileSync(process.env.TXLINE_SESSION_FILE, 'utf8')
        : null;
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('[txline] could not read session:', e.message);
    return {};
  }
}
const session = loadSession();

const PORT = Number(process.env.PORT || 8787);
const ORIGIN = process.env.TXLINE_API_ORIGIN || session.apiOrigin || 'https://txline-dev.txodds.com';
const JWT = process.env.TXLINE_JWT || session.jwt || '';
const TOKEN = process.env.TXLINE_API_TOKEN || session.apiToken || '';
const CORS = process.env.CORS_ORIGIN || '*';
const [RANGE_FROM, RANGE_TO] = (process.env.TXLINE_FIXTURE_RANGE || '17588180-17588290')
  .split('-')
  .map(Number);

const CONFIGURED = Boolean(JWT && TOKEN);
const LIVE_TTL_MS = 60_000;
// The covered-fixture set is fixed by the subscription — rescan rarely.
const DISCOVER_TTL_MS = 6 * 3600_000;
const CONCURRENCY = 4;

const authHeaders = {
  Authorization: `Bearer ${JWT}`,
  'X-Api-Token': TOKEN,
  Accept: 'application/json',
};

async function fetchSnapshot(fixtureId) {
  const res = await fetch(`${ORIGIN}/api/scores/snapshot/${fixtureId}`, { headers: authHeaders });
  if (!res.ok) return null;
  return res.json();
}

/** Run `fn` over items with a small concurrency cap. */
async function mapLimited(items, fn) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]).catch(() => null);
      }
    }),
  );
  return results;
}

/** Reduce a TxLINE event stream to one scoreboard row. */
function summarize(fixtureId, events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  const last = events[events.length - 1];

  let home = null;
  let away = null;
  for (const e of events) {
    if (Array.isArray(e.Lineups) && e.Lineups.length >= 2) {
      const names = e.Lineups.map((t) => t.preferredName).filter(Boolean);
      if (names.length >= 2) [home, away] = names;
    }
  }
  if (!home || !away) return null; // nameless fixtures aren't presentable

  const goals = (side) => last.Score?.[side]?.Total?.Goals ?? 0;
  const clockSeconds = last.Clock?.Seconds ?? 0;
  const running = Boolean(last.Clock?.Running);
  const startTime = last.StartTime;
  const now = Date.now();

  let status = 'UPCOMING';
  if (now >= startTime) status = running && now - startTime < 3 * 3600_000 ? 'LIVE' : 'FT';

  return {
    fixtureId,
    home,
    away,
    homeGoals: goals('Participant1'),
    awayGoals: goals('Participant2'),
    status,
    minute: Math.min(120, Math.floor(clockSeconds / 60)),
    startTime,
  };
}

let coveredIds = [];
let coveredAt = 0;
let refreshedAt = 0;
// Last good row per fixture: a throttled or failed upstream read must never
// shrink the scoreboard — stale beats missing for finished matches.
const rowsByFixture = new Map();

async function discover() {
  const ids = [];
  for (let id = RANGE_FROM; id <= RANGE_TO; id++) ids.push(id);
  const hits = await mapLimited(ids, async (id) => ((await fetchSnapshot(id)) ? id : null));
  const found = hits.filter(Boolean);
  if (found.length > 0) {
    coveredIds = found;
    coveredAt = Date.now();
  }
  console.log(`[txline] discovery: ${found.length} covered fixtures in ${RANGE_FROM}-${RANGE_TO}`);
}

async function liveRows() {
  if (Date.now() - refreshedAt >= LIVE_TTL_MS) {
    refreshedAt = Date.now();
    if (Date.now() - coveredAt > DISCOVER_TTL_MS) await discover();
    const snaps = await mapLimited(coveredIds, async (id) => summarize(id, await fetchSnapshot(id)));
    for (const row of snaps) if (row) rowsByFixture.set(row.fixtureId, row);
  }
  return [...rowsByFixture.values()].sort((a, b) => b.startTime - a.startTime);
}

const json = (res, code, body) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS,
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const path = new URL(req.url, `http://${req.headers.host}`).pathname;
    try {
      if (path === '/api/health') {
        return json(res, 200, {
          ok: true,
          source: CONFIGURED ? 'TxODDS TxLINE' : 'unconfigured',
          fixtures: coveredIds.length,
        });
      }
      if (path === '/api/live') {
        if (!CONFIGURED) return json(res, 200, []);
        return json(res, 200, await liveRows());
      }
      return json(res, 404, { error: 'not found' });
    } catch (e) {
      return json(res, 502, { error: e?.message || 'upstream failure' });
    }
  })
  .listen(PORT, () => {
    console.log(`golazo data service on :${PORT} (txline ${CONFIGURED ? 'configured' : 'NOT configured'})`);
    if (CONFIGURED) discover().catch((e) => console.error('[txline] discovery failed:', e.message));
  });
