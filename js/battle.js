// 라스트오리진 삼국지 — 전투 / 일기토 / 설전 (SD 연출)
"use strict";

const MAX_ROUNDS = 10;
const GENERIC = {
  militia: { name: "자경단", code: "_militia", st: { ldr: 42, war: 40, int: 30, pol: 30, cha: 30 }, cls: 0 },
  iron: { name: "철충 무리", code: "_iron", st: { ldr: 55, war: 62, int: 15, pol: 0, cha: 0 }, cls: 1 },
  guard: { name: "수비대", code: "_guard", st: { ldr: 50, war: 48, int: 40, pol: 30, cha: 30 }, cls: 1 },
};
const ACT_KO = { attack: "공격", charge: "돌격", plot: "책략", defend: "방어", duel: "일기토", skill: "전법" };
// 원작 액티브 스킬 → 전법 효과 (TargetType: 3 단일 적, 4 범위 적, 1 아군 지정, 2 설치/보호, 0 자기 강화)
const SKILL_KIND = { 3: "단일 강타", 4: "범위 공격", 1: "아군 지원", 2: "보호 역장", 0: "자기 강화" };
// 원작 스킬 설명의 키워드 → 상태이상 (턴 수)
const STATUS = {
  defDown: { ko: "부식", desc: "받는 피해 +25%", bad: true }, stun: { ko: "기절", desc: "다음 행동 불가", bad: true },
  burn: { ko: "화상", desc: "매 턴 병력 -4%", bad: true }, mark: { ko: "표식", desc: "받는 피해 +20%", bad: true },
  weak: { ko: "약화", desc: "주는 피해 -25%", bad: true }, taunt: { ko: "도발", desc: "적이 이 부대를 노린다" },
  atkUp: { ko: "강화", desc: "주는 피해 +20%" }, barrier: { ko: "역장", desc: "받는 피해 -40%" },
  stunImm: { ko: "저항", desc: "기절에 걸리지 않음", hide: true },
};
function skillEffects(sk) {
  if (!sk) return null;
  const d = sk.d || "", E = { pierce: /보호 무시|방어 관통/.test(d), debuffs: [], buffs: [], cleanse: /해로운 효과 해제/.test(d) };
  if (/부식|방어력 감소|받는 피해 증가/.test(d)) E.debuffs.push("defDown");
  if (/행동력 감소|이동 불가/.test(d)) E.debuffs.push("stun");
  if (/점화|화염/.test(d)) E.debuffs.push("burn");
  if (/표식|회피 감소/.test(d)) E.debuffs.push("mark");
  if (/공격력 감소|치명타 감소|적중 감소/.test(d)) E.debuffs.push("weak");
  if (/도발/.test(d)) E.taunt = true;
  if (/공격력 증가|피해 증폭|지휘/.test(d) && (sk.t === 0 || sk.t === 1 || sk.t === 2)) E.buffs.push("atkUp");
  return E;
}
function skillSummary(sk) {
  const E = skillEffects(sk); if (!E) return "";
  const base = { 3: "단일 피해 ×2.1 (처치 시 적 전체 사기 -10)", 4: "적 전체 피해 ×1.25/√대상수", 1: "아군 1부대 병력 +14% · 아군 사기 +12", 2: "아군 전체 역장 2턴 · 사기 +8", 0: "자신 병력 +12% · 사기 +20" }[sk.t];
  const st = [...E.debuffs.map((k) => STATUS[k].ko), ...E.buffs.map((k) => STATUS[k].ko), E.taunt ? "도발" : null, E.cleanse ? "정화" : null, E.pierce ? "관통" : null].filter(Boolean);
  return `${base}${st.length ? " · " + st.join("·") : ""} · 쿨 3턴`;
}
let stSndAt = 0;
const addSt = (u, k, n) => {
  const had = u.sx && u.sx[k] > 0; (u.sx ||= {})[k] = Math.max(u.sx[k] || 0, n);
  const now = Date.now(); if (had || now - stSndAt < 250 || typeof Sound === "undefined" || typeof STATUS === "undefined" || !STATUS[k]) return;
  stSndAt = now; Sound.sfx(k === "stun" ? "stun" : STATUS[k].bad ? "debuff" : "buff", 0.55);
};
const hasSt = (u, k) => !!(u.sx && u.sx[k] > 0);
const GENERIC_SKILLS = {
  shot: { n: "일제 사격 지시", t: 3, ic: "SkillIconCircle_MGShot_active", d: "단일 대상 피해. 표식" },
  charge: { n: "총돌격", t: 4, ic: "SkillIconCircle_AssaultAttack_active", d: "지정 범위 피해. 방어력 감소" },
  wall: { n: "방벽 전개", t: 2, ic: "SkillIconCircle_SetBarricade_active", d: "아군 보호" },
};
const skillOf = (b) => (b && b.generic ? GENERIC_SKILLS[b.gsk || "shot"] : b && typeof LAO_SKILL !== "undefined" ? LAO_SKILL[b.code] : null);
// 철충 고유 특성 (리그 계열별)
const IRON_TRAIT = { _iron: "immune", NightChick: "immune", Scout: "immune", _iron2: "regen", Legion: "regen", Centurion: "regen", EmperorChick: "regen",
  _iron3: "counter", BigChick: "counter", Juggernaut: "counter", Destroyer: "counter", Mammoth: "counter" };
const TRAIT_KO = { immune: "기절 면역", regen: "재생", counter: "반격 장갑" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms / (Battle.speed || 1)));

const Battle = {
  speed: 1,

  async start(entry, onDone) {
    const w = entry.war;
    if (typeof Stage !== "undefined" && Stage.ok && window.SD) {
      Stage.ensure();
      const ids = [...w.atk, ...w.def].map((x) => Stage.rigOf(x.u.id)).filter(Boolean);
      UI.banner("출진 준비", "부대 집결 중…", 900);
      await Promise.race([Promise.all(ids.map((id) => SD.prepare(id))), new Promise((r) => setTimeout(r, 4000))]);
    }
    const p = P();
    const mk = (x, side) => ({ u: x.u, id: x.u.id, code: x.u.id, name: x.u.name, st: x.u.st, cls: x.u.cls, role: x.u.role, troops: x.troops, max: x.troops,
      morale: 80, side, out: false, captured: false, lord: isLord(x.u), cd: 1, trait: x.u.iron ? IRON_TRAIT[x.u.id] || null : null });
    // 총대장: 지휘권을 가진 플레이어 → 군주 → 공적 순
    const byLead = (arr, side) => arr.sort((x, y) => {
      const k = (b) => (entry.commander && side === entry.playerSide && b.id === p.id ? 1e9 : 0) + (b.lord ? 1e8 : 0) + (b.u ? b.u.merit : 0);
      return k(y) - k(x);
    });
    this.atk = byLead(w.atk.map((x) => mk(x, "atk")), "atk");
    this.def = byLead(w.def.map((x) => mk(x, "def")), "def");
    if (w.militia > 0 || !this.def.length) {
      const g = !w.defFac ? GENERIC.militia : F(w.defFac).iron ? GENERIC.iron : GENERIC.guard;
      const total = Math.max(300, w.militia);
      const parts = total > 6000 ? 3 : total > 2500 ? 2 : 1;
      const ALT = { _militia: ["_militia", "_militia", "_guard"], _guard: ["_militia", "_guard", "_guard"], _iron: ["_iron2", "_iron", "_iron3"] }[g.code]; // [돌격, 사격, 방벽]
      for (let k = 0; k < parts; k++) {
        const n = Math.round(total / parts);
        const idx = parts === 1 ? 1 : k;
        const R = [{ t: "돌격조", st: { war: 10, ldr: 0 }, role: 1, sk: "charge" }, { t: "사격조", st: { int: 8, war: 4 }, role: 1, sk: "shot" }, { t: "방벽조", st: { ldr: 10 }, role: 0, sk: "wall" }][idx];
        const st2 = Object.assign({}, g.st); for (const key in R.st) st2[key] = (st2[key] || 0) + R.st[key];
        this.def.push({ trait: IRON_TRAIT[ALT[idx]] || null, u: null, id: "_militia" + k, code: ALT[idx], name: R.t, gname: g.name, st: st2, cls: [g.cls, (g.cls + 1) % 3, (g.cls + 2) % 3][k], role: R.role, gsk: R.sk, troops: n, max: n, morale: 70, side: "def", out: false, generic: true, cd: 1 });
      }
    }
    // 부대 결속
    this.bonus = { atk: squadBonus(this.atk.map((b) => b.u)), def: squadBonus(this.def.map((b) => b.u)) };
    for (const side of ["atk", "def"]) for (const b of this.side(side)) {
      const q = this.bonus[side].find((x) => b.u && b.u.squad === x.key);
      b.mult = q ? q.mult : 1;
      if (q) b.morale = Math.min(100, b.morale + 5 * (q.n - 1));
    }
    // 승전 축하연 효과: 플레이어 세력 사기 +10
    if (G.flags.feastUntil && G.flags.feastUntil >= G.year * 12 + G.month) for (const s2 of ["atk", "def"]) { const fk = s2 === "atk" ? w.atkFac : w.defFac; if (fk && fk === P().fac) for (const x of this.side(s2)) x.morale = Math.min(100, x.morale + 10); }
    // 무력 통일 노선: 1년간 사기 +5
    if (G.flags.forceUntil && G.flags.forceUntil >= G.year * 12 + G.month) for (const s2 of ["atk", "def"]) { const fk = s2 === "atk" ? w.atkFac : w.defFac; if (fk && fk === P().fac) for (const x of this.side(s2)) x.morale = Math.min(100, x.morale + 5); }
    // 의자매가 같은 군에 있으면 사기 +10
    const pl = P();
    for (const side of ["atk", "def"]) {
      const arr = this.side(side);
      if (arr.some((b) => b.id === pl.id) && arr.some((b) => b.u && b.u.sworn)) for (const b of arr) b.morale = Math.min(100, b.morale + 10);
    }
    this.w = w; this.entry = entry; this.onDone = onDone; this.round = 1;
    this.mySide = entry.playerSide;
    this.ctrl = (b) => b.side === this.mySide && !b.generic && (entry.commander || b.id === p.id);
    this.orders = {}; this.cur = null; this.pending = null; this.logLines = [];
    const af = F(w.atkFac), df = F(w.defFac);
    this.title = `${af.name} ▶ ${w.to}`;
    this.sub = df ? `수비: ${df.name}` : "공백지 공략";
    const boss = (df && df.iron) || af.iron || this.all().some((b) => b.lord);
    Sound.bgm(boss ? "boss" : "battle");
    this.say(`${w.to} 공방전 개시! ${MAX_ROUNDS}턴 안에 수비군을 격파하면 공격측 승리.`);
    for (const s of ["atk", "def"]) for (const q of this.bonus[s]) this.say(`부대 결속 — ${q.name} ×${q.n}: 공격력 +${Math.round((q.mult - 1) * 100)}%`, "hot");
    UI.openBattle(this);
    this.layout();
    Sound.sfx("start");
    const lead = this.side(this.mySide).find((b) => !b.generic);
    if (lead) Sound.voice(lead.code, "SortiePick", ["StageStart", "BattleFocus"]);
    UI.banner("전투 개시", this.title);
    this.nextUnit();
  },

  // SD 무대 배치
  layout() {
    const st = this.stage = UI.battleStage;
    if (!st) return;
    // 앞줄 3칸 + 뒷줄 3칸 (총대장은 앞줄 가운데 뒤)
    const SLOTS = [[2.8, -4.1], [5.3, -3.1], [7.7, -4.2], [4.1, -1.9], [6.6, -1.6], [8.5, -2.7]];
    const maxX = st.camera ? st.camera.right - 1.4 : 8.5;
    const place = (arr, dir) => arr.forEach((b, i) => {
      const n = arr.length, cols = Math.max(2, Math.ceil(n / 2));
      const col = Math.floor(i / 2), row = i % 2;
      const span = Math.max(0.1, maxX - 2.2);
      let sx = 2.2 + (cols > 1 ? (col / (cols - 1)) * span : 0) + (row ? span / (cols * 2.2) : 0);
      sx = Math.min(maxX, sx);
      const sy = row ? -1.7 - (col % 2) * 0.3 : -4.0 + (col % 2) * 0.25;
      const h = ((b.generic ? 2.3 : 2.6) + (b.lord ? 0.3 : 0)) * (sy > -2.5 ? 0.88 : 1);
      b.actor = st.add(b.code, dir * sx, sy, h, -dir, { z: 20 - Math.round((sy + 5) * 2) });
    });
    place(this.atk, -1); place(this.def, 1);
  },

  all() { return [...this.atk, ...this.def]; },
  side(s) { return s === "atk" ? this.atk : this.def; },
  foe(s) { return s === "atk" ? this.def : this.atk; },
  alive(s) { return this.side(s).filter((b) => !b.out); },
  say(t, cls = "") { this.logLines.unshift({ t, cls }); if (this.logLines.length > 80) this.logLines.length = 80; },

  nextUnit() {
    const todo = this.alive(this.mySide).filter((b) => this.ctrl(b) && !this.orders[b.id]);
    this.cur = todo[0] || null; this.pending = null;
    this.render();
  },

  choose(act) {
    if (!this.cur || this.busy) return;
    Sound.sfx("click", 0.6);
    if (act === "retreat") { this.finish(false, true); return; }
    if (act === "defend") { this.orders[this.cur.id] = { act }; this.nextUnit(); return; }
    if (act === "skill") {
      const sk = skillOf(this.cur); if (!sk || this.cur.cd > 0) return;
      if (sk.t === 1) { this.pending = "skillAlly"; this.render(); return; }
      if (sk.t !== 3) { this.orders[this.cur.id] = { act }; this.nextUnit(); return; }
    }
    this.pending = act; this.render();
  },

  target(id) {
    if (!this.cur || !this.pending || this.busy) return;
    if (this.pending === "skillAlly") {
      const a = this.side(this.cur.side).find((x) => x.id === id && !x.out); if (!a) return;
      Sound.sfx("click", 0.6); this.orders[this.cur.id] = { act: "skill", target: id }; this.nextUnit(); return;
    }
    const t = this.foe(this.cur.side).find((b) => b.id === id && !b.out);
    if (!t) return;
    if (this.pending === "duel" && t.generic) { this.say("일반 부대에는 일기토를 신청할 수 없다.", "bad"); this.render(); return; }
    Sound.sfx("click", 0.6);
    this.orders[this.cur.id] = { act: this.pending, target: id };
    this.nextUnit();
  },

  // 내 부대 카드를 누르면 그 부대의 명령을 다시 정한다
  select(id) {
    if (this.busy) return;
    const b = this.side(this.mySide).find((x) => x.id === id && !x.out && this.ctrl(x));
    if (!b) return;
    delete this.orders[b.id]; this.cur = b; this.pending = null; this.render();
  },

  autoAll() { for (const b of this.alive(this.mySide)) if (this.ctrl(b) && !this.orders[b.id]) this.orders[b.id] = Object.assign(this.aiOrder(b), { auto: true }); this.cur = null; this.render(); },

  aiOrder(b) {
    const foes = this.foe(b.side).filter((x) => !x.out);
    if (!foes.length) return { act: "defend" };
    // 상성이 좋은 상대를 우선 노린다
    const score = (x) => clsEdge(b.cls, x.cls) * 2 - x.troops / Math.max(1, x.max) + Math.random() * 0.6;
    const taunter = foes.find((x) => hasSt(x, "taunt"));
    const t = taunter && Math.random() < 0.8 ? taunter : foes.slice().sort((x, y) => score(y) - score(x))[0];
    const sk = skillOf(b);
    if (sk && b.cd <= 0 && Math.random() < 0.45) return { act: "skill", target: t.id };
    if (b.troops < b.max * 0.25 && Math.random() < 0.4) return { act: "defend" };
    if (b.role === 2 && Math.random() < 0.25) return { act: "defend" };
    if (b.st.int >= 70 && Math.random() < 0.3) return { act: "plot", target: t.id };
    if (b.st.war >= 80 && Math.random() < 0.25) return { act: "charge", target: t.id };
    if (!b.generic && b.st.war >= 78 && Math.random() < 0.07) {
      const duelT = foes.filter((x) => !x.generic).sort((x, y) => y.st.war - x.st.war)[0];
      if (duelT) return { act: "duel", target: duelT.id };
    }
    return { act: "attack", target: t.id };
  },

  dmg(a, d, mult, pierce) {
    const pa = a.st.ldr * 0.65 + a.st.war * 0.35, pd = d.st.ldr * 0.65 + d.st.war * 0.35;
    let v = a.troops * 0.075 * (0.5 + pa / 100) / (0.55 + pd / 220) * (0.85 + Math.random() * 0.3) * mult;
    v *= 0.7 + a.morale / 330;
    v *= clsEdge(a.cls, d.cls) * (a.mult || 1);
    if (a.role === 1) v *= 1.1;
    if (d.role === 0) v *= 0.88;
    if (!pierce) {
      if (d.side === "def") { v *= 1 - Math.min(0.35, this.w.cityDef / 3000); const tc = C(this.w.to); if (tc && facLv(tc, "def") >= 3) v *= 0.92; }
      if (d.order === "defend") v *= 0.5;
      if (hasSt(d, "barrier")) v *= 0.6;
    }
    if (hasSt(a, "weak")) v *= 0.75; if (hasSt(a, "atkUp")) v *= 1.2;
    if (hasSt(d, "defDown")) v *= 1.25; if (hasSt(d, "mark")) v *= 1.2;
    return Math.max(20, Math.round(v));
  },

  hit(d, v, src) {
    if (d.trait === "counter" && src && !src.out && Math.random() < 0.2) { const r = Math.round(v * 0.3); src.troops = Math.max(0, src.troops - r); this.say(`${d.name}의 반격 장갑! ${src.name} -${fmt(r)}`, "bad"); if (src.troops <= 0) src.out = true; }
    d.troops = Math.max(0, d.troops - v);
    d.morale = Math.max(0, d.morale - Math.round(v / Math.max(d.max, 1) * 60));
    if (d.troops <= 0 || d.morale <= 0) { d.out = true; this.say(`${d.name} 부대 괴멸!`, "war"); return true; }
    return false;
  },

  // ── 연출 ──
  async anim(a, t, kind, v, dead, edge) {
    const st = this.stage;
    UI.updateBattleLabels(this);
    if (!st || !a.actor) return;
    const heavy = kind === "charge";
    if (heavy || kind === "plot") {
      if (!a.generic && (this.ctrl(a) || a.lord || Math.random() < 0.35)) {
        Sound.voice(a.code, "SpSkill", ["BattleFocus"]);
        await UI.cutin(a, kind === "charge" ? "돌격!" : "화계!");
      }
    }
    st.play(a.actor, heavy ? "skill" : "atk");
    // 근접(중장)·돌격은 목표 쪽으로 돌진했다 복귀, 원거리는 반동만
    { let n = 0; const lt = setInterval(() => { UI.updateBattleLabels(this); if (++n > 16) clearInterval(lt); }, 50); } // 돌진·넉백 동안 라벨 추적
    if (t && t.actor && (a.cls === 1 || heavy)) st.lunge(a.actor, (t.actor.x - a.actor.x) * (heavy ? 0.62 : 0.5), heavy ? 0.6 : 0.46);
    else if (t && t.actor) st.lunge(a.actor, -Math.sign(t.actor.x - a.actor.x) * 0.18, 0.3);
    if (!a.generic && !Sound.charSfx(a.code, heavy ? "s2" : "s1")) Sound.sfx(a.cls === 1 ? "boom" : a.cls === 2 ? "beam" : "shot", 0.8);
    else if (a.generic) Sound.sfx("shot", 0.6);
    await wait(heavy ? 520 : 380);
    if (t && t.actor) {
      const ty = t.actor.y + t.actor.h * 0.45;
      if (kind === "plot") { st.burst(t.actor.x, ty, 0xff7a2a, 1.5, 0.45); Sound.sfx("fire"); }
      else {
        if (a.cls !== 1) st.beam(a.actor.x, a.actor.y + a.actor.h * 0.5, t.actor.x, ty, heavy ? 0xffe28a : 0x9fd6ff);
        st.burst(t.actor.x, ty, heavy ? 0xffc35a : 0xffffff, heavy ? 1.3 : 0.75);
        Sound.sfx(t.u && t.u.cls === 1 ? "hitrobot" : heavy ? "hitbig" : "hit", 0.8);
      }
      if (v != null) UI.popDamage(this, t, v, edge > 1 ? "edge" : edge < 1 ? "weak" : heavy ? "crit" : "");
      st.knock(t.actor, Math.sign(t.actor.x - a.actor.x) || 1, heavy ? 0.75 : kind === "plot" ? 0.3 : 0.42);
      if (heavy || dead) { const el = document.getElementById("battle"); if (el) { el.classList.remove("shake", "shakeBig"); void el.offsetWidth; el.classList.add(heavy ? "shakeBig" : "shake"); } }
      if (dead) { await st.play(t.actor, "hit"); st.play(t.actor, "die"); st.fadeOut(t.actor, 900); Sound.charSfx(t.code, "die"); }
      else st.play(t.actor, "hit");
    }
    UI.updateBattleLabels(this);
    await wait(heavy ? 420 : 300);
  },

  async runRound() {
    for (const b of this.alive(this.mySide === "atk" ? "def" : "atk")) this.orders[b.id] = this.aiOrder(b);
    for (const b of this.alive(this.mySide)) if (!this.orders[b.id]) this.orders[b.id] = Object.assign(this.aiOrder(b), { auto: true });
    const actors = this.all().filter((b) => !b.out).sort((x, y) => y.st.war + Math.random() * 30 - (x.st.war + Math.random() * 30));
    for (const b of this.all()) b.order = this.orders[b.id] && this.orders[b.id].act;
    UI.banner(`${this.round}턴`, null, 600);
    await wait(500);
    for (const b of actors) {
      if (b.out || !this.$open) continue;
      const o = this.orders[b.id]; if (!o) continue;
      if (hasSt(b, "stun")) { this.say(`${b.name}: 기절 — 행동 불가`, "bad"); UI.popText(this, b, "기절"); await wait(260); continue; }
      if (o.act === "defend") {
        b.morale = Math.min(100, b.morale + 10);
        if (b.role === 2) for (const x of this.alive(b.side)) x.morale = Math.min(100, x.morale + 6);
        this.say(`${b.name}: 진형을 굳혔다.${b.role === 2 ? " (지원기 — 아군 사기 회복)" : ""}`);
        if (b.actor && this.stage) { this.stage.burst(b.actor.x, b.actor.y + b.actor.h * 0.5, 0x6fc8ff, 1.1, 0.45); Sound.sfx("shield", 0.6); }
        UI.updateBattleLabels(this); await wait(300);
        continue;
      }
      if (o.act === "skill") { await this.doSkill(b, o); this.render(); continue; }
      let t = this.foe(b.side).find((x) => x.id === o.target && !x.out) || this.foe(b.side).find((x) => !x.out);
      if (!t) break;
      const edge = clsEdge(b.cls, t.cls);
      if (o.act === "attack") {
        const v = this.dmg(b, t, 1); const dead = this.hit(t, v, b);
        this.say(`${b.name} ▶ ${t.name}: 공격 -${fmt(v)}${edge > 1 ? " (상성 우위)" : ""}`);
        await this.anim(b, t, "attack", v, dead, edge);
      } else if (o.act === "charge") {
        const v = this.dmg(b, t, b.u && hasSkill(b.u, "돌격") ? 1.85 : 1.55); const dead = this.hit(t, v);
        const cv = dead ? 0 : Math.round(this.dmg(t, b, 0.45)); if (cv) this.hit(b, cv);
        this.say(`${b.name} ▶ ${t.name}: 돌격! -${fmt(v)} (반격 -${fmt(cv)})`, "hot");
        await this.anim(b, t, "charge", v, dead, edge);
        if (cv && b.actor) { this.stage && this.stage.play(b.actor, b.out ? "die" : "hit"); UI.popDamage(this, b, cv, "weak"); if (b.out) this.stage.fadeOut(b.actor, 900); }
      } else if (o.act === "plot") {
        const ok = Math.random() * 100 < 45 + (b.st.int - t.st.int) * 1.4 + (b.u && hasSkill(b.u, "화계") ? 15 : 0) + (b.role === 2 ? 10 : 0);
        if (ok) {
          const v = Math.round(Math.min(t.troops * 0.25, b.troops * 0.07 * (0.6 + Math.max(0, b.st.int - t.st.int) / 60) * (b.u && hasSkill(b.u, "화계") ? 1.3 : 1) + 60));
          const dead = this.hit(t, v); t.morale = Math.max(0, t.morale - 10);
          this.say(`${b.name}의 화계! ${t.name} 혼란 -${fmt(v)}`, "hot");
          await this.anim(b, t, "plot", v, dead, 1);
        } else {
          this.say(`${b.name}의 책략은 ${t.name}에게 간파당했다.`);
          if (b.actor && this.stage) this.stage.play(b.actor, "atk");
          UI.popText(this, t, "간파!"); await wait(500);
        }
      } else if (o.act === "duel") {
        if (t.generic) { const v = this.dmg(b, t, 1); const dead = this.hit(t, v, b); await this.anim(b, t, "attack", v, dead, edge); continue; }
        // 직접 지휘한 명령이거나(자동 명령 제외) 적이 내 부대에 신청한 경우만 직접 일기토
        const manual = !Battle.autoDuel && ((this.ctrl(b) && !o.auto) || (this.ctrl(t) && !this.ctrl(b)));
        const mine = manual;
        let accepted = true;
        if (!this.ctrl(t)) accepted = t.st.war >= b.st.war - 12 || Math.random() < 0.35;
        else accepted = await UI.confirm("일기토 신청", `${jo(b.name, "이가")} ${t.name}에게 일기토를 신청했다!\n받아들이겠는가? (거절 시 사기 -15)`, b.u, "수락", "거절");
        if (!accepted) { t.morale = Math.max(0, t.morale - 15); b.morale = Math.min(100, b.morale + 10); this.say(`${jo(t.name, "이가")} 일기토를 거절했다. 사기 하락.`); UI.popText(this, t, "거절"); continue; }
        const left = this.ctrl(b) ? b : t, right = left === b ? t : b;
        Sound.voice(b.code, "BattleFocus", ["SpSkill"]);
        await UI.cutin(b, "일기토!");
        const winner = mine ? await new Promise((res) => Duel.start(left, right, (w) => res(w))) : Duel.simulate(b, t);
        if (mine) Sound.bgm(this.w && ((F(this.w.defFac) || {}).iron) ? "boss" : "battle");
        const loser = winner === b ? t : b;
        const lv = Math.round(loser.troops * 0.35); const dead = this.hit(loser, lv); loser.morale = Math.max(0, loser.morale - 35);
        winner.morale = Math.min(100, winner.morale + 20);
        this.say(`일기토: ${winner.name} 승리! ${loser.name} 부대 동요 -${fmt(lv)}`, "hot");
        if (loser.hpZero && Math.random() < 0.45) { loser.out = true; loser.captured = true; this.say(`${jo(loser.name, "이가")} 사로잡혔다!`, "war"); }
        await this.anim(winner, loser, "attack", lv, loser.out, 1);
      }
      this.render();
    }
    for (const b of this.all()) {
      if (b.out) continue;
      b.morale = Math.min(100, b.morale + 2); if (b.cd > 0) b.cd--;
      if (b.trait === "regen") { const n = Math.round(b.max * 0.05); b.troops = Math.min(b.max, b.troops + n); this.say(`${b.name}: 재생 +${fmt(n)}`); }
      if (hasSt(b, "burn")) { const n = Math.round(b.max * 0.04); this.hit(b, n); this.say(`${b.name}: 화상 -${fmt(n)}`, "bad"); if (b.actor && this.stage) this.stage.burst(b.actor.x, b.actor.y + b.actor.h * 0.4, 0xff7a2a, 0.7); }
      if (b.sxCd) for (const k in b.sxCd) if (b.sxCd[k] > 0) b.sxCd[k]--;
      if (b.sx) for (const k in b.sx) if (b.sx[k] > 0) { b.sx[k]--; if (!b.sx[k] && STATUS[k] && STATUS[k].bad) (b.sxCd ||= {})[k] = 1; }
    }
    this.orders = {};
    const end = this.check();
    if (end !== null) return this.finish(end);
    this.round++;
    if (this.round > MAX_ROUNDS) { this.say("제한 턴 종료 — 수비측이 거점을 지켜냈다."); return this.finish(false); }
    this.nextUnit();
  },

  // 총대장이 패주하면 남은 장수 중 하나가 1회 지휘를 이어받는다 (전군 사기 -25). 두 번째 패주 시 패배
  succeed(side) {
    const arr = this.side(side);
    const next = arr.find((x) => !x.out && !x.generic);
    if (!next || this.succeeded[side]) return false;
    this.succeeded[side] = true;
    arr.splice(arr.indexOf(next), 1); arr.unshift(next);
    for (const x of arr) x.morale = Math.max(5, x.morale - 25);
    this.say(`총대장 패주! ${jo(next.name, "이가")} 지휘를 이어받는다. (전군 사기 -25)`, "war");
    UI.banner("지휘 승계", `${next.name} 총대장 취임`, 1100, side === this.mySide ? "lose" : "win");
    return true;
  },

  // 고유 전법 (원작 액티브 스킬)
  async doSkill(b, o) {
    const sk = skillOf(b); if (!sk) return;
    b.cd = 3;
    const st = this.stage;
    Sound.voice(b.code, "SpSkill", ["BattleFocus"]);
    Sound.sfx("skillcharge", 0.7);
    await UI.cutin(b, sk.n, SKILL_KIND[sk.t]);
    if (b.actor && st) st.play(b.actor, "skill");
    if (!Sound.charSfx(b.code, "s2")) Sound.sfx("beam", 0.8);
    await wait(420);
    const foes = this.alive(b.side === "atk" ? "def" : "atk");
    const allies = this.alive(b.side);
    const E = skillEffects(sk);
    if (sk.t === 3 || sk.t === 4) {
      const targets = sk.t === 4 ? foes : [foes.find((x) => x.id === o.target) || foes[0]].filter(Boolean);
      const mult = sk.t === 4 ? 1.25 / Math.sqrt(Math.max(1, targets.length)) : 2.1;
      for (const t of targets) {
        const v = this.dmg(b, t, mult, E.pierce); const dead = this.hit(t, v);
        if (!dead) for (const k of E.debuffs) {
          if (k === "stun") { if (t.trait === "immune") { UI.popText(this, t, "면역"); continue; } if (hasSt(t, "stunImm") || Math.random() > (sk.t === 4 ? 0.3 : 0.6)) continue; addSt(t, "stun", 1); addSt(t, "stunImm", 3); UI.popText(this, t, "기절!"); continue; }
          if (sk.t === 4 && Math.random() > 0.2) continue;
          if (t.sxCd && t.sxCd[k] > 0) continue;
          addSt(t, k, 2);
        }
        if (E.pierce && !dead) UI.popText(this, t, "관통!");
        if (dead && sk.t === 3) { for (const x of foes) if (!x.out) { x.morale = Math.max(0, x.morale - 10); UI.popText(this, x, "사기↓"); } this.say("적 부대 처치 — 적 전체 사기 -10", "hot"); UI.banner("격파!", "적 전체 사기 -10", 900); }
        if (t.actor && st) { st.burst(t.actor.x, t.actor.y + t.actor.h * 0.45, sk.t === 4 ? 0xff9a4a : 0xffe28a, 1.3); if (dead) { st.play(t.actor, "die"); st.fadeOut(t.actor, 900); } else st.play(t.actor, "hit"); }
        UI.popDamage(this, t, v, "crit");
      }
      if (E.taunt) addSt(b, "taunt", 2);
      Sound.sfx(sk.t === 4 ? "bigboom" : "hitbig", 0.8);
      this.say(`${b.name}의 「${sk.n}」! ${sk.t === 4 ? "적 전체" : targets[0] ? targets[0].name : ""}에게 큰 피해`, "hot");
    } else if (sk.t === 1) {
      const t = allies.find((x) => x.id === o.target) || allies.slice().sort((x, y) => x.troops / x.max - y.troops / y.max)[0];
      if (t) { const n = Math.round(t.max * 0.14); t.troops = Math.min(t.max, t.troops + n); UI.popText(this, t, `+${fmt(n)}`); for (const k of E.buffs) addSt(t, k, 2); if (E.cleanse) for (const k in STATUS) if (STATUS[k].bad && t.sx) t.sx[k] = 0; }
      for (const x of allies) x.morale = Math.min(100, x.morale + 12);
      Sound.sfx("shield", 0.7);
      this.say(`${b.name}의 「${sk.n}」! 아군 사기 상승${t ? `, ${t.name} 병력 회복` : ""}`, "hot");
    } else if (sk.t === 2) {
      for (const x of allies) { addSt(x, "barrier", 2); for (const k of E.buffs) addSt(x, k, 2); if (E.cleanse && x.sx) for (const k in STATUS) if (STATUS[k].bad) x.sx[k] = 0; x.morale = Math.min(100, x.morale + 8); if (x.actor && st) st.burst(x.actor.x, x.actor.y + x.actor.h * 0.5, 0x6fc8ff, 1.0, 0.5); }
      Sound.sfx("shield", 0.8);
      this.say(`${b.name}의 「${sk.n}」! 2턴간 아군이 받는 피해 -40%`, "hot");
    } else {
      const n = Math.round(b.max * 0.12); b.troops = Math.min(b.max, b.troops + n); b.morale = Math.min(100, b.morale + 20);
      for (const k of E.buffs) addSt(b, k, 2); if (E.taunt) addSt(b, "taunt", 2); if (E.cleanse && b.sx) for (const k in STATUS) if (STATUS[k].bad) b.sx[k] = 0;
      UI.popText(this, b, `+${fmt(n)}`); Sound.sfx("charge", 0.7);
      this.say(`${b.name}의 「${sk.n}」! 자신 강화 (병력·사기 회복)`, "hot");
    }
    UI.updateBattleLabels(this);
    await wait(380);
  },

  check() {
    this.succeeded = this.succeeded || {};
    if (this.atk[0].out && this.alive("atk").length && this.succeed("atk")) {}
    if (this.def[0].out && !this.def[0].generic && this.alive("def").some((x) => !x.generic) && this.succeed("def")) {}
    if (this.alive("atk").length === 0 || this.atk[0].out) { this.say(this.atk[0].out ? "총대장 패주! 공격군이 무너졌다." : "공격군 전멸."); return false; }
    if (this.alive("def").length === 0) return true;
    if (this.def[0].out && !this.def[0].generic) { this.say("수비 총대장 패주! 수비군이 흩어졌다."); return true; }
    return null;
  },

  async finish(win, retreat) {
    if (this.finished) return;
    this.finished = true;
    if (retreat) {
      this.say(this.mySide === "atk" ? "전군 퇴각!" : "거점을 버리고 퇴각!");
      win = this.mySide === "def";
      const lead = this.side(this.mySide).find((b) => !b.generic && !b.out);
      if (lead) Sound.voice(lead.code, "Retreat");
    }
    const sum = (arr) => arr.filter((b) => !b.out).reduce((s, b) => s + b.troops, 0);
    const res = { win, atkLeft: sum(this.atk), defLeft: sum(this.def), captured: [], atkCaptured: [] };
    if (win) for (const b of this.def) { if (b.generic) continue; if (b.captured || (b.out && Math.random() < 0.35)) res.captured.push(b.id); }
    else for (const b of this.atk) { if (b.captured || (b.out && Math.random() < 0.25)) res.atkCaptured.push(b.id); }
    if (retreat && this.mySide === "def") res.defLeft = 0;
    const meWin = (this.mySide === "atk") === win;
    // MVP: 아군에서 가장 많이 남은 장수
    const mvp = this.side(this.mySide).filter((b) => !b.generic && !b.out).sort((a, b) => b.troops / b.max - a.troops / a.max)[0];
    if (this.stage) {
      for (const b of this.side(meWin ? this.mySide : this.mySide === "atk" ? "def" : "atk")) if (!b.out && b.actor) this.stage.play(b.actor, "win", true);
    }
    if (meWin) { Sound.stopBgm(); Sound.sfx("fanfare"); if (mvp) setTimeout(() => Sound.voice(mvp.code, "MVP"), 700); }
    else Sound.sfx("warn", 0.6);
    UI.banner(meWin ? "승리" : "패배", meWin ? `${this.w.to} 전투에서 승리했다` : `${this.w.to} 전투에서 패배했다`, 1800, meWin ? "win" : "lose");
    await wait(1900);
    applyBattle(this.w, res);
    const p = P();
    if (meWin) addMerit(p, 60 + this.foe(this.mySide).filter((b) => b.out).length * 30);
    UI.closeBattle();
    await UI.battleResult(this, meWin, mvp);
    this.onDone();
  },

  render() { UI.renderBattle(this); },
};

// ── 일기토 ───────────────────────────────
const Duel = {
  // duelHpK: 야전에서 들어온 장수는 전장 체력 비율만큼만 버틴다 (최소 25%). 진형 전투에서는 없음
  hpOf(b) { return (60 + b.st.war * 0.6) * (b.duelHpK != null ? Math.max(0.25, b.duelHpK) : 1); },
  base(b) { return b.st.war * 0.18 + Math.random() * 6 + (b.u && hasSkill(b.u, "일기") ? 3 : 0); },

  simulate(a, b) {
    let ha = this.hpOf(a), hb = this.hpOf(b);
    for (let i = 0; i < 12 && ha > 0 && hb > 0; i++) { hb -= this.base(a) * (0.7 + Math.random() * 0.8); ha -= this.base(b) * (0.7 + Math.random() * 0.8); }
    const w = ha / this.hpOf(a) >= hb / this.hpOf(b) ? a : b;
    const l = w === a ? b : a; l.hpZero = (l === a ? ha : hb) <= 0;
    return w;
  },

  start(me, foe, onEnd) {
    this.me = me; this.foe = foe; this.onEnd = onEnd; this.busy = false;
    this.s = { me: { hp: this.hpOf(me), max: this.hpOf(me), g: 0 }, foe: { hp: this.hpOf(foe), max: this.hpOf(foe), g: 0 } };
    this.turn = 1; this.lines = [`${me.name} vs ${foe.name} — 일기토 개시!`]; this.done = false; this.firstShown = false;
    this.readIntent();
    Sound.bgm("duel");
    UI.openDuel(this);
  },

  // 성향: 무력형은 강공, 지력형은 방어·반격, 체력이 낮으면 신중해진다
  aiPick() {
    const s = this.s.foe, me = this.s.me, f = this.foe.st;
    if (s.g >= 100) return "special";
    if (me.g >= 100 && Math.random() < 0.6) return "guard";
    const hpk = s.hp / s.max;
    let wA = 45, wH = 30 + (f.war - f.int) * 0.3, wG = 25 + (f.int - f.war) * 0.3 + (hpk < 0.35 ? 20 : 0);
    if (this.lastMine === "heavy") wG += 15; // 강공을 읽고 방어
    if (this.lastMine === "guard") wH -= 12;
    wH = Math.max(5, wH); wG = Math.max(5, wG);
    const r = Math.random() * (wA + wH + wG);
    return r < wA ? "attack" : r < wA + wH ? "heavy" : "guard";
  },
  // 지력 차에 따라 상대의 다음 수를 미리 읽는다
  readIntent() {
    this.next = this.aiPick();
    const p = clamp(35 + (this.me.st.int - this.foe.st.int) * 1.6 + (this.me.st.war - this.foe.st.war) * 0.5, 12, 88);
    if (this.turn === 1 && !this.firstShown) { this.firstShown = true; const f = this.foe.st; this.intent = f.war >= f.int + 10 ? "맹장 — 거칠게 몰아붙이는 성향 (강공 주의)" : f.int >= f.war + 10 ? "책사 — 신중하게 받아치는 성향 (방어·반격 주의)" : "균형형 — 상황을 보며 움직인다"; return; }
    const T = { attack: "검을 고쳐 쥔다 — 공격 기색", heavy: "크게 숨을 들이쉰다 — 강공 기색", guard: "자세를 낮춘다 — 방어 기색", special: "기력이 폭주한다 — 필살 기색!" };
    this.intent = Math.random() * 100 < p ? T[this.next] : "상대의 의도를 읽을 수 없다…";
  },

  async act(mine) {
    if (this.busy || this.done || !document.querySelector("#duel.on") || (mine === "special" && this.s.me.g < 100)) return;
    this.busy = true;
    const theirs = this.next || this.aiPick();
    this.lastMine = mine;
    const KO = { attack: "공격", heavy: "강공", guard: "방어", special: "필살" };
    const res = (atkMove, defMove, atk, def, sAtk) => {
      let d = 0, counter = 0;
      const b = this.base(atk);
      if (atkMove === "attack") d = defMove === "guard" ? b * 0.35 : b;
      if (atkMove === "heavy") { if (defMove === "guard") { counter = this.base(def); d = 0; } else d = b * 1.8; }
      if (atkMove === "special") { d = defMove === "guard" ? b * 1.6 : b * 3; sAtk.g = 0; }
      return { d, counter };
    };
    const A = res(mine, theirs, this.me, this.foe, this.s.me);
    const B = res(theirs, mine, this.foe, this.me, this.s.foe);
    const dmgFoe = Math.round(A.d + B.counter), dmgMe = Math.round(B.d + A.counter);
    await UI.duelExchange(this, mine, theirs, dmgMe, dmgFoe, !!A.counter, !!B.counter);
    this.s.foe.hp -= dmgFoe; this.s.me.hp -= dmgMe;
    for (const [k, mv, took] of [["me", mine, dmgMe], ["foe", theirs, dmgFoe]]) {
      const s = this.s[k];
      if (mv !== "special") s.g = Math.min(100, s.g + 10 + (mv === "guard" ? 25 : 0) + (took > 0 ? 12 : 0));
    }
    this.lines.unshift(`${this.turn}합: ${this.me.name} 【${KO[mine]}】 vs ${this.foe.name} 【${KO[theirs]}】 → 적 -${dmgFoe} / 아군 -${dmgMe}` + (A.counter ? " (강공 간파! 반격)" : "") + (B.counter ? " (강공을 간파당했다!)" : ""));
    this.turn++;
    this.busy = false;
    this.readIntent();
    const meDown = this.s.me.hp <= 0, foeDown = this.s.foe.hp <= 0;
    if (meDown || foeDown || this.turn > 12) {
      const meWin = foeDown && !meDown ? true : meDown && !foeDown ? false : this.s.me.hp / this.s.me.max >= this.s.foe.hp / this.s.foe.max;
      const w = meWin ? this.me : this.foe, l = meWin ? this.foe : this.me;
      l.hpZero = (meWin ? this.s.foe.hp : this.s.me.hp) <= 0;
      if (w.u && w.u.id === G.player) gainExp(w.u, "war", 30);
      this.lines.unshift(`${w.name}의 승리!`);
      this.done = true;
      UI.renderDuel(this, true);
      UI.duelEnd(this, w);
      setTimeout(() => { UI.closeDuel(); this.done = false; this.onEnd(w); }, 1900);
      return;
    }
    UI.renderDuel(this);
  },

  flee() { if (this.busy) return; this.lines.unshift(`${jo(this.me.name, "이가")} 물러섰다.`); UI.closeDuel(); this.onEnd(this.foe); },
};

// ── 설전 ─────────────────────────────────
const CARD = { logic: "논리", emotion: "감정", fact: "사실" };
const BEATS = { logic: "emotion", emotion: "fact", fact: "logic" };

const Debate = {
  start(me, foe, onEnd) {
    this.me = me; this.foe = foe; this.onEnd = onEnd;
    const hp = (u) => Math.round(50 + u.st.int / 2 + (hasSkill(u, "논객") ? 15 : 0));
    this.s = { me: { hp: hp(me), max: hp(me) }, foe: { hp: hp(foe), max: hp(foe) } };
    this.round = 1; this.hand = this.deal(me); this.lines = [`${jo(foe.name, "와과")}의 설전이 시작되었다.`]; this.last = null;
    this.prepFoe();
    Sound.bgm("debate");
    UI.renderDebate(this);
  },
  deal(u) {
    // 세 종류를 한 장씩 보장하고 한 장은 무작위
    const types = shuffle([...Object.keys(CARD), pick(Object.keys(CARD))]);
    return types.map((type) => ({ type, v: Math.min(5, 1 + Math.floor(Math.random() * 3 + u.st.int / 45)) }));
  },
  // 상대의 다음 카드를 정해 두고, 지력 차에 따라 종류(또는 숫자까지) 공개
  prepFoe() {
    const fh = this.deal(this.foe);
    // 상대는 내 직전 카드를 이기는 카드를 선호
    const prefer = this.last ? Object.keys(BEATS).find((k) => BEATS[k] === this.last.mine.type) : null;
    fh.sort((a, b) => (b.type === prefer) - (a.type === prefer) || b.v - a.v);
    this.foeNext = fh[Math.random() < 0.65 ? 0 : Math.floor(Math.random() * fh.length)];
    const p = clamp(45 + (this.me.st.int - this.foe.st.int) * 1.5 + (hasSkill(this.me, "논객") ? 15 : 0), 35, 92);
    this.reveal = Math.random() * 100 < p ? (Math.random() * 100 < p - 30 ? "full" : "type") : "none";
  },
  play(i) {
    if (this.done) return;
    const mine = this.hand[i];
    const theirs = this.foeNext;
    const pw = (u, c, side) => Math.round(Math.min((c.v + u.st.int / 25) * 3.5, this.s[side].max * 0.3));
    let txt, who = 0;
    if (BEATS[mine.type] === theirs.type) { const d = pw(this.me, mine, "foe"); this.s.foe.hp -= d; txt = `${CARD[mine.type]}(${mine.v})이 ${CARD[theirs.type]}(${theirs.v})을 꺾었다! 상대 기세 -${d}`; who = 1; }
    else if (BEATS[theirs.type] === mine.type) { const d = pw(this.foe, theirs, "me"); this.s.me.hp -= d; txt = `${CARD[theirs.type]}(${theirs.v})에 ${CARD[mine.type]}(${mine.v})이 밀렸다... 아군 기세 -${d}`; who = -1; }
    else {
      const diff = mine.v - theirs.v;
      if (diff > 0) { this.s.foe.hp -= diff * 6; txt = `같은 ${CARD[mine.type]} 대결, 우세! 상대 기세 -${diff * 6}`; who = 1; }
      else if (diff < 0) { this.s.me.hp -= -diff * 6; txt = `같은 ${CARD[mine.type]} 대결, 열세... 아군 기세 -${-diff * 6}`; who = -1; }
      else txt = "팽팽한 공방. 변화 없음.";
    }
    Sound.sfx(who > 0 ? "hitbig" : who < 0 ? "hit" : "click", 0.6);
    if (who > 0 && BEATS[mine.type] === theirs.type) Sound.voice(this.me.id, "BattleFocus", ["SpSkill"]);
    this.last = { mine, theirs, who };
    this.lines.unshift(`${this.round}라운드: ${txt}`);
    this.round++;
    if (this.s.me.hp <= 0 || this.s.foe.hp <= 0 || this.round > 6) {
      const win = this.s.foe.hp <= 0 ? true : this.s.me.hp <= 0 ? false : this.s.me.hp / this.s.me.max > this.s.foe.hp / this.s.foe.max;
      if (this.me.id === G.player) gainExp(this.me, "int", win ? 30 : 15);
      this.lines.unshift(win ? "설전 승리!" : "설전 패배...");
      this.done = true;
      Sound.sfx(win ? "clear" : "warn", 0.7);
      Sound.voice(win ? this.me.id : this.foe.id, win ? "MVP" : "Leader", ["Join"]);
      UI.renderDebate(this, true);
      setTimeout(() => { this.done = false; UI.closeDebate(); Sound.bgm("map"); this.onEnd(win); }, 1600);
      return;
    }
    this.hand = this.deal(this.me);
    this.prepFoe();
    UI.renderDebate(this);
  },
};
