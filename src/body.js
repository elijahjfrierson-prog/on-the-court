// ===== Procedural athlete: proportions from the build, joint positions solved every frame =====
const OTC = window.OTC;
const V3 = () => new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

OTC.jerseyTexture = (color, trim, number, team, text = '#fff') => {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const g = cv.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 512, 512);
  // fabric mesh noise
  for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  g.fillStyle = trim; g.fillRect(0, 0, 512, 22); g.fillRect(0, 490, 512, 22);
  // front (u 0..0.5) and back (0.5..1)
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const front = (x) => {
    g.font = '900 54px Arial Black, Arial'; g.lineWidth = 8; g.strokeStyle = trim; g.strokeText(team, x, 170); g.fillStyle = text; g.fillText(team, x, 170);
    g.font = '900 120px Arial Black, Arial'; g.lineWidth = 12; g.strokeText(String(number), x, 290); g.fillStyle = trim; g.fillText(String(number), x, 290);
  };
  front(128);
  g.font = '900 170px Arial Black, Arial'; g.lineWidth = 14; g.strokeStyle = trim; g.strokeText(String(number), 384, 260); g.fillStyle = text; g.fillText(String(number), 384, 260);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
};

OTC.Athlete = class {
  constructor(build, team) {
    this.build = build; this.team = team;
    this.root = new THREE.Group();
    this.j = {}; // joint world positions (Vector3)
    for (const n of ['pelvis', 'chest', 'neck', 'head', 'lSh', 'rSh', 'lEl', 'rEl', 'lWr', 'rWr', 'lHand', 'rHand', 'lHip', 'rHip', 'lKn', 'rKn', 'lAn', 'rAn', 'lToe', 'rToe']) this.j[n] = V3();
    this.gait = 0; this.feet = { l: V3(), r: V3() }; this.feetInit = false;
    this.rebuild(build, team);
  }
  dims(b) {
    const H = b.heightIn * 0.0254, wingExtra = (b.wing - b.heightIn) * 0.0254;
    const legs = 0.92 + (b.legs ?? 0.5) * 0.16;
    const armScale = 1 + wingExtra / (H * 0.8);
    const [wMin, wMax] = OTC.weightRange(b.heightIn), bulk = OTC.clamp((b.weight - wMin) / (wMax - wMin), 0, 1);
    const sh = b.shoulders ?? 0.5;
    return {
      H, bulk,
      thigh: 0.245 * H * legs, shin: 0.246 * H * legs, ankle: 0.039 * H, foot: 0.152 * H,
      pelvisW: 0.095 * H * (1 + bulk * 0.2), torso: 0.30 * H, neck: 0.05 * H, headR: 0.064 * H,
      shW: 0.13 * H * (0.92 + sh * 0.2 + bulk * 0.08), upper: 0.186 * H * armScale, fore: 0.150 * H * armScale, hand: 0.09 * H * armScale,
      limbR: 0.033 * H * (0.85 + bulk * 0.35),
    };
  }
  rebuild(build, team) {
    this.build = build; if (team) this.team = team;
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    const d = this.d = this.dims(build);
    const skin = new THREE.MeshPhysicalMaterial({ color: OTC.SKIN_TONES[build.skin ?? 3], roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color('#ffd9c0') });
    const jerseyCol = this.team?.color || build.jersey || '#f2b632', trimCol = this.team?.trim || build.trim || '#0d1d4f';
    const jersey = new THREE.MeshStandardMaterial({ map: OTC.jerseyTexture(jerseyCol, trimCol, build.number ?? 0, this.team?.short || 'OTC', this.team?.text || '#fff'), roughness: 0.75 });
    const shorts = new THREE.MeshStandardMaterial({ color: jerseyCol, roughness: 0.7 });
    const trim = new THREE.MeshStandardMaterial({ color: trimCol, roughness: 0.6 });
    const shoe = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.45 });
    const sole = new THREE.MeshStandardMaterial({ color: trimCol, roughness: 0.5 });
    const sleeve = new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.6 });
    const hairM = new THREE.MeshStandardMaterial({ color: OTC.HAIR_COLORS[build.hairColor ?? 0], roughness: 0.95 });
    this.mats = { skin, jersey, shorts, trim };
    const cast = (m) => { m.castShadow = true; m.receiveShadow = true; this.root.add(m); return m; };
    const limb = (r0, r1, mat) => { const geo = new THREE.CylinderGeometry(r1, r0, 1, 12, 1); geo.translate(0, 0.5, 0); const m = cast(new THREE.Mesh(geo, mat)); return m; };
    const ball = (r, mat) => cast(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat));
    const R = d.limbR;
    this.parts = {
      lThigh: limb(R * 1.55, R * 1.05, skin), rThigh: limb(R * 1.55, R * 1.05, skin),
      lShin: limb(R * 1.0, R * 0.62, skin), rShin: limb(R * 1.0, R * 0.62, skin),
      lKnee: ball(R * 1.05, skin), rKnee: ball(R * 1.05, skin),
      lUpper: limb(R * 1.08, R * 0.82, build.sleeve === 2 ? sleeve : skin), rUpper: limb(R * 1.08, R * 0.82, skin),
      lFore: limb(R * 0.82, R * 0.55, build.sleeve ? sleeve : skin), rFore: limb(R * 0.82, R * 0.55, skin),
      lElb: ball(R * 0.82, build.sleeve ? sleeve : skin), rElb: ball(R * 0.82, skin),
      lDelt: ball(R * 1.25, skin), rDelt: ball(R * 1.25, skin),
      neck: limb(R * 1.05, R * 0.95, skin),
    };
    // hands: palm box + thumb
    const handGeo = new THREE.BoxGeometry(R * 1.4, d.hand, R * 0.7); handGeo.translate(0, d.hand / 2, 0);
    this.parts.lHandM = cast(new THREE.Mesh(handGeo, skin)); this.parts.rHandM = cast(new THREE.Mesh(handGeo, skin));
    // torso: lathe profile (hips → waist → chest → shoulders)
    const tw = d.shW, pw = d.pelvisW, T = d.torso;
    const prof = [[pw * 1.05, 0], [pw * 1.0, T * 0.2], [pw * 0.98 + d.bulk * 0.02, T * 0.42], [tw * 0.86, T * 0.7], [tw * 0.95, T * 0.86], [tw * 0.6, T * 1.0], [R * 1.1, T * 1.04]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const torsoGeo = new THREE.LatheGeometry(prof, 24); torsoGeo.scale(1, 1, 0.58);
    // rotate so that u=0.25 (front) faces +Z
    torsoGeo.rotateY(-Math.PI / 2);
    this.parts.torso = cast(new THREE.Mesh(torsoGeo, jersey));
    // arm holes skin patches (shoulders) covered by delts; shorts
    const shortsGeo = new THREE.CylinderGeometry(pw * 1.12, pw * 1.18, T * 0.38, 20, 1, true); shortsGeo.scale(1, 1, 0.72); shortsGeo.translate(0, -T * 0.12, 0);
    this.parts.shorts = cast(new THREE.Mesh(shortsGeo, shorts)); this.parts.shorts.material.side = THREE.DoubleSide;
    const legShort = (new THREE.CylinderGeometry(R * 2.1, R * 2.4, d.thigh * 0.52, 14, 1, true)); legShort.translate(0, d.thigh * 0.26, 0);
    this.parts.lShort = cast(new THREE.Mesh(legShort, shorts)); this.parts.rShort = cast(new THREE.Mesh(legShort, shorts));
    const band = new THREE.Mesh(new THREE.TorusGeometry(pw * 1.08, R * 0.25, 6, 24), trim); band.scale.set(1, 0.72, 1); this.parts.band = cast(band);
    // head
    const head = new THREE.Group(); this.root.add(head); this.parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(d.headR, 24, 18), skin); skull.scale.set(0.88, 1.08, 0.98); skull.castShadow = true; head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(d.headR * 0.72, 18, 12), skin); jaw.position.set(0, -d.headR * 0.42, d.headR * 0.18); jaw.scale.set(0.95, 0.8, 0.95); head.add(jaw);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(d.headR * 0.14, d.headR * 0.36, 8), skin); nose.position.set(0, -d.headR * 0.05, d.headR * 0.98); nose.rotation.x = Math.PI / 2.4; head.add(nose);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(d.headR * 0.2, 8, 8), skin); ear.scale.set(0.45, 1, 0.7); ear.position.set(sx * d.headR * 0.88, 0, 0); head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(d.headR * 0.09, 8, 8), new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.2 })); eye.position.set(sx * d.headR * 0.32, d.headR * 0.12, d.headR * 0.84); head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(d.headR * 0.05, 8, 8), new THREE.MeshStandardMaterial({ color: '#1a0f08' })); pupil.position.set(sx * d.headR * 0.32, d.headR * 0.12, d.headR * 0.92); head.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(d.headR * 0.32, d.headR * 0.06, d.headR * 0.08), hairM); brow.position.set(sx * d.headR * 0.32, d.headR * 0.27, d.headR * 0.86); head.add(brow);
    }
    const hairStyle = build.hair ?? 1;
    if (hairStyle > 0) {
      const hr = d.headR * [0, 1.0, 1.02, 1.06, 1.08, 1.32, 1.05][hairStyle];
      const cap = new THREE.Mesh(new THREE.SphereGeometry(hr, 22, 14, 0, Math.PI * 2, 0, Math.PI * (hairStyle === 5 ? 0.62 : 0.5)), hairM);
      cap.scale.set(0.9, hairStyle === 3 ? 1.35 : 1.06, 1.0); cap.position.y = d.headR * (hairStyle === 5 ? 0.08 : 0.05); cap.rotation.x = -0.25; head.add(cap);
      if (hairStyle === 4 || hairStyle === 6) for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2, tw2 = new THREE.Mesh(new THREE.CylinderGeometry(d.headR * 0.06, d.headR * 0.05, d.headR * (hairStyle === 6 ? 0.9 : 0.45), 5), hairM);
        tw2.position.set(Math.cos(a) * d.headR * 0.85, d.headR * (hairStyle === 6 ? 0.1 : 0.45), Math.sin(a) * d.headR * 0.85 - d.headR * 0.1); tw2.rotation.z = Math.cos(a) * 0.3; tw2.rotation.x = -Math.sin(a) * 0.3; head.add(tw2);
      }
    }
    const beard = build.beard ?? 0;
    if (beard > 0) {
      const bm = new THREE.Mesh(new THREE.SphereGeometry(d.headR * 0.76, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.5), hairM);
      bm.position.set(0, -d.headR * 0.38, d.headR * 0.2); bm.scale.set(0.98, beard === 3 ? 0.95 : 0.75, 0.98); if (beard === 2) bm.scale.set(0.5, 0.7, 0.98); head.add(bm);
    }
    // feet (sneakers)
    const shoeGeo = new THREE.BoxGeometry(R * 2.4, d.ankle * 1.6, d.foot * 1.05); shoeGeo.translate(0, d.ankle * 0.8, d.foot * 0.3);
    const soleGeo = new THREE.BoxGeometry(R * 2.5, d.ankle * 0.45, d.foot * 1.08); soleGeo.translate(0, d.ankle * 0.22, d.foot * 0.3);
    this.parts.lShoe = cast(new THREE.Mesh(shoeGeo, shoe)); this.parts.rShoe = cast(new THREE.Mesh(shoeGeo, shoe));
    this.parts.lSole = cast(new THREE.Mesh(soleGeo, sole)); this.parts.rSole = cast(new THREE.Mesh(soleGeo, sole));
    const sockGeo = new THREE.CylinderGeometry(R * 0.75, R * 0.75, d.ankle * 2.4, 10); sockGeo.translate(0, d.ankle * 1.2, 0);
    this.parts.lSock = cast(new THREE.Mesh(sockGeo, sleeve)); this.parts.rSock = cast(new THREE.Mesh(sockGeo, sleeve));
    this.feetInit = false;
  }
  // place a unit-length Y cylinder between two points
  seg(m, a, b) { const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length(); m.position.copy(a); m.scale.set(1, len, 1); if (len > 1e-5) m.quaternion.setFromUnitVectors(_up, dir.multiplyScalar(1 / len)); }
  // two-bone IK: returns mid joint position
  ik(root, target, l1, l2, pole, out) {
    const d = new THREE.Vector3().subVectors(target, root); let dist = d.length();
    const maxR = (l1 + l2) * 0.999; if (dist > maxR) { d.multiplyScalar(maxR / dist); target = root.clone().add(d); dist = maxR; }
    dist = Math.max(dist, Math.abs(l1 - l2) + 1e-3);
    const dir = d.clone().normalize();
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    out.copy(root).addScaledVector(dir, a).addScaledVector(p, h);
    return target;
  }
  // pose = { pos, facing, vel, crouch, lean, lateralLean, jump, lHand, rHand (world targets or null), stance:'run'|'defense'|'shoot', arms:..., fall }
  pose(P, dt) {
    const d = this.d, J = this.j;
    const f = new THREE.Vector3(Math.sin(P.facing), 0, Math.cos(P.facing)), r = new THREE.Vector3(f.z, 0, -f.x).multiplyScalar(-1); // r = right
    const speed = Math.hypot(P.vel.x, P.vel.z);
    const legLen = d.thigh + d.shin + d.ankle;
    const crouch = P.crouch ?? 0.06;
    // gait
    const stride = 0.55 * d.H * (0.6 + Math.min(speed, 8) / 8 * 0.7);
    if (speed > 0.15) this.gait += dt * speed / stride * Math.PI;
    else this.gait += dt * 2.2 * (P.stance === 'defense' ? 1 : 0) * 0;
    const ph = this.gait;
    const lift = speed > 0.15 ? Math.min(0.16, 0.035 + speed * 0.018) : 0;
    const bob = speed > 0.15 ? Math.abs(Math.sin(ph)) * lift * 0.35 : 0;
    const air = P.jump || 0;
    const pelvisY = legLen * (1 - crouch) - bob + air + (P.fall ? -legLen * 0.75 * P.fall : 0);
    J.pelvis.set(P.pos.x, pelvisY, P.pos.z);
    // lean
    const vdir = speed > 0.1 ? new THREE.Vector3(P.vel.x / speed, 0, P.vel.z / speed) : f.clone();
    const leanF = (P.lean ?? 0) + Math.min(speed, 8) * 0.025 + crouch * 0.5;
    const latLean = P.latLean ?? 0;
    const spineDir = new THREE.Vector3(0, 1, 0).addScaledVector(f, leanF).addScaledVector(r, latLean * 0.4);
    if (P.fall) spineDir.addScaledVector(f, -P.fall * 1.2);
    spineDir.normalize();
    J.chest.copy(J.pelvis).addScaledVector(spineDir, d.torso * 0.78);
    J.neck.copy(J.pelvis).addScaledVector(spineDir, d.torso * 1.02);
    J.head.copy(J.neck).addScaledVector(spineDir, d.neck + d.headR * 0.9);
    // shoulder twist with gait
    const twist = speed > 0.15 ? Math.sin(ph) * 0.12 : 0;
    const rT = r.clone().applyAxisAngle(spineDir, twist + (P.twist || 0));
    J.lSh.copy(J.pelvis).addScaledVector(spineDir, d.torso * 0.9).addScaledVector(rT, -d.shW);
    J.rSh.copy(J.pelvis).addScaledVector(spineDir, d.torso * 0.9).addScaledVector(rT, d.shW);
    const hipR = r.clone().applyAxisAngle(_up, -twist * 0.6);
    J.lHip.copy(J.pelvis).addScaledVector(hipR, -d.pelvisW * 0.62); J.rHip.copy(J.pelvis).addScaledVector(hipR, d.pelvisW * 0.62);
    // feet: stance width; gait swing along velocity
    const wide = P.stance === 'defense' ? 1.9 : P.stance === 'shoot' ? 1.15 : 1.0;
    for (const [side, s, phase] of [['l', -1, 0], ['r', 1, Math.PI]]) {
      const base = new THREE.Vector3(P.pos.x, 0, P.pos.z).addScaledVector(r, s * d.pelvisW * 0.75 * wide);
      if (P.stance === 'defense') base.addScaledVector(f, s * 0.05);
      let foot = base.clone();
      if (speed > 0.15 && !air && !P.fall) {
        const sw = Math.sin(ph + phase); foot.addScaledVector(vdir, sw * stride * 0.5);
        foot.y = Math.max(0, Math.cos(ph + phase)) * lift;
      } else if (air) { foot.y = air * 0.6; foot.addScaledVector(f, s * 0.03); }
      if (P.fall) foot.addScaledVector(f, 0.4 * P.fall);
      const an = side === 'l' ? J.lAn : J.rAn; an.copy(foot); an.y += d.ankle;
      const toe = side === 'l' ? J.lToe : J.rToe; toe.copy(an).addScaledVector(speed > 0.3 ? vdir.clone().lerp(f, 0.5).normalize() : f, d.foot * 0.75); toe.y = foot.y;
      const hip = side === 'l' ? J.lHip : J.rHip, kn = side === 'l' ? J.lKn : J.rKn;
      this.ik(hip, an, d.thigh, d.shin, f.clone().addScaledVector(r, s * 0.15), kn);
    }
    // arms
    const armPole = (s) => new THREE.Vector3(0, -0.6, 0).addScaledVector(f, -1).addScaledVector(r, s * 0.6).normalize();
    for (const [side, s] of [['l', -1], ['r', 1]]) {
      const sh = side === 'l' ? J.lSh : J.rSh, el = side === 'l' ? J.lEl : J.rEl, wr = side === 'l' ? J.lWr : J.rWr, hd = side === 'l' ? J.lHand : J.rHand;
      let tgt = side === 'l' ? P.lHand : P.rHand;
      if (!tgt) {
        // default arm: swing opposite legs, or defensive wide hands, or hang
        const sw = speed > 0.15 ? Math.sin(ph + (side === 'l' ? Math.PI : 0)) * Math.min(1, speed / 6) : 0;
        if (P.stance === 'defense') tgt = sh.clone().addScaledVector(r, s * d.upper * 0.95).addScaledVector(f, d.upper * 0.4).add(new THREE.Vector3(0, -d.upper * 0.15 + (P.handsUp ? d.upper * 1.4 : 0), 0));
        else tgt = sh.clone().addScaledVector(f, sw * d.upper * 0.9).addScaledVector(r, s * d.upper * 0.18).add(new THREE.Vector3(0, -(d.upper + d.fore) * 0.86 + Math.abs(sw) * 0.12, 0));
      }
      const pole = P.stance === 'shoot' ? new THREE.Vector3(0, -0.3, 0).addScaledVector(r, s * 0.4).addScaledVector(f, -0.2).normalize() : armPole(s);
      const reached = this.ik(sh, tgt, d.upper, d.fore, pole, el);
      wr.copy(reached);
      const hd2 = new THREE.Vector3().subVectors(wr, el).normalize(); hd.copy(wr).addScaledVector(hd2, d.hand * 0.6);
    }
    // place meshes
    const p = this.parts;
    this.seg(p.lThigh, J.lHip, J.lKn); this.seg(p.rThigh, J.rHip, J.rKn); this.seg(p.lShin, J.lKn, J.lAn); this.seg(p.rShin, J.rKn, J.rAn);
    p.lKnee.position.copy(J.lKn); p.rKnee.position.copy(J.rKn);
    this.seg(p.lShort, J.lHip, J.lKn); this.seg(p.rShort, J.rHip, J.rKn); p.lShort.scale.y = 1; p.rShort.scale.y = 1;
    this.seg(p.lUpper, J.lSh, J.lEl); this.seg(p.rUpper, J.rSh, J.rEl); this.seg(p.lFore, J.lEl, J.lWr); this.seg(p.rFore, J.rEl, J.rWr);
    p.lElb.position.copy(J.lEl); p.rElb.position.copy(J.rEl); p.lDelt.position.copy(J.lSh); p.rDelt.position.copy(J.rSh);
    this.seg(p.neck, J.chest, J.head); p.neck.scale.y *= 0.7;
    for (const [m, w, e] of [[p.lHandM, J.lWr, J.lEl], [p.rHandM, J.rWr, J.rEl]]) { const dir = new THREE.Vector3().subVectors(w, e).normalize(); m.position.copy(w); m.quaternion.setFromUnitVectors(_up, dir); }
    // torso orientation basis: up = spine, forward = facing
    const fwd = f.clone().sub(spineDir.clone().multiplyScalar(f.dot(spineDir))).normalize();
    const right = new THREE.Vector3().crossVectors(spineDir, fwd).normalize();
    const m4 = new THREE.Matrix4().makeBasis(right.negate(), spineDir, fwd);
    const q = new THREE.Quaternion().setFromRotationMatrix(m4);
    const qt = new THREE.Quaternion().setFromAxisAngle(spineDir, twist * 0.5 + (P.twist || 0) * 0.6).multiply(q);
    p.torso.position.copy(J.pelvis); p.torso.quaternion.copy(qt);
    p.shorts.position.copy(J.pelvis); p.shorts.quaternion.copy(q); p.band.position.copy(J.pelvis); p.band.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    p.head.position.copy(J.head);
    const look = P.look ?? P.facing;
    p.head.quaternion.setFromAxisAngle(_up, look).premultiply(new THREE.Quaternion().setFromUnitVectors(_up, spineDir));
    for (const [shoe, sole, sock, an, toe] of [[p.lShoe, p.lSole, p.lSock, J.lAn, J.lToe], [p.rShoe, p.rSole, p.rSock, J.rAn, J.rToe]]) {
      const yaw = Math.atan2(toe.x - an.x, toe.z - an.z);
      const fp = an.clone(); fp.y -= d.ankle;
      shoe.position.copy(fp); shoe.rotation.set(0, yaw, 0); sole.position.copy(fp); sole.rotation.set(0, yaw, 0);
      sock.position.copy(fp); sock.rotation.set(0, yaw, 0);
    }
  }
  // world positions of the palm center for ball contact
  palm(side) { return side === 'L' ? this.j.lHand : this.j.rHand; }
};
