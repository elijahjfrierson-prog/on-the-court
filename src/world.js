// ===== Arena, court, hoops, crowd =====
const OTC = window.OTC;
OTC.World = class {
  constructor(scene, renderer, quality) {
    this.scene = scene; this.renderer = renderer; this.quality = quality;
    this.time = 0; this.hype = 0.2; this.hoops = [];
    this.teamColors = { home: '#f2b632', away: '#6b2bd9' };
    this.build();
  }
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  courtTexture() {
    const C = OTC.COURT, S = 100, W = Math.round(C.W * S), H = Math.round(C.L * S);
    const cv = this.canvas(W, H), g = cv.getContext('2d');
    // maple planks run lengthwise
    const plank = 0.06 * S;
    for (let x = 0; x < W; x += plank) {
      let y = -Math.random() * 300;
      while (y < H) {
        const len = 120 + Math.random() * 260, l = 62 + Math.random() * 9, hue = 30 + Math.random() * 6;
        g.fillStyle = `hsl(${hue},${46 + Math.random() * 10}%,${l}%)`; g.fillRect(x, y, plank + 0.5, len);
        g.fillStyle = 'rgba(80,45,15,0.10)'; for (let k = 0; k < 4; k++) g.fillRect(x + Math.random() * plank, y, 0.7, len);
        g.fillStyle = 'rgba(60,30,10,0.35)'; g.fillRect(x, y, plank, 0.8);
        y += len;
      }
      g.fillStyle = 'rgba(60,30,10,0.25)'; g.fillRect(x, 0, 0.8, H);
    }
    const px = (x) => (x + C.W / 2) * S, pz = (z) => (z + C.L / 2) * S;
    const paint = '#1a1446', paintEdge = '#f2b632';
    g.lineWidth = 0.05 * S; g.strokeStyle = '#ffffff';
    // outside border band
    g.strokeStyle = '#121030'; g.lineWidth = 0.2 * S; g.strokeRect(0.1 * S, 0.1 * S, W - 0.2 * S, H - 0.2 * S);
    g.lineWidth = 0.05 * S; g.strokeStyle = '#fff';
    for (const side of [-1, 1]) {
      const base = side * C.L / 2, hz = side * C.hoopZ, dir = -side; // dir points toward midcourt
      // painted key
      g.fillStyle = paint; g.fillRect(px(-C.keyW / 2), Math.min(pz(base), pz(base + dir * C.ftZ)), C.keyW * S, C.ftZ * S);
      g.strokeRect(px(-C.keyW / 2), Math.min(pz(base), pz(base + dir * C.ftZ)), C.keyW * S, C.ftZ * S);
      // FT circle
      g.beginPath(); g.arc(px(0), pz(base + dir * C.ftZ), 1.8 * S, 0, Math.PI * 2); g.stroke();
      // restricted arc
      g.beginPath(); g.arc(px(0), pz(hz), 1.22 * S, side > 0 ? Math.PI : 0, side > 0 ? 2 * Math.PI : Math.PI); g.stroke();
      // three point
      const zc = Math.sqrt(C.threeR * C.threeR - C.cornerX * C.cornerX);
      g.beginPath(); g.moveTo(px(-C.cornerX), pz(base)); g.lineTo(px(-C.cornerX), pz(hz + dir * zc)); g.stroke();
      g.beginPath(); g.moveTo(px(C.cornerX), pz(base)); g.lineTo(px(C.cornerX), pz(hz + dir * zc)); g.stroke();
      const a0 = Math.atan2(dir * zc, -C.cornerX), a1 = Math.atan2(dir * zc, C.cornerX);
      g.beginPath(); g.arc(px(0), pz(hz), C.threeR * S, Math.min(a0, a1), Math.max(a0, a1), side > 0 ? false : false);
      if (side > 0) { g.beginPath(); g.arc(px(0), pz(hz), C.threeR * S, Math.PI + Math.atan2(zc, C.cornerX), 2 * Math.PI - Math.atan2(zc, C.cornerX)); }
      else { g.beginPath(); g.arc(px(0), pz(hz), C.threeR * S, Math.atan2(zc, C.cornerX), Math.PI - Math.atan2(zc, C.cornerX)); }
      g.stroke();
      // baseline wordmark
      g.save(); g.translate(px(0), pz(base + dir * 0.55)); if (side < 0) g.rotate(Math.PI);
      g.fillStyle = 'rgba(26,20,70,0.85)'; g.font = `900 ${0.5 * S}px Arial Black, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ON THE COURT', 0, 0); g.restore();
    }
    // midcourt
    g.beginPath(); g.moveTo(0, pz(0)); g.lineTo(W, pz(0)); g.stroke();
    g.fillStyle = paint; g.beginPath(); g.arc(px(0), pz(0), 1.8 * S, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = paintEdge; g.lineWidth = 0.08 * S; g.beginPath(); g.arc(px(0), pz(0), 1.55 * S, 0, Math.PI * 2); g.stroke();
    g.save(); g.translate(px(0), pz(0)); g.rotate(Math.PI / 2);
    g.fillStyle = paintEdge; g.font = `900 ${1.0 * S}px Arial Black, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OTC', 0, 0);
    g.restore();
    // sideline text
    for (const sx of [-1, 1]) { g.save(); g.translate(px(sx * (C.W / 2 - 0.6)), pz(0)); g.rotate(sx * Math.PI / 2); g.fillStyle = 'rgba(26,20,70,0.6)'; g.font = `900 ${0.42 * S}px Arial`; g.textAlign = 'center'; g.fillText('ON THE COURT  ·  EST. 2026', 0, 0); g.restore(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  build() {
    const s = this.scene, C = OTC.COURT;
    s.background = new THREE.Color('#05060b');
    s.fog = new THREE.Fog('#05060b', 30, 75);
    // environment map for glossy reflections (ceiling light panels)
    const envScene = new THREE.Scene(); envScene.background = new THREE.Color('#020205');
    const panelMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), panelMat); m.position.set(j * 6, 18, i * 7); m.rotation.x = Math.PI / 2; envScene.add(m); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(20, 0.6, 8, 48), new THREE.MeshBasicMaterial({ color: '#6b4bd9' })); ring.rotation.x = Math.PI / 2; ring.position.y = 12; envScene.add(ring);
    const pm = new THREE.PMREMGenerator(this.renderer); s.environment = pm.fromScene(envScene, 0.04).texture; s.environmentIntensity = 0.55;

    // court
    const court = new THREE.Mesh(new THREE.PlaneGeometry(C.W, C.L), new THREE.MeshStandardMaterial({ map: this.courtTexture(), roughness: 0.22, metalness: 0.0, envMapIntensity: 1.2 }));
    court.rotation.x = -Math.PI / 2; court.receiveShadow = true; s.add(court);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(C.W + 8, C.L + 10), new THREE.MeshStandardMaterial({ color: '#1b1636', roughness: 0.35 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.005; apron.receiveShadow = true; s.add(apron);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#08080d', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; s.add(floor);

    // lights
    s.add(new THREE.HemisphereLight('#8a90b8', '#1a1208', 0.35));
    const key = this.key = new THREE.DirectionalLight('#fff4e6', 2.2); key.position.set(6, 22, 8);
    key.castShadow = this.quality !== 'Low';
    key.shadow.mapSize.set(this.quality === 'High' ? 4096 : 2048, this.quality === 'High' ? 4096 : 2048);
    Object.assign(key.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 50 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    s.add(key); s.add(key.target);
    const fill = new THREE.DirectionalLight('#9fb4ff', 0.5); fill.position.set(-10, 14, -12); s.add(fill);
    const spots = [[-4, -9], [4, -9], [-4, 0], [4, 0], [-4, 9], [4, 9]];
    this.spotLights = [];
    for (const [x, z] of spots) {
      const sp = new THREE.SpotLight('#fff8ee', 140, 40, 0.55, 0.6, 2); sp.position.set(x, 17, z); sp.target.position.set(x * 0.6, 0, z * 0.8);
      s.add(sp); s.add(sp.target); this.spotLights.push(sp);
    }
    // ceiling truss + light halos
    const haloTex = this.haloTexture();
    for (let i = -3; i <= 3; i++) for (const x of [-9, -3, 3, 9]) {
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#fff4e0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
      h.position.set(x, 19, i * 6); h.scale.set(2.4, 2.4, 1); s.add(h);
    }
    const ringLight = new THREE.Mesh(new THREE.TorusGeometry(17, 0.25, 8, 64), new THREE.MeshBasicMaterial({ color: '#7a55ff' }));
    ringLight.rotation.x = Math.PI / 2; ringLight.scale.set(1, 1.35, 1); ringLight.position.y = 17.5; s.add(ringLight);

    for (const side of [-1, 1]) this.hoops.push(this.buildHoop(side));
    this.buildStands();
    this.buildJumbotron();
    this.buildLED();
    this.buildTable();
  }

  haloTexture() {
    const cv = this.canvas(128, 128), g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,240,210,0.7)'); gr.addColorStop(1, 'rgba(255,220,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); return t;
  }

  buildHoop(side) {
    const C = OTC.COURT, s = this.scene, g = new THREE.Group(); s.add(g);
    const rimZ = side * C.hoopZ, boardZ = side * C.boardZ;
    // glass
    const glass = new THREE.Mesh(new THREE.BoxGeometry(C.boardW, C.boardH, 0.03), new THREE.MeshPhysicalMaterial({ color: '#d8ecff', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0, transmission: 0, envMapIntensity: 2 }));
    glass.position.set(0, C.boardBottom + C.boardH / 2, boardZ); g.add(glass);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.4 });
    const addBar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.035), frameMat); m.position.set(x, y, boardZ - side * 0.002); g.add(m); };
    const bw = 0.05, by = C.boardBottom;
    addBar(C.boardW, bw, 0, by + bw / 2); addBar(C.boardW, bw, 0, by + C.boardH - bw / 2); addBar(bw, C.boardH, -C.boardW / 2 + bw / 2, by + C.boardH / 2); addBar(bw, C.boardH, C.boardW / 2 - bw / 2, by + C.boardH / 2);
    const iy = C.rimH + 0.15; addBar(0.59, 0.05, 0, iy + 0.45); addBar(0.59, 0.05, 0, iy); addBar(0.05, 0.45, -0.27, iy + 0.225); addBar(0.05, 0.45, 0.27, iy + 0.225);
    // padding on the bottom of the board
    const pad = new THREE.Mesh(new THREE.BoxGeometry(C.boardW + 0.04, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: '#1a1446', roughness: 0.6 }));
    pad.position.set(0, C.boardBottom - 0.04, boardZ + side * 0.03); g.add(pad);
    // rim
    const rimMat = new THREE.MeshStandardMaterial({ color: '#ff5a14', roughness: 0.35, metalness: 0.5 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(C.rimR, 0.009, 8, 40), rimMat); rim.rotation.x = Math.PI / 2; rim.position.set(0, C.rimH, rimZ); rim.castShadow = true; g.add(rim);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.16), rimMat); brace.position.set(0, C.rimH - 0.02, rimZ + side * (C.rimR + 0.07)); g.add(brace);
    // stanchion
    const stMat = new THREE.MeshStandardMaterial({ color: '#15123a', roughness: 0.5 });
    const baseZ = side * (C.L / 2 + 1.6);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 2.0), stMat); base.position.set(0, 0.55, baseZ + side * 0.4); base.castShadow = true; g.add(base);
    const padF = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.0, 0.25), new THREE.MeshStandardMaterial({ color: '#f2b632', roughness: 0.6 })); padF.position.set(0, 0.55, baseZ - side * 0.62); g.add(padF);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), stMat); pole.position.set(0, 2.5, baseZ + side * 0.3); pole.rotation.x = side * 0.32; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, Math.abs(baseZ - boardZ) + 0.2), stMat); arm.position.set(0, 4.0, (baseZ + boardZ) / 2 + side * 0.15); g.add(arm);
    const armDown = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), stMat); armDown.position.set(0, 3.7, boardZ + side * 0.12); g.add(armDown);
    // net: rings x strands of points, re-meshed each frame
    const N = 12, R = 4, pts = [];
    for (let r = 0; r < R; r++) for (let i = 0; i < N; i++) pts.push(new THREE.Vector3());
    const idx = [];
    for (let r = 0; r < R - 1; r++) for (let i = 0; i < N; i++) { const a = r * N + i, b = (r + 1) * N + ((i + 1) % N), c = (r + 1) * N + ((i + N - 1) % N); idx.push(a, b, a, c); }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pts.length * 3), 3)); ng.setIndex(idx);
    const net = new THREE.LineSegments(ng, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })); g.add(net);
    // shot clock + game clock on top of the board
    const scCanvas = this.canvas(256, 128); const scTex = new THREE.CanvasTexture(scCanvas); scTex.colorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.25), [stMat, stMat, stMat, stMat, new THREE.MeshBasicMaterial({ map: scTex }), new THREE.MeshBasicMaterial({ map: scTex })]);
    sc.position.set(0, C.boardBottom + C.boardH + 0.3, boardZ + side * 0.05); g.add(sc);
    const hoop = { side, z: rimZ, boardZ, group: g, net, netPts: pts, N, R, sway: new THREE.Vector3(), swayV: new THREE.Vector3(), drop: 0, scCanvas, scTex, last: '' };
    this.updateNet(hoop, 0);
    return hoop;
  }
  setClocks(shot, game) {
    const txt = `${shot}|${game}`;
    for (const h of this.hoops) {
      if (h.last === txt) continue; h.last = txt;
      const g = h.scCanvas.getContext('2d'); g.fillStyle = '#050505'; g.fillRect(0, 0, 256, 128);
      g.font = 'bold 40px "Courier New", monospace'; g.textAlign = 'center'; g.fillStyle = '#ffb030'; g.fillText(game, 128, 42);
      g.font = 'bold 74px "Courier New", monospace'; g.fillStyle = '#ff2a20'; g.fillText(String(shot), 128, 118);
      h.scTex.needsUpdate = true;
    }
  }
  netHit(hoop, strength = 1, dx = 0, dz = 0) { hoop.drop = Math.min(1, hoop.drop + 0.8 * strength); hoop.swayV.x += dx * 2; hoop.swayV.z += dz * 2; }
  updateNet(h, dt) {
    const C = OTC.COURT;
    h.swayV.addScaledVector(h.sway, -60 * dt); h.swayV.multiplyScalar(Math.max(0, 1 - 6 * dt)); h.sway.addScaledVector(h.swayV, dt);
    h.drop = Math.max(0, h.drop - dt * 2.2);
    const arr = h.net.geometry.attributes.position.array;
    for (let r = 0; r < h.R; r++) {
      const t = r / (h.R - 1), rad = C.rimR * (1 - t * 0.45) * (1 - h.drop * 0.25 * t), y = C.rimH - t * (0.42 + h.drop * 0.12);
      for (let i = 0; i < h.N; i++) {
        const a = (i / h.N) * Math.PI * 2 + (r % 2) * (Math.PI / h.N);
        const k = (r * h.N + i) * 3;
        arr[k] = Math.cos(a) * rad + h.sway.x * t; arr[k + 1] = y; arr[k + 2] = h.z + Math.sin(a) * rad + h.sway.z * t;
      }
    }
    h.net.geometry.attributes.position.needsUpdate = true;
  }

  buildStands() {
    const C = OTC.COURT, s = this.scene;
    const seatMat = new THREE.MeshStandardMaterial({ color: '#141221', roughness: 0.8 });
    const rows = this.quality === 'Low' ? 9 : 14;
    const fans = [];
    const addSection = (len, axis, sign, start) => {
      for (let r = 0; r < rows; r++) {
        const d = start + r * 0.85, y = 0.4 + r * 0.55;
        const step = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? len : 0.85, 0.55, axis === 'x' ? 0.85 : len), seatMat);
        if (axis === 'x') step.position.set(0, y - 0.3, sign * d); else step.position.set(sign * d, y - 0.3, 0);
        s.add(step);
        const n = Math.floor(len / 0.62);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.06) continue;
          const t = -len / 2 + (i + 0.5) * (len / n) + (Math.random() - 0.5) * 0.1;
          fans.push(axis === 'x' ? [t, y, sign * d, r] : [sign * d, y, t, r]);
        }
      }
    };
    addSection(C.L + 10, 'z', 1, C.W / 2 + 4.5); addSection(C.L + 10, 'z', -1, C.W / 2 + 4.5);
    addSection(C.W + 12, 'x', 1, C.L / 2 + 5); addSection(C.W + 12, 'x', -1, C.L / 2 + 5);
    // courtside chairs row
    for (let i = -12; i <= 12; i++) for (const sx of [-1, 1]) if (Math.abs(i) > 2) fans.push([sx * (C.W / 2 + 2.2), 0.0, i * 1.0, -1]);
    const geo = new THREE.CapsuleGeometry(0.2, 0.5, 3, 8); geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const im = this.fans = new THREE.InstancedMesh(geo, mat, fans.length);
    const palette = ['#c8102e', '#f2b632', '#ffffff', '#1d1d1d', '#2a4bd7', '#6b2bd9', '#3a3a3a', '#7d5a3c', '#0e7c4a', '#e0e0e0'];
    const col = new THREE.Color(), m4 = new THREE.Matrix4();
    this.fanData = fans;
    fans.forEach((f, i) => {
      m4.makeTranslation(f[0], f[1], f[2]); im.setMatrixAt(i, m4);
      col.set(palette[Math.floor(Math.random() * palette.length)]).multiplyScalar(f[3] < 0 ? 1 : 0.55 - f[3] * 0.022); im.setColorAt(i, col);
    });
    s.add(im);
  }
  buildJumbotron() {
    const cv = this.jumboCanvas = this.canvas(512, 288); this.jumboTex = new THREE.CanvasTexture(cv); this.jumboTex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group(); g.position.set(0, 14, 0); this.scene.add(g);
    const body = new THREE.MeshStandardMaterial({ color: '#0a0a12', roughness: 0.5 });
    const scr = new THREE.MeshBasicMaterial({ map: this.jumboTex });
    const box = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.6, 6.4), [scr, scr, body, body, scr, scr]); g.add(box);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.12, 6, 40), new THREE.MeshBasicMaterial({ color: '#f2b632' })); ringM.rotation.x = Math.PI / 2; ringM.position.y = -2.0; g.add(ringM);
    this.setJumbo('ON THE COURT', '', '');
  }
  setJumbo(title, l1, l2) {
    const g = this.jumboCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 288);
    gr.addColorStop(0, '#1b1150'); gr.addColorStop(1, '#05030f'); g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
    g.textAlign = 'center'; g.fillStyle = '#f2b632'; g.font = '900 52px Arial Black, Arial'; g.fillText(title, 256, 90);
    g.fillStyle = '#fff'; g.font = 'bold 64px Arial'; g.fillText(l1, 256, 180); g.font = 'bold 34px Arial'; g.fillStyle = '#c9b8ff'; g.fillText(l2, 256, 245);
    this.jumboTex.needsUpdate = true;
  }
  buildLED() {
    const C = OTC.COURT;
    const cv = this.canvas(2048, 64), g = cv.getContext('2d');
    g.fillStyle = '#060410'; g.fillRect(0, 0, 2048, 64);
    const words = ['ON THE COURT', 'BUILD YOUR COURT STAR', 'HUMHOUSE', '5v5 · 3v3 · 1v1 · 21', 'NEXT GEN HOOPS'];
    g.font = '900 40px Arial Black, Arial'; g.textBaseline = 'middle';
    let x = 20; let k = 0; while (x < 2048) { const w = words[k++ % words.length]; g.fillStyle = k % 2 ? '#f2b632' : '#8f6bff'; g.fillText(w, x, 34); x += g.measureText(w).width + 80; }
    const tex = this.ledTex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(3, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    for (const sz of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(C.W + 10, 0.9), mat); m.position.set(0, 0.6, sz * (C.L / 2 + 3.3)); m.rotation.y = sz > 0 ? Math.PI : 0; this.scene.add(m); }
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(C.L + 6, 0.9), mat); m.position.set(sx * (C.W / 2 + 3.6), 0.85, 0); m.rotation.y = -sx * Math.PI / 2; this.scene.add(m); }
  }
  buildTable() {
    const C = OTC.COURT;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 9), new THREE.MeshStandardMaterial({ color: '#100c26', roughness: 0.4, emissive: '#2a1a6b', emissiveIntensity: 0.4 }));
    t.position.set(-(C.W / 2 + 2.9), 0.4, 0); this.scene.add(t);
  }
  update(dt, focus) {
    this.time += dt;
    if (this.ledTex) this.ledTex.offset.x = (this.time * 0.03) % 1;
    for (const h of this.hoops) this.updateNet(h, dt);
    if (focus) { this.key.position.set(focus.x + 6, 22, focus.z + 8); this.key.target.position.set(focus.x, 0, focus.z); }
    // crowd bounce scales with hype; update a slice each frame to keep cost low
    if (this.fans) {
      const m4 = new THREE.Matrix4(), n = this.fanData.length, slice = Math.ceil(n / 3), start = ((Math.floor(Math.abs(this.time) * 60) % 3) + 3) % 3 * slice;
      for (let i = start; i < Math.min(n, start + slice); i++) {
        const f = this.fanData[i];
        const amp = this.hype * 0.18 * (0.5 + ((i * 7919) % 100) / 200);
        const y = f[1] + Math.max(0, Math.sin(this.time * (7 + (i % 5)) + i)) * amp;
        m4.makeTranslation(f[0], y, f[2]); this.fans.setMatrixAt(i, m4);
      }
      this.fans.instanceMatrix.needsUpdate = true;
    }
  }
};
