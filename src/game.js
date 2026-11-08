// ===== Game simulation: fixed 60 Hz tick. Rendering interpolates between ticks.
const OTC = window.OTC;
const G = 9.81;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = Math.random;
const flat = (v) => v3(v.x, 0, v.z);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
const fwdOf = (yaw) => v3(Math.sin(yaw), 0, Math.cos(yaw));
const rightOf = (yaw) => v3(-Math.cos(yaw), 0, Math.sin(yaw));

OTC.Game = class {
  constructor(app, opts) {
    this.app = app; this.opts = opts; this.mode = OTC.MODES[opts.mode] || OTC.MODES['3v3'];
    this.modeKey = opts.mode; this.diff = OTC.DIFFICULTY[opts.difficulty || 'Pro'];
    this.C = OTC.COURT; this.teams = []; this.time = 0; this.over = false;
    this.camYaw = 0; this.camPos = v3(0, 3, -5); this.camLook = v3(); this.camMode = app.settings.camera || '2K';
    this.combo = new OTC.ComboBuffer(0.26); this.tapLog = [];
    this.setupTeams(); this.setupBall();
    this.quarter = 1; this.clock = this.mode.qLen || 0; this.shotClock = this.mode.shotClock; this.dead = 0;
    this.popups = []; this.events = [];
    this.startPossession(this.teams[0], 'tip');
  }
  // ---------- setup ----------
  teamFromLeague(lt, n, home, star) {
    const team = { id: lt.abbr, name: lt.name, abbr: lt.abbr, city: lt.city, color: lt.color, alt: lt.alt, score: 0, players: [], cleared: true, home };
    const pool = lt.players.slice();
    const need = n === 5 ? ['PG', 'SG', 'SF', 'PF', 'C'] : n === 3 ? ['PG', 'SF', 'C'] : ['PG'];
    const chosen = [];
    if (star) chosen.push({ star: true });
    for (const pos of need) {
      if (chosen.length >= n) break;
      if (star && pos === star.pos) continue;
      let i = pool.findIndex(p => p.pos === pos); if (i < 0) i = 0;
      if (pool.length) chosen.push(pool.splice(i, 1)[0]);
    }
    while (chosen.length < n && pool.length) chosen.push(pool.shift());
    for (const c of chosen.slice(0, n)) {
      let b, r;
      if (c.star) { b = star; r = OTC.starRatings(star); }
      else { b = OTC.rosterBuild(c); r = OTC.ratingsFromOvr(c); b.auto = true; }
      OTC.assignAnimations(b, r);
      team.players.push(this.mkPlayer(b, r, team, !!c.star));
    }
    return team;
  }
  setupTeams() {
    const L = OTC.LEAGUE.teams, o = this.opts, star = o.star;
    const A = L.find(t => t.abbr === o.teamA) || L[0], B = L.find(t => t.abbr === o.teamB) || L[1];
    const m = this.modeKey;
    if (m === '21') {
      for (let i = 0; i < 3; i++) {
        const lt = [A, B, L[(L.indexOf(B) + 7) % L.length]][i];
        const t = this.teamFromLeague(lt, 1, i === 0, i === 0 && star ? star : null); t.name = t.players[0].build.name.split(' ').pop(); t.abbr = t.name.slice(0, 3).toUpperCase(); t.sign = 1; this.teams.push(t);
      }
    } else if (m === 'practice') {
      const t = this.teamFromLeague(A, 1, true, star); t.sign = 1; this.teams.push(t);
    } else {
      const n = this.mode.size;
      const ta = this.teamFromLeague(A, n, true, star || null), tb = this.teamFromLeague(B, n, false, null);
      ta.sign = 1; tb.sign = this.mode.full ? -1 : 1; this.teams.push(ta, tb);
    }
    this.human = this.teams[0].players.find(p => p.isStar) || this.teams[0].players[0];
    this.human.human = true;
    for (const t of this.teams) for (const p of t.players) {
      const home = t === this.teams[0];
      p.athlete = new OTC.Athlete(p.build, { color: home ? t.color : '#f2f2f2', trim: home ? t.alt : t.color, short: (t.name || '').toUpperCase().slice(0, 10), text: home ? '#ffffff' : t.color });
      this.app.scene.add(p.athlete.root);
    }
  }
  mkPlayer(build, r, team, isStar) {
    const phys = OTC.physicals(build, r);
    const ovr = OTC.overall(r, build.pos);
    return {
      build, r, phys, team, isStar, ovr, badges: OTC.badgesFor(r), killaType: ovr >= 90 ? OTC.killaType(r, build.pos) : null,
      pos: v3(), prev: v3(), vel: v3(), facing: 0, prevFacing: 0, hand: 'R', st: 100, state: 'idle',
      air: 0, jumpV: 0, move: null, stun: 0, fall: 0, react: 0, human: false, shot: null, aiT: rnd(), cutT: 3 + rnd() * 5, cutting: 0,
      stats: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0 }, killa: 0, killaOn: 0, stealCd: 0, handsUp: 0, celebrate: 0,
      lastTap: null, catchT: 0, dunk: null, lean: 0, latLean: 0, twist: 0, sprinting: false,
    };
  }
  setupBall() {
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(this.C.ballR, 32, 24), OTC.ballMaterial()); this.ballMesh.castShadow = true; this.app.scene.add(this.ballMesh);
    this.ball = { pos: v3(0, 1, 0), prev: v3(0, 1, 0), vel: v3(), state: 'held', holder: null, lastTouch: null, shot: null, pass: null, drib: null, spin: v3(), hold: v3() };
  }
  dispose() {
    for (const p of this.players()) this.app.scene.remove(p.athlete.root);
    this.app.scene.remove(this.ballMesh);
  }
  players() { return this.teams.flatMap(t => t.players); }
  opponents(team) { return this.players().filter(p => p.team !== team); }
  hoopFor(team) { const s = team.sign; return v3(0, this.C.rimH, s * this.C.hoopZ); }
  // hoop-local spot → world. d = distance from baseline toward midcourt.
  spot(team, x, d) { const s = team.sign; return v3(x * s, 0, s * (this.C.L / 2 - d)); }
  spots(n) {
    if (n >= 5) return [[0, 9.2], [-5.6, 6.6], [5.6, 6.6], [-6.4, 1.5], [2.4, 2.4]];
    if (n === 3) return [[0, 9.0], [-5.6, 4.8], [5.2, 2.2]];
    if (n === 2) return [[0, 9.0], [-5.6, 4.8]];
    return [[0, 9.0]];
  }
  // ---------- possession ----------
  startPossession(team, reason, spotPlayer = null) {
    this.offense = team; this.shotClock = this.mode.shotClock; team.cleared = true;
    const others = this.teams.filter(t => t !== team);
    const full = this.mode.full;
    const sp = this.spots(team.players.length);
    team.players.forEach((p, i) => { const s = sp[i % sp.length]; p.home = [s[0], s[1]]; });
    let holder = spotPlayer || team.players.find(p => p.build.pos === 'PG') || team.players[0];
    if (team === this.teams[0] && this.human.team === team && !spotPlayer) holder = this.human.isStar ? this.human : holder;
    const teleport = reason === 'tip' || reason === 'check' || !full;
    if (teleport) {
      team.players.forEach((p) => { const s = p === holder ? [0, full ? 13 : 9.6] : p.home; p.pos.copy(this.spot(team, s[0], s[1])); p.vel.set(0, 0, 0); p.facing = Math.atan2(-p.pos.x, team.sign * this.C.hoopZ - p.pos.z); });
      for (const t of others) t.players.forEach((p, i) => {
        const m = team.players[i % team.players.length]; const h = this.hoopFor(team);
        const dir = flat(h).sub(flat(m.pos)).normalize(); p.pos.copy(m.pos).addScaledVector(dir, 1.6 + i * 0.05); if (others.length > 1) p.pos.x += (i - 0.5) * 1.2 * (t === others[0] ? 1 : -1);
        p.vel.set(0, 0, 0); p.facing = Math.atan2(m.pos.x - p.pos.x, m.pos.z - p.pos.z);
      });
    } else {
      // full-court inbound: holder starts under his own (defended) basket
      holder.pos.set(1.2, 0, -team.sign * (this.C.L / 2 - 0.6)); holder.vel.set(0, 0, 0); holder.facing = team.sign > 0 ? 0 : Math.PI;
    }
    for (const p of this.players()) { p.prev.copy(p.pos); p.prevFacing = p.facing; p.shot = null; p.move = null; p.dunk = null; p.air = 0; p.state = 'idle'; }
    this.giveBall(holder, true);
    this.dead = reason === 'tip' ? 1.2 : teleport ? 0.9 : 0.6;
    this.assignDefense();
    if (this.human.team !== team || !this.human.isStar) this.pickHuman();
  }
  giveBall(p, hold = false) {
    const b = this.ball; b.holder = p; b.state = 'held'; b.shot = null; b.pass = null; b.drib = null; b.lastTouch = p.team;
    p.catchT = this.time; b.pos.copy(this.holdPoint(p)); b.prev.copy(b.pos); b.vel.set(0, 0, 0);
  }
  assignDefense() {
    const off = this.offense;
    for (const t of this.teams) if (t !== off) t.players.forEach((d, i) => { d.assign = off.players[i % off.players.length]; });
    if (this.modeKey === '21') {
      const defs = this.players().filter(p => p.team !== off);
      defs.forEach((d, i) => { d.assign = off.players[0]; d.sag = i === 1; });
    }
  }
  pickHuman() {
    const hTeam = this.teams[0];
    let cand;
    if (this.offense === hTeam) cand = this.ball.holder && this.ball.holder.team === hTeam ? this.ball.holder : this.human;
    else cand = this.human.isStar && this.modeKey !== '5v5' ? this.human : hTeam.players.slice().sort((a, b) => dist2(a.pos, this.ball.pos) - dist2(b.pos, this.ball.pos))[0];
    if (this.opts.lockStar && this.human.isStar) cand = this.human;
    if (cand && cand !== this.human) { this.human.human = false; this.human = cand; cand.human = true; }
  }
  // ---------- main tick ----------
  update(dt, input) {
    if (this.over) return;
    this.time += dt;
    for (const p of this.players()) { p.prev.copy(p.pos); p.prevFacing = p.facing; }
    this.ball.prev.copy(this.ball.pos);
    if (input.cam) { const order = Object.keys(OTC.CAMERAS); this.camMode = order[(order.indexOf(this.camMode) + 1) % order.length]; this.app.ui.toast('Camera: ' + this.camMode); }
    if (input.meter) { this.app.settings.meter = !this.app.settings.meter; this.app.ui.toast('Shot meter ' + (this.app.settings.meter ? 'ON' : 'OFF (time the wrist)')); }
    if (this.dead > 0) { this.dead -= dt; input = { ...input, shoot: false, pass: false, taps: [], shootUp: false }; }
    else {
      this.shotClock -= dt;
      if (this.mode.full && this.ball.state !== 'dead') { this.clock -= dt; if (this.clock <= 0) return this.endQuarter(); }
      if (this.shotClock <= 0 && this.ball.state !== 'shot') { this.app.audio.buzzer(); this.popup('SHOT CLOCK', 'bad'); return this.turnover(); }
    }
    this.controlHuman(dt, input);
    for (const p of this.players()) if (!p.human) this.ai(p, dt);
    for (const p of this.players()) this.movePlayer(p, dt);
    this.collide();
    this.updateBall(dt);
    this.updateKilla(dt);
    if (this.mode.cutthroat || !this.mode.full) this.checkClear();
  }
  // ---------- human control ----------
  camBasis() { return { f: fwdOf(this.camYaw), r: rightOf(this.camYaw) }; }
  controlHuman(dt, I) {
    const p = this.human, b = this.ball, { f, r } = this.camBasis();
    if (I.switch && this.offense !== p.team) {
      const mates = p.team.players.filter(q => q !== p).sort((a, c) => dist2(a.pos, b.pos) - dist2(c.pos, b.pos));
      if (mates[0]) { p.human = false; this.human = mates[0]; mates[0].human = true; }
      return;
    }
    let want = v3();
    if (I.mouseTarget && this.app.settings.mouseMove) {
      const d = flat(I.mouseTarget).sub(flat(p.pos)); const len = d.length();
      if (len > 0.6) want.copy(d.normalize()).multiplyScalar(Math.min(1, (len - 0.6) / 4));
    }
    want.addScaledVector(r, I.mx).addScaledVector(f, I.my);
    if (want.length() > 1) want.normalize();
    p.want = want; p.sprinting = I.sprint && want.length() > 0.3;
    for (const t of I.taps) { p.lastTap = { d: t, t: this.time }; }
    const hasBall = b.holder === p;
    if (hasBall) {
      for (const t of I.taps) { const m = this.combo.push(t); if (m) this.queueMove(p, m); }
      const m = this.combo.tick(dt); if (m) this.queueMove(p, m);
      this.app.ui.comboTrail(this.combo.seq);
      if (I.shoot && !p.shot && !p.dunk) this.startShot(p);
      if (I.pass && !p.shot) this.passBall(p, I.mouseTarget && I.passMouse ? I.mouseTarget : (want.length() > 0.2 ? flat(p.pos).add(want) : null));
    } else {
      if (I.taps.length) this.combo.seq = '';
      if (this.offense !== p.team) {
        if (I.steal) this.tryReach(p);
        if (I.block) this.jump(p, 0.9);
        p.handsUp = I.blockDown ? 0.25 : Math.max(0, p.handsUp - dt);
      } else {
        if (I.call) { const h = b.holder; if (h && h.team === p.team && !h.human) h.passTo = p; }
        if (I.block && b.state === 'loose') this.jump(p, 0.9);
        if (I.pass && b.holder && b.holder.team === p.team) b.holder.passTo = p;
      }
    }
    if (p.shot && p.shot.human && (I.shootUp || (!I.shootDown && p.shot.t > 0.08))) p.shot.release = true;
  }
  // ---------- movement ----------
  movePlayer(p, dt) {
    const b = this.ball;
    if (p.stun > 0) { p.stun -= dt; p.vel.multiplyScalar(Math.max(0, 1 - dt * 6)); p.fall = p.fallen ? Math.min(1, p.fall + dt * 4) : 0; if (p.stun <= 0) p.fallen = false; }
    else p.fall = Math.max(0, p.fall - dt * 2.5);
    // stamina
    const motor = 1 - (p.badges.motor || 0) * 0.08;
    if (p.sprinting && p.vel.length() > 3) p.st = Math.max(0, p.st - 5.5 * motor * dt); else p.st = Math.min(100, p.st + (this.dead > 0 ? 14 : 4.5) * dt);
    const stamF = OTC.staminaFactor(p.st);
    // jump
    if (p.air > 0 || p.jumpV > 0) { p.air += p.jumpV * dt; p.jumpV -= G * dt; if (p.air <= 0) { p.air = 0; p.jumpV = 0; if (p.landT !== this.time) { p.landT = this.time; } } }
    if (p.move) return this.runMove(p, dt);
    let target = v3();
    if (p.stun <= 0 && !p.shot && !p.dunk && p.air === 0) {
      const w = p.want || v3();
      const hasBall = b.holder === p;
      const top = (p.sprinting ? p.phys.sprint : p.phys.run * (hasBall ? 0.72 : 0.85)) * stamF * (hasBall ? (0.82 + p.r.speedBall / 99 * 0.18) : 1);
      target.copy(w).multiplyScalar(top);
    }
    if (p.shot || p.dunk) target.set(0, 0, 0);
    const accel = p.phys.accel * (p.air > 0 ? 0.1 : 1) * stamF;
    const dv = target.clone().sub(p.vel); const maxDv = accel * dt; if (dv.length() > maxDv) dv.setLength(maxDv);
    p.vel.add(dv);
    if (p.dunk) { this.runDunk(p, dt); return; }
    p.pos.addScaledVector(p.vel, dt);
    // facing
    const sp = p.vel.length();
    let face = p.facing;
    if (b.holder === p) { const h = this.hoopFor(p.team); const toH = Math.atan2(h.x - p.pos.x, h.z - p.pos.z); face = sp > 2.5 && !p.shot ? angLerp(toH, Math.atan2(p.vel.x, p.vel.z), 0.55) : toH; }
    else if (this.offense !== p.team && p.team) { const tgt = b.holder && (p.assign === b.holder || dist2(p.pos, b.pos) < 4) ? b.pos : (p.assign ? p.assign.pos : b.pos); face = Math.atan2(tgt.x - p.pos.x, tgt.z - p.pos.z); }
    else if (sp > 0.6) face = Math.atan2(p.vel.x, p.vel.z);
    else face = Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
    p.facing = angLerp(p.facing, face, Math.min(1, dt * (p.shot ? 14 : 9)));
    // lean into acceleration
    const fv = fwdOf(p.facing), rv = rightOf(p.facing);
    p.lean += ((dv.dot(fv) / Math.max(dt, 1e-3)) * 0.012 - p.lean) * Math.min(1, dt * 8);
    p.latLean += ((dv.dot(rv) / Math.max(dt, 1e-3)) * 0.012 - p.latLean) * Math.min(1, dt * 8);
    p.lean = OTC.clamp(p.lean, -0.35, 0.45); p.latLean = OTC.clamp(p.latLean, -0.5, 0.5);
    this.bounds(p);
  }
  bounds(p) {
    const C = this.C, mx = C.W / 2 + 1.2, mz = C.L / 2 + 1.2;
    p.pos.x = OTC.clamp(p.pos.x, -mx, mx); p.pos.z = OTC.clamp(p.pos.z, -mz, mz);
    if (!this.mode.full && p.pos.z < -1) p.pos.z = -1;
    if (this.ball.holder === p && this.dead <= 0 && (Math.abs(p.pos.x) > C.W / 2 + 0.05 || Math.abs(p.pos.z) > C.L / 2 + 0.05)) { this.popup('OUT OF BOUNDS', 'bad'); this.app.audio.whistle(); this.turnover(); }
  }
  collide() {
    const ps = this.players();
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], c = ps[j]; const rad = 0.24 * (a.phys.heightM + c.phys.heightM) / 2 + 0.12;
      const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < rad && d > 1e-4) {
        const push = (rad - d) / 2, nx = dx / d, nz = dz / d;
        const wa = a.build.weight, wc = c.build.weight, ta = wc / (wa + wc), tc = wa / (wa + wc);
        a.pos.x -= nx * push * 2 * ta; a.pos.z -= nz * push * 2 * ta; c.pos.x += nx * push * 2 * tc; c.pos.z += nz * push * 2 * tc;
      }
    }
  }
  // ---------- dribble moves ----------
  queueMove(p, m) {
    if (p.shot || p.dunk || p.air > 0 || this.ball.holder !== p) return;
    if (p.move) { if (!p.move.next && p.move.chain < OTC.MAX_CHAIN) p.move.next = m; return; }
    this.startMove(p, m, 1);
  }
  startMove(p, m, chain) {
    const sc = OTC.moveScale({ heightIn: p.build.heightIn, r: p.r, dribble: p.build.dribble });
    const cs = OTC.CROSS_STYLES[p.build.cross] || { t: 1, w: 1 };
    const stam = OTC.staminaFactor(p.st), tight = 1 - (p.badges.tight || 0) * 0.03;
    const h = this.hoopFor(p.team), yaw = Math.atan2(h.x - p.pos.x, h.z - p.pos.z);
    p.move = { m, i: -1, t: 0, chain, yaw, time: sc.time * cs.t * tight * (chain > 1 ? 0.92 : 1) / Math.max(0.75, stam), dist: sc.dist * cs.w * stam, next: null, spinStart: p.facing };
    p.st = Math.max(0, p.st - m.cost * (1 - (p.badges.motor || 0) * 0.08));
    if (p.human) this.app.ui.moveName(m.name, chain);
    this.nextPhase(p);
  }
  nextPhase(p) {
    const mv = p.move; mv.i++; mv.t = 0;
    if (mv.i >= mv.m.phases.length) {
      const next = mv.next, chain = mv.chain; p.move = null;
      if (this.ball.holder === p && this.ball.state === 'held') this.pushDribble(p, 'pound', this.dribblePeriod(p) * 0.8);
      if (next) this.startMove(p, next, chain + 1);
      return;
    }
    const ph = mv.m.phases[mv.i]; const b = this.ball;
    if (ph.hand && ph.hand !== p.hand) { p.hand = ph.hand; if (b.holder === p) this.pushDribble(p, ph.path, ph.t * mv.time); }
    else if ((ph.path === 'hold' || ph.path === 'spin') && b.holder === p) { b.state = 'held'; b.drib = null; }
    if (ph.ankle) this.ankleCheck(p, ph, mv);
    if (ph.path === 'cross' || ph.path === 'btl' || ph.path === 'btb' || ph.jet) this.app.audio.squeak(this.pan(p.pos));
  }
  runMove(p, dt) {
    const mv = p.move, ph = mv.m.phases[mv.i]; if (!ph) { p.move = null; return; }
    mv.t += dt;
    const f = fwdOf(mv.yaw), r = rightOf(mv.yaw).multiplyScalar(-1); // r: player's right when facing the hoop
    const want = v3().addScaledVector(r, ph.mv[0]).addScaledVector(f, ph.mv[1]).multiplyScalar(mv.dist);
    const k = Math.min(1, dt * 18); p.vel.lerp(want, k);
    p.pos.addScaledVector(p.vel, dt);
    if (ph.spin) p.facing = mv.yaw + ph.spin * Math.PI * 2 * Math.min(1, mv.t / (ph.t * mv.time));
    else p.facing = angLerp(p.facing, mv.yaw, Math.min(1, dt * 10));
    p.lean += ((ph.lean ? 0.12 : 0) + (ph.hesi ? -0.15 : 0) - p.lean) * Math.min(1, dt * 10);
    p.latLean += ((ph.lean || 0) * 0.9 - p.latLean) * Math.min(1, dt * 12);
    this.bounds(p);
    if (mv.t >= ph.t * mv.time && p.move === mv) this.nextPhase(p);
  }
  ankleCheck(p, ph, mv) {
    const defs = this.opponents(p.team).filter(d => dist2(d.pos, p.pos) < 2.4 && d.stun <= 0);
    if (!defs.length) return;
    const d = defs.sort((a, c) => dist2(a.pos, p.pos) - dist2(c.pos, p.pos))[0];
    const r = rightOf(mv.yaw).multiplyScalar(-1), lat = r.clone().multiplyScalar(Math.sign(ph.mv[0]) || 0);
    let ch = ph.ankle * 0.14 * (1 + (p.r.handle - d.r.perD) / 55) * OTC.staminaFactor(p.st) * (1 + 0.1 * (mv.chain - 1));
    ch *= 1 + (p.badges.ankle || 0) * 0.1; ch *= 1 - (d.badges.clamps || 0) * 0.09;
    if (lat.lengthSq() > 0 && d.vel.dot(lat) < -0.8) ch *= 1.9;
    if (p.killaOn > 0 && p.killaType === 'Playmaker') ch *= 2; if (d.killaOn > 0 && d.killaType === 'Lockdown') ch *= 0.2;
    ch = OTC.clamp(ch / (d.human ? 1.4 : this.diff), 0, 0.6);
    if (rnd() < ch) {
      d.stun = 0.9 + rnd() * 0.6; d.fallen = rnd() < 0.35 + ph.ankle * 0.15; d.vel.addScaledVector(lat, -2.2);
      this.popup(d.fallen ? 'ANKLES!!' : 'SHOOK!', 'hype'); this.app.audio.ooh(); this.hype(0.25); this.addKilla(p, 0.14);
    } else if (d.react < 0.2) d.react = 0.25;
  }
  // ---------- dribble physics ----------
  dribblePeriod(p) {
    const st = OTC.DRIBBLE_STYLES[p.build.dribble] || OTC.DRIBBLE_STYLES['Smooth Wing'];
    const h = (p.build.heightIn - 67) / 20;
    return 0.46 * (1 + h * 0.22) / st.tempo * (p.sprinting ? 0.82 : 1);
  }
  handHeight(p) { const st = OTC.DRIBBLE_STYLES[p.build.dribble] || OTC.DRIBBLE_STYLES['Smooth Wing']; return p.phys.heightM * 0.43 * st.low * (p.sprinting ? 1.08 : 1); }
  handPoint(p, ahead) {
    const f = fwdOf(p.facing), r = rightOf(p.facing).multiplyScalar(-1), s = p.hand === 'R' ? 1 : -1;
    const st = OTC.DRIBBLE_STYLES[p.build.dribble] || OTC.DRIBBLE_STYLES['Smooth Wing'];
    return flat(p.pos).addScaledVector(p.vel, ahead).addScaledVector(r, s * (0.26 + p.phys.heightM * 0.04) * st.wide).addScaledVector(f, 0.24).setY(this.handHeight(p));
  }
  holdPoint(p) {
    const f = fwdOf(p.facing), r = rightOf(p.facing).multiplyScalar(-1), s = p.hand === 'R' ? 1 : -1;
    const moving = p.move && p.move.m.phases[p.move.i];
    if (moving && moving.path === 'hold') return flat(p.pos).addScaledVector(r, s * 0.34).addScaledVector(f, 0.12).setY(p.phys.heightM * 0.5);
    return flat(p.pos).addScaledVector(f, 0.3).addScaledVector(r, s * 0.08).setY(p.phys.heightM * 0.62);
  }
  pushDribble(p, path = 'pound', T = null) {
    const b = this.ball; T = T || this.dribblePeriod(p);
    const f = fwdOf(p.facing), mid = flat(p.pos).addScaledVector(p.vel, T * 0.5);
    const target = this.handPoint(p, T);
    let bounce;
    if (path === 'cross') bounce = mid.clone().addScaledVector(f, 0.38);
    else if (path === 'btl') bounce = mid.clone().addScaledVector(f, 0.02);
    else if (path === 'btb') bounce = mid.clone().addScaledVector(f, -0.3);
    else bounce = flat(b.pos).lerp(flat(target), 0.55);
    const R = this.C.ballR, e = 0.8, h0 = Math.max(0.01, b.pos.y - R), h1 = Math.max(0.02, target.y - R);
    const total = (v0) => { const t1 = (-v0 + Math.sqrt(v0 * v0 + 2 * G * h0)) / G; const vu = e * (v0 + G * t1); const disc = vu * vu - 2 * G * h1; const t2 = disc > 0 ? (vu - Math.sqrt(disc)) / G : vu / G; return [t1 + t2, t1, t2]; };
    let lo = 0, hi = 40; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (total(m)[0] > T) lo = m; else hi = m; }
    const v0 = (lo + hi) / 2, [, t1, t2] = total(v0);
    b.state = 'dribble'; b.vel.set((bounce.x - b.pos.x) / t1, -v0, (bounce.z - b.pos.z) / t1);
    b.drib = { t: 0, T, t1, t2, path, bounced: false };
    if (path !== 'pound') this.app.audio.whoosh();
  }
  // ---------- shooting ----------
  startShot(p) {
    const h = this.hoopFor(p.team), d = dist2(p.pos, h), sp = p.vel.length();
    const tap = p.lastTap && this.time - p.lastTap.t < 0.6 ? p.lastTap.d : null;
    if (d < 1.8 || (d < 3.6 && sp > 2.2)) return this.startFinish(p, h, d, tap);
    const j = OTC.JUMPER_BASES[p.build.jumper] || OTC.JUMPER_BASES['Smooth One-Motion'];
    const floater = d < 5 && d >= 3.6 && sp > 1.5;
    p.move = null; this.combo.seq = '';
    p.shot = { t: 0, fill: (floater ? 0.42 : j.fill) * (1 + (p.build.heightIn - 76) * 0.006), human: p.human, release: false, j, floater, target: 0.96 + (rnd() - 0.5) * this.cpuSpread(p), jumped: false };
    const b = this.ball; if (b.holder === p) { b.state = 'held'; b.drib = null; }
    // pump-fake bite chance for close defenders happens on a quick release
  }
  cpuSpread(p) { const r = OTC.shotRatingFor(p.r, dist2(p.pos, this.hoopFor(p.team))); return (0.2 - r / 99 * 0.13) / this.diff; }
  updateShot(p, dt) {
    const s = p.shot; s.t += dt; const v = s.t / s.fill;
    if (!s.jumped && v >= 0.35) { s.jumped = true; const apex = (0.96 - 0.35) * s.fill; p.jumpV = Math.min(G * apex, Math.sqrt(2 * G * p.phys.jump * 0.55)); p.air = 0.001; }
    if (s.human && s.release && s.t < 0.12 && !s.jumped) { // pump fake
      p.shot = null; this.popup('PUMP FAKE', 'info');
      for (const d of this.opponents(p.team)) if (dist2(d.pos, p.pos) < 2.2 && rnd() < 0.5 * this.diff) this.jump(d, 0.8);
      return;
    }
    const auto = v >= 1.18;
    if ((s.human && s.release) || (!s.human && v >= s.target) || auto) this.releaseShot(p, v);
  }
  contestFor(p) {
    let best = 0, nd = null;
    for (const d of this.opponents(p.team)) {
      const dd = dist2(d.pos, p.pos);
      let c = OTC.contestAmount(dd, p.build.heightIn, d.build.heightIn, d.r.block);
      if (d.air > 0.15 || d.handsUp > 0) c *= 1.25; if (d.stun > 0) c *= 0.1;
      if (d.killaOn > 0 && d.killaType === 'Lockdown') c *= 1.3;
      if (c > best) { best = c; nd = d; }
    }
    return [OTC.clamp(best, 0, 1), nd];
  }
  releaseShot(p, v) {
    const b = this.ball, s = p.shot, h = this.hoopFor(p.team), d = dist2(p.pos, h);
    let [contest] = this.contestFor(p);
    let rating = s.floater ? (p.r.closeShot + p.r.mid) / 2 : OTC.shotRatingFor(p.r, d);
    const value = this.shotValue(p);
    if (value === 3) { rating += (p.badges.deadeye || 0) * 1.5; contest *= 1 - (p.badges.deadeye || 0) * 0.12; if (d > 8.5) rating -= Math.max(0, (d - 8.5) * (12 - (p.badges.range || 0) * 3)); }
    else rating += (p.badges.midai || 0) * 1.5;
    if (this.time - p.catchT < 1.2) rating += (p.badges.catch || 0) * 2;
    if (p.killaOn > 0 && p.killaType === 'Shooter') { rating += 15; contest *= 0.3; }
    rating -= (100 - p.st) * 0.08;
    const gr = OTC.gradeShot(v, rating, contest);
    const make = rnd() < gr.p;
    this.launchShot(p, h, make, gr.grade, value, s.j, s.floater);
    p.stats.fga++;
    if (p.human || this.app.settings.cpuFeedback) this.app.ui.shotFeedback(gr, this.app.settings.meter);
    if (gr.grade === 'green') { this.app.audio.green(); }
    p.shot = null; p.followT = 0.5;
  }
  shotValue(p) { const h = this.hoopFor(p.team); return OTC.shotValue(p.pos.x, Math.abs(h.z - p.pos.z)); }
  launchShot(p, h, make, grade, value, j, floater) {
    const b = this.ball, from = b.pos.clone();
    const dir = flat(h).sub(flat(from)).normalize(), lat = v3(dir.z, 0, -dir.x);
    const tgt = h.clone();
    if (!make) {
      const k = grade === 'red' ? 1 : 0.7, a = rnd();
      if (grade === 'red' && rnd() < 0.25) tgt.addScaledVector(dir, (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.3)); // airball
      else tgt.addScaledVector(dir, (a < 0.5 ? -1 : 1) * (0.2 + rnd() * 0.12) * k).addScaledVector(lat, (rnd() - 0.5) * 0.26);
    }
    const arc = (floater ? 58 : (j ? j.arc : 48)) * Math.PI / 180;
    const D = dist2(from, tgt), H = tgt.y - from.y;
    let th = arc; if (D * Math.tan(th) <= H + 0.1) th = Math.atan((H + 0.5) / Math.max(0.1, D));
    const vv = Math.sqrt(G * D * D / (2 * Math.cos(th) ** 2 * Math.max(0.05, D * Math.tan(th) - H)));
    const hd = flat(tgt).sub(flat(from)).normalize();
    b.vel.set(hd.x * vv * Math.cos(th), vv * Math.sin(th), hd.z * vv * Math.cos(th));
    b.state = 'shot'; b.holder = null; b.lastTouch = p.team; b.drib = null;
    b.shot = { shooter: p, make, value, grade, hoop: h, rimHit: false, counted: false, cleared: p.team.cleared, from: flat(p.pos) };
    b.spin.set(-hd.z * 18, 0, hd.x * 18);
  }
  startFinish(p, h, d, tap) {
    const pkg = OTC.DUNK_PACKAGES[p.build.dunkPkg] || OTC.DUNK_PACKAGES['Two-Hand Power'];
    const canDunk = p.r.dunk >= 55 && p.phys.reach + p.phys.jump > 3.25 && (p.sprinting || p.r.standDunk > 70 || d < 1.2);
    p.move = null; this.combo.seq = '';
    const kind = canDunk ? 'dunk' : tap === 'L' || tap === 'R' ? 'euro' : tap === 'D' ? 'hop' : tap === 'U' ? 'spin' : 'layup';
    const name = kind === 'dunk' ? p.build.dunkPkg : kind === 'euro' ? OTC.FINISHERS[tap] : kind === 'hop' ? OTC.FINISHERS.D : kind === 'spin' ? OTC.FINISHERS.U : OTC.FINISHERS.none;
    const T = kind === 'dunk' ? 0.62 : kind === 'euro' ? 0.7 : 0.55;
    const start = flat(p.pos), end = flat(h).addScaledVector(flat(h).sub(start).normalize(), kind === 'dunk' ? -0.45 : -0.75);
    if (kind === 'euro') end.addScaledVector(rightOf(p.facing), (tap === 'L' ? 1 : -1) * 0.35);
    p.dunk = { t: 0, T, kind, name, start, end, h, released: false, jumpH: kind === 'dunk' ? Math.max(0.5, 3.15 - p.phys.reach + 0.15) : p.phys.jump * 0.6 };
    const b = this.ball; if (b.holder === p) { b.state = 'held'; b.drib = null; }
    if (p.human) this.app.ui.moveName(name, 0);
  }
  runDunk(p, dt) {
    const k = p.dunk; k.t += dt; const u = Math.min(1, k.t / k.T);
    const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    p.pos.copy(k.start).lerp(k.end, ease); p.vel.copy(k.end).sub(k.start).multiplyScalar(1 / k.T);
    p.air = Math.sin(Math.min(1, u * 1.05) * Math.PI) * k.jumpH; p.jumpV = 0;
    p.facing = angLerp(p.facing, Math.atan2(k.h.x - p.pos.x, k.h.z - p.pos.z), dt * 10);
    if (k.kind === 'spin') p.facing += dt * 12;
    const relU = k.kind === 'dunk' ? 0.55 : 0.6;
    if (!k.released && u >= relU) {
      k.released = true;
      const [contest, d] = this.contestFor(p);
      let base = k.kind === 'dunk' ? 0.55 + p.r.dunk / 99 * 0.45 : 0.35 + p.r.layup / 99 * 0.5;
      if (k.kind === 'euro' || k.kind === 'spin') base += (p.badges.euro || 0) * 0.03;
      base -= contest * (k.kind === 'dunk' ? 0.35 - (p.badges.poster || 0) * 0.07 : 0.45 - (p.badges.contact || 0) * 0.05);
      if (p.killaOn > 0 && p.killaType === 'Slasher') base = 1;
      const make = rnd() < OTC.clamp(base, 0.05, 0.98);
      // block chance by the contester at the rim
      if (d && dist2(d.pos, p.pos) < 1.3 && (d.air > 0.2 || d.r.block > 75) && rnd() < (d.r.block / 99) * 0.35 * (1 + (d.badges.rimpro || 0) * 0.1) * (d.killaOn > 0 && d.killaType === 'Big' ? 1.6 : 1) * (p.killaOn > 0 && p.killaType === 'Slasher' ? 0 : 1)) {
        this.blocked(d, p); p.dunk = null; return;
      }
      p.stats.fga++;
      const b = this.ball;
      if (k.kind === 'dunk' && make) {
        b.pos.set(k.h.x, k.h.y + 0.15, k.h.z); b.vel.set(0, -4, 0); b.state = 'shot'; b.holder = null;
        b.shot = { shooter: p, make: true, value: 2, grade: 'dunk', hoop: k.h, rimHit: false, counted: false, cleared: p.team.cleared, dunk: true };
        this.app.audio.rim(1.3, this.pan(k.h)); this.popup(contest > 0.4 ? 'POSTERIZED!' : k.name.toUpperCase() + '!', 'hype'); this.hype(0.35); this.addKilla(p, 0.2);
        p.hang = 0.45;
      } else this.launchShot(p, k.h, make, make ? 'green' : 'yellow', 2, null, true);
    }
    if (u >= 1) { p.dunk = null; p.air = p.hang ? 0.35 : p.air; if (p.air > 0) p.jumpV = 0; }
  }
  blocked(d, shooter) {
    const b = this.ball; d.stats.blk++;
    const away = flat(b.pos).sub(flat(d.pos)).normalize();
    b.holder = null; b.state = 'loose'; b.shot = null; b.vel.set(away.x * 5 + (rnd() - 0.5) * 3, 2.5, away.z * 5 + (rnd() - 0.5) * 3); b.lastTouch = d.team;
    shooter.shot = null; shooter.dunk = null; this.popup('BLOCKED!', 'hype'); this.app.audio.board(1, this.pan(d.pos)); this.app.audio.ooh(); this.hype(0.2); this.addKilla(d, 0.15);
  }
  jump(p, power = 1) {
    if (p.air > 0 || p.stun > 0) return; p.jumpV = Math.sqrt(2 * G * p.phys.jump * power); p.air = 0.001; p.handsUp = 0.6;
    const b = this.ball;
    // block a jumper in its first frames
    if (b.state === 'shot' && b.shot && !b.shot.dunk && b.shot.shooter.team !== p.team) {
      const age = dist2(b.pos, b.shot.from);
      if (age < 1.6 && dist2(p.pos, b.pos) < 1.1 && p.phys.reach + p.phys.jump * power > b.pos.y && rnd() < 0.25 + p.r.block / 99 * 0.35) this.blocked(p, b.shot.shooter);
    }
  }
  // ---------- passing / steals ----------
  passBall(p, aim) {
    const mates = p.team.players.filter(q => q !== p); if (!mates.length) return;
    let to = p.passTo && mates.includes(p.passTo) ? p.passTo : null;
    if (!to) {
      const fdir = aim ? flat(aim).sub(flat(p.pos)).normalize() : fwdOf(p.facing);
      let best = -1e9; for (const q of mates) { const d = flat(q.pos).sub(flat(p.pos)); const dd = d.length(); const sc = d.normalize().dot(fdir) * 2 - dd / 14; if (sc > best) { best = sc; to = q; } }
    }
    p.passTo = null; p.move = null; p.shot = null;
    const b = this.ball, from = this.holdPoint(p);
    const D = dist2(from, to.pos), spd = 10 + p.r.pass / 99 * 6 + (p.killaOn > 0 && p.killaType === 'Playmaker' ? 4 : 0);
    const T = OTC.clamp(D / spd, 0.2, 1.1);
    const tgt = flat(to.pos).addScaledVector(to.vel, T).setY(to.phys.heightM * 0.68);
    b.pos.copy(from); b.vel.set((tgt.x - from.x) / T, (tgt.y - from.y) / T + 0.5 * G * T, (tgt.z - from.z) / T);
    b.state = 'pass'; b.holder = null; b.pass = { from: p, to, t: 0, T, checked: new Set() }; b.lastTouch = p.team; b.drib = null;
    this.app.audio.catchBall(this.pan(p.pos));
    if (to.human === false && p.human && p.team === this.teams[0]) { p.human = false; this.human = to; to.human = true; }
  }
  tryReach(d) {
    if (d.stealCd > this.time) return; d.stealCd = this.time + 0.55;
    const b = this.ball, h = b.holder; if (!h || dist2(d.pos, b.pos) > 1.25) return;
    let ch = 0.1 + (d.r.steal - h.r.handle) / 220 + (b.drib && b.drib.path !== 'pound' ? 0.18 : 0) + (b.state === 'held' ? -0.05 : 0);
    ch *= 1 + (d.badges.interceptor || 0) * 0.08; ch *= 1 - (h.badges.tight || 0) * 0.06;
    if (d.killaOn > 0 && d.killaType === 'Lockdown') ch *= 2;
    if (rnd() < OTC.clamp(ch, 0.02, 0.45)) {
      d.stats.stl++; this.popup('STOLEN!', 'hype'); this.app.audio.ooh(); this.addKilla(d, 0.12);
      b.holder = null; b.state = 'loose'; b.drib = null; const away = flat(b.pos).sub(flat(h.pos)).normalize();
      b.vel.set(away.x * 3, 2, away.z * 3); b.lastTouch = d.team;
    }
  }
  // ---------- ball physics ----------
  updateBall(dt) {
    const b = this.ball, C = this.C, R = C.ballR;
    const h = b.holder;
    if (h && (b.state === 'held')) {
      if (h.shot) { this.updateShot(h, dt); if (b.holder === h && h.shot) b.pos.copy(this.shotBallPoint(h)); return; }
      if (h.dunk) { b.pos.copy(this.dunkBallPoint(h)); return; }
      b.pos.lerp(this.holdPoint(h), Math.min(1, dt * 20));
      const moving = h.vel.length() > 0.5 || h.move;
      if (!h.move && this.dead <= 0 && (moving || this.time - h.catchT > 0.8)) this.pushDribble(h, 'pound');
      return;
    }
    if (h && b.state === 'dribble') {
      if (h.shot || h.dunk) { b.state = 'held'; return; }
      const d = b.drib; d.t += dt;
      b.vel.y -= G * dt; b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y <= R && b.vel.y < 0) {
        b.pos.y = R; d.bounced = true; b.vel.y = -b.vel.y * 0.8;
        const tgt = this.handPoint(h, d.t2); const t2 = Math.max(0.06, d.t2);
        b.vel.x = (tgt.x - b.pos.x) / t2; b.vel.z = (tgt.z - b.pos.z) / t2;
        this.app.audio.bounce(0.7, this.pan(b.pos));
      }
      if (d.bounced && (b.vel.y <= 0.4 || b.pos.y >= this.handHeight(h) - 0.02)) {
        if (dist2(b.pos, h.pos) > 1.6) { b.holder = null; b.state = 'loose'; this.popup('LOST IT', 'bad'); }
        else if (h.move) { const ph = h.move.m.phases[h.move.i]; if (ph && (ph.path === 'hold' || ph.path === 'spin')) { b.state = 'held'; b.drib = null; } else this.pushDribble(h, 'pound', ph ? Math.max(0.2, ph.t * h.move.time) : null); }
        else this.pushDribble(h, 'pound');
      }
      // on-ball CPU reach-ins can hit an exposed crossover
      return;
    }
    if (b.state === 'dead') return;
    // free flight: shot / pass / loose
    b.vel.y -= G * dt; b.pos.addScaledVector(b.vel, dt);
    b.spin.multiplyScalar(1 - dt * 0.3);
    if (b.state === 'pass') {
      const ps = b.pass; ps.t += dt;
      const to = ps.to, chest = flat(to.pos).setY(to.phys.heightM * 0.68 + to.air);
      if (b.pos.distanceTo(chest) < 0.75 || (ps.t > ps.T && dist2(b.pos, to.pos) < 1.2)) { this.catchBy(to, ps.from); return; }
      for (const d of this.opponents(to.team)) {
        if (ps.checked.has(d)) continue;
        const dd = b.pos.distanceTo(flat(d.pos).setY(Math.min(b.pos.y, d.phys.reach + d.air)));
        if (dd < 0.6) { ps.checked.add(d); if (rnd() < 0.18 + d.r.steal / 99 * 0.3 * (1 + (d.badges.interceptor || 0) * 0.1)) { d.stats.stl++; this.popup('PICKED OFF!', 'hype'); this.catchBy(d, null, true); return; } }
      }
      if (ps.t > ps.T + 0.6) { b.state = 'loose'; b.pass = null; }
    }
    // hoop collisions
    for (const hp of this.app.world.hoops) this.hoopCollide(b, hp, dt);
    // floor
    if (b.pos.y < R) { b.pos.y = R; if (b.vel.y < 0) { if (Math.abs(b.vel.y) > 1) this.app.audio.bounce(Math.min(1, Math.abs(b.vel.y) / 6), this.pan(b.pos)); b.vel.y = -b.vel.y * 0.76; b.vel.x *= 0.88; b.vel.z *= 0.88; } if (b.state === 'shot') b.state = 'loose'; }
    if (b.state === 'shot' && b.vel.y < 0 && b.pos.y < C.rimH - 0.5) b.state = 'loose';
    // scoring
    if ((b.state === 'shot' || b.state === 'loose') && b.prev.y > C.rimH && b.pos.y <= C.rimH) {
      for (const hp of this.app.world.hoops) {
        if (Math.hypot(b.pos.x, b.pos.z - hp.z) < C.rimR - R * 0.4) { this.scored(hp); return; }
      }
    }
    // rebounds / loose ball pickup
    if (b.state === 'loose' || (b.state === 'shot' && b.vel.y < 0 && b.shot && !b.shot.make)) {
      for (const p of this.players()) {
        if (p.stun > 0.3) continue;
        const reach = p.phys.reach + p.air + (p.killaOn > 0 && p.killaType === 'Big' ? 0.3 : 0);
        if (dist2(p.pos, b.pos) < 0.7 && b.pos.y < reach && b.pos.y > 0.0) { this.rebound(p); return; }
      }
    }
    // out of bounds
    if (b.state === 'loose' && b.pos.y < 1.5 && (Math.abs(b.pos.x) > C.W / 2 + 0.2 || Math.abs(b.pos.z) > C.L / 2 + 0.2 || (!this.mode.full && b.pos.z < -2))) {
      this.app.audio.whistle(); this.popup('OUT OF BOUNDS', 'info');
      const t = this.teams.find(tt => tt !== b.lastTouch) || this.teams[0];
      this.startPossession(t, this.mode.full ? 'inbound' : 'check');
    }
  }
  shotBallPoint(p) {
    const s = p.shot, v = OTC.clamp(s.t / s.fill, 0, 1.1), f = fwdOf(p.facing), r = rightOf(p.facing).multiplyScalar(-1);
    const H = p.phys.heightM, chest = flat(p.pos).addScaledVector(f, 0.3).setY(H * 0.62 + p.air), set = flat(p.pos).addScaledVector(f, 0.18).addScaledVector(r, 0.08).setY(H * (s.j ? s.j.releaseH : 1.1) + p.air);
    const k = OTC.clamp((v - 0.15) / 0.75, 0, 1); return chest.lerp(set, k * k * (3 - 2 * k));
  }
  dunkBallPoint(p) {
    const k = p.dunk, u = OTC.clamp(k.t / k.T, 0, 1), f = fwdOf(p.facing), H = p.phys.heightM;
    const chest = flat(p.pos).addScaledVector(f, 0.3).setY(H * 0.62 + p.air);
    const over = flat(p.pos).addScaledVector(f, k.kind === 'dunk' ? 0.35 : 0.25).setY(p.phys.reach + p.air - 0.1);
    return chest.lerp(over, OTC.clamp(u * 1.6, 0, 1));
  }
  hoopCollide(b, hp, dt) {
    const C = this.C, R = C.ballR, noRim = b.state === 'shot' && b.shot && b.shot.make;
    // rim ring
    if (!noRim) {
      const dx = b.pos.x, dz = b.pos.z - hp.z, hd = Math.hypot(dx, dz);
      if (hd > 0.001 && Math.abs(b.pos.y - C.rimH) < 0.3 && hd < C.rimR + 0.4) {
        const cx = dx / hd * C.rimR, cz = hp.z + dz / hd * C.rimR;
        const n = v3(b.pos.x - cx, b.pos.y - C.rimH, b.pos.z - cz), d = n.length();
        if (d < R + 0.009) {
          n.normalize(); b.pos.set(cx, C.rimH, cz).addScaledVector(n, R + 0.01);
          const vn = b.vel.dot(n); if (vn < 0) { b.vel.addScaledVector(n, -vn * 1.55); b.vel.multiplyScalar(0.82); this.app.audio.rim(Math.min(1, -vn / 5), this.pan(b.pos)); if (b.shot) b.shot.rimHit = true; this.app.world.netHit(hp, 0.3); }
        }
      }
    }
    // backboard plane (faces the court)
    const s = Math.sign(hp.z), face = s * (C.boardZ - 0.02);
    if (Math.abs(b.pos.x) < C.boardW / 2 + R && b.pos.y > C.boardBottom - R && b.pos.y < C.boardBottom + C.boardH + R) {
      if (s * b.pos.z + R > s * face && s * b.prev.z + R <= s * face + 0.05 && s * b.vel.z > 0) {
        b.pos.z = face - s * R; b.vel.z *= -0.62; b.vel.x *= 0.85; this.app.audio.board(Math.min(1, Math.abs(b.vel.z) / 5), this.pan(b.pos)); if (b.shot) b.shot.rimHit = true;
      }
    }
  }
  catchBy(p, from, steal = false) {
    const b = this.ball; const prevTeam = b.lastTouch;
    if (p.team !== this.offense) { this.changeOffense(p.team); }
    this.giveBall(p); p.assistFrom = steal ? null : from; p.assistT = this.time;
    this.app.audio.catchBall(this.pan(p.pos));
    if (p.team === this.teams[0] && this.human !== p && (this.offense === p.team) && !this.opts.lockStar) { this.human.human = false; this.human = p; p.human = true; }
  }
  rebound(p) {
    const b = this.ball, sh = b.shot;
    p.stats.reb++;
    if (sh && sh.shooter.team !== p.team && sh.value) this.popup('REBOUND', 'info');
    b.shot = null; b.pass = null;
    if (p.team !== this.offense) this.changeOffense(p.team);
    else this.shotClock = Math.max(this.shotClock, 14);
    this.giveBall(p); this.addKilla(p, 0.05);
    if (p.team === this.teams[0] && !this.opts.lockStar) { this.human.human = false; this.human = p; p.human = true; }
  }
  changeOffense(team) {
    this.offense = team; this.shotClock = this.mode.shotClock;
    if (!this.mode.full) team.cleared = false;
    const sp = this.spots(team.players.length); team.players.forEach((p, i) => { const s = sp[i % sp.length]; p.home = [s[0], s[1]]; });
    this.assignDefense(); this.pickHuman();
  }
  checkClear() {
    const t = this.offense; if (t.cleared) return;
    const h = this.ball.holder; if (h && h.team === t && dist2(h.pos, this.hoopFor(t)) > this.C.threeR + 0.3) { t.cleared = true; if (h.human) this.app.ui.toast('Cleared'); }
  }
  scored(hp) {
    const b = this.ball, sh = b.shot, C = this.C;
    this.app.world.netHit(hp, 1, b.vel.x * 0.05, b.vel.z * 0.05);
    if (!sh) { this.startPossession(this.teams.find(t => t !== this.offense) || this.offense, 'check'); return; }
    const p = sh.shooter, team = p.team;
    if (!sh.cleared && !this.mode.full) { this.popup('TAKE IT BACK!', 'bad'); this.app.audio.whistle(); this.startPossession(this.teams.find(t => t !== team) || team, 'check'); return; }
    let val = sh.value;
    if (this.modeKey === '21' || this.modeKey === '3v3' || this.modeKey === '1v1' || this.modeKey === 'park') val = sh.value; // 2s and 3s
    team.score += val; p.stats.pts += val; p.stats.fgm++;
    if (p.assistFrom && this.time - p.assistT < 3 && p.assistFrom.team === team) p.assistFrom.stats.ast++, this.addKilla(p.assistFrom, 0.1);
    if (!sh.rimHit && !sh.dunk) this.app.audio.swish(this.pan(hp.group.position)); 
    if (sh.grade === 'green' && !sh.dunk) { p.celebrate = 1.4; }
    this.app.audio.cheer(val === 3 ? 1.2 : 0.9); this.hype(val === 3 ? 0.3 : 0.18); this.addKilla(p, val === 3 ? 0.2 : 0.16);
    this.popup(`${p.build.name.split(' ').pop().toUpperCase()} +${val}`, team === this.teams[0] ? 'good' : 'bad');
    b.shot = null; b.state = 'dead'; b.vel.set(0, -2, 0);
    // win checks
    const tgt = this.mode.target;
    if (tgt) {
      if (this.mode.exact && team.score > tgt) { team.score = 13; this.popup('BUST! BACK TO 13', 'bad'); }
      else if (team.score >= tgt) return this.endGame(team);
    }
    const next = this.mode.makeItTakeIt || this.modeKey === '21' || this.modeKey === 'practice' ? team : (this.teams.find(t => t !== team) || team);
    setTimeout(() => { if (!this.over) this.startPossession(next, this.mode.full ? 'inbound' : 'check', this.modeKey === '21' ? p : null); }, 900);
    this.dead = 1.2;
  }
  turnover() {
    const t = this.teams.find(tt => tt !== this.offense) || this.offense;
    const b = this.ball; if (b.holder) b.holder = null; b.state = 'dead';
    this.startPossession(t, this.mode.full ? 'inbound' : 'check');
  }
  endQuarter() {
    this.app.audio.buzzer();
    if (this.quarter >= (this.mode.quarters || 4) && this.teams[0].score !== this.teams[1].score) return this.endGame(this.teams[0].score > this.teams[1].score ? this.teams[0] : this.teams[1]);
    this.quarter++; this.clock = this.quarter > (this.mode.quarters || 4) ? 60 : this.mode.qLen;
    this.popup(this.quarter > 4 ? 'OVERTIME' : `Q${this.quarter}`, 'info');
    this.startPossession(this.teams[this.quarter % 2], 'tip');
  }
  endGame(winner) {
    this.over = true; this.app.audio.buzzer(); this.app.audio.cheer(1.5);
    const me = this.human.team === this.teams[0] ? this.teams[0] : this.human.team, won = winner === me;
    const star = this.teams[0].players.find(p => p.isStar);
    this.app.onGameOver({ winner, won, star, teams: this.teams, mode: this.modeKey });
  }
  // ---------- Court Killa ----------
  addKilla(p, amt) { if (!p.killaType || p.killaOn > 0) return; p.killa = Math.min(1, p.killa + amt); if (p.killa >= 1) { p.killaOn = 35; p.killa = 0; this.popup('COURT KILLA · ' + p.killaType.toUpperCase(), 'killa'); this.app.audio.cheer(1.3); this.hype(0.4); } }
  updateKilla(dt) { for (const p of this.players()) { if (p.killaOn > 0) p.killaOn = Math.max(0, p.killaOn - dt); else p.killa = Math.max(0, p.killa - dt * 0.004); } }
  hype(a) { this.app.world.hype = Math.min(1, this.app.world.hype + a); this.app.audio.setHype(this.app.world.hype); }
  popup(text, kind) { this.app.ui.popup(text, kind); }
  pan(pos) { const { r } = this.camBasis(); return OTC.clamp(-flat(pos).sub(flat(this.camPos)).dot(r) / 10, -1, 1); }
  // ---------- AI ----------
  ai(p, dt) {
    p.want = p.want || v3(); p.sprinting = false;
    if (p.stun > 0 || p.shot || p.dunk) { p.want.set(0, 0, 0); return; }
    const b = this.ball, off = this.offense === p.team;
    if (this.modeKey === 'practice') { p.want.set(0, 0, 0); return; }
    if (b.state === 'loose' || (b.state === 'shot' && b.vel.y < 1)) return this.aiRebound(p, dt);
    if (off) { if (b.holder === p) this.aiHandler(p, dt); else this.aiOffBall(p, dt); }
    else this.aiDefend(p, dt);
  }
  goTo(p, tgt, sprint = false, slow = 0.5) {
    const d = flat(tgt).sub(flat(p.pos)); const len = d.length();
    if (len < 0.25) { p.want.set(0, 0, 0); return len; }
    p.want.copy(d.normalize()).multiplyScalar(Math.min(1, len / slow)); p.sprinting = sprint && len > 2.5; return len;
  }
  aiRebound(p, dt) {
    const b = this.ball;
    // predict where the ball comes down to reach height
    let t = 0, py = b.pos.y, vy = b.vel.y; const reach = p.phys.reach * 0.85;
    for (let i = 0; i < 90; i++) { t += 1 / 60; vy -= G / 60; py += vy / 60; if (vy < 0 && py < reach) break; }
    const land = v3(b.pos.x + b.vel.x * t, 0, b.pos.z + b.vel.z * t);
    const d = this.goTo(p, land, true, 0.3);
    if (d < 1.2 && b.vel.y < 0 && b.pos.y < reach + p.phys.jump && b.pos.y > reach - 0.4 && rnd() < 0.08 * this.diff + p.r.oreb / 2000) this.jump(p, 1);
  }
  aiOffBall(p, dt) {
    const t = p.team, h = this.hoopFor(t);
    p.cutT -= dt;
    if (p.cutT <= 0 && !p.cutting) { p.cutting = 1.8; p.cutT = 5 + rnd() * 6; }
    let tgt;
    if (this.mode.full && this.ball.holder && Math.sign(this.ball.holder.pos.z) !== Math.sign(t.sign) && Math.abs(this.ball.holder.pos.z) > 3) {
      tgt = this.spot(t, p.home[0], p.home[1] + 3); // running the floor
    } else if (p.cutting > 0) { p.cutting -= dt; tgt = v3(h.x + (p.home[0] > 0 ? 0.8 : -0.8), 0, h.z - t.sign * 1.4); if (p.cutting <= 0) p.cutting = 0; }
    else tgt = this.spot(t, p.home[0], p.home[1]);
    this.goTo(p, tgt, this.mode.full, 0.8);
  }
  aiHandler(p, dt) {
    const t = p.team, h = this.hoopFor(t), b = this.ball;
    p.aiT -= dt;
    const dHoop = dist2(p.pos, h);
    const defs = this.opponents(t), nd = defs.slice().sort((a, c) => dist2(a.pos, p.pos) - dist2(c.pos, p.pos))[0];
    const open = nd ? dist2(nd.pos, p.pos) : 9;
    if (this.dead > 0) { p.want.set(0, 0, 0); return; }
    if (!t.cleared) { this.goTo(p, this.spot(t, p.pos.x * t.sign * 0.5, 9.8), false, 1); return; }
    if (p.passTo) { this.passBall(p); return; }
    if (p.aiT > 0) return;
    p.aiT = 0.28 + rnd() * 0.2;
    const sr = OTC.shotRatingFor(p.r, dHoop), clock = this.shotClock;
    const val = this.shotValue(p);
    const range = dHoop < (val === 3 ? 8.3 : 7.3) && (val !== 3 || p.r.three > 62);
    if (dHoop < 2.8 && (open > 0.9 || p.r.dunk > 80)) { p.sprinting = true; this.startShot(p); return; }
    if (range && (open > 2.3 - sr / 99 * 0.6 || clock < 3) && rnd() < 0.55 + sr / 300) { this.startShot(p); return; }
    // drive if lane is clear-ish
    const lane = flat(h).sub(flat(p.pos)).normalize();
    const blocked = defs.some(d => { const rel = flat(d.pos).sub(flat(p.pos)); const along = rel.dot(lane); return along > 0 && along < 3 && Math.abs(rel.x * lane.z - rel.z * lane.x) < 0.9; });
    if (open < 1.6 && rnd() < 0.25 + p.r.handle / 300 && p.st > 25) { const pool = OTC.MOVES.filter(m => !m.sig || p.r.handle > 80); this.queueMove(p, pool[Math.floor(rnd() * pool.length)]); return; }
    if (!blocked || p.r.speedBall > 80 && rnd() < 0.4) { p.want.copy(lane); p.sprinting = dHoop > 4; return; }
    const mates = t.players.filter(q => q !== p);
    if (mates.length && rnd() < 0.5) {
      const best = mates.map(q => [q, Math.min(...defs.map(d => dist2(d.pos, q.pos)))]).sort((a, c) => c[1] - a[1])[0];
      if (best && best[1] > 1.6) { this.passBall(p, best[0].pos); return; }
    }
    const side = v3(lane.z, 0, -lane.x).multiplyScalar(rnd() < 0.5 ? 1 : -1);
    p.want.copy(side.multiplyScalar(0.7).addScaledVector(lane, 0.3));
  }
  aiDefend(p, dt) {
    const off = this.offense, m = p.assign || off.players[0], h = this.hoopFor(off), b = this.ball;
    const onBall = b.holder === m;
    const toHoop = flat(h).sub(flat(m.pos)); const dh = toHoop.length(); toHoop.normalize();
    let gap = onBall ? 1.0 + (1 - p.r.perD / 99) * 0.5 : OTC.clamp(dh * 0.32, 1.4, 3.6);
    if (p.sag) gap = Math.max(2.5, dh * 0.6);
    let tgt = flat(m.pos).addScaledVector(toHoop, Math.min(gap, dh - 0.5));
    if (!onBall && b.holder) tgt.lerp(flat(b.holder.pos), 0.22);
    if (this.mode.full && Math.sign(m.pos.z) !== Math.sign(h.z) && Math.abs(m.pos.z) > 4) tgt.lerp(v3(0, 0, h.z * 0.6), 0.5); // get back
    // reaction lag
    p.seen = p.seen || tgt.clone();
    const rate = (3 + p.r.perD / 99 * 9) * this.diff * (p.react > 0 ? 0.25 : 1); p.react = Math.max(0, p.react - dt);
    p.seen.lerp(tgt, Math.min(1, dt * rate));
    this.goTo(p, p.seen, dist2(p.pos, p.seen) > 3, 0.6);
    // contest shooters
    if (b.holder === m && m.shot && dist2(p.pos, m.pos) < 2.4 && p.air === 0 && m.shot.t / m.shot.fill > 0.4 && rnd() < 0.12 * this.diff * (0.5 + p.r.block / 99)) this.jump(p, 0.85);
    if (b.holder === m && m.dunk && dist2(p.pos, m.pos) < 1.8 && p.air === 0 && rnd() < 0.15 * this.diff) this.jump(p, 1);
    p.handsUp = b.holder === m && m.shot ? 0.3 : Math.max(0, p.handsUp - dt);
    if (onBall && dist2(p.pos, m.pos) < 1.2 && rnd() < dt * (0.35 + p.r.steal / 200) * this.diff) this.tryReach(p);
  }
  // ---------- render ----------
  render(alpha, dt) {
    const b = this.ball, C = this.C;
    for (const p of this.players()) {
      const pos = p.prev.clone().lerp(p.pos, alpha); const facing = angLerp(p.prevFacing, p.facing, alpha);
      this.poseAthlete(p, pos, facing, dt);
    }
    const bp = b.prev.clone().lerp(b.pos, alpha); this.ballMesh.position.copy(bp);
    this.ballMesh.rotation.x += (b.vel.z * 3 + b.spin.x) * dt; this.ballMesh.rotation.z -= (b.vel.x * 3 - b.spin.z) * dt;
    if (b.state === 'dead' && this.dead > 0) { b.vel.y -= G * dt; b.pos.addScaledVector(b.vel, dt); if (b.pos.y < C.ballR) { b.pos.y = C.ballR; b.vel.y *= -0.6; } }
    this.updateCamera(dt);
    this.app.world.setClocks(Math.max(0, Math.ceil(this.shotClock)), this.mode.full ? this.fmtClock() : `${this.teams[0].score}-${this.teams[1] ? this.teams[1].score : ''}`);
    this.app.world.hype = Math.max(0.15, this.app.world.hype - dt * 0.03);
    this.app.ui.hud(this);
  }
  fmtClock() { const c = Math.max(0, this.clock); return `${Math.floor(c / 60)}:${String(Math.floor(c % 60)).padStart(2, '0')}`; }
  poseAthlete(p, pos, facing, dt) {
    const b = this.ball, H = p.phys.heightM, f = fwdOf(facing), r = rightOf(facing).multiplyScalar(-1);
    const P = { pos, facing, vel: p.vel, crouch: 0.05, lean: p.lean, latLean: p.latLean, jump: p.air, stance: 'run', fall: p.fall, lHand: null, rHand: null, handsUp: p.handsUp > 0 };
    const isHolder = b.holder === p;
    if (this.offense !== p.team && p.team) { P.stance = 'defense'; P.crouch = 0.2; }
    if (isHolder) {
      P.stance = 'run'; P.crouch = 0.1 * (OTC.DRIBBLE_STYLES[p.build.dribble] || { low: 1 }).low + (p.move ? 0.06 : 0);
      const ballP = this.ballMesh.position, side = p.hand === 'R' ? 'rHand' : 'lHand', off = p.hand === 'R' ? 'lHand' : 'rHand';
      if (b.state === 'dribble') {
        const top = ballP.clone().add(v3(0, this.C.ballR + 0.02, 0)); const hh = this.handHeight(p);
        P[side] = ballP.y > hh * 0.55 ? top : flat(ballP).setY(Math.max(ballP.y + 0.25, hh * 0.8));
        const close = this.opponents(p.team).some(d => dist2(d.pos, p.pos) < 1.6);
        if (close) P[off] = flat(pos).addScaledVector(f, 0.35).addScaledVector(r, (p.hand === 'R' ? -1 : 1) * 0.2).setY(H * 0.6 + p.air);
      } else {
        P.lHand = ballP.clone().addScaledVector(r, -0.12); P.rHand = ballP.clone().addScaledVector(r, 0.12);
      }
      if (p.shot) {
        P.stance = 'shoot'; const v = p.shot.t / p.shot.fill; P.crouch = v < 0.35 ? 0.05 + (p.shot.j ? p.shot.j.dip : 0.1) * Math.sin(v / 0.35 * Math.PI) : 0.04;
        if (v > 0.85) P.lHand = flat(pos).addScaledVector(f, 0.15).addScaledVector(r, -0.25).setY(H * 1.0 + p.air);
      }
      if (p.dunk) { P.stance = 'shoot'; P.crouch = 0.02; }
    }
    if (p.followT > 0) { p.followT -= dt; const wristSnap = flat(pos).addScaledVector(f, 0.42).addScaledVector(r, 0.08).setY(H * 1.18 + p.air); P.rHand = wristSnap; P.stance = 'shoot'; }
    if (p.hang > 0) { p.hang -= dt; const hz = this.hoopFor(p.team); P.rHand = v3(hz.x, this.C.rimH + 0.05, hz.z - Math.sign(hz.z) * 0.2); P.lHand = P.rHand.clone().add(v3(0.25, 0, 0)); P.jump = Math.max(p.air, this.C.rimH - p.phys.reach + 0.05); }
    if (p.celebrate > 0) { p.celebrate -= dt; P.rHand = flat(pos).addScaledVector(r, 0.25).setY(H * 1.25); }
    if (P.handsUp && P.stance === 'defense') { P.lHand = flat(pos).addScaledVector(r, -0.25).addScaledVector(f, 0.15).setY(p.phys.reach + p.air); P.rHand = flat(pos).addScaledVector(r, 0.25).addScaledVector(f, 0.15).setY(p.phys.reach + p.air - 0.05); }
    p.athlete.pose(P, dt);
  }
  updateCamera(dt) {
    const p = this.human, cam = this.app.camera, preset = OTC.CAMERAS[this.camMode] || OTC.CAMERAS['2K'];
    const ht = this.human.team, offense = this.offense === ht;
    const defended = this.mode.full ? -ht.sign : ht.sign;
    const yawWant = offense ? (ht.sign > 0 ? 0 : Math.PI) : (defended > 0 ? Math.PI : 0);
    this.camYaw = angLerp(this.camYaw, yawWant, Math.min(1, dt * 2.5));
    const zoom = this.app.settings.zoom || 1;
    const focus = flat(p.prev.clone().lerp(p.pos, 0.5)).lerp(flat(this.ballMesh.position), 0.25);
    let pos, look;
    if (preset.side) {
      pos = v3(-(this.C.W / 2 + preset.dist * zoom), preset.height, focus.z * 0.85); look = v3(focus.x * 0.4, 1.2, focus.z * 0.9);
    } else {
      const f = fwdOf(this.camYaw);
      pos = focus.clone().addScaledVector(f, -preset.dist * zoom * (1 + (p.build.heightIn - 76) * 0.01)).setY(preset.height * (0.9 + zoom * 0.1));
      look = focus.clone().addScaledVector(f, preset.ahead).setY(preset.lookH);
      if (this.ball.state === 'shot') look.y += Math.min(1.5, Math.max(0, this.ballMesh.position.y - 2) * 0.4);
    }
    const k = 1 - Math.exp(-dt * preset.smooth);
    this.camPos.lerp(pos, k); this.camLook.lerp(look, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camLook);
    if (cam.fov !== preset.fov) { cam.fov = preset.fov; cam.updateProjectionMatrix(); }
    this.app.world.update(dt, focus);
  }
};
OTC.CAMERAS = {
  '2K':        { dist: 6.0, height: 3.3, ahead: 5.5, lookH: 1.2, fov: 52, smooth: 5 },
  'End Court': { dist: 4.6, height: 2.5, ahead: 6.5, lookH: 1.4, fov: 55, smooth: 6 },
  'Drive':     { dist: 3.4, height: 2.0, ahead: 4, lookH: 1.3, fov: 62, smooth: 8 },
  'Park':      { dist: 8.5, height: 5.2, ahead: 4.5, lookH: 0.8, fov: 48, smooth: 4 },
  'Ankle':     { dist: 3.0, height: 0.7, ahead: 4.0, lookH: 1.6, fov: 64, smooth: 7 },
  'Broadcast': { side: true, dist: 12, height: 7.5, fov: 40, smooth: 3 },
  'Sideline':  { side: true, dist: 6, height: 3.2, fov: 55, smooth: 4 },
};
