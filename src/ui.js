// ===== Menus, Build Court Star, HUD =====
const OTC = window.OTC;
const CSS = `
#ui{font-family:'Arial Black',Arial,sans-serif}
.screen{position:absolute;inset:0;display:flex;flex-direction:column;background:linear-gradient(90deg,rgba(5,4,14,.92) 0%,rgba(5,4,14,.55) 45%,rgba(5,4,14,0) 75%)}
.logo{font-size:64px;letter-spacing:6px;margin:60px 0 0 70px;line-height:.95;text-shadow:0 6px 30px rgba(0,0,0,.8)}
.logo span{color:#f2b632}.tag{margin:8px 0 30px 74px;color:#b9a8ff;font:600 15px Arial;letter-spacing:3px}
.menu{margin-left:70px;display:flex;flex-direction:column;gap:8px;width:360px}
.btn{background:rgba(20,16,48,.85);border:1px solid #3b2f7a;color:#fff;padding:13px 20px;font:900 18px 'Arial Black',Arial;letter-spacing:2px;text-align:left;cursor:pointer;transition:all .12s;clip-path:polygon(0 0,100% 0,96% 100%,0 100%)}
.btn:hover,.btn.sel{background:#f2b632;color:#120c2c;padding-left:30px}
.btn.small{font-size:13px;padding:8px 14px}
.panel{position:absolute;background:rgba(10,8,26,.9);border:1px solid #2c2460;padding:18px;font:600 13px Arial;color:#ddd;overflow:auto}
.panel h3{font:900 15px 'Arial Black';color:#f2b632;margin:0 0 10px;letter-spacing:2px}
.row{display:flex;align-items:center;gap:10px;margin:7px 0}.row label{width:120px;color:#aaa}
.row input[type=range]{flex:1;accent-color:#f2b632}.row select,.row input[type=text],.row input[type=number]{flex:1;background:#151032;color:#fff;border:1px solid #3b2f7a;padding:5px}
.tabs{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}.tab{padding:6px 10px;background:#151032;cursor:pointer;font:900 11px 'Arial Black';letter-spacing:1px}.tab.on{background:#f2b632;color:#120c2c}
.attr{display:grid;grid-template-columns:130px 1fr 34px 22px;align-items:center;gap:6px;margin:3px 0;font-size:12px}
.bar{height:8px;background:#221a4a;position:relative}.bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#6b4bd9,#f2b632)}.bar b{position:absolute;top:-2px;bottom:-2px;width:2px;background:#fff}
.ovr{font:900 54px 'Arial Black';color:#f2b632;line-height:1}.arch{font:900 14px 'Arial Black';color:#fff;letter-spacing:1px}
.swatch{width:26px;height:26px;display:inline-block;cursor:pointer;border:2px solid transparent;margin:2px}.swatch.on{border-color:#fff}
.badge{display:inline-block;padding:4px 8px;margin:3px;font:900 10px Arial;border-radius:3px}
.t1{background:#8a5a2b}.t2{background:#8b96a8;color:#111}.t3{background:#d6a21e;color:#111}.t4{background:linear-gradient(90deg,#7b2ff7,#f107a3)}
/* HUD */
#hud{position:absolute;inset:0;pointer-events:none}
.bug{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);display:flex;align-items:stretch;font:900 20px 'Arial Black';box-shadow:0 8px 30px rgba(0,0,0,.6)}
.bug .tm{padding:6px 16px;display:flex;gap:12px;align-items:center}.bug .sc{min-width:34px;text-align:center}
.bug .clk{background:#0c0a1c;padding:6px 14px;font-size:16px;display:flex;gap:12px;align-items:center}.bug .sh{color:#ff3b30}
.pop{position:absolute;top:22%;left:50%;transform:translateX(-50%);font:900 46px 'Arial Black';letter-spacing:3px;text-shadow:0 4px 20px rgba(0,0,0,.9);animation:pop 1.3s forwards;white-space:nowrap}
.pop.hype{color:#f2b632}.pop.good{color:#4cff8a}.pop.bad{color:#ff5b5b}.pop.info{color:#fff;font-size:30px}.pop.killa{color:#ff2bd6;font-size:52px}
@keyframes pop{0%{opacity:0;transform:translate(-50%,10px) scale(.8)}12%{opacity:1;transform:translate(-50%,0) scale(1.05)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-20px)}}
.meter{position:absolute;width:14px;height:110px;background:rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.8)}.meter i{position:absolute;left:0;right:0;bottom:0;background:#fff}.meter .g{position:absolute;left:-4px;right:-4px;background:rgba(60,255,120,.85)}.meter .y{position:absolute;left:0;right:0;background:rgba(255,210,60,.5)}
.fb{position:absolute;top:30%;left:50%;transform:translateX(-50%);font:900 26px 'Arial Black';animation:pop 1.1s forwards}
.mv{position:absolute;left:28px;bottom:120px;font:900 18px 'Arial Black';color:#fff;text-shadow:0 2px 10px #000}.mv small{display:block;color:#f2b632;font-size:12px}
.trail{position:absolute;left:28px;bottom:160px;font:900 30px Arial;color:#f2b632;letter-spacing:6px}
.stam{position:absolute;left:28px;bottom:96px;width:180px;height:7px;background:rgba(0,0,0,.5)}.stam i{position:absolute;inset:0 auto 0 0;background:#4cff8a}
.killa{position:absolute;left:28px;bottom:84px;width:180px;height:5px;background:rgba(0,0,0,.5)}.killa i{position:absolute;inset:0 auto 0 0;background:#ff2bd6}
.toast{position:absolute;top:18px;right:22px;background:rgba(10,8,26,.85);padding:8px 14px;font:700 13px Arial;border-left:3px solid #f2b632}
.help{position:absolute;right:18px;top:60px;width:330px;font:600 12px Arial;line-height:1.55}
.k{font-family:'Courier New',monospace;font-weight:900;color:#f2b632}
`;
OTC.UI = class {
  constructor(app) {
    this.app = app; this.root = document.getElementById('ui');
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.hudEl = document.createElement('div'); this.hudEl.id = 'hud'; this.root.appendChild(this.hudEl);
    this.layer = document.createElement('div'); this.root.appendChild(this.layer);
    this.hudEl.innerHTML = `<div class="bug" id="bug"></div><div class="meter" id="meter" style="display:none"><div class="y"></div><div class="g"></div><i></i></div>
      <div class="trail" id="trail"></div><div class="mv" id="mv"></div><div class="stam"><i id="stam"></i></div><div class="killa"><i id="killa"></i></div><div class="panel help" id="help" style="display:none"></div>`;
    this.hudEl.style.display = 'none';
  }
  el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  clear() { this.layer.innerHTML = ''; }
  btn(parent, label, fn, cls = '') { const b = document.createElement('div'); b.className = 'btn ' + cls; b.textContent = label; b.onclick = () => { this.app.audio.init(); this.app.audio.click(); fn(); }; parent.appendChild(b); return b; }
  // ---------- title ----------
  title() {
    this.clear(); this.hudEl.style.display = 'none'; this.app.toMenu();
    const s = this.el(`<div class="screen"><div class="logo">ON THE<br><span>COURT</span></div><div class="tag">NEXT-GEN HOOPS · ${OTC.LEAGUE.season} ROSTERS</div><div class="menu"></div></div>`);
    const m = s.querySelector('.menu');
    this.btn(m, 'PLAY NOW', () => this.play());
    this.btn(m, 'BUILD COURT STAR', () => this.builder());
    this.btn(m, 'SEASON', () => this.play('season'));
    this.btn(m, 'PRACTICE', () => this.app.startGame({ mode: 'practice', teamA: this.app.save.teamA || 'IND', useStar: true }));
    this.btn(m, 'SETTINGS', () => this.settings());
    this.btn(m, 'CONTROLS', () => this.controls());
    const star = this.app.save.build, r = OTC.starRatings(star);
    s.appendChild(this.el(`<div class="panel" style="right:30px;bottom:30px;width:300px"><h3>YOUR COURT STAR</h3><div class="arch">${star.name} · ${star.pos} · ${OTC.fmtHeight(star.heightIn)}</div><div class="ovr">${OTC.overall(r, star.pos)}</div><div class="arch" style="color:#b9a8ff">${OTC.archetypeName(star)}</div><div style="margin-top:6px">Skill points: <b style="color:#f2b632">${this.app.save.points}</b> · Season ${this.app.save.season.w}-${this.app.save.season.l}</div></div>`));
    this.layer.appendChild(s);
  }
  teamOptions(sel) { return OTC.LEAGUE.teams.slice().sort((a, b) => a.full.localeCompare(b.full)).map(t => `<option value="${t.abbr}" ${t.abbr === sel ? 'selected' : ''}>${t.full} (${t.ovr})</option>`).join(''); }
  play(preset) {
    this.clear(); const sv = this.app.save;
    const s = this.el(`<div class="screen"><div class="logo" style="font-size:40px">${preset === 'season' ? 'SEASON' : 'PLAY NOW'}</div><div class="tag">PICK YOUR RUN</div>
      <div class="panel" style="left:70px;top:170px;width:440px">
        <div class="row"><label>Mode</label><select id="mode">${Object.entries(OTC.MODES).filter(([k]) => preset === 'season' ? k === 'season' : k !== 'season').map(([k, m]) => `<option value="${k}">${m.name} — ${m.desc}</option>`).join('')}</select></div>
        <div class="row"><label>Your team</label><select id="ta">${this.teamOptions(sv.teamA || 'IND')}</select></div>
        <div class="row"><label>Opponent</label><select id="tb">${this.teamOptions(sv.teamB || 'LAL')}</select></div>
        <div class="row"><label>Difficulty</label><select id="df">${Object.keys(OTC.DIFFICULTY).map(d => `<option ${d === (this.app.settings.difficulty) ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div class="row"><label>Play as</label><select id="star"><option value="1">My Court Star (${sv.build.name})</option><option value="0">Team (best player)</option></select></div>
        <div class="row"><label>Lock camera</label><select id="lock"><option value="0">Follow ball</option><option value="1">My player only</option></select></div>
        ${preset === 'season' ? `<div>Record: <b>${sv.season.w}-${sv.season.l}</b> · Game ${sv.season.w + sv.season.l + 1} of 20</div>` : ''}
      </div><div class="menu" style="position:absolute;left:70px;bottom:50px;width:300px"></div></div>`);
    const m = s.querySelector('.menu');
    if (preset === 'season') { const L = OTC.LEAGUE.teams; s.querySelector('#tb').value = L[(sv.season.w + sv.season.l + 3) % L.length].abbr; }
    this.btn(m, 'TIP OFF', () => {
      const o = { mode: s.querySelector('#mode').value, teamA: s.querySelector('#ta').value, teamB: s.querySelector('#tb').value, difficulty: s.querySelector('#df').value, useStar: s.querySelector('#star').value === '1', lockStar: s.querySelector('#lock').value === '1' };
      sv.teamA = o.teamA; sv.teamB = o.teamB; this.app.settings.difficulty = o.difficulty; this.app.persist();
      this.app.startGame(o);
    });
    this.btn(m, 'BACK', () => this.title(), 'small');
    this.layer.appendChild(s);
  }
  // ---------- Build Court Star ----------
  builder(tab = 'BODY') {
    this.clear(); const app = this.app, b = app.save.build;
    app.toShowroom(b);
    const s = this.el(`<div class="screen" style="background:none"><div class="panel" style="left:24px;top:24px;bottom:24px;width:400px"><h3>BUILD COURT STAR</h3><div class="tabs"></div><div id="tabBody"></div></div>
      <div class="panel" style="right:24px;top:24px;bottom:24px;width:380px" id="attrs"></div>
      <div class="menu" style="position:absolute;left:450px;bottom:30px;width:260px;margin:0"></div></div>`);
    const tabs = ['BODY', 'LOOK', 'ARCHETYPE', 'ANIMATIONS', 'UPGRADES', 'BADGES'];
    const tb = s.querySelector('.tabs');
    for (const t of tabs) { const d = document.createElement('div'); d.className = 'tab' + (t === tab ? ' on' : ''); d.textContent = t; d.onclick = () => this.builder(t); tb.appendChild(d); }
    const body = s.querySelector('#tabBody');
    const refresh = (rebuild = true) => { app.persist(); if (rebuild) app.toShowroom(b); this.renderAttrs(s.querySelector('#attrs')); };
    const slider = (label, key, min, max, step, fmt) => {
      const row = this.el(`<div class="row"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${b[key]}"><span style="width:60px;text-align:right"></span></div>`);
      const inp = row.querySelector('input'), out = row.querySelector('span'); const show = () => out.textContent = fmt ? fmt(+inp.value) : inp.value; show();
      inp.oninput = () => { b[key] = +inp.value; show(); if (key === 'heightIn') { const [a, c] = OTC.weightRange(b.heightIn); b.weight = OTC.clamp(b.weight, a, c); const [w0, w1] = OTC.wingRange(b.heightIn); b.wing = OTC.clamp(b.wing, w0, w1); } refresh(); };
      body.appendChild(row); return row;
    };
    const select = (label, key, opts, onch) => {
      const row = this.el(`<div class="row"><label>${label}</label><select>${opts.map(o => `<option ${String(o) === String(b[key]) ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`);
      row.querySelector('select').onchange = (e) => { b[key] = e.target.value; if (onch) onch(); refresh(); this.builder(tab); }; body.appendChild(row);
    };
    if (tab === 'BODY') {
      const nm = this.el(`<div class="row"><label>Name</label><input type="text" value="${b.name}"></div>`); nm.querySelector('input').oninput = (e) => { b.name = e.target.value; app.persist(); }; body.appendChild(nm);
      select('Position', 'pos', OTC.POSITIONS, () => { const l = OTC.ARCH_2K17[b.pos]; if (!l.find(a => a[0] === b.arch17)) b.arch17 = l[0][0]; });
      slider('Height', 'heightIn', 67, 87, 1, OTC.fmtHeight);
      const [w0, w1] = OTC.weightRange(b.heightIn); slider('Weight', 'weight', w0, w1, 1, v => v + ' lbs');
      const [g0, g1] = OTC.wingRange(b.heightIn); slider('Wingspan / Arms', 'wing', g0, g1, 1, OTC.fmtHeight);
      slider('Shoulders', 'shoulders', 0, 1, 0.05, v => Math.round(v * 100) + '%');
      slider('Leg length', 'legs', 0, 1, 0.05, v => Math.round(v * 100) + '%');
      body.appendChild(this.el(`<div style="margin-top:10px;color:#999">Taller = higher blocks, boards and standing dunks, slower handles. Longer arms = defense, slightly lower shooting. Heavier = strength, less speed.</div>`));
    } else if (tab === 'LOOK') {
      const sk = this.el(`<div><div style="color:#aaa;margin:6px 0">Skin tone</div></div>`); OTC.SKIN_TONES.forEach((c, i) => { const w = document.createElement('span'); w.className = 'swatch' + (b.skin === i ? ' on' : ''); w.style.background = c; w.onclick = () => { b.skin = i; refresh(); this.builder(tab); }; sk.firstChild.after(w); }); body.appendChild(sk);
      select('Hair', 'hairName', OTC.HAIR, null); body.lastChild.querySelector('select').value = OTC.HAIR[b.hair]; body.lastChild.querySelector('select').onchange = (e) => { b.hair = OTC.HAIR.indexOf(e.target.value); refresh(); };
      const hc = this.el(`<div><div style="color:#aaa;margin:6px 0">Hair color</div></div>`); OTC.HAIR_COLORS.forEach((c, i) => { const w = document.createElement('span'); w.className = 'swatch' + ((b.hairColor || 0) === i ? ' on' : ''); w.style.background = c; w.onclick = () => { b.hairColor = i; refresh(); this.builder(tab); }; hc.appendChild(w); }); body.appendChild(hc);
      select('Facial hair', 'beardName', OTC.BEARDS, null); body.lastChild.querySelector('select').value = OTC.BEARDS[b.beard]; body.lastChild.querySelector('select').onchange = (e) => { b.beard = OTC.BEARDS.indexOf(e.target.value); refresh(); };
      select('Arm sleeve', 'sleeveName', ['None', 'Forearm sleeve', 'Full sleeve'], null); body.lastChild.querySelector('select').value = ['None', 'Forearm sleeve', 'Full sleeve'][b.sleeve || 0]; body.lastChild.querySelector('select').onchange = (e) => { b.sleeve = ['None', 'Forearm sleeve', 'Full sleeve'].indexOf(e.target.value); refresh(); };
      const num = this.el(`<div class="row"><label>Jersey #</label><input type="number" min="0" max="99" value="${b.number}"></div>`); num.querySelector('input').onchange = (e) => { b.number = OTC.clamp(+e.target.value | 0, 0, 99); refresh(); }; body.appendChild(num);
      const jc = this.el(`<div class="row"><label>Jersey / trim</label><input type="color" value="${b.jersey}"><input type="color" value="${b.trim}"></div>`); const [c1, c2] = jc.querySelectorAll('input'); c1.onchange = () => { b.jersey = c1.value; refresh(); }; c2.onchange = () => { b.trim = c2.value; refresh(); }; body.appendChild(jc);
    } else if (tab === 'ARCHETYPE') {
      select('System', 'system', ['2K20', '2K17']);
      if (b.system === '2K20') { select('Primary skill', 'primary', OTC.SKILLS); select('Secondary skill', 'secondary', OTC.SKILLS); }
      else select('Archetype', 'arch17', OTC.ARCH_2K17[b.pos].map(a => a[0]));
      body.appendChild(this.el(`<div class="arch" style="margin-top:12px;font-size:20px;color:#f2b632">${OTC.archetypeName(b)}</div>`));
      const caps = OTC.computeCaps(b), ovr = OTC.overall(caps, b.pos);
      body.appendChild(this.el(`<div style="margin-top:6px;color:#bbb">Max potential: <b style="color:#fff">${ovr} OVR</b>${ovr >= 90 ? ` · Court Killa: <b style="color:#ff2bd6">${OTC.killaType(caps, b.pos)}</b>` : ''}</div>`));
    } else if (tab === 'ANIMATIONS') {
      select('Jump shot', 'jumper', Object.keys(OTC.JUMPER_BASES)); body.appendChild(this.el(`<div style="color:#888;margin:-4px 0 6px 130px">${(OTC.JUMPER_BASES[b.jumper] || {}).desc || ''}</div>`));
      select('Free throw', 'ftStyle', OTC.FREE_THROWS);
      select('Dribble style', 'dribble', Object.keys(OTC.DRIBBLE_STYLES));
      select('Crossover', 'cross', Object.keys(OTC.CROSS_STYLES));
      select('Size-up', 'sizeup', OTC.SIZEUPS);
      const r = OTC.starRatings(b);
      const dunks = Object.entries(OTC.DUNK_PACKAGES).map(([k, v]) => (r.dunk >= v.minDunk && b.heightIn >= v.minH) ? k : k + ' (locked)');
      select('Dunk package', 'dunkPkg', dunks);
      select('Layup package', 'layupPkg', OTC.LAYUP_PACKAGES);
      select('Celebration', 'celebration', OTC.CELEBRATIONS);
      if (b.dunkPkg && b.dunkPkg.endsWith('(locked)')) b.dunkPkg = 'Two-Hand Power';
    } else if (tab === 'UPGRADES') {
      b.upg = b.upg || {};
      const caps = OTC.computeCaps(b), r = OTC.starRatings(b);
      body.appendChild(this.el(`<div style="margin-bottom:8px">Skill points: <b style="color:#f2b632;font-size:18px">${app.save.points}</b> — earn more every game.</div>`));
      for (const [k, label] of OTC.ATTRS) {
        const row = this.el(`<div class="attr"><span>${label}</span><div class="bar"><i style="width:${r[k]}%"></i><b style="left:${caps[k]}%"></b></div><span>${r[k]}</span><div class="btn small" style="padding:2px 6px;text-align:center">+</div></div>`);
        row.querySelector('.btn').onclick = () => { const cost = OTC.upgradeCost(r[k]); if (r[k] >= caps[k] || app.save.points < cost) return; b.upg[k] = (b.upg[k] || 0) + 1; app.save.points -= cost; refresh(false); this.builder(tab); };
        body.appendChild(row);
      }
      this.btn(body, 'MAX TO CAPS (DEV)', () => { OTC.maxToCaps(b); b.dev99 = false; refresh(false); this.builder(tab); }, 'small');
      this.btn(body, b.dev99 ? 'DEV 99: ON (tap to turn off)' : 'DEV 99: ALL 99 OVERALL', () => { b.dev99 = !b.dev99; refresh(false); this.builder(tab); }, 'small');
    } else if (tab === 'BADGES') {
      const r = OTC.starRatings(b), bd = OTC.badgesFor(r);
      for (const x of OTC.BADGES) body.appendChild(this.el(`<div style="margin:4px 0"><span class="badge ${bd[x.id] ? 't' + bd[x.id] : ''}" style="${bd[x.id] ? '' : 'background:#222;color:#666'}">${x.name}${bd[x.id] ? ' · ' + OTC.BADGE_TIERS[bd[x.id]] : ''}</span> <span style="color:#999">${x.desc}</span></div>`));
    }
    const m = s.querySelector('.menu');
    this.btn(m, 'TEST IN PRACTICE', () => app.startGame({ mode: 'practice', teamA: app.save.teamA || 'IND', useStar: true }));
    this.btn(m, 'DONE', () => this.title());
    this.layer.appendChild(s); this.renderAttrs(s.querySelector('#attrs'));
  }
  renderAttrs(el) {
    const b = this.app.save.build, r = OTC.starRatings(b), caps = OTC.computeCaps(b), ovr = OTC.overall(r, b.pos), bd = OTC.badgesFor(r);
    let h = `<div class="ovr">${ovr}</div><div class="arch">${OTC.archetypeName(b)}</div><div style="color:#aaa;margin-bottom:8px">${b.pos} · ${OTC.fmtHeight(b.heightIn)} · ${b.weight} lbs · ${OTC.fmtHeight(b.wing)} wingspan · max ${OTC.overall(caps, b.pos)}</div>`;
    let cat = '';
    for (const [k, label, c] of OTC.ATTRS) { if (c !== cat) { cat = c; h += `<h3 style="margin-top:10px">${OTC.CATS[c]}</h3>`; } h += `<div class="attr"><span>${label}</span><div class="bar"><i style="width:${r[k]}%"></i><b style="left:${caps[k]}%"></b></div><span>${r[k]}</span><span style="color:#666">${caps[k]}</span></div>`; }
    h += `<h3 style="margin-top:10px">Badges</h3>` + Object.entries(bd).map(([id, t]) => `<span class="badge t${t}">${OTC.BADGES.find(x => x.id === id).name}</span>`).join('');
    el.innerHTML = h;
  }
  settings() {
    this.clear(); const st = this.app.settings;
    const s = this.el(`<div class="screen"><div class="logo" style="font-size:40px">SETTINGS</div><div class="panel" style="left:70px;top:150px;width:460px"></div><div class="menu" style="position:absolute;left:70px;bottom:40px;width:260px"></div></div>`);
    const p = s.querySelector('.panel');
    const sel = (label, key, opts, after) => { const r = this.el(`<div class="row"><label>${label}</label><select>${opts.map(o => `<option ${String(o) === String(st[key]) ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`); r.querySelector('select').onchange = (e) => { const v = e.target.value; st[key] = v === 'true' ? true : v === 'false' ? false : v; this.app.persist(); if (after) after(); }; p.appendChild(r); };
    sel('Graphics', 'quality', ['Low', 'Medium', 'High', 'Ultra'], () => this.app.toast('Restart to apply graphics quality'));
    sel('Shot meter', 'meter', [true, false]);
    sel('Camera', 'camera', Object.keys(OTC.CAMERAS));
    sel('Difficulty', 'difficulty', Object.keys(OTC.DIFFICULTY));
    sel('Mouse moves player', 'mouseMove', [false, true]);
    sel('Auto quality (steady FPS)', 'autoQuality', [true, false], () => this.app.renderer.autoQuality = st.autoQuality);
    const vol = this.el(`<div class="row"><label>Volume</label><input type="range" min="0" max="1" step="0.05" value="${st.volume}"></div>`); vol.querySelector('input').oninput = (e) => { st.volume = +e.target.value; this.app.audio.setVolumes({ master: st.volume }); this.app.persist(); }; p.appendChild(vol);
    this.btn(s.querySelector('.menu'), 'BACK', () => this.title());
    this.layer.appendChild(s);
  }
  controlsHTML() {
    const mv = OTC.MOVES.map(m => `<div><span class="k">${m.seq.split('').map(c => OTC.ARROW_GLYPH[c]).join(' ')}</span> ${m.name}</div>`).join('');
    return `<h3>CONTROLS</h3><div><span class="k">Arrows</span> move · <span class="k">Shift</span> sprint (release = slow dribble, save stamina)</div>
      <div><span class="k">A</span> pass · <span class="k">hold S</span> shoot, release at the top · <span class="k">tap S</span> pump fake</div>
      <div><span class="k">D</span> steal · <span class="k">W</span> block/contest · <span class="k">Q</span> switch</div>
      <div><span class="k">Mouse</span> left hold = shoot · right = pass to cursor · wheel = zoom · (settings: cursor moves player)</div>
      <div><span class="k">M</span> meter · <span class="k">C</span> camera · <span class="k">H</span> help · <span class="k">P</span> pause</div>
      <h3 style="margin-top:10px">MOVES (quick taps, chain up to 6)</h3>${mv}
      <h3 style="margin-top:10px">FINISHERS</h3><div><span class="k">← / →</span> then S = Euro · <span class="k">↓</span> then S = Hop · <span class="k">↑</span> then S = Spin · Shift+S = dunk</div>`;
  }
  controls() {
    this.clear();
    const s = this.el(`<div class="screen"><div class="panel" style="left:70px;top:40px;bottom:100px;width:560px">${this.controlsHTML()}</div><div class="menu" style="position:absolute;left:70px;bottom:30px;width:260px"></div></div>`);
    this.btn(s.querySelector('.menu'), 'BACK', () => this.title()); this.layer.appendChild(s);
  }
  pause(game) {
    this.clear();
    const s = this.el(`<div class="screen"><div class="logo" style="font-size:40px">PAUSED</div><div class="tag">${game.teams.map(t => t.abbr + ' ' + t.score).join('  ·  ')}</div><div class="menu"></div></div>`);
    const m = s.querySelector('.menu');
    this.btn(m, 'RESUME', () => { this.clear(); this.app.paused = false; });
    this.btn(m, 'CONTROLS', () => { const h = document.getElementById('help'); h.innerHTML = this.controlsHTML(); h.style.display = 'block'; });
    this.btn(m, 'RESTART', () => { this.app.startGame(game.opts); });
    this.btn(m, 'QUIT TO MENU', () => { this.app.endGame(); this.title(); });
    this.layer.appendChild(s);
  }
  gameOver(res, pts) {
    this.clear(); this.hudEl.style.display = 'none';
    const rows = res.teams.flatMap(t => t.players.map(p => `<tr><td>${t.abbr}</td><td>${p.build.name}${p.isStar ? ' ★' : ''}</td><td>${p.ovr}</td><td>${p.stats.pts}</td><td>${p.stats.reb}</td><td>${p.stats.ast}</td><td>${p.stats.stl}</td><td>${p.stats.blk}</td><td>${p.stats.fgm}/${p.stats.fga}</td></tr>`)).join('');
    const s = this.el(`<div class="screen"><div class="logo" style="font-size:46px">${res.won ? 'YOU <span>WIN</span>' : 'GAME <span>OVER</span>'}</div><div class="tag">${res.teams.map(t => t.abbr + ' ' + t.score).join('  ·  ')}${pts ? ` · +${pts} SKILL POINTS` : ''}</div>
      <div class="panel" style="left:70px;top:200px;width:640px;max-height:50%"><table style="width:100%;font:600 12px Arial"><tr style="color:#f2b632"><td>TM</td><td>PLAYER</td><td>OVR</td><td>PTS</td><td>REB</td><td>AST</td><td>STL</td><td>BLK</td><td>FG</td></tr>${rows}</table></div><div class="menu" style="position:absolute;left:70px;bottom:40px;width:300px"></div></div>`);
    const m = s.querySelector('.menu');
    this.btn(m, 'PLAY AGAIN', () => this.app.startGame(res.opts));
    this.btn(m, 'UPGRADE COURT STAR', () => { this.app.endGame(); this.builder('UPGRADES'); });
    this.btn(m, 'MAIN MENU', () => { this.app.endGame(); this.title(); });
    this.layer.appendChild(s);
  }
  // ---------- HUD ----------
  hud(g) {
    this.hudEl.style.display = 'block';
    const bug = document.getElementById('bug');
    const teams = g.teams.map(t => `<div class="tm" style="background:${t === g.teams[0] ? t.color : (t.color || '#333')};${g.offense === t ? 'box-shadow:inset 0 -4px 0 #f2b632' : ''}"><span>${t.abbr}</span><span class="sc">${t.score}</span></div>`).join('');
    const clk = g.mode.full ? `Q${Math.min(g.quarter, 4)}${g.quarter > 4 ? ' OT' : ''} ${g.fmtClock()}` : (g.mode.target ? `TO ${g.mode.target}` : 'PRACTICE');
    const key = teams + clk + Math.ceil(g.shotClock);
    if (this._bugKey !== key) { this._bugKey = key; bug.innerHTML = teams + `<div class="clk"><span>${clk}</span><span class="sh">${g.mode.shotClock < 90 ? Math.max(0, Math.ceil(g.shotClock)) : ''}</span></div>`; }
    const p = g.human; document.getElementById('stam').style.width = p.st + '%';
    const k = document.getElementById('killa'); k.parentElement.style.display = p.killaType ? 'block' : 'none'; k.style.width = (p.killaOn > 0 ? 100 : p.killa * 100) + '%';
    // meter beside the shooter's head
    const meter = document.getElementById('meter');
    if (p.shot && this.app.settings.meter) {
      const v = OTC.clamp(p.shot.t / p.shot.fill, 0, 1.15);
      const [contest] = g.contestFor(p); const w = OTC.shotWindows(OTC.shotRatingFor(p.r, Math.hypot(p.pos.x, p.pos.z - g.hoopFor(p.team).z)), contest);
      const scr = g.app.camera; const head = p.pos.clone().setY(p.phys.heightM + p.air + 0.2).add(new THREE.Vector3(0, 0, 0)).project(scr);
      meter.style.display = 'block'; meter.style.left = ((head.x + 1) / 2 * innerWidth + 40) + 'px'; meter.style.top = ((1 - head.y) / 2 * innerHeight - 60) + 'px';
      const H = 110 / 1.15; meter.querySelector('i').style.height = Math.min(110, v * H) + 'px';
      const gEl = meter.querySelector('.g'), yEl = meter.querySelector('.y');
      gEl.style.bottom = w.gLo * H + 'px'; gEl.style.height = Math.max(2, (w.gHi - w.gLo) * H) + 'px';
      yEl.style.bottom = w.yLo * H + 'px'; yEl.style.height = (w.yHi - w.yLo) * H + 'px';
    } else meter.style.display = 'none';
  }
  popup(text, kind = 'info') { const d = document.createElement('div'); d.className = 'pop ' + kind; d.textContent = text; this.hudEl.appendChild(d); setTimeout(() => d.remove(), 1400); }
  shotFeedback(gr, meterOn) { const d = document.createElement('div'); d.className = 'fb'; d.style.color = gr.grade === 'green' ? '#3cff78' : gr.grade === 'yellow' ? '#ffd23c' : '#ff4d4d'; d.textContent = gr.label + (meterOn ? '' : ' (wrist)'); this.hudEl.appendChild(d); setTimeout(() => d.remove(), 1200); }
  moveName(name, chain) { const el = document.getElementById('mv'); el.innerHTML = name + (chain > 1 ? `<small>CHAIN x${chain}</small>` : ''); clearTimeout(this._mvT); this._mvT = setTimeout(() => el.innerHTML = '', 1500); }
  comboTrail(seq) { const el = document.getElementById('trail'); const t = seq.split('').map(c => OTC.ARROW_GLYPH[c]).join(''); if (el.textContent !== t) el.textContent = t; }
  toast(msg) { const d = this.el(`<div class="toast">${msg}</div>`); this.root.appendChild(d); setTimeout(() => d.remove(), 1800); }
  toggleHelp() { const h = document.getElementById('help'); if (h.style.display === 'none') { h.innerHTML = this.controlsHTML(); h.style.display = 'block'; } else h.style.display = 'none'; }
};
