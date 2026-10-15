// 회귀 검사: 같은 실행 환경에서 야전을 두 번 연속 치렀을 때 이전 전투의 상태(총공세·총붕괴·진형 쿨다운 등)가 남지 않는지
// 사용: node tools/field_persist_test.js   (문제가 있으면 종료 코드 1)
const fs = require("fs"), path = require("path");
global.localStorage = { getItem() { return null; }, setItem() {} };
const dir = path.join(__dirname, "..", "js");
const src = ["lao_official", "data", "city_bg", "equip_data", "skills_data", "lines_data", "lines_peer", "game", "equip", "events", "battle", "field"].map((f) => fs.readFileSync(path.join(dir, f + ".js"), "utf8")).join("\n");
const out = new Function(src + `;
var Sound = { voice() {}, sfx() {}, bgm() {}, charSfx() {}, stopBgm() {} };
var UI = { banner() {}, cutin: () => Promise.resolve() };
FUI.stage = null; FUI.log = () => {}; FUI.pop = () => {}; FUI.flash = () => {}; FUI.shake = () => {}; FUI.toast = () => {}; FUI.skName = () => {};
const runOne = () => {
  newGame("BR_Marie", {});
  const p = P();
  const to = neighbors(p.city).map(C).find((c) => c.owner && c.owner !== p.fac) || neighbors(p.city).map(C)[0];
  const atk = unitsIn(p.city).filter((u) => u.fac === p.fac).slice(0, 4).map((u) => ({ u, troops: 4000 }));
  const war = prepareBattle({ atkFac: p.fac, from: p.city, to: to.name, atk });
  Field.sim = true; Field.setup({ war, playerSide: "def", commander: false }); Field.ctrl = () => false; Field.autoSkill = true;
  Field.form = { atk: "fish", def: "crane" };
  const snap = { surge: Field.surge, collapsed: JSON.stringify(Field.collapsed), formCd: JSON.stringify(Field.formCd), contact: Field.contact, canChange: Field.canChangeForm("atk") };
  Field.finish = () => { Field.finished = true; };
  Field.build();
  for (let i = 0; i < 4000 && !Field.finished; i++) Field.step(0.05);
  return { snap, after: { surge: Field.surge, collapsed: JSON.stringify(Field.collapsed), t: Math.round(Field.t) } };
};
return [runOne(), runOne()];`)();
const second = out[1].snap;
const ok = second.surge === false && second.collapsed === "{}" && second.formCd === "{}" && second.contact === false && second.canChange === false; // 진형 변경은 첫 접전 뒤에만 가능
console.log("첫 전투 끝:", JSON.stringify(out[0].after), "· 두 번째 전투 시작:", JSON.stringify(second));
console.log(ok ? "상태 초기화 정상" : "이전 전투 상태가 남아 있다");
process.exitCode = ok ? 0 : 1;
