// 야전 밸런스 시뮬레이터: 화면 없이 Field 로직만 돌려 전투 시간·승패·잔존 병력·무장기 사용을 집계한다
// 사용: node tools/field_sim.js [회수=20] [시드=7] [옵션,옵션]   (양측 모두 AI. 진형은 고정 순환)
//   counter / weak : 공격측이 늘 상성 우위 / 열세 진형으로 시작
//   fixed          : AI의 전투 중 진형 변경을 끈다 (나쁜 진형 선택의 대가를 그대로 잰다)
//   mirror         : 수비측을 공격측과 똑같은 부대로 바꾸고 수비병·성 방어를 없앤다 (진영 편향·시간 초과 측정)
const fs = require("fs"), path = require("path");
global.localStorage = { getItem() { return null; }, setItem() {} };
const dir = path.join(__dirname, "..", "js");
const src = ["lao_official", "data", "city_bg", "equip_data", "skills_data", "lines_data", "lines_peer", "game", "equip", "events", "battle", "field"].map((f) => fs.readFileSync(path.join(dir, f + ".js"), "utf8")).join("\n");
const N = +(process.argv[2] || 20); let seed = +(process.argv[3] || 7); const POLICY = process.argv[4] || "";
Math.random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; // LCG (같은 인자 = 같은 결과)
const run = new Function("seedIdx", "POLICY", src + `;
// 화면·사운드 대역
var Sound = { voice() {}, sfx() {}, bgm() {}, charSfx() {}, stopBgm() {} };
var UI = { banner() {}, cutin: () => Promise.resolve() };
FUI.stage = null; FUI.log = () => {}; FUI.pop = () => {}; FUI.flash = () => {}; FUI.shake = () => {}; FUI.toast = () => {}; FUI.skName = () => {};

const keys = Object.keys(FORMS);
newGame(["BR_Marie", "3P_Labiata", "BR_Leona", "PECS_Empress", "3P_Alice"][seedIdx % 5], {});
const p = P();
const to = neighbors(p.city).map(C).find((c) => c.owner && c.owner !== p.fac) || neighbors(p.city).map(C)[0];
const atk = unitsIn(p.city).filter((u) => u.fac === p.fac).slice(0, 4).map((u) => ({ u, troops: Math.min(maxTroops(u), 4000) }));
const war = prepareBattle({ atkFac: p.fac, from: p.city, to: to.name, atk });
const OPT = POLICY.split(",");
if (OPT.includes("mirror")) { war.def = war.atk.map((x) => ({ u: x.u, troops: x.troops })); war.militia = 0; war.cityDef = 0; }
const F_ = Field;
F_.sim = true;
F_.setup({ war, playerSide: "def", commander: false });
F_.ctrl = () => false; F_.autoSkill = true;
if (OPT.includes("fixed")) F_.formAI = { atk: true, def: true };
const dk = keys[(seedIdx * 5 + 1) % keys.length]; F_.form = { atk: OPT.includes("counter") ? formWinner(dk) : OPT.includes("weak") ? formLoser(dk) : keys[seedIdx % keys.length], def: dk };
let result = null;
F_.finish = (win, why) => { if (!result) result = { win, why, t: F_.t }; F_.finished = true; };
F_.build();
let casts = 0; const cast0 = F_.cast.bind(F_); F_.cast = (g, i, m) => { const ok = cast0(g, i, m); if (ok) casts++; return ok; };
const live = () => F_.groups.reduce((a, g) => a + g.soldiers.filter((s) => s.alive).length, 0), n0 = live(); let half = null, ninety = null;
for (let i = 0; i < 20000 && !F_.finished; i++) { F_.step(0.05); const l = live(); if (half == null && l <= n0 * 0.5) half = F_.t; if (ninety == null && l <= n0 * 0.1) ninety = F_.t; }
const sum = (arr) => arr.filter((b) => !b.out).reduce((s, b) => s + b.troops, 0);
const fled = F_.groups.reduce((a, g) => a + g.soldiers.filter((s) => s.gone).length, 0), total = F_.groups.reduce((a, g) => a + g.n0, 0);
return { win: result ? result.win : null, why: result ? result.why : "timeout", t: Math.round(result ? result.t : F_.t), atkStart: F_.units.atk.reduce((s, b) => s + b.max, 0), defStart: F_.units.def.reduce((s, b) => s + b.max, 0), atkLeft: sum(F_.units.atk), defLeft: sum(F_.units.def), forms: F_.form.atk + "/" + F_.form.def, casts, fled, total, half: Math.round(half == null ? F_.t : half), ninety: Math.round(ninety == null ? F_.t : ninety), timeout: !!(result && /제한 시간/.test(result.why)) };`);
const R = []; for (let i = 0; i < N; i++) R.push(run(i, POLICY));
for (const r of R) console.log(`${r.win ? "공격 승" : "수비 승"} ${String(r.t).padStart(4)}초 · ${r.forms.padEnd(13)} 공격 ${r.atkLeft}/${r.atkStart} · 수비 ${r.defLeft}/${r.defStart} · 무장기 ${r.casts} · 탈주 ${r.fled}/${r.total} · ${r.why}`);
const ts = R.map((r) => r.t).sort((a, b) => a - b), med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`전투 시간 중앙값 ${ts[Math.floor(ts.length / 2)]}초 (최소 ${ts[0]} · 최대 ${ts[ts.length - 1]}) · 공격 승률 ${Math.round(R.filter((r) => r.win).length / R.length * 100)}% · 무장기 중앙값 ${med(R.map((r) => r.casts))}회 · 탈주 비율 ${Math.round(R.reduce((a, r) => a + r.fled, 0) / R.reduce((a, r) => a + r.total, 0) * 100)}%`);
console.log(`병사 50% 전사 중앙값 ${med(R.map((r) => r.half))}초 · 90% 전사 중앙값 ${med(R.map((r) => r.ninety))}초 · 시간 초과 ${R.filter((r) => r.timeout).length}/${R.length}판`);
