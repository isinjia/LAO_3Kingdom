// 장기 밸런스 리포트: 플레이어를 방치한 채 N회 × 120개월을 돌려 세력 수렴을 측정한다
// 사용: node tools/balance_sim.js [회수=8] [난이도 0/1/2=1]
const fs = require("fs"), path = require("path");
global.localStorage = { getItem() { return null; }, setItem() {} };
const dir = path.join(__dirname, "..", "js");
const src = ["lao_official", "data", "city_bg", "equip_data", "skills_data", "lines_data", "game", "equip", "events", "battle"].map((f) => fs.readFileSync(path.join(dir, f + ".js"), "utf8")).join("\n");
const N = +(process.argv[2] || 8), diff = +(process.argv[3] || 1);
const run = new Function("who", "diff", src + `;
newGame(who, { diff }); let warn = 0, rival = 0, battles = 0; const top = [];
for (let m = 0; m < 120; m++) { endMonth();
  for (const e of G.queue) { if (e.title === "통일 위협") warn = warn || G.year; if (e.type === "ending" && e.rival) rival = rival || G.year; if (e.type === "battle") battles++; }
  G.queue.length = 0; G.over = false;
  if (m % 12 === 11) { const cnt = {}; for (const c of Object.values(G.cities)) if (c.owner) cnt[c.owner] = (cnt[c.owner] || 0) + 1; top.push(Math.max(...Object.values(cnt))); } }
return { top, alive: Object.values(G.factions).filter((f) => f.alive).length, warn, rival, battles };`);
const pool = ["BR_Tomoe", "3P_Alice", "BR_Brownie", "PECS_Fortune", "BR_Amy", "DS_Atalanta", "BR_Raven", "3P_Aqua", "BR_Nymph", "PECS_Sunny"];
const R = []; for (let i = 0; i < N; i++) R.push(run(pool[i % pool.length], diff));
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`난이도 ${diff} · ${N}회 · 120개월 (플레이어 방치)`);
console.log("10년차 생존 세력 평균", avg(R.map((r) => r.alive)), "· 최대 세력 거점 평균", avg(R.map((r) => r.top[9])));
console.log("통일 위협 경고율", (R.filter((r) => r.warn).length / N * 100).toFixed(0) + "%", "· AI 통일 패배율", (R.filter((r) => r.rival).length / N * 100).toFixed(0) + "%");
console.log("징집·방어 전투(플레이어 참여) 평균", avg(R.map((r) => r.battles)), "회");
