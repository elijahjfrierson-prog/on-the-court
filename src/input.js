// ===== Input: keyboard + gamepad. Holds = movement, quick taps = combo inputs.
const OTC = window.OTC;
OTC.Input = class {
  constructor() {
    this.down = new Set(); this.pressed = new Set(); this.released = new Set(); this.taps = []; this.downAt = {};
    this.TAP = 0.17; this.gpPrev = {}; this.gpAxisTap = { x: 0, y: 0 };
    const map = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' };
    this.map = map;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Tab'].includes(e.key)) e.preventDefault();
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.down.has(k)) { this.pressed.add(k); this.downAt[k] = performance.now() / 1000; }
      this.down.add(k);
    });
    addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.down.delete(k); this.released.add(k);
      if (map[k] && performance.now() / 1000 - (this.downAt[k] || 0) < this.TAP) this.taps.push(map[k]);
    });
    addEventListener('blur', () => this.down.clear());
    // mouse: left hold = shoot, right click = pass, wheel = zoom, cursor = move target
    this.mouse = { x: 0, y: 0, in: false, lDown: false, lPress: false, lUp: false, rPress: false, wheel: 0 };
    const cv = document.getElementById('c');
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX / innerWidth * 2 - 1; this.mouse.y = -(e.clientY / innerHeight) * 2 + 1; this.mouse.in = true; });
    cv.addEventListener('mouseleave', () => { this.mouse.in = false; });
    cv.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.lDown = true; this.mouse.lPress = true; } if (e.button === 2) this.mouse.rPress = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0 && this.mouse.lDown) { this.mouse.lDown = false; this.mouse.lUp = true; } });
    cv.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  }
  // Snapshot for one sim tick. Movement is screen-relative: x = right, y = forward (away from camera).
  poll() {
    const s = { mx: 0, my: 0, sprint: false, pass: false, shoot: false, shootDown: false, shootUp: false, steal: false, block: false, blockDown: false, switch: false, call: false, taps: [], pause: false, meter: false, cam: false, help: false };
    const d = this.down, p = this.pressed, r = this.released;
    if (d.has('ArrowLeft')) s.mx -= 1; if (d.has('ArrowRight')) s.mx += 1; if (d.has('ArrowUp')) s.my += 1; if (d.has('ArrowDown')) s.my -= 1;
    // a quick tap shouldn't move the player much: only count holds longer than TAP
    const now = performance.now() / 1000;
    for (const [k, ax, val] of [['ArrowLeft', 'mx', -1], ['ArrowRight', 'mx', 1], ['ArrowUp', 'my', 1], ['ArrowDown', 'my', -1]])
      if (d.has(k) && now - (this.downAt[k] || now) < this.TAP * 0.8) s[ax] -= val;
    s.sprint = d.has('Shift');
    s.pass = p.has('a'); s.shoot = p.has('s'); s.shootDown = d.has('s'); s.shootUp = r.has('s');
    s.steal = p.has('d'); s.block = p.has('w'); s.blockDown = d.has('w'); s.switch = p.has('q') || p.has('Tab'); s.call = p.has(' ');
    s.pause = p.has('Escape') || p.has('p'); s.meter = p.has('m'); s.cam = p.has('c'); s.help = p.has('h');
    s.taps = this.taps.splice(0);
    const m = this.mouse;
    if (m.lPress) s.shoot = true; if (m.lDown) s.shootDown = true; if (m.lUp) s.shootUp = true;
    if (m.rPress) { s.pass = true; s.passMouse = true; }
    s.wheel = m.wheel; s.mouse = { x: m.x, y: m.y, in: m.in };
    m.lPress = m.lUp = m.rPress = false; m.wheel = 0;
    this.pollGamepad(s);
    this.pressed.clear(); this.released.clear();
    const len = Math.hypot(s.mx, s.my); if (len > 1) { s.mx /= len; s.my /= len; }
    return s;
  }
  pollGamepad(s) {
    const gps = navigator.getGamepads ? navigator.getGamepads() : []; const g = gps && [...gps].find(x => x);
    if (!g) return;
    const btn = (i) => !!(g.buttons[i] && g.buttons[i].pressed), prev = this.gpPrev;
    const edge = (i) => btn(i) && !prev[i], up = (i) => !btn(i) && prev[i];
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.2) { s.mx += ax; s.my -= ay; }
    // D-pad taps and right-stick flicks = combo inputs
    if (edge(14)) s.taps.push('L'); if (edge(15)) s.taps.push('R'); if (edge(12)) s.taps.push('U'); if (edge(13)) s.taps.push('D');
    const rx = g.axes[2] || 0, ry = g.axes[3] || 0, t = this.gpAxisTap;
    const flick = Math.abs(rx) > 0.75 ? (rx < 0 ? 'L' : 'R') : Math.abs(ry) > 0.75 ? (ry < 0 ? 'U' : 'D') : '';
    if (flick && flick !== t.last) s.taps.push(flick); t.last = flick;
    if (edge(2)) s.pass = true;                // X / Square (face left) = pass
    if (edge(0)) s.shoot = true; if (btn(0)) s.shootDown = true; if (up(0)) s.shootUp = true; // A / Cross = shoot
    if (edge(1)) s.steal = true;               // B / Circle
    if (edge(3)) s.block = true; if (btn(3)) s.blockDown = true; // Y / Triangle
    if (btn(7) || btn(6)) s.sprint = true;     // triggers
    if (edge(4) || edge(5)) s.switch = true;
    if (edge(9)) s.pause = true;
    for (let i = 0; i < g.buttons.length; i++) prev[i] = btn(i);
  }
};
