import { PLAYERS } from './players.js';
import { createRng } from './packs.js';

/**
 * 5v5 fantasy battle simulator. Pure and deterministic: the same two squads
 * and seed always produce the same match on a given JS engine. (Ratings use
 * floating-point math incl. Math.pow, which ECMA-262 does not require to be
 * bit-identical across engines — treat results as locally deterministic, not
 * a cross-client consensus artifact.)
 *
 * A squad is 5 cards: exactly 1 GK, at least 1 DEF and 1 FWD (2 flex slots).
 * Team ratings blend the cards' stats by position, then ~a dozen chances are
 * simulated across 90 minutes with a play-by-play log. Draws go to penalties.
 */

export const SQUAD_SIZE = 5;

/** Returns a list of problems; an empty list means the squad is legal. */
export function validateSquad(cards) {
  const problems = [];
  if (cards.length !== SQUAD_SIZE) problems.push(`Squad must have exactly ${SQUAD_SIZE} players.`);
  const count = (pos) => cards.filter((c) => c.pos === pos).length;
  if (count('GK') !== 1) problems.push('Squad needs exactly 1 goalkeeper.');
  if (count('DEF') < 1) problems.push('Squad needs at least 1 defender.');
  if (count('FWD') < 1) problems.push('Squad needs at least 1 forward.');
  if (new Set(cards.map((c) => c.id)).size !== cards.length) problems.push('Squad has duplicate players.');
  return problems;
}

const weightedAvg = (cards, stat, weights) => {
  let sum = 0;
  let wsum = 0;
  for (const c of cards) {
    const w = weights[c.pos] ?? 0;
    sum += c.stats[stat] * w;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : 0;
};

export function teamRatings(cards) {
  const gk = cards.find((c) => c.pos === 'GK');
  const outfield = cards.filter((c) => c.pos !== 'GK');
  const attack =
    0.75 * weightedAvg(outfield, 'att', { FWD: 1, MID: 0.65, DEF: 0.25 }) +
    0.25 * (outfield.reduce((s, c) => s + c.stats.pas, 0) / outfield.length);
  const midfield = weightedAvg(cards, 'pas', { MID: 1, FWD: 0.6, DEF: 0.6, GK: 0.2 });
  const defense =
    0.65 * weightedAvg(outfield, 'def', { DEF: 1, MID: 0.55, FWD: 0.15 }) + 0.35 * (gk?.stats.def ?? 40);
  return { attack, midfield, defense };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const pickWeighted = (rng, entries) => {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [item, w] of entries) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return entries[entries.length - 1][0];
};

const SCORER_POS_WEIGHT = { FWD: 1.5, MID: 1, DEF: 0.45 };

const pickScorer = (rng, cards) =>
  pickWeighted(
    rng,
    cards
      .filter((c) => c.pos !== 'GK')
      .map((c) => [c, Math.pow(c.stats.att, 2) * (SCORER_POS_WEIGHT[c.pos] ?? 1)]),
  );

const pickAssister = (rng, cards, scorer) => {
  const others = cards.filter((c) => c.pos !== 'GK' && c.id !== scorer.id);
  return others.length ? pickWeighted(rng, others.map((c) => [c, Math.pow(c.stats.pas, 2)])) : null;
};

const GOAL_LINES = [
  (s) => `GOLAZO! ${s} buries it in the top corner!`,
  (s) => `${s} finishes coolly — the net ripples!`,
  (s) => `${s} smashes it home! The keeper had no chance.`,
  (s) => `A clinical strike from ${s}!`,
];
const SAVE_LINES = [
  (gk, s) => `${gk} claws away a rocket from ${s}!`,
  (gk, s) => `Huge save! ${gk} denies ${s} point-blank.`,
  (gk, s) => `${s} is through... but ${gk} stands tall and wins the duel.`,
];
const MISS_LINES = [
  (s) => `${s} blazes it over the bar!`,
  (s) => `${s}'s effort whistles past the post.`,
  (s) => `Last-ditch block! ${s}'s shot is smothered.`,
];

/**
 * Simulate a battle. `home`/`away` are arrays of 5 card objects.
 * Returns { homeScore, awayScore, winner, wentToPens, penScore, log, mvp, ratings }.
 */
export function simulateBattle(home, away, seed, names = { home: 'HOME', away: 'AWAY' }) {
  for (const [label, squad] of [['home', home], ['away', away]]) {
    const problems = validateSquad(squad);
    if (problems.length) throw new Error(`Invalid ${label} squad: ${problems.join(' ')}`);
  }

  const rng = createRng(seed);
  const ratings = { home: teamRatings(home), away: teamRatings(away) };
  const squads = { home, away };
  const contributions = new Map(); // card id -> mvp points
  const credit = (card, pts) => contributions.set(card.id, (contributions.get(card.id) ?? 0) + pts);

  const log = [{ minute: 0, side: null, type: 'KICKOFF', text: `Kickoff! ${names.home} vs ${names.away}.` }];
  let homeScore = 0;
  let awayScore = 0;

  // ~10–13 chances spread across the match, split by midfield control.
  const chanceCount = 10 + Math.floor(rng() * 4);
  const minutes = Array.from({ length: chanceCount }, () => 2 + Math.floor(rng() * 88)).sort((a, b) => a - b);
  const hm = Math.pow(ratings.home.midfield, 1.6);
  const am = Math.pow(ratings.away.midfield, 1.6);

  let halfLogged = false;
  for (const minute of minutes) {
    if (!halfLogged && minute > 45) {
      log.push({ minute: 45, side: null, type: 'HALF_TIME', text: `Half-time: ${names.home} ${homeScore}–${awayScore} ${names.away}.` });
      halfLogged = true;
    }
    const side = rng() < hm / (hm + am) ? 'home' : 'away';
    const other = side === 'home' ? 'away' : 'home';
    const attackers = squads[side];
    const defGk = squads[other].find((c) => c.pos === 'GK');

    const pGoal = clamp(0.3 + (ratings[side].attack - ratings[other].defense) / 90, 0.08, 0.58);
    if (rng() < pGoal) {
      const scorer = pickScorer(rng, attackers);
      const assister = rng() < 0.65 ? pickAssister(rng, attackers, scorer) : null;
      if (side === 'home') homeScore++;
      else awayScore++;
      credit(scorer, 3);
      if (assister) credit(assister, 1.5);
      const line = GOAL_LINES[Math.floor(rng() * GOAL_LINES.length)](scorer.name);
      log.push({
        minute,
        side,
        type: 'GOAL',
        text: `${line}${assister ? ` Assisted by ${assister.name}.` : ''} ${names.home} ${homeScore}–${awayScore} ${names.away}.`,
      });
    } else {
      const shooter = pickScorer(rng, attackers);
      if (rng() < 0.55) {
        credit(defGk, 0.8);
        log.push({ minute, side, type: 'SAVE', text: SAVE_LINES[Math.floor(rng() * SAVE_LINES.length)](defGk.name, shooter.name) });
      } else {
        log.push({ minute, side, type: 'CHANCE', text: MISS_LINES[Math.floor(rng() * MISS_LINES.length)](shooter.name) });
      }
    }
  }
  if (!halfLogged) {
    log.push({ minute: 45, side: null, type: 'HALF_TIME', text: `Half-time: ${names.home} ${homeScore}–${awayScore} ${names.away}.` });
  }
  log.push({ minute: 90, side: null, type: 'FULL_TIME', text: `Full time: ${names.home} ${homeScore}–${awayScore} ${names.away}.` });

  // Draws are settled on penalties — every battle has a winner.
  let winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : null;
  let wentToPens = false;
  let penScore = null;
  if (!winner) {
    wentToPens = true;
    log.push({ minute: 90, side: null, type: 'PENS', text: 'Deadlock! The battle goes to a penalty shootout.' });
    const takers = {
      home: home.filter((c) => c.pos !== 'GK').sort((a, b) => b.stats.att - a.stats.att),
      away: away.filter((c) => c.pos !== 'GK').sort((a, b) => b.stats.att - a.stats.att),
    };
    const keepers = { home: home.find((c) => c.pos === 'GK'), away: away.find((c) => c.pos === 'GK') };
    let hp = 0;
    let ap = 0;
    for (let round = 0; round < 10 && !winner; round++) {
      for (const side of ['home', 'away']) {
        const other = side === 'home' ? 'away' : 'home';
        const kicker = takers[side][round % takers[side].length];
        const pScore = clamp(0.62 + (kicker.stats.att - keepers[other].stats.def) / 150, 0.35, 0.92);
        if (rng() < pScore) {
          if (side === 'home') hp++;
          else ap++;
          credit(kicker, 0.5);
          log.push({ minute: 90, side, type: 'PEN_GOAL', text: `${kicker.name} converts. ${hp}–${ap}.` });
        } else {
          credit(keepers[other], 1);
          log.push({ minute: 90, side, type: 'PEN_MISS', text: `${keepers[other].name} SAVES ${kicker.name}'s penalty! ${hp}–${ap}.` });
        }
      }
      // Decide after each completed pair from round 5 (best-of-five, then sudden death).
      if (round >= 4 && hp !== ap) winner = hp > ap ? 'home' : 'away';
    }
    if (!winner) {
      // Marathon shootout still level after 10 rounds: settle it with one
      // decisive sudden-death kick, so the recorded penalty score always
      // justifies the winner (never "wins 8–8 on penalties").
      winner = rng() < 0.5 ? 'home' : 'away';
      if (winner === 'home') hp++;
      else ap++;
      const hero = takers[winner][0];
      credit(hero, 0.5);
      log.push({ minute: 90, side: winner, type: 'PEN_GOAL', text: `${hero.name} buries the decisive sudden-death kick! ${hp}–${ap}.` });
    }
    penScore = { home: hp, away: ap };
  }

  const all = [...home.map((c) => ['home', c]), ...away.map((c) => ['away', c])];
  const [mvpSide, mvpCard] = all.reduce(
    (best, cur) => ((contributions.get(cur[1].id) ?? 0) > (contributions.get(best[1].id) ?? 0) ? cur : best),
    all[0],
  );

  log.push({
    minute: 90,
    side: winner,
    type: 'RESULT',
    text: `${names[winner]} wins${wentToPens ? ` ${penScore[winner === 'home' ? 'home' : 'away']}–${penScore[winner === 'home' ? 'away' : 'home']} on penalties` : ''}! MVP: ${mvpCard.name}.`,
  });

  return {
    homeScore,
    awayScore,
    winner,
    wentToPens,
    penScore,
    log,
    mvp: { id: mvpCard.id, name: mvpCard.name, side: mvpSide },
    ratings,
  };
}

/** Opponent tiers for the arena: which rarity pools the AI drafts from. */
export const AI_TIERS = {
  amateur: { label: 'Sunday League', rarities: ['COMMON', 'RARE'] },
  pro: { label: 'Pro Circuit', rarities: ['RARE', 'ELITE'] },
  world: { label: 'World Class', rarities: ['ELITE', 'LEGEND', 'RARE'] },
};

/** Draft a legal 5-card AI squad from a tier's rarity pools (seeded). */
export function buildAiSquad(tier, seed) {
  const rng = createRng(seed);
  const { rarities } = AI_TIERS[tier] ?? AI_TIERS.amateur;
  const pool = PLAYERS.filter((p) => rarities.includes(p.rarity));
  const draft = (pos, taken) => {
    const candidates = pool.filter((p) => p.pos === pos && !taken.has(p.id));
    const fallback = PLAYERS.filter((p) => p.pos === pos && !taken.has(p.id));
    const from = candidates.length ? candidates : fallback;
    return from[Math.floor(rng() * from.length)];
  };
  const shape = rng() < 0.5 ? ['GK', 'DEF', 'DEF', 'MID', 'FWD'] : ['GK', 'DEF', 'MID', 'FWD', 'FWD'];
  const taken = new Set();
  const squad = [];
  for (const pos of shape) {
    const card = draft(pos, taken);
    taken.add(card.id);
    squad.push(card);
  }
  return squad;
}
