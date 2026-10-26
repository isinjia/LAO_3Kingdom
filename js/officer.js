// 라스트오리진 삼국지 — 장수제 확장: 신분·권한, 성격, 인간관계, 임무(작업), 평정, 위명, 장수 자율 행동
// game.js 뒤에 불러온다. 새 상태는 모두 G 안에 있어 저장/불러오기에 그대로 포함된다
//   G.rel   장수끼리 관계 변화량 {"a|b": 값}   G.oath  장수끼리 의자매 {"a|b": true}
//   G.tasks 임무 작업 목록                    G.strat 세력별 평정 전략 목표
//   u.per   성격·야망·의리                    u.feud  플레이어에 대한 적대 (0~100)
//   u.dudok 도독으로 임명한 세력 키           u.follow 거병 때 따라오기로 한 협객 동지
//   p.fame  위명 계통별 실적                  p.fameT 이미 달성한 위명 단계
"use strict";

// ── 성격·야망·의리 ─────────────────────────
const PER_TYPES = ["용맹", "냉정", "대담", "신중", "온후"];
const PER_DESC = { 용맹: "앞장서 싸우기를 즐긴다", 냉정: "감정보다 계산을 앞세운다", 대담: "큰 판을 벌이기를 좋아한다", 신중: "위험을 피하고 때를 기다린다", 온후: "사람을 아끼고 다툼을 싫어한다" };
const PER_CLASH = { 용맹: "신중", 신중: "용맹", 대담: "온후", 온후: "대담", 냉정: "용맹" };
function perOf(u) {
  if (!u.per) {
    const r = hashSeed(u.id + "#per");
    u.per = { type: PER_TYPES[Math.floor(r() * PER_TYPES.length)], amb: Math.round(15 + r() * 80), gi: Math.round(20 + r() * 75) };
  }
  return u.per;
}

// ── 신분과 권한 ───────────────────────────
const ROLE_ORDER = ["재야", "일반", "중신", "태수", "도독", "군주"];
function roleOf(u) {
  if (!u.fac) return "재야";
  if (isLord(u)) return "군주";
  if (isGov(u)) return u.dudok === u.fac ? "도독" : "태수";
  return rankOf(u) >= 2 ? "중신" : "일반";
}
const roleLv = (u) => ROLE_ORDER.indexOf(roleOf(u));
const ROLE_NEED = (lv) => `${ROLE_ORDER[lv]} 이상만 할 수 있다`;
// 신분별로 새로 열리는 명령 (권한표)
const AUTH = [
  ["재야", "탐방·단련·휴식 · 교류·선물 · 의협 활동·교역 · 사관 · 거병(명성 400)"],
  ["일반", "내정 6종 · 상관이 내린 임무 수행·협력 요청 · 출진 상신 · 하야"],
  ["중신", "편장군 이상 · 평정 의견 제시 · 임무 제안 · 연회 개최"],
  ["태수", "출진 지휘 · 이 거점 장수에게 임무 발령 · 포상 · 독립(공적 1500)"],
  ["도독", "관할(본거와 이웃 아군 거점) 장수에게 임무 발령 · 관할 장수 이동 명령"],
  ["군주", "모든 거점에 임무 발령 · 전략 목표 결정 · 외교 · 태수·도독 임명 · 소환"],
];
// 명령을 내릴 수 있는 거점
function jurisOf(u) {
  const r = roleOf(u);
  if (r === "군주") return citiesOf(u.fac).map((c) => c.name);
  if (r === "도독") return [u.city, ...neighbors(u.city).filter((n) => C(n).owner === u.fac)];
  if (r === "태수") return [u.city];
  return [];
}
const dudokCap = (fac) => { const n = citiesOf(fac).length; return n >= 4 ? Math.max(1, Math.floor(n / 6)) : 0; };
const dudoksOf = (fac) => officersOf(fac).filter((u) => u.dudok === fac);

// ── 인간관계 ──────────────────────────────
const relKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
function relBase(A, B) {
  const pa = perOf(A), pb = perOf(B);
  return (A.squad && A.squad === B.squad ? 30 : 0) + (A.fac && A.fac === B.fac ? 5 : 0) + (pa.type === pb.type ? 5 : 0) + (PER_CLASH[pa.type] === pb.type || PER_CLASH[pb.type] === pa.type ? -10 : 0);
}
// 양방향 관계 (-100 ~ 100). 플레이어와의 관계는 친밀(bond) - 적대(feud)
function relOf(a, b) {
  if (a === b) return 100;
  const A = U(a), B = U(b); if (!A || !B) return 0;
  if (a === G.player) return B.bond - (B.feud || 0);
  if (b === G.player) return A.bond - (A.feud || 0);
  return clamp(relBase(A, B) + ((G.rel || {})[relKey(a, b)] || 0), -100, 100);
}
function addRel(a, b, v) {
  if (a === b || !v) return;
  const A = U(a), B = U(b); if (!A || !B || A.iron || B.iron) return;
  if (a === G.player || b === G.player) {
    const o = a === G.player ? B : A;
    if (v > 0) { o.bond = clamp(o.bond + v, 0, 100); o.feud = Math.max(0, (o.feud || 0) - v); }
    else o.feud = clamp((o.feud || 0) - v, 0, 100);
    bondStage(o);
    return;
  }
  const k = relKey(a, b); G.rel ||= {};
  G.rel[k] = clamp((G.rel[k] || 0) + v, -140, 140);
  if (relOf(a, b) >= 100 && !(G.oath ||= {})[k]) {
    G.oath[k] = true;
    if (A.fac && (A.fac === P().fac || B.fac === P().fac)) log(`${jo(A.name, "와과")} ${jo(B.name, "이가")} 의자매의 연을 맺었다.`);
  }
}
const isOath = (a, b) => !!(G.oath && G.oath[relKey(a, b)]);
function relStage(v, sworn) {
  if (sworn) return "의자매";
  if (v >= 85) return "막역지우"; if (v >= 60) return "친우"; if (v >= 30) return "지인";
  if (v <= -70) return "원수"; if (v <= -40) return "적대";
  return "보통";
}
const STAGE_RANK = { 원수: -2, 적대: -1, 보통: 0, 지인: 1, 친우: 2, 막역지우: 3, 의자매: 4 };
function stageWith(id) { const u = U(id); return relStage(relOf(G.player, id), u && u.sworn); }
// 플레이어와의 인연 단계가 오르면 알린다 (친우·막역지우)
function bondStage(u) {
  if (!u || u.iron || u.id === G.player) return;
  const s = relStage(u.bond - (u.feud || 0), u.sworn), r = STAGE_RANK[s];
  const seen = u.stageSeen == null ? 1 : u.stageSeen;
  if (r > seen && r >= 2 && r <= 3) {
    log(`${jo(u.name, "와과")} 「${s}」 사이가 되었다.${r === 3 ? " (등용 +15%)" : " (등용 +8% · 함께 출진하면 공격 +3%)"}`, "good");
    G.toast = { text: `${jo(u.name, "와과")} ${s}!`, kind: "bond" };
    if (r === 3) chron(`${jo(u.name, "와과")} 막역지우`);
  }
  if (r < 0 && seen >= 0) log(`${jo(u.name, "와과")} 사이가 「${s}」로 틀어졌다.`, "bad");
  u.stageSeen = r;
}
// 등용 확률 보정: 인연 단계, 적대, 이미 세력에 있는 친구
function relRecruitBonus(p, t) {
  const s = stageWith(t.id);
  let v = s === "막역지우" ? 15 : s === "친우" ? 8 : 0;
  v -= (t.feud || 0) * 0.5;
  if (p.fac && officersOf(p.fac).some((x) => x.id !== p.id && relOf(x.id, t.id) >= 60)) v += 10;
  return v;
}
// 함께 출진한 친우·막역지우 쌍마다 공격 +3% (최대 +12%)
function relArmyMult(list) {
  let n = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].u && list[j].u && relOf(list[i].u.id, list[j].u.id) >= 60) n++;
  return 1 + Math.min(0.12, n * 0.03);
}
// 이 장수와 가장 가까운/먼 장수
function topRels(id, n = 5) {
  const out = [];
  for (const x of Object.values(G.units)) {
    if (!x.alive || x.iron || x.id === id) continue;
    const v = relOf(id, x.id);
    if (v >= 30 || v <= -40 || isOath(id, x.id)) out.push({ u: x, v, s: relStage(v, x.id === G.player ? U(id).sworn : isOath(id, x.id)) });
  }
  return out.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, n);
}

// ── 위명 (6계통) ──────────────────────────
const FAME = {
  무관: { how: "전투 승리", tiers: [[3, "무관"], [10, "맹장"], [25, "만인적"]], unlock: ["「무예 지도」 — 같은 거점 장수의 무력을 단련해 준다", "지휘 병력 +1000", "무력 +3"] },
  문관: { how: "내정·내정 임무 완료", tiers: [[10, "문관"], [30, "능리"], [60, "명재상"]], unlock: ["「민정 시찰」 — 치안·농업·상업을 한 번에 돌본다", "내정 효과 +10%", "정치 +3"] },
  군사: { how: "평정 의견 채택·임무 제안 승인·설전 등용·유언비어 성공", tiers: [[3, "군사"], [8, "책사"], [15, "신산귀모"]], unlock: ["「유언비어」 — 이웃 적 거점의 치안과 장수 충성을 깎는다", "평정 의견·임무 제안 성공률 +15%", "지력 +3"] },
  장군: { how: "태수·총대장으로서 전투 승리", tiers: [[2, "장군"], [6, "명장"], [12, "대원수"]], unlock: ["「격려」 — 이 거점 아군 장수의 충성을 높인다", "지휘 병력 +2000", "통솔 +3"] },
  협객: { how: "의협 활동", tiers: [[5, "협객"], [12, "호협"], [25, "대협"]], unlock: ["「호걸 규합」 — 재야 친구를 거병 동지로 삼는다", "거병에 필요한 명성 400 → 250", "매력 +3"] },
  상인: { how: "교역", tiers: [[5, "상인"], [12, "호상"], [25, "거상"]], unlock: ["교역 이익 +25%", "「군자금 헌납」 — 개인 자금을 바쳐 공적과 신망을 얻는다", "매달 개인 자금 +50"] },
};
const FAME_STAT = { 무관: "war", 문관: "pol", 군사: "int", 장군: "ldr", 협객: "cha" };
const fameTier = (u, line) => { const v = ((u.fame || {})[line]) || 0; let t = 0; FAME[line].tiers.forEach(([n], i) => { if (v >= n) t = i + 1; }); return t; };
const hasFame = (line, tier = 1) => fameTier(P(), line) >= tier;
function fameAdd(line, n = 1) {
  const p = P(); p.fame ||= {}; p.fameT ||= {};
  p.fame[line] = (p.fame[line] || 0) + n;
  const t = fameTier(p, line);
  if (t > (p.fameT[line] || 0)) {
    p.fameT[line] = t;
    const name = FAME[line].tiers[t - 1][1];
    if (t === 3) { if (FAME_STAT[line]) p.st[FAME_STAT[line]] = Math.min(100 + (typeof eqBonus === "function" ? eqBonus(p, FAME_STAT[line]) : 0), p.st[FAME_STAT[line]] + 3); }
    chron(`위명 「${name}」`);
    notify("위명", `천하가 ${jo(p.name, "을를")} 「${name}」${jo(name, "으로").slice(name.length)} 부르기 시작했다.\n\n해금: ${FAME[line].unlock[t - 1]}`, p.id, "MVP", "rankup2");
  }
}
// 대표 위명: 단계가 가장 높은 계통
function fameTitle(u) {
  let best = null;
  for (const line in FAME) { const t = fameTier(u, line); if (t && (!best || t > best.t)) best = { line, t, name: FAME[line].tiers[t - 1][1] }; }
  return best;
}
const fameTroops = (u) => (u.id === G.player ? (fameTier(u, "무관") >= 2 ? 1000 : 0) + (fameTier(u, "장군") >= 2 ? 2000 : 0) : 0);
const fameDevMult = (u) => (u.id === G.player && fameTier(u, "문관") >= 2 ? 1.1 : 1);
const riseNeed = () => (hasFame("협객", 2) ? 250 : 400);

// ── 날짜 (한 달 = 30일, 행동력을 쓸수록 하루하루가 지난다) ──
const dayNow = () => ((G.year - 1) * 12 + (G.month - 1)) * 30 + Math.min(29, Math.floor((AP_MAX - G.ap) * 29 / AP_MAX));
const monthStartDay = () => ((G.year - 1) * 12 + (G.month - 1)) * 30;
const dayStr = (d) => `${Math.floor(d / 360) + 1}년 ${Math.floor((d % 360) / 30) + 1}월 ${(d % 30) + 1}일`;
const todayStr = () => dayStr(dayNow());

// ── 임무 (작업 데이터) ────────────────────
// 종류·발령 장수·수행 장수(첫 번째가 주 수행)·대상 도시·목표·진행률·예상 완료일·협력 보너스·보상
const TASK_KIND = {
  agri: { ko: "농업 개발", stat: "pol", need: 120, gold: 80, dev: true },
  comm: { ko: "상업 개발", stat: "pol", need: 120, gold: 80, dev: true },
  tech: { ko: "기술 개발", stat: "int", need: 100, gold: 80, dev: true },
  def: { ko: "방벽 보수", stat: "ldr", need: 120, gold: 80, dev: true },
  order: { ko: "치안 유지", stat: "war", need: 90, gold: 40, dev: true },
  draft: { ko: "징병", stat: "cha", need: 120, gold: 150 },
  search: { ko: "인재 탐색", stat: "int", need: 100, gold: 0 },
  recruit: { ko: "등용 교섭", stat: "cha", need: 90, gold: 0, aim: true },
};
const taskBusy = (id) => (G.tasks || []).some((t) => t.doers.includes(id));
const playerTask = () => (G.tasks || []).find((t) => t.doers.includes(G.player));
function taskRate(t) {
  const k = TASK_KIND[t.kind]; const main = U(t.doers[0]); if (!main) return 1;
  let r = 0;
  t.doers.forEach((id, i) => { const u = U(id); if (u) r += (u.st[k.stat] * 0.08 + 1) * (i ? 0.5 : 1) * (hasSkill(u, (DEV[t.kind] || {}).skill) ? 1.3 : 1); });
  return r * (1 + coopBonus(t));
}
// 협력 보너스: 주 수행 장수와 친우 이상인 협력자 1명당 +10%
function coopBonus(t) { return t.doers.slice(1).filter((id) => relOf(t.doers[0], id) >= 60).length * 0.1; }
function taskEta(t) { const from = Math.max(t.start, Math.min(dayNow(), t.last || t.start)); return from + Math.max(1, Math.ceil((t.need - t.prog) / taskRate(t))); }
function taskName(t) { const k = TASK_KIND[t.kind]; return k.aim && U(t.aim) ? `${k.ko} — ${U(t.aim).name}` : k.ko; }

function mkTask(kind, fac, issuer, doers, city, opts = {}) {
  const k = TASK_KIND[kind];
  const t = { id: (G.taskSeq = (G.taskSeq || 0) + 1), kind, fac, issuer, doers: doers.slice(), city, aim: opts.aim || null, need: k.need, prog: 0,
    start: opts.start != null ? opts.start : dayNow(), reward: opts.reward || 100 + rnd(0, 6) * 10, origin: opts.origin || "issue" };
  t.eta = taskEta(t);
  (G.tasks ||= []).push(t);
  return t;
}
function taskValid(t) {
  const c = C(t.city); if (!c || c.owner !== t.fac) return "거점을 잃었다";
  for (const id of t.doers) { const u = U(id); if (!u || !u.alive || u.missing || u.fac !== t.fac || u.city !== t.city) return `${u ? u.name : "수행 장수"}의 신변에 변화가 생겼다`; }
  if (t.kind === "recruit") { const a = U(t.aim); if (!a || a.fac || !a.alive) return "교섭 상대가 이미 다른 길을 택했다"; }
  return null;
}
// 완료: 공적·충성·관계·도시 수치 갱신
function taskComplete(t, day) {
  const k = TASK_KIND[t.kind]; const c = C(t.city); const main = U(t.doers[0]); const mx = cityMax(c);
  const s = main.st[k.stat]; let res = "";
  const sk = hasSkill(main, (DEV[t.kind] || {}).skill) ? 1.5 : 1;
  if (["agri", "comm", "tech", "def"].includes(t.kind)) {
    const g = Math.round((40 + s * 0.9) * sk * fameDevMult(main) * (1 + coopBonus(t)));
    const b = c[t.kind]; c[t.kind] = clamp(c[t.kind] + g, 0, mx[t.kind]); res = `${DEV[t.kind].ko.split(" ")[0]} +${c[t.kind] - b}`;
  } else if (t.kind === "order") { const g = Math.round((6 + s / 10) * sk); const b = c.order; c.order = clamp(c.order + g, 0, 100); res = `치안 +${c.order - b}`; }
  else if (t.kind === "draft") { const n = Math.round((800 + s * 15) * sk * (1 + coopBonus(t))); c.troops += n; res = `병력 +${n.toLocaleString()}`; }
  else if (t.kind === "search") {
    const pool = Object.values(G.units).filter((u) => u.alive && !u.missing && !u.fac && !u.iron && u.id !== G.player && (u.city === t.city || neighbors(t.city).includes(u.city)));
    if (pool.length) {
      const f = pick(pool); f.city = t.city; f.met = true; addRel(main.id, f.id, 15);
      if (chance(25 + main.st.cha / 3 + relOf(main.id, f.id) / 3)) { f.fac = t.fac; f.loyal = rnd(65, 85); f.merit = Math.max(f.merit, 150); res = `${jo(f.name, "을를")} 찾아내 등용했다`; if (t.fac === P().fac) G.stats.recruits++; }
      else res = `${jo(f.name, "을를")} ${t.city}에 데려왔다 (등용은 거절)`;
    } else res = "인근에 재야 인재가 없었다";
  } else if (t.kind === "recruit") {
    const a = U(t.aim);
    if (chance(clamp(30 + main.st.cha / 2 + relOf(main.id, a.id) / 2 - (a.feud || 0) / 2, 5, 95))) { a.fac = t.fac; a.loyal = rnd(65, 85); a.merit = Math.max(a.merit, 150); addRel(main.id, a.id, 10); res = `${jo(a.name, "이가")} 합류했다`; if (t.fac === P().fac) G.stats.recruits++; }
    else { addRel(main.id, a.id, 4); res = `${jo(a.name, "은는")} 아직 마음을 정하지 못했다`; }
  }
  // 수행 장수: 공적·충성, 협력자끼리 관계
  for (const id of t.doers) { const u = U(id); if (id === G.player) continue; u.merit += Math.round(t.reward * (id === main.id ? 0.6 : 0.3)); u.loyal = clamp(u.loyal + (id === main.id ? 4 : 2), 0, 100); gainExp(u, k.stat, 10); }
  for (let i = 0; i < t.doers.length; i++) for (let j = i + 1; j < t.doers.length; j++) addRel(t.doers[i], t.doers[j], 4);
  if (t.issuer && t.issuer !== main.id) addRel(t.issuer, main.id, 4);
  const p = P();
  if (t.doers.includes(G.player)) {
    addMerit(p, t.reward); p.gold += 80; gainExp(p, k.stat, 20);
    if (k.dev || t.kind === "draft") fameAdd("문관");
    if (t.origin === "propose") fameAdd("군사");
    log(`임무 완료 (${dayStr(day)}) — ${taskName(t)} @${t.city}: ${res} · 공적 +${t.reward}`, "good");
  } else if (t.issuer === G.player) {
    addMerit(p, Math.round(t.reward / 4));
    if (k.dev) fameAdd("문관");
    log(`임무 완료 (${dayStr(day)}) — ${main.name}의 ${taskName(t)} @${t.city}: ${res}`, "good");
  }
  t.done = res;
}
// 매달: 30일을 하루씩 진행
function officerTick() {
  if (!G.tasks || !G.tasks.length) return;
  const d0 = monthStartDay();
  for (const t of G.tasks.slice()) {
    const bad = taskValid(t);
    if (bad) { if (t.doers.includes(G.player) || t.issuer === G.player) log(`임무 중단 — ${taskName(t)} @${t.city}: ${bad}`, "bad"); G.tasks.splice(G.tasks.indexOf(t), 1); continue; }
    const rate = taskRate(t);
    for (let d = Math.max(d0, t.start); d < d0 + 30; d++) {
      t.prog += rate;
      if (t.prog >= t.need) { taskComplete(t, d); break; }
    }
    t.last = d0 + 30;
    if (t.done) G.tasks.splice(G.tasks.indexOf(t), 1); else t.eta = taskEta(t);
  }
}
// 상관이 고를 만한 임무: 거점에서 가장 부족한 것
function neededKind(c) {
  const mx = cityMax(c);
  if (c.order < 55) return "order";
  if (c.troops < 6000 + c.size * 3000 && c.gold > 400) return "draft";
  if (unitsIn(c.name).some((u) => !u.fac && !u.iron && u.id !== G.player) && chance(30)) return "recruit";
  return ["agri", "comm", "tech", "def"].sort((a, b) => c[a] / mx[a] - c[b] / mx[b])[0];
}
function superiorOf(u) {
  const c = C(u.city); const f = F(u.fac); if (!f) return null;
  if (c && c.owner === u.fac && c.gov && c.gov !== u.id && U(c.gov)) return U(c.gov);
  return U(f.lord);
}

// 플레이어: 상관이 내린 임무 거부
function actTaskDecline(id) {
  const t = (G.tasks || []).find((x) => x.id === id); if (!t || !t.doers.includes(G.player)) return;
  const p = P();
  if (t.origin === "order") { addRel(t.issuer, p.id, -8); addMerit(p, -20); log(`${jo(U(t.issuer).name, "이가")} 내린 임무 「${taskName(t)}」를 거부했다. 공적 -20, 관계 악화`, "bad"); }
  else log(`임무 「${taskName(t)}」를 그만두었다.`, "bad");
  if (t.doers[0] === G.player) G.tasks.splice(G.tasks.indexOf(t), 1);
  else t.doers = t.doers.filter((x) => x !== G.player);
}
// 플레이어가 발령한 임무 취소
function actTaskCancel(id) {
  const t = (G.tasks || []).find((x) => x.id === id); if (!t || t.issuer !== G.player) return;
  G.tasks.splice(G.tasks.indexOf(t), 1); log(`임무 「${taskName(t)}」 발령을 거두었다.`, "sys");
}
// 협력 요청: 같은 거점 아군 장수를 내 임무에 끌어들인다
function helpChance(p, u) { return Math.round(clamp(40 + relOf(p.id, u.id) / 2 + (u.loyal - 60) / 3, 5, 100)); }
function actTaskHelp(id, hid) {
  const t = (G.tasks || []).find((x) => x.id === id); const p = P(); const u = U(hid);
  if (!t || !u || !t.doers.includes(p.id) || t.doers.includes(hid) || taskBusy(hid) || u.city !== t.city || u.fac !== t.fac || isLord(u)) return;
  if (t.doers.length >= 4) return notify("협력 요청", "한 임무에 함께할 수 있는 장수는 4명까지다.");
  if (!spend(10)) return;
  if (chance(helpChance(p, u))) {
    t.doers.push(hid); addRel(p.id, hid, 2); t.eta = taskEta(t);
    log(`${jo(u.name, "이가")} 임무 「${taskName(t)}」에 힘을 보태기로 했다. (예상 완료 ${dayStr(t.eta)})`, "good");
    G.toast = { text: `${u.name} 협력 — 예상 완료 ${dayStr(t.eta)}`, kind: "bond" };
  } else notify("협력 거절", `${u.name}: "미안, 지금은 내 일로도 벅차."`, u.id);
}
// 중신 이상: 상관에게 임무를 제안해 직접 맡는다
function proposeTaskChance(p) {
  const sup = superiorOf(p); if (!sup) return 0;
  return Math.round(clamp(35 + p.st.int / 4 + p.st.pol / 6 + relOf(sup.id, p.id) / 3 + (hasFame("군사", 2) ? 15 : 0), 5, 95));
}
function actTaskPropose(kind, aim) {
  const p = P(); const c = C(p.city); const k = TASK_KIND[kind];
  if (roleLv(p) < 2 || isGov(p) || isLord(p)) return notify("임무 제안", "중신(편장군 이상)이 상관에게 올릴 수 있다. 태수·군주는 직접 발령한다.");
  if (c.owner !== p.fac) return notify("임무 제안", "소속 세력의 거점에서만 제안할 수 있다.");
  if (playerTask()) return notify("임무 제안", "이미 맡은 임무가 있다.");
  if (k.aim && (!U(aim) || U(aim).fac || U(aim).city !== p.city)) return;
  if (c.gold < k.gold + 100) return notify("임무 제안", `거점 자금이 부족하다. (${k.gold + 100} 필요)`);
  if (!spend(20)) return;
  const sup = superiorOf(p);
  if (!chance(proposeTaskChance(p))) { addMerit(p, 5); return notify("제안 기각", `${sup.name}: "지금은 그 일보다 급한 게 있다."`, sup.id); }
  c.gold -= k.gold;
  const t = mkTask(kind, p.fac, sup.id, [p.id], p.city, { aim, origin: "propose", reward: Math.round((120 + rnd(0, 6) * 10) * 1.3) });
  addRel(sup.id, p.id, 3);
  notify("제안 승인", `${sup.name}: "좋은 생각이다. 그 일은 그대가 맡아라."\n\n임무 「${taskName(t)}」 · 예상 완료 ${dayStr(t.eta)} · 보상 공적 +${t.reward}`, sup.id, "ActionApprove", "clear");
}
// 태수 이상: 관할 장수에게 임무 발령
function issueAccept(u) { return u.loyal >= 45 ? 100 : Math.round(clamp(u.loyal + 25 + relOf(G.player, u.id) / 3, 5, 100)); }
function actTaskIssue(kind, doerId, helperIds = [], aim) {
  const p = P(); const u = U(doerId); const k = TASK_KIND[kind];
  if (!u || u.fac !== p.fac || u.id === p.id || isLord(u) || !jurisOf(p).includes(u.city)) return notify("임무 발령", "관할 거점의 아군 장수에게만 발령할 수 있다.");
  if (taskBusy(u.id)) return notify("임무 발령", `${jo(u.name, "은는")} 이미 임무를 수행 중이다.`);
  const c = C(u.city);
  if (k.aim && (!U(aim) || U(aim).fac || U(aim).city !== u.city)) return notify("임무 발령", "등용 교섭 상대는 같은 거점의 재야 장수여야 한다.");
  if ((G.tasks || []).filter((t) => t.issuer === p.id).length >= 8) return notify("임무 발령", "동시에 발령할 수 있는 임무는 8건까지다.");
  if (c.gold < k.gold) return notify("임무 발령", `${c.name}의 자금이 부족하다. (${k.gold} 필요)`);
  if (!spend(10)) return;
  if (!chance(issueAccept(u))) { addRel(p.id, u.id, -3); return notify("명령 거부", `${u.name}: "…그 명령은 따를 수 없어요."\n(충성 ${u.loyal} — 포상·연회로 마음을 돌려 보자)`, u.id); }
  c.gold -= k.gold;
  const hs = helperIds.map(U).filter((x) => x && x.fac === p.fac && x.city === u.city && x.id !== u.id && !taskBusy(x.id) && !isLord(x)).slice(0, 3).map((x) => x.id);
  const t = mkTask(kind, p.fac, p.id, [u.id, ...hs], u.city, { aim });
  log(`${u.name}에게 임무 「${taskName(t)}」 발령${hs.length ? ` (협력 ${hs.map((x) => U(x).name).join(", ")})` : ""} · 예상 완료 ${dayStr(t.eta)}`, "sys");
  G.toast = { text: `임무 발령 — ${taskName(t)} · ${dayStr(t.eta)} 완료 예정`, kind: "good" };
}

// ── 평정: 세력의 전략 목표 ────────────────
const STRAT = {
  dev: { ko: "내정 강화", d: "장수들이 매달 내정을 한 번 더 한다" },
  arms: { ko: "군비 확충", d: "태수들이 매달 징병을 한 번 더 한다" },
  talent: { ko: "인재 확보", d: "세력 거점의 재야 장수 등용 확률이 오른다" },
  defend: { ko: "수비 강화", d: "적과 맞닿은 거점의 방어가 매달 오른다" },
  attack: { ko: "공략", d: "목표 거점 공격을 우선한다 (분기 안에 점령하면 성공)" },
};
const monthIdx = () => G.year * 12 + G.month;
const stratOf = (fac) => { const s = G.strat && G.strat[fac]; return s && s.until > monthIdx() ? s : null; };
const stratName = (s) => (s ? (s.goal === "attack" ? `${s.target} 공략` : STRAT[s.goal].ko) : "없음");
function stratBonus(fac, to) { const s = stratOf(fac); return s && s.goal === "attack" && s.target === to ? 1.5 : 0; }
function attackTargets(fac) { const out = new Set(); for (const c of citiesOf(fac)) for (const n of neighbors(c.name)) if (C(n).owner !== fac && !(C(n).owner && fac === P().fac && G.truce[C(n).owner])) out.add(n); return [...out]; }
function setStrat(fac, goal, target, by) {
  G.strat ||= {};
  G.strat[fac] = { goal, target: target || null, by: by || null, from: monthIdx(), until: monthIdx() + 3, base: citiesOf(fac).length };
}
// 분기가 끝난 목표 평가 (의견을 낸 플레이어에게 보상)
function stratJudge(fac) {
  const s = G.strat && G.strat[fac]; if (!s || s.judged || s.until > monthIdx()) return;
  s.judged = true;
  if (s.by !== G.player) return;
  const ok = s.goal === "attack" ? C(s.target).owner === fac : citiesOf(fac).length >= s.base;
  if (ok) { addMerit(P(), s.goal === "attack" ? 150 : 70); fameAdd("군사"); log(`평정 목표 「${stratName(s)}」 달성 — 공적 +${s.goal === "attack" ? 150 : 70}`, "good"); }
  else log(`평정 목표 「${stratName(s)}」는 이루지 못했다.`, "bad");
}
function aiStrat(f) {
  const cs = citiesOf(f.key); if (!cs.length) return;
  const troops = cs.reduce((s, c) => s + c.troops, 0);
  const tg = attackTargets(f.key).map((n) => { const t = C(n); const mine = neighbors(n).filter((x) => C(x).owner === f.key).reduce((s, x) => s + C(x).troops, 0); return { n, v: mine / (t.troops + t.def + 1) + (t.owner ? 0 : 0.5) }; }).sort((a, b) => b.v - a.v)[0];
  const border = cs.some((c) => neighbors(c.name).some((n) => C(n).owner && C(n).owner !== f.key && C(n).troops > c.troops * 1.3));
  if (tg && tg.v > 1.4 && troops > cs.length * 7000) setStrat(f.key, "attack", tg.n);
  else if (troops < cs.length * 5000) setStrat(f.key, "arms");
  else if (border && chance(40)) setStrat(f.key, "defend");
  else setStrat(f.key, chance(70) ? "dev" : "talent");
}
// 중신 이상: 평정에서 의견 제시 (분기마다 1회)
function voiceChance(p) { const lord = U(F(p.fac).lord); return Math.round(clamp(30 + p.st.int / 3 + p.st.pol / 6 + relOf(lord.id, p.id) / 3 + (hasFame("군사", 2) ? 15 : 0), 5, 95)); }
const quarterKey = () => G.year * 4 + Math.floor((G.month - 1) / 3);
function actStratVoice(goal, target) {
  const p = P();
  if (roleLv(p) < 2 || isLord(p)) return;
  if (G.flags.voiceQ === quarterKey()) return notify("평정", "이번 분기에는 이미 의견을 냈다.");
  if (!spend(15)) return;
  G.flags.voiceQ = quarterKey();
  const lord = U(F(p.fac).lord);
  if (chance(voiceChance(p))) {
    setStrat(p.fac, goal, target, p.id); addMerit(p, 40); addRel(lord.id, p.id, 3); fameAdd("군사");
    notify("의견 채택", `${lord.name}: "${p.name}의 말이 옳다. 이번 분기는 「${stratName(G.strat[p.fac])}」이다."\n\n${STRAT[goal].d}\n분기 안에 이루면 공적 보상.`, lord.id, "ActionApprove", "clear");
  } else { addMerit(p, 10); notify("의견 보류", `${lord.name}: "생각해 보지. 하지만 이번엔 「${stratName(stratOf(p.fac))}」로 간다."`, lord.id); }
}
// 군주: 전략 목표 결정 (분기마다 1회)
function actStratSet(goal, target) {
  const p = P(); if (!isLord(p)) return;
  if (G.flags.stratQ === quarterKey()) return notify("평정", "이번 분기의 전략 목표는 이미 정했다.");
  if (!spend(10)) return;
  G.flags.stratQ = quarterKey();
  setStrat(p.fac, goal, target, p.id);
  log(`평정 — 이번 분기 전략 목표: 「${stratName(G.strat[p.fac])}」 (${STRAT[goal].d})`, "sys");
}
// 전략 목표의 실제 효과 (플레이어가 직접 하는 일은 제외)
function stratEffects(f) {
  const s = stratOf(f.key); if (!s) return;
  if (s.goal === "dev") for (const u of officersOf(f.key)) {
    if (u.id === G.player || taskBusy(u.id) || !chance(35)) continue;
    const c = C(u.city); if (!c || c.owner !== f.key || c.gold < 300) continue;
    const mx = cityMax(c); const type = ["agri", "comm", "tech", "def"].sort((a, b) => c[a] / mx[a] - c[b] / mx[b])[0];
    const g = doDev(u, type); if (g) u.merit += Math.round(g * 0.3);
  }
  if (s.goal === "arms") for (const c of citiesOf(f.key)) { const g = U(c.gov); if (g && g.id !== G.player && c.gold > 400 && c.food > c.troops) doDev(g, "draft"); }
  if (s.goal === "talent") for (const c of citiesOf(f.key)) for (const u of unitsIn(c.name)) if (!u.fac && !u.iron && u.id !== G.player && !u.follow && chance(10)) { u.fac = f.key; u.loyal = rnd(60, 80); u.merit = Math.max(u.merit, 150); if (f.key === P().fac || c.name === P().city) log(`${jo(f.name, "이가")} 인재 확보 방침으로 ${jo(u.name, "을를")} 등용했다.`); }
  if (s.goal === "defend") for (const c of citiesOf(f.key)) if (neighbors(c.name).some((n) => C(n).owner && C(n).owner !== f.key)) c.def = Math.min(cityMax(c).def, c.def + 30);
}

// ── 개인 명령 (재야 경로 포함) ─────────────
function actGift(id) {
  const p = P(); const t = U(id);
  if (!t || t.iron || t.city !== p.city || t.id === p.id) return;
  if (p.gold < 100) return notify("선물", "개인 자금이 부족하다. (100 필요)");
  if (!spend(15)) return;
  p.gold -= 100; t.gold = (t.gold || 0) + 100;
  const g = rnd(5, 9) + (perOf(t).type === "온후" ? 3 : 0) + Math.round(p.st.cha / 25);
  addRel(p.id, t.id, g);
  if (t.fac && t.fac === p.fac) t.loyal = clamp(t.loyal + 3, 0, 100);
  log(`${t.name}에게 선물을 보냈다. 친밀 +${g} (${t.bond})`, "good");
  G.toast = { text: `${t.name} 친밀 +${g} (${t.bond})`, kind: "bond" };
}
// 중신 이상: 연회 — 같은 거점 아군 장수 모두와 친해지고, 장수끼리도 가까워진다
function actFeast() {
  const p = P(); const c = C(p.city);
  if (roleLv(p) < 2) return notify("연회", ROLE_NEED(2));
  const guests = unitsIn(c.name).filter((u) => u.fac === p.fac && u.id !== p.id && !u.iron).slice(0, 10);
  if (!guests.length) return notify("연회", "함께할 아군 장수가 이 거점에 없다.");
  if (p.gold < 200) return notify("연회", "개인 자금이 부족하다. (200 필요)");
  if (!spend(30)) return;
  p.gold -= 200;
  for (const u of guests) { addRel(p.id, u.id, rnd(3, 6)); u.loyal = clamp(u.loyal + 2, 0, 100); }
  for (let i = 0; i < guests.length; i++) for (let j = i + 1; j < guests.length; j++) addRel(guests[i].id, guests[j].id, 2);
  addMerit(p, 10 + guests.length * 2);
  log(`${c.name}에서 연회를 열었다. 참석 ${guests.length}명 — 친밀 상승 · 충성 +2 · 참석자끼리 관계 +2`, "good");
  G.toast = { text: `연회 — ${guests.length}명 참석`, kind: "bond" };
  if (typeof Sound !== "undefined") Sound.sfx("bond");
}
// 태수 이상: 포상 — 거점 자금으로 장수의 충성을 높인다
function actReward(id) {
  const p = P(); const u = U(id);
  if (!u || u.fac !== p.fac || isLord(u) || u.id === p.id || !jurisOf(p).includes(u.city)) return;
  const c = C(u.city); if (c.gold < 100) return notify("포상", `${c.name}의 자금이 부족하다. (100 필요)`);
  if (!spend(10)) return;
  c.gold -= 100; const g = rnd(6, 10) + (perOf(u).amb >= 70 ? -2 : 0);
  u.loyal = clamp(u.loyal + g, 0, 100); addRel(p.id, u.id, 2);
  log(`${u.name}에게 포상을 내렸다. 충성 +${g} (${u.loyal})`, "good");
  G.toast = { text: `${u.name} 충성 +${g} (${u.loyal})`, kind: "good" };
}
// 의협 활동: 신분과 무관하게 할 수 있는 협객의 길
function actChivalry() {
  const p = P(); const c = C(p.city);
  if (!spend(25)) return;
  const res = [];
  if (c.owner && !F(c.owner).iron) { c.order = clamp(c.order + 2, 0, 100); res.push("치안 +2"); }
  const folk = unitsIn(c.name).filter((u) => u.id !== p.id && !u.iron);
  if (folk.length) { const u = pick(folk); addRel(p.id, u.id, 4); res.push(`${u.name} 친밀 +4`); }
  if (chance(35)) { gainExp(p, "war", 15); const g = rnd(20, 80); p.gold += g; res.push(`무뢰배 소탕 · 무력 경험 +15 · 자금 +${g}`); }
  addMerit(p, 12); res.push("명성 +12");
  fameAdd("협객");
  log(`의협 활동 (${c.name}) — ${res.join(" · ")}`, "good");
  G.toast = { text: `의협 활동 — ${res[0]}`, kind: "good" };
}
// 교역: 개인 자금을 굴려 이익을 낸다 (상업이 발달한 거점일수록 유리)
function tradeInvest(p) { return Math.min(p.gold, 300 + fameTier(p, "상인") * 200); }
function actTrade() {
  const p = P(); const c = C(p.city);
  if (p.gold < 100) return notify("교역", "밑천이 부족하다. (개인 자금 100 필요)");
  if (c.owner && F(c.owner).iron) return notify("교역", "철충의 거점에서는 장사할 수 없다.");
  if (!spend(25)) return;
  const inv = tradeInvest(p); const mx = cityMax(c);
  let rate = 0.04 + (c.comm / mx.comm) * 0.14 + p.st.pol / 800 + rnd(-4, 6) / 100;
  if (hasSkill(p, "상재")) rate += 0.05;
  if (hasFame("상인", 1)) rate *= 1.25;
  const g = Math.round(inv * rate); p.gold += g;
  if (c.owner) c.comm = Math.min(mx.comm, c.comm + 2);
  addMerit(p, 6); gainExp(p, "pol", 6);
  fameAdd("상인");
  log(`교역 (${c.name}) — 밑천 ${inv} → 이익 ${g >= 0 ? "+" : ""}${g}`, g >= 0 ? "good" : "bad");
  G.toast = { text: `교역 이익 ${g >= 0 ? "+" : ""}${g}`, kind: "gold" };
  if (typeof Sound !== "undefined" && g > 0) Sound.sfx("coin");
}
// 위명 해금 명령
function actTeach(id) {
  const p = P(); const t = U(id);
  if (!hasFame("무관") || !t || t.iron || t.city !== p.city || t.id === p.id) return;
  if (!spend(20)) return;
  gainExp(t, "war", 30 + Math.round(p.st.war / 5)); addRel(p.id, t.id, 5); gainExp(p, "war", 6);
  log(`${t.name}에게 무예를 지도했다. (${t.name} 무력 경험 +${30 + Math.round(p.st.war / 5)} · 친밀 +5)`, "good");
}
function actInspect() {
  const p = P(); const c = C(p.city);
  if (!hasFame("문관") || !p.fac || c.owner !== p.fac) return;
  if (!spend(25)) return;
  const mx = cityMax(c); const o = rnd(4, 7), a = Math.round(p.st.pol * 0.3), m = Math.round(p.st.pol * 0.3);
  c.order = clamp(c.order + o, 0, 100); c.agri = Math.min(mx.agri, c.agri + a); c.comm = Math.min(mx.comm, c.comm + m);
  addMerit(p, 20); gainExp(p, "pol", 8);
  log(`민정 시찰 (${c.name}) — 치안 +${o} · 농업 +${a} · 상업 +${m}`, "good");
}
function rumorChance(p, c) { const g = U(c.gov); return Math.round(clamp(30 + p.st.int / 2 - (g ? g.st.int / 3 : 0), 5, 90)); }
function actRumor(to) {
  const p = P(); const c = C(to);
  if (!hasFame("군사") || !c || !neighbors(p.city).includes(to) || !c.owner || c.owner === p.fac || F(c.owner).iron) return;
  if (!spend(30)) return;
  const g = U(c.gov);
  if (chance(rumorChance(p, c))) {
    const o = rnd(6, 12); c.order = clamp(c.order - o, 0, 100);
    for (const u of unitsIn(to)) if (u.fac === c.owner && !isLord(u)) u.loyal = clamp(u.loyal - rnd(4, 9), 0, 100);
    addMerit(p, 40); fameAdd("군사");
    log(`유언비어 성공 — ${to}: 치안 -${o}, 장수들의 충성이 흔들린다.`, "good");
  } else { if (g) addRel(p.id, g.id, -10); log(`유언비어가 들통났다. ${g ? `${g.name}의 적의를 샀다.` : ""}`, "bad"); }
}
function actRally() {
  const p = P(); const c = C(p.city);
  if (!hasFame("장군") || !p.fac) return;
  const us = unitsIn(c.name).filter((u) => u.fac === p.fac && u.id !== p.id && !isLord(u));
  if (!us.length) return notify("격려", "이 거점에 격려할 아군 장수가 없다.");
  if (!spend(20)) return;
  for (const u of us) { u.loyal = clamp(u.loyal + 4, 0, 100); addRel(p.id, u.id, 2); }
  log(`장수들을 격려했다. ${us.length}명 충성 +4`, "good");
}
function actGather(id) {
  const p = P(); const t = U(id);
  if (!hasFame("협객") || !t || t.fac || t.iron || t.city !== p.city || t.follow === p.id) return;
  if (t.bond < 50) return notify("호걸 규합", `${jo(t.name, "와과")}는 아직 그만큼 가깝지 않다. (친밀 50 필요)`);
  if (!spend(20)) return;
  t.follow = p.id; addRel(p.id, t.id, 3);
  notify("호걸 규합", `${t.name}: "좋아. 네가 깃발을 올리는 날, 내가 제일 먼저 달려가지."\n(거병·독립 때 합류한다)`, t.id, "Oath", "bond");
}
function actDonate() {
  const p = P(); const c = C(p.city);
  if (!hasFame("상인", 2) || !c.owner || F(c.owner).iron) return;
  const amt = Math.min(p.gold, 500); if (amt < 100) return notify("군자금 헌납", "바칠 자금이 부족하다. (100 이상)");
  if (!spend(15)) return;
  p.gold -= amt; c.gold += amt;
  const lord = U(F(c.owner).lord);
  addMerit(p, Math.round(amt / (p.fac === c.owner ? 3 : 4)));
  addRel(lord.id, p.id, 3); if (c.gov && c.gov !== p.id && c.gov !== lord.id) addRel(c.gov, p.id, 6);
  log(`${c.name}에 군자금 ${amt}을 헌납했다. 공적 +${Math.round(amt / (p.fac === c.owner ? 3 : 4))}`, "good");
}
// 도독: 관할 안에서 장수 이동 명령
function actOrderMove(id, to) {
  const p = P(); const u = U(id); const jz = jurisOf(p);
  if (roleLv(p) < 4 || !u || u.fac !== p.fac || isLord(u) || u.id === p.id || !jz.includes(u.city) || !jz.includes(to) || u.city === to) return;
  if (!spend(10)) return;
  const from = C(u.city); u.city = to;
  if (from.gov === u.id) { from.gov = null; assignGov(from); }
  log(`${jo(u.name, "을를")} ${jo(to, "으로")} 보냈다.`, "sys");
}
// 군주: 도독 임명
function actAppointDudok(id) {
  const p = P(); const u = U(id);
  if (!isLord(p) || !u || u.fac !== p.fac || !isGov(u) || isLord(u)) return;
  if (u.dudok === p.fac) { u.dudok = null; log(`${u.name}의 도독직을 거두었다.`, "sys"); return; }
  if (dudoksOf(p.fac).length >= dudokCap(p.fac)) return notify("도독 임명", `거점 수에 비해 도독이 이미 충분하다. (최대 ${dudokCap(p.fac)}명 — 거점 6곳마다 1명)`);
  if (!spend(10)) return;
  u.dudok = p.fac; u.loyal = clamp(u.loyal + 6, 0, 100); addRel(p.id, u.id, 4);
  log(`${jo(u.name, "을를")} ${u.city} 일대의 도독으로 임명했다.`, "good");
}

// ── 세계: 장수 자율 행동 (매달) ────────────
const NEW_FAC_COLORS = ["#c77dff", "#80ed99", "#ffb4a2", "#90e0ef", "#f4a261", "#b5838d", "#e5989b", "#a3c4f3"];
function officerMonth() {
  const p = P(); const now = monthIdx();
  // 1) 같은 거점 장수끼리 오가며 관계가 변한다 (성격 궁합·같은 부대)
  for (const c of Object.values(G.cities)) {
    const us = unitsIn(c.name).filter((u) => !u.iron && u.id !== G.player);
    if (us.length < 2) continue;
    for (let n = 0; n < Math.min(3, us.length - 1); n++) {
      const a = pick(us), b = pick(us); if (a === b) continue;
      const pa = perOf(a), pb = perOf(b);
      const clash = PER_CLASH[pa.type] === pb.type || PER_CLASH[pb.type] === pa.type;
      addRel(a.id, b.id, clash ? (chance(45) ? -rnd(1, 3) : 1) : rnd(1, 3) + (a.squad && a.squad === b.squad ? 1 : 0));
    }
  }
  // 2) 충성 변화와 하야·이적
  let moves = 0; const NOTE = [];
  for (const u of Object.values(G.units)) {
    if (!u.alive || u.missing || u.iron || !u.fac || u.id === G.player || isLord(u)) continue;
    const f = F(u.fac); if (!f || f.iron) continue;
    const per = perOf(u);
    const target = 55 + relOf(u.id, f.lord) * 0.35 + (per.gi - 50) * 0.3 - (per.amb - 50) * 0.25 + Math.min(9, rankOf(u) * 3) + (citiesOf(f.key).length >= 8 ? 5 : 0) + (isGov(u) ? 4 : 0) - (per.amb >= 65 && rankOf(u) < 3 ? 6 : 0);
    const d = target - u.loyal; u.loyal = clamp(Math.round(u.loyal + Math.sign(d) * Math.min(2, Math.abs(d))), 0, 100);
    if (u.loyal >= 30 || moves >= 2 || G.year < 2 || !chance(6 * (1 + (per.amb - per.gi) / 100))) continue;
    // 다른 세력의 친구에게 가거나, 재야로 떠난다
    const friend = Object.values(G.units).filter((x) => x.alive && !x.missing && x.fac && x.fac !== u.fac && !F(x.fac).iron && relOf(u.id, x.id) >= 45 && (x.city === u.city || neighbors(u.city).includes(x.city))).sort((a, b) => relOf(u.id, b.id) - relOf(u.id, a.id))[0];
    const old = u.fac; const oc = C(u.city);
    if (friend && x_ok(friend)) { u.fac = friend.fac; u.city = friend.city; u.loyal = rnd(60, 75); NOTE.push(`${jo(u.name, "이가")} ${jo(F(old).name, "을를")} 떠나 친구 ${jo(friend.name, "이가")} 있는 ${jo(F(friend.fac).name, "으로")} 옮겼다.`); }
    else { u.fac = null; NOTE.push(`${jo(u.name, "이가")} ${F(old).name}에 실망해 하야했다.`); }
    u.dudok = null; if (oc && oc.gov === u.id) { oc.gov = null; assignGov(oc); }
    moves++;
    if (old === p.fac) { log(NOTE[NOTE.length - 1], "bad"); if (isLord(p)) notify("장수 이탈", `${NOTE[NOTE.length - 1]}\n\n충성이 낮은 장수는 포상·연회·선물로 붙잡아 두자.`, u.id); }
    else log(NOTE[NOTE.length - 1]);
  }
  // 3) 충성이 낮고 야망이 큰 태수의 독립
  if (G.year >= 2 && now >= (G.flags.npcIndepNext || 0)) {
    const cand = Object.values(G.units).filter((u) => u.alive && !u.missing && !u.iron && u.fac && u.id !== G.player && isGov(u) && !isLord(u) && !F(u.fac).iron && citiesOf(u.fac).length >= 5 && capitalOf(u.fac) !== u.city && u.loyal < 40 && perOf(u).amb >= 65);
    const u = cand.sort((a, b) => a.loyal - b.loyal)[0];
    if (u && chance(25)) { npcIndependence(u); G.flags.npcIndepNext = now + 12; }
  }
  // 불온한 기색: 플레이어 세력의 위험한 태수를 미리 알린다
  if (p.fac && isLord(p)) for (const u of officersOf(p.fac)) if (isGov(u) && !isLord(u) && u.loyal < 45 && perOf(u).amb >= 65 && !G.flags["warnIndep_" + u.id + "_" + G.year]) { G.flags["warnIndep_" + u.id + "_" + G.year] = true; log(`${u.city} 태수 ${u.name}에게 불온한 기색이 보인다. (충성 ${u.loyal} · 야망 ${perOf(u).amb})`, "bad"); }
  // 4) 인맥 등용: 재야 장수는 친한 장수가 있는 세력에 몸을 맡기기도 한다
  for (const u of Object.values(G.units)) {
    if (!u.alive || u.missing || u.iron || u.fac || u.id === G.player || u.follow) continue;
    const c = C(u.city); if (!c || !c.owner || F(c.owner).iron) continue;
    const fr = unitsIn(c.name).find((x) => x.fac === c.owner && x.id !== G.player && relOf(u.id, x.id) >= 60);
    if (fr && chance(15)) { u.fac = c.owner; u.loyal = rnd(65, 85); u.merit = Math.max(u.merit, 150); if (c.owner === p.fac || c.name === p.city) log(`${jo(u.name, "이가")} 친구 ${fr.name}의 권유로 ${F(c.owner).name}에 합류했다.`); }
  }
  // 5) 도독: AI 군주는 거점 6곳마다 1명, 큰 공을 세운 태수를 임명한다
  for (const f of Object.values(G.factions)) {
    if (!f.alive || f.iron) continue;
    for (const u of officersOf(f.key)) if (u.dudok && (u.dudok !== f.key || !isGov(u))) u.dudok = null;
    if (f.lord === G.player) continue;
    const cap = dudokCap(f.key); let have = dudoksOf(f.key).length;
    if (have >= cap) continue;
    const gs = officersOf(f.key).filter((u) => isGov(u) && !isLord(u) && !u.dudok && rankOf(u) >= 2).sort((a, b) => (b.merit + relOf(f.lord, b.id) * 20) - (a.merit + relOf(f.lord, a.id) * 20));
    for (const u of gs) {
      if (have >= cap) break;
      if (u.id === G.player && rankOf(u) < 3) continue;
      u.dudok = f.key; have++;
      if (u.id === G.player) notify("도독 임명", `${U(f.lord).name}: "${u.city} 일대를 그대에게 맡긴다. 도독으로서 관할 장수들을 이끌어라."\n\n이제 이웃 아군 거점의 장수에게도 임무를 발령하고 이동을 명할 수 있다.`, f.lord, "Leader", "rankup2");
    }
  }
  // 6) 평정: 분기마다 AI 세력이 전략 목표를 정하고, 목표가 실제로 작동한다
  for (const f of Object.values(G.factions)) {
    if (!f.alive || f.iron) continue;
    stratJudge(f.key);
    if (f.lord !== G.player && (!stratOf(f.key) || (G.month - 1) % 3 === 0)) aiStrat(f);
    stratEffects(f);
  }
  // 7) 상관이 플레이어에게 임무를 내린다
  if (p.fac && !isLord(p) && !isGov(p) && !playerTask() && C(p.city).owner === p.fac && chance(40)) {
    const sup = superiorOf(p); const c = C(p.city);
    if (sup && sup.id !== p.id) {
      const kind = neededKind(c); const aim = kind === "recruit" ? pick(unitsIn(c.name).filter((u) => !u.fac && !u.iron && u.id !== G.player)) : null;
      const k2 = aim || kind !== "recruit" ? kind : "agri";
      const t = mkTask(k2, p.fac, sup.id, [p.id], c.name, { aim: aim ? aim.id : null, origin: "order", start: monthStartDay() + 30 });
      log(`${sup.name}의 명령 — 임무 「${taskName(t)}」 (${c.name}) · 예상 완료 ${dayStr(t.eta)} · 보상 공적 +${t.reward}`, "sys");
    }
  }
  // 8) 인연 단계 확인 · 상인 위명 수입
  for (const u of Object.values(G.units)) if (u.alive && !u.iron && u.id !== G.player && (u.bond || u.feud)) bondStage(u);
  if (fameTier(p, "상인") >= 3) p.gold += 50;
}
function x_ok(friend) { return friend.fac && F(friend.fac) && F(friend.fac).alive; }
function npcIndependence(u) {
  const old = F(u.fac); const c = C(u.city); const p = P();
  const key = "n_" + u.id + (G.factions["n_" + u.id] ? "_" + monthIdx() : "");
  G.factions[key] = { key, name: `${u.name} 세력`, lord: u.id, flag: u.name[0], color: NEW_FAC_COLORS[Object.keys(G.factions).length % NEW_FAC_COLORS.length], iron: false, icon: null, desc: `${old.name}에서 독립한 세력.`, motto: "", alive: true };
  const fol = [];
  for (const x of unitsIn(c.name)) {
    if (x.id === u.id || x.fac !== old.key || isLord(x)) continue;
    if (x.id !== G.player && (relOf(x.id, u.id) >= 30 || x.loyal < 50 || isOath(x.id, u.id))) { x.fac = key; x.loyal = rnd(65, 85); x.dudok = null; fol.push(x.name); }
    else { const back = capitalOf(old.key); if (back && back !== c.name) x.city = back; }
  }
  for (const x of Object.values(G.units)) if (x.alive && !x.fac && !x.iron && x.id !== G.player && (isOath(x.id, u.id) || x.follow === u.id)) { x.fac = key; x.city = c.name; fol.push(x.name); }
  u.fac = key; u.loyal = 100; u.dudok = null; u.merit = Math.max(u.merit, 3000);
  c.owner = key; c.gov = u.id;
  setStrat(key, "arms");
  const msg = `${u.city} 태수 ${jo(u.name, "이가")} ${jo(old.name, "와과")} 결별하고 독립했다!${fol.length ? ` 따르는 자: ${fol.slice(0, 5).join(", ")}${fol.length > 5 ? " 외" : ""}` : ""}`;
  log(msg, "war");
  if (p.fac === old.key || (p.fac && neighbors(c.name).some((n) => C(n).owner === p.fac))) { chron(`${u.name} 독립 (← ${old.name})`); notify("태수 독립", msg, u.id, "Leader", "warn"); }
}

// 전투 협력: 함께 싸운 장수끼리 가까워지고, 위명 실적이 쌓인다
function battleBonds(b, result) {
  const p = P();
  const sides = [b.atk.map((x) => x.u), (b.def || []).map((x) => x.u)];
  for (const s of sides) for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) if (s[i] && s[j]) addRel(s[i].id, s[j].id, 3);
  const pAtk = b.atk.some((x) => x.u.id === G.player);
  const pDef = !pAtk && b.defFac && b.defFac === p.fac && p.city === b.to;
  if (!pAtk && !pDef) return;
  const won = pAtk ? result.win : !result.win;
  // 적장과는 적대가 쌓인다 (패배시킨 쪽에 대한 원한)
  const foes = pAtk ? (b.def || []).map((x) => x.u) : b.atk.map((x) => x.u);
  if (won) for (const u of foes) if (u && !u.iron && u.alive) addRel(p.id, u.id, -rnd(4, 8));
  if (!won) return;
  fameAdd("무관");
  if ((pAtk && b.atk[0] && b.atk[0].u.id === G.player) || (pDef && (isGov(p) || isLord(p)))) fameAdd("장군");
}

// 새 게임·불러오기: 예전 저장에도 새 상태를 채운다
function initOfficer() {
  G.rel ||= {}; G.oath ||= {}; G.tasks ||= []; G.strat ||= {};
  for (const u of Object.values(G.units)) if (!u.iron) { perOf(u); if (u.feud == null) u.feud = 0; if (u.stageSeen == null && u.id !== G.player) u.stageSeen = STAGE_RANK[relStage(u.bond - u.feud, u.sworn)]; }
  const p = P(); p.fame ||= {}; p.fameT ||= {};
  for (const f of Object.values(G.factions)) if (f.alive && !f.iron && f.lord !== G.player && !G.strat[f.key]) aiStrat(f);
}

// ── 이동: 지도 어디든 길을 따라 간다 (멀면 여러 달에 걸쳐) ──
// 한 구간마다 행동력 15, 출발할 때 15를 더 쓴다. 행동력이 모자라면 남은 길은 다음 달 초에 이어 간다 (p.trip)
const MOVE_HOP = 15, MOVE_START = 15;
// 길 찾기: 철충 거점은 지나갈 수 없다 (도착지도 불가)
function routeTo(from, to) {
  const ok = (n) => { const c = C(n); return c && !(c.owner && F(c.owner).iron); };
  if (from === to || !ok(to)) return null;
  const prev = { [from]: null }; const q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const n of neighbors(cur)) if (!(n in prev) && ok(n)) { prev[n] = cur; q.push(n); }
  }
  if (!(to in prev)) return null;
  const path = []; for (let n = to; n !== from; n = prev[n]) path.unshift(n);
  return path;
}
const moveCost = (path) => (path ? MOVE_START + path.length * MOVE_HOP : 0);
function moveStep(next) {
  const p = P(); const from = C(p.city); const dest = C(next);
  if (from.gov === p.id && !isLord(p)) { G.flags.noGov = true; from.gov = null; assignGov(from); G.flags.noGov = false; }
  if (from.gov === p.id && isLord(p)) { from.gov = null; assignGov(from); }
  p.city = next;
  if (p.fac && isLord(p) && dest.owner === p.fac) dest.gov = p.id;
}
// 갈 수 있는 만큼 간다. 반환: 이번에 지난 구간 수
function walk(path, startCost) {
  let n = 0;
  while (path.length && G.ap >= MOVE_HOP + (n === 0 ? startCost : 0)) { G.ap -= MOVE_HOP + (n === 0 ? startCost : 0); moveStep(path.shift()); n++; }
  return n;
}
function actTravel(to) {
  const p = P();
  const path = routeTo(p.city, to);
  if (!path) return notify("이동 불가", C(to) && C(to).owner && F(C(to).owner).iron ? "철충의 거점으로는 갈 수 없다." : "그곳으로 가는 길이 없다. (철충 거점은 지나갈 수 없다)");
  if (G.ap < MOVE_START + MOVE_HOP) return notify("행동력 부족", `출발하려면 행동력 ${MOVE_START + MOVE_HOP}이 필요하다. (남음 ${G.ap})`);
  const t = playerTask();
  if (t && t.city === p.city) { if (t.doers[0] === p.id) G.tasks.splice(G.tasks.indexOf(t), 1); else t.doers = t.doers.filter((x) => x !== p.id); log(`거점을 떠나 임무 「${taskName(t)}」를 그만두었다.`, "bad"); }
  const total = path.length; const from = p.city;
  const n = walk(path, MOVE_START);
  p.trip = path.length ? { to, path } : null;
  if (p.trip) { log(`${from}에서 ${jo(to, "으로")} 출발 — ${n}/${total}구간 지나 ${p.city}에 머문다. 남은 길은 다음 달에 이어 간다.`); G.toast = { text: `${to}까지 남은 ${path.length}구간 — 다음 달 계속`, kind: "" }; }
  else { log(`${jo(to, "으로")} 이동했다.${total > 1 ? ` (${total}구간)` : ""}`); if (p.fac && C(to).owner && C(to).owner !== p.fac) log(`${jo(to, "은는")} 다른 세력의 거점이다. 방문·교류·탐방은 할 수 있지만 내정은 할 수 없다.`, "sys"); }
}
// 다음 달 초: 이어 가던 길을 계속 간다
function continueTrip() {
  const p = P(); if (!p.trip) return;
  const path = p.trip.path.filter(Boolean);
  if (!path.every((n) => !(C(n).owner && F(C(n).owner).iron))) { log(`${jo(p.trip.to, "으로")} 가는 길이 철충에 막혀 멈췄다. (${p.city})`, "bad"); p.trip = null; return; }
  walk(path, 0);
  if (path.length) { p.trip.path = path; log(`${jo(p.trip.to, "으로")} 가는 중 — ${p.city}, 남은 ${path.length}구간`); }
  else { log(`${p.trip.to}에 도착했다.`, "good"); p.trip = null; }
}
function cancelTrip() { const p = P(); if (p.trip) { log(`${jo(p.trip.to, "으로")} 가던 길을 멈췄다. (${p.city})`); p.trip = null; } }

// ── 개인 이벤트 (삼국지 13식) ───────────────
// 매달 초 하나까지. 큐 항목 {type:"oev", key, a, b, c, k, n, title, text, who, yes, no}
// 선택은 UI가 받아 oevApply(e, 수락, 승패)로 반영한다
const matesOf = (p) => unitsIn(p.city).filter((u) => u.id !== p.id && !u.iron && u.alive && !u.missing);
const DISASTER = {
  plague: { ko: "역병", d: "병사와 백성이 쓰러진다. (병력 -10% · 치안 -8)", hit: (c, k) => { const t = Math.round(c.troops * 0.1 * k), o = Math.round(8 * k); c.troops -= t; c.order = clamp(c.order - o, 0, 100); return `병력 -${t.toLocaleString()} · 치안 -${o}`; } },
  locust: { ko: "메뚜기 떼", d: "들판이 쓸려 나간다. (식량 -25% · 농업 -10%)", hit: (c, k) => { const f = Math.round(c.food * 0.25 * k), a = Math.round(c.agri * 0.1 * k); c.food -= f; c.agri -= a; return `식량 -${f.toLocaleString()} · 농업 -${a}`; } },
  flood: { ko: "홍수", d: "강이 넘쳐 성벽과 농지가 잠긴다. (방어 -15% · 농업 -8%)", hit: (c, k) => { const d = Math.round(c.def * 0.15 * k), a = Math.round(c.agri * 0.08 * k); c.def -= d; c.agri -= a; return `방어 -${d} · 농업 -${a}`; } },
};
const reliefCost = (p, c) => (p.fac === c.owner && (isGov(p) || isLord(p)) ? 300 : 150);
const OEV = {
  // 연회 초대: 친한 장수가 술자리에 부른다
  banquet: { w: 3,
    cond: (p) => { const u = pick(matesOf(p).filter((u) => u.bond >= 25 && relOf(p.id, u.id) > 0)); return u ? { a: u.id } : null; },
    make: (p, e) => ({ title: "연회 초대", who: e.a, text: `${U(e.a).name}: "오늘 밤 조촐하게 한잔하려는데, 같이 할래?"\n\n참석하면 행동력 15 · 친밀이 오르고 다른 손님과도 안면을 튼다.`, yes: "참석한다", no: "사양한다" }),
    apply: (p, e, ok) => {
      const u = U(e.a);
      if (!ok) { addRel(p.id, u.id, -2); return `${u.name}의 초대를 사양했다. 친밀 -2`; }
      G.ap = Math.max(0, G.ap - 15); const g = rnd(5, 8); addRel(p.id, u.id, g); p.hp = clamp(p.hp + 5, 0, 100);
      const o = pick(matesOf(p).filter((x) => x.id !== u.id)); if (o) addRel(p.id, o.id, 3);
      return `${u.name}의 연회에 참석했다. 친밀 +${g}${o ? ` · ${o.name} 친밀 +3` : ""} · 체력 +5`;
    } },
  // 부탁: 아는 장수가 자금을 빌려 달라고 한다
  favor: { w: 3,
    cond: (p) => { const u = pick(matesOf(p).filter((u) => u.bond >= 15)); const n = rnd(10, 20) * 10; return u && p.gold >= n ? { a: u.id, n } : null; },
    make: (p, e) => ({ title: "부탁", who: e.a, text: `${U(e.a).name}: "${pick(["부대 보급이 끊겨서… 이번 한 번만 도와줄 수 있을까?", "고장 난 장비를 고칠 돈이 모자라. 꼭 갚을게.", "후배들 먹일 식량값이 조금 모자라서…"])}"\n\n자금 ${e.n}을 건네면 친밀이 크게 오른다.`, yes: `자금 ${e.n}을 건넨다`, no: "거절한다" }),
    apply: (p, e, ok) => {
      const u = U(e.a);
      if (!ok || p.gold < e.n) { addRel(p.id, u.id, -3); return `${u.name}의 부탁을 거절했다. 친밀 -3`; }
      p.gold -= e.n; const g = rnd(8, 12); addRel(p.id, u.id, g); if (u.fac && u.fac === p.fac) u.loyal = clamp(u.loyal + 5, 0, 100);
      return `${u.name}에게 자금 ${e.n}을 건넸다. 친밀 +${g}`;
    } },
  // 인재 추천: 친구가 아는 재야 인재를 소개한다
  recommend: { w: 2,
    cond: (p) => {
      const f = pick(matesOf(p).filter((u) => relOf(p.id, u.id) >= 50)); if (!f) return null;
      const t = pick(Object.values(G.units).filter((u) => u.alive && !u.missing && !u.fac && !u.iron && u.id !== p.id && !u.met && u.city !== p.city && (routeTo(p.city, u.city) || [0, 0, 0, 0]).length <= 3));
      return t ? { a: f.id, b: t.id } : null;
    },
    make: (p, e) => ({ title: "인재 추천", who: e.a, text: `${U(e.a).name}: "${U(e.b).city}에 ${jo(U(e.b).name, "이가")} 있는데, 한번 만나 볼래? 내가 소개해 줄게."\n\n${STAT_LINE(U(e.b))}`, yes: "만나 본다", no: "다음에" }),
    apply: (p, e, ok) => {
      const t = U(e.b);
      if (!ok) return `${jo(t.name, "와과")}의 만남을 미뤘다.`;
      t.city = p.city; t.met = true; addRel(p.id, t.id, 10); addRel(e.a, t.id, 5);
      return `${jo(t.name, "이가")} ${jo(p.city, "으로")} 찾아왔다. 친밀 +10${p.fac ? " — 지금 등용을 시도해 볼 수 있다" : ""}`;
    } },
  // 일기토 신청: 무용을 겨루자는 장수
  duel: { w: 2,
    cond: (p) => { const u = pick(matesOf(p).filter((u) => ["용맹", "대담"].includes(perOf(u).type) && u.st.war >= 70 && relOf(p.id, u.id) > -40)); return u && p.hp >= 40 ? { a: u.id } : null; },
    make: (p, e) => ({ title: "일기토 신청", who: e.a, text: `${U(e.a).name}: "소문은 들었어. 네 실력, 직접 확인해 보고 싶은데?"\n\n(상대 무력 ${U(e.a).st.war} · 내 무력 ${p.st.war}) 이기면 무력 경험·명성, 지면 체력 -20.`, yes: "받아들인다", no: "사양한다", duel: true }),
    apply: (p, e, ok, won) => {
      const u = U(e.a);
      if (!ok) { addRel(p.id, u.id, -2); return `${u.name}의 도전을 사양했다.`; }
      if (won) { gainExp(p, "war", 40); addMerit(p, 30); addRel(p.id, u.id, 6); fameAdd("무관"); return `일기토 승리! 무력 경험 +40 · 명성 +30 · ${u.name} 친밀 +6`; }
      p.hp = clamp(p.hp - 20, 0, 100); gainExp(p, "war", 15); addRel(p.id, u.id, 3);
      return `일기토 패배… 체력 -20 · 무력 경험 +15 · ${u.name} 친밀 +3`;
    } },
  // 설전 신청: 논리를 겨루자는 장수
  debate: { w: 2,
    cond: (p) => { const u = pick(matesOf(p).filter((u) => ["냉정", "신중"].includes(perOf(u).type) && u.st.int >= 70 && relOf(p.id, u.id) > -40)); return u ? { a: u.id } : null; },
    make: (p, e) => ({ title: "설전 신청", who: e.a, text: `${U(e.a).name}: "요즘 정세에 대해 네 생각을 듣고 싶어. 반론은 각오해 둬."\n\n(상대 지력 ${U(e.a).st.int} · 내 지력 ${p.st.int}) 이기면 지력 경험·위명.`, yes: "응한다", no: "사양한다", debate: true }),
    apply: (p, e, ok, won) => {
      const u = U(e.a);
      if (!ok) { addRel(p.id, u.id, -2); return `${u.name}의 설전을 사양했다.`; }
      if (won) { gainExp(p, "int", 40); addMerit(p, 30); addRel(p.id, u.id, 5); fameAdd("군사"); return `설전 승리! 지력 경험 +40 · 명성 +30 · ${u.name} 친밀 +5`; }
      gainExp(p, "int", 15); addRel(p.id, u.id, 2);
      return `설전 패배… 지력 경험 +15 · ${u.name} 친밀 +2`;
    } },
  // 이적 권유: 다른 세력이 나를 데려가려 한다
  headhunt: { w: 1,
    cond: (p) => {
      if (!p.fac || isLord(p) || isGov(p) || p.merit < 600 || G.year < 2) return null;
      const f = Object.values(G.factions).filter((f) => f.alive && !f.iron && f.key !== p.fac && citiesOf(f.key).length >= 2).sort((a, b) => relOf(p.id, b.lord) - relOf(p.id, a.lord))[0];
      if (!f || relOf(p.id, f.lord) < -20) return null;
      const dest = citiesOf(f.key).map((c) => ({ c: c.name, r: routeTo(p.city, c.name) })).filter((x) => x.r).sort((a, b) => a.r.length - b.r.length)[0];
      return dest ? { a: f.lord, c: dest.c, k: f.key } : null;
    },
    make: (p, e) => ({ title: "이적 권유", who: e.a, text: `${F(e.k).name}의 밀사가 찾아왔다.\n${U(e.a).name}: "${F(p.fac).name}에서는 그대의 재능이 아깝다. 우리에게 오지 않겠나?"\n\n수락하면 ${F(e.k).name}의 장수로서 ${e.c}에 부임한다. (원래 군주와의 관계 -20)`, yes: "받아들인다", no: "의리를 지킨다" }),
    apply: (p, e, ok) => {
      const old = F(p.fac); const ol = U(old.lord);
      if (!ok) { addRel(p.id, ol.id, 4); addMerit(p, 15); return `${F(e.k).name}의 권유를 거절했다. 공적 +15 · ${ol.name} 친밀 +4`; }
      const f = F(e.k); if (!f || !f.alive || C(e.c).owner !== f.key) return "밀사가 돌아간 사이 사정이 바뀌어 이야기가 흐지부지되었다.";
      const c = C(p.city); if (c.gov === p.id) { c.gov = null; assignGov(c); }
      addRel(p.id, ol.id, -20); p.fac = f.key; p.city = e.c; p.loyal = 70; p.dudok = null; p.trip = null;
      G.tasks = (G.tasks || []).filter((t) => !t.doers.includes(p.id) && t.issuer !== p.id); G.mission = null; offerMissions();
      addRel(p.id, f.lord, 10); chron(`${old.name}에서 ${jo(f.name, "으로")} 이적`);
      return `${jo(old.name, "을를")} 떠나 ${f.name}의 장수가 되었다. ${e.c}에 부임했다.`;
    } },
  // 독립 권유: 군주와 사이가 나쁜 태수에게 측근이 거병을 권한다
  rebel: { w: 2,
    cond: (p) => {
      if (!isGov(p) || isLord(p) || p.merit < 1500 || relOf(p.id, F(p.fac).lord) >= 40) return null;
      const u = pick(matesOf(p).filter((u) => u.fac === p.fac && relOf(p.id, u.id) >= 30 && !isLord(u))); return u ? { a: u.id } : null;
    },
    make: (p, e) => ({ title: "독립 권유", who: e.a, text: `${U(e.a).name}: "${U(F(p.fac).lord).name}은 당신을 알아주지 않아요. 이 성의 주인은 이미 당신이에요… 독립하세요. 저는 따르겠어요."\n\n수락하면 ${p.city}에서 독립한다 (행동력 40).`, yes: "독립한다", no: "아직은 때가 아니다" }),
    apply: (p, e, ok) => {
      const u = U(e.a); const lord = U(F(p.fac).lord);
      if (!ok) { addRel(p.id, lord.id, 5); addMerit(p, 10); return `독립 권유를 물리쳤다. ${lord.name} 친밀 +5`; }
      if (G.ap < COST.rise) G.ap = COST.rise;
      addRel(p.id, u.id, 10); actIndependence();
      return isLord(p) ? `${u.name}의 권유로 독립했다.` : "독립하지 못했다.";
    } },
  // 재해: 지금 있는 세력 거점에 역병·메뚜기·홍수가 닥친다 (구휼로 피해를 줄인다)
  disaster: { w: 2,
    cond: (p) => { const c = C(p.city); if (!c.owner || F(c.owner).iron) return null; return { c: c.name, k: pick(Object.keys(DISASTER)) }; },
    make: (p, e) => {
      const c = C(e.c); const D = DISASTER[e.k]; const cost = reliefCost(p, c); const own = cost === 300;
      return { title: D.ko, who: c.gov, text: `${e.c}에 ${jo(D.ko, "이가")} 닥쳤다!\n${D.d}\n\n${own ? "거점" : "개인"} 자금 ${cost}으로 구휼하면 피해가 절반으로 줄고 치안 +5 · 명성 +40.`, yes: `구휼한다 (${cost})`, no: "어쩔 수 없다" };
    },
    apply: (p, e, ok) => {
      const c = C(e.c); const D = DISASTER[e.k]; const cost = reliefCost(p, c); const own = cost === 300;
      const pay = ok && (own ? c.gold >= cost : p.gold >= cost);
      if (pay) { if (own) c.gold -= cost; else p.gold -= cost; }
      const r = D.hit(c, pay ? 0.5 : 1);
      if (pay) { c.order = clamp(c.order + 5, 0, 100); addMerit(p, 40); fameAdd(own ? "문관" : "협객"); if (c.gov && c.gov !== p.id) addRel(p.id, c.gov, 5); return `구휼했다 — 피해 절반: ${r} · 치안 +5 · 명성 +40`; }
      return `${r}${ok ? " (자금이 모자라 구휼하지 못했다)" : ""}`;
    } },
  // 군주 전용: 신하의 청원
  petition: { w: 2,
    cond: (p) => { if (!isLord(p)) return null; const u = pick(officersOf(p.fac).filter((u) => u.id !== p.id && isGov(u))); const cap = C(capitalOf(p.fac)); return u && cap && cap.gold >= 300 ? { a: u.id, c: u.city } : null; },
    make: (p, e) => ({ title: "신하의 청원", who: e.a, text: `${U(e.a).name}: "${e.c}의 ${pick(["농지 정비", "시장 재건", "방벽 보강"])}에 자금이 필요합니다. 300만 내려 주십시오."\n\n본거지 자금 300 → ${e.c} 개발 · 충성 +5. 거절하면 충성 -3.`, yes: "허락한다", no: "거절한다" }),
    apply: (p, e, ok) => {
      const u = U(e.a); const c = C(e.c); const cap = C(capitalOf(p.fac));
      if (!ok || !cap || cap.gold < 300 || c.owner !== p.fac) { u.loyal = clamp(u.loyal - 3, 0, 100); return `${u.name}의 청원을 물리쳤다. 충성 -3`; }
      cap.gold -= 300; const mx = cityMax(c); const k = pick(["agri", "comm", "def"]); const g = Math.round(60 + u.st.pol * 0.6); const b0 = c[k]; c[k] = Math.min(mx[k], c[k] + g);
      u.loyal = clamp(u.loyal + 5, 0, 100); addRel(p.id, u.id, 3);
      return `${e.c} ${{ agri: "농업", comm: "상업", def: "방어" }[k]} +${c[k] - b0} · ${u.name} 충성 +5`;
    } },
};
// 매달 초 개인 이벤트 하나 (35%, 이야기 장면이 있는 달은 쉼), 12월에는 논공행상
function officerEvents() {
  const p = P(); if (!p.alive || G.over) return;
  if (G.month === 12 && p.fac && !isLord(p)) yearAward(p);
  // 이야기 장면·중요한 선택이 있는 달에는 쉰다
  if (G.queue.some((x) => ["routeChoice", "facChoice", "surrender", "ending", "captured"].includes(x.type) || (x.type === "dialog" && x.bg && !x.cast && !x.bgUrl && !x.squad))) return;
  if (!chance(35)) return;
  const cands = [];
  for (const [key, ev] of Object.entries(OEV)) { if ((G.flags["oev_" + key] || 0) > monthIdx()) continue; const ctx = ev.cond(p); if (ctx) cands.push({ key, ctx, w: ev.w }); }
  if (!cands.length) return;
  let r = Math.random() * cands.reduce((s, x) => s + x.w, 0); let sel = cands[0];
  for (const x of cands) { r -= x.w; if (r <= 0) { sel = x; break; } }
  G.flags["oev_" + sel.key] = monthIdx() + 4; // 같은 이벤트는 4개월 쉰다
  const e = { type: "oev", key: sel.key, ...sel.ctx }; Object.assign(e, OEV[sel.key].make(p, e));
  G.queue.push(e);
}
function oevApply(e, ok, won) {
  const ev = OEV[e.key]; if (!ev) return "";
  const r = ev.apply(P(), e, ok, won);
  if (r) log(`${e.title} — ${r}`, ok ? "good" : "");
  return r;
}
// 논공행상: 12월, 세력 내 공적 순위에 따라 군주가 상을 내린다
function yearAward(p) {
  const lord = U(F(p.fac).lord);
  const os = officersOf(p.fac).filter((u) => !isLord(u)).sort((a, b) => b.merit - a.merit);
  const rank = os.findIndex((u) => u.id === p.id) + 1;
  const top = rank > 0 && rank <= Math.max(1, Math.ceil(os.length * 0.2));
  const gold = top ? 300 : 120;
  p.gold += gold; addRel(p.id, lord.id, top ? 5 : 2);
  if (top && typeof randItem === "function" && chance(50)) gainItem(randItem([10, 50, 35, 5]), "논공행상");
  notify("논공행상", `${G.year}년을 마무리하며 ${jo(lord.name, "이가")} 공을 따졌다.\n\n세력 내 공적 ${rank}위 / ${os.length}명${top ? " — 으뜸가는 공신으로 꼽혔다!" : ""}\n상금 ${gold} · ${lord.name} 친밀 +${top ? 5 : 2}`, lord.id, top ? "PresentGet" : "ActionApprove", top ? "rankup" : "coin");
  log(`논공행상 — 공적 ${rank}위, 상금 ${gold}`, "good");
}
