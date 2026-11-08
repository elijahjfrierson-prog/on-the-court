// ===== Renderer + UE5-style post stack (bloom, AO, grading, vignette, grain, SMAA) with auto quality.
const OTC = window.OTC;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.32 }, grain: { value: 0.035 }, warmth: { value: 0.04 }, contrast: { value: 1.08 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vignette, grain, warmth, contrast; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = (col - 0.5) * contrast + 0.5;
      col.r += warmth; col.b -= warmth * 0.6;
      float l = dot(col, vec3(0.299,0.587,0.114)); col = mix(vec3(l), col, 1.08);
      vec2 d = vUv - 0.5; col *= 1.0 - vignette * dot(d, d) * 2.2;
      col += (rnd(vUv * 1000.0) - 0.5) * grain;
      gl_FragColor = vec4(col, c.a);
    }`,
};
OTC.Renderer = class {
  constructor(canvas, quality = 'High') {
    this.canvas = canvas; this.quality = quality;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = quality !== 'Low'; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scale = quality === 'Low' ? 0.7 : 1; this.frameTimes = []; this.post = null;
  }
  setup(scene, camera) {
    this.scene = scene; this.camera = camera; const X = window.THREEX, q = this.quality;
    const c = this.post = new X.EffectComposer(this.r);
    c.addPass(new X.RenderPass(scene, camera));
    if (q === 'Ultra') {
      const sao = this.sao = new X.SAOPass(scene, camera);
      Object.assign(sao.params, { saoIntensity: 0.012, saoScale: 4, saoKernelRadius: 30, saoBlurRadius: 6, saoMinResolution: 0 });
      c.addPass(sao);
    }
    if (q !== 'Low') { this.bloom = new X.UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.6, 0.86); c.addPass(this.bloom); }
    c.addPass(new X.OutputPass());
    this.grade = new X.ShaderPass(GradeShader); c.addPass(this.grade);
    if (q !== 'Low') { this.smaa = new X.SMAAPass(1, 1); c.addPass(this.smaa); }
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    const pr = Math.min(devicePixelRatio || 1, this.quality === 'Ultra' ? 2 : 1.5) * this.scale;
    this.r.setPixelRatio(pr); this.r.setSize(w, h, false);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.post) { this.post.setPixelRatio(pr); this.post.setSize(w, h); }
  }
  render(dt) {
    if (this.grade) this.grade.uniforms.time.value = (this.grade.uniforms.time.value + dt) % 100;
    if (this.post) this.post.render(dt); else this.r.render(this.scene, this.camera);
    // auto quality: keep frames consistent by trading resolution
    this.frameTimes.push(dt); if (this.frameTimes.length > 90) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length; this.frameTimes.length = 0;
      if (this.autoQuality !== false) {
        if (avg > 1 / 48 && this.scale > 0.55) { this.scale -= 0.1; this.resize(); }
        else if (avg < 1 / 58 && this.scale < 1) { this.scale = Math.min(1, this.scale + 0.05); this.resize(); }
      }
    }
  }
};
