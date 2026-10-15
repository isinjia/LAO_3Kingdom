// 헤드리스 Chrome(DevTools 프로토콜)으로 게임을 조작하고 스크린샷을 찍는 테스트 도구. 항상 ?mute=1 (음소거)
// 사용: node tools/shot.mjs <스크립트.json> [출력폴더]   (환경변수 BLOCK=js/a.js,js/b.js 로 특정 파일 차단)
//   스크립트: [{"goto":"/index.html"}, {"wait":800}, {"eval":"UI.prologue()"}, {"shot":"01_title"}, ...]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const [, , scriptPath, outDir = "shots"] = process.argv;
const steps = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const BASE = process.env.BASE || "http://localhost:8000";
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
let port = 0; // 0 = Chrome이 빈 포트를 고르고 프로필의 DevToolsActivePort에 기록 (다른 도구의 Chrome과 충돌 방지)
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "lao3k-"));
fs.mkdirSync(outDir, { recursive: true });

const proc = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${prof}`, `--window-size=${W},${H}`,
  "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
async function connect() {
  for (let i = 0; i < 400 && !port; i++) {
    try { port = +fs.readFileSync(path.join(prof, "DevToolsActivePort"), "utf8").trim().split(String.fromCharCode(10))[0]; } catch (e) {}
    if (!port) await sleep(100);
  }
  for (let i = 0; i < 150; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const pg = list.find((t) => t.type === "page");
      if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r)); break; }
    } catch (e) {}
    await sleep(200);
  }
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) logs.push(d.params.type + ": " + d.params.args.map((a) => a.value || a.description).join(" "));
    if (d.method === "Runtime.exceptionThrown") logs.push("EXC: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  };
}
const send = (method, params = {}, ms = 20000) => new Promise((r) => {
  const i = ++id; const t = setTimeout(() => { pend.delete(i); console.log("timeout:", method); r({}); }, ms);
  pend.set(i, (d) => { clearTimeout(t); r(d); }); ws.send(JSON.stringify({ id: i, method, params }));
});

await connect();
await send("Runtime.enable"); await send("Page.enable");
// BLOCK=js/equip.js,js/stage.js 처럼 주면 해당 요청을 차단한다 (부팅 실패 경로 테스트)
if (process.env.BLOCK) { await send("Network.enable"); await send("Network.setBlockedURLs", { urls: process.env.BLOCK.split(",").map((x) => "*" + x + "*") }); }
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
setTimeout(() => { console.log("global timeout"); try { proc.kill(); } catch (e) {} process.exit(2); }, 240000);
for (const s of steps) {
  if (s.goto) { const u = BASE + s.goto + (s.goto.includes("?") ? "&" : "?") + "mute=1"; await send("Page.navigate", { url: u }); await sleep(s.wait || 1500); }
  else if (s.wait) await sleep(s.wait);
  else if (s.eval) {
    const r = await send("Runtime.evaluate", { expression: `(async()=>{${s.eval}})()`, awaitPromise: true, returnByValue: true }, s.timeout || 90000);
    const v = r.result?.result?.value; if (v !== undefined) console.log("eval:", JSON.stringify(v).slice(0, 600));
    if (r.result?.exceptionDetails) console.log("eval error:", r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  } else if (s.click) {
    const [x, y] = s.click;
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    await sleep(s.after || 300);
  } else if (s.shot) {
    const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
    fs.writeFileSync(path.join(outDir, s.shot + ".jpg"), Buffer.from(r.result.data, "base64"));
    console.log("shot:", s.shot);
  }
}
if (logs.length) console.log("console:\n " + [...new Set(logs)].slice(0, 30).join("\n "));
ws.close(); proc.kill();
setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 400);
