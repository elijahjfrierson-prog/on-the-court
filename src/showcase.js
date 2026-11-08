// Static showcase scene for screenshots / menu background.
const OTC = window.OTC;
OTC.showcase = (app) => {
  const L = OTC.LEAGUE.teams, ind = L.find(t => t.abbr === 'IND') || L[0], lal = L.find(t => t.abbr === 'LAL') || L[1];
  const mk = (pl, team, home) => {
    const b = OTC.rosterBuild(pl); const r = OTC.ratingsFromOvr(pl); OTC.assignAnimations(b, r);
    const a = new OTC.Athlete(b, { color: home ? team.color : '#f4f4f4', trim: home ? team.alt : team.color, short: team.name.toUpperCase().slice(0, 9), text: home ? '#fff' : team.color });
    app.scene.add(a.root); return a;
  };
  const p1 = mk(ind.players[0], ind, true), d1 = mk(lal.players[0], lal, false), p2 = mk(ind.players[1], ind, true), d2 = mk(lal.players[1], lal, false);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(OTC.COURT.ballR, 32, 24), OTC.ballMaterial()); ball.castShadow = true; app.scene.add(ball);
  let t = 0;
  return (dt) => {
    t += dt;
    const pos = new THREE.Vector3(0.4, 0, 6.2), dpos = new THREE.Vector3(0.1, 0, 7.6);
    p1.pose({ pos, facing: 0.15, vel: { x: 0.6, z: 1.5 }, crouch: 0.12, rHand: new THREE.Vector3(pos.x + 0.45, 0.75 + Math.abs(Math.sin(t * 7)) * 0.2, pos.z + 0.3), lHand: null }, dt);
    const by = 0.12 + Math.abs(Math.sin(t * 7)) * 0.62; ball.position.set(pos.x + 0.45, by, pos.z + 0.33); ball.rotation.x += dt * 8;
    d1.pose({ pos: dpos, facing: Math.PI, vel: { x: 0, z: 0 }, crouch: 0.2, stance: 'defense' }, dt);
    p2.pose({ pos: new THREE.Vector3(-4.8, 0, 9.5), facing: 0.6, vel: { x: 1.5, z: 2.5 }, crouch: 0.06 }, dt);
    d2.pose({ pos: new THREE.Vector3(-4.2, 0, 10.6), facing: Math.PI - 0.4, vel: { x: 1.2, z: 2 }, crouch: 0.15, stance: 'defense' }, dt);
    return pos;
  };
};
OTC.ballMaterial = () => {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#c4581f'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,170,110'},${Math.random() * 0.12})`; g.fillRect(Math.random() * 512, Math.random() * 256, 1.5, 1.5); }
  g.strokeStyle = '#1b0e08'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();
  for (const x of [128, 384]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (const s of [-1, 1]) { g.beginPath(); for (let x = 0; x <= 512; x += 4) { const y = 128 + s * Math.cos(x / 512 * Math.PI * 2) * 70; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.62, clearcoat: 0.15, sheen: 0.4, sheenColor: new THREE.Color('#ff9a5a') });
};
