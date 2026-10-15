// 스토리 이벤트 정의 검사: 최상위 키 중복(bg 덮어쓰기 등), id 중복, bg 이미지·bgm 파일 존재
// 사용: node tools/qa_events.js
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js", "events.js"), "utf8").replace(/\r\n/g, "\n");
const st = src.indexOf("const STORY_EVENTS = [");
const block = src.slice(st, src.indexOf("\n];", st));
const objs = block.split(/\n  \{\n/).slice(1);
const off = fs.readFileSync(path.join(root, "js", "lao_official.js"), "utf8").replace(/\r\n/g, "\n");
const PC = JSON.parse(off.split("const LAO_PC = ")[1].split(";\nconst LAO_SQUADS")[0]);
const dataSrc = fs.readFileSync(path.join(root, "js", "data.js"), "utf8"); // 철충 장수(IRON_RAW) 포함
let issues = 0; const ids = new Set();
for (const o of objs) {
  const id = (o.match(/id: "([^"]+)"/) || [])[1] || "?";
  // 최상위 키: 4칸 들여쓰기 줄의 key: (같은 줄에 bg, bgm이 이어질 수 있음)
  const keys = [];
  for (const line of o.split("\n")) {
    if (!/^ {4}\S/.test(line)) continue;
    for (const m of line.matchAll(/(?:^|,)\s*(id|when|bg|bgm|lines|effect)\s*:/g)) keys.push(m[1]);
  }
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dup.length) { console.log(`[${id}] 키 중복: ${dup.join(", ")}`); issues++; }
  if (ids.has(id)) { console.log(`id 중복: ${id}`); issues++; }
  ids.add(id);
  const bg = (o.match(/^ {4}bg: "([^"]+)"/m) || [])[1];
  if (bg && !fs.existsSync(path.join(root, "assets", "bg", bg + ".jpg"))) { console.log(`[${id}] 배경 없음: assets/bg/${bg}.jpg`); issues++; }
  // when 조건의 연·월 범위 (월 1~12, 연 1~12)
  for (const m of o.matchAll(/G\.month === (\d+)/g)) if (+m[1] < 1 || +m[1] > 12) { console.log(`[${id}] 월 범위 오류: ${m[1]}`); issues++; }
  for (const m of o.matchAll(/G\.year === (\d+)/g)) if (+m[1] < 1 || +m[1] > 12) { console.log(`[${id}] 연 범위 오류: ${m[1]}`); issues++; }
  // lines 안에 직접 쓴 장수 코드가 실제로 있는지
  for (const m of o.matchAll(/who: "([A-Za-z0-9_]+)"/g)) if (!PC[m[1]] && !dataSrc.includes(`"${m[1]}"`)) { console.log(`[${id}] 없는 장수: ${m[1]}`); issues++; }
  const bgm = (o.match(/bgm: "([^"]+)"/) || [])[1];
  if (bgm && !fs.existsSync(path.join(root, "assets", "bgm", bgm + ".mp3"))) { console.log(`[${id}] BGM 없음: ${bgm}`); issues++; }
}
const sched = {}; for (const o of objs) { const y = (o.match(/G\.year === (\d+)/) || [])[1], mo = (o.match(/G\.month === (\d+)/) || [])[1]; if (y && mo) (sched[`${y}.${mo}`] ||= []).push((o.match(/id: "([^"]+)"/) || [])[1]); }
for (const k in sched) if (sched[k].length > 1) console.log(`참고: ${k}에 고정 일정 ${sched[k].join(", ")} (조건이 서로 배타적인지 확인)`);
console.log(`스토리 이벤트 ${objs.length}개 검사 · ${issues ? `문제 ${issues}건` : "문제 없음"}`);
process.exitCode = issues ? 1 : 0;
