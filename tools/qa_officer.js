// 장수제 확장 검사: 신분·권한, 인간관계, 임무 작업, 평정, 위명, 장수 자율 행동, 저장/불러오기
// 사용: node tools/qa_officer.js   (실패하면 종료 코드 1)
const fs = require("fs"), path = require("path");
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const dir = path.join(__dirname, "..", "js");
const src = ["lao_official", "data", "city_bg", "equip_data", "skills_data", "lines_data", "lines_peer", "game", "officer", "equip", "events", "battle"].map((f) => fs.readFileSync(path.join(dir, f + ".js"), "utf8")).join("\n");
const fails = [];
const T = new Function("ok", src + `;
// ── 1) 새 게임: 성격·관계·평정 상태
newGame("BR_Tomoe", { diff: 1 });
const p = P();
ok(Object.values(G.units).filter((u) => !u.iron).every((u) => u.per && PER_TYPES.includes(u.per.type) && u.per.amb >= 0 && u.per.gi >= 0), "모든 장수에게 성격·야망·의리");
ok(G.tasks && G.rel && G.strat && Object.keys(G.strat).length > 0, "임무·관계·평정 상태 초기화");
// ── 2) 신분
p.fac = "steel"; p.city = citiesOf("steel")[0].name; p.merit = 100; C(p.city).gov = F("steel").lord;
ok(roleOf(p) === "일반", "일반 장수 신분 (" + roleOf(p) + ")");
p.merit = 1600; ok(roleOf(p) === "중신", "편장군 이상은 중신");
// ── 3) 관계: 양방향·인연 단계·적대
const others = officersOf("steel").filter((u) => u.id !== p.id && !isLord(u));
const a = others[0], b = others[1];
const r0 = relOf(a.id, b.id); addRel(a.id, b.id, 30);
ok(relOf(a.id, b.id) === relOf(b.id, a.id) && relOf(a.id, b.id) === Math.min(100, r0 + 30), "장수끼리 관계는 양방향");
a.bond = 0; addRel(p.id, a.id, 62); ok(stageWith(a.id) === "친우", "친밀 62 → 친우 (" + stageWith(a.id) + ")");
addRel(p.id, a.id, 25); ok(stageWith(a.id) === "막역지우", "친밀 87 → 막역지우");
const foe = others[2]; foe.bond = 0; addRel(p.id, foe.id, -50); ok(stageWith(foe.id) === "적대" && relOf(foe.id, p.id) === -50, "적대 관계");
const free = Object.values(G.units).find((u) => !u.fac && !u.iron && u.alive);
free.city = p.city; free.bond = 0; free.feud = 0; const rc0 = recruitChance(p, free); free.feud = 40; ok(recruitChance(p, free) < rc0, "적대하면 등용 확률 하락"); free.feud = 0;
// ── 4) 상관 발령 임무: 일 단위 진행 → 완료 시 공적·도시 수치
G.tasks = []; p.merit = 300; let got = null;
for (let i = 0; i < 12 && !got; i++) { p.city = citiesOf("steel")[0].name; endMonth(); G.queue = []; G.over = false; got = playerTask(); if (got && got.kind === "recruit") { G.tasks = []; got = null; } }
ok(!!got && got.origin === "order" && got.issuer && got.eta > got.start, "상관이 임무를 내린다 (예상 완료일 포함)");
if (got) {
  const m0 = p.merit; const c = C(got.city); const st0 = { agri: c.agri, comm: c.comm, tech: c.tech, def: c.def, order: c.order, troops: c.troops };
  let n = 0; while (G.tasks.includes(got) && n++ < 4) { p.city = got.city; endMonth(); G.queue = []; G.over = false; }
  ok(!G.tasks.includes(got) && p.merit > m0, "임무 완료 → 공적 상승 (" + m0 + " → " + p.merit + ")");
  const k = got.kind === "draft" ? "troops" : got.kind;
  ok(got.kind === "search" || C(got.city)[k] !== st0[k] || C(got.city)[k] >= (k === "order" ? 100 : cityMax(C(got.city))[k] || 0), "임무 완료 → 도시 수치 갱신 (" + got.kind + ")");
}
// ── 5) 태수: 임무 발령 + 협력 보너스
const city = citiesOf("steel")[0]; p.city = city.name; city.gov = p.id; p.merit = 1600;
ok(roleOf(p) === "태수" && jurisOf(p).includes(city.name), "태수 신분·관할");
const doers = unitsIn(city.name).filter((u) => u.fac === "steel" && u.id !== p.id && !isLord(u) && !taskBusy(u.id));
if (doers.length >= 2) {
  doers[0].loyal = 90; city.gold = 5000; G.ap = 100;
  addRel(doers[0].id, doers[1].id, 100);
  actTaskIssue("agri", doers[0].id, [doers[1].id]);
  const t = G.tasks.find((x) => x.issuer === p.id);
  ok(!!t && t.doers.length === 2 && coopBonus(t) >= 0.1, "임무 발령 · 친우 협력 보너스");
  const solo = { kind: "agri", doers: [doers[0].id], need: 120, prog: 0, start: dayNow() };
  ok(t && taskRate(t) > taskRate(solo), "협력하면 진행이 빠르다");
  const a0 = city.agri; let n = 0; while (G.tasks.includes(t) && n++ < 4) { endMonth(); G.queue = []; G.over = false; city.gov = p.id; p.city = city.name; }
  ok(!G.tasks.includes(t) && (city.agri > a0 || city.agri >= cityMax(city).agri), "발령한 임무 완료 → 농업 상승");
} else ok(false, "발령할 장수가 부족 (" + doers.length + ")");
// ── 6) 평정: 중신 의견 제시 / 군주 전략 결정
city.gov = F("steel").lord; p.merit = 1600; p.st.int = 99; p.st.pol = 99; U(F("steel").lord).bond = 100; G.flags.voiceQ = null; G.ap = 100;
actStratVoice("dev"); ok(stratOf("steel") && stratOf("steel").by === p.id && stratOf("steel").goal === "dev", "중신 의견 채택 → 세력 전략 목표");
// ── 7) 위명: 협객 경로 (재야)
actResign(); ok(roleOf(p) === "재야", "하야 → 재야");
for (let i = 0; i < 5; i++) { G.ap = 100; actChivalry(); }
ok(fameTier(p, "협객") === 1 && hasFame("협객"), "의협 활동 5회 → 위명 「협객」");
free.city = p.city; free.fac = null; free.bond = 55; G.ap = 100; actGather(free.id); ok(free.follow === p.id, "호걸 규합 → 거병 동지");
for (let i = 0; i < 7; i++) { G.ap = 100; actChivalry(); } ok(riseNeed() === 250, "위명 「호협」 → 거병 조건 250");
// 상인 경로
p.gold = 1000; const g0 = p.gold; for (let i = 0; i < 5; i++) { G.ap = 100; actTrade(); }
ok(fameTier(p, "상인") === 1 && p.gold !== g0, "교역 5회 → 위명 「상인」");
// ── 7-2) 이동: 사관 중에도 다른 세력 거점으로, 멀면 여러 달에 걸쳐
{
  p.fac = "steel"; p.city = citiesOf("steel")[0].name; p.merit = 300; p.trip = null; G.tasks = [];
  const far = Object.values(G.cities).filter((c) => c.owner && c.owner !== "steel" && !F(c.owner).iron).map((c) => ({ c, r: routeTo(p.city, c.name) })).filter((x) => x.r).sort((a, b) => b.r.length - a.r.length)[0];
  ok(!!far && far.r.length >= 3, "먼 다른 세력 거점까지 길이 있다 (" + (far ? far.r.length : 0) + "구간)");
  if (far) {
    G.ap = 100; actMove(far.c.name);
    ok(p.trip && p.trip.to === far.c.name && p.city !== citiesOf("steel")[0].name && G.ap < 30, "행동력만큼 가고 남은 길은 예약 (" + p.city + ", 남은 " + (p.trip ? p.trip.path.length : 0) + ")");
    let n = 0; while (p.trip && n++ < 6) { G.ap = 0; continueTrip(); G.ap = 100; if (p.trip) { G.ap = AP_MAX; continueTrip(); } }
    ok(!p.trip && p.city === far.c.name && p.fac === "steel", "여러 달에 걸쳐 다른 세력 거점에 도착 (사관 유지)");
  }
  const ironC = Object.values(G.cities).find((c) => c.owner === "iron");
  ok(!ironC || routeTo(p.city, ironC.name) === null, "철충 거점으로는 갈 수 없다");
  actResign();
}
// ── 8) 저장/불러오기에 새 상태가 남는다
G.tasks.push({ id: 999, kind: "agri", fac: "steel", issuer: F("steel").lord, doers: [doers[0] ? doers[0].id : a.id], city: city.name, need: 120, prog: 33, start: 0, reward: 100, origin: "issue" });
const snap = { rel: JSON.stringify(G.rel), fame: JSON.stringify(p.fame), strat: JSON.stringify(G.strat), per: JSON.stringify(a.per), follow: free.follow };
ok(saveGame(), "저장");
G.rel = {}; G.tasks = []; p.fame = {};
ok(loadGame(), "불러오기");
ok(JSON.stringify(G.rel) === snap.rel && JSON.stringify(P().fame) === snap.fame && JSON.stringify(G.strat) === snap.strat && JSON.stringify(U(a.id).per) === snap.per && U(free.id).follow === snap.follow && G.tasks.some((t) => t.id === 999 && t.prog === 33), "관계·위명·평정·성격·임무가 저장에 포함");
// ── 8-2) 개인 이벤트(삼국지 13식): 120개월 동안 나오는 이벤트를 무작위로 수락·거절해 본다
{
  const seen = {}; let award = 0, bad = 0;
  for (const who of ["BR_Tomoe", "3P_Labiata"]) {
    newGame(who, { diff: 1 }); P().gold = 3000;
    for (let m = 0; m < 120 && !G.over; m++) {
      endMonth();
      for (const e of G.queue) {
        if (e.title === "논공행상") award++;
        if (e.type !== "oev") continue;
        seen[e.key] = (seen[e.key] || 0) + 1;
        if (!e.title || !e.text || !e.yes || !e.no) bad++;
        const r = oevApply(e, Math.random() < 0.6, Math.random() < 0.5);
        if (typeof r !== "string" || !r) bad++;
      }
      G.queue = []; G.over = false; if (P().gold < 300) P().gold += 500;
    }
  }
  const kinds = Object.keys(seen);
  ok(kinds.length >= 5 && bad === 0, "개인 이벤트 " + kinds.length + "종 발생·처리 (" + kinds.map((k) => k + " " + seen[k]).join(", ") + ")");
  newGame("BR_Tomoe", { diff: 1 }); const pp = P(); pp.fac = "steel"; pp.city = citiesOf("steel")[0].name; G.month = 12; G.queue = []; const g0 = pp.gold;
  officerEvents(); const aw = G.queue.find((e) => e.title === "논공행상");
  ok(!!aw && pp.gold > g0, "12월 논공행상 → 상금 (" + (pp.gold - g0) + ")");
}
// ── 8-3) 평정 설전 · 외교 임무 · 질병·사망·후계 · 수행 · 반란 진압
{
  newGame("BR_Tomoe", { diff: 1 }); const q = P(); q.fac = "steel"; const lord = U(F("steel").lord); q.city = lord.city; q.merit = 1700; G.ap = 100; G.flags.voiceQ = null;
  const o = stratVoiceBegin(); stratVoiceEnd("arms", null, "win", o || null);
  ok(stratOf("steel") && stratOf("steel").goal === "arms" && stratOf("steel").by === q.id, "평정 설전 승리 → 의견 채택");
  G.flags.voiceQ = null; G.ap = 100; const o2 = stratVoiceBegin(); stratVoiceEnd("talent", null, "lose", o2 || null);
  ok(stratOf("steel").goal === "arms", "평정 설전 패배 → 보류");
  // 외교 임무: 성공하면 휴전
  const tgt = diploTargets("steel")[0]; const dip = officersOf("steel").find((u) => u.id !== q.id && !isLord(u));
  dip.st.pol = 99; dip.st.cha = 99; U(tgt.lord).bond = 0; G.rel[relKey(dip.id, tgt.lord)] = 200; dip.city = q.city; dip.loyal = 90;
  C(q.city).gov = q.id; F("steel").lord = q.id; // 잠시 군주로 만들어 발령
  C(q.city).gold = 9999; G.ap = 100; actTaskIssue("diplo", dip.id, [], tgt.key);
  const dt = G.tasks.find((t) => t.kind === "diplo");
  ok(!!dt && dt.fac2 === tgt.key && /친선 사절/.test(taskName(dt)), "친선 사절 임무 발령");
  let tries = 0; while (G.tasks.includes(dt) && tries++ < 4) { officerTick(); }
  ok(!G.tasks.includes(dt) && (G.truce[tgt.key] > 0 || /결렬/.test(dt.done)), "친선 사절 완료 → 휴전 또는 결렬 (" + dt.done + ")");
  F("steel").lord = lord.id; C(q.city).gov = lord.id;
  // 병문안
  const sick = officersOf("steel").find((u) => u.id !== q.id && !isLord(u)); sick.city = q.city; sick.sick = 3; sick.bond = 0; G.ap = 100;
  actVisitSick(sick.id); ok(sick.cared === monthIdx() && sick.bond >= 8, "병문안 → 친밀·간호");
  // 군주 사망 → 후계
  const lord0 = F("steel").lord; unitDies(U(lord0), "병으로");
  ok(!U(lord0).alive && F("steel").alive && F("steel").lord !== lord0 && U(F("steel").lord).alive && U(F("steel").lord).fac === "steel", "군주 사망 → 후계자 승계 (" + U(F("steel").lord).name + ")");
  // 플레이어가 후계자가 되는 경우
  const g2 = Object.values(G.factions).find((f) => f.alive && !f.iron && f.key !== "steel" && officersOf(f.key).length >= 2);
  q.fac = g2.key; q.city = U(g2.lord).city; q.merit = 99999; G.rel[relKey(q.id, g2.lord)] = 0; U(g2.lord).bond = 100;
  unitDies(U(g2.lord), "병으로"); ok(isLord(q), "공적이 가장 높으면 내가 후계자가 된다");
  // 수행
  G.ap = 80; q.gold = 500; const w0 = q.st.war * 100 + q.ex.war; actPilgrim("무예");
  ok(G.ap === 0 && q.st.war * 100 + q.ex.war > w0 && q.away === monthIdx() + 1, "수행 → 경험·다음 달 행동력 감소 예약");
  // 내 세력에서 태수가 독립하면 진압 선택
  G.queue = []; const rb = officersOf(q.fac).find((u) => u.id !== q.id && !isLord(u));
  const rc = citiesOf(q.fac).find((c) => c.name !== q.city) || citiesOf(q.fac)[0]; rb.city = rc.name; rc.gov = rb.id;
  if (rc.name !== capitalOf(q.fac)) { npcIndependence(rb); const sp = G.queue.find((e) => e.key === "suppress"); ok(!!sp && sp.yes && typeof oevApply(sp, false) === "string" && G.truce[sp.k] === 12, "반란 → 진압 선택 (인정하면 휴전)"); }
}
// ── 9) 세계가 스스로 돌아간다: 120개월 × 3판
const W = { moves: 0, indep: 0, dudok: 0, strat: 0, oath: 0, alive: [] };
for (let run = 0; run < 3; run++) {
  newGame(["3P_Alice", "BR_Brownie", "PECS_Fortune"][run] || "BR_Tomoe", { diff: 1 });
  const facOf = {}; for (const u of Object.values(G.units)) facOf[u.id] = u.fac;
  for (let m = 0; m < 120; m++) {
    endMonth(); G.queue = []; G.over = false;
    for (const u of Object.values(G.units)) { if (u.fac && facOf[u.id] && u.fac !== facOf[u.id] && !u.iron && u.alive && !isLord(u)) W.moves++; facOf[u.id] = u.fac; }
    if (Object.values(G.units).some((u) => u.dudok)) W.dudok++;
    if (Object.values(G.strat).some((s) => s.goal === "attack")) W.strat++;
  }
  W.indep += Object.keys(G.factions).filter((k) => k.startsWith("n_")).length;
  W.oath += Object.keys(G.oath).length;
  W.alive.push(Object.values(G.factions).filter((f) => f.alive).length);
}
ok(W.moves > 0, "장수 이적·투항 발생 (" + W.moves + ")");
ok(W.dudok > 0, "AI 도독 임명 (" + W.dudok + "개월)");
ok(W.strat > 0, "AI 평정 공략 목표 (" + W.strat + "개월)");
ok(W.alive.every((n) => n >= 1 && n <= 8) && W.alive.reduce((a, b) => a + b, 0) / W.alive.length >= 2, "10년차 생존 세력 " + W.alive.join("/") + " (평균 2 이상)");
return W;`);
let W;
try { W = T((cond, name) => { console.log(`${cond ? "OK  " : "FAIL"} ${name}`); if (!cond) fails.push(name); }); }
catch (e) { console.log("FAIL 예외: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e)); fails.push("예외"); }
if (W) console.log(`세계 120개월×3판 — 이적 ${W.moves} · NPC 독립 세력 ${W.indep} · 장수끼리 의자매 ${W.oath}`);
console.log(fails.length ? `장수제 검사 실패 ${fails.length}건` : "장수제 검사 문제 없음");
process.exitCode = fails.length ? 1 : 0;
