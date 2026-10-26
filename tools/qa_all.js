// 회귀 묶음 (Windows·macOS·Linux 공통): 대사 · 이벤트 정의 · 장수제 · 이벤트 흐름(5판) · 화면 스모크(서버 필요)
// 사용: node tools/qa_all.js          화면 스모크 생략: node tools/qa_all.js --noshot
// 캡처는 OS 임시 폴더에 쓰고 끝나면 지운다. 하나라도 실패하면 종료 코드 1
const { spawnSync } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");
const root = path.join(__dirname, "..");
const noshot = process.argv.includes("--noshot") || process.env.NOSHOT;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lao3k_qa_"));
const run = (args, env) => { const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26, env: { ...process.env, ...(env || {}) } }); return { code: r.status, out: (r.stdout || "") + (r.stderr || "") }; };
const evals = (out) => out.split(/\r?\n/).filter((l) => l.startsWith("eval:")).map((l) => "  " + l.slice(0, 200)).join("\n");
const steps = [
  ["qa_lines", ["tools/qa_lines.js"], (r) => /문제 없음/.test(r.out), (r) => r.out.trim().split(/\r?\n/).pop()],
  ["qa_events", ["tools/qa_events.js"], (r) => r.code === 0, (r) => r.out.trim().split(/\r?\n/).pop()],
  ["장수제 (신분·관계·임무·평정·위명·자율 행동·저장)", ["tools/qa_officer.js"], (r) => r.code === 0 && /문제 없음/.test(r.out), (r) => r.out.trim().split(/\r?\n/).slice(-2).join(" / ")],
  ["mix (렌더링 믹스: 마스킹·명료도·클리핑)", null, (r) => r.code === 0, (r) => r.out.trim().split(/\r?\n/).pop(), null, ["python", ["tools/mix_check.py"]]],
  // 기본 구성은 수비 우위(성 방어도 550)라 같은 시나리오의 자동 전투 공격 승률이 3~4%다 — 12판으로는 승률을 가를 수 없으니 전투 시간과 상한만 본다
  ["야전 밸런스 (field_sim 12판)", ["tools/field_sim.js", "12"], (r) => { const m = r.out.match(/중앙값 (\d+)초.*공격 승률 (\d+)%/); return !!m && +m[1] >= 40 && +m[1] <= 130 && +m[2] <= 40; }, (r) => r.out.trim().split(String.fromCharCode(10)).pop()],
  // 공정성: 양측 동일 부대(거울전) 30판 — 공격 승률 30~70%, 시간 초과 20% 이하
  ["야전 공정성 (거울전 30판)", ["tools/field_sim.js", "30", "7", "mirror"], (r) => { const m = r.out.match(/공격 승률 (\d+)%/), t = r.out.match(/시간 초과 (\d+)\/(\d+)판/); return !!m && !!t && +m[1] >= 30 && +m[1] <= 70 && +t[1] / +t[2] <= 0.2; }, (r) => r.out.trim().split(String.fromCharCode(10)).slice(-2).join(" / ")],
  ["야전 상태 초기화 (연속 두 전투)", ["tools/field_persist_test.js"], (r) => r.code === 0, (r) => r.out.trim().split(/\r?\n/).pop()],
  ["event_sim 5판", ["tools/event_sim.js", "5", "1"], (r) => r.code === 0, (r) => r.out.trim().split(/\r?\n/).slice(-2).join(" / ")],
];
if (!noshot) steps.push(
  ["smoke (군주 노선 · 단축키)", ["tools/shot.mjs", "tools/smoke.json", tmp], (r) => /메인 서사/.test(r.out) && /KEYS chron=true esc=true tab=mil next=true/.test(r.out), (r) => evals(r.out)],
  ["smoke (진언 보류)", ["tools/shot.mjs", "tools/smoke_advise.json", tmp], (r) => /나: 진언/.test(r.out), (r) => evals(r.out)],
  ["audio (덕킹 · 전환 · 효과음)", ["tools/shot.mjs", "tools/audio_check.json", tmp], (r) => { const db = +((r.out.match(/\((-?[\d.]+)dB\)/) || [])[1]); const fin = +((r.out.match(/fadeIn=(\d+)ms/) || [])[1]); return /restored=true/.test(r.out) && /ok=true/.test(r.out) && /SFX playing=true/.test(r.out) && /AMB amb_wind vol=[\d.]+ stopped=true ok=true/.test(r.out) && db <= -6 && db >= -10 && fin <= 6000; }, (r) => evals(r.out)],
  ["해상도 1280×720", ["tools/shot.mjs", "tools/smoke_res.json", tmp], (r) => /hdrOverflow=false docScroll=false overflowEls=0/.test(r.out) && /modal \d+,\d+ \/ 720/.test(r.out), (r) => evals(r.out), { W: "1280", H: "720" }],
  ["해상도 1920×1080", ["tools/shot.mjs", "tools/smoke_res.json", tmp], (r) => /hdrOverflow=false docScroll=false overflowEls=0/.test(r.out), (r) => evals(r.out), { W: "1920", H: "1080" }],
  ["야전 (개전 · 무장기 · 결과 · 복귀)", ["tools/shot.mjs", "tools/smoke_field.json", tmp], (r) => /prep true/.test(r.out) && /bake ok=true/.test(r.out) && /cast true/.test(r.out) && /RESULT VICTORY/.test(r.out) && /done=1 fieldOpen=false/.test(r.out), (r) => evals(r.out)],
  ["smoke (독립 후 노선 · 엔딩)", ["tools/shot.mjs", "tools/smoke_end.json", tmp], (r) => /새 세력의 노선/.test(r.out) && /routeLine=함께 살아/.test(r.out), (r) => evals(r.out)],
);
let fail = 0;
for (const [name, args, ok, show, env, ext] of steps) {
  const r = ext ? (() => { const x = spawnSync(ext[0], ext[1], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }); return { code: x.status, out: (x.stdout || "") + (x.stderr || "") }; })() : run(args, env); const pass = ok(r); if (!pass) fail++;
  console.log(`${pass ? "OK  " : "FAIL"} ${name}\n${show(r)}`);
  if (!pass) console.log("  -- 실패 출력 --\n" + r.out.split(/\r?\n/).filter((l) => !/^\s+at /.test(l)).slice(-10).map((l) => "  " + l.slice(0, 220)).join("\n"));
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail ? `QA 실패 ${fail}건` : "QA 전체 통과");
process.exitCode = fail ? 1 : 0;
