// 라스트오리진 삼국지 — 게임 상태와 규칙
"use strict";

const STATS = ["ldr", "war", "int", "pol", "cha"];
const STAT_KO = { ldr: "통솔", war: "무력", int: "지력", pol: "정치", cha: "매력" };
const AP_MAX = 100;
const COST = { dev: 25, train: 20, search: 20, talk: 15, recruit: 25, move: 30, serve: 20, rest: 10, war: 50, propose: 30, rise: 40 };
const SAVE_KEY = "lao3k_save_v2";
const CLS_KO = ["경장", "중장", "기동"];
const ROLE_KO = ["보호기", "공격기", "지원기"];
const GRADE_KO = { 0: "-", 2: "B", 3: "A", 4: "S", 5: "SS" };
const DIFF = [
  { name: "쉬움", ai: 0.7, iron: 0.75, gold: 600, merit: 1.25 },
  { name: "보통", ai: 1.0, iron: 1.0, gold: 300, merit: 1.0 },
  { name: "어려움", ai: 1.35, iron: 1.3, gold: 150, merit: 0.85 },
];
// 원작 병종 상성: 경장 ▶ 기동 ▶ 중장 ▶ 경장
function clsEdge(a, b) {
  if (a == null || b == null) return 1;
  if ((a === 0 && b === 2) || (a === 2 && b === 1) || (a === 1 && b === 0)) return 1.2;
  if ((b === 0 && a === 2) || (b === 2 && a === 1) || (b === 1 && a === 0)) return 0.85;
  return 1;
}
// 부대 결속: 같은 원작 부대원이 함께 출진하면 강해진다
function squadBonus(units) {
  const cnt = {};
  for (const u of units) if (u && u.squad) cnt[u.squad] = (cnt[u.squad] || 0) + 1;
  const out = [];
  for (const [k, n] of Object.entries(cnt)) if (n >= 2) { const q = LAO_SQUADS.find((x) => x.key === k); out.push({ key: k, name: q ? q.name : k, icon: q ? q.icon : null, n, mult: 1 + 0.07 * (n - 1) }); }
  return out;
}
const squadName = (u) => { const q = u && u.squad && LAO_SQUADS.find((x) => x.key === u.squad); return q ? q.name : null; };
const squadIcon = (u) => { const q = u && u.squad && LAO_SQUADS.find((x) => x.key === u.squad); return q ? q.icon : null; };

let G = null; // 현재 게임 상태

// ── 유틸 ─────────────────────────────────
// 한국어 조사: jo("마리", "이가") → "마리가", jo("레오나 연합", "으로") → "레오나 연합으로"
function jo(word, kind) {
  const w = String(word); const ch = w.charCodeAt(w.length - 1);
  const hangul = ch >= 0xac00 && ch <= 0xd7a3;
  const jong = hangul ? (ch - 0xac00) % 28 : (/[0-9]$/.test(w) ? ([1, 3, 6, 7, 8, 0].includes(+w.slice(-1)) ? 1 : 0) : (/[lmnr]$/i.test(w) ? 1 : 0));
  const P = { 은는: ["은", "는"], 이가: ["이", "가"], 을를: ["을", "를"], 와과: ["과", "와"], 으로: ["으로", "로"], 이여: ["이여", "여"] }[kind];
  if (kind === "으로" && jong === 8) return w + "로"; // ㄹ 받침
  return w + (jong ? P[0] : P[1]);
}
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = (p) => Math.random() * 100 < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

const ARCH = {
  W: [[60, 80], [78, 92], [25, 55], [15, 45], [40, 70]],
  L: [[75, 90], [65, 82], [55, 75], [35, 60], [55, 75]],
  S: [[45, 70], [25, 55], [78, 92], [55, 80], [45, 70]],
  P: [[25, 55], [15, 45], [60, 80], [75, 92], [55, 80]],
  C: [[50, 70], [35, 60], [55, 75], [60, 80], [78, 94]],
  B: [[55, 74], [55, 74], [55, 74], [55, 74], [55, 74]],
  M: [[55, 75], [75, 90], [10, 35], [5, 20], [15, 40]],
  R: [[55, 75], [70, 86], [55, 75], [30, 55], [45, 65]],
};

// 원본 능력치(공격·체력·방어·치명·회피)를 무력/통솔 백분위로 환산하고, 지력·정치·매력은 유형+역할로 보정
let _pct = null;
function pctTables() {
  if (_pct) return _pct;
  const vals = Object.values(LAO_PC);
  const w = vals.map((o) => o.atk * (1 + o.cri * 2) * (1 + o.eva * 0.5)).sort((a, b) => a - b);
  const l = vals.map((o) => o.hp * (1 + o.def / 40)).sort((a, b) => a - b);
  return (_pct = { w, l });
}
const pctOf = (arr, v) => { let i = 0; while (i < arr.length && arr[i] < v) i++; return i / Math.max(1, arr.length - 1); };

function genStats(code, spec) {
  if (Array.isArray(spec)) return spec.slice();
  const r = hashSeed(code);
  const base = ARCH[spec].map(([a, b]) => Math.round(a + r() * (b - a)));
  const o = typeof LAO_PC !== "undefined" && LAO_PC[code];
  if (!o) return base;
  const t = pctTables();
  const gb = { 2: -8, 3: -2, 4: 4, 5: 9 }[o.g] || 0;
  const war = 38 + pctOf(t.w, o.atk * (1 + o.cri * 2) * (1 + o.eva * 0.5)) * 55;
  const ldr = 36 + pctOf(t.l, o.hp * (1 + o.def / 40)) * 55;
  const role = [[6, 0, 0, 0, 0], [0, 5, 0, 0, 0], [0, -4, 12, 5, 4]][o.r] || [0, 0, 0, 0, 0];
  const st = [ldr * 0.6 + base[0] * 0.4, war * 0.6 + base[1] * 0.4, base[2], base[3], base[4]];
  return st.map((v, i) => Math.round(clamp(v + role[i] + gb * 0.7, 12, 99)));
}

function genSkills(st, code) {
  const [ldr, war, int, pol, cha] = st;
  const r = hashSeed(code + "#sk");
  const s = [];
  if (war >= 86) s.push("일기");
  if (ldr >= 82) s.push(r() < 0.5 ? "돌격" : "훈련");
  if (int >= 84) s.push(r() < 0.5 ? "화계" : "논객");
  if (pol >= 78) s.push(["농정", "상재", "기술", "치안"][Math.floor(r() * 4)]);
  if (cha >= 82) s.push("인덕");
  if (s.length === 0) s.push(["탐색", "징병", "치안", "훈련"][Math.floor(r() * 4)]);
  return [...new Set(s)].slice(0, 2);
}

// ── 조회 ─────────────────────────────────
const U = (id) => G.units[id];
const C = (name) => G.cities[name];
const F = (key) => (key ? G.factions[key] : null);
const P = () => G.units[G.player];
const unitsIn = (city) => Object.values(G.units).filter((u) => u.alive && !u.missing && u.city === city);
const officersOf = (fac) => Object.values(G.units).filter((u) => u.alive && !u.missing && u.fac === fac);
const citiesOf = (fac) => Object.values(G.cities).filter((c) => c.owner === fac);
const neighbors = (city) => G.adj[city] || [];
const rankOf = (u) => { let r = 0; RANKS.forEach((k, i) => { if (u.merit >= k.merit) r = i; }); return r; };
const rankName = (u) => (u.fac ? RANKS[rankOf(u)].name : "재야");
const maxTroops = (u) => (u.iron ? 9000 : RANKS[rankOf(u)].troops) + (isLord(u) ? 3000 : 0) + (typeof fameTroops === "function" ? fameTroops(u) : 0);
const isLord = (u) => !!u.fac && F(u.fac) && F(u.fac).lord === u.id;
const isGov = (u) => !!u.fac && C(u.city) && C(u.city).owner === u.fac && C(u.city).gov === u.id;
const portrait = (u) => (u ? (u.iron ? `assets/enemy/${u.id}.webp` : `assets/portrait/${u.id}.webp`) : "");
const dateStr = () => `${STORY.era} ${G.year}년 ${G.month}월`;
const cityMax = (c) => ({ agri: 400 + c.size * 300, comm: 400 + c.size * 300, tech: 1000, order: 100, def: c.size * 400 });
const hasSkill = (u, s) => u.skills.includes(s);
const powerOf = (u) => (u ? u.st.ldr * 0.65 + u.st.war * 0.35 : 40);
const capitalOf = (fac) => { const f = F(fac); const l = f && U(f.lord); if (l && l.alive && C(l.city) && C(l.city).owner === fac) return l.city; const cs = citiesOf(fac); return cs.length ? cs.sort((a, b) => b.size - a.size)[0].name : null; };

function log(text, kind = "") {
  G.log.unshift({ d: `${G.year}.${G.month}`, text, kind });
  if (G.report && kind !== "story") G.report.push({ text, kind });
  if (G.log.length > 120) G.log.length = 120;
}
// UI가 순서대로 처리하는 알림/이벤트 큐
// 연표: 엔딩에서 보여 줄 주요 사건
function chron(text) { (G.chron ||= []).push({ d: `${G.year}.${G.month}`, text }); if (G.chron.length > 60) G.chron.shift(); }
function notify(title, text, who, voice, sfx) { G.queue.push({ type: "msg", title, text, who, voice, sfx }); }

// ── 새 게임 ──────────────────────────────
function newGame(playerId, opts = {}) {
  G = { year: 1, month: 1, units: {}, cities: {}, factions: {}, adj: {}, log: [], queue: [], player: playerId,
        ap: AP_MAX, mission: null, missionOffer: null, stats: { searched: 0, wins: 0, losses: 0, recruits: 0 }, over: false, flags: {},
        diff: opts.diff == null ? 1 : opts.diff, truce: {}, report: null, lastWars: [], inv: [] };

  for (const [code, name, spec] of UNITS_RAW) {
    const st = genStats(code, spec);
    G.units[code] = mkUnit(code, name, st, false);
  }
  for (const [code, name, st] of IRON_RAW) G.units[code] = mkUnit(code, name, st, true);

  for (const [name, x, y, size] of CITIES_RAW) {
    const m = { agri: 400 + size * 300, comm: 400 + size * 300 };
    G.cities[name] = { name, x, y, size, owner: null, gov: null,
      gold: 300 + size * 200, food: 3000 + size * 2000, troops: size * 1000,
      agri: Math.round(m.agri * (0.3 + Math.random() * 0.2)), comm: Math.round(m.comm * (0.3 + Math.random() * 0.2)),
      tech: rnd(100, 300), order: rnd(45, 70), def: size * 150 };
  }
  for (const [a, b] of ROADS) { (G.adj[a] ||= []).push(b); (G.adj[b] ||= []).push(a); }

  const placed = new Set();
  const SQ = {}; for (const q of LAO_SQUADS) SQ[q.key] = q;
  for (const q of LAO_SQUADS) for (const m of q.members) if (G.units[m]) G.units[m].squad = q.key;
  for (const fr of FACTIONS_RAW) {
    const sq0 = fr.squads && SQ[fr.squads[0]];
    G.factions[fr.key] = { key: fr.key, name: fr.name, lord: fr.lord, flag: fr.flag, color: fr.color, iron: !!fr.iron, icon: fr.icon || null,
      desc: fr.desc || (sq0 ? sq0.desc : ""), motto: fr.motto || "", alive: true };
    fr.cities.forEach((cn, i) => {
      const c = C(cn); c.owner = fr.key;
      c.troops = (fr.iron ? 5000 : 6000) + c.size * 2500 + (i === 0 ? 4000 : 0);
      c.gold += 600; c.def = c.size * 250;
    });
    const lord = U(fr.lord); lord.fac = fr.key; lord.city = fr.cities[0]; lord.merit = 6000; lord.loyal = 100; placed.add(lord.id);
    const mem = fr.members === "ALL_IRON" ? IRON_RAW.map((x) => x[0]).filter((c) => c !== fr.lord)
      : [...new Set([...(fr.squads || []).flatMap((k) => (SQ[k] ? SQ[k].members : [])), ...(fr.extra || [])])].filter((c) => G.units[c] && c !== fr.lord);
    // 부대원의 일부는 재야로 흩어져 있다 (탐방·등용의 재미)
    mem.forEach((code, i) => {
      const u = U(code);
      if (!fr.iron && opts.randomJoin !== false && i > 3 && chance(22)) return;
      u.fac = fr.key; u.city = fr.cities[i % fr.cities.length];
      u.merit = rnd(400, 2600); u.loyal = rnd(75, 95); placed.add(code);
    });
  }

  // 나머지 장수: 무작위 배치 (일부는 세력, 나머지는 재야)
  const bioFactions = FACTIONS_RAW.filter((f) => !f.iron).map((f) => f.key);
  const cityNames = Object.keys(G.cities);
  for (const u of shuffle(Object.values(G.units))) {
    if (placed.has(u.id)) continue;
    if (opts.randomJoin !== false && chance(25)) {
      const fk = pick(bioFactions); u.fac = fk; u.city = pick(G.factions[fk] && citiesOf(fk).map((c) => c.name));
      u.merit = rnd(100, 1500); u.loyal = rnd(55, 90);
    } else {
      u.fac = null; u.city = pick(cityNames); u.merit = rnd(0, 400);
    }
  }

  for (const c of Object.values(G.cities)) assignGov(c);
  if (typeof seedEquipment === "function") seedEquipment();

  const p = P();
  p.bond = 0;
  if (p.fac && !isLord(p)) p.merit = rnd(120, 280); // 출세 루프는 종사부터
  if (opts.ronin && !isLord(p)) {
    const old = C(p.city); if (old && old.gov === p.id) old.gov = null;
    p.fac = null; p.city = pick(Object.values(G.cities).filter((c) => !c.owner || !F(c.owner).iron).map((c) => c.name));
    for (const c of Object.values(G.cities)) assignGov(c);
  }
  if (!p.fac) p.merit = Math.max(p.merit, 100);
  p.gold = DIFF[G.diff].gold;
  log(`${p.name}의 이야기가 시작되었다.`, "sys");
  STORY.prologue.forEach((t) => log(t, "story"));
  if (p.fac) offerMissions();
  checkFacilityUps(true);
  if (typeof initOfficer === "function") initOfficer();
  return G;
}

function mkUnit(id, name, st, iron) {
  const stats = {}; STATS.forEach((k, i) => (stats[k] = st[i]));
  const o = !iron && typeof LAO_PC !== "undefined" ? LAO_PC[id] : null;
  return { id, name, full: o ? o.n : name, grade: o ? o.g : 0, cls: o ? o.c : (iron ? 1 : 0), role: o ? o.r : 1, squad: null, iron, st: stats, ex: { ldr: 0, war: 0, int: 0, pol: 0, cha: 0 },
    skills: iron ? (st[1] >= 88 ? ["일기", "돌격"] : ["돌격"]) : genSkills(st, id),
    fac: null, city: null, merit: 0, loyal: 80, gold: 0, hp: 100, bond: 0, sworn: false, alive: true, missing: 0 };
}

function assignGov(c) {
  if (!c.owner) { c.gov = null; return; }
  const here = unitsIn(c.name).filter((u) => u.fac === c.owner);
  if (c.gov && here.some((u) => u.id === c.gov)) return;
  const lord = here.find((u) => isLord(u));
  if (lord) { c.gov = lord.id; return; }
  const cand = here.filter((u) => !(u.id === G.player && G.flags.noGov));
  cand.sort((a, b) => (b.merit + b.st.ldr * 20 + b.st.pol * 10) - (a.merit + a.st.ldr * 20 + a.st.pol * 10));
  c.gov = cand.length ? cand[0].id : null;
}

// ── 거점 시설 단계 (UI 시설 화면과 동일 규칙) ──
const FAC_RULE = {
  agri: { lv: 3, val: (c) => c.agri / cityMax(c).agri }, comm: { lv: 5, val: (c) => c.comm / cityMax(c).comm },
  tech: { lv: 3, val: (c) => c.tech / 1000 }, train: { lv: 5, val: (c) => c.troops / (12000 + c.size * 8000) },
  def: { lv: 3, val: (c) => c.def / cityMax(c).def }, order: { lv: 3, val: (c) => c.order / 100 },
};
const facLv = (c, k) => { const r = FAC_RULE[k]; return Math.max(1, Math.min(r.lv, Math.ceil(clamp(r.val(c), 0, 1) * r.lv))); };
// 시설 단계 보너스
const FAC_BONUS = {
  agri: "Lv3: 식량 수입 +15%", comm: "Lv4+: 자금 수입 +10% · Lv5: +20%", tech: "Lv3: 내정 효과 +10%",
  train: "Lv4+: 징병 +15%", def: "Lv3: 방어전 피해 -8%", order: "Lv3: 치안 하락 방지",
};

// ── 성장 ─────────────────────────────────
function gainExp(u, stat, amount) {
  u.ex[stat] += amount;
  let up = 0;
  const cap = 100 + (typeof eqBonus === "function" ? eqBonus(u, stat) : 0);
  while (u.ex[stat] >= 100) { u.ex[stat] -= 100; if (u.st[stat] < cap) { u.st[stat]++; up++; } }
  if (up && u.id === G.player) log(`${jo(STAT_KO[stat], "이가")} ${up} 올랐다! (${u.st[stat]})`, "good");
  return up;
}

function addMerit(u, v) {
  const before = rankOf(u);
  if (u.id === G.player && v > 0) v *= DIFF[G.diff].merit;
  u.merit = Math.max(0, Math.round(u.merit + v));
  const after = rankOf(u);
  if (u.id === G.player && u.fac && after > before) chron(`${RANKS[after].name} 승진`);
  if (u.id === G.player && u.fac && after > before)
    notify("승진", `공적을 인정받아 「${RANKS[after].name}」${jo(RANKS[after].name, "으로").slice(RANKS[after].name.length)} 승진했다!\n최대 지휘 병력: ${maxTroops(u).toLocaleString()}`, u.id, "PresentGet", after >= 3 ? "rankup2" : "rankup");
}

// ── 플레이어 행동 ─────────────────────────
function spend(cost) {
  if (G.ap < cost) { notify("행동력 부족", `이번 달에 남은 행동력이 부족하다. (필요 ${cost} / 남음 ${G.ap})`); return false; }
  G.ap -= cost; return true;
}

const DEV = {
  agri: { ko: "농업 개발", stat: "pol", skill: "농정" },
  comm: { ko: "상업 개발", stat: "pol", skill: "상재" },
  tech: { ko: "기술 개발", stat: "int", skill: "기술" },
  order: { ko: "치안 순찰", stat: "war", skill: "치안" },
  def: { ko: "방벽 보수", stat: "ldr", skill: "훈련" },
  draft: { ko: "징병", stat: "cha", skill: "징병" },
};

function devGain(u, type) {
  const s = u.st[DEV[type].stat];
  let g = s * 0.5 + rnd(0, Math.round(s * 0.35)) + 5;
  if (hasSkill(u, DEV[type].skill)) g *= 1.5;
  const c = C(u.city); if (c && facLv(c, "tech") >= 3) g *= 1.1;
  if (typeof fameDevMult === "function") g *= fameDevMult(u);
  return Math.round(g);
}

// 내정 1회 적용 (AI 공용). 반환: 증가량 또는 0
function doDev(u, type) {
  const c = C(u.city); const mx = cityMax(c);
  const cost = type === "draft" ? 0 : 50;
  if (c.gold < cost) return 0;
  if (type === "draft") {
    const n = Math.round((u.st.cha * 8 + u.st.ldr * 6 + rnd(0, 300)) * (hasSkill(u, "징병") ? 1.5 : 1) * (facLv(c, "train") >= 4 ? 1.15 : 1));
    const gold = Math.round(n / 8);
    if (c.gold < gold) return 0;
    c.gold -= gold; c.troops += n; if (facLv(c, "order") < 3) c.order = clamp(c.order - 2, 0, 100);
    return n;
  }
  c.gold -= cost;
  let g = devGain(u, type);
  if (type === "order") g = Math.round(g / 8);
  if (type === "def") g = Math.round(g * 0.8);
  const before = c[type];
  c[type] = clamp(c[type] + g, 0, mx[type]);
  return c[type] - before;
}

// 플레이어 세력 거점의 시설 단계가 오르면 알린다
function checkFacilityUps(silent) {
  const p = P(); if (!p.fac) return;
  const NAME = { agri: "식량 생산실", comm: "카페테리아", tech: "부품 공방", train: "훈련실", def: "무기고", order: "정비 공장" };
  let shown = 0, facVN = null; const more = []; // 최고 단계 VN은 한 달에 1편, 나머지는 그 VN의 요약 줄로
  for (const c of citiesOf(p.fac)) {
    const snap = (c.fac ||= {});
    for (const k in FAC_RULE) {
      const lv = facLv(c, k);
      if (snap[k] && lv > snap[k] && !silent && lv === FAC_RULE[k].lv && !G.flags["facmax_" + c.name + k]) {
        G.flags["facmax_" + c.name + k] = true;
        const gov = U(c.gov) || p;
        const LINE = { agri: "식량 생산실이 완전 가동에 들어갔어요. 이제 굶을 걱정은 없겠네요.", comm: "카페가 문을 열었어요! 다들 한숨 돌리러 오는 곳이 생겼네요.", tech: "부품 공방 조립 라인이 돌아갑니다. 장비 정비가 훨씬 빨라질 거예요.", train: "훈련실이 꽉 찼습니다. 신병들의 눈빛이 달라졌어요.", def: "무기고가 가득 찼습니다. 이 성채는 쉽게 함락되지 않을 겁니다.", order: "정비 공장이 정상 가동 중이에요. 거리도 한결 조용해졌어요." };
        if (shown++) more.push(`${c.name} ${NAME[k]}`);
        else G.queue.push(facVN = { type: "dialog", bgUrl: `assets/facility/${k}_${lv}.webp`, lines: [{ who: gov.id, text: `${c.name} — ${LINE[k]}`, voice: "ActionApprove" }, { who: null, text: `시설 최고 단계 달성: ${NAME[k]} Lv.${lv} (${FAC_BONUS[k]})` }] });
      }
      if (snap[k] && lv > snap[k] && !silent) {
        log(`시설 단계 상승 — ${c.name} ${NAME[k]} Lv.${lv}`, "good");
        if (c.name === p.city) { G.toast = { text: `${NAME[k]} Lv.${lv} 달성!`, kind: "gold" }; if (typeof Sound !== "undefined") Sound.sfx("rankup", 0.7); }
      }
      snap[k] = lv;
    }
  }
  if (facVN && more.length) facVN.lines.push({ who: null, text: `같은 달 최고 단계 달성: ${more.slice(0, 6).join(", ")}${more.length > 6 ? ` 외 ${more.length - 6}곳` : ""}` });
}

function actDev(type) {
  const p = P(); const c = C(p.city);
  if (!p.fac || c.owner !== p.fac) return notify("내정 불가", "소속 세력의 거점에서만 내정을 할 수 있다.");
  if (type !== "draft" && c.gold < 50) return notify("자금 부족", "거점 자금이 부족하다. (50 필요)");
  if (!spend(COST.dev)) return;
  const g = doDev(p, type);
  if (!g) { log(`${DEV[type].ko}에 실패했다. 자금이 부족한 것 같다.`, "bad"); return; }
  const unit = type === "draft" ? "명" : "";
  log(`${c.name}에서 ${DEV[type].ko}: +${g.toLocaleString()}${unit}`, "good");
  if (typeof Sound !== "undefined") Sound.sfx(type === "draft" ? "reload" : "build", 0.7);
  G.toast = { text: `${DEV[type].ko} +${g.toLocaleString()}${unit}`, kind: "good", stat: type };
  addMerit(p, type === "draft" ? 25 + g / 100 : g * 0.6);
  gainExp(p, DEV[type].stat, rnd(8, 14));
  missionProgress(type, type === "draft" ? g : g);
  if (typeof fameAdd === "function") fameAdd("문관");
  checkFacilityUps();
  checkGoals();
}

function actTrain(stat) {
  if (!spend(COST.train)) return;
  const p = P();
  const base = typeof baseStat === "function" ? baseStat(p, stat) : p.st[stat];
  const amt = Math.max(8, Math.round(38 + rnd(0, 18) - Math.max(0, base - 70) * 0.8));
  log(`${STAT_KO[stat]} 단련. (경험 +${amt})`);
  gainExp(p, stat, amt);
  p.hp = clamp(p.hp - 8, 0, 100);
  missionProgress("train", 1);
}

function actSearch() {
  if (!spend(COST.search)) return;
  const p = P();
  const free = unitsIn(p.city).filter((u) => !u.fac && u.id !== p.id && !u.iron);
  const bonus = hasSkill(p, "탐색") ? 15 : 0;
  missionProgress("search", 1);
  const roll = rnd(1, 100);
  if (free.length && roll <= 40 + bonus) {
    const t = pick(free);
    const was = t.met;
    t.met = true; t.bond = clamp(t.bond + rnd(6, 12), 0, 100);
    addMerit(p, 15);
    notify("탐방", was ? `${jo(t.name, "와과")} 다시 만나 이야기를 나눴다.\n(친밀 ${t.bond})` : `재야의 인재 ${jo(t.full, "을를")} 발견했다!\n${STAT_LINE(t)}`, t.id, was ? "SearchEnd" : "Intro", "found");
    log(`탐방: ${jo(t.name, "을를")} 만났다.`, "good");
  } else if (roll <= 52 + bonus && typeof randItem === "function") {
    addMerit(p, 10); gainItem(randItem([62, 30, 7, 1]), "탐방");
  } else if (roll <= 62 + bonus) {
    const g = rnd(60, 240); p.gold += g;
    log(`탐방: 폐허에서 쓸 만한 물자를 찾아 ${g} 자금을 얻었다.`, "good"); addMerit(p, 8);
    if (typeof Sound !== "undefined") Sound.sfx("coin"); G.toast = { text: `자금 +${g}`, kind: "gold" };
  } else if (roll <= 77 + bonus) {
    const s = pick(STATS); log(`탐방: 구 시대의 전술 데이터를 입수했다. (${STAT_KO[s]} 경험 +40)`, "good"); gainExp(p, s, 40);
  } else if (roll <= 88) {
    const f = pick(Object.values(G.factions).filter((f) => f.alive));
    log(`탐방: 소문 — "${jo(f.name, "이가")} ${citiesOf(f.key).length}곳의 거점을 쥐고 있다더군."`);
  } else {
    log(free.length ? "탐방: 별다른 성과가 없었다." : "탐방: 이 거점에는 재야 인재가 없는 듯하다.");
  }
}
const STAT_LINE = (u) => STATS.map((k) => `${STAT_KO[k]} ${u.st[k]}`).join(" · ");

function actTalk(id) {
  const t = U(id); const p = P();
  if (!t || t.city !== p.city || t.iron) return;
  if (!spend(COST.talk)) return;
  const g = rnd(4, 9) + Math.round(p.st.cha / 12);
  t.bond = clamp(t.bond + g, 0, 100); t.met = true;
  log(`${jo(t.name, "와과")} 교류했다. 친밀 +${g} (${t.bond})`, "good");
  G.toast = { text: `${t.name} 친밀 +${g} (${t.bond})`, kind: "bond" };
  if (chance(25)) {
    const best = STATS.reduce((a, b) => (t.st[a] >= t.st[b] ? a : b));
    log(`${t.name}에게 ${STAT_KO[best]}에 관한 조언을 들었다.`); gainExp(p, best, 25);
  }
  if (typeof talkScene === "function") talkScene(t); // 대화 장면 — 선택지에 따라 소소한 일이 벌어진다
  if (t.bond >= 100 && !t.sworn) {
    t.sworn = true;
    chron(`${jo(t.name, "와과")} 의자매의 연`);
    notify("결의", `${jo(t.name, "와과")} 깊은 신뢰를 쌓아 의자매의 연을 맺었다!\n앞으로 거병·독립 시 함께한다.`, t.id, "Oath", "rankup2");
    log(`${jo(t.name, "와과")} 의자매를 맺었다.`, "good");
  }
}

function recruitChance(p, t) {
  let v = 20 + t.bond * 0.5 + (p.st.cha - t.st.cha) * 0.4 + p.merit / 150;
  if (hasSkill(p, "인덕")) v += 12;
  if (typeof relRecruitBonus === "function") v += relRecruitBonus(p, t);
  if (t.sworn) v = 100;
  return Math.round(clamp(v, 5, 100));
}

// 등용: mode = "talk" | "debateWon" | "debateLost"
function actRecruit(id, mode) {
  const p = P(); const t = U(id);
  if (!p.fac || t.fac || t.city !== p.city || t.iron) return;
  if (mode === "talk" && !spend(COST.recruit)) return;
  const ok = mode === "debateWon" || (mode === "talk" && chance(recruitChance(p, t)));
  if (ok) {
    t.fac = p.fac; t.loyal = 70 + Math.round(t.bond / 5); t.merit = Math.max(t.merit, 200);
    addMerit(p, 90);
    const line = (typeof LAO_PC !== "undefined" && LAO_PC[t.id] && LAO_PC[t.id].join) || "좋아요. 당신과 함께라면 믿어 볼게요.";
    notify("등용 성공", `${t.name}: "${line}"\n\n${jo(t.full, "이가")} ${F(p.fac).name}에 합류했다.`, t.id, "Join", "gen");
    log(`${jo(t.name, "을를")} 등용했다.`, "good");
    missionProgress("recruit", 1); G.stats.recruits++;
    if (mode === "debateWon" && typeof fameAdd === "function") fameAdd("군사");
    assignGov(C(p.city));
  } else {
    t.bond = clamp(t.bond + 3, 0, 100);
    notify("등용 실패", `${t.name}: "미안하지만... 아직은 마음이 움직이지 않네요."`, t.id);
  }
}

function serveChance(p, f) {
  const lord = U(f.lord); const c = C(p.city); const gov = U(c.gov);
  let v = 25 + p.merit / 25 + p.st.cha / 4 + Math.max(lord.bond, gov ? gov.bond : 0) / 2;
  if (hasSkill(p, "인덕")) v += 10;
  return Math.round(clamp(v, 5, 95));
}

function actServe(mode) {
  const p = P(); const c = C(p.city); const f = F(c.owner);
  if (p.fac || !f || f.iron) return;
  if (mode === "talk" && !spend(COST.serve)) return;
  const ok = mode === "debateWon" || (mode === "talk" && chance(serveChance(p, f)));
  const lord = U(f.lord);
  if (ok) {
    p.fac = f.key; p.loyal = 80;
    notify("사관", `${lord.name}: "환영한다. 그대의 힘, ${jo(f.name, "을를")} 위해 써 다오."\n${f.name}에 사관했다!`, lord.id, "ActionApprove", "gen");
    log(`${f.name}에 사관했다.`, "good");
    offerMissions();
  } else {
    notify("사관 거절", `"지금은 인재를 더 받을 여유가 없다."\n— 명성(공적)을 쌓거나 군주·태수와 친해진 뒤 다시 찾아오자.`, (U(c.gov) || lord).id);
  }
}

function canRise() {
  const p = P(); const c = C(p.city);
  return !p.fac && !c.owner && p.merit >= (typeof riseNeed === "function" ? riseNeed() : 400);
}

function actRise() {
  const p = P(); const c = C(p.city);
  if (!canRise()) return notify("거병 불가", `주인 없는 거점에서, 명성(공적) ${typeof riseNeed === "function" ? riseNeed() : 400} 이상일 때 거병할 수 있다.`);
  if (!spend(COST.rise)) return;
  const key = "p_" + p.id;
  G.factions[key] = { key, name: `${p.name} 세력`, lord: p.id, flag: p.name[0], color: "#f1ece0", iron: false, desc: "폐허에서 일어선 신흥 세력.", alive: true, player: true };
  p.fac = key; p.loyal = 100; addMerit(p, 300);
  c.owner = key; c.gov = p.id; c.troops += 1500 + Math.round(p.merit);
  const joined = [];
  for (const u of Object.values(G.units)) {
    if (!u.alive || u.iron || u.id === p.id || u.fac) continue;
    if (u.sworn || u.follow === p.id || (u.city === c.name && u.bond >= 60)) { u.fac = key; u.city = c.name; u.loyal = 90; u.follow = null; joined.push(u.name); }
  }
  notify("거병", `${jo(p.name, "은는")} ${c.name}에서 깃발을 올렸다!\n"사령관님이 돌아올 때까지 — 이곳은 내가 지킨다."` + (joined.length ? `\n\n함께한 동료: ${joined.join(", ")}` : ""), p.id, "Leader", "rankup2");
  log(`${c.name}에서 거병! ${F(key).name} 성립.`, "good");
  G.mission = null; G.missionOffer = null;
}

function actIndependence() {
  const p = P(); const c = C(p.city);
  if (!isGov(p) || isLord(p) || p.merit < 1500) return notify("독립 불가", "태수로서 공적 1500 이상일 때 독립할 수 있다.");
  if (!spend(COST.rise)) return;
  const old = F(p.fac);
  const key = "p_" + p.id;
  G.factions[key] = { key, name: `${p.name} 세력`, lord: p.id, flag: p.name[0], color: "#f1ece0", iron: false, desc: `${old.name}에서 독립한 세력.`, alive: true, player: true };
  const joined = [];
  for (const u of unitsIn(c.name)) {
    if (u.id === p.id || u.fac !== old.key || isLord(u)) continue;
    if (u.sworn || u.bond >= 50) { u.fac = key; joined.push(u.name); }
    else { const back = capitalOf(old.key); if (back) u.city = back; }
  }
  for (const u of Object.values(G.units)) if ((u.sworn || u.follow === p.id) && u.alive && !u.fac && !u.iron) { u.fac = key; u.city = c.name; u.follow = null; joined.push(u.name); }
  p.fac = key; c.owner = key; c.gov = p.id; p.dudok = null;
  notify("독립", `${jo(p.name, "은는")} ${jo(old.name, "와과")} 결별하고 ${c.name}에서 독립했다!` + (joined.length ? `\n따르는 자: ${joined.join(", ")}` : ""), p.id);
  log(`${old.name}에서 독립했다.`, "good");
  G.mission = null; G.missionOffer = null;
  // 세 번째 신호 이후 독립했다면 내 세력의 노선을 다시 고른다
  if (G.flags.ev_signal3) { G.flags.routeRepick = true; G.queue.push({ type: "routeChoice", repick: true }); }
}

function actResign() {
  const p = P();
  if (!p.fac || isLord(p)) return;
  const c = C(p.city); if (c.gov === p.id) c.gov = null;
  log(`${jo(F(p.fac).name, "을를")} 떠나 재야가 되었다.`, "bad");
  p.fac = null; p.dudok = null; G.mission = null; G.missionOffer = null;
  assignGov(c);
}

function actMove(to) {
  if (typeof actTravel === "function") return actTravel(to); // 장수제: 지도 어디든 길을 따라 이동
  const p = P();
  if (!neighbors(p.city).includes(to)) return;
  const dest = C(to);
  if (p.fac && dest.owner !== p.fac) return notify("이동 불가", "사관 중에는 소속 세력의 거점으로만 이동할 수 있다.");
  if (!spend(COST.move)) return;
  const from = C(p.city);
  if (from.gov === p.id && !isLord(p)) { G.flags.noGov = true; from.gov = null; assignGov(from); G.flags.noGov = false; }
  p.city = to;
  if (p.fac && isLord(p)) dest.gov = p.id;
  log(`${jo(to, "으로")} 이동했다.`);
}

function actRest() {
  if (!spend(COST.rest)) return;
  const p = P(); const g = rnd(25, 40); p.hp = clamp(p.hp + g, 0, 100);
  log(`휴식을 취했다. 체력 +${g}`);
  if (typeof restCure === "function") restCure(p);
}

function actAppoint(cityName, id) {
  const p = P(); const c = C(cityName); const u = U(id);
  if (!isLord(p) || c.owner !== p.fac || u.fac !== p.fac) return;
  if (u.city !== cityName) u.city = cityName;
  c.gov = id;
  log(`${jo(u.name, "을를")} ${cityName}의 태수로 임명했다.`, "good");
}

function actSummon(id) { // 군주: 장수를 현재 거점으로 불러들임
  const p = P(); const u = U(id);
  if (!isLord(p) || u.fac !== p.fac || u.id === p.id) return;
  if (!spend(10)) return;
  const from = C(u.city); u.city = p.city;
  if (from.gov === u.id) { from.gov = null; assignGov(from); }
  log(`${jo(u.name, "을를")} ${jo(p.city, "으로")} 불러들였다.`);
  if (typeof squadChat === "function") { const sc = squadChat(true); if (sc) G.queue.push(sc); }
}

function proposeChance(p) {
  const lord = U(F(p.fac).lord);
  return Math.round(clamp(25 + p.st.int / 3 + p.merit / 120 + lord.bond / 3, 5, 95));
}

// ── 평정(임무) ────────────────────────────
const MISSION_TYPES = {
  agri: { ko: "농업 개발", unit: "" }, comm: { ko: "상업 개발", unit: "" }, tech: { ko: "기술 개발", unit: "" },
  order: { ko: "치안 순찰", unit: "" }, def: { ko: "방벽 보수", unit: "" }, draft: { ko: "징병", unit: "명" },
  search: { ko: "탐방", unit: "회" }, recruit: { ko: "인재 등용", unit: "명" }, train: { ko: "단련", unit: "회" },
};

function offerMissions() {
  const p = P();
  if (!p.fac || isLord(p)) { G.missionOffer = null; return; }
  const c = C(p.city);
  const types = shuffle(Object.keys(MISSION_TYPES)).slice(0, 3);
  G.missionOffer = types.map((t) => {
    let target;
    if (t === "draft") target = 1500 + rnd(0, 10) * 200;
    else if (t === "order") target = rnd(6, 12);
    else if (t === "search" || t === "train") target = rnd(2, 4);
    else if (t === "recruit") target = 1;
    else target = 60 + rnd(0, 8) * 10;
    if (t === "recruit" && !unitsIn(c.name).some((u) => !u.fac && !u.iron)) target = 1;
    return { type: t, target, progress: 0, reward: 120 + rnd(0, 10) * 15, deadline: G.year * 12 + G.month + 2 };
  });
}

function acceptMission(i) {
  if (!G.missionOffer) return;
  G.mission = G.missionOffer[i]; G.missionOffer = null;
  log(`평정: 임무 「${MISSION_TYPES[G.mission.type].ko} ${G.mission.target}${MISSION_TYPES[G.mission.type].unit}」를 맡았다.`, "sys");
}

function missionProgress(type, v) {
  const m = G.mission; if (!m || m.type !== type) return;
  m.progress += v;
  if (m.progress >= m.target) {
    const p = P(); addMerit(p, m.reward); p.gold += 100;
    const lord = U(F(p.fac).lord); lord.bond = clamp(lord.bond + 8, 0, 100);
    notify("임무 달성", `${lord.name}: "훌륭하다. 기대 이상이야."\n공적 +${m.reward}, 자금 +100`, lord.id, "ActionApprove", "clear");
    G.mission = null;
    if (typeof randItem === "function" && chance(40)) gainItem(randItem([20, 50, 25, 5]), "임무 포상");
  }
}

// ── 월말 처리 ─────────────────────────────
function endMonth() {
  if (G.over) return;
  G.report = []; G.lastWars = [];
  for (const k of Object.keys(G.truce)) { if (--G.truce[k] <= 0) { delete G.truce[k]; log(`${jo(F(k) ? F(k).name : k, "와과")}의 휴전이 만료되었다.`, "war"); } }
  if (typeof officerTick === "function") officerTick(); // 임무: 30일을 하루씩 진행
  aiDevelopment();
  aiFreeUnits();
  economy();
  aiWar();
  aiAbsorb();
  if (typeof officerMonth === "function") officerMonth(); // 장수 자율 행동·관계·평정
  monthlyEvents();
  checkFactions();
  // 다음 달
  G.month++; if (G.month > 12) { G.month = 1; G.year++; }
  G.ap = AP_MAX;
  if (typeof officerNewMonth === "function") officerNewMonth(); // 병·수행의 행동력 감소, 이어 가던 길
  const p = P(); p.hp = clamp(p.hp + 15, 0, 100);
  if (G.mission && G.year * 12 + G.month > G.mission.deadline) {
    log(`임무 「${MISSION_TYPES[G.mission.type].ko}」 기한을 넘겼다. 공적 -40`, "bad");
    addMerit(p, -40); G.mission = null;
  }
  if (p.fac && !isLord(p) && !G.mission) offerMissions();
  checkPromotionEvents();
  checkFacilityUps();
  checkGoals();
  if (typeof checkStoryEvents === "function") checkStoryEvents();
  if (typeof officerEvents === "function") officerEvents(); // 개인 이벤트 (연회 초대·부탁·일기토 신청·재해 등)
  if (typeof applyTitle === "function") applyTitle();
  checkVictory();
  if (G.report.length) G.queue.unshift({ type: "report", items: G.report.slice() });
  const urgent = G.queue.filter((x) => x.type === "surrender"); if (urgent.length) G.queue = [...urgent, ...G.queue.filter((x) => x.type !== "surrender")];
  G.report = null;
}

function aiDevelopment() {
  for (const c of Object.values(G.cities)) {
    if (!c.owner) { c.troops = Math.min(c.troops + 50, c.size * 1500); continue; }
    const f = F(c.owner);
    if (f.iron) { c.troops = Math.min(c.troops + Math.round((250 + c.size * 120) * DIFF[G.diff].iron), Math.round((6000 + c.size * 2500) * DIFF[G.diff].iron)); continue; }
    const playerRuns = (G.player && P().fac === c.owner && (c.gov === G.player));
    for (const u of unitsIn(c.name)) {
      if (u.id === G.player || u.fac !== c.owner) continue;
      if (typeof taskBusy === "function" && taskBusy(u.id)) continue; // 임무 수행 중
      if (playerRuns && !chance(50)) continue; // 플레이어가 태수인 거점은 위임 효율 절반
      if (c.gold < 300) break; // 플레이어 몫의 예비 자금은 남겨 둔다
      const mx = cityMax(c);
      let type;
      if (c.troops < 6000 + c.size * 3000 && c.gold > 300 && c.food > c.troops * 0.6) type = "draft";
      else if (c.order < 55) type = "order";
      else {
        const opts = ["agri", "comm", "tech", "def"].sort((a, b) => c[a] / mx[a] - c[b] / mx[b]);
        type = chance(70) ? opts[0] : pick(opts);
      }
      const g = doDev(u, type);
      if (g) { u.merit += type === "draft" ? 20 : Math.round(g * 0.3); gainExp(u, DEV[type].stat, 4); }
    }
    // 재야 등용 (AI)
    const gov = U(c.gov);
    for (const u of unitsIn(c.name)) {
      if (u.fac || u.iron || u.id === G.player || !gov) continue;
      if (chance(5 + gov.st.cha / 12)) {
        u.fac = c.owner; u.loyal = rnd(60, 85); u.merit = Math.max(u.merit, 150);
        log(`${jo(F(c.owner).name, "이가")} ${c.name}에서 ${jo(u.name, "을를")} 등용했다.`);
      }
    }
    assignGov(c);
  }
  // AI: 장수가 없는 거점으로 재배치
  for (const f of Object.values(G.factions)) {
    if (!f.alive) continue;
    const cs = citiesOf(f.key);
    for (const c of cs) {
      if (unitsIn(c.name).some((u) => u.fac === f.key)) continue;
      const donor = cs.map((d) => ({ d, us: unitsIn(d.name).filter((u) => u.fac === f.key && !isLord(u) && u.id !== G.player && d.gov !== u.id) }))
        .filter((x) => x.us.length >= 2 && neighbors(c.name).includes(x.d.name)).sort((a, b) => b.us.length - a.us.length)[0];
      if (donor) { const u = donor.us[0]; u.city = c.name; assignGov(c); }
    }
  }
}

function aiFreeUnits() {
  for (const u of Object.values(G.units)) {
    if (!u.alive || u.iron) continue;
    if (u.missing) { u.missing--; if (!u.missing) { u.city = pick(Object.keys(G.cities)); log(`행방불명이던 ${jo(u.name, "이가")} ${u.city}에서 모습을 드러냈다.`); } continue; }
    if (u.fac || u.id === G.player) continue;
    if (chance(12)) u.city = pick(neighbors(u.city));
  }
}

function economy() {
  for (const c of Object.values(G.cities)) {
    if (!c.owner) continue;
    const cl = facLv(c, "comm");
    c.gold += Math.round((c.comm * 0.25 + 60) * (cl >= 5 ? 1.2 : cl >= 4 ? 1.1 : 1));
    c.food += Math.round(c.agri * (G.month === 7 ? 3 : 0.5) * (facLv(c, "agri") >= 3 ? 1.15 : 1));
    c.food -= Math.round(c.troops * 0.02);
    if (c.food < 0) { c.food = 0; const lost = Math.round(c.troops * 0.1); c.troops -= lost; if (c.owner === P().fac) log(`${c.name}: 식량 부족으로 병사 ${lost}명이 이탈했다.`, "bad"); }
    c.gold = Math.min(c.gold, 30000); c.food = Math.min(c.food, 200000);
    c.troops = Math.min(c.troops, 12000 + c.size * 8000);
    c.order = clamp(c.order + (c.order < 50 ? 1 : 0), 0, 100);
  }
  // 봉록
  for (const u of Object.values(G.units)) {
    if (!u.alive || !u.fac || u.iron) continue;
    const c = C(u.city);
    if (c && c.owner === u.fac) { const pay = (rankOf(u) + 1) * 6; c.gold = Math.max(0, c.gold - pay); if (u.id === G.player) u.gold += pay; }
  }
}

// ── 전쟁 ─────────────────────────────────
function armyPower(list, troops) {
  // list: [{u, troops}]
  const sb = squadBonus(list.map((x) => x.u));
  const mult = (u) => { const q = sb.find((b) => u.squad === b.key); return q ? q.mult : 1; };
  const rm = typeof relArmyMult === "function" ? relArmyMult(list) : 1; // 친우끼리 함께 싸우면 강해진다
  return list.reduce((s, x) => s + x.troops * (0.5 + powerOf(x.u) / 100) * mult(x.u), 0) * rm || (troops || 0) * 0.85;
}

function pickArmy(cityName, fac, troops, maxN, forceInclude) {
  let us = unitsIn(cityName).filter((u) => u.fac === fac && u.id !== G.player);
  us.sort((a, b) => powerOf(b) - powerOf(a));
  us = us.slice(0, maxN);
  // 징집된 플레이어는 총대장이 아닌 마지막 부대로 편성
  if (forceInclude && !us.includes(forceInclude)) { us = [...us.slice(0, maxN - 1), forceInclude]; }
  const total = troops;
  const caps = us.map((u) => maxTroops(u));
  const capSum = caps.reduce((a, b) => a + b, 0) || 1;
  const list = us.map((u, i) => ({ u, troops: Math.max(300, Math.min(caps[i], Math.round(total * caps[i] / capSum))) }));
  return list;
}

function aiWar() {
  const p = P();
  const order = shuffle(Object.values(G.factions).filter((f) => f.alive));
  for (const f of order) {
    if (f.lord === G.player && !G.flags.autoWar) continue; // 플레이어 세력의 전쟁은 플레이어가 결정 (위임 시 태수 자율 출진)
    const offensive = G.month === 4 || G.month === 10; // 봄·가을 대공세: 출진 확률 상승
    const grace = G.year === 1 && G.month <= 4 ? 0.35 : 1; // 1년차 초반 유예
    const surge = f.iron && G.flags.ironSurge === G.year * 12 + G.month ? 2.2 : 1;
    // 종반: 거점이 많은 세력일수록 더 공격적 (수렴 가속)
    const late = G.year >= 6 && !f.iron ? 1 + Math.min(0.6, citiesOf(f.key).length * 0.05) : 1;
    // 패권 의지: 7년차 이후 최대 세력(플레이어 세력 제외)은 더 자주, 더 과감하게 진격
    const top = G.year >= 7 && !f.iron && f.key !== P().fac && Object.values(G.factions).filter((x) => x.alive && !x.iron && x.key !== P().fac).every((x) => citiesOf(x.key).length <= citiesOf(f.key).length);
    const al = G.flags.allianceVs && G.flags.allianceVs.fac === f.key && G.flags.allianceVs.until > G.year * 12 + G.month ? 1 - Math.min(0.5, G.flags.allianceVs.n * 0.12) : 1;
    if (!chance((f.iron ? 26 * surge : offensive ? 85 : 55) * DIFF[G.diff].ai * grace * late * (top ? 1.6 : 1) * al)) continue;
    const cands = [];
    for (const c of citiesOf(f.key)) {
      if (c.gov === G.player) continue;
      const big = !f.iron && G.year >= 5 && citiesOf(f.key).length >= 6;
      if (c.troops < (f.iron ? 5500 : big ? 3800 : 5000)) continue;
      for (const n of neighbors(c.name)) {
        const t = C(n); if (t.owner === f.key) continue;
        if (t.owner && t.owner === P().fac && G.truce[f.key]) continue; // 플레이어와 휴전 중
        const defList = t.owner ? unitsIn(n).filter((u) => u.fac === t.owner).map((u) => ({ u, troops: 0 })) : [];
        const weakLate = G.year >= 6 && t.owner && !F(t.owner).iron && citiesOf(t.owner).length <= 3;
        const defPow = (t.troops * 0.85 + t.def * (weakLate ? 0.8 : 1.5)) * (t.owner ? 1 : 0.6) + defList.length * 400;
        const atkPow = c.troops * 0.65;
        // 무모함(지휘관 성향): 철충은 공격적, 공백지는 우선 목표
        const nerve = (f.iron ? 0.85 : 0.85 + Math.random() * 0.3) - Math.min(0.2, (G.year - 1) * 0.04) - (big ? Math.min(0.2, citiesOf(f.key).length * 0.015) : 0) - (top ? 0.15 : 0);
        if (atkPow > defPow * nerve) cands.push({ from: c, to: t, score: atkPow / (defPow + 1) + (t.owner ? 0 : 0.8) + (G.year >= 6 && t.owner && !F(t.owner).iron && t.owner !== p.fac && citiesOf(t.owner).length >= 8 ? 0.6 : 0) + (c.name === p.city && p.fac === f.key ? 1.2 : 0) + (!f.iron && F(t.owner) && F(t.owner).iron ? 0.5 : 0) + (typeof stratBonus === "function" ? stratBonus(f.key, t.name) : 0) + Math.random() * 0.5 });
      }
    }
    if (!cands.length) continue;
    const { from, to } = cands.sort((a, b) => b.score - a.score)[0];
    if (to.owner === f.key) continue; // 같은 달 다른 공격으로 이미 점령
    const send = Math.round(from.troops * 0.65);
    const drafted = p.fac === f.key && p.city === from.name && !isLord(p);
    const atk = pickArmy(from.name, f.key, send, 5, drafted ? p : null);
    if (!atk.length && !f.iron) continue;
    const war = { atkFac: f.key, from: from.name, to: to.name, atk, sent: send };
    const playerDefends = to.owner && p.fac === to.owner && p.city === to.name;
    if (drafted || playerDefends) {
      from.troops -= atk.reduce((s, x) => s + x.troops, 0) || send;
      G.queue.push({ type: "battle", war: prepareBattle(war), playerSide: drafted ? "atk" : "def", commander: !drafted && (isGov(p) || isLord(p)) });
      log(`${jo(f.name, "이가")} ${from.name}에서 ${jo(to.name, "으로")} 진군! (${drafted ? "출진 명령" : "방어전"})`, "war");
    } else {
      autoBattle(war);
    }
  }
}

// 약소 세력의 항복: 1개 거점만 남은 세력이 이웃 강국에 흡수된다
function aiAbsorb() {
  const p = P();
  // 플레이어가 대국이면 약소 세력이 투항을 제안한다
  if (p.fac && isLord(p) && G.year >= 4) {
    const mine = citiesOf(p.fac).length;
    for (const f of Object.values(G.factions)) {
      if (!f.alive || f.iron || f.key === p.fac) continue;
      const cs = citiesOf(f.key);
      if (cs.length > 3 || mine < cs.length * 3 || G.year < 3 || !chance(5 + Math.max(0, G.year - 4) * 2)) continue;
      G.queue.push({ type: "surrender", fac: f.key });
      break;
    }
  }
  for (const f of Object.values(G.factions)) {
    if (!f.alive || f.iron || f.lord === G.player) continue;
    const cs = citiesOf(f.key); if (cs.length < 1 || cs.length > (G.year >= 5 ? 3 : 1)) continue;
    const c = cs.slice().sort((a, b) => b.troops - a.troops)[0];
    const strong = neighbors(c.name).map((n) => C(n).owner).filter((k) => k && k !== f.key && !F(k).iron && (k !== p.fac || !G.truce[f.key]))
      .map((k) => ({ k, pow: citiesOf(k).reduce((s, x) => s + x.troops, 0) })).sort((a, b) => b.pow - a.pow)[0];
    const late = Math.max(0, G.year - 4);
    if (!strong || strong.pow < c.troops * (late ? 2.5 : 3.5) || !chance(6 + late * 4)) continue;
    const nf = F(strong.k);
    if (nf.lord === G.player) { G.queue.push({ type: "msg", title: "항복 제의", text: `${jo(f.name, "이가")} 우리에게 항복해 왔다!\n${jo(c.name, "와과")} 소속 장수들이 합류한다.`, who: f.lord, voice: "Retire" }); }
    for (const u of officersOf(f.key)) { u.fac = strong.k; u.loyal = rnd(55, 75); }
    for (const x of cs) { x.owner = strong.k; assignGov(x); } f.alive = false;
    log(`${jo(f.name, "이가")} ${nf.name}에 항복해 흡수되었다.`, "war");
  }
}

// 전투 준비: 수비측 편성
function prepareBattle(war) {
  const to = C(war.to);
  let def = [];
  if (to.owner) {
    const us = unitsIn(war.to).filter((u) => u.fac === to.owner);
    us.sort((a, b) => powerOf(b) - powerOf(a));
    const sel = us.slice(0, 5);
    const pu = us.find((u) => u.id === G.player);
    if (pu && !sel.includes(pu)) sel[sel.length - 1] = pu;
    const caps = sel.map((u) => maxTroops(u)); const capSum = caps.reduce((a, b) => a + b, 0) || 1;
    def = sel.map((u, i) => ({ u, troops: Math.max(300, Math.min(caps[i], Math.round(to.troops * caps[i] / capSum))) }));
  }
  const used = def.reduce((s, x) => s + x.troops, 0);
  const militia = Math.max(0, to.troops - used);
  return { ...war, def, militia, defFac: to.owner, cityDef: to.def };
}

function autoBattle(war) {
  const b = prepareBattle(war);
  const atkTroops = b.atk.reduce((s, x) => s + x.troops, 0) || b.sent;
  C(b.from).troops = Math.max(0, C(b.from).troops - atkTroops);
  resolvePrepared(b);
}

// 이미 출발한 군대(병력 차감 완료)의 자동 판정
function resolvePrepared(b) {
  const atkTroops = b.atk.reduce((s, x) => s + x.troops, 0) || b.sent;
  const aPow = armyPower(b.atk, atkTroops) * (0.85 + Math.random() * 0.3);
  const weakLate = G.year >= 6 && b.defFac && !F(b.defFac).iron && citiesOf(b.defFac).length <= 3;
  const dPow = (armyPower(b.def, 0) + b.militia * 0.7) * (1 + b.cityDef / (weakLate ? 5000 : 2500)) * (0.85 + Math.random() * 0.3) + 1;
  const win = aPow > dPow;
  const ratio = win ? dPow / aPow : aPow / dPow;
  const result = {
    win,
    atkLeft: Math.round(atkTroops * (win ? 1 - ratio * 0.6 : 0.25)),
    defLeft: Math.round((b.def.reduce((s, x) => s + x.troops, 0) + b.militia) * (win ? 0 : 1 - ratio * 0.6)),
    captured: [], atkCaptured: [],
  };
  if (win) { for (const x of b.def) if (chance(30)) result.captured.push(x.u.id); }
  else { for (const x of b.atk) if (chance(15)) result.atkCaptured.push(x.u.id); }
  applyBattle(b, result);
  return result;
}

// 전투 결과 반영 (자동/수동 공용)
// result: {win, atkLeft, defLeft, captured: [id], atkCaptured: [id]}
function applyBattle(b, result) {
  const from = C(b.from), to = C(b.to);
  if (G.lastWars) G.lastWars.push({ from: b.from, to: b.to, fac: b.atkFac, win: result.win });
  const pIn = b.atk.some((x) => x.u.id === G.player) || (b.defFac && b.defFac === P().fac && P().city === b.to);
  if (pIn) { const meWin = b.atk.some((x) => x.u.id === G.player) ? result.win : !result.win; meWin ? G.stats.wins++ : G.stats.losses++; }
  const af = F(b.atkFac), df = F(b.defFac);
  const p = P();
  for (const id of result.atkCaptured || []) handleCapture(U(id), b.defFac, b.from);
  if (result.win) {
    to.owner = b.atkFac; to.troops = Math.max(500, result.atkLeft); to.gov = null;
    // 증원: 인접 아군 거점에서 병력 일부를 보내 점령지를 지킨다 (AI 세력)
    if (af && !af.iron && af.lord !== G.player) for (const n of neighbors(b.to)) { const nc = C(n); if (nc.owner === b.atkFac && nc.troops > 6000) { const mv = Math.round(nc.troops * 0.25); nc.troops -= mv; to.troops += mv; } }
    to.order = clamp(to.order - 15, 0, 100); to.def = Math.round(to.def * 0.7);
    for (const x of b.atk) if (x.u.alive && !x.u.missing && !(result.atkCaptured || []).includes(x.u.id)) x.u.city = b.to;
    // 패배한 수비측
    const defenders = df ? unitsIn(b.to).filter((u) => u.fac === b.defFac) : [];
    for (const u of defenders) {
      if ((result.captured || []).includes(u.id)) { handleCapture(u, b.atkFac, b.to); continue; }
      const back = neighbors(b.to).filter((n) => C(n).owner === b.defFac);
      if (back.length) u.city = pick(back); else handleCapture(u, b.atkFac, b.to);
    }
    assignGov(to);
    const msg = `${jo(af.name, "이가")} ${jo(b.to, "을를")} 점령했다.${df ? ` (← ${df.name})` : ""}`;
    log(msg, "war");
    if (p.fac && (b.atkFac === p.fac || b.defFac === p.fac)) chron(b.atkFac === p.fac ? `${b.to} 점령` : `${b.to} 상실`);
    if (p.fac === b.atkFac && b.atk.some((x) => x.u.id === G.player)) {
      addMerit(p, 250);
      if (b.defFac === "iron") { addMerit(p, 300); if (typeof randItem === "function") gainItem(randItem([0, 10, 50, 40]), "철충 둥지 격파"); log(`철충 둥지 ${b.to} 격파! 명성이 크게 올랐다.`, "good"); }
      else if (typeof randItem === "function" && chance(45)) gainItem(randItem([15, 45, 32, 8]), "전리품");
    }
  } else {
    to.troops = Math.max(0, result.defLeft);
    from.troops += Math.max(0, result.atkLeft);
    log(`${af.name}의 ${b.to} 공략은 실패로 끝났다.`, "war");
    if (p.fac === b.defFac && p.city === b.to) addMerit(p, 150);
  }
  if (typeof battleBonds === "function") battleBonds(b, result);
}

function handleCapture(u, captorFac, where) {
  if (!u || !u.alive) return;
  const captor = F(captorFac);
  const wasLord = isLord(u);
  const oldFac = u.fac;
  if (u.id === G.player) {
    if (captor && captor.iron) {
      u.fac = wasLord ? u.fac : null; u.city = pick(neighbors(where)); u.hp = 20;
      notify("포로 탈출", `철충에게 붙잡혔으나 간신히 탈출해 ${jo(u.city, "으로")} 도망쳤다...`, u.id);
      if (!wasLord) { G.mission = null; G.missionOffer = null; }
    } else {
      G.queue.push({ type: "captured", captor: captorFac, where });
    }
    return;
  }
  if (u.iron) {
    u.alive = false; log(`철충 지휘개체 ${jo(u.name, "이가")} 격파되었다.`, "war"); return;
  }
  if (captor && captor.iron) {
    u.missing = rnd(3, 8); u.fac = wasLord ? u.fac : null;
    log(`${jo(u.name, "이가")} 철충에게 붙잡혀 행방불명되었다.`, "bad");
    if (wasLord) { u.missing = 0; const cap = capitalOf(oldFac); if (cap && cap !== where) u.city = cap; else { u.missing = rnd(3, 6); u.fac = null; } }
    return;
  }
  // 바이오로이드 세력에 포로
  const lord = U(captor.lord);
  if (wasLord) {
    const cap = citiesOf(oldFac).filter((c) => c.name !== where);
    if (cap.length) { u.city = cap[0].name; log(`${jo(u.name, "은는")} 포위를 뚫고 ${jo(u.city, "으로")} 퇴각했다.`, "war"); return; }
  }
  if (captor.lord === G.player) {
    G.queue.push({ type: "prisoner", id: u.id, where });
    u.fac = null; u.city = where; return;
  }
  if (!wasLord && chance(35 + (lord.st.cha - 60) / 2)) {
    u.fac = captorFac; u.city = where; u.loyal = 60; log(`${jo(u.name, "이가")} ${captor.name}에 투항했다.`);
  } else { u.fac = null; u.city = where; log(`${jo(u.name, "은는")} 풀려나 재야가 되었다.`); }
}

function releasePrisoner(id, recruit) {
  const u = U(id); const p = P();
  if (recruit && chance(40 + (p.st.cha - u.st.cha) / 2 + u.bond / 2)) {
    u.fac = p.fac; u.loyal = 60; notify("투항", `${u.name}: "...졌어요. 당신을 따르겠어요."`, u.id);
  } else {
    u.fac = null; u.bond = clamp(u.bond + 10, 0, 100);
    notify(recruit ? "등용 거부" : "석방", recruit ? `${jo(u.name, "은는")} 등용을 거부했다. 풀어 주었다.` : `${jo(u.name, "을를")} 풀어 주었다. (친밀 +10)`, u.id);
  }
}

function playerCapturedChoice(captorFac, join) {
  const p = P(); const f = F(captorFac);
  const wasLord = isLord(p);
  if (join && !wasLord) {
    p.fac = captorFac; p.loyal = 60; G.mission = null;
    notify("투항", `${f.name}에 몸을 맡기기로 했다.`, f.lord); offerMissions();
  } else {
    const oldFac = p.fac;
    const cap = wasLord ? citiesOf(oldFac).filter((c) => c.name !== p.city) : [];
    if (cap.length) p.city = cap[0].name;
    else { p.fac = wasLord ? null : null; p.city = pick(neighbors(p.city)); G.mission = null; G.missionOffer = null; }
    p.hp = 30; notify("탈출", `틈을 노려 탈출했다. 지금은 ${p.city}에 있다.`, p.id);
  }
}

// 플레이어 주도 출진 (태수/군주 또는 상신 승인). alloc: {id: troops}
function canCommand(p) { return p.fac && C(p.city).owner === p.fac && (isGov(p) || isLord(p)); }

function actWar(to, alloc, proposal) {
  const p = P(); const from = C(p.city); const t = C(to);
  if (!neighbors(p.city).includes(to) || t.owner === p.fac) return;
  if (proposal) {
    if (!spend(COST.propose)) return;
    const lord = U(F(p.fac).lord);
    if (!chance(proposeChance(p))) {
      notify("상신 기각", `${lord.name}: "아직 때가 아니다. 내정에 힘써라."`, lord.id); return;
    }
    notify("상신 승인", `${lord.name}: "좋다, ${to} 공략을 그대에게 맡기겠다. 총대장으로서 지휘하라!"`, lord.id);
  } else if (!spend(COST.war)) return;
  const atk = Object.entries(alloc).filter(([, n]) => n > 0).map(([id, n]) => ({ u: U(id), troops: n }));
  const sum = atk.reduce((s, x) => s + x.troops, 0);
  if (!atk.length || sum > from.troops) return notify("출진 불가", "병력 배분이 올바르지 않다.");
  from.troops -= sum;
  log(`${from.name}에서 ${jo(to, "으로")} 출진! (병력 ${sum.toLocaleString()})`, "war");
  G.queue.push({ type: "battle", war: prepareBattle({ atkFac: p.fac, from: from.name, to, atk, sent: sum }), playerSide: "atk", commander: true });
}

// ── 외교: 휴전 (군주 전용) ─────────────────
function truceChance(fk) {
  const p = P(); const f = F(fk);
  const mine = citiesOf(p.fac).reduce((s, c) => s + c.troops, 0), theirs = citiesOf(fk).reduce((s, c) => s + c.troops, 0) + 1;
  const ironFront = citiesOf(fk).some((c) => neighbors(c.name).some((n) => C(n).owner === "iron"));
  return Math.round(clamp(25 + (p.st.cha - 60) * 0.8 + (mine / theirs - 1) * 20 + U(f.lord).bond / 3 + (ironFront ? 20 : 0), 5, 92));
}
function actTruce(fk) {
  const p = P(); const f = F(fk); const cap = C(capitalOf(p.fac));
  if (!isLord(p) || !f || f.iron || G.truce[fk]) return;
  if (cap.gold < 300) return notify("자금 부족", "외교 사절을 보낼 자금(300)이 부족하다.");
  if (!spend(30)) return;
  cap.gold -= 300;
  if (chance(truceChance(fk))) {
    G.truce[fk] = 12;
    notify("휴전 성립", `${U(f.lord).name}: "좋아. 당분간은 서로 칼끝을 거두지."
${jo(f.name, "와과")} 12개월간 휴전한다.`, f.lord);
    log(`${jo(f.name, "와과")} 휴전했다.`, "good");
  } else notify("휴전 거절", `${U(f.lord).name}: "흥, 지금 그런 말을 들을 이유가 없군."`, f.lord);
}

function threatFaction() {
  const p = P();
  return Object.values(G.factions).filter((f) => f.alive && !f.iron && f.key !== p.fac && citiesOf(f.key).length >= 16).sort((a, b) => citiesOf(b.key).length - citiesOf(a.key).length)[0] || null;
}
function actGrandAlliance() {
  const p = P(); const t = threatFaction(); const cap = C(capitalOf(p.fac));
  if (!isLord(p) || !t || cap.gold < 500) return notify("대동맹 불가", t ? "자금(500)이 부족하다." : "위협 세력이 없다.");
  if (!spend(40)) return;
  cap.gold -= 500;
  const ok = [];
  for (const f of Object.values(G.factions)) if (f.alive && !f.iron && f.key !== p.fac && f.key !== t.key && !G.truce[f.key] && chance(truceChance(f.key) + 25)) { G.truce[f.key] = 12; ok.push(f.name); }
  const no = Object.values(G.factions).filter((f) => f.alive && !f.iron && f.key !== p.fac && f.key !== t.key && !ok.includes(f.name) && citiesOf(f.key).length).map((f) => f.name);
  if (ok.length) G.flags.allianceVs = { fac: t.key, until: G.year * 12 + G.month + 12, n: ok.length };
  notify("대동맹", `${t.name}에 맞선 대동맹 교섭 결과\n\n✔ 수락: ${ok.length ? ok.join(", ") : "없음"}\n✕ 거절: ${no.length ? no.join(", ") : "없음"}\n\n${ok.length ? `12개월 휴전. ${t.name}의 공세 확률 -${Math.min(50, ok.length * 12)}%` : "어느 세력도 응하지 않았다…"}`, p.id, "Leader", ok.length ? "rankup2" : "warn");
  if (ok.length) chron(`대동맹 결성 (vs ${t.name})`);
}

// ── 이벤트 / 판정 ─────────────────────────
function monthlyEvents() {
  if (G.month === 7) log("수확기 — 각 거점에 식량이 들어왔다.", "sys");
  const nowM = G.year * 12 + G.month;
  if (G.year >= 4 && nowM >= (G.flags.ironAwakeNext || 0) && (!F("iron").alive || citiesOf("iron").length < 2) && citiesOf(P().fac || "").length < 24) {
    G.flags.ironAwake = (G.flags.ironAwake || 0) + 1; G.flags.ironAwakeNext = nowM + 18;
    const fi = F("iron"); fi.alive = true;
    const pool = Object.values(G.cities).filter((c) => c.owner && c.owner !== "iron" && c.owner !== P().fac && unitsIn(c.name).length <= 2).sort((a, b) => a.troops - b.troops);
    const nests = (pool.length ? pool : Object.values(G.cities).filter((c) => c.owner !== P().fac)).slice(0, 2);
    for (const c of nests) {
      const old = c.owner; for (const u of unitsIn(c.name)) if (u.fac === old) { const back = capitalOf(old); if (back && back !== c.name) u.city = back; else u.fac = null; }
      c.owner = "iron"; c.troops = 16000 + G.year * 1500; c.def = c.size * 300;
    }
    for (const u of Object.values(G.units)) if (u.iron && !u.alive && chance(55)) { u.alive = true; u.fac = "iron"; u.city = pick(nests).name; }
    for (const c of nests) assignGov(c);
    log(`철충 각성 — ${nests.map((c) => c.name).join(", ")}에 새 둥지가 생겼다!`, "war");
    G.queue.push({ type: "dialog", bg: "field", lines: [
      { who: null, text: "땅이 울린다. 사라진 줄 알았던 철충의 신호가, 이전보다 훨씬 거대하게 되살아났다." },
      { who: "EmperorChick", text: "………………………" },
      { who: P().id, text: `${nests.map((c) => c.name).join(", ")}… 저기에 새 둥지가! 싸움은 아직 끝나지 않았어.`, voice: "BattleFocus" },
    ] });
    for (const f of Object.values(G.factions)) if (f.alive && !f.iron && f.lord !== G.player) G.truce[f.key] = Math.max(G.truce[f.key] || 0, 0);
  }
  if (G.month === 9 && G.year >= 2 && F("iron") && F("iron").alive) {
    for (const c of citiesOf("iron")) c.troops += 3000 + G.year * 500;
    G.flags.ironSurge = G.year * 12 + 9;
    log(`철충 정기 대공세 — 철충 거점의 병력이 크게 늘었다. 철충과 맞닿은 세력은 휴전 교섭이 쉬워진다.`, "war");
    if (typeof Sound !== "undefined") Sound.sfx("warn");
    G.queue.push({ type: "msg", title: "철충 대공세", text: "가을이 되자 철충 둥지가 다시 맥동한다.\n철충 병력 급증 · 이번 달 철충의 진격이 거세진다.\n(철충과 맞닿은 세력과의 휴전 성공률 +20%)", who: "EmperorChick", sfx: "warn" });
  }
  const p = P();
  if (p.fac && chance(10)) {
    const c = pick(citiesOf(p.fac)); if (c) { const g = rnd(300, 800); c.gold += g; log(`${c.name}: 구 시대 보급 컨테이너를 발견! 자금 +${g}`, "good"); }
  }
  if (chance(12)) {
    const front = Object.values(G.cities).filter((c) => c.owner && !F(c.owner).iron && neighbors(c.name).some((n) => C(n).owner === "iron"));
    const c = front.length && pick(front);
    if (c) { const d = Math.round(c.troops * rnd(5, 10) / 100); c.troops -= d; log(`${c.name}: 철충 정찰대의 기습으로 병력 ${d} 손실.`, "bad"); }
  }
  if (chance(6)) {
    const c = pick(Object.values(G.cities).filter((c) => c.owner && !F(c.owner).iron));
    if (c) { const n = rnd(400, 900); c.troops += n; log(`${c.name}: 폐허를 떠돌던 생존 바이오로이드 ${n}명이 합류했다.`, "good"); }
  }
  if (chance(2.5)) { log("어딘가에서 사령관의 것으로 보이는 통신 기록이 발견되었다는 소문이 돈다...", "story"); if (p.fac) addMerit(p, 30); }
  if (chance(8)) {
    const c = pick(Object.values(G.cities).filter((c) => c.owner && !F(c.owner).iron));
    if (c) { const d = Math.round(c.agri * 0.15); c.agri -= d; log(`${c.name}에 산성비가 내려 농업이 ${d} 감소했다.`, "bad"); }
  }
}

function checkFactions() {
  for (const f of Object.values(G.factions)) {
    if (!f.alive) continue;
    { const cs = citiesOf(f.key).map((c) => c.name); if (cs.length) (G.flags.lastOwner ||= {})[f.key] = cs; }
    if (citiesOf(f.key).length === 0) {
      f.alive = false;
      for (const u of officersOf(f.key)) { if (u.iron) u.alive = false; else { u.fac = null; } }
      log(`${jo(f.name, "이가")} 멸망했다.`, "war");
      if (P().fac === null && f.lord === G.player) notify("세력 멸망", "모든 거점을 잃었다... 재야로서 다시 일어서자.", G.player);
      else if (f.key === P().fac) {}
      else { // 개별 모달은 플레이어와 맞닿았던 세력이거나 위협 세력일 때만 (나머지는 정세 보고에)
        const mine = P().fac ? citiesOf(P().fac).map((c) => c.name) : [P().city];
        const near = (G.flags.lastOwner || {})[f.key] ? G.flags.lastOwner[f.key].some((cn) => mine.includes(cn) || neighbors(cn).some((x) => mine.includes(x))) : true;
        if (near || G.flags["thSnd_" + f.key]) G.queue.push({ type: "msg", title: "세력 멸망", text: `${jo(f.name, "이가")} 멸망했다.`, who: f.lord });
      }
    }
  }
}

function checkPromotionEvents() {
  const p = P();
  if (!p.fac || isLord(p) || isGov(p)) return;
  const c = C(p.city);
  if (c.owner !== p.fac || rankOf(p) < 2) return;
  const gov = U(c.gov);
  if (!gov || (!isLord(gov) && gov.merit < p.merit && chance(35 + U(F(p.fac).lord).bond / 4))) {
    c.gov = p.id;
    notify("태수 임명", `${U(F(p.fac).lord).name}: "${jo(c.name, "을를")} 그대에게 맡기겠다."\n${c.name}의 태수가 되었다! 이제 이 거점에서 출진을 지휘할 수 있다.`, F(p.fac).lord, "Leader", "rankup");
  }
}

function acceptSurrender(fk, ok) {
  const f = F(fk); const p = P();
  if (!ok) { log(`${f.name}의 투항 제의를 거절했다.`, "sys"); return; }
  const left = [];
  for (const u of officersOf(fk)) { if (!isLord(u) && chance(20)) { u.fac = null; left.push(u.name); continue; } u.fac = p.fac; u.loyal = rnd(55, 75); }
  if (left.length) log(`투항을 거부한 장수들이 떠났다: ${left.slice(0, 5).join(", ")}${left.length > 5 ? " 외" : ""}`, "bad");
  for (const c of citiesOf(fk)) { c.owner = p.fac; assignGov(c); }
  f.alive = false; chron(`${f.name} 투항`); addMerit(p, 200);
  log(`${jo(f.name, "이가")} 우리에게 투항했다!`, "good");
}

// 목표: 신분에 따라 다음 목표와 보상
function currentGoal() {
  const p = P();
  const rn = typeof riseNeed === "function" ? riseNeed() : 400;
  if (!p.fac) return p.merit < rn ? { text: `명성 ${rn} 달성 (거병 가능)`, cur: p.merit, max: rn } : { text: "세력에 사관하거나 공백지에서 거병", cur: 1, max: 1 };
  if (isLord(p)) {
    const n = citiesOf(p.fac).length; const ms = [8, 16, 24, 32].find((m) => n < m) || 32;
    return { text: ms === 32 ? "천하통일 (32거점)" : `거점 ${ms}곳 확보 — 보상: EX 장비`, cur: n, max: ms, key: "cities" + ms };
  }
  const r = rankOf(p);
  if (r < RANKS.length - 1) return { text: `「${RANKS[r + 1].name}」 승진`, cur: p.merit, max: RANKS[r + 1].merit };
  return isGov(p) ? { text: "공적 1500 이상 — 독립 가능", cur: Math.min(p.merit, 1500), max: 1500 } : { text: "태수 임명을 노려라 (공적·친밀)", cur: 1, max: 1 };
}
const SIDE_GOALS = [
  { key: "sworn1", text: "의자매 1명", cur: () => Object.values(G.units).filter((u) => u.sworn).length, max: 1, reward: 120, gift: "SP 장비", fn: () => gainItem(randItem([0, 0, 80, 20]), "도전 달성") },
  { key: "equip3", text: "장비 3칸 채우기", cur: () => Object.values(eqOf(P())).filter(Boolean).length, max: 3, reward: 100, gift: "매력 +2", fn: () => { P().st.cha += 2; } },
  { key: "win3", text: "전투 승리 3회", cur: () => G.stats.wins, max: 3, reward: 150, gift: "통솔 +2", fn: () => { P().st.ldr += 2; } },
  { key: "rec3", text: "인재 등용 3명", cur: () => G.stats.recruits, max: 3, reward: 150, gift: "특기 「인덕」", fn: () => { const p = P(); if (!p.skills.includes("인덕")) p.skills.push("인덕"); } },
  { key: "win10", text: "전투 승리 10회", cur: () => G.stats.wins, max: 10, reward: 300, gift: "칭호 「백전노장」 · 무력 +3 · EX 장비", fn: () => { const p = P(); p.st.war += 3; p.title = "백전노장"; gainItem(randItem([0, 0, 0, 100]), "백전노장"); } },
];
const sideGoal = () => SIDE_GOALS.find((x) => !G.flags["sg_" + x.key]);
function checkGoals() {
  const p = P();
  const sg = sideGoal();
  if (sg && typeof eqOf === "function" && sg.cur() >= sg.max) { G.flags["sg_" + sg.key] = true; addMerit(p, sg.reward); if (sg.fn) sg.fn(); log(`도전 달성 — ${sg.text} (공적 +${sg.reward}, ${sg.gift})`, "good"); G.toast = { text: `도전 달성: ${sg.text} — ${sg.gift}`, kind: "gold" }; chron(`도전 「${sg.text}」 달성`); }
  if (!p.fac || !isLord(p)) return;
  const n = citiesOf(p.fac).length;
  for (const m of [8, 16, 24]) if (n >= m && !G.flags["ms" + m]) {
    G.flags["ms" + m] = true; addMerit(p, 150 * (m / 8));
    if (typeof randItem === "function") gainItem(randItem([0, 0, 40, 60]), `거점 ${m}곳 달성`);
    chron(`거점 ${m}곳 달성`);
  }
}

function checkVictory() {
  const p = P();
  for (const f of Object.values(G.factions)) {
    if (!f.alive || f.iron || f.key === p.fac) continue;
    const n = citiesOf(f.key).length;
    if (n >= 18 && !G.flags["warn18_" + f.key]) { G.flags["warn18_" + f.key] = true; G.queue.push({ type: "msg", title: "통일 위협", text: `${jo(f.name, "이가")} 거점 ${n}곳을 장악했다!\n24곳에 이르면 천하는 그들의 것이 된다. 동맹·휴전·견제를 서둘러라.`, who: f.lord, voice: "Leader", sfx: "warn" }); }
    if (n >= 20 && !G.flags["warn20_" + f.key]) { G.flags["warn20_" + f.key] = true; G.queue.push({ type: "msg", title: "라이벌 통일 임박", text: `${jo(f.name, "이가")} ${n}거점에 이르렀다! 앞으로 ${24 - n}곳이면 천하가 넘어간다.\n대동맹·휴전으로 시간을 벌고, 그들의 거점을 빼앗아라.`, who: f.lord, voice: "Leader", sfx: "warn" }); }
    if (n >= 24) { G.over = true; G.queue.push({ type: "ending", win: false, fac: f.key, rival: true }); return; }
  }
  // 패권 승리: 20거점 이상 + 철충 섬멸
  if (p.fac && !F(p.fac).iron && !F("iron").alive && citiesOf(p.fac).length >= 20 && !G.flags.hegemony) {
    G.flags.hegemony = true; G.over = true; chron("패권 확립");
    G.queue.push({ type: "ending", win: true, fac: p.fac, hegemony: true });
    return;
  }
  const owners = new Set(Object.values(G.cities).map((c) => c.owner));
  if (owners.size === 1 && !owners.has(null)) {
    const f = F([...owners][0]);
    G.over = true;
    const mine = P().fac === f.key;
    G.queue.push({ type: "ending", win: mine && !f.iron, fac: f.key });
  }
}

// ── 저장 ─────────────────────────────────
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...G, queue: [] })); return true; } catch (e) { return false; } }
function loadGame() { try { const s = localStorage.getItem(SAVE_KEY); if (!s) return false; G = JSON.parse(s); G.queue = []; G.inv ||= []; if (typeof initOfficer === "function") initOfficer(); return true; } catch (e) { return false; } }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
