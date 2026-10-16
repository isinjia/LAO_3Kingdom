// 라스트오리진 삼국지 — SD 캐릭터 무대 (three.js r128 + js/sd.js)
// 타이틀·전투·일기토에서 원작 SD 리그를 재생한다. 리그가 없으면 SD 얼굴 토큰으로 대체.
"use strict";

// 리그별 크기 보정: 리그 높이에 큰 무기·장식이 포함돼 몸이 작게 보이는 캐릭터 (모든 무대 공통)
const SD_SCALE = { labiata: 1.16, azazel: 1.08, constantia: 1.06 };
// 게임 코드 → SD 리그 id (tools/sd/BUILT.json 이 있으면 sd_map.js 가 덮어쓴다)
const SD_MAP = Object.assign({
  BR_Brownie: "brownie", BR_Gnome: "gnome", BR_Leprechaun: "leprechaun", BR_Impet: "impet", BR_Banshee: "banshee",
  BR_Nymph: "nymph", BR_Raven: "raven", BR_Harpy: "harpy", BR_Sylphid: "sylphid", BR_Valkyrie: "valkyrie",
  BR_Phoenix: "phoenix", DS_KunoichiZero: "zero", BR_Thetis: "thetis", BR_Leona: "leona", BR_Undine: "undine",
  DS_Azazel: "azazel", BR_Hela: "hela", ST_Tiamat: "tiamat", "3P_Labiata": "labiata", BR_Sleipnir: "sleipnir",
  "3P_ConstantiaS2": "constantia", "3P_Titania": "titania", ST_Mercury: "mercury", PECS_Empress: "empress",
  BR_Fafnir: "fafnir", DS_Ramiel: "ramiel",
  // 철충 지휘개체
  EmperorChick: "e_EmperorChick_N", Centurion: "e_Centurion_N", Destroyer: "e_Destroyer_N", Juggernaut: "e_Juggernaut_N",
  Legion: "e_Legion_N", Phalangites: "e_Phalangites_N", Harvester: "e_Harvester_N", NightChick: "e_NightChick_N",
  BigChick: "e_BigChick_N", DoomEater: "e_DoomEater_N", NestGuardian: "e_Fortress_N", Mammoth: "e_Gigantes_N",
  Testudo: "e_Rampart_N", Tortoise: "e_Rampart_N", Spector: "e_Intruder_N", Kidnapper: "e_Predator_N",
  // 일반 부대
  _militia: "e_Drone_N", _guard: "e_Rampart_N", _iron: "e_NightChick_N", _iron2: "e_Legion_N", _iron3: "e_BigChick_N",
}, typeof SD_MAP_BUILT !== "undefined" ? SD_MAP_BUILT : {});

const Stage = (() => {
  let renderer = null, ok = !!window.THREE && !!window.SD;
  const stages = new Set();
  let last = 0;

  function ensureRenderer() {
    if (renderer || !ok) return renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault()); // 복구를 허용 (three가 restored 시 재설정)
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(0x000000, 0);
      SD.gpuSkin = renderer.capabilities.floatVertexTextures;
      SD.renderer = renderer;
      SD.crossfade = 0.14;
      SD.pinRoot = true;
      SD.pinRange = 0.3;
      SD.mipmaps = renderer.capabilities.isWebGL2;
      SD.texScale = 0.5;
    } catch (e) { ok = false; renderer = null; }
    return renderer;
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    for (const s of stages) if (!s.manual) s.tick(dt); // manual: 주인 루프가 직접 그린다 (야전 — 갱신 직후에 그려야 라벨과 맞는다)
  }
  requestAnimationFrame(loop);

  const rigOf = (code) => SD_MAP[code] || null;
  const texCache = new WeakMap();
  const texOf = (cv) => { let t = texCache.get(cv); if (!t) { t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; texCache.set(cv, t); } return t; };
  let geo = null; const spriteGeo = () => geo || (geo = new THREE.PlaneGeometry(1, 1));
  // 부드러운 빛 무늬(가운데 밝고 바깥으로 사라지는 원) — 폭발·불티·빛무리가 함께 쓴다
  let glowT = null;
  const glowTex = () => glowT || (glowT = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.22, "rgba(255,255,255,.85)"); gr.addColorStop(0.55, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })());
  let rGeo = null; const ringGeo = () => rGeo || (rGeo = new THREE.RingGeometry(0.9, 1, 48));
  let shGeo = null, shMat = null;
  const shadowGeo = () => shGeo || (shGeo = new THREE.CircleGeometry(1, 16));
  // 진영 발판: 병사 발밑을 진영색 원반으로 (파랑·빨강) — 같은 리그를 쓰는 양군을 한눈에 가른다
  const teamMats = {};
  const teamMat = (c) => { const key = c.join(","); return teamMats[key] || (teamMats[key] = new THREE.MeshBasicMaterial({ color: new THREE.Color(Math.min(1, c[0] * 0.55), Math.min(1, c[1] * 0.55), Math.min(1, c[2] * 0.55)), transparent: true, opacity: 0.85, depthTest: false, depthWrite: false })); }; // (진하게 — 맞붙어도 진영이 보이게)
  const shadowMat = () => shMat ||(shMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthTest: false, depthWrite: false }));

  // 리그 하나를 이동·공격 프레임 이미지로 굽는다 (병사 스프라이트용). 결과는 코드별로 캐시
  const bakeCache = {};
  async function bake(code, opts = {}) {
    if (bakeCache[code]) return bakeCache[code];
    const rig = rigOf(code); if (!rig || !ensureRenderer() || !window.SD) return null;
    const t = await SD.prepare(rig); if (!t) return null;
    const W = opts.w || 96, H = opts.h || 120;
    const host = document.createElement("div"); host.style.cssText = `position:fixed;left:-4000px;top:0;width:${W}px;height:${H}px`;
    document.body.append(host);
    const st = new StageView(host, { height: 2.6 }); st.resize();
    const a = st.add(code, 0, -1.22, 2.2, 1, { full: true });
    for (let i = 0; i < 40 && !a.sd; i++) await new Promise((r) => setTimeout(r, 50));
    const out = { aspect: W / H };
    if (a.sd) {
      for (const [name, n] of [["move", 6], ["atk", 5], ["idle", 4], ["die", 5]]) {
        const c = a.sd; if (name === "die" && !c.has("die")) continue; // (쓰러짐은 마지막 자세까지 굽는다) const clip = c.has(name) ? name : name === "move" && c.has("idle") ? "idle" : "idle";
        c.play(clip, null, true); c.speed = 0; c.fadeD = 0;
        const dur = c.clip ? c.clip.dur : 1; out[name] = [];
        for (let k = 0; k < n; k++) {
          c.time = name === "die" ? (dur * 0.97 * k) / (n - 1) : (dur * k) / n; c.apply(); c.render(); st.tick(0);
          const cv = document.createElement("canvas"); cv.width = st.canvas.width; cv.height = st.canvas.height;
          cv.getContext("2d").drawImage(st.canvas, 0, 0); out[name].push(cv);
        }
      }
    }
    st.destroy(); host.remove();
    if (!out.move) return null;
    return (bakeCache[code] = out);
  }

  class StageView {
    // el: 캔버스를 붙일 요소. opts.height = 월드 높이(기본 10)
    constructor(el, opts = {}) {
      this.el = el; this.H = opts.height || 10; this.camY = opts.camY || 0; this.actors = []; this.alive = true; this.fx = [];
      this.scene = window.THREE ? new THREE.Scene() : null;
      this.camera = window.THREE ? new THREE.OrthographicCamera(-8, 8, 5, -5, -100, 100) : null;
      ensureRenderer();
      this.canvas = document.createElement("canvas");
      this.canvas.className = "stageCanvas";
      el.prepend(this.canvas);
      this.ctx2d = null;
      this.resize();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
      stages.add(this);
    }

    resize() {
      const w = Math.max(1, this.el.clientWidth), h = Math.max(1, this.el.clientHeight);
      this.w = w; this.h = h;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
      this.setCam(this.camX || 0);
    }

    // 카메라 가로 이동 (야전의 넓은 전장). x = 화면 중앙의 월드 좌표, camY = 화면 세로 중앙(기본 0)
    setCam(x) {
      this.camX = x;
      if (!this.camera) return;
      const a = this.w / this.h, H = this.H, cy = this.camY;
      Object.assign(this.camera, { left: x - (H / 2) * a, right: x + (H / 2) * a, top: cy + H / 2, bottom: cy - H / 2 });
      this.camera.updateProjectionMatrix();
    }

    // 배우 추가: code(게임 코드 또는 _militia), x, y(발 위치, 월드), h(키, 월드), face(1=오른쪽 -1=왼쪽)
    add(code, x, y, h, face = 1, opts = {}) {
      const a = { code, x, y, h, face, rig: rigOf(code), sd: null, token: null, group: null, z: opts.z || 0, full: !!opts.full, opacity: 1, shake: 0, flash: 0 };
      if (this.scene) {
        a.group = new THREE.Group(); a.group.position.set(x, y, 0); this.scene.add(a.group);
      }
      this.actors.push(a);
      if (a.rig && ensureRenderer()) {
        if (!SD.ready(a.rig)) this.token(a, opts); // 로딩 중에는 스탠딩 카드로 대기
        SD.prepare(a.rig).then((t) => { if (!t || !this.alive || a.removed) { if (!t && !a.token) this.token(a, opts); return; } this.attach(a, t); });
      } else this.token(a, opts);
      return a;
    }

    attach(a, t) {
      const c = SD.create(a.rig); if (!c) return this.token(a);
      const k = (a.h / t.height) * (t.height > 15 && !a.full ? 0.88 : 1) * (SD_SCALE[a.rig] || 1); // 대형 리그 축소 (엔딩 무대는 opts.full로 해제)
      c.root.scale.set(k * a.face * (a.rig.startsWith("e_") ? -1 : 1), k, 1);
      c.root.position.set(-c.W[9] * k * a.face, -c.W[10] * k, 0);
      c.setOrder(10 + a.z);
      c.time = Math.random() * 0.6;
      if (a.token) { a.group.remove(a.token); a.token = null; }
      if (a.shadow) { a.group.remove(a.shadow); a.shadow = null; }
      a.group.add(c.root);
      a.sd = c; a.k = k;
      if (a.pending) { const p = a.pending; a.pending = null; this.play(a, p.name, p.loop); }
    }

    // 리그가 없을 때: 원형 SD 얼굴 토큰 + 그림자 (살짝 통통 튐)
    token(a) {
      if (!this.scene || a.token) return;
      const u = typeof U === "function" && G ? U(a.code) : null;
      const src = a.code.startsWith("_") ? "assets/icon/draft.webp" : (u && u.iron ? `assets/enemy/${a.code}.webp` : `assets/sdface/${a.code}.webp`);
      // 스탠딩 카드: 초상화 + 세력색 테두리 + 받침
      const cv = document.createElement("canvas"); cv.width = 220; cv.height = 300;
      const tex = new THREE.CanvasTexture(cv);
      const im = new Image();
      const col = (u && G && F(u.fac)) ? F(u.fac).color : "#c9b07a";
      const rr = (g, x, y, w, h2, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h2, r); g.arcTo(x + w, y + h2, x, y + h2, r); g.arcTo(x, y + h2, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      im.onload = () => {
        const g = cv.getContext("2d");
        g.save(); rr(g, 10, 6, 200, 240, 22); g.clip();
        g.fillStyle = "#151a22"; g.fillRect(0, 0, 220, 300);
        const big = !a.code.startsWith("_") && u && !u.iron;
        if (big) { const p = new Image(); }
        g.drawImage(im, 10, 6, 200, 200);
        const gr = g.createLinearGradient(0, 150, 0, 246); gr.addColorStop(0, "#0000"); gr.addColorStop(1, "#000c"); g.fillStyle = gr; g.fillRect(10, 150, 200, 96);
        g.restore();
        g.lineWidth = 7; g.strokeStyle = col; rr(g, 10, 6, 200, 240, 22); g.stroke();
        g.fillStyle = col; g.beginPath(); g.moveTo(80, 246); g.lineTo(140, 246); g.lineTo(122, 278); g.lineTo(98, 278); g.closePath(); g.fill();
        // 이름은 전투 라벨이 표시하므로 카드에는 그리지 않는다
        tex.needsUpdate = true;
      };
      im.src = src;
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const s = new THREE.Sprite(m);
      const k = a.h * 0.62;
      s.scale.set(k * 220 / 300, k, 1); s.position.set(0, a.h * 0.38, 0); s.renderOrder = 10 + a.z;
      const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthTest: false }));
      sh.scale.set(a.h * 0.22, a.h * 0.06, 1); sh.position.set(0, 0.02, 0); sh.renderOrder = 9 + a.z;
      a.token = s; a.shadow = sh; a.group.add(sh); a.group.add(s);
    }

    play(a, name, loop) {
      if (!a) return Promise.resolve();
      if (!a.sd) { a.pending = { name, loop }; if (a.token) this.bump(a, name); return new Promise((r) => setTimeout(r, 420)); }
      return new Promise((res) => {
        const c = a.sd;
        const n = c.has(name) ? name : name === "skill" && c.has("atk") ? "atk" : name === "win" ? "idle" : name;
        if (!c.has(n)) { if (name === "hit") a.shake = 0.3; return res(); } // 피격 모션이 없는 리그는 흔들림으로
        c.speed = 1; if (loop) { c.play(n, null, true); return res(); }
        let done = false; const fin = () => { if (!done) { done = true; res(); } };
        c.play(n, () => { if (n === "die") { c.play("die"); c.time = c.clip.dur - 0.01; c.speed = 0; } fin(); });
        setTimeout(fin, Math.min(2600, (c.clip ? c.clip.dur : 1) * 1000 + 60));
      });
    }

    // ── 스프라이트 병사 ──
    // frames: { move: [canvas...], atk: [canvas...], aspect } (Stage.bake 결과)
    addSprite(frames, x, y, h, face = 1) {
      if (!this.scene) return null;
      const s = { sprite: true, frames, x, y, h, face, anim: frames.idle ? "idle" : "move", fi: 0, ft: 0, opacity: 1, alive: true, sink: 0 };
      const tex = texOf(frames.move[0]);
      s.mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      s.mesh = new THREE.Mesh(spriteGeo(), s.mat);
      this.scene.add(s.mesh);
      // 발밑 그림자: 병사가 바닥에 붙어 보이게 (모든 병사가 같은 재질을 나눠 쓴다)
      s.shadow = new THREE.Mesh(shadowGeo(), shadowMat()); s.shadow.renderOrder = 5; this.scene.add(s.shadow);
      (this.sprites ||= []).push(s);
      return s;
    }
    spriteAnim(s, name, once) { if (!s || s.anim === name && !once) return; s.anim = name; s.fi = name === "idle" ? (Math.random() * 4) | 0 : 0; s.ft = 0; s.once = !!once; } // (대기는 저마다 다른 프레임에서 시작 — 한꺼번에 숨 쉬지 않게)
    removeSprite(s) { if (!s || !s.mesh) return; this.scene.remove(s.mesh); if (s.shadow) { this.scene.remove(s.shadow); s.shadow = null; } s.mat.dispose(); s.mesh = null; s.alive = false; }

    // 바라보는 방향 전환 (1 = 오른쪽, -1 = 왼쪽). 리그 루트의 좌우 반전과 기준점을 함께 뒤집는다
    setFace(a, f) {
      if (!a || a.face === f) return;
      a.face = f;
      if (a.sd && a.sd.root) { a.sd.root.scale.x = -a.sd.root.scale.x; a.sd.root.position.x = -a.sd.root.position.x; }
      if (a.token) a.token.scale.x = Math.abs(a.token.scale.x) * f;
    }
    lunge(a, dx, d = 0.42) { if (a) { a.lunge = { dx, d, t: 0 }; a.jump = 0; } }
    knock(a, dir, pow = 0.45) { if (a) a.kb = { dir, pow, t: 0 }; }
    bump(a, name) { a.shake = name === "hit" ? 0.35 : 0; a.jump = name === "atk" || name === "skill" ? 0.4 : 0; if (name === "die") a.dying = 1; }

    remove(a) { a.removed = true; if (a.group) this.scene.remove(a.group); if (a.sd) a.sd.dispose(); this.actors = this.actors.filter((x) => x !== a); }
    fadeOut(a, ms = 700) { a.fade = { t: 0, d: ms / 1000 }; }
    tint(a, r, g, b) { if (a.sd) a.sd.setTint(r, g, b); }

    // 월드 → 화면 좌표(px)
    toScreen(x, y) {
      const c = this.camera; if (!c) return { x: 0, y: 0 };
      return { x: ((x - c.left) / (c.right - c.left)) * this.w, y: ((c.top - y) / (c.top - c.bottom)) * this.h };
    }
    headOf(a) { return this.toScreen(a.x + (a.ox || 0), a.y + (a.oy || 0) + a.h * 1.02); }

    // 폭발·타격 빛: 부드러운 빛무리 + 사방으로 튀는 불티 (큰 것은 얇은 충격파 고리도). 화면이 하얗게 타지 않게 동시 개수를 제한한다
    burst(x, y, color = 0xffd27a, size = 1.2, life = 0.32) {
      if (!this.scene) return;
      const busy = this.fx.length;
      if (busy > 220) return;
      const add = (o, f) => { o.position.set(x, y, 0); this.scene.add(o); this.fx.push(Object.assign({ o, t: 0, shared: true }, f)); };
      const glowM = new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
      const gl = new THREE.Mesh(spriteGeo(), glowM); gl.renderOrder = 300;
      add(gl, { life, size, kind: "glow", peak: busy > 120 ? 0.3 : 0.5 });
      if (size >= 1.4 && busy < 160) {
        const rm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
        const rg = new THREE.Mesh(ringGeo(), rm); rg.renderOrder = 300;
        add(rg, { life: life * 1.3, size: size * 1.1, kind: "shock" });
      }
      const n = busy > 140 ? 0 : Math.round(Math.min(10, 3 + size * 3));
      for (let i = 0; i < n; i++) {
        const sm = new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
        const sp = new THREE.Mesh(spriteGeo(), sm); sp.renderOrder = 301;
        const a = Math.random() * Math.PI * 2, v = size * (2.2 + Math.random() * 2.6);
        add(sp, { life: life * (1 + Math.random() * 0.8), kind: "spark", x0: x, y0: y, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v * 0.9 + size, r: 0.06 + Math.random() * 0.07 * size });
      }
    }
    // 떠오르며 사라지는 작은 빛 알갱이 (엔딩 연출)
    sparkle(x, y, color = 0xffb8d8, life = 2.4) {
      if (!this.scene) return;
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthTest: false });
      const g = new THREE.Mesh(new THREE.CircleGeometry(0.07 + Math.random() * 0.06, 12), m);
      g.position.set(x, y, 0); g.renderOrder = 301;
      this.scene.add(g);
      this.fx.push({ o: g, t: 0, life, kind: "sparkle", x0: x, y0: y, sw: (Math.random() - 0.5) * 0.6 });
    }
    beam(x0, y0, x1, y1, color = 0x9fd6ff, life = 0.16) {
      if (!this.scene) return;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthTest: false });
      const g = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.05), m);
      g.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); g.rotation.z = Math.atan2(y1 - y0, x1 - x0); g.renderOrder = 299;
      this.scene.add(g);
      this.fx.push({ o: g, t: 0, life, kind: "beam" });
    }

    // 날아가는 탄: 짧은 빛줄기가 출발점에서 목표까지 날아간다 (화면을 가로지르는 긴 선 대신)
    bolt(x0, y0, x1, y1, color = 0x9fd6ff, life = 0.14, len = 0.55, wdt = 0.05) {
      if (!this.scene) return;
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthTest: false });
      const g = new THREE.Mesh(spriteGeo(), m);
      const L = Math.hypot(x1 - x0, y1 - y0) || 1;
      g.scale.set(Math.min(len, L), wdt, 1); g.rotation.z = Math.atan2(y1 - y0, x1 - x0); g.renderOrder = 299; g.position.set(x0, y0, 0);
      this.scene.add(g);
      this.fx.push({ o: g, t: 0, life, kind: "bolt", x0, y0, x1, y1, shared: true });
    }
    // 발밑 고리: 장수 위치 표시 (진영색). 돌려받은 객체의 set(x, y, w, opacity)로 매 프레임 옮긴다
    ring(color) {
      if (!this.scene) return null;
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false });
      const o = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 40), m); o.renderOrder = 6; this.scene.add(o);
      const fill = new THREE.Mesh(shadowGeo(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthTest: false, depthWrite: false })); fill.renderOrder = 5; this.scene.add(fill);
      const r = { set: (x, y, w, op) => { o.position.set(x, y + 0.04, 0); o.scale.set(w, w * 0.3, 1); m.opacity = op; fill.position.set(x, y + 0.04, 0); fill.scale.set(w, w * 0.3, 1); fill.material.opacity = op * 0.25; o.visible = fill.visible = op > 0.01; },
        color: (c) => { m.color.setHex(c); fill.material.color.setHex(c); } };
      return r;
    }
    // 바닥 먼지: 넓게 퍼지며 옅어지는 흙먼지 (발밑 충돌·폭발 자국)
    dust(x, y, size = 0.6, life = 0.45, color = 0xb8a27a) {
      if (!this.scene) return;
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthTest: false });
      const g = new THREE.Mesh(shadowGeo(), m);
      g.position.set(x, y + 0.05, 0); g.renderOrder = 6; g.scale.set(0.1, 0.04, 1);
      this.scene.add(g);
      this.fx.push({ o: g, t: 0, life, size, kind: "dust", shared: true });
    }

    tick(dt) {
      if (!this.alive) return;
      if (this.timeScale != null) dt *= this.timeScale; // 야전: 일시정지·배속을 애니메이션에도 적용
      for (const a of this.actors) {
        if (a.sd) a.sd.update(dt);
        if (!a.group) continue;
        let ox = 0, oy = 0;
        if (a.shake > 0) { a.shake -= dt; ox = (Math.random() - 0.5) * 0.25; }
        if (a.jump > 0) { a.jump -= dt; oy = Math.sin((0.4 - a.jump) / 0.4 * Math.PI) * 0.6; ox = a.face * Math.sin((0.4 - a.jump) / 0.4 * Math.PI) * 0.8; }
        // 돌진(목표 쪽으로 나갔다 복귀)과 넉백(맞은 방향으로 밀렸다 복귀)
        if (a.lunge) { a.lunge.t += dt; const k = Math.min(1, a.lunge.t / a.lunge.d); ox += a.lunge.dx * Math.sin(k * Math.PI); /* 앞뒤로만 (위아래로 출렁이지 않게) */ if (k >= 1) a.lunge = null; }
        if (a.kb) { a.kb.t += dt; const k = Math.min(1, a.kb.t / 0.32); ox += a.kb.dir * a.kb.pow * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * (1 - k); if (k >= 1) a.kb = null; }
        if (a.token && !a.dying) { const t = performance.now() / 420 + a.x; a.token.position.y = a.h * 0.38 + Math.sin(t) * 0.05; const k = a.h * 0.62 * (1 + Math.sin(t * 1.3) * 0.012); a.token.scale.set(k * 220 / 300, k, 1); }
        if (a.dying && a.token) { a.dying -= dt; a.token.material.opacity = Math.max(0, a.dying); }
        if (a.fade) {
          a.fade.t += dt; const o = Math.max(0, 1 - a.fade.t / a.fade.d);
          if (a.sd) a.sd.setOpacity(o); if (a.token) a.token.material.opacity = o;
        }
        a.ox = ox; a.oy = oy; // 라벨이 돌진·넉백을 따라가도록 보관
        a.group.position.set(a.x + ox, a.y + oy, 0);
      }
      if (this.sprites) {
        this.sprites = this.sprites.filter((sp) => {
          if (!sp.mesh) return false;
          const fr = sp.frames[sp.anim] || sp.frames.move;
          sp.ft += dt * (sp.anim === "atk" ? 12 : sp.anim === "die" ? 14 : sp.anim === "idle" ? 4 : 9 * (sp.rate || 1)); // 걸음은 실제 속도에 맞춘다 (발이 미끄러지지 않게)
          if (sp.ft >= 1) { sp.ft = Math.min(1, sp.ft - 1); sp.fi++; if (sp.fi >= fr.length) { if (sp.anim === "die") sp.fi = fr.length - 1; else if (sp.once) { sp.once = false; sp.anim = sp.idle ? "idle" : "move"; } sp.fi = 0; } }
          const cur = (sp.frames[sp.anim] || sp.frames.move)[sp.fi % (sp.frames[sp.anim] || sp.frames.move).length];
          const tex = texOf(cur); if (sp.mat.map !== tex) { sp.mat.map = tex; sp.mat.needsUpdate = true; }
          let fall = 0;
          if (sp.dying != null) {
            sp.dying -= dt; sp.opacity = sp.corpse ? Math.max(0, Math.min(0.85, sp.dying / 1.2)) : Math.max(0, Math.min(1, sp.dying / 0.45)); // 시체는 옅게 남았다가 마지막 2초에 사라진다
            // 쓰러짐: 맞은 반대쪽으로 넘어지며 사라진다 (탈주·철수 병사는 그냥 흐려진다)
            if (!sp.noFall) { if (sp.frames.die && !sp.launch) { if (sp.anim !== "die") this.spriteAnim(sp, "die"); } else { sp.fallT = (sp.fallT || 0) + dt; fall = Math.min(1, sp.fallT / 0.22); } } else sp.sink += dt * 0.5; // 쓰러짐 동작이 있으면 그 동작으로 넘어진다
            if (sp.dying <= 0) { this.removeSprite(sp); return false; }
          }
          sp.mesh.rotation.z = fall ? -sp.face * fall * 1.35 : 0;
          let ox = 0, oy = 0;
          // 튕겨 날아감: 큰 타격에 쓰러진 병사는 포물선을 그리며 뒤로 날아가 떨어진다
          if (sp.launch) { const t = sp.launch.t += dt; oy = Math.max(0, 4 * t - 10 * t * t); ox = sp.launch.dir * Math.min(t, 0.4) * 2.2; sp.mesh.rotation.z = -sp.launch.dir * Math.min(1.6, t * 6); }
          if (sp.kb) { sp.kb.t += dt; const k = Math.min(1, sp.kb.t / 0.25); ox += sp.kb.dir * 0.3 * Math.sin(k * Math.PI); if (k >= 1) sp.kb = null; }
          // 피격 번쩍임: 맞은 순간 잠깐 밝아진다
          if (sp.hitT > 0) sp.hitT -= dt;
          if (sp.rise > 0) sp.rise -= dt; // 되살아난 병사는 서서히 나타난다
          sp.mat.opacity = sp.opacity * (sp.rise > 0 ? 1 - sp.rise / 0.4 : 1); { const k = (sp.tint || 1) * (sp.hitT > 0 ? 2.2 : 1), c = sp.corpse && sp.dying != null && sp.team ? sp.team.map((v) => v * 0.6 + 0.12) : sp.team; /* 시체는 진영색을 어둡게 (회색 유령처럼 보이지 않게) */ if (c) sp.mat.color.setRGB(c[0] * k, c[1] * k, c[2] * k); else sp.mat.color.setScalar(k); }
          const w = sp.h * sp.frames.aspect;
          sp.mesh.scale.set(w * sp.face, sp.h, 1);
          // 그리는 위치는 실제 위치를 부드럽게 따라간다 (밀어내기로 생기는 작은 떨림을 감춘다. 순간 이동처럼 크게 벌어지면 바로 맞춘다)
          if (sp.rx == null || Math.abs(sp.x - sp.rx) > 1.5 || Math.abs(sp.y - sp.ry) > 1.5) { sp.rx = sp.x; sp.ry = sp.y; } else { const k = Math.min(1, dt * 14); sp.rx += (sp.x - sp.rx) * k; sp.ry += (sp.y - sp.ry) * k; }
          sp.mesh.position.set(sp.rx + ox, sp.ry + sp.h / 2 - sp.sink - (sp.launch ? 0 : fall * sp.h * 0.32) + oy, 0);
          sp.mesh.renderOrder = sp.corpse ? 7 : 20 + Math.round(-sp.y * 10); // (시체는 살아 있는 병사 아래) // 유닛 20~80 · 바닥(그림자·발판·고리·먼지) 5~6 · 효과 299~301
          if (sp.shadow) { if (sp.team && !sp.teamSet) { sp.teamSet = true; sp.shadow.material = teamMat(sp.teamDisc || sp.team); } sp.shadow.visible = sp.dying == null;sp.shadow.position.set(sp.rx + ox, sp.ry + 0.03, 0); sp.shadow.scale.set(sp.h * 0.26, sp.h * 0.07, 1); }
          return true;
        });
      }
      this.fx = this.fx.filter((f) => {
        f.t += dt; const k = f.t / f.life;
        if (k >= 1) { this.scene.remove(f.o); if (!f.shared) f.o.geometry.dispose(); f.o.material.dispose(); return false; }
        if (f.kind === "burst") { const s = f.size * (0.3 + k * 0.9); f.o.scale.set(s, s, 1); }
        if (f.kind === "sparkle") f.o.position.set(f.x0 + Math.sin(k * 6) * f.sw, f.y0 + k * 2.2, 0);
        if (f.kind === "glow") { const s = f.size * (0.55 + Math.sqrt(k) * 0.9) * 1.6; f.o.scale.set(s, s, 1); f.o.material.opacity = f.peak * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85); return true; }
        if (f.kind === "shock") { const s = f.size * (0.3 + k * 1.1); f.o.scale.set(s, s * 0.45, 1); f.o.material.opacity = 0.5 * (1 - k); return true; }
        if (f.kind === "spark") { const tt = f.t; f.o.position.set(f.x0 + f.vx * tt * 0.5, f.y0 + f.vy * tt * 0.5 - 4.5 * tt * tt, 0); const s = f.r * (1 - k * 0.6) * 2; f.o.scale.set(s, s, 1); f.o.material.opacity = 0.9 * (1 - k); return true; }
        if (f.kind === "bolt") { f.o.position.set(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k, 0); f.o.material.opacity = 0.95; return true; }
        if (f.kind === "dust") { const s = f.size * (0.4 + k * 0.8); f.o.scale.set(s, s * 0.32, 1); f.o.material.opacity = 0.4 * (1 - k); return true; }
        f.o.material.opacity = (f.kind === "burst" ? 0.6 : 0.85) * (1 - k);
        return true;
      });
      if (!this.scene || !renderer) return;
      // 하나의 WebGL 렌더러를 무대마다 돌려 쓴다 (각 무대 캔버스로 복사)
      const w = this.canvas.width, h = this.canvas.height;
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) renderer.setSize(w, h, false);
      renderer.render(this.scene, this.camera);
      // 컨텍스트를 잃은 프레임(저메모리 GPU 등)은 지우지 않고 직전 화면을 유지한다 — SD가 한순간 전부 사라지는 깜빡임 방지
      const gl = renderer.getContext(); if (gl && gl.isContextLost && gl.isContextLost()) return;
      if (!this.ctx2d) this.ctx2d = this.canvas.getContext("2d");
      this.ctx2d.clearRect(0, 0, w, h);
      this.ctx2d.drawImage(renderer.domElement, 0, 0);
    }

    destroy() {
      this.alive = false; stages.delete(this); this.ro.disconnect();
      for (const a of this.actors) if (a.sd) a.sd.dispose();
      for (const sp of this.sprites || []) this.removeSprite(sp);
      this.actors = []; this.sprites = []; this.canvas.remove();
    }
  }

  return { create: (el, opts) => new StageView(el, opts), rigOf, bake, get ok() { return ok; }, ensure: ensureRenderer };
})();
