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
    for (const s of stages) s.tick(dt);
  }
  requestAnimationFrame(loop);

  const rigOf = (code) => SD_MAP[code] || null;
  const texCache = new WeakMap();
  const texOf = (cv) => { let t = texCache.get(cv); if (!t) { t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; texCache.set(cv, t); } return t; };
  let geo = null; const spriteGeo = () => geo || (geo = new THREE.PlaneGeometry(1, 1));

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
      for (const [name, n] of [["move", 6], ["atk", 5], ["idle", 1]]) {
        const c = a.sd; const clip = c.has(name) ? name : name === "move" && c.has("idle") ? "idle" : "idle";
        c.play(clip, null, true); c.speed = 0; c.fadeD = 0;
        const dur = c.clip ? c.clip.dur : 1; out[name] = [];
        for (let k = 0; k < n; k++) {
          c.time = (dur * k) / n; c.apply(); c.render(); st.tick(0);
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
      this.el = el; this.H = opts.height || 10; this.actors = []; this.alive = true; this.fx = [];
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

    // 카메라 가로 이동 (야전의 넓은 전장). x = 화면 중앙의 월드 좌표
    setCam(x) {
      this.camX = x;
      if (!this.camera) return;
      const a = this.w / this.h, H = this.H;
      Object.assign(this.camera, { left: x - (H / 2) * a, right: x + (H / 2) * a, top: H / 2, bottom: -H / 2 });
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
        if (loop) { c.play(n, null, true); return res(); }
        let done = false; const fin = () => { if (!done) { done = true; res(); } };
        c.play(n, () => { if (n === "die") { c.play("die"); c.time = c.clip.dur - 0.01; c.speed = 0; } fin(); });
        setTimeout(fin, Math.min(2600, (c.clip ? c.clip.dur : 1) * 1000 + 60));
      });
    }

    // ── 스프라이트 병사 ──
    // frames: { move: [canvas...], atk: [canvas...], aspect } (Stage.bake 결과)
    addSprite(frames, x, y, h, face = 1) {
      if (!this.scene) return null;
      const s = { sprite: true, frames, x, y, h, face, anim: "move", fi: 0, ft: 0, opacity: 1, alive: true, sink: 0 };
      const tex = texOf(frames.move[0]);
      s.mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      s.mesh = new THREE.Mesh(spriteGeo(), s.mat);
      this.scene.add(s.mesh);
      (this.sprites ||= []).push(s);
      return s;
    }
    spriteAnim(s, name, once) { if (!s || s.anim === name && !once) return; s.anim = name; s.fi = 0; s.ft = 0; s.once = !!once; }
    removeSprite(s) { if (!s || !s.mesh) return; this.scene.remove(s.mesh); s.mat.dispose(); s.mesh = null; s.alive = false; }

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

    // 간단한 빛 이펙트 (가산 혼합 원)
    burst(x, y, color = 0xffd27a, size = 1.2, life = 0.32) {
      if (!this.scene) return;
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthTest: false });
      const g = new THREE.Mesh(new THREE.RingGeometry(0.35, 1, 32), m);
      g.position.set(x, y, 0); g.renderOrder = 50; g.scale.set(0.2, 0.2, 1);
      this.scene.add(g);
      this.fx.push({ o: g, t: 0, life, size, kind: "burst" });
    }
    // 떠오르며 사라지는 작은 빛 알갱이 (엔딩 연출)
    sparkle(x, y, color = 0xffb8d8, life = 2.4) {
      if (!this.scene) return;
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthTest: false });
      const g = new THREE.Mesh(new THREE.CircleGeometry(0.07 + Math.random() * 0.06, 12), m);
      g.position.set(x, y, 0); g.renderOrder = 51;
      this.scene.add(g);
      this.fx.push({ o: g, t: 0, life, kind: "sparkle", x0: x, y0: y, sw: (Math.random() - 0.5) * 0.6 });
    }
    beam(x0, y0, x1, y1, color = 0x9fd6ff, life = 0.16) {
      if (!this.scene) return;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthTest: false });
      const g = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.05), m);
      g.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); g.rotation.z = Math.atan2(y1 - y0, x1 - x0); g.renderOrder = 49;
      this.scene.add(g);
      this.fx.push({ o: g, t: 0, life, kind: "beam" });
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
        if (a.lunge) { a.lunge.t += dt; const k = Math.min(1, a.lunge.t / a.lunge.d); ox += a.lunge.dx * Math.sin(k * Math.PI) * (k < 0.5 ? 1 : 1); oy += Math.sin(k * Math.PI) * 0.25; if (k >= 1) a.lunge = null; }
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
          sp.ft += dt * (sp.anim === "atk" ? 12 : 9);
          if (sp.ft >= 1) { sp.ft = 0; sp.fi++; if (sp.fi >= fr.length) { if (sp.once) { sp.once = false; sp.anim = sp.idle ? "idle" : "move"; } sp.fi = 0; } }
          const cur = (sp.frames[sp.anim] || sp.frames.move)[sp.fi % (sp.frames[sp.anim] || sp.frames.move).length];
          const tex = texOf(cur); if (sp.mat.map !== tex) { sp.mat.map = tex; sp.mat.needsUpdate = true; }
          let fall = 0;
          if (sp.dying != null) {
            sp.dying -= dt; sp.opacity = Math.max(0, Math.min(1, sp.dying / 0.45));
            // 쓰러짐: 맞은 반대쪽으로 넘어지며 사라진다 (탈주·철수 병사는 그냥 흐려진다)
            if (!sp.noFall) { sp.fallT = (sp.fallT || 0) + dt; fall = Math.min(1, sp.fallT / 0.22); } else sp.sink += dt * 0.5;
            if (sp.dying <= 0) { this.removeSprite(sp); return false; }
          }
          sp.mesh.rotation.z = fall ? -sp.face * fall * 1.35 : 0;
          let ox = 0;
          if (sp.kb) { sp.kb.t += dt; const k = Math.min(1, sp.kb.t / 0.25); ox = sp.kb.dir * 0.25 * Math.sin(k * Math.PI); if (k >= 1) sp.kb = null; }
          sp.mat.opacity = sp.opacity; { const k = sp.tint || 1, c = sp.team; if (c) sp.mat.color.setRGB(c[0] * k, c[1] * k, c[2] * k); else sp.mat.color.setScalar(k); }
          const w = sp.h * sp.frames.aspect;
          sp.mesh.scale.set(w * sp.face, sp.h, 1);
          sp.mesh.position.set(sp.x + ox, sp.y + sp.h / 2 - sp.sink - fall * sp.h * 0.32, 0);
          sp.mesh.renderOrder = 10 + Math.round(-sp.y * 10);
          return true;
        });
      }
      this.fx = this.fx.filter((f) => {
        f.t += dt; const k = f.t / f.life;
        if (k >= 1) { this.scene.remove(f.o); f.o.geometry.dispose(); f.o.material.dispose(); return false; }
        if (f.kind === "burst") { const s = f.size * (0.3 + k * 0.9); f.o.scale.set(s, s, 1); }
        if (f.kind === "sparkle") f.o.position.set(f.x0 + Math.sin(k * 6) * f.sw, f.y0 + k * 2.2, 0);
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
