// 텍스트 QA: 조사 수동 표기 잔존, 대사 길이, 응답 풀 중복, 로비 대사 태그 분포를 검사한다
// 사용: node tools/qa_lines.js
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "js");
const files = ["game", "events", "battle", "equip", "ui", "ui_battle"];
let issues = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f + ".js"), "utf8");
  s.split("\n").forEach((ln, i) => {
    // 템플릿 치환 바로 뒤의 수동 조사 표기는 jo()로 처리해야 한다
    if (/\$\{[^}]+\}(을\(를\)|이\(가\)|은\(는\)|와\(과\)|\(으\)로)/.test(ln)) { console.log(`조사: ${f}.js:${i + 1}`); issues++; }
  });
}
global.G = { flags: {} };
const src = ["lines_data", "lines_peer", "events"].map((f) => fs.readFileSync(path.join(dir, f + ".js"), "utf8")).join("\n");
const ctx = new Function("pick", "clamp", "chance", "shuffle", src + ";return { LAO_LINES, REPLY_T, TOPIC, lineTag, lineSafe, LINE_SENSITIVE, LINE_TOWARD, LINE_PEER };")(
  (a) => a[0], (v, a, b) => Math.max(a, Math.min(b, v)), () => false, (a) => a);
const tags = {}; let long = 0;
for (const [code, ls] of Object.entries(ctx.LAO_LINES)) for (const l of ls) { const t = ctx.lineTag(l.t); tags[t] = (tags[t] || 0) + 1; if (l.t.length > 90) long++; }
for (const [k, arr] of Object.entries(ctx.REPLY_T)) { const d = arr.filter((x, i) => arr.indexOf(x) !== i); if (d.length) { console.log("응답 중복:", k, d); issues++; } }
for (const k of Object.keys(ctx.TOPIC)) if (!ctx.REPLY_T[k]) { console.log("화제에 대응하는 응답 풀 없음:", k); issues++; }
let safe = 0, sens = 0; const sample = [];
for (const [code, ls] of Object.entries(ctx.LAO_LINES)) for (const l of ls) { if (ctx.lineSafe(l, code)) { safe++; if (ctx.LINE_SENSITIVE.test(l.t)) sens++; if (sample.length < 12 && Math.random() < 0.03) sample.push(`${code}: ${l.t}`); } }
if (sens) { console.log("대화에 쓰이는 대사 중 민감 표현", sens); issues++; }
// 허용 목록 문장이 원본에 실제로 있는지 (데이터 갱신 시 검출)
let peerN = 0, peerMiss = 0; for (const [code, ts] of Object.entries(ctx.LINE_PEER)) for (const t of ts) { peerN++; if (!(ctx.LAO_LINES[code] || []).some((l) => l.t === t)) peerMiss++; }
if (peerMiss) { console.log("허용 목록 중 원본에 없는 대사", peerMiss); issues++; }
// 실제 생성 대화 검사: 허용 대사 + 응답 템플릿 전체에 사령관 대상/민감 정규식
const gen = []; for (const [code, ts] of Object.entries(ctx.LINE_PEER)) gen.push(...ts); for (const k in ctx.REPLY_T) gen.push(...ctx.REPLY_T[k]); for (const k in ctx.TOPIC) gen.push(...ctx.TOPIC[k]);
const HARD = /사령관|주인님|폐하|보스|프로듀서|지휘관|인간님|명령을|하십니까|누나랑|하러 갈래|뜨거운|어젯밤/;
const bad = gen.filter((t) => ctx.LINE_SENSITIVE.test(t) || HARD.test(t));
if (bad.length) { console.log("생성 대화 금지 표현", bad); issues++; }
const longPeer = Object.values(ctx.LINE_PEER).flat().filter((t) => t.length > 80);
if (longPeer.length) { console.log("허용 대사 80자 초과", longPeer); issues++; }
console.log("동료 대화 허용 대사", peerN);
// 게임 문자열의 조사 이중 표기 금지 — jo()를 쓴다 (원작 대사 데이터 제외)
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js") && !/^(lines_data|lines_peer|lao_official|skills_data|equip_data|audio_manifest|sd_map)\.js$/.test(x))) {
  fs.readFileSync(path.join(dir, f), "utf8").split(String.fromCharCode(10)).forEach((l, i) => { if (/\(으\)로|은\(는\)|이\(가\)|을\(를\)|과\(와\)|와\(과\)/.test(l)) { console.log(`조사 이중 표기: js/${f}:${i + 1}`); issues++; } });
}
console.log("로비 대사 태그 분포", tags, "· 90자 초과", long, "· 대화 사용 가능", safe);
console.log("대화 사용 표본(수동 검수용):\n  " + sample.join("\n  "));
console.log(issues ? `문제 ${issues}건` : "문제 없음");
