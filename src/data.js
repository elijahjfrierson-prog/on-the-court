// ===== On The Court — game data & pure logic (no rendering) =====
const OTC = {};

OTC.VERSION = '0.1.0';
OTC.TICK = 1 / 60;

// ---- Court (meters, NBA spec). +Z = the "home" hoop end, -Z = the other end.
OTC.COURT = {
  L: 28.65, W: 15.24,
  hoopZ: 12.725,          // rim center distance from midcourt
  rimH: 3.048, rimR: 0.2286, ballR: 0.1194,
  boardZ: 13.105, boardW: 1.83, boardH: 1.07, boardBottom: 2.9,
  threeR: 7.24, cornerX: 6.71, keyW: 4.88, ftZ: 5.8,
};

OTC.POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
OTC.POS_NAME = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };

// ---- Attributes (2K20-style categories)
OTC.ATTRS = [
  ['closeShot', 'Close Shot', 'FIN'], ['layup', 'Driving Layup', 'FIN'], ['dunk', 'Driving Dunk', 'FIN'],
  ['standDunk', 'Standing Dunk', 'FIN'], ['post', 'Post Control', 'FIN'],
  ['mid', 'Mid-Range Shot', 'SHT'], ['three', 'Three-Point Shot', 'SHT'], ['ft', 'Free Throw', 'SHT'],
  ['pass', 'Pass Accuracy', 'PLY'], ['handle', 'Ball Handle', 'PLY'], ['speedBall', 'Speed With Ball', 'PLY'],
  ['intD', 'Interior Defense', 'DEF'], ['perD', 'Perimeter Defense', 'DEF'], ['steal', 'Steal', 'DEF'],
  ['block', 'Block', 'DEF'], ['oreb', 'Offensive Rebound', 'DEF'], ['dreb', 'Defensive Rebound', 'DEF'],
  ['speed', 'Speed', 'ATH'], ['accel', 'Acceleration', 'ATH'], ['strength', 'Strength', 'ATH'],
  ['vertical', 'Vertical', 'ATH'], ['stamina', 'Stamina', 'ATH'],
];
OTC.ATTR_KEYS = OTC.ATTRS.map(a => a[0]);
OTC.CATS = { FIN: 'Finishing', SHT: 'Shooting', PLY: 'Playmaking', DEF: 'Defense / Rebounding', ATH: 'Physicals' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
OTC.clamp = clamp; OTC.lerp = lerp;

// Height cap curves [at 5'7", at 6'7", at 7'3"] — the physical ceiling before archetype.
const HEIGHT_CAPS = {
  closeShot: [88, 95, 96], layup: [97, 95, 82], dunk: [72, 95, 80], standDunk: [35, 80, 97], post: [45, 80, 95],
  mid: [97, 96, 88], three: [99, 96, 86], ft: [99, 97, 90],
  pass: [99, 92, 78], handle: [99, 90, 70], speedBall: [99, 88, 62],
  intD: [45, 82, 99], perD: [96, 94, 70], steal: [97, 90, 70], block: [35, 85, 99], oreb: [50, 85, 99], dreb: [50, 87, 99],
  speed: [99, 86, 64], accel: [99, 87, 62], strength: [55, 80, 97], vertical: [96, 88, 70], stamina: [99, 97, 92],
};
OTC.HEIGHT_MIN = 67; OTC.HEIGHT_MAX = 87; // inches

OTC.fmtHeight = (inches) => `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;
OTC.weightRange = (h) => { const t = (h - 67) / 20; return [Math.round(lerp(150, 200, t)), Math.round(lerp(200, 300, t))]; };
OTC.wingRange = (h) => [h - 2, h + 9];

// ---- Archetypes
// System "2K20": primary + secondary skill pick.  System "2K17": classic named archetypes per position.
OTC.SKILLS = ['Finishing', 'Shooting', 'Playmaking', 'Defense'];
const SKILL_ATTRS = {
  Finishing: ['closeShot', 'layup', 'dunk', 'standDunk', 'post', 'vertical'],
  Shooting: ['mid', 'three', 'ft'],
  Playmaking: ['pass', 'handle', 'speedBall', 'speed', 'accel'],
  Defense: ['intD', 'perD', 'steal', 'block', 'oreb', 'dreb', 'strength'],
};
const NOUN_GUARD = { Finishing: 'Slasher', Shooting: 'Sharpshooter', Playmaking: 'Playmaker', Defense: 'Lockdown' };
const NOUN_BIG = { Finishing: 'Post Scorer', Shooting: 'Stretch Big', Playmaking: 'Playmaking Big', Defense: 'Glass Cleaner' };
const ADJ = { Finishing: 'Slashing', Shooting: 'Sharpshooting', Playmaking: 'Playmaking', Defense: 'Defensive' };
const SPECIAL_2K20 = {
  'Finishing|Defense': ['2-Way Slasher', '2-Way Interior Finisher'],
  'Shooting|Defense': ['3-and-D Wing', 'Stretch Glass Cleaner'],
  'Defense|Shooting': ['2-Way Sharpshooter', 'Stretch Rim Protector'],
  'Playmaking|Shooting': ['Playmaking Shot Creator', 'Playmaking Stretch Big'],
  'Shooting|Playmaking': ['Shot Creator', 'Stretch Playmaker'],
  'Finishing|Shooting': ['Slashing Shot Creator', 'Inside-Out Scorer'],
  'Shooting|Finishing': ['Sharpshooting Slasher', 'Stretch Post Scorer'],
  'Defense|Playmaking': ['Defensive Playmaker', 'Point Forward Anchor'],
  'Defense|Finishing': ['Lockdown Slasher', 'Paint Beast'],
  'Playmaking|Defense': ['2-Way Playmaker', 'Playmaking Glass Cleaner'],
};
OTC.archetypeName2K20 = (pos, primary, secondary) => {
  const big = pos === 'PF' || pos === 'C';
  const key = `${primary}|${secondary}`;
  if (SPECIAL_2K20[key]) return SPECIAL_2K20[key][big ? 1 : 0];
  if (primary === secondary) return 'Pure ' + (big ? NOUN_BIG : NOUN_GUARD)[primary];
  return ADJ[secondary] + ' ' + (big ? NOUN_BIG : NOUN_GUARD)[primary];
};

// 2K17-style named archetypes: weights per skill (sum ~ 1). Each also sets an animation package.
OTC.ARCH_2K17 = {
  PG: [['Playmaker', { Playmaking: .5, Shooting: .25, Finishing: .15, Defense: .1 }],
       ['Shot Creator', { Shooting: .4, Playmaking: .35, Finishing: .15, Defense: .1 }],
       ['Slashing Playmaker', { Finishing: .4, Playmaking: .4, Shooting: .1, Defense: .1 }],
       ['Pure Sharpshooter', { Shooting: .6, Playmaking: .2, Finishing: .1, Defense: .1 }],
       ['Lockdown Defender', { Defense: .5, Playmaking: .25, Shooting: .15, Finishing: .1 }]],
  SG: [['Scoring Machine', { Shooting: .4, Finishing: .35, Playmaking: .15, Defense: .1 }],
       ['Sharpshooter', { Shooting: .6, Playmaking: .15, Finishing: .1, Defense: .15 }],
       ['Slasher', { Finishing: .55, Playmaking: .2, Shooting: .1, Defense: .15 }],
       ['3-and-D', { Shooting: .45, Defense: .45, Finishing: .05, Playmaking: .05 }],
       ['Shot Creator', { Shooting: .4, Playmaking: .35, Finishing: .15, Defense: .1 }]],
  SF: [['2-Way Slasher', { Finishing: .45, Defense: .4, Shooting: .1, Playmaking: .05 }],
       ['Sharpshooter', { Shooting: .55, Defense: .2, Finishing: .15, Playmaking: .1 }],
       ['Point Forward', { Playmaking: .45, Finishing: .25, Shooting: .2, Defense: .1 }],
       ['Lockdown Defender', { Defense: .6, Finishing: .2, Shooting: .1, Playmaking: .1 }],
       ['Athletic Finisher', { Finishing: .6, Defense: .2, Shooting: .1, Playmaking: .1 }]],
  PF: [['Post Scorer', { Finishing: .6, Defense: .25, Shooting: .1, Playmaking: .05 }],
       ['Stretch 4', { Shooting: .55, Defense: .25, Finishing: .15, Playmaking: .05 }],
       ['Pick & Pop', { Shooting: .45, Finishing: .3, Defense: .2, Playmaking: .05 }],
       ['Glass Cleaner', { Defense: .65, Finishing: .25, Shooting: .05, Playmaking: .05 }],
       ['2-Way Interior Finisher', { Finishing: .45, Defense: .45, Shooting: .05, Playmaking: .05 }]],
  C:  [['Post Scorer', { Finishing: .6, Defense: .3, Shooting: .05, Playmaking: .05 }],
       ['Rim Protector', { Defense: .7, Finishing: .2, Shooting: .05, Playmaking: .05 }],
       ['Glass Cleaner', { Defense: .6, Finishing: .3, Shooting: .05, Playmaking: .05 }],
       ['Stretch 5', { Shooting: .5, Defense: .3, Finishing: .15, Playmaking: .05 }],
       ['Paint Beast', { Finishing: .5, Defense: .4, Shooting: .05, Playmaking: .05 }]],
};

// Animation packages (signature styles). Each changes how the body moves.
OTC.DRIBBLE_STYLES = {
  'Quick Handles':  { tempo: 1.18, low: 0.88, wide: 0.9,  desc: 'Tight, low, fast pound' },
  'Shifty Guard':   { tempo: 1.10, low: 0.92, wide: 1.1,  desc: 'Wide, bouncy hesis' },
  'Smooth Wing':    { tempo: 0.98, low: 1.0,  wide: 1.0,  desc: 'Long, smooth strides' },
  'Power Driver':   { tempo: 0.92, low: 1.02, wide: 1.05, desc: 'Strong shoulder-first drives' },
  'Big Man Bounce': { tempo: 0.82, low: 1.12, wide: 1.15, desc: 'High, wide big-man dribble' },
};
OTC.JUMPERS = {
  'Quick Set (High Release)': { fill: 0.48, releaseH: 1.18, arc: 50, desc: 'Fast release over the top' },
  'Smooth One-Motion':        { fill: 0.55, releaseH: 1.10, arc: 48, desc: 'Fluid one-motion jumper' },
  'Set Shot Classic':         { fill: 0.62, releaseH: 1.02, arc: 46, desc: 'Old-school set shot' },
  'Fadeaway Scorer':          { fill: 0.58, releaseH: 1.12, arc: 52, desc: 'Lean-back mid-range style' },
  'Big Man Push':             { fill: 0.66, releaseH: 1.08, arc: 45, desc: 'Big man release' },
};
OTC.CELEBRATIONS = ['Too Small', 'Ice In Veins', 'Night Night', 'Flex', 'Shimmy', 'Point Up'];

// ---- Build → potential caps
// build = { pos, heightIn, weight, wing, shoulders(0-1), legs(0-1), system:'2K20'|'2K17', primary, secondary, arch17 }
OTC.computeCaps = (b) => {
  const t = (b.heightIn - 67) / 20; // 0..1
  const caps = {};
  for (const k of OTC.ATTR_KEYS) {
    const [a, m, c] = HEIGHT_CAPS[k];
    caps[k] = t < 0.5 ? lerp(a, m, t / 0.5) : lerp(m, c, (t - 0.5) / 0.5);
  }
  // weight: heavier = stronger, slower
  const [wMin, wMax] = OTC.weightRange(b.heightIn);
  const wt = clamp((b.weight - wMin) / Math.max(1, wMax - wMin), 0, 1) - 0.5; // -0.5..0.5
  caps.strength += wt * 30; caps.intD += wt * 10; caps.post += wt * 10; caps.standDunk += wt * 6;
  caps.speed -= wt * 14; caps.accel -= wt * 14; caps.speedBall -= wt * 12; caps.vertical -= wt * 14; caps.stamina -= wt * 6;
  // wingspan: long arms = defense/rebounds/blocks, short arms = handle/shot
  const ws = clamp((b.wing - b.heightIn) / 9, -0.25, 1) - 0.35;
  caps.block += ws * 16; caps.steal += ws * 10; caps.perD += ws * 8; caps.intD += ws * 6; caps.dreb += ws * 8; caps.oreb += ws * 8;
  caps.three -= ws * 7; caps.mid -= ws * 4; caps.handle -= ws * 5;
  // legs: long legs = vertical/speed, short = handle
  const lg = (b.legs ?? 0.5) - 0.5;
  caps.vertical += lg * 8; caps.speed += lg * 4; caps.handle -= lg * 4;
  const sh = (b.shoulders ?? 0.5) - 0.5;
  caps.strength += sh * 8; caps.post += sh * 4; caps.three -= sh * 3;

  // archetype weighting: archetype emphasis raises its attrs, others shrink. Average budget stays similar.
  const wts = OTC.skillWeights(b);
  for (const [skill, keys] of Object.entries(SKILL_ATTRS)) {
    const emph = wts[skill]; // ~0.05..0.6
    const mult = 0.62 + emph * 0.95;
    for (const k of keys) caps[k] = caps[k] * Math.min(1.08, mult) + (emph > 0.35 ? 4 : 0);
  }
  caps.stamina = Math.max(caps.stamina, 80);
  for (const k of OTC.ATTR_KEYS) caps[k] = Math.round(clamp(caps[k], 25, 99));
  return caps;
};

OTC.skillWeights = (b) => {
  if (b.system === '2K17') {
    const list = OTC.ARCH_2K17[b.pos] || OTC.ARCH_2K17.PG;
    const found = list.find(a => a[0] === b.arch17) || list[0];
    return found[1];
  }
  const w = { Finishing: 0.1, Shooting: 0.1, Playmaking: 0.1, Defense: 0.1 };
  w[b.primary] += 0.38; w[b.secondary] += 0.22;
  return w;
};

OTC.archetypeName = (b) => b.system === '2K17'
  ? (b.arch17 || OTC.ARCH_2K17[b.pos][0][0])
  : OTC.archetypeName2K20(b.pos, b.primary, b.secondary);

// Position weighting for overall.
const POS_W = {
  PG: { pass: 3, handle: 3, speedBall: 2.5, three: 2.5, mid: 2, layup: 2, perD: 1.5, steal: 1.5, speed: 2, accel: 2, closeShot: 1, ft: 1 },
  SG: { three: 3, mid: 2.5, layup: 2, handle: 2, perD: 2, steal: 1.5, speed: 2, accel: 2, dunk: 1.5, ft: 1.5, pass: 1 },
  SF: { layup: 2, dunk: 2, three: 2, mid: 2, perD: 2, intD: 1, handle: 1.5, speed: 1.5, vertical: 1.5, dreb: 1, closeShot: 1.5 },
  PF: { closeShot: 2.5, post: 2, standDunk: 2, intD: 2.5, block: 2, dreb: 2.5, oreb: 2, strength: 2, mid: 1.5, three: 1 },
  C:  { closeShot: 2.5, post: 2.5, standDunk: 2.5, intD: 3, block: 3, dreb: 3, oreb: 2.5, strength: 2.5, pass: 0.5 },
};
OTC.overall = (ratings, pos) => {
  const w = POS_W[pos] || POS_W.SF;
  let s = 0, n = 0;
  for (const k of OTC.ATTR_KEYS) { const wk = w[k] ?? 0.6; s += ratings[k] * wk; n += wk; }
  const avg = s / n;
  const sorted = OTC.ATTR_KEYS.map(k => ratings[k]).sort((a, b) => b - a);
  const top = sorted.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
  return Math.round(clamp(avg * 0.7 + top * 0.3 + 2, 40, 99));
};

OTC.defaultBuild = () => ({
  name: 'Court Star', pos: 'PG', heightIn: 76, weight: 195, wing: 80, shoulders: 0.5, legs: 0.5,
  system: '2K20', primary: 'Playmaking', secondary: 'Shooting', arch17: 'Playmaker',
  skin: 3, hair: 1, beard: 1, sleeve: 1, number: 0,
  jersey: '#f2b632', trim: '#0d1d4f', dribble: 'Quick Handles', jumper: 'Smooth One-Motion', celebration: 'Ice In Veins',
});
OTC.SKIN_TONES = ['#f1d0b0', '#e2b38f', '#c98e65', '#a96d47', '#8a5233', '#6b3d24', '#4f2b19', '#3a1f12'];
OTC.HAIR = ['Bald', 'Buzz', 'Waves', 'Curly Top', 'Twists', 'Afro', 'Braids'];
OTC.BEARDS = ['None', 'Chin Strap', 'Goatee', 'Full Beard'];
OTC.HAIR_COLORS = ['#141010', '#2b1c12', '#5a3a22', '#b98a4e'];

// ---- Dribble combos. Input taps: L R U D (U = toward hoop, D = back).
// Each move = phases. phase: { t: sec, mv: [lateral, forward] m/s relative to facing hoop,
//   hand: 'L'|'R' new ball hand at phase end, path: 'cross'|'btb'|'btl'|'hold'|'pound'|'spin', ankle: ankle-break power }
// Two-tap base moves (chainable), three-tap signature moves. cost = stamina.
const P = (t, x, z, o = {}) => ({ t, mv: [x, z], path: 'pound', ...o });
OTC.MOVES = [
  // --- crossovers
  { seq: 'LL', name: 'Crossover Left', cat: 'Crossover', cost: 4, phases: [P(.12, .9, .2, { lean: .3 }), P(.22, -3.3, .9, { hand: 'L', path: 'cross', lean: -.45, ankle: .9 })] },
  { seq: 'RR', name: 'Crossover Right', cat: 'Crossover', cost: 4, phases: [P(.12, -.9, .2, { lean: -.3 }), P(.22, 3.3, .9, { hand: 'R', path: 'cross', lean: .45, ankle: .9 })] },
  // --- between the legs
  { seq: 'LR', name: 'Between-the-Legs Right', cat: 'Between Legs', cost: 4, phases: [P(.14, -1.0, -.2, { lean: -.2 }), P(.22, 2.6, .5, { hand: 'R', path: 'btl', lean: .35, ankle: .75 })] },
  { seq: 'RL', name: 'Between-the-Legs Left', cat: 'Between Legs', cost: 4, phases: [P(.14, 1.0, -.2, { lean: .2 }), P(.22, -2.6, .5, { hand: 'L', path: 'btl', lean: -.35, ankle: .75 })] },
  // --- behind the back
  { seq: 'DL', name: 'Behind-the-Back Left', cat: 'Behind Back', cost: 5, phases: [P(.28, -2.8, 1.6, { hand: 'L', path: 'btb', lean: -.3, ankle: .85 })] },
  { seq: 'DR', name: 'Behind-the-Back Right', cat: 'Behind Back', cost: 5, phases: [P(.28, 2.8, 1.6, { hand: 'R', path: 'btb', lean: .3, ankle: .85 })] },
  // --- in-and-out
  { seq: 'UL', name: 'In-and-Out Left', cat: 'In & Out', cost: 3, phases: [P(.22, -1.6, .3, { path: 'hold', lean: -.5 }), P(.22, .4, 2.8, { lean: .1, ankle: .7 })] },
  { seq: 'UR', name: 'In-and-Out Right', cat: 'In & Out', cost: 3, phases: [P(.22, 1.6, .3, { path: 'hold', lean: .5 }), P(.22, -.4, 2.8, { lean: -.1, ankle: .7 })] },
  // --- spins
  { seq: 'LD', name: 'Spin Left', cat: 'Spin', cost: 6, phases: [P(.12, .8, .8, { lean: .2 }), P(.34, -2.6, 2.2, { hand: 'L', path: 'spin', spin: -1, ankle: .95 })] },
  { seq: 'RD', name: 'Spin Right', cat: 'Spin', cost: 6, phases: [P(.12, -.8, .8, { lean: -.2 }), P(.34, 2.6, 2.2, { hand: 'R', path: 'spin', spin: 1, ankle: .95 })] },
  { seq: 'LU', name: 'Half-Spin Left', cat: 'Spin', cost: 5, phases: [P(.30, -1.6, .8, { path: 'spin', spin: -.5, lean: -.2, ankle: .65 }), P(.16, 1.8, 1.0, { lean: .2 })] },
  { seq: 'RU', name: 'Half-Spin Right', cat: 'Spin', cost: 5, phases: [P(.30, 1.6, .8, { path: 'spin', spin: .5, lean: .2, ankle: .65 }), P(.16, -1.8, 1.0, { lean: -.2 })] },
  // --- hesitations / stepbacks / escapes
  { seq: 'UU', name: 'Hesitation Burst', cat: 'Hesitation', cost: 5, phases: [P(.26, 0, .2, { path: 'hold', lean: -.2, hesi: true }), P(.30, 0, 5.2, { lean: .35, ankle: .85 })] },
  { seq: 'DU', name: 'Hesi Pull-Up Fake', cat: 'Hesitation', cost: 3, phases: [P(.30, 0, -.3, { path: 'hold', lean: -.15, hesi: true }), P(.22, 0, 3.6, { lean: .3, ankle: .6 })] },
  { seq: 'DD', name: 'Stepback', cat: 'Stepback', cost: 6, phases: [P(.14, 0, 1.2, { lean: .2 }), P(.30, 0, -4.4, { path: 'hold', lean: -.4, ankle: .8, space: true })] },
  { seq: 'UD', name: 'Snatchback', cat: 'Stepback', cost: 5, phases: [P(.16, 0, 2.4, { lean: .3 }), P(.26, -.4, -3.6, { path: 'hold', lean: -.35, ankle: .7, space: true })] },
  // --- signature 3-tap combos
  { seq: 'LLR', name: 'Juke · Jet Step Left · Behind-the-Back Right', cat: 'Signature', sig: true, cost: 9, phases: [P(.22, -1.2, 0, { lean: -.35 }), P(.26, -3.0, .4, { lean: -.55, jet: true }), P(.30, 3.6, 1.4, { hand: 'R', path: 'btb', lean: .45, ankle: 1.25 })] },
  { seq: 'RRL', name: 'Juke · Jet Step Right · Behind-the-Back Left', cat: 'Signature', sig: true, cost: 9, phases: [P(.22, 1.2, 0, { lean: .35 }), P(.26, 3.0, .4, { lean: .55, jet: true }), P(.30, -3.6, 1.4, { hand: 'L', path: 'btb', lean: -.45, ankle: 1.25 })] },
  { seq: 'LRL', name: 'Double Crossover Left', cat: 'Signature', sig: true, cost: 7, phases: [P(.18, 2.2, .2, { hand: 'R', path: 'cross', lean: .4 }), P(.22, -3.4, .9, { hand: 'L', path: 'cross', lean: -.5, ankle: 1.1 })] },
  { seq: 'RLR', name: 'Double Crossover Right', cat: 'Signature', sig: true, cost: 7, phases: [P(.18, -2.2, .2, { hand: 'L', path: 'cross', lean: -.4 }), P(.22, 3.4, .9, { hand: 'R', path: 'cross', lean: .5, ankle: 1.1 })] },
  { seq: 'DDD', name: 'Double Stepback', cat: 'Signature', sig: true, cost: 10, phases: [P(.14, 0, 1.2, { lean: .2 }), P(.26, -.8, -3.8, { path: 'hold', lean: -.35 }), P(.26, .8, -3.4, { path: 'hold', lean: -.45, ankle: 1.0, space: true })] },
  { seq: 'DDL', name: 'Side-Step Left', cat: 'Escape', cost: 6, phases: [P(.34, -4.2, -.4, { path: 'hold', lean: -.5, space: true })] },
  { seq: 'DDR', name: 'Side-Step Right', cat: 'Escape', cost: 6, phases: [P(.34, 4.2, -.4, { path: 'hold', lean: .5, space: true })] },
  { seq: 'ULR', name: 'Shammgod Right', cat: 'Signature', sig: true, cost: 9, phases: [P(.18, -.6, 1.4, { hand: 'R', path: 'hold', lean: .2 }), P(.22, -1.8, 1.2, { hand: 'L', path: 'cross', lean: -.4 }), P(.22, 2.8, 1.8, { hand: 'R', path: 'cross', lean: .4, ankle: 1.3 })] },
  { seq: 'URL', name: 'Shammgod Left', cat: 'Signature', sig: true, cost: 9, phases: [P(.18, .6, 1.4, { hand: 'L', path: 'hold', lean: -.2 }), P(.22, 1.8, 1.2, { hand: 'R', path: 'cross', lean: .4 }), P(.22, -2.8, 1.8, { hand: 'L', path: 'cross', lean: -.4, ankle: 1.3 })] },
  { seq: 'UUD', name: 'Hesi Snatchback', cat: 'Signature', sig: true, cost: 9, phases: [P(.24, 0, .2, { path: 'hold', hesi: true }), P(.20, 0, 3.8, { lean: .35 }), P(.26, 0, -4.0, { path: 'hold', lean: -.4, ankle: 1.05, space: true })] },
  { seq: 'LDR', name: 'Spin · Crossover Right', cat: 'Signature', sig: true, cost: 10, phases: [P(.32, -2.0, 1.6, { hand: 'L', path: 'spin', spin: -1 }), P(.22, 3.2, 1.0, { hand: 'R', path: 'cross', lean: .45, ankle: 1.15 })] },
  { seq: 'RDL', name: 'Spin · Crossover Left', cat: 'Signature', sig: true, cost: 10, phases: [P(.32, 2.0, 1.6, { hand: 'R', path: 'spin', spin: 1 }), P(.22, -3.2, 1.0, { hand: 'L', path: 'cross', lean: -.45, ankle: 1.15 })] },
];
// Finishing packages: last tapped direction (within 0.6s) + S near the rim.
OTC.FINISHERS = {
  L: 'Euro Step Left', R: 'Euro Step Right', D: 'Hop Step', U: 'Spin Layup', none: 'Driving Layup', far: 'Floater', dunk: 'Driving Dunk',
};
OTC.MAX_CHAIN = 6;
OTC.MOVE_BY_SEQ = Object.fromEntries(OTC.MOVES.map(m => [m.seq, m]));
OTC.ARROW_GLYPH = { L: '←', R: '→', U: '↑', D: '↓' };

// Combo parser: feed taps; returns a move when the sequence is complete.
OTC.ComboBuffer = class {
  constructor(gap = 0.28) { this.gap = gap; this.seq = ''; this.since = 0; }
  push(dir) { this.seq += dir; this.since = 0; if (!this.hasLonger(this.seq)) return this.flush(); return null; }
  hasLonger(s) { return OTC.MOVES.some(m => m.seq.length > s.length && m.seq.startsWith(s)); }
  tick(dt) { if (!this.seq) return null; this.since += dt; if (this.since >= this.gap) return this.flush(); return null; }
  flush() {
    let s = this.seq; this.seq = '';
    // longest suffix that is a valid move
    for (let i = 0; i < s.length; i++) { const m = OTC.MOVE_BY_SEQ[s.slice(i)]; if (m) return m; }
    return null;
  }
};

// Move timing from body + ratings. Big men move slower and wider.
OTC.moveScale = (p) => {
  const h = (p.heightIn - 67) / 20;
  const handle = p.r.handle / 99, sb = p.r.speedBall / 99;
  const style = OTC.DRIBBLE_STYLES[p.dribble] || OTC.DRIBBLE_STYLES['Smooth Wing'];
  const time = (1.0 + h * 0.45 - handle * 0.28) / style.tempo;       // 7'3 ~1.3x slower
  const dist = (1.0 + h * 0.35) * style.wide * (0.75 + sb * 0.35);    // longer strides
  return { time: clamp(time, 0.7, 1.6), dist };
};

// ---- Shot meter. v = fill (0 → 1 at release apex; >1 = late).
// Base windows from the spec: green .95–.97, yellow .80–.94 / .98–1.00, red elsewhere.
OTC.shotWindows = (rating, contest) => {
  // rating 25..99 → widen green; contest 0..1 → shrink
  const r = clamp((rating - 25) / 74, 0, 1);
  const gHalf = Math.max(0.004, (0.010 + r * 0.022) * (1 - contest * 0.75));
  const center = 0.96;
  const yHalf = gHalf + 0.07 + r * 0.04 - contest * 0.03;
  return { gLo: center - gHalf, gHi: center + gHalf, yLo: center - yHalf, yHi: center + yHalf, center };
};
OTC.gradeShot = (v, rating, contest) => {
  const w = OTC.shotWindows(rating, contest);
  if (v >= w.gLo && v <= w.gHi) return { grade: 'green', p: 1, label: 'EXCELLENT', w };
  const r = clamp((rating - 25) / 74, 0, 1);
  if (v >= w.yLo && v <= w.yHi) {
    const early = v < w.gLo;
    const off = early ? (w.gLo - v) / (w.gLo - w.yLo) : (v - w.gHi) / Math.max(1e-3, w.yHi - w.gHi);
    const p = clamp(0.35 + r * 0.30 - off * 0.12 - contest * 0.15, 0.2, 0.68);
    return { grade: 'yellow', p, label: early ? 'SLIGHTLY EARLY' : 'SLIGHTLY LATE', w };
  }
  const p = clamp(0.15 - contest * 0.15, 0, 0.15) * (0.5 + r * 0.5);
  return { grade: 'red', p, label: v < w.yLo ? 'VERY EARLY' : 'VERY LATE', w };
};

// Contest from defender distance & relative height. 0 = wide open, 1 = smothered.
OTC.contestAmount = (dist, shooterIn, defenderIn, defBlock) => {
  if (dist > 3.0) return 0;
  const hAdv = clamp((defenderIn - shooterIn) / 12, -0.4, 0.5);
  const c = (1 - (dist - 0.5) / 2.5) * (0.8 + hAdv * 0.6) * (0.75 + defBlock / 99 * 0.35);
  return clamp(c, 0, 1);
};

// Which rating drives a shot from a given distance.
OTC.shotRatingFor = (r, dist) => dist < 2.4 ? r.closeShot : dist < 6.9 ? r.mid : r.three;
OTC.shotValue = (x, zFromHoop) => {
  const d = Math.hypot(x, zFromHoop);
  if (Math.abs(x) > OTC.COURT.cornerX && zFromHoop < 4.27) return 3;
  return d > OTC.COURT.threeR ? 3 : 2;
};

// ---- Game modes
OTC.MODES = {
  '5v5':  { name: '5 vs 5', size: 5, full: true, target: null, quarters: 4, qLen: 180, shotClock: 24, desc: 'Full court, 4 quarters' },
  '3v3':  { name: '3 vs 3', size: 3, full: false, target: 21, shotClock: 14, makeItTakeIt: false, desc: 'Half court to 21 (2s and 3s)' },
  '1v1':  { name: '1 vs 1', size: 1, full: false, target: 15, shotClock: 12, makeItTakeIt: true, desc: 'Half court to 15, make it take it' },
  '21':   { name: '21', size: 3, full: false, target: 21, exact: true, cutthroat: true, shotClock: 14, desc: 'Every player for himself, exactly 21 (bust → 13)' },
};
OTC.DIFFICULTY = { Rookie: 0.55, Pro: 0.75, 'All-Star': 0.9, 'Hall of Fame': 1.05 };

// ---- CPU roster generator
const FIRST = ['Marcus', 'Dre', 'Jaylen', 'Tyrell', 'Kofi', 'Isaiah', 'Malik', 'Andre', 'Devon', 'Zion', 'Luka', 'Cam', 'Trey', 'Jalen', 'Darius', 'Khalil', 'Rico', 'Nate', 'Omar', 'Bishop'];
const LAST = ['Banks', 'Carter', 'Hayes', 'Brooks', 'Ellis', 'Grant', 'Holloway', 'Price', 'Reed', 'Stokes', 'Vaughn', 'Wells', 'Moss', 'Okafor', 'Diallo', 'Nash', 'Bryant', 'Cole', 'Fox', 'King'];
const POS_HEIGHT = { PG: [72, 77], SG: [75, 79], SF: [78, 81], PF: [80, 83], C: [82, 87] };
OTC.randomBuild = (pos, rng = Math.random) => {
  const [a, b] = POS_HEIGHT[pos];
  const heightIn = Math.round(lerp(a, b, rng()));
  const [wMin, wMax] = OTC.weightRange(heightIn);
  const list = OTC.ARCH_2K17[pos];
  const dribbles = Object.keys(OTC.DRIBBLE_STYLES), jumpers = Object.keys(OTC.JUMPERS);
  return {
    name: FIRST[Math.floor(rng() * FIRST.length)] + ' ' + LAST[Math.floor(rng() * LAST.length)],
    pos, heightIn, weight: Math.round(lerp(wMin, wMax, 0.3 + rng() * 0.4)), wing: heightIn + Math.round(rng() * 6),
    shoulders: 0.3 + rng() * 0.5, legs: 0.35 + rng() * 0.3,
    system: '2K17', arch17: list[Math.floor(rng() * list.length)][0], primary: 'Shooting', secondary: 'Playmaking',
    skin: Math.floor(rng() * OTC.SKIN_TONES.length), hair: Math.floor(rng() * OTC.HAIR.length), beard: Math.floor(rng() * 4), sleeve: rng() < 0.3 ? 1 : 0,
    number: Math.floor(rng() * 40),
    dribble: pos === 'C' || pos === 'PF' ? 'Big Man Bounce' : dribbles[Math.floor(rng() * 4)],
    jumper: pos === 'C' ? 'Big Man Push' : jumpers[Math.floor(rng() * 4)], celebration: OTC.CELEBRATIONS[Math.floor(rng() * 6)],
  };
};

// Ratings actually used in-game: a fraction of caps (CPU) or caps (your star in exhibition).
OTC.ratingsFor = (build, frac = 1) => {
  const caps = OTC.computeCaps(build);
  const r = {};
  for (const k of OTC.ATTR_KEYS) r[k] = Math.round(clamp(caps[k] * frac, 25, 99));
  return r;
};

// Physical speeds (m/s) from ratings + size.
OTC.physicals = (build, r) => {
  const h = (build.heightIn - 67) / 20;
  return {
    run: 4.2 + r.speed / 99 * 1.6 - h * 0.4,
    sprint: 5.6 + r.speed / 99 * 2.6 - h * 0.6,
    accel: 9 + r.accel / 99 * 12,
    jump: 0.45 + r.vertical / 99 * 0.55,           // meters of hang height
    reach: build.heightIn * 0.0254 * 1.33 + (build.wing - build.heightIn) * 0.0254 * 0.5,
    heightM: build.heightIn * 0.0254,
  };
};

if (typeof module !== 'undefined') module.exports = OTC;

// ---- Progression: Court Star starts ~60 OVR, upgrades bought with skill points earned per game.
OTC.starBase = (cap) => Math.round(25 + (cap - 25) * 0.5);
OTC.starRatings = (build) => {
  const caps = OTC.computeCaps(build), r = {};
  for (const k of OTC.ATTR_KEYS) {
    if (build.dev99) r[k] = 99;
    else r[k] = Math.min(caps[k], OTC.starBase(caps[k]) + ((build.upg && build.upg[k]) || 0));
  }
  return r;
};
OTC.upgradeCost = (rating) => 1 + Math.max(0, Math.floor((rating - 60) / 8));
OTC.pointsForGame = (s, won) => Math.round(6 + s.pts * 0.5 + s.ast + s.reb * 0.5 + s.stl + s.blk + (won ? 8 : 0));
OTC.maxToCaps = (build) => {
  const caps = OTC.computeCaps(build); build.upg = {};
  for (const k of OTC.ATTR_KEYS) build.upg[k] = caps[k] - OTC.starBase(caps[k]);
};
// Stamina: 0..100. Moves cost stamina; low stamina slows moves and lowers ankle-break chance.
OTC.staminaFactor = (st) => st > 50 ? 1 : 0.6 + (st / 50) * 0.4;

// ---- Badges (Bronze 1 / Silver 2 / Gold 3 / Hall of Fame 4), unlocked by attribute thresholds.
OTC.BADGE_TIERS = ['', 'Bronze', 'Silver', 'Gold', 'Hall of Fame'];
OTC.BADGES = [
  { id: 'ankle', name: 'Ankle Breaker', cat: 'PLY', req: { handle: [70, 78, 86, 93] }, desc: 'More ankle breaks on combos' },
  { id: 'tight', name: 'Tight Handles', cat: 'PLY', req: { handle: [65, 74, 83, 91] }, desc: 'Faster chains, fewer steals' },
  { id: 'quick', name: 'Quick First Step', cat: 'PLY', req: { speedBall: [68, 76, 84, 92] }, desc: 'Explosive launch out of moves' },
  { id: 'dimer', name: 'Dimer', cat: 'PLY', req: { pass: [68, 76, 85, 93] }, desc: 'Teammates shoot better off your passes' },
  { id: 'deadeye', name: 'Deadeye', cat: 'SHT', req: { three: [70, 78, 86, 93] }, desc: 'Contests hurt your jumper less' },
  { id: 'catch', name: 'Catch & Shoot', cat: 'SHT', req: { three: [65, 74, 83, 90] }, desc: 'Bigger green window right after a catch' },
  { id: 'range', name: 'Limitless Range', cat: 'SHT', req: { three: [78, 84, 90, 96] }, desc: 'Deep threes without penalty' },
  { id: 'midai', name: 'Mid-Range Maestro', cat: 'SHT', req: { mid: [70, 78, 86, 93] }, desc: 'Wider green on mid-range' },
  { id: 'poster', name: 'Posterizer', cat: 'FIN', req: { dunk: [72, 80, 87, 93] }, desc: 'Dunks over contests' },
  { id: 'contact', name: 'Contact Finisher', cat: 'FIN', req: { layup: [68, 76, 84, 91], strength: [55, 62, 70, 78] }, desc: 'Finish through contact' },
  { id: 'euro', name: 'Acrobat', cat: 'FIN', req: { layup: [72, 80, 87, 93] }, desc: 'Euro / spin layups score more' },
  { id: 'clamps', name: 'Clamps', cat: 'DEF', req: { perD: [70, 78, 86, 93] }, desc: 'Resist ankle breaks, cut off drives' },
  { id: 'interceptor', name: 'Interceptor', cat: 'DEF', req: { steal: [68, 76, 84, 91] }, desc: 'More steals and deflections' },
  { id: 'rimpro', name: 'Rim Protector', cat: 'DEF', req: { block: [70, 78, 86, 93] }, desc: 'More blocks at the rim' },
  { id: 'reb', name: 'Rebound Chaser', cat: 'DEF', req: { dreb: [70, 78, 86, 93] }, desc: 'Win more boards' },
  { id: 'motor', name: 'Unlimited Gas', cat: 'ATH', req: { stamina: [80, 86, 92, 97] }, desc: 'Stamina drains slower' },
];
OTC.badgesFor = (r) => {
  const out = {};
  for (const b of OTC.BADGES) {
    let tier = 4;
    for (const [k, th] of Object.entries(b.req)) { let t = 0; for (let i = 0; i < 4; i++) if (r[k] >= th[i]) t = i + 1; tier = Math.min(tier, t); }
    if (tier > 0) out[b.id] = tier;
  }
  return out;
};
// Build ratings for a real roster player from OVR + position + size + stat profile.
OTC.ratingsFromOvr = (pl) => {
  const build = OTC.rosterBuild(pl);
  const caps = OTC.computeCaps(build);
  const st = pl.st || {};
  const r = {};
  // start from caps, scaled so overall ≈ target
  let lo = 0.4, hi = 1.25;
  for (let it = 0; it < 18; it++) {
    const f = (lo + hi) / 2;
    for (const k of OTC.ATTR_KEYS) r[k] = Math.round(OTC.clamp(caps[k] * f, 25, 99));
    // stat flavor
    if (st.avgThreePointFieldGoalsAttempted > 3 && st.threePointFieldGoalPct > 36) r.three = Math.min(99, r.three + 6);
    if (st.avgThreePointFieldGoalsAttempted < 0.8) r.three = Math.max(25, r.three - 10);
    if (st.avgAssists > 6) { r.pass = Math.min(99, r.pass + 6); r.handle = Math.min(99, r.handle + 4); }
    if (st.avgRebounds > 9) { r.dreb = Math.min(99, r.dreb + 6); r.oreb = Math.min(99, r.oreb + 4); }
    if (st.avgBlocks > 1.5) r.block = Math.min(99, r.block + 7);
    if (st.avgSteals > 1.4) r.steal = Math.min(99, r.steal + 6);
    if (st.freeThrowPct > 85) r.ft = Math.min(99, r.ft + 5);
    const o = OTC.overall(r, build.pos);
    if (o < pl.ovr) lo = f; else hi = f;
  }
  return r;
};
OTC.rosterBuild = (pl, team) => {
  const h = OTC.clamp(pl.h || 78, 67, 89);
  return {
    name: pl.name, pos: pl.pos, heightIn: h, weight: pl.w || 215, wing: h + 3, shoulders: 0.5, legs: 0.5, system: '2K17',
    arch17: OTC.ARCH_2K17[pl.pos][0][0], skin: (pl.name.length * 7) % 8, hair: (pl.name.length * 3) % 7, beard: pl.name.length % 4,
    sleeve: 0, number: parseInt(pl.num) || 0,
    dribble: pl.pos === 'C' || pl.pos === 'PF' ? 'Big Man Bounce' : pl.pos === 'PG' ? 'Quick Handles' : 'Smooth Wing',
    jumper: pl.pos === 'C' ? 'Big Man Push' : 'Smooth One-Motion', celebration: 'Flex',
  };
};

// ---- Animation packages (Animations menu). Each pick changes the procedural motion.
OTC.JUMPER_BASES = {
  'Smooth One-Motion':   { fill: 0.55, releaseH: 1.10, arc: 48, dip: .10, flare: .10, kick: 0,   desc: 'Fluid one-motion jumper' },
  'Quick Set':           { fill: 0.47, releaseH: 1.16, arc: 50, dip: .06, flare: .05, kick: 0,   desc: 'Fast, high set point' },
  'Old School Set':      { fill: 0.62, releaseH: 1.00, arc: 46, dip: .16, flare: .18, kick: 0,   desc: 'Two-motion set shot' },
  'Fadeaway Scorer':     { fill: 0.57, releaseH: 1.12, arc: 52, dip: .08, flare: .08, kick: .25, desc: 'Lean back, leg kick' },
  'Slingshot':           { fill: 0.52, releaseH: 1.04, arc: 47, dip: .12, flare: .22, kick: .1,  desc: 'Low, quick slingshot' },
  'Big Man Push':        { fill: 0.66, releaseH: 1.08, arc: 45, dip: .14, flare: .14, kick: 0,   desc: 'Big man push shot' },
};
OTC.JUMPERS = OTC.JUMPER_BASES;
OTC.FREE_THROWS = ['Classic Dribble x3', 'Spin & Shoot', 'Quick Set', 'Deep Breath', 'Ball Twirl'];
OTC.SIZEUPS = ['Quick Pound', 'Low Rocker', 'Hesi Shimmy', 'Big Man Bounce', 'Wide Wing', 'Tight Crossover'];
OTC.CROSS_STYLES = { 'Quick Snap': { t: .85, w: .9 }, 'Wide Swing': { t: 1.05, w: 1.25 }, 'Low Whip': { t: .9, w: 1.0 }, 'Big Man Sweep': { t: 1.2, w: 1.35 } };
OTC.DUNK_PACKAGES = {
  'Two-Hand Power': { minDunk: 50, minH: 0,  desc: 'Two-hand flush' },
  'One-Hand Rim Grab': { minDunk: 60, minH: 0, desc: 'Hang on the rim' },
  'Tomahawk':       { minDunk: 70, minH: 74, desc: 'Cocked-back tomahawk' },
  'Posterizer':     { minDunk: 80, minH: 76, desc: 'Contact dunks over defenders' },
  'Windmill':       { minDunk: 85, minH: 75, desc: 'Full windmill (open lanes)' },
  'Bigs Contact':   { minDunk: 65, minH: 81, desc: 'Big man contact slams' },
};
OTC.LAYUP_PACKAGES = ['Smooth Finisher', 'Acrobat Euro', 'Floater Specialist', 'Power Finisher', 'Reverse Artist'];

// Assign a unique-ish animation set to a roster player (deterministic per name).
OTC.hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
OTC.assignAnimations = (b, r) => {
  const h = OTC.hashStr(b.name || 'x'), pick = (arr, salt) => arr[(h >>> salt) % arr.length];
  const big = b.pos === 'C' || b.pos === 'PF';
  const jbs = Object.keys(OTC.JUMPER_BASES).filter(k => big ? true : k !== 'Big Man Push');
  b.jumper = b.jumper && !b.auto ? b.jumper : (big && r.three < 60 ? 'Big Man Push' : pick(jbs, 3));
  b.dribble = b.auto || !b.dribble ? (big ? 'Big Man Bounce' : pick(Object.keys(OTC.DRIBBLE_STYLES).slice(0, 4), 7)) : b.dribble;
  b.cross = b.cross || (big ? 'Big Man Sweep' : pick(Object.keys(OTC.CROSS_STYLES).slice(0, 3), 11));
  b.sizeup = b.sizeup || (big ? 'Big Man Bounce' : pick(OTC.SIZEUPS, 13));
  b.ftStyle = b.ftStyle || pick(OTC.FREE_THROWS, 17);
  const dunks = Object.entries(OTC.DUNK_PACKAGES).filter(([, v]) => r.dunk >= v.minDunk && b.heightIn >= v.minH).map(([k]) => k);
  b.dunkPkg = b.dunkPkg || (dunks.length ? dunks[dunks.length - 1 - ((h >>> 19) % Math.min(2, dunks.length))] : 'Two-Hand Power');
  b.layupPkg = b.layupPkg || pick(OTC.LAYUP_PACKAGES, 23);
  return b;
};

// ---- Court Killa (takeover) for 90+ OVR. Specialty from strongest category.
OTC.KILLA = {
  Shooter:    { desc: 'Green window x2, limitless range, contests ignored', icon: '🎯' },
  Slasher:    { desc: 'Unstoppable drives, guaranteed posterizers', icon: '⚡' },
  Playmaker:  { desc: 'Laser passes, ankle breaks x2, teammates heat up', icon: '🧠' },
  Big:        { desc: 'Dominant post, blocks and boards locked in', icon: '🧱' },
  Lockdown:   { desc: 'Clamps: steals x2, ankle-proof, contests smother', icon: '🔒' },
};
OTC.killaType = (r, pos) => {
  const fin = (r.layup + r.dunk + r.closeShot) / 3, sht = (r.three + r.mid) / 2, ply = (r.handle + r.pass) / 2;
  const def = (r.perD + r.steal) / 2, big = (r.intD + r.block + r.dreb + r.post) / 4;
  const s = { Shooter: sht, Slasher: fin, Playmaker: ply, Lockdown: def - 2, Big: (pos === 'C' || pos === 'PF') ? big + 3 : big - 8 };
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
};
