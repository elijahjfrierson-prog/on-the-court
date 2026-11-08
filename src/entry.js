import './three-global.js';
import './data.js';
import './rosters.js';
import './audio.js';
import './world.js';
import './body.js';
import './render.js';
import './input.js';
import './showcase.js';
import './game.js';
import './ui.js';
const OTC = window.OTC;
const params = new URLSearchParams(location.search);
const SELFTEST = params.get('selftest') === '1';
const STORE = 'otc.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const saved = load();
const settings = Object.assign({ quality: 'High', meter: true, camera: '2K', difficulty: 'Pro', volume: 0.9, mouseMove: false, zoom: 1, autoQuality: true, lockStar: false }, saved.settings || {});
const save = Object.assign({ build: OTC.defaultBuild(), points: 25, season: { w: 0, l: 0 }, teamA: 'IND', teamB: 'LAL' }, saved.save || {});
save.build = Object.assign(OTC.defaultBuild(), save.build);
const quality = params.get('q') || settings.quality;
const canvas = document.getElementById('c');
const renderer = new OTC.Renderer(canvas, quality); renderer.autoQuality = settings.autoQuality;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.05, 200);
const world = new OTC.World(scene, renderer.r, quality);
renderer.setup(scene, camera);
addEventListener('resize', () => renderer.resize());
const audio = new OTC.Audio(); audio.setVolumes({ master: settings.volume });
const input = new OTC.Input();
const app = window.app = {
  scene, camera, renderer, world, audio, input, settings, save, game: null, paused: false, showroom: null,
  persist() { try { localStorage.setItem(STORE, JSON.stringify({ settings, save })); } catch {} },
  toast(m) { app.ui.toast(m); },
  clearShowroom() { if (app.showroom) { scene.remove(app.showroom.root); app.showroom = null; } },
  toMenu() { app.clearShowroom(); app.mode = 'menu'; },
  toShowroom(build) {
    app.clearShowroom(); const team = { color: build.jersey, trim: build.trim, short: 'OTC', text: '#fff' };
    const a = new OTC.Athlete(build, team); scene.add(a.root); app.showroom = a; app.mode = 'showroom';
  },
  startGame(opts) {
    audio.init(); app.endGame(); app.clearShowroom(); app.ui.clear();
    const o = Object.assign({}, opts); if (o.useStar !== false) o.star = save.build; o.lockStar = o.lockStar || settings.lockStar;
    app.game = new OTC.Game(app, o); app.mode = 'game'; app.paused = false; acc = 0;
  },
  endGame() { if (app.game) { app.game.dispose(); app.game = null; } },
  onGameOver(res) {
    res.opts = app.game.opts; let pts = 0;
    if (res.star) { pts = OTC.pointsForGame(res.star.stats, res.won); save.points += pts; }
    if (res.mode === 'season') { res.won ? save.season.w++ : save.season.l++; }
    app.persist(); setTimeout(() => app.ui.gameOver(res, pts), 1500);
  },
};
app.ui = new OTC.UI(app);
const show = OTC.showcase(app);
app.ui.title();
// ---- loop: fixed 60 Hz sim, interpolated render
const TICK = OTC.TICK; let acc = 0, last = performance.now(), menuT = 0, errors = 0;
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  try {
    if (app.mode === 'game' && app.game) {
      const g = app.game;
      const I = input.poll();
      if (I.pause && !g.over) { app.paused = !app.paused; app.paused ? app.ui.pause(g) : app.ui.clear(); }
      if (I.help) app.ui.toggleHelp();
      if (I.wheel) { settings.zoom = OTC.clamp((settings.zoom || 1) + I.wheel * 0.08, 0.6, 1.8); }
      if (I.mouse && I.mouse.in) { ray.setFromCamera(new THREE.Vector2(I.mouse.x, I.mouse.y), camera); const hit = new THREE.Vector3(); if (ray.ray.intersectPlane(ground, hit)) I.mouseTarget = hit; }
      if (!app.paused) {
        acc += dt; let first = true;
        while (acc >= TICK) {
          g.update(TICK, first ? I : { ...I, taps: [], pass: false, shoot: false, steal: false, block: false, switch: false, call: false, cam: false, meter: false, shootUp: false });
          first = false; acc -= TICK; if (!app.game) break;
        }
      }
      if (app.game) app.game.render(acc / TICK, dt);
    } else {
      input.poll(); menuT += dt;
      if (app.mode === 'showroom' && app.showroom) {
        const a = app.showroom, pos = new THREE.Vector3(0, 0, 0);
        a.pose({ pos, facing: menuT * 0.4, vel: { x: 0, z: 0 }, crouch: 0.03, stance: 'run' }, dt);
        camera.position.set(1.2, 1.5, 4.2); camera.lookAt(0.5, 1.05, 0); world.update(dt, pos);
      } else {
        const focus = show(dt); world.update(dt, focus);
        const a = menuT * 0.05; camera.position.set(focus.x + Math.sin(a) * 1.5 - 0.6, 2.4, focus.z - 4.6); camera.lookAt(focus.x, 1.3, focus.z + 6);
      }
    }
    renderer.render(dt);
  } catch (e) {
    errors++; console.error('OTC frame error', e);
    if (SELFTEST) console.log('OTC_SELFTEST_FAIL ' + e.message);
    else if (app.game && errors < 50) { try { app.game.startPossession(app.game.offense, 'check'); app.ui.toast('Recovered from an error'); } catch {} }
  }
}
requestAnimationFrame(frame);
addEventListener('error', (e) => { if (SELFTEST) console.log('OTC_SELFTEST_FAIL ' + e.message); });
// ---- self test: CPU-only game, verify sim stays finite, then signal the shell
if (SELFTEST || params.get('autoplay')) {
  setTimeout(() => {
    app.startGame({ mode: params.get('mode') || '5v5', teamA: 'IND', teamB: 'LAL', difficulty: 'Pro', useStar: params.get('star') === '1' });
    if (SELFTEST) {
      const g = app.game; let ticks = 0, ok = true;
      for (let i = 0; i < 3600; i++) { g.update(TICK, { mx: 0, my: 0, taps: [] }); ticks++; if (!isFinite(g.ball.pos.x + g.ball.pos.y + g.ball.pos.z)) { ok = false; break; } if (!app.game) break; }
      console.log(ok ? `OTC_SELFTEST_OK ticks=${ticks} score=${g.teams.map(t => t.score).join('-')}` : 'OTC_SELFTEST_FAIL nan');
    }
  }, 1500);
}
