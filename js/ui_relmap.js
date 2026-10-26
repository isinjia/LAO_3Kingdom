// 라스트오리진 삼국지 — 관계도 (삼국지 13식): 가운데 장수와 이어진 장수들을 선으로 잇는다
// ui.js 뒤에 불러온다. 선 색 = 관계 단계, 물결선 = 원작에서 서로 부르던 사이(LAO_REL), 겹선 = 의자매
//   노드를 누르면 오른쪽에 정보, 한 번 더 누르면 그 장수가 가운데로 온다. 「뒤로」로 이전 중심으로
"use strict";

const RM_LINE = [ // [이름, 색, 굵기, 점선]
  ["원수·적대", "#6f8cff", 2.5, "7 6"], ["보통·지인", "#9a9a9a", 2, ""], ["친우", "#f08a3c", 3, ""], ["막역지우", "#ff4646", 4, ""], ["의자매", "#ffd34d", 3, ""],
];
function rmLink(a, b) {
  const v = relOf(a.id, b.id);
  const sworn = a.id === G.player ? b.sworn : b.id === G.player ? a.sworn : isOath(a.id, b.id);
  const orig = typeof REL === "function" ? (REL(a.id, b.id) || REL(b.id, a.id)) : null;
  const k = sworn ? 4 : v <= -40 ? 0 : v >= 85 ? 3 : v >= 60 ? 2 : 1;
  const lv = sworn ? "★" : v <= -70 ? "원" : v <= -40 ? "적" : v >= 85 ? 3 : v >= 60 ? 2 : v >= 30 ? 1 : 0;
  return { v, sworn, orig, k, lv, squad: a.squad && a.squad === b.squad };
}
// 가운데 장수와 이어 그릴 상대: 의자매 > 관계 수치 > 원작 인연 > 같은 부대
function rmNeighbors(c, n, skip) {
  const out = [];
  for (const x of Object.values(G.units)) {
    if (!x.alive || x.iron || x.id === c.id || (skip && skip.has(x.id))) continue;
    const L = rmLink(c, x);
    const on = L.orig ? (L.orig.n || 0) : 0;
    if (!(L.sworn || Math.abs(L.v) >= 30 || on >= 4 || L.squad)) continue;
    out.push({ u: x, L, s: (L.sworn ? 1000 : 0) + Math.abs(L.v) + on * 1.5 + (L.squad ? 12 : 0) + (x.id === G.player ? 40 : 0) });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, n);
}

Object.assign(UI, {
  relMap(centerId) {
    document.querySelector(".relMap")?.remove();
    const st = { c: centerId || G.player, sel: null, hist: [], call: true, lv: true, ring2: true, orig: false, fac: false };
    try { Object.assign(st, JSON.parse(localStorage.getItem("lao3k_relmap") || "{}"), { c: centerId || G.player, sel: null, hist: [] }); } catch (e) {}
    const save = () => { try { localStorage.setItem("lao3k_relmap", JSON.stringify({ call: st.call, lv: st.lv, ring2: st.ring2, orig: st.orig, fac: st.fac })); } catch (e) {} };
    const root = h("div", { class: "relMap" });
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("class", "rmLines");
    const nodes = h("div", { class: "rmNodes" });
    const info = h("div", { class: "rmPanel rmInfo" });
    const legend = h("div", { class: "rmPanel rmLegend" });
    const bar = h("div", { class: "rmBar" });
    const stage = h("div", { class: "rmStage" }, svg, nodes);
    root.append(stage, legend, info, bar);
    document.body.append(root);
    Sound.sfx("open", 0.5);
    const close = () => { root.remove(); window.removeEventListener("resize", draw); Sound.sfx("close", 0.4); };
    root.tabIndex = 0; root.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); if (e.key === "Backspace" && st.hist.length) back(); });
    const go = (id) => { if (id === st.c) return; st.hist.push(st.c); st.c = id; st.sel = null; Sound.sfx("click", 0.5); draw(); };
    const back = () => { st.c = st.hist.pop(); st.sel = null; draw(); };

    const tog = (k, label, tip) => h("button", { class: "rmTog" + (st[k] ? " on" : ""), title: tip, onclick: () => { st[k] = !st[k]; save(); draw(); } }, h("i"), label);
    const search = () => {
      const list = Object.values(G.units).filter((u) => u.alive && !u.iron).sort((a, b) => a.name.localeCompare(b.name, "ko"));
      const inp = h("input", { class: "rmFind", placeholder: "장수 이름", list: "rmNames", oninput: () => { const u = list.find((x) => x.name === inp.value || x.full === inp.value); if (u) { box.remove(); go(u.id); } } });
      const box = h("div", { class: "rmSearch" }, inp, h("datalist", { id: "rmNames" }, list.map((u) => h("option", { value: u.name }, u.full))), h("button", { class: "mini", onclick: () => box.remove() }, "닫기"));
      root.append(box); setTimeout(() => inp.focus(), 20);
    };

    function draw() {
      const c = U(st.c); const p = P();
      const W = stage.clientWidth, H = stage.clientHeight, narrow = W < 700;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = ""; nodes.innerHTML = "";
      // 그릴 자리: 양옆 패널을 뺀 가운데 (좁은 화면은 위쪽 전체)
      const L0 = narrow ? 0 : legend.offsetWidth + 24, R0 = narrow ? W : W - info.offsetWidth - 24;
      const cx = (L0 + R0) / 2, cy = H / 2;
      const Rx = (R0 - L0) / 2 - 34, Ry = H / 2 - 46;
      const CS = narrow ? Math.min(92, H * 0.26) : Math.min(210, H * 0.2, Rx * 0.5);
      const two = st.ring2 && !narrow && Rx >= 300; // 바깥 고리는 자리가 넉넉할 때만
      const r1 = two ? 0.62 : 0.94;
      const shown = new Set([c.id]);
      let ring = rmNeighbors(c, narrow ? 8 : 12, null);
      if (st.orig) ring = ring.filter((r) => r.L.orig);
      if (st.fac) ring = ring.filter((r) => r.u.fac && r.u.fac === c.fac);
      ring.forEach((r) => shown.add(r.u.id));
      const pos = {}; pos[c.id] = { x: cx, y: cy, s: CS };
      const n1 = ring.length || 1;
      ring.forEach((r, i) => { const a = -Math.PI / 2 + (i / n1) * Math.PI * 2 + (n1 % 2 ? 0 : Math.PI / n1); r.a = a; pos[r.u.id] = { x: cx + Math.cos(a) * Rx * r1, y: cy + Math.sin(a) * Ry * r1, s: narrow ? 46 : Math.min(H * 0.085, 92, Rx * 0.2) }; });
      // 바깥 고리: 이웃의 가까운 사이 (2명까지)
      const outer = [];
      if (two) for (const r of ring.slice(0, 8)) {
        const more = rmNeighbors(r.u, 2, shown).filter((x) => x.L.sworn || Math.abs(x.L.v) >= 50 || (x.L.orig && x.L.orig.n >= 10));
        more.forEach((m, j) => { shown.add(m.u.id); const a = r.a + (j - (more.length - 1) / 2) * 0.3; outer.push({ from: r.u, ...m }); pos[m.u.id] = { x: cx + Math.cos(a) * Rx, y: cy + Math.sin(a) * Ry, s: Math.min(H * 0.055, 60) }; });
      }
      for (const k in pos) { const q = pos[k]; q.x = clamp(q.x, L0 + q.s / 2 + 6, R0 - q.s / 2 - 6); q.y = clamp(q.y, q.s / 2 + 6, H - q.s / 2 - 22); }

      const line = (A, B, L, thin) => {
        const a = pos[A.id], b = pos[B.id]; const [, col, w, dash] = RM_LINE[L.k];
        const g = document.createElementNS(svgNS, "g"); g.setAttribute("class", "rmLink" + (thin ? " thin" : ""));
        const mk = (d, sw, extra) => { const e = document.createElementNS(svgNS, "path"); e.setAttribute("d", d); e.setAttribute("stroke", col); e.setAttribute("stroke-width", sw); e.setAttribute("fill", "none"); if (dash) e.setAttribute("stroke-dasharray", dash); if (extra) e.setAttribute("class", extra); g.append(e); };
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        let d = `M${a.x},${a.y} L${b.x},${b.y}`;
        if (L.orig && L.k !== 0) { // 원작 인연: 물결선
          const seg = Math.max(6, Math.round(len / 26)); d = `M${a.x},${a.y}`;
          for (let i = 1; i <= seg; i++) { const t = i / seg, o = i === seg ? 0 : (i % 2 ? 7 : -7); d += ` L${a.x + dx * t + nx * o},${a.y + dy * t + ny * o}`; }
        }
        const sw = thin ? Math.max(1.4, w * 0.6) : w;
        if (L.k >= 3) mk(d, sw + 6, "glow");
        if (L.sworn) { mk(`M${a.x + nx * 3},${a.y + ny * 3} L${b.x + nx * 3},${b.y + ny * 3}`, sw - 1); mk(`M${a.x - nx * 3},${a.y - ny * 3} L${b.x - nx * 3},${b.y - ny * 3}`, sw - 1); }
        else mk(d, sw);
        svg.append(g);
        if (st.lv && !thin && L.lv) { const t = clamp((a.s / 2 + (len - a.s / 2 - b.s / 2) * 0.5) / len, 0.2, 0.8); nodes.append(h("div", { class: "rmLv k" + L.k, style: `left:${a.x + dx * t}px;top:${a.y + dy * t}px` }, String(L.lv))); }
      };
      ring.forEach((r) => line(c, r.u, r.L));
      outer.forEach((o) => line(o.from, o.u, o.L, true));

      const node = (u, q, kind) => {
        const f = F(u.fac); const L = u.id === c.id ? null : rmLink(c, u);
        const el = h("button", { class: `rmNode ${kind}` + (st.sel === u.id ? " sel" : "") + (u.id === G.player ? " me" : ""), style: `left:${q.x}px;top:${q.y}px;width:${q.s}px;height:${q.s}px;--fc:${f ? f.color : "#8a8579"}`, title: `${u.full || u.name}${L ? ` · ${relStage(L.v, L.sworn)} (${L.v})` : ""}`,
          onclick: () => { if (u.id === c.id || st.sel === u.id) { if (u.id !== c.id) go(u.id); else { st.sel = u.id; drawInfo(); } } else { st.sel = u.id; Sound.sfx("click", 0.35); nodes.querySelectorAll(".rmNode.sel").forEach((e) => e.classList.remove("sel")); el.classList.add("sel"); drawInfo(); } } },
          h("img", { src: portrait(u), alt: "", draggable: "false" }));
        nodes.append(el);
        if (kind !== "outer" || st.call) {
          const callTxt = st.call && L && typeof callOf === "function" ? callOf(c, u) : null;
          nodes.append(h("div", { class: `rmName ${kind}`, style: `left:${q.x}px;top:${q.y + q.s / 2 + 2}px` }, kind === "center" ? null : h("b", null, u.name), callTxt && callTxt !== u.name ? h("small", null, `「${callTxt}」`) : null));
        }
      };
      outer.forEach((o) => node(o.u, pos[o.u.id], "outer"));
      ring.forEach((r) => node(r.u, pos[r.u.id], "ring"));
      node(c, pos[c.id], "center");

      // 왼쪽: 가운데 장수 + 범례
      const f = F(c.fac);
      legend.innerHTML = "";
      legend.append(h("div", { class: "rmHead" }, flag(f, true), h("b", null, c.full || c.name), h("small", null, f ? f.name : "재야")),
        h("div", { class: "rmMeta" }, `${perOf(c).type} · 야망 ${perOf(c).amb} · 의리 ${perOf(c).gi}`, squadName(c) ? h("div", null, `원작 부대: ${squadName(c)}`) : null),
        h("div", { class: "rmKeys" }, RM_LINE.map(([nm, col, w, dash]) => h("div", null, sv("svg", { width: 46, height: 10, viewBox: "0 0 46 10" }), h("span", null, nm))),
          h("div", null, sv("svg", { width: 46, height: 10, viewBox: "0 0 46 10" }), h("span", null, "원작 인연 (물결)"))),
        h("small", { class: "muted" }, ring.length ? `이어진 장수 ${ring.length}명${outer.length ? ` · 그 너머 ${outer.length}명` : ""}` : "아직 이어진 장수가 없다"));
      // 범례 선 그림 (선은 아래에서 직접 그린다)
      legend.querySelectorAll(".rmKeys svg").forEach((s, i) => {
        const add = (d, col, w, dash) => { const e = document.createElementNS(svgNS, "path"); e.setAttribute("d", d); e.setAttribute("stroke", col); e.setAttribute("stroke-width", w); e.setAttribute("fill", "none"); if (dash) e.setAttribute("stroke-dasharray", dash); s.append(e); };
        if (i < RM_LINE.length) { const [, col, w, dash] = RM_LINE[i]; if (i === 4) { add("M2,3 L44,3", col, 2); add("M2,7 L44,7", col, 2); } else add("M2,5 L44,5", col, Math.min(w, 4), dash ? "5 4" : ""); }
        else add("M2,5 L8,1 L14,9 L20,1 L26,9 L32,1 L38,9 L44,5", "#cfcfcf", 1.6);
      });
      drawInfo();
      // 아래: 표시 설정과 이동
      bar.innerHTML = "";
      bar.append(h("div", { class: "rmTogs" }, tog("call", "호칭 표시", "가운데 장수가 상대를 부르는 말 (원작 대본)"), tog("lv", "인연 단계", "지인 1 · 친우 2 · 막역지우 3 · 의자매 ★ · 적대 적 · 원수 원"), tog("ring2", "그 너머까지", "이웃 장수의 가까운 사이도 바깥에 그린다"), tog("orig", "원작 인연만", "원작에서 서로 부르던 사이만"), tog("fac", "같은 세력만", "가운데 장수와 같은 세력만")),
        h("div", { class: "rmNav" }, h("button", { disabled: !st.hist.length, onclick: back }, "◀ 뒤로"), h("button", { disabled: st.c === G.player, onclick: () => go(G.player) }, "나에게로"), h("button", { onclick: search }, "검색"), h("button", { onclick: () => { close(); UI.relModal(); } }, "목록"), h("button", { class: "primary", onclick: close }, "닫기")));
    }
    function drawInfo() {
      const c = U(st.c); const u = U(st.sel || st.c); const f = F(u.fac);
      info.innerHTML = "";
      const L = u.id !== c.id ? rmLink(c, u) : null;
      const sp = typeof SP === "function" ? SP(u.id) : null;
      const SNAME = { b: "반말", y: "해요체", h: "하십시오체", m: "군대식(~임다)", g: "하게체(~다네)", x: "고어·특수" };
      info.append(...[h("div", { class: "rmHead" }, flag(f, true), h("b", null, u.full || u.name), h("small", null, `${f ? f.name : "재야"} · ${statusOf(u)}`)),
        h("div", { class: "rmStats" }, STATS.map((k) => h("span", null, h("i", null, STAT_KO[k]), u.st[k]))),
        h("div", { class: "rmRow" }, h("i", null, "성격"), `${perOf(u).type} — ${PER_DESC[perOf(u).type]}`),
        h("div", { class: "rmRow" }, h("i", null, "야망·의리"), bar2(perOf(u).amb, "#e0564a"), bar2(perOf(u).gi, "#5fd0e6")),
        sp ? h("div", { class: "rmRow" }, h("i", null, "말투"), `${SNAME[sp.s] || "반말"} · 1인칭 「${sp.pr}」${sp.cmd ? ` · 사령관을 「${sp.cmd}」` : ""}`) : null,
        squadName(u) ? h("div", { class: "rmRow" }, h("i", null, "원작 부대"), squadName(u)) : null,
        h("div", { class: "rmRow" }, h("i", null, "있는 곳"), `${u.city}${u.sick ? " · 병상" : ""}`),
        L ? h("div", { class: "rmRel" }, h("h4", null, "관계"),
          h("div", { class: "rmRow" }, h("i", null, "단계"), h("b", { class: L.v < 0 ? "bad" : "gold" }, relStage(L.v, L.sworn)), ` (${L.v})${L.squad ? " · 같은 부대" : ""}`),
          h("div", { class: "rmRow" }, h("i", null, `→ ${c.name}`), `「${callOf(u, c)}」${REL(u.id, c.id) ? ` · 원작 ${REL(u.id, c.id).n}회` : ""}`),
          h("div", { class: "rmRow" }, h("i", null, `${c.name} →`), `「${callOf(c, u)}」${REL(c.id, u.id) ? ` · 원작 ${REL(c.id, u.id).n}회` : ""}`),
          L.orig ? h("div", { class: "rmRow" }, h("i", null, "원작 인연"), `한 장면에 함께 나온 대사 ${Math.max((REL(c.id, u.id) || {}).co || 0, (REL(u.id, c.id) || {}).co || 0)}줄`) : null) : null,
        h("div", { class: "rmBtns" }, u.id !== c.id ? h("button", { class: "primary mini", onclick: () => go(u.id) }, "가운데로") : null, h("button", { class: "mini", onclick: () => { close(); UI.unitDetail(u.id); } }, "장수 정보"))].filter(Boolean));
    }
    const bar2 = (v, col) => h("span", { class: "rmBar2" }, h("em", { style: `width:${v}%;background:${col}` }), h("small", null, v));
    window.addEventListener("resize", draw);
    draw(); setTimeout(() => root.focus(), 30);
  },
});
