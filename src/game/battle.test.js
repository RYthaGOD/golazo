import { describe, it, expect } from 'vitest';
import { validateSquad, simulateBattle, buildAiSquad, teamRatings, AI_TIERS } from './battle.js';
import { PLAYER_BY_ID } from './players.js';

const squad = (...ids) => ids.map((id) => {
  const card = PLAYER_BY_ID.get(id);
  if (!card) throw new Error(`unknown test card: ${id}`);
  return card;
});

const LEGENDS = squad('emi-martinez', 'gvardiol', 'van-dijk', 'modric', 'mbappe');
const COMMONS = squad('gonda', 'souttar', 'kim-young-gwon', 'mooy', 'weah');

describe('squad validation', () => {
  it('accepts a legal 1 GK / 1+ DEF / 1+ FWD squad', () => {
    expect(validateSquad(LEGENDS)).toEqual([]);
  });

  it('rejects wrong sizes, missing GK, double GK, missing DEF/FWD', () => {
    expect(validateSquad(LEGENDS.slice(0, 4)).length).toBeGreaterThan(0);
    expect(validateSquad(squad('gvardiol', 'van-dijk', 'modric', 'mbappe', 'messi')).length).toBeGreaterThan(0);
    expect(validateSquad(squad('emi-martinez', 'gonda', 'van-dijk', 'modric', 'mbappe')).length).toBeGreaterThan(0);
    expect(validateSquad(squad('emi-martinez', 'modric', 'kdb', 'pedri', 'mbappe')).length).toBeGreaterThan(0);
    expect(validateSquad(squad('emi-martinez', 'gvardiol', 'van-dijk', 'modric', 'kdb')).length).toBeGreaterThan(0);
  });
});

describe('battle simulator', () => {
  it('is deterministic for the same squads and seed', () => {
    const a = simulateBattle(LEGENDS, COMMONS, 'seed-1');
    const b = simulateBattle(LEGENDS, COMMONS, 'seed-1');
    expect(a.homeScore).toBe(b.homeScore);
    expect(a.awayScore).toBe(b.awayScore);
    expect(a.winner).toBe(b.winner);
    expect(a.log.map((l) => l.text)).toEqual(b.log.map((l) => l.text));
  });

  it('always produces a winner (draws settled on penalties)', () => {
    for (let i = 0; i < 60; i++) {
      const r = simulateBattle(LEGENDS, COMMONS, `w-${i}`);
      expect(['home', 'away']).toContain(r.winner);
      if (r.homeScore === r.awayScore) expect(r.wentToPens).toBe(true);
    }
  });

  it('shootout scores always justify the winner (no tied penalty results)', () => {
    // Mirror-match squads force frequent draws → shootouts, including marathons.
    for (let i = 0; i < 200; i++) {
      const r = simulateBattle(COMMONS, COMMONS, `pens-${i}`);
      if (!r.wentToPens) continue;
      const loser = r.winner === 'home' ? 'away' : 'home';
      expect(r.penScore[r.winner]).toBeGreaterThan(r.penScore[loser]);
    }
  });

  it('books a stronger squad as favourite: legends beat commons most of the time', () => {
    let legendWins = 0;
    for (let i = 0; i < 100; i++) {
      if (simulateBattle(LEGENDS, COMMONS, `fav-${i}`).winner === 'home') legendWins++;
    }
    expect(legendWins).toBeGreaterThan(65);
  });

  it('writes a play-by-play from kickoff to result', () => {
    const { log } = simulateBattle(LEGENDS, COMMONS, 'log-check');
    expect(log[0].type).toBe('KICKOFF');
    expect(log[log.length - 1].type).toBe('RESULT');
    expect(log.some((l) => l.type === 'HALF_TIME')).toBe(true);
    expect(log.some((l) => l.type === 'FULL_TIME')).toBe(true);
  });

  it('rates a legend squad above a common squad', () => {
    const strong = teamRatings(LEGENDS);
    const weak = teamRatings(COMMONS);
    expect(strong.attack).toBeGreaterThan(weak.attack);
    expect(strong.defense).toBeGreaterThan(weak.defense);
  });

  it('drafts legal AI squads for every tier, deterministically per seed', () => {
    for (const tier of Object.keys(AI_TIERS)) {
      const ai = buildAiSquad(tier, `ai-${tier}`);
      expect(validateSquad(ai)).toEqual([]);
      expect(buildAiSquad(tier, `ai-${tier}`).map((c) => c.id)).toEqual(ai.map((c) => c.id));
    }
  });
});
