// 이벤트 흐름 리포트: 120개월 동안 월별 VN(대화) 수·세력 행사 분기·대기 이벤트를 집계한다. 반복형 VN 예산(월 2편) 위반을 검사한다.
// 사용: node tools/event_sim.js [회수=20] [시드=1]  (시드 고정 — 같은 인자면 같은 결과)
const fs = require("fs"), path = require("path");
global.localStorage = { getItem() { return null; }, setItem() {} };
const dir = path.join(__dirname, "..", "js");
const src = ["lao_official", "data", "city_bg", "equip_data", "skills_data", "lines_data", "lines_peer", "game", "equip", "events", "battle"].map((f) => fs.readFileSync(path.join(dir, f + ".js"), "utf8")).join("\n");
const N = +(process.argv[2] || 20); let seed = +(process.argv[3] || 1);
Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; // LCG
const run = new Function("who", src + `;
newGame(who, { diff: 1 }); const dist = {}, kinds = {}; let over = 0, pend = 0, story = 0, total = 0, maxAll = 0;
for (let m = 0; m < 120; m++) { endMonth();
  const dl = G.queue.filter((e) => e.type === "dialog");
  const isStory = (e) => e.bg && !e.cast && !e.bgUrl && !e.squad; // 스토리 이벤트(예산 제외)
  const rep = dl.filter((e) => !isStory(e)).length + G.queue.filter((e) => e.type === "facChoice").length; // 세력 행사 결과 VN 포함
  dist[dl.length] = (dist[dl.length] || 0) + 1; total += dl.length; story += dl.filter(isStory).length;
  if (rep > 2) over++; maxAll = Math.max(maxAll, dl.length);
  for (const e of G.queue) if (e.type === "facChoice") kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  pend += G.flags.pendingEv || 0;
  // 선택은 무작위로 적용
  for (const e of G.queue) if (e.type === "facChoice" && P().fac) facChoiceApply(e.kind, Math.random() < 0.5);
  G.queue.length = 0; G.over = false; }
return { dist, kinds, over, pend, story, total, maxAll, lord: isLord(P()) };`);
const pool = ["BR_Marie", "3P_Alice", "BR_Brownie", "PECS_Fortune", "BR_Amy", "DS_Atalanta", "3P_Labiata", "BR_Leona", "PECS_Empress", "BR_Tomoe"];
let fail = 0, storyMin = 99, maxAll = 0; const all = { dist: {}, kinds: {} };
for (let i = 0; i < N; i++) {
  const r = run(pool[i % pool.length]); fail += r.over; storyMin = Math.min(storyMin, r.story); maxAll = Math.max(maxAll, r.maxAll);
  for (const k in r.dist) all.dist[k] = (all.dist[k] || 0) + r.dist[k];
  for (const k in r.kinds) all.kinds[k] = (all.kinds[k] || 0) + r.kinds[k];
  console.log(`${pool[i % pool.length]}${r.lord ? "(군주)" : ""}: VN ${r.total}편(스토리 ${r.story}) · 예산 초과 달 ${r.over} · 미뤄진 이벤트 누계 ${r.pend}`);
}
const kTot = Object.values(all.kinds).reduce((a, b) => a + b, 0) || 1, kMax = Math.max(...Object.values(all.kinds)) / kTot;
console.log("월별 VN 수 분포(전체)", all.dist, "· 세력 행사 분기", all.kinds, `최대 비중 ${(kMax * 100).toFixed(0)}%`);
const bad = [];
if (fail) bad.push(`반복형 VN 예산 초과 ${fail}달`);
if (storyMin < 9) bad.push(`스토리 VN 최소 ${storyMin}편 (기준 9)`);
if (kMax > 0.5) bad.push(`세력 행사 분기 쏠림 ${(kMax * 100).toFixed(0)}%`);
console.log(`반복형 예산 ${fail ? "초과" : "준수"} · 전체 최대 ${maxAll}편/월 · 스토리 최소 ${storyMin}편`);
console.log(bad.length ? "회귀 기준 위반: " + bad.join(", ") : "회귀 기준 통과");
process.exitCode = bad.length ? 1 : 0;
