// 라스트오리진 삼국지 — 실시간 진행: 하루씩 시간이 흐르고, 군대가 지도 위를 행군하고, 나도 길을 따라 며칠에 걸쳐 이동한다
// ui.js 뒤에 불러온다. 한 달(30일)이 지나면 기존 월말 처리(endMonth)를 그대로 돈다
//   G.rt      실시간 진행 중 (화면에서 시작한 판만. 시뮬레이션·검사는 예전처럼 달 단위)
//   G.day     이번 달 지난 날 (0~29)          G.apFrac  하루치 행동력 회복의 소수 부분
//   G.marches 행군 중인 군대 [{ id, fac, from, to, dep, arr, atk:[{id,troops}], sent, troops, drafted }]
//   p.trip    내 여정 { to, path, hop: { from, to, dep, arr } }
"use strict";

const RT_SPEED = [0, 1000, 450, 180]; // 하루에 걸리는 밀리초 (0 = 멈춤)
const RT_SPEED_KO = ["멈춤", "보통", "빠름", "매우 빠름"];
const TRAVEL_UNIT = 45; // 지도 거리 45마다 하루
const absDay = () => monthStartDay() + Math.min(29, G.day || 0);
function rtInit() { G.rt = true; G.day = G.day || 0; G.marches ||= []; G.apFrac ||= 0; }
function hopDays(a, b) { const A = C(a), B = C(b); return A && B ? clamp(Math.round(Math.hypot(A.x - B.x, A.y - B.y) / TRAVEL_UNIT), 1, 4) : 1; }
const pathDays = (from, path) => path.reduce((s, n, i) => s + hopDays(i ? path[i - 1] : from, n), 0);

// 하루 진행. 달이 바뀌면 true
function dayTick() {
  G.day = (G.day || 0) + 1;
  G.apFrac = (G.apFrac || 0) + AP_MAX / 30; const add = Math.floor(G.apFrac); G.apFrac -= add;
  G.ap = Math.min(AP_MAX, G.ap + add); // 행동력은 하루에 조금씩 찬다 (한 달에 100)
  officerDay();
  marchDay();
  tripDay();
  if (G.day >= 30) { endMonth(); G.day = 0; return true; }
  return false;
}

// 임무 작업을 하루씩
function officerDay() {
  if (!G.tasks || !G.tasks.length || typeof taskRate !== "function") return;
  const d = absDay();
  for (const t of G.tasks.slice()) {
    if (t.start > d) continue;
    const bad = taskValid(t);
    if (bad) { if (t.doers.includes(G.player) || t.issuer === G.player) log(`임무 중단 — ${taskName(t)} @${t.city}: ${bad}`, "bad"); G.tasks.splice(G.tasks.indexOf(t), 1); continue; }
    t.prog += taskRate(t); t.last = d + 1;
    if (t.prog >= t.need) taskComplete(t, d);
    if (t.done) G.tasks.splice(G.tasks.indexOf(t), 1); else t.eta = taskEta(t);
  }
}

// ── 행군 ──
// AI 세력이 공격을 정하면 다음 달 중 어느 날 출발해, 거리만큼 며칠을 걸어 도착한 날 싸운다
function scheduleMarch(war) {
  G.marches.push({ id: (G.flags.marchN = (G.flags.marchN || 0) + 1), fac: war.atkFac, from: war.from, to: war.to, dep: monthStartDay() + 30 + rnd(1, 22), arr: 0, atk: null, sent: war.sent });
}
function marchDay() {
  const d = absDay(); const p = P();
  for (const m of G.marches.slice()) {
    const from = C(m.from), to = C(m.to), f = F(m.fac);
    const drop = () => G.marches.splice(G.marches.indexOf(m), 1);
    if (!m.atk) {
      if (d < m.dep) continue;
      if (!f || !f.alive || from.owner !== m.fac || to.owner === m.fac || from.troops < 1500) { drop(); continue; }
      m.drafted = p.fac === m.fac && p.city === m.from && !isLord(p) && !p.trip;
      const send = Math.round(from.troops * 0.65);
      const atk = pickArmy(m.from, m.fac, send, 5, m.drafted ? p : null);
      if (!atk.length && !f.iron) { drop(); continue; }
      m.atk = atk.map((x) => ({ id: x.u.id, troops: x.troops })); m.sent = send;
      m.troops = atk.reduce((s, x) => s + x.troops, 0) || send; from.troops = Math.max(0, from.troops - m.troops);
      m.dep = d; m.arr = d + hopDays(m.from, m.to);
      const mine = p.fac && (to.owner === p.fac || m.fac === p.fac);
      log(`${jo(f.name, "이가")} ${m.from}에서 ${jo(m.to, "으로")} 진군을 시작했다. (병력 ${rtN(m.troops)} · ${m.arr - d}일 뒤 도착)${m.drafted ? " — 나도 출진한다" : ""}`, mine ? "war" : "");
      if (to.owner && to.owner === p.fac && !m.drafted) G.toast = { text: `${f.name}의 군대가 ${jo(m.to, "으로")} 온다! (${m.arr - d}일)`, kind: "bad" };
      G._mapDirty = true;
      continue;
    }
    if (d < m.arr) continue;
    drop(); G._mapDirty = true;
    const atk = m.atk.map((x) => ({ u: U(x.id), troops: x.troops })).filter((x) => x.u && x.u.alive && x.u.fac === m.fac);
    if (to.owner === m.fac || (!atk.length && !f.iron)) { // 이미 손에 넣었거나 장수가 모두 빠졌으면 병력만 합류·귀환
      const back = to.owner === m.fac ? to : from; back.troops += m.troops; continue;
    }
    const b = prepareBattle({ atkFac: m.fac, from: m.from, to: m.to, atk, sent: m.sent });
    const playerDefends = to.owner && p.fac === to.owner && p.city === m.to && !p.trip;
    if (m.drafted || playerDefends) G.queue.push({ type: "battle", war: b, playerSide: m.drafted ? "atk" : "def", commander: !m.drafted && (isGov(p) || isLord(p)) });
    else resolvePrepared(b);
  }
}
const rtN = (n) => Math.round(n).toLocaleString();

// ── 내 여정 ──
function rtTravel(to, path) {
  const p = P();
  if (G.ap < MOVE_START) return notify("행동력 부족", `출발하려면 행동력 ${MOVE_START}이 필요하다. (남음 ${G.ap})`);
  G.ap -= MOVE_START;
  const d = absDay();
  p.trip = { to, path: path.slice(1), hop: { from: p.city, to: path[0], dep: d, arr: d + hopDays(p.city, path[0]) } };
  const days = pathDays(p.city, path);
  log(`${p.city}에서 ${jo(to, "으로")} 출발했다. (${path.length}구간 · 약 ${days}일)`);
  G.toast = { text: `${to}까지 약 ${days}일`, kind: "" };
}
function tripDay() {
  const p = P(); const t = p.trip; if (!t || !t.hop) return;
  if (absDay() < t.hop.arr) return;
  const next = C(t.hop.to);
  if (next.owner && F(next.owner).iron) { log(`${jo(t.to, "으로")} 가는 길이 철충에 막혀 ${p.city}에 멈췄다.`, "bad"); p.trip = null; return; }
  moveStep(t.hop.to); G._mapDirty = true;
  if (!t.path.length) {
    p.trip = null; log(`${t.to}에 도착했다.`, "good"); G.toast = { text: `${t.to} 도착`, kind: "good" };
    if (p.fac && C(t.to).owner && C(t.to).owner !== p.fac) log(`${jo(t.to, "은는")} 다른 세력의 거점이다. 방문·교류·탐방은 할 수 있지만 내정은 할 수 없다.`, "sys");
    return;
  }
  const n = t.path.shift(); const d = absDay();
  t.hop = { from: p.city, to: n, dep: d, arr: d + hopDays(p.city, n) };
}

// ── 화면: 시계와 지도 위의 움직임 ──
Object.assign(UI, {
  rtSpeed: 1,
  rtBusy() {
    if (!G || G.over || !G.rt || this.flushing || G.missionOffer || G.queue.length || document.hidden) return true;
    const main = document.querySelector("#main"); if (!main || !main.classList.contains("on")) return true;
    return !!document.querySelector("#modals > *, .vn, .relMap, .overlay.on, .cityView, #field.on, .rmSearch, .tut, #prologue.on");
  },
  rtStart() {
    if (this.rtTimer) return;
    // 시간은 타이머로 (화면 갱신이 멈춘 배경에서도 정확하게), 움직임 그리기는 화면 갱신마다
    let last = performance.now(), acc = 0;
    this.rtTimer = setInterval(() => {
      const now = performance.now(); const dt = Math.min(250, now - last); last = now;
      const ms = RT_SPEED[this.rtSpeed];
      this.rtIsBusy = this.rtBusy();
      if (this.rtIsBusy || !ms) { this.rtFrac = ms ? Math.min(1, acc / ms) : this.rtFrac || 0; return; }
      acc += dt;
      if (acc >= ms) { acc -= ms; this.rtDay(); }
      this.rtFrac = Math.min(1, acc / ms);
    }, 40);
    const draw = () => { requestAnimationFrame(draw); this.rtDraw(this.rtIsBusy); };
    requestAnimationFrame(draw);
  },
  rtDay() {
    const turned = dayTick();
    if (turned) { Sound.sfx("turn"); saveGame(); this.sel = this.sel || P().city; this.after(); this.mapBgm(); return; }
    if (G._mapDirty) { G._mapDirty = false; this.render(); } else { this.renderHeader(); if (!document.querySelector("#side :hover, #side :focus")) this.renderSide(); this.renderPop && this.popCity && this.renderPop(); }
    if (G.toast || G.queue.length) this.after();
  },
  // 시간 조작 버튼 (머리막대의 「다음 달」 자리)
  rtControls() {
    const box = document.querySelector("#rtCtl"); if (!box) return;
    box.innerHTML = "";
    const play = this.rtSpeed > 0;
    box.append(
      h("button", { class: "rtPlay" + (play ? " on" : ""), title: "진행 / 멈춤 (스페이스)", onclick: () => { this.rtSpeed = play ? 0 : this.rtLastSpeed || 1; Sound.sfx("click", 0.5); this.rtControls(); } }, play ? "⏸" : "▶"),
      ...[1, 2, 3].map((s) => h("button", { class: "rtSpd" + (this.rtSpeed === s ? " on" : ""), title: `${RT_SPEED_KO[s]} (하루 ${RT_SPEED[s] / 1000}초)`, onclick: () => { this.rtSpeed = s; this.rtLastSpeed = s; Sound.sfx("click", 0.4); this.rtControls(); } }, "▸".repeat(s))),
      h("button", { class: "rtSkip", title: "이번 달 남은 날을 한꺼번에 보낸다", onclick: () => this.rtSkipMonth() }, "⏭"));
    const tr = P().trip;
    if (tr && tr.hop) box.prepend(h("span", { class: "rtTrip", title: `${P().city} → ${tr.hop.to}${tr.path.length ? " → " + tr.path.join(" → ") : ""}` }, `→ ${tr.to} ${Math.max(0, tr.hop.arr - absDay()) + pathDays(tr.hop.to, tr.path)}일`, h("button", { class: "mini", onclick: () => { P().trip = null; log(`${jo(tr.to, "으로")} 가던 길을 멈췄다. (${P().city})`); this.render(); } }, "멈추기")));
  },
  rtSkipMonth() {
    if (this.flushing || G.missionOffer) { if (G.missionOffer) this.message("평정", "먼저 이번 달 임무를 선택하세요."); return; }
    let guard = 31;
    while (guard-- > 0) { if (dayTick()) { Sound.sfx("turn"); saveGame(); this.sel = this.sel || P().city; this.after(); this.mapBgm(); return; } if (G.queue.length) { this.render(); this.after(); return; } }
  },
  // 지도 위 움직이는 것: 행군하는 군대, 길 위의 나
  rtDraw(busy) {
    const svg = document.querySelector("#map"); if (!svg || !G || !G.rt) return;
    let g = svg.querySelector("#rtLive");
    if (!g) { g = sv("g", { id: "rtLive" }); svg.append(g); }
    const now = absDay() + (busy ? 0 : this.rtFrac || 0);
    const key = []; const parts = [];
    for (const m of G.marches || []) {
      if (!m.atk) continue;
      const A = C(m.from), B = C(m.to), f = F(m.fac); if (!A || !B || !f) continue;
      const t = clamp((now - m.dep) / Math.max(1, m.arr - m.dep), 0, 1);
      parts.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, a: Math.atan2(B.y - A.y, B.x - A.x), col: f.color, n: m.troops, A, B, mine: f.key === P().fac, hit: B.owner === P().fac, id: "m" + m.id, left: Math.max(0, Math.ceil(m.arr - now)) });
    }
    const p = P(); const tr = p.trip && p.trip.hop;
    if (tr) { const A = C(tr.from), B = C(tr.to); const t = clamp((now - tr.dep) / Math.max(1, tr.arr - tr.dep), 0, 1); parts.push({ me: true, x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, A, B, id: "me" }); }
    for (const q of parts) key.push(q.id);
    // 구성이 바뀌면 다시 만들고, 아니면 위치만 옮긴다
    if (g.dataset.key !== key.join(",")) {
      g.dataset.key = key.join(","); g.innerHTML = "";
      for (const q of parts) {
        if (q.me) {
          g.append(sv("line", { x1: q.A.x, y1: q.A.y, x2: q.B.x, y2: q.B.y, class: "rtTrail me" }));
          if (!svg.querySelector("#rtClip")) { const cp = sv("clipPath", { id: "rtClip" }, sv("circle", { r: 13 })); (svg.querySelector("defs") || svg).append(cp); }
          const t = sv("g", { class: "rtMe", "data-id": q.id }); t.append(sv("circle", { r: 15, class: "rtMeRing" }), sv("image", { href: `assets/sdface/${p.id}.webp`, x: -13, y: -13, width: 26, height: 26, "clip-path": "url(#rtClip)" }));
          g.append(t);
        } else {
          g.append(sv("line", { x1: q.A.x, y1: q.A.y, x2: q.B.x, y2: q.B.y, class: "rtTrail" + (q.hit ? " hit" : ""), stroke: q.col }));
          const t = sv("g", { class: "rtArmy" + (q.hit ? " hit" : "") + (q.mine ? " mine" : ""), "data-id": q.id });
          t.append(sv("path", { d: "M-11,-8 L9,-8 L13,0 L9,8 L-11,8 Z", fill: q.col, class: "rtFlag" }), sv("text", { x: 0, y: 3.5, class: "rtNum" }, q.n >= 1000 ? `${(q.n / 1000).toFixed(q.n >= 10000 ? 0 : 1)}k` : String(q.n)));
          const tip = document.createElementNS("http://www.w3.org/2000/svg", "title"); t.append(tip);
          g.append(t);
        }
      }
    }
    for (const q of parts) {
      const t = g.querySelector(`[data-id="${q.id}"]`); if (!t) continue;
      t.setAttribute("transform", `translate(${q.x.toFixed(1)},${q.y.toFixed(1)}) scale(${q.me ? 1.35 : 1.75})${q.me ? "" : ` rotate(${(q.a * 180 / Math.PI).toFixed(0)})`}`);
      if (!q.me) { const tx = t.querySelector("text"); tx.setAttribute("transform", Math.abs(q.a) > Math.PI / 2 ? "rotate(180)" : ""); const tip = t.querySelector("title"); if (tip) tip.textContent = `${F(G.marches.find((m) => "m" + m.id === q.id)?.fac)?.name || ""} → ${q.B.name} · 병력 ${rtN(q.n)} · ${q.left}일 뒤 도착`; }
    }
    // 머리막대의 하루 진행 막대
    const bar = document.querySelector("#rtDayBar i"); if (bar) bar.style.width = `${((G.day || 0) + (busy ? 0 : this.rtFrac || 0)) / 30 * 100}%`;
  },
});
