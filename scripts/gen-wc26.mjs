#!/usr/bin/env node
/**
 * Generate the World Cup 2026 card edition from TxODDS TxLINE snapshots.
 *
 *   node scripts/gen-wc26.mjs [cacheDir]   (default .keys/wc26-cache)
 *
 * The cache holds one JSON snapshot per covered fixture. Refresh it from the
 * live feed (the credentials are wallet-gated, so this runs wherever the
 * TxLINE host is reachable):
 *
 *   for id in $(seq 17588180 17588290); do
 *     curl -sf -H "Authorization: Bearer $JWT" -H "X-Api-Token: $TOKEN" \
 *       "$ORIGIN/api/scores/snapshot/$id" -o .keys/wc26-cache/$id.json || true
 *   done
 *
 * Ratings are derived from REAL data in the feed — squad, position, starter
 * role, appearances, and team goals for/against — not from club form. Because
 * match snapshots don't retain individual goal scorers, attacking/defensive
 * quality is attributed at the team level and shaped by each player's role.
 * Re-run as the tournament progresses to update the edition.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { overallOf, rarityOf } from '../src/game/players.js';

const CACHE = process.argv[2] || '.keys/wc26-cache';
const POS = { 34: 'GK', 35: 'DEF', 36: 'MID', 37: 'FWD' };

const FLAGS = {
  Portugal: '🇵🇹', Spain: '🇪🇸', Canada: '🇨🇦', France: '🇫🇷', Mexico: '🇲🇽',
  'New Zealand': '🇳🇿', Jordan: '🇯🇴', Croatia: '🇭🇷', Paraguay: '🇵🇾', Australia: '🇦🇺',
  Uruguay: '🇺🇾', 'Cape Verde': '🇨🇻', Tunisia: '🇹🇳', Netherlands: '🇳🇱', Germany: '🇩🇪',
  'Ivory Coast': '🇨🇮', 'South Korea': '🇰🇷', Egypt: '🇪🇬', Algeria: '🇩🇿', Ghana: '🇬🇭',
  Norway: '🇳🇴', Qatar: '🇶🇦', Uzbekistan: '🇺🇿', 'Saudi Arabia': '🇸🇦',
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));

// "Surname, Given" → "Given Surname"; leave single-token names as-is.
const formatName = (raw) => {
  const [surname, given] = raw.split(',').map((s) => s.trim());
  return given ? `${given} ${surname}` : surname;
};

// ── Ingest snapshots ────────────────────────────────────────
const players = new Map(); // normativeId -> record
const teams = new Map(); // nation -> { m, gf, ga }
const bumpTeam = (n, gf, ga) => {
  const t = teams.get(n) || { m: 0, gf: 0, ga: 0 };
  t.m++; t.gf += gf; t.ga += ga;
  teams.set(n, t);
};

const files = readdirSync(CACHE).filter((f) => f.endsWith('.json'));
for (const f of files) {
  const events = JSON.parse(readFileSync(`${CACHE}/${f}`, 'utf8'));
  let lineups = null;
  const last = events[events.length - 1];
  for (const e of events) if (Array.isArray(e.Lineups)) lineups = e.Lineups;
  if (!lineups || lineups.length < 2) continue;

  const g1 = last.Score?.Participant1?.Total?.Goals ?? 0;
  const g2 = last.Score?.Participant2?.Total?.Goals ?? 0;
  bumpTeam(lineups[0].preferredName, g1, g2);
  bumpTeam(lineups[1].preferredName, g2, g1);

  for (const team of lineups) {
    for (const p of team.lineups || []) {
      const id = p.player?.normativeId;
      if (!id || !POS[p.positionId]) continue;
      if (!players.has(id)) {
        players.set(id, {
          id,
          name: formatName(p.player.preferredName),
          nation: team.preferredName,
          pos: POS[p.positionId],
          rn: Number(p.rosterNumber) || 99,
          apps: 0,
          starts: 0,
        });
      }
      const r = players.get(id);
      r.apps++;
      if (p.starter) r.starts++;
    }
  }
}

// ── Team strength factors (coarse but real: goals for/against) ──
const teamFactor = (nation) => {
  const t = teams.get(nation) || { m: 1, gf: 0, ga: 0 };
  const m = Math.max(1, t.m);
  return {
    atk: clamp((t.gf / m / 3) * 100, 0, 120) / 100, // 0..1.2
    def: clamp((1 - t.ga / m / 3) * 100, -40, 100) / 100, // -0.4..1
  };
};

// ── Role rank within nation+position (first choice rated higher) ──
const byNationPos = new Map();
for (const p of players.values()) {
  const key = `${p.nation}|${p.pos}`;
  (byNationPos.get(key) || byNationPos.set(key, []).get(key)).push(p);
}
for (const group of byNationPos.values()) {
  group.sort((a, b) => b.starts - a.starts || b.apps - a.apps || a.rn - b.rn);
  group.forEach((p, i) => (p.rank = i));
}

// ── Derive stats ────────────────────────────────────────────
const build = (p) => {
  const { atk, def } = teamFactor(p.nation);
  const role = Math.max(0, 10 - p.rank * 2.5); // 0..10, first choice highest
  const start = p.starts >= 1 ? 6 : 0;
  const j = (p.id % 7) - 3; // deterministic per-player texture, -3..3
  let att; let pas; let dfn; let phy;

  if (p.pos === 'GK') {
    att = 24; pas = 52 + 6 * atk; dfn = 60 + 16 * def + role + start + j; phy = 68 + 6 * def;
  } else if (p.pos === 'DEF') {
    att = 44 + 12 * atk; pas = 56 + 10 * atk + 0.4 * role; dfn = 58 + 16 * def + role + start + j; phy = 64 + 8 * def + 0.3 * role;
  } else if (p.pos === 'MID') {
    att = 54 + 20 * atk + 0.5 * role; pas = 60 + 18 * atk + role + start + j; dfn = 54 + 12 * def; phy = 64 + 6 * atk;
  } else {
    att = 60 + 24 * atk + role + start + j; pas = 56 + 12 * atk + 0.4 * role; dfn = 34 + 8 * def; phy = 68 + 8 * atk;
  }

  const stats = { att: clamp(att, 40, 97), pas: clamp(pas, 40, 97), def: clamp(dfn, 20, 97), phy: clamp(phy, 45, 97) };
  const card = {
    id: `wc26-${p.id}`,
    name: p.name,
    nation: p.nation,
    flag: FLAGS[p.nation] || '🌍',
    pos: p.pos,
    stats,
    wc: { apps: p.apps, starts: p.starts, goals: 0, assists: 0 },
  };
  card.overall = overallOf(card);
  card.rarity = rarityOf(card.overall);
  return card;
};

const cards = [...players.values()].map(build).sort((a, b) => b.overall - a.overall);

// ── Report ──────────────────────────────────────────────────
const dist = { COMMON: 0, RARE: 0, ELITE: 0, LEGEND: 0 };
for (const c of cards) dist[c.rarity]++;
const posCount = {};
for (const c of cards) posCount[c.pos] = (posCount[c.pos] || 0) + 1;
console.error(`cards: ${cards.length} | ${JSON.stringify(dist)} | pos ${JSON.stringify(posCount)}`);
console.error('top 12:');
for (const c of cards.slice(0, 12)) console.error(`  ${c.overall} ${c.rarity.padEnd(6)} ${c.pos} ${c.name} (${c.nation})`);

// ── Emit players2026.js ─────────────────────────────────────
const header = `// GENERATED by scripts/gen-wc26.mjs from TxODDS TxLINE snapshots — do not edit by hand.
// World Cup 2026 edition. Ratings derive from real squad/position/role and
// team goals for-against in the covered fixtures; re-run the generator to
// update as the tournament progresses. Frozen once packs are minted (see
// packs.js): a refreshed set should ship as a new edition/deployment.
`;
const body =
  'export const PLAYERS = [\n' +
  cards
    .map(
      (c) =>
        `  { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)}, nation: ${JSON.stringify(c.nation)}, flag: ${JSON.stringify(c.flag)}, pos: ${JSON.stringify(c.pos)}, stats: { att: ${c.stats.att}, pas: ${c.stats.pas}, def: ${c.stats.def}, phy: ${c.stats.phy} }, wc: { apps: ${c.wc.apps}, starts: ${c.wc.starts}, goals: 0, assists: 0 }, overall: ${c.overall}, rarity: ${JSON.stringify(c.rarity)} },`,
    )
    .join('\n') +
  '\n];\n';

writeFileSync('src/game/players2026.js', `${header}\n${body}`);
console.error('\nwrote src/game/players2026.js');
