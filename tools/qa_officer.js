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
// ── 8) 저장/불러오기에 새 상태가 남는다
G.tasks.push({ id: 999, kind: "agri", fac: "steel", issuer: F("steel").lord, doers: [doers[0] ? doers[0].id : a.id], city: city.name, need: 120, prog: 33, start: 0, reward: 100, origin: "issue" });
const snap = { rel: JSON.stringify(G.rel), fame: JSON.stringify(p.fame), strat: JSON.stringify(G.strat), per: JSON.stringify(a.per), follow: free.follow };
ok(saveGame(), "저장");
G.rel = {}; G.tasks = []; p.fame = {};
ok(loadGame(), "불러오기");
ok(JSON.stringify(G.rel) === snap.rel && JSON.stringify(P().fame) === snap.fame && JSON.stringify(G.strat) === snap.strat && JSON.stringify(U(a.id).per) === snap.per && U(free.id).follow === snap.follow && G.tasks.some((t) => t.id === 999 && t.prog === 33), "관계·위명·평정·성격·임무가 저장에 포함");
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
ok(W.alive.every((n) => n >= 2 && n <= 8), "10년차 생존 세력 " + W.alive.join("/"));
return W;`);
let W;
try { W = T((cond, name) => { console.log(`${cond ? "OK  " : "FAIL"} ${name}`); if (!cond) fails.push(name); }); }
catch (e) { console.log("FAIL 예외: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e)); fails.push("예외"); }
if (W) console.log(`세계 120개월×3판 — 이적 ${W.moves} · NPC 독립 세력 ${W.indep} · 장수끼리 의자매 ${W.oath}`);
console.log(fails.length ? `장수제 검사 실패 ${fails.length}건` : "장수제 검사 문제 없음");
process.exitCode = fails.length ? 1 : 0;
