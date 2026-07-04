/**
 * Golazo card database — World Cup 2022 edition.
 *
 * Every card is a real player rated from their actual WC 2022 tournament:
 * `wc` holds their real tournament line (appearances / goals / assists,
 * curated from public match records) and the four ability stats are derived
 * from that performance, not club form. Ratings are 1–99.
 *
 *   att — finishing & chance creation        pas — passing & control
 *   def — tackling/positioning (GK: saves)   phy — pace, duels, stamina
 *
 * `overall` and `rarity` are COMPUTED from the stats (position-weighted), so
 * the tiers are emergent: LEGEND ≥ 86, ELITE 80–85, RARE 73–79, COMMON < 73.
 *
 * ⚠ FROZEN EDITION (WC22): on-chain packs re-derive their cards from this
 * file. Adding, removing, reordering, or re-rating players changes rarity
 * pools and therefore silently rewrites every already-purchased pack. Ship
 * changes as a NEW edition (see note in packs.js), not by editing this list.
 */

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

export const RARITIES = ['COMMON', 'RARE', 'ELITE', 'LEGEND'];

/** Position-specific weights for the overall rating. */
const OVERALL_WEIGHTS = {
  GK: { att: 0, pas: 0.15, def: 0.7, phy: 0.15 },
  DEF: { att: 0.08, pas: 0.14, def: 0.6, phy: 0.18 },
  MID: { att: 0.22, pas: 0.5, def: 0.14, phy: 0.14 },
  FWD: { att: 0.6, pas: 0.22, def: 0.06, phy: 0.12 },
};

export function overallOf({ pos, stats }) {
  const w = OVERALL_WEIGHTS[pos];
  return Math.round(stats.att * w.att + stats.pas * w.pas + stats.def * w.def + stats.phy * w.phy);
}

export function rarityOf(overall) {
  if (overall >= 86) return 'LEGEND';
  if (overall >= 80) return 'ELITE';
  if (overall >= 73) return 'RARE';
  return 'COMMON';
}

const P = (id, name, nation, flag, pos, att, pas, def, phy, apps, goals, assists) => {
  const card = { id, name, nation, flag, pos, stats: { att, pas, def, phy }, wc: { apps, goals, assists } };
  card.overall = overallOf(card);
  card.rarity = rarityOf(card.overall);
  return card;
};

export const PLAYERS = [
  // ── Goalkeepers ──────────────────────────────────────────────
  P('emi-martinez', 'Emiliano Martínez', 'Argentina', '🇦🇷', 'GK', 30, 62, 92, 84, 7, 0, 0),
  P('bounou', 'Yassine Bounou', 'Morocco', '🇲🇦', 'GK', 28, 64, 90, 80, 6, 0, 0),
  P('livakovic', 'Dominik Livaković', 'Croatia', '🇭🇷', 'GK', 26, 60, 88, 78, 7, 0, 0),
  P('szczesny', 'Wojciech Szczęsny', 'Poland', '🇵🇱', 'GK', 25, 58, 86, 76, 4, 0, 0),
  P('lloris', 'Hugo Lloris', 'France', '🇫🇷', 'GK', 25, 60, 84, 74, 7, 0, 0),
  P('alisson', 'Alisson Becker', 'Brazil', '🇧🇷', 'GK', 26, 64, 83, 78, 5, 0, 0),
  P('pickford', 'Jordan Pickford', 'England', '🏴', 'GK', 25, 58, 83, 76, 5, 0, 0),
  P('diogo-costa', 'Diogo Costa', 'Portugal', '🇵🇹', 'GK', 25, 62, 80, 74, 5, 0, 0),
  P('ochoa', 'Guillermo Ochoa', 'Mexico', '🇲🇽', 'GK', 24, 54, 80, 72, 3, 0, 0),
  P('al-owais', 'Mohammed Al-Owais', 'Saudi Arabia', '🇸🇦', 'GK', 24, 54, 78, 74, 3, 0, 0),
  P('turner', 'Matt Turner', 'United States', '🇺🇸', 'GK', 23, 50, 76, 74, 4, 0, 0),
  P('noppert', 'Andries Noppert', 'Netherlands', '🇳🇱', 'GK', 22, 52, 74, 78, 5, 0, 0),
  P('beiranvand', 'Alireza Beiranvand', 'Iran', '🇮🇷', 'GK', 22, 52, 74, 76, 2, 0, 0),
  P('gonda', 'Shūichi Gonda', 'Japan', '🇯🇵', 'GK', 22, 50, 74, 70, 4, 0, 0),

  // ── Defenders ────────────────────────────────────────────────
  P('gvardiol', 'Joško Gvardiol', 'Croatia', '🇭🇷', 'DEF', 58, 76, 89, 84, 7, 1, 0),
  P('hakimi', 'Achraf Hakimi', 'Morocco', '🇲🇦', 'DEF', 74, 82, 84, 84, 6, 0, 0),
  P('van-dijk', 'Virgil van Dijk', 'Netherlands', '🇳🇱', 'DEF', 50, 76, 86, 84, 5, 0, 0),
  P('theo', 'Theo Hernández', 'France', '🇫🇷', 'DEF', 72, 78, 80, 84, 6, 1, 0),
  P('romero', 'Cristian Romero', 'Argentina', '🇦🇷', 'DEF', 44, 68, 85, 82, 6, 0, 0),
  P('varane', 'Raphaël Varane', 'France', '🇫🇷', 'DEF', 46, 72, 85, 80, 6, 0, 0),
  P('kounde', 'Jules Koundé', 'France', '🇫🇷', 'DEF', 54, 74, 84, 78, 7, 0, 0),
  P('otamendi', 'Nicolás Otamendi', 'Argentina', '🇦🇷', 'DEF', 42, 70, 84, 82, 7, 0, 0),
  P('marquinhos', 'Marquinhos', 'Brazil', '🇧🇷', 'DEF', 46, 74, 84, 78, 4, 0, 0),
  P('ruben-dias', 'Rúben Dias', 'Portugal', '🇵🇹', 'DEF', 42, 74, 83, 78, 5, 0, 0),
  P('thiago-silva', 'Thiago Silva', 'Brazil', '🇧🇷', 'DEF', 44, 78, 85, 70, 5, 0, 0),
  P('stones', 'John Stones', 'England', '🏴', 'DEF', 44, 76, 82, 76, 5, 0, 0),
  P('kim-min-jae', 'Kim Min-jae', 'South Korea', '🇰🇷', 'DEF', 40, 66, 82, 82, 3, 0, 0),
  P('koulibaly', 'Kalidou Koulibaly', 'Senegal', '🇸🇳', 'DEF', 44, 64, 82, 82, 4, 1, 0),
  P('dumfries', 'Denzel Dumfries', 'Netherlands', '🇳🇱', 'DEF', 70, 72, 74, 82, 5, 1, 2),
  P('ake', 'Nathan Aké', 'Netherlands', '🇳🇱', 'DEF', 46, 70, 80, 76, 5, 1, 0),
  P('pepe', 'Pepe', 'Portugal', '🇵🇹', 'DEF', 42, 68, 80, 74, 5, 1, 0),
  P('molina', 'Nahuel Molina', 'Argentina', '🇦🇷', 'DEF', 62, 70, 74, 74, 6, 1, 0),
  P('maguire', 'Harry Maguire', 'England', '🏴', 'DEF', 44, 64, 76, 80, 5, 0, 0),
  P('juranovic', 'Josip Juranović', 'Croatia', '🇭🇷', 'DEF', 58, 68, 74, 76, 7, 0, 0),
  P('saiss', 'Romain Saïss', 'Morocco', '🇲🇦', 'DEF', 40, 62, 76, 78, 6, 0, 0),
  P('tomiyasu', 'Takehiro Tomiyasu', 'Japan', '🇯🇵', 'DEF', 40, 64, 76, 76, 3, 0, 0),
  P('souttar', 'Harry Souttar', 'Australia', '🇦🇺', 'DEF', 36, 56, 76, 84, 4, 0, 0),
  P('walker', 'Kyle Walker', 'England', '🏴', 'DEF', 44, 64, 74, 80, 4, 0, 0),
  P('kim-young-gwon', 'Kim Young-gwon', 'South Korea', '🇰🇷', 'DEF', 40, 60, 76, 74, 4, 1, 0),

  // ── Midfielders ──────────────────────────────────────────────
  P('modric', 'Luka Modrić', 'Croatia', '🇭🇷', 'MID', 80, 96, 74, 70, 7, 0, 1),
  P('bellingham', 'Jude Bellingham', 'England', '🏴', 'MID', 84, 86, 76, 84, 5, 1, 1),
  P('griezmann', 'Antoine Griezmann', 'France', '🇫🇷', 'MID', 84, 91, 68, 70, 7, 0, 3),
  P('enzo', 'Enzo Fernández', 'Argentina', '🇦🇷', 'MID', 78, 88, 74, 76, 7, 1, 1),
  P('bruno', 'Bruno Fernandes', 'Portugal', '🇵🇹', 'MID', 82, 87, 60, 70, 5, 2, 1),
  P('kdb', 'Kevin De Bruyne', 'Belgium', '🇧🇪', 'MID', 78, 88, 58, 70, 3, 0, 1),
  P('kovacic', 'Mateo Kovačić', 'Croatia', '🇭🇷', 'MID', 72, 85, 70, 74, 7, 0, 0),
  P('fdejong', 'Frenkie de Jong', 'Netherlands', '🇳🇱', 'MID', 70, 87, 70, 70, 5, 1, 1),
  P('valverde', 'Federico Valverde', 'Uruguay', '🇺🇾', 'MID', 76, 82, 74, 80, 3, 0, 0),
  P('mac-allister', 'Alexis Mac Allister', 'Argentina', '🇦🇷', 'MID', 76, 84, 68, 70, 7, 1, 1),
  P('de-paul', 'Rodrigo De Paul', 'Argentina', '🇦🇷', 'MID', 70, 83, 72, 78, 7, 0, 0),
  P('rice', 'Declan Rice', 'England', '🏴', 'MID', 66, 82, 80, 80, 5, 0, 0),
  P('tchouameni', 'Aurélien Tchouaméni', 'France', '🇫🇷', 'MID', 70, 80, 82, 82, 7, 1, 0),
  P('casemiro', 'Casemiro', 'Brazil', '🇧🇷', 'MID', 70, 78, 84, 82, 4, 1, 0),
  P('pedri', 'Pedri', 'Spain', '🇪🇸', 'MID', 74, 88, 60, 62, 4, 0, 0),
  P('rabiot', 'Adrien Rabiot', 'France', '🇫🇷', 'MID', 72, 78, 76, 80, 6, 1, 1),
  P('brozovic', 'Marcelo Brozović', 'Croatia', '🇭🇷', 'MID', 64, 84, 76, 76, 6, 0, 0),
  P('kudus', 'Mohammed Kudus', 'Ghana', '🇬🇭', 'MID', 80, 80, 62, 76, 3, 2, 0),
  P('busquets', 'Sergio Busquets', 'Spain', '🇪🇸', 'MID', 62, 87, 72, 62, 4, 0, 0),
  P('gavi', 'Gavi', 'Spain', '🇪🇸', 'MID', 74, 82, 64, 72, 4, 1, 0),
  P('amrabat', 'Sofyan Amrabat', 'Morocco', '🇲🇦', 'MID', 58, 78, 84, 84, 7, 0, 0),
  P('musiala', 'Jamal Musiala', 'Germany', '🇩🇪', 'MID', 80, 82, 54, 64, 3, 0, 0),
  P('ounahi', 'Azzedine Ounahi', 'Morocco', '🇲🇦', 'MID', 70, 80, 66, 70, 6, 0, 0),
  P('ziyech', 'Hakim Ziyech', 'Morocco', '🇲🇦', 'MID', 76, 82, 54, 62, 6, 1, 1),
  P('caicedo', 'Moisés Caicedo', 'Ecuador', '🇪🇨', 'MID', 64, 76, 76, 76, 3, 1, 0),
  P('kamada', 'Daichi Kamada', 'Japan', '🇯🇵', 'MID', 72, 78, 58, 64, 4, 0, 0),
  P('adams', 'Tyler Adams', 'United States', '🇺🇸', 'MID', 56, 74, 78, 76, 4, 0, 0),
  P('endo', 'Wataru Endo', 'Japan', '🇯🇵', 'MID', 58, 74, 76, 74, 4, 0, 0),
  P('chavez', 'Luis Chávez', 'Mexico', '🇲🇽', 'MID', 70, 76, 62, 66, 3, 1, 0),
  P('henderson', 'Jordan Henderson', 'England', '🏴', 'MID', 62, 76, 68, 72, 4, 1, 0),
  P('mooy', 'Aaron Mooy', 'Australia', '🇦🇺', 'MID', 60, 74, 64, 68, 4, 0, 0),
  P('paik', 'Paik Seung-ho', 'South Korea', '🇰🇷', 'MID', 66, 72, 58, 64, 2, 1, 0),

  // ── Forwards ─────────────────────────────────────────────────
  P('messi', 'Lionel Messi', 'Argentina', '🇦🇷', 'FWD', 95, 94, 34, 68, 7, 7, 3),
  P('mbappe', 'Kylian Mbappé', 'France', '🇫🇷', 'FWD', 96, 84, 30, 82, 7, 8, 2),
  P('kane', 'Harry Kane', 'England', '🏴', 'FWD', 90, 86, 40, 80, 5, 2, 3),
  P('neymar', 'Neymar Jr', 'Brazil', '🇧🇷', 'FWD', 91, 90, 32, 68, 4, 2, 1),
  P('julian', 'Julián Álvarez', 'Argentina', '🇦🇷', 'FWD', 88, 78, 52, 80, 7, 4, 0),
  P('vinicius', 'Vinícius Júnior', 'Brazil', '🇧🇷', 'FWD', 87, 78, 38, 76, 5, 1, 1),
  P('di-maria', 'Ángel Di María', 'Argentina', '🇦🇷', 'FWD', 85, 86, 40, 66, 5, 1, 1),
  P('giroud', 'Olivier Giroud', 'France', '🇫🇷', 'FWD', 85, 72, 44, 84, 6, 4, 0),
  P('lewandowski', 'Robert Lewandowski', 'Poland', '🇵🇱', 'FWD', 85, 74, 36, 78, 4, 2, 1),
  P('gakpo', 'Cody Gakpo', 'Netherlands', '🇳🇱', 'FWD', 83, 76, 40, 78, 5, 3, 0),
  P('saka', 'Bukayo Saka', 'England', '🏴', 'FWD', 82, 78, 46, 70, 5, 3, 0),
  P('richarlison', 'Richarlison', 'Brazil', '🇧🇷', 'FWD', 83, 70, 42, 78, 5, 3, 0),
  P('ronaldo', 'Cristiano Ronaldo', 'Portugal', '🇵🇹', 'FWD', 84, 74, 34, 74, 5, 1, 0),
  P('davies', 'Alphonso Davies', 'Canada', '🇨🇦', 'FWD', 80, 74, 60, 84, 3, 1, 0),
  P('son', 'Son Heung-min', 'South Korea', '🇰🇷', 'FWD', 82, 78, 40, 68, 4, 0, 1),
  P('goncalo-ramos', 'Gonçalo Ramos', 'Portugal', '🇵🇹', 'FWD', 82, 70, 40, 76, 4, 3, 1),
  P('rashford', 'Marcus Rashford', 'England', '🏴', 'FWD', 81, 72, 40, 78, 3, 3, 0),
  P('perisic', 'Ivan Perišić', 'Croatia', '🇭🇷', 'FWD', 79, 76, 52, 76, 7, 1, 1),
  P('foden', 'Phil Foden', 'England', '🏴', 'FWD', 80, 80, 44, 66, 4, 1, 1),
  P('morata', 'Álvaro Morata', 'Spain', '🇪🇸', 'FWD', 80, 70, 42, 76, 4, 3, 0),
  P('valencia', 'Enner Valencia', 'Ecuador', '🇪🇨', 'FWD', 80, 68, 40, 78, 3, 3, 0),
  P('pulisic', 'Christian Pulisic', 'United States', '🇺🇸', 'FWD', 78, 74, 44, 66, 4, 1, 0),
  P('taremi', 'Mehdi Taremi', 'Iran', '🇮🇷', 'FWD', 78, 68, 40, 74, 3, 2, 0),
  P('en-nesyri', 'Youssef En-Nesyri', 'Morocco', '🇲🇦', 'FWD', 78, 64, 44, 80, 6, 2, 0),
  P('al-dawsari', 'Salem Al-Dawsari', 'Saudi Arabia', '🇸🇦', 'FWD', 77, 70, 42, 70, 3, 2, 0),
  P('ferran', 'Ferran Torres', 'Spain', '🇪🇸', 'FWD', 77, 72, 42, 68, 4, 2, 0),
  P('mitrovic', 'Aleksandar Mitrović', 'Serbia', '🇷🇸', 'FWD', 78, 64, 42, 80, 3, 2, 0),
  P('weghorst', 'Wout Weghorst', 'Netherlands', '🇳🇱', 'FWD', 76, 64, 46, 82, 3, 2, 0),
  P('bale', 'Gareth Bale', 'Wales', '🏴', 'FWD', 76, 72, 40, 66, 3, 1, 0),
  P('aboubakar', 'Vincent Aboubakar', 'Cameroon', '🇨🇲', 'FWD', 76, 68, 40, 78, 3, 2, 1),
  P('shaqiri', 'Xherdan Shaqiri', 'Switzerland', '🇨🇭', 'FWD', 74, 74, 40, 62, 4, 1, 1),
  P('doan', 'Ritsu Doan', 'Japan', '🇯🇵', 'FWD', 75, 70, 46, 68, 4, 2, 0),
  P('embolo', 'Breel Embolo', 'Switzerland', '🇨🇭', 'FWD', 74, 62, 42, 80, 4, 2, 0),
  P('fullkrug', 'Niclas Füllkrug', 'Germany', '🇩🇪', 'FWD', 74, 60, 40, 80, 3, 2, 0),
  P('sarr', 'Ismaïla Sarr', 'Senegal', '🇸🇳', 'FWD', 74, 66, 42, 74, 4, 1, 1),
  P('cho', 'Cho Gue-sung', 'South Korea', '🇰🇷', 'FWD', 74, 62, 44, 78, 4, 2, 0),
  P('asano', 'Takuma Asano', 'Japan', '🇯🇵', 'FWD', 74, 64, 44, 74, 3, 1, 0),
  P('david', 'Jonathan David', 'Canada', '🇨🇦', 'FWD', 74, 66, 40, 70, 3, 0, 0),
  P('weah', 'Timothy Weah', 'United States', '🇺🇸', 'FWD', 72, 66, 44, 72, 4, 1, 0),
  P('vlahovic', 'Dušan Vlahović', 'Serbia', '🇷🇸', 'FWD', 74, 60, 38, 76, 3, 1, 0),
];

export const PLAYER_BY_ID = new Map(PLAYERS.map((p) => [p.id, p]));

export const PLAYERS_BY_RARITY = {
  COMMON: PLAYERS.filter((p) => p.rarity === 'COMMON'),
  RARE: PLAYERS.filter((p) => p.rarity === 'RARE'),
  ELITE: PLAYERS.filter((p) => p.rarity === 'ELITE'),
  LEGEND: PLAYERS.filter((p) => p.rarity === 'LEGEND'),
};
