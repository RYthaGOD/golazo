#!/usr/bin/env node
/**
 * Generate one image prompt per World Cup 2026 card for batch image
 * generation (Gemini, etc). Writes card-prompts.jsonl at the repo root, one
 * JSON object per line:
 *
 *   { id, file, name, nation, pos, rarity, overall, prompt }
 *
 * `file` is the target filename (`<card-id>.png`). Save each generated image
 * to public/cards/players/<file>, then run scripts/gen-card-art-manifest.mjs
 * so the app picks them up.
 *
 * The art is a DISTINCT ORIGINAL CHARACTER per player — no real likeness.
 * Look (hair, build, complexion) is seeded deterministically from the card id
 * so a given player always regenerates the same character; nation drives the
 * kit palette, position drives the action, rarity drives the aura.
 *
 *   node scripts/gen-card-prompts.mjs
 */
import { writeFileSync } from 'node:fs';
import { PLAYERS } from '../src/game/players2026.js';

const HAIR_COLORS = ['black', 'dark brown', 'brown', 'blond', 'sandy blond', 'auburn', 'jet black', 'silver-grey', 'teal-streaked', 'copper red'];
const HAIR_STYLES = ['short cropped', 'buzz cut', 'tight curls', 'a high afro', 'a man-bun', 'slicked-back', 'a messy fringe', 'a mohawk', 'braided cornrows', 'long flowing hair'];
const BUILDS = ['lean and wiry', 'tall and rangy', 'stocky and powerful', 'agile and compact', 'broad-shouldered and strong'];
const COMPLEXIONS = ['fair', 'light', 'tan', 'olive', 'light-brown', 'brown', 'deep brown'];
const FACIAL = ['clean-shaven', 'clean-shaven', 'a short stubble beard', 'a neat goatee', 'clean-shaven', 'a light beard'];

// Nation → generic two-colour kit palette (inspired by, not copies of, real
// kits; no crests or official marks are ever reproduced).
const KIT = {
  Portugal: 'deep crimson with forest-green trim',
  Spain: 'scarlet red with gold trim',
  Canada: 'bold red with white trim',
  France: 'royal blue with white trim',
  Mexico: 'emerald green with white and red accents',
  'New Zealand': 'all white with black trim',
  Jordan: 'white with a crimson sash',
  Croatia: 'red-and-white checked accents on white',
  Paraguay: 'red-and-white vertical stripes',
  Australia: 'gold with green trim',
  Uruguay: 'sky blue with white trim',
  'Cape Verde': 'blue and white with a red band',
  Tunisia: 'red with white trim',
  Netherlands: 'bright orange with black trim',
  Germany: 'white with a black and charcoal pattern',
  'Ivory Coast': 'bright orange with green trim',
  'South Korea': 'red with navy trim',
  Egypt: 'red with white and black accents',
  Algeria: 'white with green trim',
  Ghana: 'white with red, gold and green accents',
  Norway: 'red with navy and white trim',
  Qatar: 'deep maroon with white trim',
  Uzbekistan: 'white with sky-blue trim',
  'Saudi Arabia': 'white with green trim',
};

const ACTION = {
  GK: 'an original fictional goalkeeper character diving full-stretch to tip a shot away, outstretched gloves, intense focus',
  DEF: 'an original fictional defender character committing to a perfectly-timed sliding tackle, turf spraying up',
  MID: 'an original fictional midfielder character driving a powerful long pass, the ball blurring off the boot',
  FWD: 'an original fictional forward character unleashing a spectacular strike, the ball trailing a streak of fire',
};

const AURA = {
  COMMON: 'clean flat cel-shading with crisp linework, no aura',
  RARE: 'a faint blue energy glow tracing the character',
  ELITE: 'a vivid purple energy aura with dynamic speed streaks',
  LEGEND: 'a radiant golden aura with dramatic god-rays and drifting embers, epic hero framing',
};

const pick = (arr, seed) => arr[seed % arr.length];

const promptFor = (c) => {
  const n = Number(String(c.id).split('-')[1]) || 0;
  const hair = `${pick(HAIR_STYLES, Math.floor(n / 3))} ${pick(HAIR_COLORS, n)} hair`;
  const build = pick(BUILDS, Math.floor(n / 13));
  const complexion = pick(COMPLEXIONS, Math.floor(n / 17));
  const facial = pick(FACIAL, Math.floor(n / 23));
  const kit = KIT[c.nation] || 'green with white trim';
  return (
    `Cel-shaded anime illustration in dynamic sports manga style: ${ACTION[c.pos]}. ` +
    `${complexion} complexion, ${hair}, ${facial}, ${build} build. ` +
    `Wearing a plain ${kit} soccer kit with NO logos, numbers, crests, or text. ` +
    `${AURA[c.rarity]}. Stadium floodlights at night, vibrant saturated colours, ` +
    `full-body dynamic action pose, character centered, vertical 3:4 trading-card composition. ` +
    `Original character, not based on any real person.`
  );
};

const lines = PLAYERS.map((c) =>
  JSON.stringify({
    id: c.id,
    file: `${c.id}.png`,
    name: c.name,
    nation: c.nation,
    pos: c.pos,
    rarity: c.rarity,
    overall: c.overall,
    prompt: promptFor(c),
  }),
);

writeFileSync('card-prompts.jsonl', lines.join('\n') + '\n');

const byRarity = { COMMON: 0, RARE: 0, ELITE: 0, LEGEND: 0 };
for (const c of PLAYERS) byRarity[c.rarity]++;
console.error(`wrote card-prompts.jsonl — ${PLAYERS.length} prompts ${JSON.stringify(byRarity)}`);
console.error('\nsamples:');
for (const tier of ['LEGEND', 'ELITE', 'RARE', 'COMMON']) {
  const c = PLAYERS.find((p) => p.rarity === tier);
  const line = JSON.parse(lines[PLAYERS.indexOf(c)]);
  console.error(`\n[${tier}] ${line.file}  (${c.name}, ${c.nation}, ${c.pos})\n${line.prompt}`);
}
