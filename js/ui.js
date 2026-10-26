// 라스트오리진 삼국지 — 화면 (공통 · 타이틀 · 장수 선택 · 메인 · 모달)
"use strict";

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false && kid !== "") el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
function sv(tag, attrs, ...kids) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
  if (tag === "image") { e.dataset.rw = 1; imgRetry(e); }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Math.round(n).toLocaleString();
const GRADE_CLS = { 2: "gB", 3: "gA", 4: "gS", 5: "gSS" };

function face(u, size = 48, extra = "") {
  if (!u) return h("div", { class: `face generic ${extra}`, style: `width:${size}px;height:${size}px` }, "兵");
  const f = F(u.fac);
  return h("div", { class: `face ${GRADE_CLS[u.grade] || ""} ${extra}`, style: `width:${size}px;height:${size}px;--fc:${f ? f.color : "#77736a"}` },
    h("img", { src: portrait(u), alt: u.name, loading: "lazy", draggable: "false" }));
}
function sdface(u, size = 40, extra = "") {
  const src = u.iron ? `assets/enemy/${u.id}.webp` : `assets/sdface/${u.id}.webp`;
  return h("div", { class: "sdf " + extra, style: `width:${size}px;height:${size}px` }, h("img", { src, alt: u.name, loading: "lazy", draggable: "false" }));
}
function flag(f, small) {
  if (!f) return h("span", { class: "flag none" + (small ? " sm" : "") }, "無");
  return h("span", { class: "flag" + (small ? " sm" : ""), style: `--fc:${f.color}`, title: f.name },
    f.icon ? h("img", { src: `assets/troop/${f.icon}.webp`, alt: "" }) : f.flag);
}
function gradeBadge(u) { return u && u.grade ? h("span", { class: "grade " + GRADE_CLS[u.grade] }, GRADE_KO[u.grade]) : null; }
function typeTag(u) { return u && !u.iron && u.grade ? h("span", { class: "ttag" }, `${CLS_KO[u.cls]}·${ROLE_KO[u.role]}`) : null; }
function bar(v, max, cls = "") { return h("div", { class: "bar " + cls }, h("i", { style: `width:${clamp((v / max) * 100, 0, 100)}%` })); }
function statusOf(u) {
  if (!u.fac) return "재야";
  if (isLord(u)) return "군주";
  if (isGov(u)) return u.dudok === u.fac ? "도독" : "태수";
  return rankName(u);
}
// 화면에 쓸 글자에 해당하는 웹폰트 조각을 미리 받는다 (최대 2.5초 대기)
function fontsFor(text) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const t = Array.from(new Set(String(text))).join("");
  return Promise.race([Promise.all(['800 18px "Nanum Myeongjo"', '700 18px "Nanum Myeongjo"', '500 16px "Noto Sans KR"'].map((f) => document.fonts.load(f, t).catch(() => {}))), new Promise((r) => setTimeout(r, 2500))]);
}
// SD 무대의 세로 시야(월드 단위): 세로로 긴 화면에서는 가로 시야가 minW 이상이 되도록 넓힌다
function stageUnits(el, base, minW) { const w = el.clientWidth || 1, hh = el.clientHeight || 1; return Math.max(base, minW * hh / w); }
function icon(name, size = 22) { return h("img", { class: "ico", src: `assets/icon/${name}.webp`, style: `width:${size}px;height:${size}px`, alt: "" }); }

// 5각형 능력 레이더
function radar(st, size = 132, color = "#e9c46a") {
  const c = size / 2, r = size / 2 - 18;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v]; };
  const svg = sv("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: "radar" });
  for (const k of [0.25, 0.5, 0.75, 1]) svg.append(sv("polygon", { points: STATS.map((_, i) => pt(i, k).join(",")).join(" "), class: "rg" }));
  STATS.forEach((_, i) => { const [x, y] = pt(i, 1); svg.append(sv("line", { x1: c, y1: c, x2: x, y2: y, class: "rg" })); });
  svg.append(sv("polygon", { points: STATS.map((k, i) => pt(i, st[k] / 100).join(",")).join(" "), fill: color + "55", stroke: color, "stroke-width": 2 }));
  STATS.forEach((k, i) => { const [x, y] = pt(i, 1.24); svg.append(sv("text", { x, y: y + 4, class: "rl" }, STAT_KO[k])); });
  return svg;
}
function statRows(st, ex, u) {
  return h("div", { class: "stats" }, STATS.map((k) => {
    const bo = u && typeof eqBonus === "function" ? eqBonus(u, k) : 0; const base = st[k] - bo;
    return h("div", { class: "statRow" }, h("label", null, STAT_KO[k]),
      h("div", { class: "bar s-" + k }, h("i", { style: `width:${Math.min(100, base)}%` }), bo ? h("u", { style: `left:${Math.min(100, base)}%;width:${Math.min(100 - Math.min(100, base), bo)}%` }) : null, ex ? h("em", { style: `width:${ex[k]}%` }) : null),
      h("b", { class: st[k] >= 90 ? "hi" : "" }, base, bo ? h("sup", null, `+${bo}`) : null));
  }));
}

// 거점 시설: 원작 오르카 기지 시설 방 (tools/build_facility.py). 개발도에 따라 단계가 오른다
const FACILITY = [
  { key: "agri", name: "식량 생산실", lv: 3, stat: "농업", val: (c) => c.agri / cityMax(c).agri, hint: "농업 개발" },
  { key: "comm", name: "카페테리아 · 상업구", lv: 5, stat: "상업", val: (c) => c.comm / cityMax(c).comm, hint: "상업 개발" },
  { key: "tech", name: "부품 공방", lv: 3, stat: "기술", val: (c) => c.tech / 1000, hint: "기술 개발" },
  { key: "train", name: "훈련실 · 병영", lv: 5, stat: "병력", val: (c) => c.troops / (12000 + c.size * 8000), hint: "징병" },
  { key: "def", name: "무기고 · 방벽", lv: 3, stat: "방어", val: (c) => c.def / cityMax(c).def, hint: "방벽 보수" },
  { key: "order", name: "정비 공장 · 치안", lv: 3, stat: "치안", val: (c) => c.order / 100, hint: "치안 순찰" },
];
const facLevel = (f, c) => facLv(c, f.key);

const UI = {
  meFold: true,
  sel: null, tab: "dev", step: 0, selFac: null, pickId: null, diff: 1,

  show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("on", s.id === id));
    if (id !== "title" && this.titleStage) { this.titleStage.destroy(); this.titleStage = null; }
  },

  // ── 타이틀 ─────────────────────────
  title() {
    this.show("title");
    $("#btnContinue").disabled = !hasSave();
    let clears = 0; try { clears = +(localStorage.getItem("lao3k_clear") || 0); } catch (er) {}
    $("#clearInfo").textContent = clears ? `클리어 ${clears}회 · 다회차 보너스 적용 중` : "";
    Sound.bgm("title");
    if (!this.titleStage && typeof Stage !== "undefined" && Stage.ok) {
      const st = this.titleStage = Stage.create($("#titleStage"), { height: 9 });
  const cast = ["BR_Leona", "3P_Labiata", "PECS_Empress", "3P_ConstantiaS2", "BR_Valkyrie", "ST_Tiamat", "DS_Azazel"];
      const n = cast.length;
      cast.forEach((code, i) => {
        const x = (i - (n - 1) / 2) * 2.1 * (st.w / st.h > 1.2 ? 1 : 0.6);
        st.add(code, x * 1.25, -3.7 + Math.abs(i - (n - 1) / 2) * 0.32, 3.3 - Math.abs(i - (n - 1) / 2) * 0.15, i < n / 2 ? 1 : -1, { z: 10 - Math.abs(i - 3) });
      });
      this.titleStage.actors.forEach((a, i) => setTimeout(() => this.titleStage && this.titleStage.play(a, "win", false), 1200 + i * 350));
    }
  },

  prologue() {
    this.show("prologue");
    Sound.bgm("event");
    const box = $("#prologueText"); box.innerHTML = "";
    STORY.prologue.forEach((t, i) => box.append(h("p", { style: `animation-delay:${0.3 + i * 1.6}s` }, t)));
    $("#prologueNext").textContent = "장수 선택 ▶";
    $("#prologueNext").onclick = () => { Sound.sfx("open"); UI.step = 0; UI.select(); };
  },

  // ── 장수 선택 ───────────────────────
  facMembers(fr) {
    if (!fr) return Object.keys(LAO_PC);
    const sq = {}; LAO_SQUADS.forEach((q) => (sq[q.key] = q));
    return [...new Set([fr.lord, ...(fr.squads || []).flatMap((k) => (sq[k] ? sq[k].members : [])), ...(fr.extra || [])])].filter((c) => LAO_PC[c]);
  },

  select() {
    this.show("select");
    Sound.bgm("select");
    const body = $("#selBody"); body.innerHTML = "";
    $("#selTitle").textContent = this.step === 0 ? "세력 선택" : "장수 선택";
    $("#selBack").onclick = () => { Sound.sfx("close"); if (this.step === 1) { this.step = 0; this.select(); } else this.title(); };
    $("#selSearch").style.display = this.step === 1 ? "" : "none";
    if (this.step === 0) {
      const grid = h("div", { class: "facGrid" });
      for (const fr of FACTIONS_RAW.filter((f) => !f.iron)) {
        const sq = LAO_SQUADS.find((q) => q.key === fr.squads[0]);
        const lordName = LAO_PC[fr.lord] ? LAO_PC[fr.lord].n : fr.lord;
        grid.append(h("button", { class: "facCard", style: `--fc:${fr.color}`, onclick: () => { Sound.sfx("click"); this.selFac = fr.key; this.step = 1; this.pickId = fr.lord; this.select(); Sound.voice(fr.lord, "Leader", ["Join"]); } },
          h("div", { class: "fcTop" }, h("img", { class: "fcIcon", src: `assets/troop/${fr.icon}.webp`, alt: "" }), h("img", { class: "fcLord", src: `assets/sdface/${fr.lord}.webp`, alt: "" })),
          h("b", null, fr.name), h("small", null, `군주 ${lordName}`),
          h("p", null, `“${fr.motto}”`),
          h("div", { class: "fcMeta" }, h("span", null, `거점 ${fr.cities.length}`), h("span", null, `장수 ${this.facMembers(fr).length}`))));
      }
      grid.append(h("button", { class: "facCard free", onclick: () => { Sound.sfx("click"); this.selFac = null; this.step = 1; this.pickId = null; this.select(); } },
        h("div", { class: "fcTop" }, h("img", { class: "fcIcon", src: "assets/troop/All.webp", alt: "" })),
        h("b", null, "자유 장수"), h("small", null, "아무 장수로 재야에서 시작"), h("p", null, "“어느 깃발 아래 설지는 내가 정한다.”"), h("div", { class: "fcMeta" }, h("span", null, `장수 ${Object.keys(LAO_PC).length}`))));
      body.append(grid);
      return;
    }
    const fr = FACTIONS_RAW.find((f) => f.key === this.selFac);
    const wrap = h("div", { class: "selSplit" });
    const grid = h("div", { class: "selGrid" });
    const q = ($("#selSearch").value || "").trim();
    let list = this.facMembers(fr);
    if (q) list = list.filter((c) => (LAO_PC[c].n + (UNITS_RAW.find((x) => x[0] === c) || [])[1]).includes(q));
    list.sort((a, b) => (b === (fr && fr.lord)) - (a === (fr && fr.lord)) || LAO_PC[b].g - LAO_PC[a].g);
    for (const code of list) {
      const o = LAO_PC[code];
      const raw = UNITS_RAW.find((x) => x[0] === code); if (!raw) continue;
      grid.append(h("button", { class: "pick " + (GRADE_CLS[o.g] || "") + (this.pickId === code ? " on" : ""), onclick: () => { this.pickId = code; Sound.sfx("click", 0.5); Sound.voice(code, "Join", ["Intro"]); this.select(); } },
        h("img", { src: `assets/portrait/${code}.webp`, loading: "lazy", alt: "" }),
        fr && fr.lord === code ? h("b", { class: "crown" }, "君") : null,
        h("span", { class: "grade " + GRADE_CLS[o.g] }, GRADE_KO[o.g]),
        h("em", null, raw[1])));
    }
    wrap.append(grid, this.selDetail(fr));
    body.append(wrap);
  },

  selDetail(fr) {
    const d = h("aside", { class: "selDetail card" });
    if (!this.pickId) { d.append(h("p", { class: "muted" }, "플레이할 장수를 고르세요.")); return d; }
    const code = this.pickId; const o = LAO_PC[code]; const raw = UNITS_RAW.find((x) => x[0] === code);
    const stArr = genStats(code, raw[2]); const st = {}; STATS.forEach((k, i) => (st[k] = stArr[i]));
    const sk = genSkills(stArr, code);
    const sq = LAO_SQUADS.find((q) => q.members.includes(code));
    const isL = fr && fr.lord === code;
    const ronin = !fr;
    const add = (...xs) => d.append(...xs.filter((x) => x !== null && x !== undefined && x !== false));
    add(
      h("div", { class: "selHead" }, h("div", { class: "bigPortrait " + GRADE_CLS[o.g] }, h("img", { src: `assets/portrait/${code}.webp` })),
        h("div", null, h("div", { class: "nameRow" }, h("span", { class: "grade lg " + GRADE_CLS[o.g] }, GRADE_KO[o.g]), h("h2", null, o.n)),
          h("div", { class: "muted" }, `${CLS_KO[o.c]}형 ${ROLE_KO[o.r]}`),
          sq ? h("div", { class: "squadTag" }, h("img", { src: `assets/troop/${sq.icon}.webp` }), sq.name) : null,
          h("div", { class: "skills" }, sk.map((s) => h("span", { class: "skill", title: SKILLS[s] }, s))))),
      h("div", { class: "radarRow" }, radar(st, 150, fr ? fr.color : "#e9c46a"), statRows(st)),
      o.join ? h("blockquote", { class: "quote" }, `“${o.join}”`, Sound.hasVoice(code) ? h("button", { class: "mini voiceBtn", title: "보이스", onclick: () => Sound.voice(code, "Join", ["Intro"]) }, "▶") : null) : null,
      h("div", { class: "startRole" }, ronin ? "재야에서 시작합니다." : isL ? `${fr.name}의 군주로 시작합니다.` : `${fr.name} 소속 장수로 시작합니다. (원작 부대원 일부는 재야에 흩어져 있습니다)`),
      h("div", { class: "seg" }, DIFF.map((df, i) => h("button", { class: this.diff === i ? "on" : "", onclick: () => { this.diff = i; this.select(); } }, df.name))),
      (() => { let n = 0; try { n = +(localStorage.getItem("lao3k_clear") || 0); } catch (er) {} return n ? h("div", { class: "ngBadge" }, `★ ${n + 1}회차 보너스 — 시작 자금 +${300 * Math.min(3, n)}, 장비 1개`) : null; })(),
      h("button", { class: "primary big", onclick: () => this.begin(ronin) }, "이 장수로 시작"));
    return d;
  },

  begin(ronin) {
    Sound.sfx("start");
    newGame(this.pickId, { diff: this.diff, ronin });
    if (typeof rtInit === "function") { rtInit(); this.rtStart(); } // 실시간 진행
    let clears = 0; try { clears = +(localStorage.getItem("lao3k_clear") || 0); } catch (er) {}
    if (clears > 0) { P().gold += 300 * Math.min(3, clears); gainItem(randItem([0, 30, 50, 20]), `다회차 보너스 (클리어 ${clears}회)`); }
    this.sel = P().city;
    this.show("main");
    Sound.bgm("map");
    const p = P();
    notify("시작", p.fac ? (isLord(p) ? `${F(p.fac).name}의 군주로서 천하통일을 목표로 하라.\n\n· 지도에서 거점을 눌러 정보를 확인\n· 오른쪽 명령으로 내정·출진·외교\n· 행동력을 다 쓰면 「다음 달」` : `${F(p.fac).name}의 장수로서 공적을 쌓아 출세하라.\n\n· 매달 평정에서 임무를 받아 달성하면 큰 공적\n· 공적이 쌓이면 승진, 태수 임명, 독립도 가능`) : `재야의 몸으로 시작한다.\n\n· 탐방·교류로 인맥을 쌓고\n· 마음에 드는 세력에 사관하거나\n· 명성(공적) 400 이상이면 빈 거점에서 거병할 수 있다.`, p.id, isLord(p) ? "Leader" : "StageStart");
    if (typeof checkStoryEvents === "function") {
      checkStoryEvents();
      const dl = G.queue.filter((x) => x.type === "dialog");
      G.queue = G.queue.filter((x) => x.type !== "dialog");
      if (dl.length) G.queue.unshift({ type: "dialog", bg: dl[0].bg, squad: dl.find((x) => x.squad) ? dl.find((x) => x.squad).squad : null, lines: dl.flatMap((x) => x.lines) });
    }
    this.render(); this.flush();
  },

  // 세력 거점을 지도에서 강조
  focusFaction(fk) {
    const cs = citiesOf(fk); if (!cs.length) return;
    this.sel = cs.sort((a, b) => b.size - a.size)[0].name; this.render();
    document.querySelectorAll("#map .city").forEach((g) => g.classList.remove("flashF"));
    const names = new Set(cs.map((c) => c.name));
    document.querySelectorAll("#map .city").forEach((g, i) => { const c = Object.values(G.cities)[i]; if (c && names.has(c.name)) g.classList.add("flashF"); });
    this.toast(`${F(fk).name} 거점 ${cs.length}곳`, "");
    document.querySelectorAll(".focusChip").forEach((n) => n.remove());
    const chip = h("button", { class: "focusChip", onclick: () => { chip.remove(); document.querySelectorAll("#map .city").forEach((g) => g.classList.remove("flashF")); } }, `강조 중: ${F(fk).name} · 해제 ✕`);
    $("#mapWrap").append(chip);
    setTimeout(() => chip.isConnected && chip.click(), 12000);
  },

  // ── 도시 보기 ─────────────────────
  cityView(name) {
    const c = C(name); const f = F(c.owner); const gov = U(c.gov); const p = P(); const mx = cityMax(c);
    Sound.sfx("open", 0.6);
    const el = h("div", { class: "cityView", style: `--bg:url(assets/city/${CITY_BG[name]}.jpg);--fc:${f ? f.color : "#8a8372"}` });
    const stage = h("div", { class: "cvStage" }, h("div", { class: "cvLabels" }));
    let st = null;
    const close = () => { if (st) st.destroy(); el.remove(); Sound.stopAmb(); };
    Sound.amb("amb_wind");
    const here = unitsIn(name).sort((a, b) => (isLord(b) - isLord(a)) || ((b.fac === c.owner) - (a.fac === c.owner)) || b.merit - a.merit);
    const enemyHidden = f && f.iron && name !== p.city && !neighbors(p.city).includes(name);
    const shown = enemyHidden ? [] : here.slice(0, 9);
    const adj = neighbors(p.city).includes(name);
    const row = (k, v, m) => h("div", { class: "statRow" }, h("label", null, k), bar(v, m, "cb"), h("b", null, fmt(v)));
    el.append(
      h("div", { class: "cvTop" }, flag(f), h("div", null, h("h2", null, name), h("small", null, `${f ? f.name : "공백지"}${gov ? " · 태수 " + gov.name : ""} · ${["", "소", "중", "대"][c.size]}거점`)),
        h("div", { class: "seg cvTabs" },
          h("button", { class: "on", onclick: (e) => { el.classList.remove("fac"); Sound.amb("amb_wind"); e.target.parentNode.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); } }, "거리"),
          h("button", { onclick: (e) => { el.classList.add("fac"); Sound.sfx("build", 0.5); Sound.amb("amb_machine"); e.target.parentNode.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); } }, "시설")),
        h("button", { class: "cvClose", onclick: close }, "닫기 ✕")),
      stage,
      h("div", { class: "cvFac" }, FACILITY.map((fd) => {
        const lv = facLevel(fd, c); const pct = clamp(fd.val(c), 0, 1);
        const devKey = { agri: "agri", comm: "comm", tech: "tech", train: "draft", def: "def", order: "order" }[fd.key];
        const canDev = p.fac && c.owner === p.fac && p.city === name;
        return h("div", { class: "room" + (canDev ? " act" : ""), "data-cost": canDev ? `▶ ${DEV[devKey].ko} · 행동력 ${COST.dev}${devKey === "draft" ? "" : " · 자금 50"}` : null, title: canDev ? `누르면 ${DEV[devKey].ko} (행동력 ${COST.dev})` : FAC_BONUS[fd.key], onclick: canDev ? () => { actDev(devKey); close(); this.after(); this.cityView(name); setTimeout(() => { const t = document.querySelectorAll(".cvTabs button")[1]; t && t.click(); }, 30); } : null },
          h("img", { src: `assets/facility/${fd.key}_${lv}.webp`, alt: "" }),
          h("div", { class: "roomInfo" }, h("b", null, fd.name), h("span", { class: "lv" }, `Lv.${lv}`, h("small", null, ` / ${fd.lv}`)),
            h("div", { class: "lvDots" }, Array.from({ length: fd.lv }, (_, i) => h("i", { class: i < lv ? "on" : "" }))),
            bar(pct * 100, 100, "cb"), h("small", { class: "muted" }, lv >= fd.lv ? `${fd.stat} ${Math.round(pct * 100)}% · 최고 단계` : `${fd.stat} ${Math.round(pct * 100)}% · 다음 단계까지 ${Math.max(1, Math.ceil((lv / fd.lv - pct) * 100))}%`), h("small", { class: "facBonus" + (lv >= (fd.key === "comm" || fd.key === "train" ? 4 : 3) ? " on" : "") }, FAC_BONUS[fd.key])));
      })),
      h("div", { class: "cvInfo" },
        h("div", { class: "cnums" }, h("div", null, h("i", null, "병력"), h("b", null, fmt(c.troops))), h("div", null, h("i", null, "자금"), h("b", null, fmt(c.gold))), h("div", null, h("i", null, "식량"), h("b", null, fmt(c.food)))),
        row("농업", c.agri, mx.agri), row("상업", c.comm, mx.comm), row("기술", c.tech, mx.tech), row("치안", c.order, 100), row("방어", c.def, mx.def),
        h("div", { class: "btns" },
          (() => { const mv = this.moveInfo(name); return mv ? h("button", { disabled: !!mv.reason, title: mv.reason || mv.title, onclick: () => { close(); this.doMove(name); } }, mv.label) : null; })(),
          adj && canCommand(p) && c.owner !== p.fac ? h("button", { class: "primary", onclick: () => { close(); this.sel = name; this.warSetup(false); } }, "출진") : null)),
      h("div", { class: "cvList" }, enemyHidden ? h("span", { class: "muted" }, "철충 지역 — 정보 없음") : here.map((u) => h("button", { class: "chip" + (u.fac ? "" : " free"), onclick: () => this.unitDetail(u.id) }, sdface(u, 40), h("span", null, u.name)))));
    document.body.append(el);
    if (typeof Stage !== "undefined" && Stage.ok && shown.length) {
      const narrow = stage.clientWidth < 600;
      st = Stage.create(stage, { height: stageUnits(stage, 8, 9) });
      const yb = st.camera ? st.camera.bottom : -4; // 무대 바닥 (세로 화면에서는 무대가 높아진다)
      const n = narrow ? Math.min(shown.length, 8) : shown.length; const split = narrow ? 4 : 6;
      const lab = stage.querySelector(".cvLabels");
      shown.slice(0, n).forEach((u, i) => {
        const W = st.camera ? st.camera.right - st.camera.left : 14;
        const back = n > split && i >= Math.ceil(n / 2); const rowN = n > split ? (back ? n - Math.ceil(n / 2) : Math.ceil(n / 2)) : n; const j = back ? i - Math.ceil(n / 2) : i;
        const gap = Math.min(2.6, (W * 0.74) / Math.max(1, rowN - 1 || 1));
        const x = (j - (rowN - 1) / 2) * gap + (back ? gap / 2 : 0);
        const y = yb + (back ? 2.9 : 1.4);
        const a = st.add(u.id, x, y, (isLord(u) ? 2.6 : 2.25) * (back ? 0.82 : 1), x <= 0 ? 1 : -1, { z: back ? 5 : 12 });
        const tag = h("div", { class: "cvTag" + (isLord(u) ? " lord" : "") + (u.fac ? "" : " free"), onclick: () => this.unitDetail(u.id) }, gradeBadge(u), h("b", null, u.name), h("small", null, statusOf(u)));
        lab.append(tag);
        if (back) tag.classList.add("back");
        const pos = () => { if (!st || !st.alive) return; const q = back ? st.toScreen(a.x, a.y + a.h * 1.02) : st.toScreen(a.x, a.y - 0.15); const qx = Math.max(44, Math.min(st.w - 44, q.x)); /* 좁은 화면에서 이름표가 잘리지 않게 */ tag.style.transform = `translate(${qx}px, ${back ? q.y - 44 : q.y}px)`; requestAnimationFrame(pos); };
        requestAnimationFrame(pos);
        setTimeout(() => st && st.alive && st.play(a, Math.random() < 0.5 ? "win" : "idle"), 600 + i * 220);
      });
      if (shown[0] && Math.random() < 0.7) Sound.voice(shown[0].id, isLord(shown[0]) ? "Leader" : "Intro", ["Join"]);
    }
    el.tabIndex = 0; el.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); }); setTimeout(() => el.focus(), 20);
  },

  // ── 대화 장면 (비주얼 노벨 형식) ─────
  dialog(e) {
    return new Promise(async (res) => {
      // 등장인물 이미지를 먼저 불러온다 (깨진 이미지 방지)
      const speakers = [...new Set(e.lines.filter((L) => L.who).map((L) => L.who))].map(U).filter(Boolean);
      const pre = (src) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = src; });
      await Promise.race([Promise.all([fontsFor(e.lines.map((l) => l.text || "").join("")), ...[`assets/bg/${e.bg || "city"}.jpg`, ...speakers.map(portrait), ...(e.squad ? [`assets/troop/${e.squad}.webp`] : [])].map(pre)]), new Promise((r) => setTimeout(r, 2500))]);
      const el = h("div", { class: "vn", style: `--bg:url(${e.bgUrl || `assets/bg/${e.bg || "city"}.jpg`})` });
      const ironScene = e.lines.some((L) => L.who && U(L.who) && U(L.who).iron);
      { const bgk = e.bgUrl || e.bg || ""; Sound.amb(/facility\//.test(bgk) ? "amb_machine" : /field|story_signal|story_beacon|city\//.test(bgk) ? "amb_wind" : null); }
      if (ironScene) Sound.bgm("boss"); else if (e.bgm) Sound.bgm(e.bgm); else if (e.bgUrl && /facility\/(?!train)/.test(e.bgUrl)) Sound.sfx("fanfare", 0.7);
      const stageBox = h("div", { class: "vnStage" });
      const content = h("div", { class: "vnContent" });
      el.append(stageBox, content);
      document.body.append(el);
      const st = typeof Stage !== "undefined" && Stage.ok ? Stage.create(stageBox, { height: stageUnits(stageBox, 8, 7.2) }) : null;
      const yb = st && st.camera ? st.camera.bottom + 0.1 : -3.9; // 무대 바닥 (세로 화면에서는 무대가 높아진다)
      if (st && window.SD) await Promise.race([Promise.all(speakers.map((u) => Stage.rigOf(u.id)).filter(Boolean).map((id) => SD.prepare(id))), new Promise((r) => setTimeout(r, 2500))]);
      const actors = {};
      // 말하는 사람마다 자리를 하나씩: 처음 나온 사람 왼쪽, 다음 사람 오른쪽 (줄 순서와 상관없이 겹치지 않게)
      const sideOf = {}; const SLOTS = [-1, 1, -1.55, 1.55, 0];
      const slotFor = (id) => { if (!(id in sideOf)) { const used = Object.values(sideOf); sideOf[id] = SLOTS.find((x) => !used.includes(x)) ?? (Object.keys(sideOf).length % 2 ? 1 : -1); } return sideOf[id]; };
      if (st && e.cast) { const W = st.camera.right - st.camera.left; e.cast.forEach((id, k) => { if (!U(id) || !Stage.rigOf(id)) return; const side = slotFor(id); const a = actors[id] = st.add(id, side * W * 0.27, yb, 5.4, side > 0 ? -1 : 1, { z: 10 }); setTimeout(() => a.sd && a.sd.setTint(0.38, 0.38, 0.44), 50); }); }
      let i = 0, typing = null;
      const lines = e.lines;
      // 선택지(L.choices)가 남은 채 건너뛰면 마지막 선택지(무난한 쪽)로 정한다
      const settle = () => { for (let k = i; k < lines.length; k++) { const C2 = lines[k].choices; if (!C2 || lines[k].picked) continue; lines[k].picked = true; const d = C2.find((c) => c.def) || C2[C2.length - 1]; lines.splice(k + 1, 0, ...((d.go && d.go()) || []).filter(Boolean)); } };
      const finish = () => { if (finish.done) return; finish.done = true; settle(); clearInterval(typing); el.classList.add("out"); Sound.stopAmb(); if ((ironScene || e.bgm) && G) this.mapBgm(); setTimeout(() => { if (st) st.destroy(); el.remove(); res(); }, 260); };
      const show = () => {
        if (i >= lines.length) return finish();
        const L = lines[i];
        const u = L.who ? U(L.who) : null;
        const f = u ? F(u.fac) : null;
        const side = u ? slotFor(u.id) : -1;
        content.innerHTML = "";
        const useSd = st && u && Stage.rigOf(u.id) && SD.ready(Stage.rigOf(u.id));
        if (st) {
          // 말하는 SD는 밝게, 나머지는 어둡게
          for (const k in actors) { const a = actors[k]; if (a.sd) a.sd.setTint(0.38, 0.38, 0.44); a.y = yb; }
          if (useSd) {
            let a = actors[u.id];
            if (!a) {
              const W = st.camera.right - st.camera.left;
              a = actors[u.id] = st.add(u.id, side * W * 0.27, yb, 5.4, side > 0 ? -1 : 1, { z: 10 });
              st.play(a, "win");
            }
            if (a.sd) a.sd.setTint(1, 1, 1);
            a.y = yb + 0.15;
            if (L.voice) st.play(a, Math.random() < 0.5 ? "win" : "atk");
          }
        }
        if (u && !useSd) content.append(h("div", { class: "vnChar " + (side > 0 ? "r" : "l"), style: `--fc:${f ? f.color : "#c9b07a"}` }, h("img", { src: portrait(u) })));
        if (e.squad && i === 0) content.append(h("img", { class: "vnSquad", src: `assets/troop/${e.squad}.webp` }));
        const txt = h("p", { class: "vnText" + (u ? "" : " narr") });
        content.append(h("div", { class: "vnBox", style: `--fc:${f ? f.color : "#c9b07a"}` },
          u ? h("div", { class: "vnName" }, useSd ? h("img", { class: "vnFace", src: portrait(u) }) : null, gradeBadge(u), h("b", null, u.full || u.name), f ? h("small", null, f.name) : null) : null,
          txt, L.choices ? h("div", { class: "vnChoices" }, L.choices.map((c, k) => h("button", { class: "vnChoice", onclick: (ev) => { ev.stopPropagation(); choose(k); } }, h("b", null, `${k + 1}`), h("span", null, c.t), c.sub ? h("small", null, c.sub) : null))) : h("div", { class: "vnNext" }, `${i + 1} / ${lines.length}  ▼`)),
          h("button", { class: "vnSkip", onclick: (ev) => { ev.stopPropagation(); finish(); } }, "건너뛰기 ▶▶"));
        if (u && L.voice) Sound.voice(u.id, L.voice, /^Idle_/.test(L.voice) ? [] : ["Join", "Intro", "Leader"]);
        let n = 0; clearInterval(typing);
        typing = setInterval(() => { n += 2; txt.textContent = L.text.slice(0, n); if (n >= L.text.length) { clearInterval(typing); typing = null; } }, 22);
        el.dataset.full = L.text;
      };
      const choose = (k) => {
        const L = lines[i]; if (!L || !L.choices || L.picked || !L.choices[k]) return;
        L.picked = true; clearInterval(typing); typing = null;
        lines.splice(i + 1, 0, ...((L.choices[k].go && L.choices[k].go()) || []).filter(Boolean));
        Sound.sfx("click", 0.5); i++; show();
      };
      el.addEventListener("click", () => {
        if (typing) { clearInterval(typing); typing = null; el.querySelector(".vnText").textContent = el.dataset.full; return; }
        if (lines[i] && lines[i].choices) return; // 선택지를 고를 때까지 넘어가지 않는다
        Sound.sfx("click", 0.4); i++; show();
      });
      el.tabIndex = 0; el.addEventListener("keydown", (ev) => { if (/^[1-4]$/.test(ev.key)) { if (typing) el.click(); choose(+ev.key - 1); return; } if (ev.key === "Enter" || ev.key === " ") el.click(); if (ev.key === "Escape") finish(); });
      show(); setTimeout(() => el.focus(), 30);
    });
  },

  // ── 메인 렌더 ───────────────────────
  render() {
    if (!G) return;
    this.renderHeader(); this.renderMap(); this.renderSide(); this.renderPop();
  },

  renderHeader() {
    const p = P(); const f = F(p.fac);
    { const mw = $("#mapWrap"); if (mw) mw.dataset.season = ["", "winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"][G.month]; }
    $("#hdrDate").innerHTML = ""; $("#hdrDate").append(h("b", null, `${STORY.era} ${G.year}년`), h("span", null, `${G.month}월 ${typeof dayNow === "function" ? (dayNow() % 30) + 1 : 1}일`), h("small", null, ["", "겨울", "겨울", "봄", "봄", "봄", "여름", "여름", "여름", "가을", "가을", "가을", "겨울"][G.month]));
    $("#hdrFac").innerHTML = ""; $("#hdrFac").append(flag(f, true), h("span", null, f ? f.name : "재야"));
    const now = G.year * 12 + G.month;
    if (G.flags.feastUntil && G.flags.feastUntil >= now) $("#hdrFac").append(h("em", { class: "buffChip", title: "승전 축하연: 전투 사기 +10 (이번 달 포함)" }, `축하연 ${G.flags.feastUntil - now + 1}개월 남음`));
    if (G.flags.forceUntil && G.flags.forceUntil >= now) $("#hdrFac").append(h("em", { class: "buffChip", title: "무력 통일 노선: 아군 전투 사기 +5 (이번 달 포함)" }, `진격 결의 ${G.flags.forceUntil - now + 1}개월 남음`));
    const ttl = typeof activeTitle === "function" && activeTitle(); if (ttl) $("#hdrFac").append(h("em", { class: "buffChip title", title: `칭호 효과: ${ttl.d} (세력 행사 「${ttl.key}」 ${ttl.n}회)` }, ttl.t));
    if (G.flags.allianceVs && G.flags.allianceVs.until > now) $("#hdrFac").append(h("em", { class: "buffChip", title: "대동맹: 위협 세력 공세 감소 (이번 달 포함)" }, `대동맹 ${G.flags.allianceVs.until - now}개월 남음`));
    const ap = $("#apBar"); ap.innerHTML = "";
    const seg = h("div", { class: "apSeg" }); for (let i = 0; i < 10; i++) seg.append(h("i", { class: G.ap >= (i + 1) * 10 ? "on" : G.ap > i * 10 ? "half" : "" }));
    ap.append(h("span", null, "행동력"), seg, h("b", null, G.ap));
    $("#hdrGold").textContent = fmt(p.gold);
    const owned = p.fac ? citiesOf(p.fac).length : 0;
    $("#hdrUnify").innerHTML = ""; $("#hdrUnify").append(h("i", null, "통일"), h("b", null, `${owned}/32`), h("div", { class: "uniBar" }, h("i", { style: `width:${owned / 32 * 100}%` })));
    $("#btnDiplo").style.display = isLord(p) ? "" : "none";
    $("#btnSound").textContent = Sound.pref.muted ? "🔇" : "🔊";
    document.body.classList.toggle("rtOn", !!G.rt);
    if (G.rt) { $("#hdrDate").append(h("span", { id: "rtDayBar", title: "이번 달 진행" }, h("i", { style: `width:${(G.day || 0) / 30 * 100}%` }))); this.rtControls && this.rtControls(); }
  },

  renderMap() {
    const svg = $("#map"); svg.innerHTML = "";
    const p = P();
    // 빈 곳을 누르면 거점 정보 카드를 닫는다
    if (!svg.dataset.popClose) { svg.dataset.popClose = 1; svg.addEventListener("click", (e) => { if (!e.target.closest(".city") && this.popCity) this.closePop(); }); }
    svg.append(sv("defs", {}, ...[
      `<filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>`,
      `<filter id="ds" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".8"/></filter>`,
      `<radialGradient id="glow"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".75"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>`,
      `<clipPath id="cc"><circle r="1"/></clipPath>`,
      `<marker id="arr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker>`,
    ].map((x) => { const t = document.createElement("template"); t.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${x}</svg>`; return t.content.firstChild.firstChild; })));
    // 원화와 도시가 동일한 좌표계를 사용하므로 화면 비율이 달라도 위치가 어긋나지 않는다.
    svg.append(sv("image", { href: "assets/bg/world-map.webp", x: 0, y: 0, width: 1060, height: 740, preserveAspectRatio: "none", class: "mapArtwork" }));
    // 영역 색은 도시 주변의 얇은 테두리로 표시해 지형 원화를 가리지 않는다.
    const halo = sv("g", { class: "halo" });
    for (const c of Object.values(G.cities)) { const f = F(c.owner); if (f) halo.append(sv("circle", { cx: c.x, cy: c.y, r: 30 + c.size * 4, fill: f.color, "fill-opacity": 0.09, stroke: f.color, "stroke-opacity": 0.45, "stroke-width": 1.5 })); }
    svg.append(halo);
    const hot = this.sel;
    for (const [a, b] of ROADS) {
      const A = C(a), B = C(b);
      const cls = A.name === p.city || B.name === p.city ? " here" : A.name === hot || B.name === hot ? " hot" : "";
      svg.append(sv("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: "road" + cls }));
    }
    // 이번 달 전쟁 화살표
    for (const w of G.lastWars || []) {
      const A = C(w.from), B = C(w.to); const f = F(w.fac); if (!A || !B || !f) continue;
      const mx = (A.x + B.x) / 2 + (B.y - A.y) * 0.18, my = (A.y + B.y) / 2 - (B.x - A.x) * 0.18;
      svg.append(sv("path", { d: `M${A.x} ${A.y} Q${mx} ${my} ${B.x} ${B.y}`, class: "warArrow" + (w.win ? " win" : ""), stroke: f.color, "marker-end": "url(#arr)" }));
    }
    for (const c of Object.values(G.cities)) {
      const f = F(c.owner);
      const r = 12 + c.size * 3.5;
      const g = sv("g", { transform: `translate(${c.x},${c.y})`, class: "city" + (this.sel === c.name ? " sel" : "") + (c.name === p.city ? " here" : "") + (f && f.iron ? " iron" : "") });
      g.dataset.city = c.name;
      g.addEventListener("click", () => { Sound.sfx("click", 0.5); this.sel = c.name; this.popCity = c.name; this.popTab = "city"; this.tip(null); this.render(); });
      g.addEventListener("dblclick", () => this.cityView(c.name));
      g.addEventListener("mouseenter", (e) => this.tip(e, c));
      g.addEventListener("mousemove", (e) => this.tip(e, c));
      g.addEventListener("mouseleave", () => this.tip(null));
      if (this.sel === c.name) g.append(sv("circle", { r: r + 22, fill: "url(#glow)", class: "pulse" }));
      const th = threatFaction(); if (th && c.owner === th.key) g.append(sv("circle", { r: r + 8, class: "threatRing" }));
      if (th && !G.flags["thSnd_" + th.key]) { G.flags["thSnd_" + th.key] = true; Sound.sfx("warn", 0.7); G.flags.tenseUntil = G.year * 12 + G.month + 3; Sound.bgm("tense"); }
      g.append(sv("circle", { r: r + 3, class: "ring" + (f ? "" : " emptyRing"), stroke: f ? f.color : "#77736a" }));
      g.append(sv("circle", { r, class: "core" }));
      if (f && f.icon) { // 이미지가 뜰 때까지 깃발 글자를 먼저 보여 준다
        const fb = sv("text", { y: 5, class: "fl", fill: f.color }, f.flag); g.append(fb);
        const im = sv("image", { href: `assets/troop/${f.icon}.webp`, x: -r * 0.72, y: -r * 0.72, width: r * 1.44, height: r * 1.44, class: "cicon" });
        im.addEventListener("load", () => fb.remove()); g.append(im);
      }
      else g.append(sv("text", { y: 5, class: "fl" + (f ? "" : " empty"), fill: f ? f.color : "#9a958a" }, f ? f.flag : "공"));
      const pw = Math.max(46, c.name.length * 12 + 12);
      g.append(sv("rect", { x: -pw / 2, y: r + 6, width: pw, height: 17, rx: 3, class: "plate" }));
      g.append(sv("text", { y: r + 18.5, class: "nm" }, c.name));
      const tw = Math.min(pw - 6, (c.troops / 30000) * (pw - 6));
      g.append(sv("rect", { x: -pw / 2 + 3, y: r + 21, width: Math.max(2, tw), height: 2.5, fill: f ? f.color : "#888", opacity: 0.9 }));
      // 군주 SD 얼굴
      const lordHere = f && !f.iron && U(f.lord) && U(f.lord).city === c.name && U(f.lord).id !== p.id;
      if (lordHere) {
        const lg = sv("g", { transform: `translate(${-r - 6},${-r - 6})`, class: "lordMk" });
        lg.append(sv("circle", { r: 13, fill: "#0b0d10", stroke: f.color, "stroke-width": 2 }));
        lg.append(sv("image", { href: `assets/sdface/${f.lord}.webp`, x: -12, y: -12, width: 24, height: 24, "clip-path": "circle(12px)" }));
        lg.append(sv("text", { x: 0, y: -14, class: "crownT" }, "♛"));
        g.append(lg);
      }
      if (c.name === p.city) {
        const cand = [[r + 18, -r - 16], [-r - 18, -r - 16], [r + 26, -8], [-r - 26, -8], [0, -r - 30]];
        const score = ([dx, dy]) => Object.values(G.cities).filter((o) => o !== c).reduce((s, o) => {
          const ox = o.x - c.x, oy = o.y - c.y;
          const dC = Math.hypot(ox - dx, oy - dy);
          // 라벨 박스(가로로 긴 사각형)와 마커 원의 겹침
          const lw = Math.max(46, o.name.length * 12 + 12) / 2 + 18, ly = oy + 12 + o.size * 3.5 + 14;
          const overL = Math.abs(ox - dx) < lw && Math.abs(ly - dy) < 28 ? (lw - Math.abs(ox - dx)) + (28 - Math.abs(ly - dy)) : 0;
          return s + Math.max(0, 46 - dC) + overL * 2;
        }, 0);
        const ownLabel = ([dx, dy]) => Math.max(0, 40 - Math.hypot(dx, dy - (r + 15))) * 3;
        this.mkCache ||= {};
        const [mx, my] = this.mkCache[c.name] ||= cand.map((cd, i) => ({ cd, v: score(cd) + ownLabel(cd) + i * 0.01 })).sort((a, b) => a.v - b.v)[0].cd;
        // 위치(transform 속성)와 바운스(CSS 애니메이션)를 다른 그룹에 둔다 — CSS transform이 속성을 덮어쓰기 때문
        const holder = sv("g", { transform: `translate(${mx},${my})` });
        const pg = sv("g", { class: "pmark" });
        pg.append(sv("circle", { r: 18, class: "pring" }));
        pg.append(sv("image", { href: `assets/sdface/${p.id}.webp`, x: -16, y: -16, width: 32, height: 32, "clip-path": "circle(16px)" }));
        pg.append(sv("rect", { x: -9, y: 9, width: 18, height: 10, rx: 3, class: "meRib" }));
        pg.append(sv("text", { y: 17.5, class: "me" }, "나"));
        holder.append(pg); g.append(holder);
      }
      svg.append(g);
    }
    const mw = $("#mapWrap");
    if (mw && mw.scrollWidth > mw.clientWidth + 4 && this.mapCentered !== G.player + P().city) {
      this.mapCentered = G.player + P().city;
      const c = C(this.sel || P().city) || C(P().city);
      mw.scrollLeft = Math.max(0, c.x / 1060 * mw.scrollWidth - mw.clientWidth / 2);
    }
  },

  tip(e, c) {
    const t = $("#tip");
    if (!e || c.name === this.popCity) { t.style.display = "none"; return; } // 카드가 떠 있는 거점은 말풍선을 겹쳐 띄우지 않는다
    const f = F(c.owner); const gov = U(c.gov); const p = P();
    const adj = neighbors(p.city).includes(c.name);
    t.innerHTML = ""; t.append(...[h("div", { class: "tipH" }, flag(f, true), h("b", null, c.name)), h("div", null, f ? f.name : "공백지"),
      h("div", null, `병력 ${fmt(c.troops)} · 방어 ${fmt(c.def)}`), gov ? h("div", null, `태수 ${gov.name}`) : null,
      G.truce[c.owner] ? h("div", { class: "good" }, `휴전 ${G.truce[c.owner]}개월`) : null,
      c.name === p.city ? h("div", { class: "gold" }, "현재 위치") : adj ? h("div", { class: "gold" }, "인접 — 이동/출진 가능") : (() => { const r = routeTo(p.city, c.name); return r ? h("div", { class: "muted small" }, `이동 ${r.length}구간 · 행동력 ${moveCost(r)}`) : null; })(), h("div", { class: "muted small" }, "더블클릭: 도시 보기")].filter(Boolean));
    const r = $("#mapWrap").getBoundingClientRect();
    t.style.display = "block";
    const sx = $("#mapWrap").scrollLeft; // 세로 화면에서는 지도를 옆으로 밀어 보므로 그만큼 더한다
    const x = e.clientX - r.left + 16, y = e.clientY - r.top + 12;
    t.style.left = Math.min(x, r.width - 190) + sx + "px"; t.style.top = Math.min(y, r.height - 130) + "px";
  },

  renderSide() {
    const side = $("#side"); const keep = side.querySelector(".logList"); const sTop = side.scrollTop;
    side.innerHTML = "";
    const p = P();
    const f = F(p.fac);
    side.append(h("section", { class: "card me", style: `--fc:${f ? f.color : "#77736a"}` },
      h("div", { class: "meHead" },
        h("div", { class: "meFace" }, face(p, 96, "lg")),
        h("div", { class: "meInfo" },
          h("div", { class: "nameRow" }, gradeBadge(p), h("h2", null, p.name), h("span", { class: "status" }, statusOf(p))),
          h("div", { class: "muted small" }, p.full !== p.name ? p.full : "", " ", typeTag(p)),
          h("div", { class: "muted" }, f ? f.name : "재야", " · ", p.city),
          typeof roleOf === "function" ? h("button", { class: "roleLine", title: "위명 · 신분과 권한", onclick: () => this.fameModal() }, h("b", null, roleOf(p)), fameTitle(p) ? h("span", null, `위명 「${fameTitle(p).name}」`) : h("span", { class: "muted" }, "위명 없음"), p.sick ? h("span", { class: "bad" }, `병 ${p.sick}개월`) : null) : null,
          squadName(p) ? h("div", { class: "squadTag sm" }, h("img", { src: `assets/troop/${squadIcon(p)}.webp` }), squadName(p)) : null,
          h("div", { class: "kv" }, h("span", null, h("i", null, "공적"), fmt(p.merit)), h("span", null, h("i", null, "자금"), fmt(p.gold)), h("span", null, h("i", null, "체력"), p.hp)))),
      this.meFold ? h("div", { class: "statLine" }, STATS.map((k) => h("span", null, h("i", null, STAT_KO[k]), p.st[k]))) : h("div", { class: "radarRow sm" }, radar(p.st, 118, f ? f.color : "#e9c46a"), statRows(p.st, p.ex, p)),
      h("button", { class: "foldBtn", title: "능력치 접기/펴기", onclick: () => { this.meFold = !this.meFold; this.render(); } }, this.meFold ? "▾" : "▴"),
      h("div", { class: "eqRow" }, h("div", { class: "skills" }, p.skills.map((s) => h("span", { class: "skill", title: SKILLS[s] }, s))),
        this.eqSlots(p, () => this.equipModal()), G.inv.length ? h("button", { class: "mini invBtn", onclick: () => this.equipModal() }, `가방 ${G.inv.length}`) : null)));

    const goal = currentGoal(); const sg = sideGoal();
    const goalCard = h("section", { class: "card goal" }, h("div", { class: "goalRow" }, h("b", null, "목표"), h("span", null, goal.text), h("em", null, `${fmt(Math.min(goal.cur, goal.max))} / ${fmt(goal.max)}`)), bar(goal.cur, goal.max, "ms"),
      sg ? h("div", { class: "goalRow sub" }, h("b", null, "도전"), h("span", null, `${sg.text} · 공적 +${sg.reward}`), h("em", null, `${Math.min(sg.cur(), sg.max)} / ${sg.max}`)) : null);
    side.append(goalCard);
    if (G.missionOffer) {
      goalCard.classList.add("offer");
      goalCard.append(h("div", { class: "mission inGoal" }, h("h3", null, icon("propose", 18), "평정 — 이번 달 임무"),
        G.missionOffer.map((m, i) => h("button", { class: "mbtn", onclick: () => { Sound.sfx("click"); acceptMission(i); this.render(); } },
          h("span", null, icon(m.type === "search" ? "search" : m.type === "recruit" ? "recruit" : m.type === "train" ? "train" : m.type, 18), `${MISSION_TYPES[m.type].ko} ${fmt(m.target)}${MISSION_TYPES[m.type].unit}`), h("small", null, `공적 +${m.reward}`)))));
    } else if (G.mission) {
      const m = G.mission;
      goalCard.append(h("div", { class: "goalRow sub" }, h("b", { class: "mi" }, "임무"), h("span", null, `${MISSION_TYPES[m.type].ko} · ${Math.floor((m.deadline - 1) / 12)}년 ${((m.deadline - 1) % 12) + 1}월까지 · 공적 +${m.reward}`), h("em", null, `${fmt(Math.min(m.progress, m.target))}/${fmt(m.target)}`)), bar(m.progress, m.target, "ms"));
    }
    side.append(this.commands());
    // 거점 정보는 지도에서 거점을 누르면 옆에 뜨는 카드로 옮겼다. 여기에는 내정 명령이 쓰는 현재 거점의 병력·자금·식량만 한 줄로 남긴다.
    const hc = C(p.city); const hf = F(hc.owner);
    side.append(h("section", { class: "card hereSum", style: `--fc:${hf ? hf.color : "#77736a"}`, title: "누르면 지도에 이 거점의 정보 카드를 띄운다", onclick: () => { Sound.sfx("click", 0.4); this.sel = p.city; this.popCity = p.city; this.popTab = "city"; this.render(); } },
      flag(hf), h("div", { class: "hsName" }, h("b", null, hc.name), h("small", null, hf ? hf.name : "공백지")),
      h("div", { class: "hsNums" }, [["병력", hc.troops], ["자금", hc.gold], ["식량", hc.food]].map(([k, v]) => h("span", null, h("i", null, k), fmt(v)))),
      h("span", { class: "hsMore" }, "정보 ▸")));
    side.append(h("section", { class: "card log" }, h("h4", { class: "logH" }, `기록 (${G.log.length})`),
      h("div", { class: "logList tall" }, G.log.slice(0, 80).map((l) => h("div", { class: "ll " + l.kind }, h("i", null, l.d), l.text)))));
    side.scrollTop = sTop;
  },

  eqSlots(u, onClick) {
    const eq = eqOf(u);
    return h("div", { class: "eqSlots" }, ["chip", "system", "sub"].map((s) => {
      const k = eq[s]; const it = k && EQUIP[k];
      return h("button", { class: "eqSlot " + (it ? TIER_CLS[it.t] : "empty"), title: it ? `${it.n} (${SLOT_KO[s]}) — ${STAT_KO[it.st]} +${it.v}` : `${SLOT_KO[s]} 비어 있음`, onclick: onClick || null },
        it ? h("img", { src: `assets/equip/${k}.webp`, alt: "" }) : h("span", null, SLOT_KO[s].slice(0, 2)));
    }));
  },

  itemCard(k, onClick, extra) {
    const it = EQUIP[k];
    return h("button", { class: "itemCard " + TIER_CLS[it.t], onclick: onClick }, h("img", { src: `assets/equip/${k}.webp`, alt: "" }),
      h("div", null, h("b", null, it.n), h("small", null, `${SLOT_KO[it.s]} · ${it.t} · ${STAT_KO[it.st]} +${it.v}`), extra || null));
  },

  // 내 장비 관리
  equipModal() {
    const p = P();
    const body = h("div");
    const m = this.modal([h("h3", null, "장비 · 가방"), body, h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list");
    const draw = () => {
      body.innerHTML = "";
      const eq = eqOf(p);
      body.append(h("h4", null, "장착 중 (누르면 해제)"), h("div", { class: "itemGrid" }, ["chip", "system", "sub"].map((s) => eq[s]
        ? this.itemCard(eq[s], () => { unequipItem(p, s, true); Sound.sfx("click"); draw(); this.render(); }, h("em", null, "해제"))
        : h("div", { class: "itemCard empty" }, h("span", null, SLOT_KO[s]), h("small", { class: "muted" }, "비어 있음")))));
      body.append(h("h4", null, `가방 (${G.inv.length}) — 누르면 장착 · 같은 거점 장수에게 하사 가능`));
      body.append(h("div", { class: "itemGrid" }, G.inv.length ? G.inv.map((k) => this.itemCard(k, () => { equipItem(p, k); Sound.sfx("item"); draw(); this.render(); })) : h("span", { class: "muted" }, "비어 있다. 탐방·임무·전투 승리로 장비를 얻을 수 있다.")));
    };
    draw();
  },

  // 다른 장수에게 하사
  giftModal(id) {
    const t = U(id);
    const m = this.modal([h("h3", null, `${t.name}에게 하사`), h("p", { class: "muted" }, "장비를 내려 주면 친밀·충성이 오르고 그 장수의 능력이 강해진다."),
      h("div", { class: "itemGrid" }, G.inv.map((k) => {
        const cur = eqOf(t)[EQUIP[k].s]; const worse = cur && TIER_ORDER.indexOf(EQUIP[cur].t) >= TIER_ORDER.indexOf(EQUIP[k].t);
        return this.itemCard(k, worse ? null : () => { m.remove(); giftItem(id, k); Sound.sfx("bond"); this.after(); },
          h("small", { class: "blockLine " + (worse ? "bad" : "good") }, cur ? `${worse ? "✕ 교체 불가" : "▲ 교체"}: ${EQUIP[cur].n}(${EQUIP[cur].t})` : "빈 슬롯에 장착"));
      })),
      h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list");
  },

  itemGet(key, why) {
    const it = EQUIP[key];
    Sound.sfx(it.t === "EX" || it.t === "SP" ? "rankup2" : "item");
    return new Promise((res) => {
      const m = this.modal([h("div", { class: "itemGet " + TIER_CLS[it.t] }, h("div", { class: "igGlow" }), h("img", { src: `assets/equip/${key}.webp` }),
        h("small", null, why ? `${why} — 장비 획득` : "장비 획득"), h("b", null, it.n), h("span", null, `${SLOT_KO[it.s]} · 등급 ${it.t} · ${STAT_KO[it.st]} +${it.v}`), h("div", { class: "igEff" }, `실효과: ${STAT_KO[it.st]} +${it.v}`), itemDesc(it) ? h("p", { class: "muted small" }, `원작 효과 — ${itemDesc(it)}`) : null),
        h("div", { class: "btns" },
          h("button", { class: "primary", onclick: () => { m.remove(); equipItem(P(), key); Sound.sfx("click"); this.render(); res(); } }, "바로 장착"),
          h("button", { onclick: () => { m.remove(); res(); } }, "가방에 넣기"))], "msg");
      m.querySelector("button.primary").focus();
    });
  },

  cmd(label, ic, cost, fn, reason) {
    const dis = !!reason || G.ap < cost;
    return h("button", { class: "cmd", disabled: dis, title: reason || (G.ap < cost ? "행동력 부족" : label), onclick: () => { Sound.sfx("click", 0.6); fn(); this.after(); } },
      icon(ic, 30), h("span", null, label), cost ? h("small", null, cost) : h("small", null, " "));
  },

  commands() {
    const p = P(); const c = C(p.city); const own = p.fac && c.owner === p.fac;
    const tabs = [["dev", "내정"], ["mil", "군사"], ["self", "개인"], ["office", "임무"]];
    const sec = h("section", { class: "card cmds" });
    sec.append(h("div", { class: "tabs" }, tabs.map(([k, n]) => h("button", { class: "tab" + (this.tab === k ? " on" : ""), onclick: () => { Sound.sfx("click", 0.4); this.tab = k; this.render(); } }, n))));
    const grid = h("div", { class: "cmdGrid" });
    const noDev = !p.fac ? "사관해야 내정을 할 수 있다" : !own ? "소속 세력의 거점이 아니다" : null;
    if (this.tab === "dev") {
      for (const t of ["agri", "comm", "tech", "order", "def", "draft"]) grid.append(this.cmd(DEV[t].ko, t, COST.dev, () => actDev(t), noDev || (t !== "draft" && c.gold < 50 ? "거점 자금 부족 (50)" : null)));
    } else if (this.tab === "mil") {
      const targets = neighbors(p.city).filter((n) => C(n).owner !== p.fac && !(C(n).owner && G.truce[C(n).owner]));
      const commander = canCommand(p);
      grid.append(this.cmd("출진", "war", COST.war, () => this.warSetup(false), !commander ? "태수·군주만 출진을 지휘할 수 있다" : !targets.length ? "인접한 공격 대상이 없다" : null));
      grid.append(this.cmd("출진 상신", "propose", COST.propose, () => this.warSetup(true), !p.fac ? "사관해야 한다" : commander ? "직접 출진할 수 있다" : !own ? "소속 거점이 아니다" : !targets.length ? "인접한 공격 대상이 없다" : null));
      grid.append(this.cmd("외교", "talk", 30, () => this.diplomacy(), isLord(p) ? null : "군주만 외교를 할 수 있다"));
      grid.append(this.cmd("세력 일람", "list", 0, () => this.factionList()));
      grid.append(this.cmd("장수 일람", "recruit", 0, () => this.unitList()));
    } else if (this.tab === "office") {
      this.officerCmds(grid);
    } else {
      grid.append(this.cmd("탐방", "search", COST.search, () => actSearch()));
      grid.append(this.cmd("휴식", "rest", COST.rest, () => actRest()));
      if (!p.fac) {
        const cf = F(c.owner);
        grid.append(this.cmd("사관", "serve", COST.serve, () => this.serveDialog(), !cf ? "주인 없는 거점이다" : cf.iron ? "철충에게는 사관할 수 없다" : null));
        grid.append(this.cmd("거병", "rise", COST.rise, () => actRise(), canRise() ? null : c.owner ? "주인 없는 거점에서만 가능" : "명성(공적) 400 이상 필요"));
      } else if (!isLord(p)) {
        grid.append(this.cmd("독립", "indep", COST.rise, () => this.confirm("독립", `${F(p.fac).name}에서 독립하겠는가?\n친밀 50 이상인 장수와 의자매가 따라온다.`, p).then((ok) => { if (ok) { actIndependence(); this.after(); } }), !isGov(p) ? "태수만 가능" : p.merit < 1500 ? "공적 1500 이상 필요" : null));
        grid.append(this.cmd("하야", "resign", 0, () => this.confirm("하야", "세력을 떠나 재야가 되겠는가?", p).then((ok) => { if (ok) { actResign(); this.after(); } })));
      }
      grid.append(h("div", { class: "trainBox" }, h("span", null, icon("train", 22), "단련 ", h("small", null, COST.train)),
        STATS.map((k) => h("button", { class: "mini", disabled: G.ap < COST.train, onclick: () => { Sound.sfx("click", 0.5); actTrain(k); this.after(); } }, STAT_KO[k]))));
    }
    sec.append(grid);
    return sec;
  },

  // 지도에서 거점을 누르면 그 옆에 뜨는 거점 정보 카드
  renderPop() {
    const old = this.popEl; const sTop = old ? old.scrollTop : 0;
    if (old) old.remove();
    this.popEl = null;
    if (!this.popCity || !C(this.popCity)) return;
    const el = this.cityPanel(this.popCity);
    el.classList.add("cityPop");
    el.addEventListener("click", (e) => e.stopPropagation());
    $("#main").append(el);
    this.popEl = el; el.scrollTop = sTop;
    if (!this.popFollow) { // 지도를 밀거나 창 크기·배율을 바꿔도 거점을 따라간다
      this.popFollow = () => { if (this.popRaf) return; this.popRaf = requestAnimationFrame(() => { this.popRaf = 0; this.placePop(); }); };
      window.addEventListener("scroll", this.popFollow, true); window.addEventListener("resize", this.popFollow);
    }
    if (window.ResizeObserver) { this.popRO ||= new ResizeObserver(this.popFollow); this.popRO.disconnect(); this.popRO.observe(el); } // 초상이 늦게 떠서 카드 높이가 바뀌어도 다시 맞춘다
    this.placePop();
  },

  closePop() { this.popCity = null; if (this.popEl) { this.popEl.remove(); this.popEl = null; } this.renderMap(); },

  placePop() {
    const el = this.popEl; if (!el || !el.isConnected) return;
    const g = [...document.querySelectorAll("#map .city")].find((x) => x.dataset.city === this.popCity);
    const core = g && g.querySelector(".core"); const mw = $("#mapWrap");
    if (!core || !mw) { el.style.visibility = "hidden"; return; }
    const a = core.getBoundingClientRect(), m = mw.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight, pad = 8, gap = 14;
    const ax = (a.left + a.right) / 2, ay = (a.top + a.bottom) / 2;
    // 거점이 지도 바깥으로 밀려 나가면 카드도 숨긴다
    if (ax < m.left || ax > m.right || ay < m.top || ay > m.bottom || ay < 0 || ay > vh) { el.style.visibility = "hidden"; return; }
    el.style.visibility = "";
    const L = Math.max(pad, m.left + pad), R = Math.min(vw - pad, m.right - pad);
    el.style.maxWidth = Math.max(240, R - L) + "px";
    el.style.maxHeight = (vh - pad * 2) + "px";
    const top0 = Math.max(pad, m.top + pad); const T = vh - pad - top0 >= el.offsetHeight ? top0 : pad, B = vh - pad;
    el.style.maxHeight = (B - T) + "px";
    const cw = el.offsetWidth; let ch = el.offsetHeight;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let x, y;
    if (a.right + gap + cw <= R) x = a.right + gap; // 오른쪽
    else if (a.left - gap - cw >= L) x = a.left - gap - cw; // 걸리면 왼쪽
    if (x != null) y = clamp(ay - Math.min(150, ch * 0.3), T, B - ch);
    else { // 좌우 어디에도 안 들어가면(휴대폰 세로 화면) 위나 아래 — 더 넓은 쪽에 맞춰 높이를 줄이고 카드 안에서 밀어 보게 한다
      x = clamp(ax - cw / 2, L, Math.max(L, R - cw));
      const below = B - (a.bottom + gap), above = a.top - gap - pad;
      const down = ch <= below || below >= above;
      const room = Math.max(200, down ? below : above);
      if (ch > room) { el.style.maxHeight = room + "px"; ch = el.offsetHeight; }
      y = down ? clamp(a.bottom + gap, pad, B - ch) : clamp(a.top - gap - ch, pad, B - ch);
    }
    el.style.left = Math.round(x) + "px"; el.style.top = Math.round(y) + "px";
    const side = x >= a.right ? "toR" : x + cw <= a.left ? "toL" : "";
    el.classList.toggle("toR", side === "toR"); el.classList.toggle("toL", side === "toL");
  },

  cityPanel(name) {
    const c = C(name || this.sel || P().city); const f = F(c.owner); const gov = U(c.gov); const p = P(); const mx = cityMax(c);
    const sec = h("section", { class: "card city", style: `--fc:${f ? f.color : "#77736a"}` });
    const st = this.popTab || "city"; const clog = G.log.filter((l) => l.text.includes(c.name));
    sec.append(h("div", { class: "tabs sideTabs" }, [["city", "거점 정보"], ["log", `기록 (${clog.length})`]].map(([k, n]) => h("button", { class: "tab" + (st === k ? " on" : ""), onclick: () => { Sound.sfx("click", 0.4); this.popTab = k; this.renderPop(); } }, n))),
      h("button", { class: "popX", title: "닫기 (Esc)", onclick: () => this.closePop() }, "✕"));
    const adj = neighbors(p.city).includes(c.name);
    const mv = this.moveInfo(c.name);
    if (st === "log") { // 이 거점이 나온 기록만 모아 본다
      sec.append(h("div", { class: "popLogHead" }, flag(f), h("b", null, c.name), h("small", { class: "muted" }, "이 거점이 나온 기록")),
        h("div", { class: "logList" }, clog.length ? clog.slice(0, 60).map((l) => h("div", { class: "ll " + l.kind }, h("i", null, l.d), l.text)) : h("div", { class: "muted small" }, "아직 기록이 없다.")));
      return sec;
    }
    sec.append(h("div", { class: "cityBanner", style: `background-image:url(assets/city/${CITY_BG[c.name]}.jpg)`, onclick: () => this.cityView(c.name) },
      h("div", { class: "cbShade" }), h("span", { class: "cbBtn" }, "도시 보기 ▶"),
      h("div", { class: "cbFaces" }, unitsIn(c.name).filter((u) => u.fac === c.owner).slice(0, 6).map((u) => sdface(u, 30)))));
    sec.append(h("div", { class: "cityHead" }, flag(f), h("div", null, h("h3", null, c.name, h("small", null, ["", "소", "중", "대"][c.size] + "거점")), h("div", { class: "muted" }, f ? f.name : "공백지", gov ? ` · 태수 ${gov.name}` : "", G.truce[c.owner] ? ` · 휴전 ${G.truce[c.owner]}개월` : "")),
      mv ? h("button", { class: "cmd move", disabled: !!mv.reason, title: mv.reason || mv.title, onclick: () => { Sound.sfx("turn", 0.6); this.doMove(c.name); } }, icon("move", 22), h("span", null, mv.path.length > 1 ? `이동 ${mv.path.length}구간` : "이동"), h("small", null, mv.cost)) : null));
    /* 이동 중이 아닐 때 append(null)이 「null」 글자를 찍던 것을 막는다 */
    if (p.trip) sec.append( h("div", { class: "tripLine" }, h("span", null, `${jo(p.trip.to, "으로")} 이동 중 · 남은 ${p.trip.path.length}구간 (다음 달 초에 이어 감)`), h("button", { class: "mini", onclick: () => { cancelTrip(); this.after(); } }, "멈추기")));
    const vis = !f || !f.iron || c.name === p.city || adj;
    const row = (k, v, m) => h("div", { class: "statRow" }, h("label", null, k), m ? bar(v, m, "cb") : h("span"), h("b", null, fmt(v)));
    sec.append(h("div", { class: "cstats" },
      h("div", { class: "cnums" }, h("div", null, h("i", null, "병력"), h("b", null, fmt(c.troops))), h("div", null, h("i", null, "자금"), h("b", null, fmt(c.gold))), h("div", null, h("i", null, "식량"), h("b", null, fmt(c.food)))),
      row("농업", c.agri, mx.agri), row("상업", c.comm, mx.comm), row("기술", c.tech, mx.tech), row("치안", c.order, 100), row("방어", c.def, mx.def)));
    const here = unitsIn(c.name).sort((a, b) => (isLord(b) - isLord(a)) || ((b.fac === c.owner) - (a.fac === c.owner)) || b.merit - a.merit);
    sec.append(h("h4", null, `이곳의 인물 (${here.length})`));
    sec.append(h("div", { class: "chips" }, vis ? here.map((u) => h("button", { class: "chip" + (u.fac ? "" : " free") + (u.id === p.id ? " me" : ""), title: `${u.full || u.name} (${statusOf(u)})`, onclick: () => { Sound.sfx("click", 0.4); this.unitDetail(u.id); } },
      sdface(u, 44), h("span", null, u.name), u.sworn ? h("i", { class: "sworn" }, "義") : null, isLord(u) ? h("i", { class: "crownC" }, "♛") : null, !u.fac && !u.iron ? h("i", { class: "freeC" }, "재야") : null)) : h("span", { class: "muted" }, "정보 없음")));
    return sec;
  },

  // 맵 BGM: 플레이어 현재 거점·본거지에 적의 우세 병력이 붙어 있으면 긴장 트랙 (2개월 유지)
  mapBgm() {
    if (!G) return Sound.bgm("map");
    const p = P(); const key = G.year * 12 + G.month;
    const watch = [p.city, p.fac ? capitalOf(p.fac) : null].filter(Boolean).map(C).filter((c) => c && c.owner === p.fac);
    const danger = watch.some((c) => neighbors(c.name).some((n) => { const x = C(n); return x.owner && x.owner !== p.fac && !G.truce[x.owner] && x.troops * 0.65 > c.troops * 1.1; }));
    if (danger) G.flags.tenseUntil = key + 2;
    Sound.bgm((G.flags.tenseUntil || 0) > key ? "tense" : "map");
  },

  // 첫 플레이 단계별 안내 (처음 한 번만)
  tutorial() {
    let done = false; try { done = !!localStorage.getItem("lao3k_tut"); } catch (e) {}
    if (done || !G || document.querySelector(".tut") || document.querySelector(".modalBg, .vn")) return;
    const steps = [
      [".card.goal", "목표·도전·평정 임무가 여기에 모여요. 사관 중이면 매달 임무 하나를 고르세요."],
      [".cmds", "내정·군사·개인 명령. 아이콘 아래 숫자는 행동력 비용이에요. 결과는 화면 위 토스트로 보여요."],
      [".hereSum", "지금 있는 거점의 병력·자금·식량. 누르면 지도에 거점 정보 카드가 떠요."],
      ["#map", "지도: 거점을 누르면 바로 옆에 정보 카드(배너를 누르면 도시 보기, 빈 곳·Esc로 닫기), 두 번 누르면 도시 보기. 길이 이어진 거점이면 어디든 이동할 수 있고(멀면 여러 달), 인접한 적 거점에는 출진할 수 있어요."],
      ["#rtCtl", "시간은 저절로 흘러요(보통 하루 1초). ⏸로 멈추고 ▸▸ 로 빠르게, ⏭는 이번 달 남은 날을 건너뛰어요. 행동력은 하루에 약 3씩 차고, 군대는 지도 위를 행군해요. 막히면 「?」 가이드!"],
    ];
    let i = 0;
    const tip = h("div", { class: "tut" });
    document.body.append(tip);
    const onKey = (ev) => { if (!tip.isConnected) return document.removeEventListener("keydown", onKey, true); if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); i++; show(); } else if (ev.key === "Escape") { i = steps.length; show(); } };
    document.addEventListener("keydown", onKey, true);
    const show = () => {
      if (i >= steps.length) { tip.remove(); try { localStorage.setItem("lao3k_tut", "1"); } catch (e) {} return; }
      const [sel, text] = steps[i]; const t = document.querySelector(sel);
      if (!t) { i++; return show(); }
      const r = t.getBoundingClientRect();
      tip.innerHTML = "";
      tip.append(h("div", { class: "tutHole", style: `left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${Math.min(r.height, innerHeight - r.top) + 12}px` }),
        h("div", { class: "tutBox", style: `left:${Math.min(innerWidth - 340, Math.max(12, r.left + (r.left > innerWidth / 2 ? -340 : r.width + 16)))}px;top:${Math.min(innerHeight - 160, Math.max(60, r.top))}px` },
          h("small", null, `안내 ${i + 1} / ${steps.length}`), h("p", null, text),
          h("div", { class: "tutBtns" }, h("a", { class: "tutSkip", onclick: () => { i = steps.length; show(); } }, "튜토리얼 건너뛰기"), h("button", { class: "primary tutNext", onclick: () => { i++; Sound.sfx("click", 0.5); show(); } }, i === steps.length - 1 ? "시작!" : "다음 ▶"))));
      setTimeout(() => { const nb = tip.querySelector(".tutNext"); if (nb) nb.focus(); }, 30);
    };
    show();
  },

  after() {
    if (G && G.toast) { this.toast(G.toast.text, G.toast.kind); G.toast = null; }
    this.render(); this.flush();
  },
  toast(text, kind = "") {
    let box = document.querySelector("#toasts");
    if (!box) { box = h("div", { id: "toasts" }); document.body.append(box); }
    const t = h("div", { class: "toast " + kind }, text);
    box.append(t);
    setTimeout(() => t.classList.add("out"), 1700); setTimeout(() => t.remove(), 2200);
  },

  // ── 모달 ───────────────────────────
  modal(content, cls = "") {
    const m = h("div", { class: "modalBg" }, h("div", { class: "modal " + cls }, content));
    $("#modals").append(m);
    return m;
  },
  message(title, text, u, voice, sfx) {
    if (sfx) Sound.sfx(sfx); else Sound.sfx("open", 0.5);
    if (title === "결의") { Sound.bgm("oath"); setTimeout(() => this.mapBgm && this.mapBgm(), 9000); }
    if (u && voice) Sound.voice(u.id, voice, ["Join", "ActionApprove"]);
    return new Promise((res) => {
      const close = () => { m.remove(); Sound.sfx("click", 0.4); res(); };
      const m = this.modal([h("div", { class: "msgHead" }, u ? face(u, 84, "lg") : null, h("div", null, h("h3", null, title), u ? h("small", { class: "muted" }, u.full || u.name) : null)), h("p", { class: "msgText" }, text),
        h("div", { class: "btns" }, h("button", { class: "primary", onclick: close }, "확인"))], "msg");
      m.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") close(); });
      m.querySelector("button").focus();
    });
  },
  confirm(title, text, u, yes = "예", no = "아니오") {
    Sound.sfx("open", 0.5);
    return new Promise((res) => {
      const m = this.modal([h("div", { class: "msgHead" }, u ? face(u, 84, "lg") : null, h("h3", null, title)), h("p", { class: "msgText" }, text),
        h("div", { class: "btns" }, h("button", { class: "primary", onclick: () => { m.remove(); Sound.sfx("click", 0.5); res(true); } }, yes), h("button", { onclick: () => { m.remove(); Sound.sfx("close", 0.5); res(false); } }, no))], "msg");
      m.querySelector("button").focus();
    });
  },

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    while (G && G.queue.length) {
      const e = G.queue.shift();
      if (e.type === "msg") await this.message(e.title, e.text, U(e.who), e.voice, e.sfx);
      else if (e.type === "report") await this.report(e.items);
      else if (e.type === "dialog") await this.dialog(e);
      else if (e.type === "item") await this.itemGet(e.key, e.why);
      else if (e.type === "routeChoice" && P().fac) {
        const ok = await this.confirm(e.advise ? "노선 진언" : e.repick ? "새 세력의 노선" : "노선 선택", `${e.repick ? `독립한 지금, 내 세력의 길을 다시 정한다. (이전 노선: ${G.flags.route === "force" ? "무력 통일" : G.flags.route === "unity" ? "함께 사는 길" : "없음"})

` : ""}${e.advise ? `군주 ${U(F(P().fac).lord).name}에게 어떤 길을 진언할까?\n받아들여지면 공적 +50 · 군주 친밀 +5, 군주가 다른 길을 택하면 공적 +20.\n아래 효과는 세력 전체에 적용된다. (군주 친밀 ${U(F(P().fac).lord).bond} · 수락 가능성 약 ${adviseChance()}%)\n\n` : ""}“싸우지 마. 함께 살아.”

사령관의 말을 어떻게 이을 것인가?

① 무력 통일 — 싸움을 빨리 끝내는 것이 곧 함께 사는 길 (전 거점 병력 +500 · ${e.advise ? "군주 " : ""}공적 +100)
② 함께 사는 길 — 칼을 거두고 손을 내민다 (모든 세력과 휴전 6개월 · 치안 +5)

선택에 따라 엔딩이 달라진다.`, P(), [icon("war", 18), " 무력 통일"], [icon("propose", 18), " 함께 사는 길"]);
        const acc = e.advise ? adviseAccepted() : true;
        const r = routeApply(ok, acc); const chosen = G.flags.route === "force" ? "무력 통일" : "함께 사는 길";
        if (e.advise) { const lord = U(F(P().fac).lord); await this.dialog({ type: "dialog", bg: "story_signal", lines: [{ who: lord.id, text: acc ? `…좋다. ${P().name}의 말대로 「${chosen}」을 가겠다.` : `네 뜻은 알겠다. 하지만 이번엔 「${chosen}」이다. 원망하지 마라.`, voice: acc ? "ActionApprove" : "Leader" }, { who: null, text: `세력 노선: ${chosen}\n세력 효과: ${r}\n나: ${acc ? "진언 수락 — 공적 +50 · 군주 친밀 +5" : "진언 보류 — 공적 +20"}` }] }); }
        this.toast(`노선 — ${chosen} · ${r}`, "good"); log(`노선: ${chosen} (${r})${e.advise ? (acc ? " — 진언 수락" : " — 진언 보류") : ""}`, "good");
      }
      else if (e.type === "facChoice" && FAC_CHOICE[e.kind] && P().fac) {
        const fc = FAC_CHOICE[e.kind], lord = U(F(P().fac).lord);
        const ok = await this.confirm("세력 행사", `${fc.q}

① ${fc.a[0]} — ${fc.a[1]}
② ${fc.b[0]} — ${fc.b[1]}${G.flags.facPickLast ? `

작년 선택: ${G.flags.facPickLast} — 다른 선택을 하면 보너스 (${{ victory: "자금 +150", rebuild: "방어 +150", grand: "치안 +3", bond: "공적 +30" }[e.kind]})` : ""}`, lord, [icon(fc.a[2], 18), " " + fc.a[0]], [icon(fc.b[2], 18), " " + fc.b[0]]);
        const r = facChoiceApply(e.kind, ok);
        if (r) {
          const pickName = ok ? fc.a[0] : fc.b[0];
          this.toast(`세력 행사 — ${r}`, "good"); log(`세력 행사 선택: ${pickName} (${r})`, "good"); chron(`세력 행사: ${pickName}`);
          const cnt = (G.flags.facPick ||= {}); cnt[pickName] = (cnt[pickName] || 0) + 1;
          // 작년과 다른 선택은 '새로운 시도' 공적 +20
          if (G.flags.facPickLast && G.flags.facPickLast !== pickName) {
            const hc = C(capitalOf(P().fac)) || C(P().city);
            const NEW = { victory: () => { hc.gold += 150; return "자금 +150"; }, rebuild: () => { hc.def += 150; return "방어 +150"; }, grand: () => { hc.order = clamp(hc.order + 3, 0, 100); return "치안 +3"; }, bond: () => { addMerit(P(), 30); return "공적 +30"; } };
            this.toast(`새로운 시도 — ${(NEW[e.kind] || NEW.bond)()}`, "good");
          }
          G.flags.facPickLast = pickName;
          const mate = officersOf(P().fac).find((u) => u.id !== lord.id && u.id !== G.player && u.squad === lord.squad) || officersOf(P().fac).find((u) => u.id !== lord.id && u.id !== G.player);
          const REACT = { "포상금을 푼다": ["포상금이라니! 오늘은 정말 최고의 날이에요.", "이걸로 다들 새 장비 하나씩은 장만하겠네요."], "검소하게 치른다": ["검소한 축하도 나쁘지 않네요. 마음만은 풍족하니까.", "아낀 자금은 다음 전투에 쓰이겠죠."], "방벽 보수": ["벽이 두꺼워지면, 잠도 조금은 편히 잘 수 있겠죠.", "다음엔 철충이 와도 끄떡없을 거예요."], "병사 위로": ["…고마워요. 다들 조금 힘이 났을 거예요.", "병사들 얼굴에 웃음이 돌아왔어요."], "치안 점검": ["거리가 조용해지니 주민들 표정도 밝아졌어요.", "순찰 경로를 새로 짰어요. 빈틈은 없을 거예요."], "인재 물색": ["새 얼굴이 늘면 부대도 더 든든해지겠네요.", "소문을 듣고 찾아온 이들이 꽤 있었어요."], "연회를 연다": ["건배! 오늘 밤은 계급장 떼고 즐겨요.", "이렇게 다 같이 웃는 게 얼마 만인지 몰라요."], "합동 훈련": ["땀 흘린 만큼 강해지는 거죠. 다음 전투가 기다려지네요.", "…좀 힘들긴 했지만, 대열이 확실히 맞아졌어요."] };
          await this.dialog({ type: "dialog", bgUrl: `assets/city/${CITY_BG[P().city]}.jpg`, lines: [{ who: lord.id, text: ok ? "좋다. 그렇게 하지." : "그래, 그쪽이 낫겠군.", voice: "ActionApprove" }].concat(mate ? [{ who: mate.id, text: REACT[pickName] ? pick(REACT[pickName]) : "알겠습니다!", voice: null }] : []).concat([{ who: null, text: `결과: ${r}` }]) });
        }
      }
      else if (e.type === "surrender") {
        const f = F(e.fac); if (f && f.alive) {
          const ok = await this.confirm("투항 제의", `${f.name}의 ${U(f.lord).name}: "더 이상 버틸 수 없다… 우리를 받아 주겠나?"\n수락하면 ${citiesOf(f.key).length}개 거점과 장수 ${officersOf(f.key).length}명이 합류한다.`, U(f.lord), "받아들인다", "거절한다");
          acceptSurrender(e.fac, ok);
        }
      }
      else if (e.type === "oev" && typeof oevApply === "function") await this.officerEvent(e);
      else if (e.type === "battle") await this.battleEntry(e);
      else if (e.type === "prisoner") {
        const u = U(e.id);
        const ok = await this.confirm("포로 처우", `${jo(u.full, "을를")} 사로잡았다. 등용을 시도하겠는가?\n(거절하면 석방 — 친밀 +10)`, u, "등용", "석방");
        releasePrisoner(e.id, ok);
      } else if (e.type === "captured") {
        const f = F(e.captor);
        const ok = await this.confirm("포로", `${f.name}에게 사로잡혔다!\n${U(f.lord).name}: "우리 편이 되지 않겠나?"`, U(f.lord), "투항한다", "탈출한다");
        playerCapturedChoice(e.captor, ok);
      } else if (e.type === "ending") { this.ending(e); }
      this.render();
    }
    this.flushing = false;
    if (G) { this.render(); setTimeout(() => this.tutorial(), 300); }
  },

  report(items) {
    const p = P();
    const ICON = { war: "war", good: "agri", bad: "order", sys: "propose" };
    const wars = items.filter((x) => x.kind === "war");
    const rest = items.filter((x) => x.kind !== "war").slice(0, 8);
    return new Promise((res) => {
      const mine = p.fac ? citiesOf(p.fac) : [];
      const threat = mine.map((c) => ({ c, e: neighbors(c.name).map(C).filter((n) => n.owner && n.owner !== p.fac && !(G.truce[n.owner])).sort((a, b) => b.troops - a.troops)[0] })).filter((x) => x.e && x.e.troops > x.c.troops).sort((a, b) => b.e.troops - b.c.troops - (a.e.troops - a.c.troops))[0];
      const tips = [];
      if (p.fac && G.flags.facEvMonth === G.year * 12 + G.month) tips.unshift(`이번 달 세력 행사가 열립니다 — 보고를 닫으면 진행됩니다`);
      if (G.flags.pendingEv) tips.push(`대기 중인 이벤트 ${G.flags.pendingEv}건 — 다음 달로 미뤄졌습니다 (${(G.flags.pendingList || []).join(", ")})`);
      if (p.fac && G.month >= 2 && G.month <= 4 && !G.flags["facEv" + G.year]) {
        const yy = G.year - 1; const w = (G.chron || []).filter((c) => c.text.endsWith("점령") && c.d.startsWith(yy + ".")).length, l = (G.chron || []).filter((c) => c.text.endsWith("상실") && c.d.startsWith(yy + ".")).length;
        tips.push(`5월 세력 행사 예고: ${w >= 2 ? "승전 축하연 (전투 사기 +10)" : l >= 2 ? "패전 후 재정비 (치안 +5)" : citiesOf(p.fac).length >= 10 ? "대국의 무게 (공적 +100)" : "결속의 밤·수성 축하연·전열 재정비·영토 순시 중 하나 (끝에 선택지)"}`);
      }
      if (G.mission) tips.push(`임무 「${MISSION_TYPES[G.mission.type].ko}」 ${fmt(Math.min(G.mission.progress, G.mission.target))}/${fmt(G.mission.target)}`);
      if (threat) tips.push(`⚠ ${threat.c.name} 인근 ${threat.e.name}(${F(threat.e.owner).name}) 병력 ${fmt(threat.e.troops)} — 징병·방벽 보수 권장`);
      if (!p.fac) tips.push("재야: 탐방으로 인재를 찾거나 사관할 세력을 고르자");
      else if (canCommand(p)) { const weak = neighbors(p.city).map(C).filter((n) => n.owner !== p.fac && !(n.owner && G.truce[n.owner])).sort((a, b) => a.troops - b.troops)[0]; if (weak && weak.troops < C(p.city).troops * 0.7) tips.push(`▶ ${weak.name}(병력 ${fmt(weak.troops)})이 약하다 — 출진 기회`); }
      const th = threatFaction();
      const m = this.modal([h("h3", null, `${dateStr()} — 정세 보고`),
        th ? h("div", { class: "threatBar link", onclick: () => { m.remove(); res(); this.focusFaction(th.key); } }, `⚠ 통일 위협: ${th.name} ${citiesOf(th.key).length}/24 거점 — ${isLord(p) ? "외교에서 「대동맹」으로 주변국과 손잡자" : "견제가 필요하다"} ▶ 지도에서 보기`) : null,
        p.fac ? h("div", { class: "repSum" }, flag(F(p.fac), true), h("b", null, F(p.fac).name), h("span", null, `거점 ${mine.length}`), h("span", null, `병력 ${fmt(mine.reduce((s, c) => s + c.troops, 0))}`), h("span", null, `자금 ${fmt(mine.reduce((s, c) => s + c.gold, 0))}`), h("span", null, `순위 ${Object.values(G.factions).filter((f) => f.alive).sort((a, b) => citiesOf(b.key).length - citiesOf(a.key).length).findIndex((f) => f.key === p.fac) + 1}위`)) : null,
        tips.length ? h("div", { class: "repSec" }, h("h4", null, "참모 보고"), tips.map((t) => h("div", { class: "rep tip" }, icon("propose", 18), t))) : null,
        wars.length ? h("div", { class: "repSec" }, h("h4", null, `전황 (${wars.length})`), wars.slice(0, 6).map((x) => h("div", { class: "rep war" }, icon("war", 18), x.text)),
          wars.length > 6 ? h("details", null, h("summary", { class: "muted" }, `외 ${wars.length - 6}건 더 보기`), wars.slice(6).map((x) => h("div", { class: "rep war" }, icon("war", 18), x.text))) : null) : null,
        rest.length ? h("div", { class: "repSec" }, h("h4", null, "소식"), rest.map((x) => h("div", { class: "rep " + x.kind }, icon(ICON[x.kind] || "list", 18), x.text))) : null,
        h("div", { class: "btns" }, h("button", { class: "primary", onclick: () => { m.remove(); res(); } }, "확인"))], "report");
      m.querySelector(".btns button").focus();
    });
  },

  async battleEntry(e) {
    const w = e.war;
    const to = C(w.to);
    if (to.owner === w.atkFac) { C(w.from).troops += w.atk.reduce((s, x) => s + x.troops, 0); return; }
    e.war = prepareBattle({ atkFac: w.atkFac, from: w.from, to: w.to, atk: w.atk.filter((x) => x.u.alive), sent: w.sent });
    const af = F(w.atkFac), df = F(e.war.defFac);
    const mine = e.playerSide === "atk" ? e.war.atk : e.war.def;
    const theirs = e.playerSide === "atk" ? e.war.def : e.war.atk;
    const sum = (l) => fmt(l.reduce((s, x) => s + x.troops, 0));
    Sound.sfx("warn", 0.6);
    // 전투는 야전(실시간 군영전)으로만 치른다. 출진 화면에서 자동 전투로 바꿀 수 있다
    if (typeof Field !== "undefined" && Stage.ok) {
      // 야전 시작 중 예외가 나면 멈추지 않고 자동 전투로 넘긴다
      const r = await new Promise((res) => { try { Promise.resolve(Field.start(e, res)).catch((er) => { console.error(er); try { FUI.close(); } catch (x) {} res("auto"); }); } catch (er) { console.error(er); res("auto"); } });
      if (r === "auto") await this.autoBattle(e);
      this.mapBgm();
      return;
    }
    // WebGL을 쓸 수 없으면 야전을 그릴 수 없으므로 자동 전투로 처리한다
    this.toast("이 브라우저에서는 야전을 표시할 수 없어 자동 전투로 진행합니다", "bad");
    await this.autoBattle(e);
    this.mapBgm();
  },
  async autoBattle(e) {
    const r = resolvePrepared(e.war);
    const meWin = (e.playerSide === "atk") === r.win;
    if (meWin) addMerit(P(), 80);
    await this.message(meWin ? "승리" : "패배", `${e.war.to} 전투 결과: ${r.win ? "공격측" : "수비측"} 승리.`, P(), meWin ? "MVP" : "Retreat", meWin ? "win" : "warn");
  },

  // ── 대화 ──────────────────────────
  serveDialog() {
    const p = P(); const c = C(p.city); const f = F(c.owner); const lord = U(f.lord); const gov = U(c.gov) || lord;
    const m = this.modal([h("div", { class: "msgHead" }, face(gov, 84, "lg"), h("div", null, h("h3", null, `${f.name}에 사관`), h("small", { class: "muted" }, gov.full))),
      h("p", { class: "msgText" }, `${gov.name}에게 사관을 청한다.\n${f.motto ? `“${f.motto}”` : (f.desc || "").split(/(?<=[.!?。])\s/).slice(0, 2).join(" ")}\n\n성공률(대화): ${serveChance(p, f)}%  ·  설전에서 이기면 확실히 받아들여진다.`),
      h("div", { class: "btns" },
        h("button", { class: "primary", onclick: () => { m.remove(); actServe("talk"); this.after(); } }, "대화로 청한다"),
        h("button", { onclick: () => { m.remove(); if (!spend(COST.serve)) return this.after(); Debate.start(p, gov, (won) => { actServe(won ? "debateWon" : "debateLost"); this.after(); }); } }, "설전으로 설득"),
        h("button", { onclick: () => m.remove() }, "그만둔다"))], "msg");
  },

  diplomacy() {
    const p = P();
    const rows = Object.values(G.factions).filter((f) => f.alive && !f.iron && f.key !== p.fac && citiesOf(f.key).length > 0).map((f) => {
      const cs = citiesOf(f.key);
      const t = G.truce[f.key];
      return h("div", { class: "frow" }, flag(f), sdface(U(f.lord), 44),
        h("div", { class: "grow" }, h("b", null, f.name), h("div", { class: "muted" }, `거점 ${cs.length} · 병력 ${fmt(cs.reduce((s, c) => s + c.troops, 0))}`)),
        t ? h("span", { class: "good" }, `휴전 ${t}개월`) : h("button", { disabled: G.ap < 30, onclick: () => { m.remove(); actTruce(f.key); this.after(); } }, `휴전 제안 ${truceChance(f.key)}%`));
    });
    const th = threatFaction();
    const m = this.modal([h("h3", null, "외교 — 휴전 제안"), h("p", { class: "muted" }, "행동력 30 · 본거지 자금 300. 휴전 중에는 서로 공격하지 않는다(12개월)."),
      th ? h("div", { class: "threatBar" }, `⚠ ${jo(th.name, "이가")} ${citiesOf(th.key).length}거점 — `, h("button", { class: "primary mini", disabled: G.ap < 40, onclick: () => { m.remove(); actGrandAlliance(); this.after(); } }, "대동맹 결성 (행동력 40 · 자금 500)")) : null,
      h("div", { class: "flist" }, rows),
      h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list");
  },

  unitDetail(id) {
    const u = U(id); const p = P(); const f = F(u.fac);
    const same = u.city === p.city && u.id !== p.id;
    const btns = [];
    if (same && !u.iron) btns.push(h("button", { disabled: G.ap < COST.talk, onclick: () => { m.remove(); Sound.sfx("bond"); actTalk(u.id); this.after(); } }, `교류 (${COST.talk})`));
    if (same && !u.iron && G.inv.length) btns.push(h("button", { onclick: () => { m.remove(); this.giftModal(u.id); } }, `하사 (${G.inv.length})`));
    if (same && !u.fac && p.fac && !u.iron) {
      btns.push(h("button", { class: "primary", disabled: G.ap < COST.recruit, onclick: () => { m.remove(); actRecruit(u.id, "talk"); this.after(); } }, `등용 ${recruitChance(p, u)}% (${COST.recruit})`));
      btns.push(h("button", { disabled: G.ap < COST.recruit, onclick: () => { m.remove(); if (!spend(COST.recruit)) return; Debate.start(p, u, (won) => { actRecruit(u.id, won ? "debateWon" : "debateLost"); this.after(); }); } }, `설전으로 설득 (${COST.recruit})`));
    }
    if (isLord(p) && u.fac === p.fac && u.id !== p.id) {
      if (u.city !== p.city) btns.push(h("button", { disabled: G.ap < 10, title: "행동력 10", onclick: () => { m.remove(); actSummon(u.id); this.after(); } }, "소환 (10)"));
      const uc = C(u.city);
      if (uc.owner === p.fac && uc.gov !== u.id) btns.push(h("button", { onclick: () => { m.remove(); actAppoint(u.city, u.id); this.after(); } }, `${u.city} 태수 임명`));
      if (typeof actAppointDudok === "function" && isGov(u)) btns.push(h("button", { disabled: !u.dudok && (G.ap < 10 || dudoksOf(p.fac).length >= dudokCap(p.fac)), title: `거점 6곳마다 1명 (${dudoksOf(p.fac).length}/${dudokCap(p.fac)})`, onclick: () => { m.remove(); actAppointDudok(u.id); this.after(); } }, u.dudok ? "도독 해임" : "도독 임명 (10)"));
    }
    if (typeof roleLv === "function" && !u.iron) {
      if (same && u.sick) btns.push(h("button", { class: "primary", disabled: G.ap < 15, onclick: () => { m.remove(); actVisitSick(u.id); this.after(); } }, "병문안 (15)"));
      if (same && p.gold >= 100) btns.push(h("button", { disabled: G.ap < 15, onclick: () => { m.remove(); actGift(u.id); this.after(); } }, "선물 (15)"));
      if (roleLv(p) >= 3 && u.fac === p.fac && !isLord(u) && jurisOf(p).includes(u.city)) btns.push(h("button", { disabled: G.ap < 10, title: `거점 자금 100 · 충성 ${u.loyal}`, onclick: () => { m.remove(); actReward(u.id); this.after(); } }, "포상 (10)"));
      if (same && hasFame("무관")) btns.push(h("button", { disabled: G.ap < 20, onclick: () => { m.remove(); actTeach(u.id); this.after(); } }, "무예 지도 (20)"));
      if (same && hasFame("협객") && !u.fac && u.follow !== p.id) btns.push(h("button", { disabled: G.ap < 20 || u.bond < 50, title: "친밀 50 필요", onclick: () => { m.remove(); actGather(u.id); this.after(); } }, "호걸 규합 (20)"));
    }
    if (!u.iron && Sound.hasVoice(u.id)) btns.unshift(h("button", { class: "mini voiceBtn", title: "원작 대사", onclick: (ev) => { const l = typeof LAO_LINES !== "undefined" && LAO_LINES[u.id] ? pick(LAO_LINES[u.id]) : null; if (l && l.v) { Sound.voice(u.id, l.v, ["Join"]); this.toast(`원작 대사 — ${u.name}: “${l.t}”`, "bond"); } else Sound.voice(u.id, pick(["Join", "Intro", "Leader", "SearchEnd", "MVP"]), ["Join"]); } }, "▶ 대사"));
    if (!u.iron && this.relMap) btns.push(h("button", { onclick: () => { m.remove(); this.relMap(u.id); } }, "관계도"));
    btns.push(h("button", { onclick: () => m.remove() }, "닫기"));
    const o = typeof LAO_PC !== "undefined" ? LAO_PC[u.id] : null;
    const m = this.modal([
      h("div", { class: "selHead" }, h("div", { class: "bigPortrait " + (GRADE_CLS[u.grade] || "") }, h("img", { src: portrait(u) })),
        h("div", { class: "grow" }, h("div", { class: "nameRow" }, gradeBadge(u), h("h2", null, u.full || u.name), u.sworn ? h("i", { class: "sworn" }, "義") : null),
          h("div", { class: "muted" }, `${f ? f.name : "재야"} · ${statusOf(u)} · ${u.city}`, " ", typeTag(u)),
          squadName(u) ? h("div", { class: "squadTag sm" }, h("img", { src: `assets/troop/${squadIcon(u)}.webp` }), squadName(u)) : null,
          u.iron ? h("div", { class: "muted" }, "철충 지휘개체 — 등용 불가") : h("div", { class: "kv" }, h("span", null, h("i", null, "공적"), fmt(u.merit)), h("span", null, h("i", null, "친밀"), u.bond), u.fac && !isLord(u) ? h("span", null, h("i", null, "충성"), u.loyal) : null),
          h("div", { class: "skills" }, u.skills.map((s) => h("span", { class: "skill", title: SKILLS[s] }, s))))),
      typeof perOf === "function" && !u.iron ? h("div", { class: "perLine" },
        h("span", { title: PER_DESC[perOf(u).type] }, h("i", null, "성격"), perOf(u).type), h("span", null, h("i", null, "야망"), perOf(u).amb), h("span", null, h("i", null, "의리"), perOf(u).gi),
        u.id !== p.id ? h("span", { class: relOf(p.id, u.id) < 0 ? "bad" : "" }, h("i", null, "나와"), `${stageWith(u.id)} (${relOf(p.id, u.id)})`) : h("span", null, h("i", null, "신분"), roleOf(u)),
        u.dudok ? h("span", null, h("i", null, "직위"), "도독") : null, u.sick ? h("span", { class: "bad" }, h("i", null, "상태"), `병 (${u.sick}개월)`) : null, taskBusy(u.id) ? h("span", null, h("i", null, "임무"), taskName((G.tasks || []).find((t) => t.doers.includes(u.id)))) : null) : null,
      typeof topRels === "function" && !u.iron ? (() => { const rs = topRels(u.id, 6).filter((r) => r.u.id !== p.id || u.id === p.id); return rs.length ? h("details", { class: "mateHint" }, h("summary", null, `인맥 (${rs.length})`), rs.map((r) => h("span", { class: r.v < 0 ? "bad" : "" }, sdface(r.u, 22), `${r.u.name} — ${r.s} (${r.v})`))) : null; })() : null,
      h("div", { class: "radarRow" }, radar(u.st, 140, f ? f.color : "#e9c46a"), statRows(u.st, null, u)),
      u.iron ? null : h("div", { class: "eqLine" }, h("span", { class: "muted small" }, "장비"), this.eqSlots(u)),
      typeof LAO_SKILL !== "undefined" && LAO_SKILL[u.id] ? h("div", { class: "skillLine" }, h("img", { src: `assets/skill/${LAO_SKILL[u.id].ic}.webp` }), h("div", null, h("b", null, `고유 전법 「${LAO_SKILL[u.id].n}」`, h("small", null, ` ${SKILL_KIND[LAO_SKILL[u.id].t]}`)), h("small", { class: "eff" }, `실효과 — ${skillSummary(LAO_SKILL[u.id])}`), h("small", { class: "muted orig", title: `원작 효과: ${LAO_SKILL[u.id].d}` }, "ⓘ 원작 효과 보기 (마우스를 올리세요)"))) : null,
      o && o.join ? h("blockquote", { class: "quote" }, `“${o.join}”`) : null,
      u.squad && !u.iron ? (() => {
        const mates = Object.values(G.units).filter((x) => x.alive && !x.missing && x.squad === u.squad && x.id !== u.id);
        if (!mates.length) return null;
        const act = (x) => {
          if (isLord(p) && x.fac === p.fac && x.city !== p.city) return h("button", { class: "mini", disabled: G.ap < 10, title: "행동력 10 · 군주 전용 · 같은 부대원이 모이면 막사 대화", onclick: () => { m.remove(); actSummon(x.id); this.after(); } }, "소환 (10)");
          const mv = x.city !== p.city && this.moveInfo(x.city);
          if (mv) return h("button", { class: "mini", disabled: !!mv.reason, title: mv.reason || mv.title, onclick: () => { m.remove(); this.doMove(x.city); } }, `찾아가기 (${mv.cost})`);
          return null;
        };
        return h("details", { class: "mateHint" }, h("summary", null, `같은 부대 · ${squadName(u)} (${mates.length}명)`), mates.map((x) => h("span", { class: x.city === u.city ? "here" : "" }, sdface(x, 22), `${x.name} @${x.city}`, act(x))));
      })() : null,
      h("div", { class: "btns" }, btns)], "unit");
  },

  warSetup(proposal) {
    const p = P(); const c = C(p.city);
    const targets = neighbors(p.city).filter((n) => C(n).owner !== p.fac && !(C(n).owner && G.truce[C(n).owner]));
    let to = targets.includes(this.sel) ? this.sel : targets[0];
    const avail = unitsIn(c.name).filter((u) => u.fac === p.fac).sort((a, b) => (b.id === p.id) - (a.id === p.id) || powerOf(b) - powerOf(a));
    const picked = new Set([p.id, ...avail.filter((u) => u.id !== p.id).slice(0, proposal ? 3 : 2).map((u) => u.id)]);
    const pool = Math.max(0, c.troops - 500);
    const body = h("div");
    const m = this.modal([h("h3", null, icon(proposal ? "propose" : "war", 22), proposal ? "출진 상신" : "출진 편성"), body], "war");
    const draw = () => {
      body.innerHTML = "";
      const t = C(to); const tf = F(t.owner);
      body.append(h("div", { class: "tgtList" }, targets.map((n) => { const x = C(n), xf = F(x.owner); return h("button", { class: "tgt" + (n === to ? " on" : ""), onclick: () => { to = n; draw(); } }, flag(xf, true), h("span", null, n), h("small", null, `병력 ${fmt(x.troops)}`)); })));
      const defs = t.owner ? unitsIn(to).filter((u) => u.fac === t.owner) : [];
      body.append(h("div", { class: "enemyRow" }, h("span", { class: "muted" }, `${tf ? tf.name : "공백지"} · 방어 ${fmt(t.def)}`), defs.slice(0, 6).map((u) => sdface(u, 30)), defs.length > 6 ? h("span", { class: "muted" }, `+${defs.length - 6}`) : null));
      const sel = avail.filter((u) => picked.has(u.id));
      const caps = sel.map((u) => maxTroops(u)); const capSum = caps.reduce((a, b) => a + b, 0) || 1;
      const alloc = {}; sel.forEach((u, i) => (alloc[u.id] = Math.min(caps[i], Math.floor(pool * caps[i] / capSum))));
      const sb = squadBonus(sel);
      body.append(h("h4", null, `출진 장수 (최대 5) · 동원 가능 병력 ${fmt(pool)}`));
      if (sb.length) body.append(h("div", { class: "sbRow" }, sb.map((q) => h("span", { class: "sbChip" }, h("img", { src: `assets/troop/${q.icon}.webp` }), `${q.name} ×${q.n} +${Math.round((q.mult - 1) * 100)}%`))));
      body.append(h("div", { class: "warList" }, avail.map((u) => h("label", { class: "wrow" + (picked.has(u.id) ? " on" : "") },
        h("input", { type: "checkbox", checked: picked.has(u.id), disabled: !picked.has(u.id) && picked.size >= 5, onchange: (e) => { e.target.checked ? picked.add(u.id) : picked.delete(u.id); draw(); } }),
        sdface(u, 36), h("span", null, u.name, " ", gradeBadge(u)), h("small", null, `${CLS_KO[u.cls] || ""} · 통${u.st.ldr} 무${u.st.war} 지${u.st.int}`), h("b", null, picked.has(u.id) ? fmt(alloc[u.id]) : "-")))));
      const total = Object.values(alloc).reduce((a, b) => a + b, 0);
      body.append(h("p", { class: "muted small" }, "상성: 경장 ▶ 기동 ▶ 중장 ▶ 경장 (우위 시 피해 +20%) · 같은 원작 부대원끼리 출진하면 부대 결속 보너스"));
      body.append(h("div", { class: "btns" },
        h("button", { class: "primary", disabled: !sel.length || total < 300, onclick: () => { m.remove(); actWar(to, alloc, proposal); this.after(); } }, `${proposal ? `상신 (승인률 ${proposeChance(p)}%)` : "출진"} — 총 ${fmt(total)}명`),
        h("button", { onclick: () => m.remove() }, "취소")));
    };
    draw();
  },

  // 개인 이벤트 (삼국지 13식): 선택 → 일기토·설전이면 직접 겨룬 뒤 결과 반영
  async officerEvent(e) {
    const who = U(e.who); const p = P();
    if (e.a && (!U(e.a) || !U(e.a).alive)) return;
    const ok = await this.confirm(e.title, e.text, who, e.yes, e.no);
    let won;
    if (ok && e.duel) {
      const u = U(e.a); const wrap = (x) => ({ code: x.id, id: x.id, name: x.name, st: x.st, u: x });
      const me = wrap(p);
      won = await new Promise((res) => Duel.start(me, wrap(u), (w) => res(w === me)));
      this.mapBgm();
    } else if (ok && e.debate) won = await new Promise((res) => Debate.start(p, U(e.a), (w) => res(!!w)));
    const r = oevApply(e, ok, won);
    if (r) this.toast(`${e.title} — ${r}`, ok ? "good" : "");
    if (G && G.toast) { this.toast(G.toast.text, G.toast.kind); G.toast = null; }
    this.render();
  },

  // 이동 버튼 정보: 지도 어디든 길을 따라 간다 (철충 거점은 지나갈 수 없다)
  moveInfo(name) {
    const p = P(); if (name === p.city) return null;
    const path = routeTo(p.city, name); if (!path) return null;
    if (G.rt) { // 실시간: 출발에 행동력 15, 길은 며칠에 걸쳐 간다
      const days = pathDays(p.city, path);
      return { path, cost: MOVE_START, title: `${path.join(" → ")} · 약 ${days}일 · 행동력 ${MOVE_START}`, reason: p.trip ? `${jo(p.trip.to, "으로")} 가는 중` : G.ap < MOVE_START ? `행동력 부족 (출발에 ${MOVE_START} 필요)` : null, label: `이동 (${days}일)` };
    }
    const cost = moveCost(path); const now = Math.min(path.length, Math.max(0, Math.floor((G.ap - MOVE_START) / MOVE_HOP)));
    const title = `${path.join(" → ")} · 행동력 ${cost}${now < path.length ? ` (이번 달 ${now}구간, 나머지는 다음 달에 이어 감)` : ""}`;
    return { path, cost, title, reason: G.ap < MOVE_START + MOVE_HOP ? `행동력 부족 (출발에 ${MOVE_START + MOVE_HOP} 필요)` : null, label: `이동 (${path.length > 1 ? `${path.length}구간 · ` : ""}${cost})` };
  },
  async doMove(name) {
    const p = P(); const c = C(p.city); const warn = [];
    if (c.gov === p.id && !isLord(p)) warn.push(`${jo(c.name, "을를")} 떠나면 태수 자리를 내놓게 된다.`);
    const t = playerTask(); if (t && t.city === p.city) warn.push(`맡은 임무 「${taskName(t)}」를 그만두게 된다.`);
    if (warn.length && !(await this.confirm("이동", `${warn.join("\n")}\n\n그래도 ${name}${jo(name, "으로").slice(name.length)} 가겠는가?`, p))) return;
    actMove(name); this.sel = P().city; this.after();
  },

  // ── 장수제: 임무·평정·인맥·위명 ─────────────
  officerCmds(grid) {
    const p = P(); const c = C(p.city); const own = p.fac && c.owner === p.fac; const lv = roleLv(p);
    const mine = (G.tasks || []).filter((t) => t.doers.includes(p.id) || t.issuer === p.id);
    grid.append(this.cmd(`임무 현황${mine.length ? ` (${mine.length})` : ""}`, "list", 0, () => this.tasksModal()));
    if (p.fac && !isLord(p) && !isGov(p)) grid.append(this.cmd("임무 제안", "propose", 20, () => this.taskModal("propose"), lv < 2 ? "중신(편장군 이상)만 제안할 수 있다" : !own ? "소속 거점이 아니다" : playerTask() ? "이미 맡은 임무가 있다" : null));
    if (lv >= 3) grid.append(this.cmd("임무 발령", "propose", 10, () => this.taskModal("issue")));
    if (p.fac) grid.append(this.cmd("평정", "plot", isLord(p) ? 10 : 15, () => this.stratModal(), lv < 2 ? "중신(편장군 이상)부터 평정에서 의견을 낼 수 있다" : isLord(p) ? (G.flags.stratQ === quarterKey() ? "이번 분기 목표는 이미 정했다" : null) : (G.flags.voiceQ === quarterKey() ? "이번 분기에는 이미 의견을 냈다" : null)));
    if (p.fac) grid.append(this.cmd("연회", "talk", 30, () => actFeast(), lv < 2 ? "중신(편장군 이상)만 연회를 열 수 있다" : p.gold < 200 ? "개인 자금 200 필요" : null));
    if (lv >= 3) grid.append(this.cmd("포상", "comm", 10, () => this.pickUnit("포상", "거점 자금 100으로 장수의 충성을 높인다.", officersOf(p.fac).filter((u) => u.id !== p.id && !isLord(u) && jurisOf(p).includes(u.city)).sort((a, b) => a.loyal - b.loyal), (u) => `충성 ${u.loyal} · ${u.city}`, (u) => actReward(u.id))));
    if (lv >= 4) grid.append(this.cmd("이동 명령", "move", 10, () => this.orderMoveModal()));
    if (isLord(p)) grid.append(this.cmd("도독 임명", "serve", 10, () => this.pickUnit("도독 임명", `거점 6곳마다 1명 (현재 ${dudoksOf(p.fac).length}/${dudokCap(p.fac)}) · 도독을 다시 고르면 해임`, officersOf(p.fac).filter((u) => isGov(u) && !isLord(u)), (u) => `${u.city} 태수 · ${rankName(u)}${u.dudok ? " · 도독" : ""}`, (u) => actAppointDudok(u.id)), dudokCap(p.fac) ? null : "거점이 4곳 이상이어야 도독을 둘 수 있다"));
    const folk = unitsIn(p.city).filter((u) => u.id !== p.id && !u.iron);
    grid.append(this.cmd("선물", "talk", 15, () => this.pickUnit("선물", "개인 자금 100을 보내 친밀을 높인다. 같은 세력이면 충성 +3.", folk, (u) => `${stageWith(u.id)} · 친밀 ${u.bond}`, (u) => actGift(u.id)), p.gold < 100 ? "개인 자금 100 필요" : !folk.length ? "이 거점에 다른 장수가 없다" : null));
    grid.append(this.cmd("의협 활동", "order", 25, () => actChivalry()));
    grid.append(this.cmd("수행", "train", G.ap, () => this.pilgrimModal(), G.ap < 50 ? "행동력 50 이상 남아 있어야 한다" : p.gold < 100 ? "개인 자금 100 필요" : null));
    grid.append(this.cmd("교역", "comm", 25, () => actTrade(), p.gold < 100 ? "개인 자금 100 필요" : c.owner && F(c.owner).iron ? "철충 거점" : null));
    if (hasFame("무관")) grid.append(this.cmd("무예 지도", "train", 20, () => this.pickUnit("무예 지도", "같은 거점 장수의 무력을 단련해 준다.", folk, (u) => `무력 ${u.st.war} · 친밀 ${u.bond}`, (u) => actTeach(u.id)), folk.length ? null : "이 거점에 다른 장수가 없다"));
    if (hasFame("문관")) grid.append(this.cmd("민정 시찰", "agri", 25, () => actInspect(), own ? null : "소속 거점에서만"));
    if (hasFame("군사")) { const ts = neighbors(p.city).filter((n) => C(n).owner && C(n).owner !== p.fac && !F(C(n).owner).iron); grid.append(this.cmd("유언비어", "plot", 30, () => this.pickCity("유언비어", "이웃 적 거점의 치안과 장수 충성을 떨어뜨린다.", ts, (n) => `${F(C(n).owner).name} · 성공률 ${rumorChance(p, C(n))}%`, (n) => actRumor(n)), ts.length ? null : "이웃에 적 거점이 없다")); }
    if (hasFame("장군")) grid.append(this.cmd("격려", "rise", 20, () => actRally(), p.fac ? null : "사관해야 한다"));
    if (hasFame("협객")) { const fr = folk.filter((u) => !u.fac && u.follow !== p.id); grid.append(this.cmd("호걸 규합", "recruit", 20, () => this.pickUnit("호걸 규합", "친밀 50 이상인 재야 장수를 거병·독립 동지로 삼는다.", fr, (u) => `친밀 ${u.bond}`, (u) => actGather(u.id)), fr.length ? null : "이 거점에 재야 장수가 없다")); }
    if (hasFame("상인", 2)) grid.append(this.cmd("군자금 헌납", "comm", 15, () => actDonate(), !c.owner || F(c.owner).iron ? "세력 거점에서만" : p.gold < 100 ? "개인 자금 100 필요" : null));
    grid.append(this.cmd("관계도", "recruit", 0, () => (this.relMap ? this.relMap(P().id) : this.relModal())));
    grid.append(this.cmd("위명·권한", "list", 0, () => this.fameModal()));
  },

  pickUnit(title, desc, list, info, onPick) {
    const m = this.modal([h("h3", null, title), desc ? h("p", { class: "muted" }, desc) : null,
      h("div", { class: "warList" }, list.length ? list.map((u) => h("button", { class: "wrow pick", onclick: () => { m.remove(); Sound.sfx("click", 0.5); onPick(u); this.after(); } }, h("span"), sdface(u, 36), h("span", null, u.name, " ", gradeBadge(u)), h("small", null, info(u)), h("b", null, "선택"))) : h("span", { class: "muted" }, "대상이 없다.")),
      h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list");
  },
  pickCity(title, desc, list, info, onPick) {
    const m = this.modal([h("h3", null, title), desc ? h("p", { class: "muted" }, desc) : null,
      h("div", { class: "tgtList" }, list.map((n) => h("button", { class: "tgt", onclick: () => { m.remove(); Sound.sfx("click", 0.5); onPick(n); this.after(); } }, flag(F(C(n).owner), true), h("span", null, n), h("small", null, info(n))))),
      h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list");
  },

  taskRow(t, m) {
    const p = P(); const k = TASK_KIND[t.kind]; const main = U(t.doers[0]);
    const acts = [];
    if (t.doers.includes(p.id)) {
      const cand = unitsIn(t.city).filter((u) => u.fac === p.fac && u.id !== p.id && !isLord(u) && !taskBusy(u.id));
      if (t.doers.length < 4 && cand.length) acts.push(h("button", { class: "mini", disabled: G.ap < 10, onclick: () => { m.remove(); this.pickUnit("협력 요청", "행동력 10 · 친우 이상이면 협력 보너스 +10%", cand, (u) => `${stageWith(u.id)} · ${STAT_KO[k.stat]} ${u.st[k.stat]} · 수락 ${helpChance(p, u)}%`, (u) => actTaskHelp(t.id, u.id)); } }, "협력 요청 (10)"));
      acts.push(h("button", { class: "mini", onclick: () => { m.remove(); this.confirm("임무 거부", t.origin === "order" ? `${U(t.issuer).name}의 명령을 거부하겠는가?\n공적 -20 · 관계 악화` : "임무를 그만두겠는가?", U(t.issuer)).then((ok) => { if (ok) { actTaskDecline(t.id); this.after(); } }); } }, t.origin === "order" ? "거부" : "그만두기"));
    }
    if (t.issuer === p.id) acts.push(h("button", { class: "mini", onclick: () => { actTaskCancel(t.id); m.remove(); this.after(); } }, "발령 취소"));
    return h("div", { class: "taskRow" },
      h("div", { class: "trHead" }, sdface(main, 34), h("div", { class: "grow" }, h("b", null, taskName(t), h("small", { class: "muted" }, ` @${t.city}`)),
        h("small", { class: "muted" }, `발령 ${U(t.issuer) ? U(t.issuer).name : "-"} · 수행 ${t.doers.map((id) => U(id).name).join(", ")}${coopBonus(t) ? ` · 협력 +${Math.round(coopBonus(t) * 100)}%` : ""}`)),
        h("div", { class: "trEta" }, h("small", null, "예상 완료"), h("b", null, dayStr(Math.max(t.eta, dayNow()))), h("small", { class: "muted" }, `공적 +${t.reward}`))),
      bar(t.prog, t.need, "ms"), h("div", { class: "trFoot" }, h("small", { class: "muted" }, `진행 ${Math.min(100, Math.round(t.prog / t.need * 100))}% · 하루 ${taskRate(t).toFixed(1)} (${STAT_KO[k.stat]} 기준)`), acts));
  },
  tasksModal() {
    const p = P();
    const body = h("div");
    const m = this.modal([h("h3", null, icon("list", 22), `임무 현황 — 오늘 ${todayStr()}`), body, h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list");
    const mine = (G.tasks || []).filter((t) => t.doers.includes(p.id) || t.issuer === p.id);
    const fac = p.fac ? (G.tasks || []).filter((t) => t.fac === p.fac && !mine.includes(t)) : [];
    body.append(h("p", { class: "muted small" }, "임무는 수행 장수의 능력치로 매일 진행된다 (한 달 30일, 행동력을 쓸수록 날이 지난다). 완료되면 공적·충성·도시 수치가 오른다."));
    body.append(h("h4", null, `내 임무 (${mine.length})`), mine.length ? h("div", null, mine.map((t) => this.taskRow(t, m))) : h("p", { class: "muted" }, p.fac ? (isGov(p) || isLord(p) ? "「임무 발령」으로 관할 장수에게 일을 맡길 수 있다." : (roleLv(p) >= 2 ? "상관이 임무를 내리기를 기다리거나, 「임무 제안」으로 직접 맡을 수 있다." : "상관이 임무를 내리기를 기다리자. 중신(편장군 이상)이 되면 직접 제안할 수 있다.")) : "재야는 임무를 받지 않는다. 의협 활동·교역으로 이름을 알리자."));
    if (fac.length) body.append(h("h4", null, `세력의 다른 임무 (${fac.length})`), h("div", null, fac.map((t) => this.taskRow(t, m))));
  },
  // mode: "propose" (중신 → 상관) | "issue" (태수 이상 → 관할 장수)
  taskModal(mode) {
    const p = P(); let kind = "agri", doer = null, aim = null; const helpers = new Set();
    const body = h("div");
    const m = this.modal([h("h3", null, icon("propose", 22), mode === "issue" ? "임무 발령" : "임무 제안"), body], "war");
    const pool = mode === "issue" ? officersOf(p.fac).filter((u) => u.id !== p.id && !isLord(u) && jurisOf(p).includes(u.city) && !taskBusy(u.id)).sort((a, b) => (b.city === p.city) - (a.city === p.city) || b.merit - a.merit) : [];
    doer = pool[0] || null;
    const draw = () => {
      body.innerHTML = "";
      const k = TASK_KIND[kind]; const city = mode === "issue" ? (doer ? doer.city : p.city) : p.city; const c = C(city);
      body.append(h("div", { class: "tgtList" }, Object.entries(TASK_KIND).map(([key, x]) => h("button", { class: "tgt" + (key === kind ? " on" : ""), onclick: () => { kind = key; aim = null; draw(); } }, icon(key === "search" ? "search" : key === "recruit" ? "recruit" : key === "diplo" ? "talk" : key, 18), h("span", null, x.ko), h("small", null, `${STAT_KO[x.stat]} · 자금 ${x.gold}`)))));
      if (mode === "issue") {
        body.append(h("h4", null, `수행 장수 (관할 ${jurisOf(p).join(", ")})`));
        body.append(h("div", { class: "warList" }, pool.length ? pool.map((u) => h("label", { class: "wrow" + (doer === u ? " on" : "") }, h("input", { type: "radio", name: "doer", checked: doer === u, onchange: () => { doer = u; helpers.clear(); aim = null; draw(); } }), sdface(u, 36), h("span", null, u.name, " ", gradeBadge(u)), h("small", null, `${u.city} · ${STAT_KO[k.stat]} ${u.st[k.stat]} · 충성 ${u.loyal}${issueAccept(u) < 100 ? ` (수락 ${issueAccept(u)}%)` : ""}`), h("b", null, ""))) : h("span", { class: "muted" }, "임무가 없는 관할 장수가 없다.")));
        const hp = doer ? unitsIn(doer.city).filter((u) => u.fac === p.fac && u.id !== doer.id && u.id !== p.id && !isLord(u) && !taskBusy(u.id)) : [];
        if (hp.length) body.append(h("h4", null, "협력 장수 (최대 3 · 수행 장수와 친우 이상이면 +10%)"), h("div", { class: "warList" }, hp.map((u) => h("label", { class: "wrow" + (helpers.has(u.id) ? " on" : "") }, h("input", { type: "checkbox", checked: helpers.has(u.id), disabled: !helpers.has(u.id) && helpers.size >= 3, onchange: (e) => { e.target.checked ? helpers.add(u.id) : helpers.delete(u.id); draw(); } }), sdface(u, 30), h("span", null, u.name), h("small", null, `${relStage(relOf(doer.id, u.id), isOath(doer.id, u.id))} (${relOf(doer.id, u.id)})`), h("b", null, "")))));
      }
      if (k.aim) {
        const free = unitsIn(city).filter((u) => !u.fac && !u.iron && u.id !== G.player);
        aim = aim && free.includes(U(aim)) ? aim : (free[0] ? free[0].id : null);
        body.append(h("h4", null, "교섭 상대 (같은 거점의 재야 장수)"), free.length ? h("div", { class: "tgtList" }, free.map((u) => h("button", { class: "tgt" + (aim === u.id ? " on" : ""), onclick: () => { aim = u.id; draw(); } }, sdface(u, 24), h("span", null, u.name)))) : h("p", { class: "muted" }, "이 거점에는 재야 장수가 없다."));
      }
      if (k.diplo) {
        const fs = diploTargets(p.fac);
        aim = aim && fs.includes(F(aim)) ? aim : (fs[0] ? fs[0].key : null);
        body.append(h("h4", null, "사절을 보낼 세력 (성공하면 12개월 휴전 · 정치·매력과 그 군주와의 관계가 성공률을 정한다)"), fs.length ? h("div", { class: "tgtList" }, fs.map((f) => h("button", { class: "tgt" + (aim === f.key ? " on" : ""), onclick: () => { aim = f.key; draw(); } }, flag(f, true), h("span", null, f.name), h("small", null, `거점 ${citiesOf(f.key).length}`)))) : h("p", { class: "muted" }, "사절을 보낼 세력이 없다."));
      }
      const doers = mode === "issue" ? (doer ? [doer.id, ...helpers] : []) : [p.id];
      const est = doers.length ? { kind, doers, need: k.need, prog: 0, start: dayNow() } : null;
      if (est) est.eta = taskEta(est);
      const needGold = k.gold + (mode === "propose" ? 100 : 0);
      const reason = !doers.length ? "수행 장수가 없다" : (k.aim || k.diplo) && !aim ? "교섭 상대가 없다" : c.gold < needGold ? `거점 자금 부족 (${needGold})` : null;
      body.append(h("p", { class: "muted small" }, est ? `${city} · 하루 진행 ${taskRate(est).toFixed(1)} / 목표 ${k.need} → 예상 완료 ${dayStr(est.eta)}${coopBonus(est) ? ` · 협력 보너스 +${Math.round(coopBonus(est) * 100)}%` : ""}` : ""));
      body.append(h("div", { class: "btns" },
        h("button", { class: "primary", disabled: !!reason, title: reason || "", onclick: () => { m.remove(); if (mode === "issue") actTaskIssue(kind, doer.id, [...helpers], aim); else actTaskPropose(kind, aim); this.after(); } }, reason || (mode === "issue" ? "발령 (행동력 10)" : `제안 (행동력 20 · 승인 ${proposeTaskChance(p)}%)`)),
        h("button", { onclick: () => m.remove() }, "취소")));
    };
    draw();
  },
  stratModal() {
    const p = P(); const lord = isLord(p); let goal = "dev", target = null;
    const tg = attackTargets(p.fac);
    const body = h("div");
    const m = this.modal([h("h3", null, icon("plot", 22), lord ? "평정 — 전략 목표 결정" : "평정 — 의견 제시"), body], "war");
    const draw = () => {
      body.innerHTML = "";
      const cur = stratOf(p.fac);
      body.append(h("p", { class: "muted" }, `현재 목표: 「${stratName(cur)}」${cur ? ` · ${Math.floor((cur.until - 1) / 12)}년 ${((cur.until - 1) % 12) + 1}월 말까지${cur.by && U(cur.by) ? ` · 제안 ${U(cur.by).name}` : ""}` : ""}`));
      body.append(h("div", { class: "tgtList" }, Object.entries(STRAT).map(([k, s]) => h("button", { class: "tgt" + (k === goal ? " on" : ""), disabled: k === "attack" && !tg.length, onclick: () => { goal = k; target = k === "attack" ? target || tg[0] : null; draw(); } }, h("span", null, s.ko), h("small", null, s.d)))));
      if (goal === "attack") body.append(h("h4", null, "공략 목표"), h("div", { class: "tgtList" }, tg.map((n) => h("button", { class: "tgt" + (n === target ? " on" : ""), onclick: () => { target = n; draw(); } }, flag(F(C(n).owner), true), h("span", null, n), h("small", null, `병력 ${fmt(C(n).troops)}`)))));
      body.append(h("p", { class: "muted small" }, lord ? "정한 목표는 이번 분기(3개월) 동안 소속 장수들의 행동을 바꾼다. 분기 안에 이루면 공적 보상." : `받아들여지면 공적 +40 · 군주 친밀 +3, 분기 안에 이루면 추가 공적. 채택 가능성 약 ${voiceChance(p)}%`));
      body.append(h("div", { class: "btns" },
        h("button", { class: "primary", disabled: goal === "attack" && !target, onclick: () => { m.remove(); if (lord) { actStratSet(goal, target); this.after(); } else this.stratVoiceFlow(goal, target); } }, lord ? "결정 (행동력 10)" : "진언 (행동력 15)"),
        h("button", { onclick: () => m.remove() }, "취소")));
    };
    draw();
  },
  // 평정 의견: 다른 중신이 반론하면 설전으로 맞서거나 군주에게 맡긴다
  async stratVoiceFlow(goal, target) {
    const opp = stratVoiceBegin(); this.after();
    if (opp === false) return;
    let mode = "roll";
    if (opp) {
      const o = U(opp);
      const ok = await this.confirm("평정 — 반론", `${o.name}: "${pick(["그 방침에는 찬성할 수 없어. 지금 우리 형편을 생각해 봐.", "말은 그럴듯하지만, 근거가 약해.", "그건 너무 성급한 판단이야."])}"\n\n설전으로 맞서 이기면 의견이 그대로 채택되고, 지면 보류된다.\n물러서면 군주의 판단에 맡긴다 (채택 가능성 약 ${Math.max(5, voiceChance(P()) - 10)}%).`, o, "설전으로 맞선다", "군주에게 맡긴다");
      if (ok) { const won = await new Promise((res) => Debate.start(P(), o, (w) => res(!!w))); mode = won ? "win" : "lose"; }
      else mode = "yield";
    }
    stratVoiceEnd(goal, target, mode, opp); this.after();
  },
  // 수행: 무예·학문
  pilgrimModal() {
    const p = P();
    const m = this.modal([h("h3", null, icon("train", 22), "수행"), h("p", { class: "muted" }, `이번 달 남은 행동력(${G.ap})을 모두 쓰고 노자 100을 들여 수행을 떠난다. 남은 행동력이 많을수록 경험이 크고, 30% 확률로 새 특기를 익힌다. 다음 달 행동력 -30.`),
      h("div", { class: "tgtList" }, Object.entries(PILGRIM).map(([k, x]) => h("button", { class: "tgt", onclick: () => { m.remove(); actPilgrim(k); this.after(); } }, h("span", null, `${k} 수행`), h("small", null, `${STAT_KO[x.main]}·${STAT_KO[x.sub]} · 특기 ${x.skills.filter((s) => !p.skills.includes(s)).join("·") || "없음"}`)))),
      h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list");
  },
  orderMoveModal() {
    const p = P(); const jz = jurisOf(p);
    this.pickUnit("이동 명령", `관할 거점: ${jz.join(", ")}`, officersOf(p.fac).filter((u) => u.id !== p.id && !isLord(u) && jz.includes(u.city)), (u) => `${u.city} · ${statusOf(u)}`, (u) => {
      this.pickCity(`${u.name} 이동`, "보낼 관할 거점을 고른다. (행동력 10)", jz.filter((n) => n !== u.city), (n) => `아군 장수 ${unitsIn(n).filter((x) => x.fac === p.fac).length}명`, (n) => actOrderMove(u.id, n));
    });
  },
  relModal() {
    const p = P();
    const list = Object.values(G.units).filter((u) => u.alive && !u.iron && u.id !== p.id && (u.bond > 0 || u.feud > 0 || u.sworn)).sort((a, b) => relOf(p.id, b.id) - relOf(p.id, a.id));
    const m = this.modal([h("h3", null, "인맥"),
      h("p", { class: "muted small" }, "지인 30 · 친우 60 (등용 +8%) · 막역지우 85 (등용 +15%) · 의자매 100 (거병·독립 동행). 친우 이상끼리 함께 출진하면 공격 +3%. 적대 -40 · 원수 -70이면 등용이 어려워진다. 장수끼리도 같은 방식으로 관계를 맺고, 이적·독립 때 서로를 따라간다."),
      h("div", { class: "tblWrap" }, h("table", { class: "tbl" }, h("tr", null, h("th"), h("th", null, "이름"), h("th", null, "단계"), h("th", null, "관계"), h("th", null, "소속"), h("th", null, "거점"), h("th", null, "성격")),
        list.slice(0, 120).map((u) => h("tr", { onclick: () => { m.remove(); this.unitDetail(u.id); } }, h("td", null, sdface(u, 26)), h("td", null, u.name), h("td", { class: relOf(p.id, u.id) < 0 ? "bad" : "good" }, stageWith(u.id)), h("td", { class: "num" }, relOf(p.id, u.id)), h("td", null, F(u.fac) ? F(u.fac).name : "재야"), h("td", null, u.city), h("td", null, perOf(u).type))))),
      list.length ? null : h("p", { class: "muted" }, "아직 가까운 장수가 없다. 교류·선물·연회·함께 하는 임무로 관계를 쌓자."),
      h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list wide");
  },
  fameModal() {
    const p = P(); const r = roleOf(p);
    const m = this.modal([h("h3", null, "위명 · 신분과 권한"),
      h("h4", null, `현재 신분: ${r}${p.fac ? ` (관품 ${rankName(p)} · 공적 ${fmt(p.merit)})` : ""}`),
      h("div", { class: "helpList" }, AUTH.map(([k, v]) => h("div", { class: "helpRow" + (k === r ? " cur" : ROLE_ORDER.indexOf(k) > ROLE_ORDER.indexOf(r) ? " locked" : "") }, h("b", null, k === r ? `▶ ${k}` : k), h("p", null, v)))),
      h("h4", null, "위명 (6계통)"),
      h("div", { class: "helpList" }, Object.entries(FAME).map(([line, d]) => {
        const v = (p.fame || {})[line] || 0, t = fameTier(p, line); const next = d.tiers[t];
        return h("div", { class: "helpRow" }, h("b", null, t ? d.tiers[t - 1][1] : line, h("small", { class: "muted" }, t ? ` ${line} ${t}단계` : " 미달성")),
          h("div", null, h("p", null, `실적: ${d.how} ${v}회${next ? ` → 「${next[1]}」까지 ${next[0] - v}회` : " · 최고 단계"}`), next ? bar(v, next[0], "ms") : null,
            h("small", { class: "muted" }, d.tiers.map(([n, nm], i) => `${i < t ? "✔" : "·"} ${nm}(${n}): ${d.unlock[i]}`).join("   "))));
      })),
      h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list wide");
  },

  factionList() {
    const p = P();
    const rows = Object.values(G.factions).filter((f) => f.alive).sort((a, b) => citiesOf(b.key).length - citiesOf(a.key).length).map((f) => {
      const cs = citiesOf(f.key); const os = officersOf(f.key);
      return h("div", { class: "frow" + (f.key === p.fac ? " mine" : "") }, flag(f), sdface(U(f.lord), 48),
        h("div", { class: "grow" }, h("b", null, f.name, G.truce[f.key] ? h("span", { class: "good small" }, ` 휴전 ${G.truce[f.key]}`) : null), h("div", { class: "muted" }, `군주 ${U(f.lord).name} · 거점 ${cs.length} · 장수 ${os.length} · 병력 ${fmt(cs.reduce((s, c) => s + c.troops, 0))}`), f.motto ? h("small", null, `“${f.motto}”`) : h("small", null, f.desc)),
        h("div", { class: "fbar" }, h("i", { style: `width:${(cs.length / 32) * 100}%;background:${f.color}` })));
    });
    const m = this.modal([h("h3", null, "세력 일람"), h("div", { class: "flist" }, rows), h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list");
  },

  unitList() {
    let sortK = "merit", facK = "all", q = "";
    const body = h("div");
    const m = this.modal([h("h3", null, "장수 일람"), body, h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "list wide");
    const draw = () => {
      body.innerHTML = "";
      const sel = h("select", { onchange: (e) => { facK = e.target.value; draw(); } },
        h("option", { value: "all" }, "전체"), h("option", { value: "free", selected: facK === "free" }, "재야"),
        Object.values(G.factions).filter((f) => f.alive).map((f) => h("option", { value: f.key, selected: facK === f.key }, f.name)));
      const search = h("input", { type: "search", placeholder: "이름", value: q, oninput: (e) => { q = e.target.value; draw(); setTimeout(() => body.querySelector("input[type=search]").focus(), 0); } });
      body.append(h("div", { class: "filters" }, sel, search, h("span", { class: "muted" }, "열 제목을 눌러 정렬")));
      let us = Object.values(G.units).filter((u) => u.alive && !u.missing && (facK === "all" || (facK === "free" ? !u.fac : u.fac === facK)) && (!q || (u.full + u.name).includes(q)));
      us.sort((a, b) => (sortK in a.st ? b.st[sortK] - a.st[sortK] : sortK === "name" ? a.name.localeCompare(b.name) : (b[sortK] || 0) - (a[sortK] || 0)));
      const th = (k, n) => h("th", { class: sortK === k ? "on" : "", onclick: () => { sortK = k; draw(); } }, n);
      body.append(h("div", { class: "tblWrap" }, h("table", { class: "tbl" },
        h("tr", null, h("th"), th("name", "이름"), th("grade", "등급"), h("th", null, "병종"), h("th", null, "소속"), h("th", null, "신분"), h("th", null, "거점"), STATS.map((k) => th(k, STAT_KO[k])), th("merit", "공적"), th("bond", "친밀")),
        us.slice(0, 300).map((u) => h("tr", { onclick: () => { this.unitDetail(u.id); } },
          h("td", null, sdface(u, 28)), h("td", null, u.name), h("td", null, gradeBadge(u)), h("td", { class: "muted" }, u.iron ? "철충" : `${CLS_KO[u.cls]}·${ROLE_KO[u.role]}`), h("td", null, F(u.fac) ? F(u.fac).name : "재야"), h("td", null, statusOf(u)), h("td", null, u.city),
          STATS.map((k) => h("td", { class: "num" + (u.st[k] >= 90 ? " hi" : "") }, u.st[k])), h("td", { class: "num" }, fmt(u.merit)), h("td", { class: "num" }, u.iron ? "-" : u.bond))))));
    };
    draw();
  },

  help(tab = 0) {
    const T = [
      ["기본 흐름", [["시간과 행동력", "시간은 실시간으로 흐른다 — 하루가 보통 1초(▸), 빠름 0.45초(▸▸), 매우 빠름 0.18초(▸▸▸). ⏸(스페이스)로 멈추고, ⏭로 이번 달 남은 날을 한꺼번에 보낸다. 창이나 대화가 열려 있으면 저절로 멈춘다. 행동력은 최대 100, 하루에 약 3씩(한 달에 100) 찬다. 30일이 지나면 정세 보고·평정·이벤트가 이어지고 자동 저장된다."], ["행군과 이동", "세력들은 달 중에 출진해 지도 위를 며칠에 걸쳐 행군하고, 도착한 날 싸운다(깃발에 병력 수). 내 거점으로 오는 군대는 빨간 선으로 보인다. 나도 이동하면 길을 따라 며칠에 걸쳐 가며(출발에 행동력 15), 가는 동안에는 다른 명령을 할 수 없다 — 머리막대의 「멈추기」로 그 자리에 멈춘다."], ["신분", "재야 → 사관 → 승진(종사·교위·편장군·장군·대장군) → 태수 임명 → 독립 또는 군주."], ["평정", "사관 중이면 매달 임무 3개 중 하나를 고른다. 2개월 안에 달성하면 큰 공적."], ["승리", "32개 거점을 모두 손에 넣으면 천하통일. 철충을 섬멸하고 20거점 이상을 확보해도 ‘패권 승리’."]]],
      ["내정·인물", [["내정", "농업(식량)·상업(자금)·기술·치안·방벽·징병. 특기가 있으면 효과 1.5배. 거점 자금 50 필요."], ["탐방", "재야 인재 발견, 자금·전술 데이터 입수. 재야 장수는 지도의 인물 목록에서 점선 테두리."], ["교류", "친밀도를 올린다. 교류할 때마다 짧은 대화가 열리고, 고민 상담·대련·바둑·요리 시식·산책·부탁·내기·다툼 중재 같은 일이 생기기도 한다. 고르는 대답에 따라 친밀·능력 경험·자금이 달라지며, 상대의 성격에 맞는 대답일수록 더 가까워진다. 말투(반말·존댓말·군대식 등)와 서로 부르는 호칭은 원작 스토리 대본에서 정리한 자료를 따르고, 원작에서 가까웠던 사이는 처음부터 친밀이 조금 높다. 50이면 개인 대화, 100이면 의자매(義) — 거병·독립 때 함께한다."], ["등용·사관", "대화로 확률 판정, 또는 설전에서 이기면 확정. 매력·친밀·명성이 성공률을 높인다."]]],
      ["장수제", [["이동", "지도 어디든 길을 따라 갈 수 있다(철충 거점은 지나갈 수 없음). 출발 15 + 구간마다 행동력 15. 행동력이 모자라면 남은 길은 다음 달 초에 이어 간다. 다른 세력 거점에서는 방문·교류·탐방만 하고 내정은 할 수 없다. 태수가 거점을 떠나면 태수 자리를 내놓는다."], ["신분과 권한", "재야 → 일반 → 중신(편장군 이상) → 태수 → 도독 → 군주. 신분이 오를수록 쓸 수 있는 명령이 늘어난다. 「임무」 탭(4)의 「위명·권한」에서 권한표를 볼 수 있다."], ["임무", "상관이 임무를 내리고, 중신은 직접 제안할 수 있다. 태수 이상은 관할 장수에게 발령한다. 수행 장수의 능력치로 매일 진행되고(한 달 30일), 친우 이상인 협력자가 있으면 빨라진다."], ["평정", "분기마다 세력의 전략 목표(내정 강화·군비 확충·인재 확보·수비 강화·공략)를 정한다. 중신은 의견을 내고, 군주는 직접 결정한다. 목표는 장수들의 실제 행동을 바꾼다."], ["인간관계", "교류·선물·연회·함께 하는 임무·함께 싸운 전투로 가까워지고, 적장으로 맞서면 적대가 쌓인다. 친우·막역지우·의자매 단계가 있고, 장수끼리도 관계를 맺어 등용·이적·독립에 영향을 준다. 「관계도」(장수 정보에서도 열 수 있다)에서 가운데 장수와 이어진 장수들을 선으로 본다 — 선 색은 관계 단계, 물결선은 원작에서 서로 부르던 사이, 겹선은 의자매. 장수를 한 번 누르면 정보, 한 번 더 누르면 그 장수가 가운데로 온다."], ["위명", "무관·문관·군사·장군·협객·상인 6계통. 실적이 쌓이면 상위 위명이 되고 새 명령이나 효과가 열린다. 협객(의협 활동)·상인(교역)은 재야에서도 걸을 수 있는 길이다."], ["질병·사망·후계", "장수는 병에 걸리기도 하고, 앓는 동안 세상을 떠날 수 있다. 같은 거점이면 병문안(행동력 15)으로 위험을 줄인다. 군주가 죽으면 공적·관계로 후계자가 정해지고(내가 될 수도 있다), 새 군주를 따르지 않는 장수는 떠나거나 독립한다. 나는 죽지 않지만 병에 걸리면 행동력이 줄고, 휴식하면 빨리 낫는다."], ["수행·평정 설전·외교", "「수행」은 이번 달 남은 행동력을 모두 써서 무예·학문을 닦고 특기를 익힌다. 평정에서 의견을 내면 다른 중신이 반론하기도 하는데, 설전으로 이기면 의견이 채택된다. 「친선 사절」 임무가 성공하면 그 세력과 12개월 휴전한다."], ["개인 이벤트", "매달 초 연회 초대·부탁·인재 추천·일기토 신청·설전 신청·이적 권유·독립 권유·재해·신하의 청원·도적 출몰·떠돌이 상인·병상의 소식 중 하나가 찾아오기도 한다. 내 세력에서 반란이 일어나면 진압 여부를 고른다. 수락하느냐에 따라 관계·공적·소속이 달라진다. 12월에는 논공행상으로 한 해의 공을 따진다."], ["세계", "장수마다 성격·야망·의리가 있다. 충성은 매달 군주와의 관계·대우에 따라 변하고, 충성이 낮으면 하야하거나 친구가 있는 세력으로 떠난다. 야망이 큰 태수는 독립하기도 한다."]]],
      ["전쟁", [["출진", "태수·군주는 인접 거점으로 출진. 일반 장수는 「출진 상신」으로 승인받으면 총대장이 된다."], ["병종 상성", "경장 ▶ 기동 ▶ 중장 ▶ 경장. 우위면 피해 +20%, 열세면 −15%."], ["역할", "공격기: 피해 +10% · 보호기: 받는 피해 −12% · 지원기: 방어 시 아군 전체 사기 회복, 책략 성공률 +10%."], ["부대 결속", "원작에서 같은 부대(스틸 라인, 둠 브링어 등)인 장수가 함께 출진하면 1명당 공격력 +7%."], ["승패", "공격측은 10턴 안에 수비군 전멸 또는 수비 총대장 격파. 총대장이 패주하면 그 군은 패배."]]],
      ["일기토·설전", [["일기토", "공격·강공·방어·필살. 강공은 방어에 간파당해 반격을 받는다. 방어로 기력을 모아 100이 되면 필살."], ["설전", "논리 ▶ 감정 ▶ 사실 ▶ 논리. 상성으로 이기면 큰 피해, 같은 종류면 숫자 비교. 6라운드 후 기세가 높은 쪽 승리."]]],
      ["단축키", [["메인 화면", "Space / N 다음 달 · 1 내정 · 2 군사 · 3 개인 · 4 임무 · F 세력 · U 장수 · G 외교 · V 내 위치 · C 연표 · M 메뉴 · H 또는 ? 가이드"], ["전투", "A 공격 · C 돌격 · P 책략 · D 방어 · S 일기토 (명령할 부대가 선택된 상태에서)"], ["대화·창", "Enter / Space 다음 대사 · Esc 대화 건너뛰기·창 닫기"]]],
      ["외교·기타", [["외교", "군주는 자금 300으로 다른 세력에 휴전을 제안할 수 있다. 휴전 중 12개월은 서로 공격하지 않는다."], ["철충", "등용 불가. 매달 병력이 불어나며 이웃을 노린다. 대공세 등 이벤트가 있다."], ["소리", "상단 🔊로 음소거. 설정에서 배경음·효과음·보이스 볼륨과 전투 연출 속도 조절."]]],
    ];
    const body = h("div");
    const draw = () => {
      body.innerHTML = "";
      body.append(h("div", { class: "tabs" }, T.map(([n], i) => h("button", { class: "tab" + (i === tab ? " on" : ""), onclick: () => { tab = i; draw(); } }, n))));
      body.append(h("div", { class: "helpList" }, T[tab][1].map(([k, v]) => h("div", { class: "helpRow" }, h("b", null, k), h("p", null, v)))));
    };
    draw();
    const m = this.modal([h("h3", null, "게임 가이드"), body, h("div", { class: "btns" }, h("button", { class: "primary", onclick: () => m.remove() }, "닫기"))], "list");
  },

  settings() {
    const pr = Sound.pref;
    const slider = (k, label) => h("label", { class: "srow" }, h("span", null, label), h("input", { type: "range", min: 0, max: 1, step: 0.05, value: pr[k], oninput: (e) => Sound.setVol(k, +e.target.value), onchange: () => (k === "sfx" ? Sound.sfx("click") : k === "voice" && G ? Sound.voice(G.player, "Join", ["Intro"]) : null) }));
    const m = this.modal([h("h3", null, "설정"),
      h("label", { class: "srow" }, h("span", null, "음소거"), h("input", { type: "checkbox", checked: pr.muted, onchange: (e) => { Sound.setMuted(e.target.checked); if (G) this.renderHeader(); } })),
      slider("bgm", "배경음"), slider("sfx", "효과음"), slider("voice", "보이스"),
      h("label", { class: "srow" }, h("span", null, "전투 연출 속도"), h("div", { class: "seg" }, [1, 2, 4].map((v) => h("button", { class: Battle.speed === v ? "on" : "", onclick: (e) => { Battle.speed = v; e.target.parentNode.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); } }, `×${v}`)))),
      h("label", { class: "srow" }, h("span", null, "일기토 자동 판정"), h("span", null, h("input", { type: "checkbox", checked: !!Battle.autoDuel, onchange: (e) => { Battle.autoDuel = e.target.checked; } }), h("small", { class: "muted" }, " 켜면 일기토를 직접 하지 않고 무력으로 판정"))),
      G && isLord(P()) ? h("label", { class: "srow" }, h("span", null, "태수 자율 출진"), h("span", null, h("input", { type: "checkbox", checked: !!G.flags.autoWar, onchange: (e) => { G.flags.autoWar = e.target.checked; } }), h("small", { class: "muted" }, " 군주 플레이 시 다른 거점 태수가 스스로 출진 (자동 전투)"))) : null,
      h("p", { class: "muted small" }, "테스트용: 주소 뒤에 ?mute=1 을 붙이면 음소거로 시작합니다."),
      h("div", { class: "btns" }, h("button", { class: "primary", onclick: () => m.remove() }, "닫기"))], "msg");
  },

  // 연표: 메인 서사 진척 + 지금까지의 기록
  records() {
    // 타이틀에서는 G가 없을 수 있으므로 원본 데이터로 초상을 만든다
    window.G0unit = (code) => (typeof G !== "undefined" && G && G.units && G.units[code]) || (typeof LAO_PC !== "undefined" && LAO_PC[code] ? { id: code, name: LAO_PC[code].n, iron: false } : null);
    let recs = []; try { recs = JSON.parse(localStorage.getItem("lao3k_records") || "[]"); } catch (er) {}
    const has = (f) => recs.some(f);
    const ACH = [["천하통일", (r) => r.kind === "천하통일"], ["패권 확립", (r) => r.kind === "패권"], ["무력 통일의 길", (r) => r.route === "force" && r.kind !== "패배"], ["함께 사는 길", (r) => r.route === "unity" && r.kind !== "패배"], ["사령관의 흔적 7/7", (r) => r.arc >= 7], ["칭호를 얻은 군주", (r) => !!r.title]];
    this.modal([h("h3", null, "기록실"),
      h("div", { class: "arcRow" }, ACH.map(([nm, f]) => h("span", { class: has(f) ? "on" : "" }, has(f) ? `★ ${nm}` : `☆ ${nm}`))),
      recs.length ? h("div", { class: "recCards" }, recs.map((r) => h("div", { class: "recCard" + (r.kind === "천하통일" || r.kind === "패권" ? " win" : "") },
        r.code && G0unit(r.code) ? sdface(G0unit(r.code), 56) : h("div", { class: "recNo" }, r.who ? r.who[0] : "?"),
        h("div", null, h("b", null, r.kind), h("span", null, `${r.who}${r.fac ? ` · ${r.fac}` : ""}`), h("small", null, r.date),
          h("div", { class: "recTags" }, r.route ? h("em", null, icon(r.route === "force" ? "war" : "propose", 14), r.route === "force" ? "무력 통일" : "함께 사는 길") : null, r.title ? h("em", null, r.title) : null, h("em", null, `서사 ${r.arc}/7`)))))) : h("p", { class: "muted" }, "아직 남은 기록이 없다. 엔딩을 보면 이곳에 기록된다."),
      h("div", { class: "btns" }, h("button", { onclick: (ev) => ev.target.closest(".modalBg").remove() }, "닫기"))], "msg");
  },
  chronicle() {
    const ARC = [["signal1", "첫 번째 신호", "2년차 겨울"], ["signal2", "두 번째 신호", "3년차 여름"], ["relic", "오르카 보급 상자", "4년차 봄"], ["signal3", "세 번째 신호", "5년차 가을"], ["lastLetter", "빈 관측소", "6년차 여름"], ["heirs", "계승 명분 다툼", "7년차 봄"], ["beacon", "송신기 재가동", "8년차 가을"]];
    const done = ARC.filter(([id]) => G.flags["ev_" + id]).length;
    const ttl = typeof activeTitle === "function" && activeTitle();
    this.modal([h("h3", null, "연표 · 사령관의 흔적"),
      h("div", { class: "arc" }, h("b", null, `메인 서사 ${done} / ${ARC.length}`), h("div", { class: "arcRow" }, ARC.map(([id, nm, when]) => h("span", { class: G.flags["ev_" + id] ? "on" : "", title: G.flags["ev_" + id] ? "" : `${when}쯤` }, G.flags["ev_" + id] ? nm : `??? · ${when}`)))),
      G.flags.route ? h("p", { class: "muted" }, `노선: ${G.flags.route === "force" ? "무력 통일" : "함께 사는 길"}`) : null,
      ttl ? h("p", { class: "muted" }, `칭호: ${ttl.t} — ${ttl.d}`) : null,
      h("div", { class: "chronList" }, (G.chron || []).slice().reverse().map((c) => h("div", { class: /^노선|^세력 행사/.test(c.text) ? "key" : "" }, h("i", null, c.d), /^노선/.test(c.text) ? icon(c.text.includes("무력") ? "war" : "propose", 16) : null, c.text))),
      h("div", { class: "btns" }, h("button", { onclick: (ev) => ev.target.closest(".modalBg").remove() }, "닫기"))], "msg");
  },
  ending(e) {
    const f = F(e.fac);
    const lines = e.hegemony ? [...STORY_HEGEMONY, ...(G.flags.route === "force" ? ["힘으로 세운 질서였다. 이제 그 힘을 어디에 쓸지가 남았다."] : G.flags.route === "unity" ? ["손을 내민 자들이 먼저 모여들었다. ‘함께 살아’ — 그 말은 아직 유효하다."] : [])] : e.win ? (G.flags.ev_lastLetter ? ["관측소의 채널이 마지막으로 열렸다. ‘모두가 하나가 되는 날’ — 약속의 그날이었다.", ...STORY.ending, ...(G.flags.route === "force" ? ["칼로 이룬 통일이었다. 상처는 깊었지만, 더는 서로를 겨누는 총구는 없다."] : G.flags.route === "unity" ? ["손을 맞잡아 이룬 통일이었다. ‘함께 살아’ — 그 약속은 지켜졌다."] : [])] : STORY.ending) : e.rival ? [`${f.name}의 깃발이 스물네 곳의 거점을 뒤덮었다.`, "천하의 대세는 정해졌다. 당신의 싸움은 여기서 막을 내린다.", "— 패배 · 다른 세력의 통일 —"] : f.iron ? ["대지는 철충에게 뒤덮였다.", "바이오로이드들의 저항은 기록 속으로 사라졌다...", "— GAME OVER —"] : [`${jo(f.name, "이가")} 천하를 통일했다.`, "당신의 이름은 역사의 한 줄로 남았다.", "— 다른 결말 —"];
    this.show("prologue");
    Sound.bgm(e.win ? "ending" : "sad");
    const box = $("#prologueText"); box.innerHTML = "";
    // 웹폰트는 글자 범위별로 나뉘어 받아진다. 엔딩 문장의 글자를 먼저 받아 두고 보여 준다 (일부 글자만 명조로 섞여 보이는 문제)
    box.style.visibility = "hidden"; fontsFor(lines.join("") + "천하통일패권확립종막").then(() => (box.style.visibility = ""));
    box.append(h("h2", null, e.hegemony ? "패권 확립" : e.win ? "천하통일" : "종막"));
    lines.forEach((t, i) => box.append(h("p", { style: `animation-delay:${0.4 + i * 1.6}s` }, t)));
    const s = G.stats;
    box.append(h("p", { class: "stat", style: `animation-delay:${0.6 + lines.length * 1.6}s` }, `${dateStr()} · 전투 ${s.wins}승 ${s.losses}패 · 등용 ${s.recruits}명 · 공적 ${fmt(P().merit)} · 거점 ${P().fac ? citiesOf(P().fac).length : 0}/32`));
    const hl = (G.chron || []).filter((c) => /점령|의자매|격파|달성|투항|대동맹|패권/.test(c.text)).slice(0, 5);
    if (hl.length) box.append(h("div", { class: "hlList", style: `animation-delay:${0.8 + lines.length * 1.6}s` }, hl.map((c) => h("span", null, h("i", null, `${c.d}`), c.text))));
    // 세력 행사 선택 이력으로 군주 칭호
    const fp = G.flags.facPick || {}; const top = Object.entries(fp).sort((x, y) => y[1] - x[1])[0];
    const TITLE_OF_OLD = { "포상금을 푼다": "아낌없이 베푼 군주", "검소하게 치른다": "검소한 군주", "방벽 보수": "성벽을 쌓은 군주", "병사 위로": "병사를 아낀 군주", "치안 점검": "거리를 지킨 군주", "인재 물색": "인재를 모은 군주", "연회를 연다": "매년 연회를 연 군주", "합동 훈련": "훈련장을 떠나지 않은 군주" };
    if (top && top[1] >= 2) box.append(h("div", { class: "hlList", style: `animation-delay:${1.2 + lines.length * 1.6}s` }, h("span", null, h("i", null, "칭호"), `${(FAC_TITLE[top[0]] || {}).t || top[0]} (세력 행사 「${top[0]}」 ${top[1]}회)`)));
    // 후일담: 의자매·주요 장수
    const p = P();
    let crew = Object.values(G.units).filter((u) => u.alive && !u.iron && u.fac === p.fac && u.id !== p.id).sort((a, b) => (b.sworn - a.sworn) || b.bond - a.bond || b.merit - a.merit).slice(0, 6);
    // 함께 설 동료가 적으면 원작 부대원·의자매·친밀한 장수를 불러 무대를 채운다
    if (crew.length < 4) {
      const extra = Object.values(G.units).filter((u) => u.alive && !u.iron && u.id !== p.id && !crew.includes(u) && (u.sworn || (p.squad && u.squad === p.squad) || u.bond >= 40)).sort((a, b) => (b.sworn - a.sworn) || ((b.squad === p.squad) - (a.squad === p.squad)) || b.bond - a.bond);
      crew = crew.concat(extra.slice(0, 4 - crew.length));
    }
    if (e.win && crew.length) {
      const EP = ["는 재건된 거점의 방위를 맡아 오래도록 이름을 남겼다.", "는 무기를 내려놓고 카페를 열었다. 단골은 언제나 붐볐다.", "는 남은 철충의 흔적을 쫓아 먼 땅으로 떠났다.", "는 신병 교육을 맡아 다음 세대를 길러 냈다.", "는 사령관의 곁에서 그날의 이야기를 들려주었다.", "는 폐허를 일구어 작은 마을을 세웠다."];
      box.append(h("h3", { class: "epH", style: `animation-delay:${0.6 + lines.length * 1.6}s` }, "그 후의 이야기"));
      crew.forEach((u, i) => box.append(h("p", { class: "ep", style: `animation-delay:${1 + lines.length * 1.6 + i * 0.5}s` }, h("img", { class: "epFace", src: `assets/sdface/${u.id}.webp` }), `${u.sworn ? "의자매 " : ""}${jo(u.full || u.name, "은는")}${EP[i % EP.length].slice(1)}`)));
    }
    if (G.chron && G.chron.length) box.append(h("details", { class: "chron" }, h("summary", null, "연표 보기"), G.chron.map((c) => h("div", null, h("i", null, c.d), c.text))));
    const capCity = p.fac && capitalOf(p.fac);
    const sd = h("div", { class: "endStage", style: capCity ? `--bg:url(assets/city/${CITY_BG[capCity]}.jpg)` : "" }); $("#prologue").append(sd);
    $("#prologue").classList.toggle("withEnd", !!e.win);
    if (e.win && typeof Stage !== "undefined" && Stage.ok) {
      const st = Stage.create(sd, { height: 7 }); const cast = [p, ...crew].slice(0, 7);
      const W = st.camera.right - st.camera.left;
      cast.forEach((u, i) => {
        const hero = i === 0; const back = !hero && i > 3;
        const slot = hero ? 0 : back ? (i - 5.5) * 2.4 : (i <= 2 ? -1 : 1) * (Math.ceil(i / 2) === 1 ? 2.6 : 5.0) * (i % 2 ? 1 : 1);
        const xs = hero ? 0 : [0, -2.6, 2.6, -5.2, 5.2, -3.9, 3.9][i] * Math.min(1, W / 16);
        const a = st.add(u.id, xs + (back ? 1.3 : 0), back ? -2.2 : -3.1, hero ? 4.2 : back ? 2.6 : 3.4, xs <= 0 ? 1 : -1, { z: hero ? 20 : back ? 5 : 12, full: true }); // 뒷줄도 지면에 붙인다
        if (back) setTimeout(() => a.sd && a.sd.setTint(0.72, 0.72, 0.78), 1500);
        setTimeout(() => {
          if (!st.alive) return;
          if (G.flags.route === "unity") { st.play(a, "idle", true); const sp = () => { if (!st.alive) return; for (let n = 0; n < 2; n++) { const side = Math.random() < 0.5 ? -1 : 1; st.sparkle(a.x + side * (0.9 + Math.random() * 0.8), a.y + Math.random() * 0.6 + (Math.random() < 0.5 ? 0 : a.h * 0.95), [0xffb8d8, 0xffe2a8][n]); } setTimeout(sp, 800 + Math.random() * 900); }; sp(); }
          else st.play(a, "win", true);
          if (i < 4) Sound.voice(u.id, i === 0 ? "MVP" : "Oath", ["MVP", "Join"]);
        }, 900 + i * 1400);
      });
      Sound.sfx("fanfare", 0.8);
      this.endStage = st;
    }
    if (e.win) { try { const n = +(localStorage.getItem("lao3k_clear") || 0) + 1; localStorage.setItem("lao3k_clear", n); } catch (er) {} }
    // 기록실: 엔딩 종류·노선·칭호·군주를 남긴다 (타이틀 「기록실」)
    try {
      const recs = JSON.parse(localStorage.getItem("lao3k_records") || "[]"); const tt = typeof activeTitle === "function" && activeTitle();
      recs.unshift({ kind: e.hegemony ? "패권" : e.win ? "천하통일" : e.rival ? "패배" : "종막", route: G.flags.route || "", title: tt ? tt.t : "", who: P().name, code: P().id, fac: F(e.fac) ? F(e.fac).name : "", date: dateStr(), arc: ["signal1", "signal2", "relic", "signal3", "lastLetter", "heirs", "beacon"].filter((id) => G.flags["ev_" + id]).length });
      localStorage.setItem("lao3k_records", JSON.stringify(recs.slice(0, 30)));
    } catch (er) {}
    $("#prologueNext").textContent = "타이틀로";
    $("#prologueNext").onclick = () => { if (this.endStage) { this.endStage.destroy(); this.endStage = null; } sd.remove(); $("#prologue").classList.remove("withEnd"); G = null; this.title(); };
  },
};

// ── 부팅 ───────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  // 부팅 검사: 스크립트가 하나라도 빠지면 아무것도 그리지 않고 다시 불러오기를 안내한다
  {
    const need = { Field: typeof Field, UI: typeof UI, h: typeof h, newGame: typeof newGame, hasSave: typeof hasSave, eqOf: typeof eqOf, Stage: typeof Stage, Duel: typeof Duel, Debate: typeof Debate, SD: typeof SD, SD_MAP_BUILT: typeof SD_MAP_BUILT, FACTIONS_RAW: typeof FACTIONS_RAW, LAO_PC: typeof LAO_PC, Sound: typeof Sound, EQUIP: typeof EQUIP, LAO_SKILL: typeof LAO_SKILL, LAO_LINES: typeof LAO_LINES, LINE_PEER: typeof LINE_PEER, CITY_BG: typeof CITY_BG, checkStoryEvents: typeof checkStoryEvents, Battle: typeof Battle };
    const missing = Object.keys(need).filter((k) => need[k] === "undefined");
    if (missing.length) { const bt = document.getElementById("boot"); if (bt) { bt.style.display = ""; bt.classList.remove("hide"); bt.innerHTML = `<b>라스트오리진 삼국지</b><span>일부 파일을 불러오지 못했습니다 (${missing.join(", ")})</span><button class="primary" onclick="location.reload()">다시 불러오기</button>`; } return; }
  }
  $("#btnNew").onclick = () => { Sound.sfx("open"); UI.prologue(); };
  $("#btnContinue").onclick = () => { if (loadGame()) { Sound.sfx("start"); if (typeof rtInit === "function") { rtInit(); UI.rtStart(); } UI.sel = P().city; UI.show("main"); UI.mapBgm(); UI.render(); } };
  $("#btnTitleSet").onclick = () => UI.settings();
  { const rb = document.createElement("button"); rb.id = "btnTitleRec"; rb.textContent = "기록실"; rb.onclick = () => UI.records(); const ref = $("#btnTitleSet"); if (ref) ref.after(rb); }
  $("#selSearch").oninput = () => UI.select();
  $("#btnEnd").onclick = () => {
    if (G && G.rt) { UI.rtSpeed = UI.rtSpeed ? 0 : UI.rtLastSpeed || 1; Sound.sfx("click", 0.5); UI.rtControls(); return; } // 실시간: 진행/멈춤
    if (UI.flushing || G.missionOffer) { if (G.missionOffer) UI.message("평정", "먼저 이번 달 임무를 선택하세요."); return; }
    Sound.sfx("turn");
    endMonth(); saveGame(); UI.sel = UI.sel || P().city; UI.after();
    UI.mapBgm();
  };



  $("#btnHere").onclick = () => { UI.sel = P().city; UI.render(); };
  $("#btnFac").onclick = () => UI.factionList();
  $("#btnUnits").onclick = () => UI.unitList();
  $("#btnDiplo").onclick = () => UI.diplomacy();

  $("#btnHelp").onclick = () => UI.help();
  $("#btnMenu").onclick = () => {
    if (UI.flushing || document.querySelector(".vn")) return UI.toast("이벤트가 끝난 뒤에 메뉴를 열 수 있습니다", "warn");
    const m = UI.modal([h("h3", null, "메뉴"), h("div", { class: "menuList" },
      h("button", { onclick: () => { m.remove(); UI.message("저장", saveGame() ? "저장했다. (매달 자동 저장됩니다)" : "저장에 실패했다."); } }, "저장"),
      h("button", { onclick: () => { m.remove(); if (loadGame()) { UI.sel = P().city; UI.render(); UI.message("불러오기", `${dateStr()} 기록을 불러왔다.`); } else UI.message("불러오기", "저장된 기록이 없다."); } }, "불러오기"),
      h("button", { onclick: () => { m.remove(); UI.chronicle(); } }, "연표 · 사령관의 흔적"),
      h("button", { onclick: () => { m.remove(); UI.settings(); } }, "설정"),
      h("button", { onclick: () => { m.remove(); UI.help(); } }, "게임 가이드"),
      h("button", { onclick: () => { m.remove(); UI.confirm("타이틀", "타이틀 화면으로 돌아가겠는가? (진행은 매달 자동 저장됨)").then((ok) => ok && UI.title()); } }, "타이틀로")),
      h("div", { class: "btns" }, h("button", { onclick: () => m.remove() }, "닫기"))], "msg");
  };
  $("#btnTitleHelp").onclick = () => UI.help();
  $("#btnSound").onclick = () => { Sound.setMuted(!Sound.pref.muted); UI.renderHeader(); };
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "Escape") {
      const m = [...document.querySelectorAll(".modalBg")].pop();
      if (!m && UI.popCity && !document.querySelector(".vn, .tut, .cityView") && !(e.target.closest && e.target.closest(".cityView"))) { UI.closePop(); return; }
      if (m) { // 「닫기」 버튼이 있으면 그것을 누른다 (선택이 필요한 확인 창은 닫지 않음)
        const close = [...m.querySelectorAll("button")].find((b) => /^(닫기|확인)/.test(b.textContent.trim()));
        if (close) close.click(); else if (!m.querySelector(".msg")) m.remove();
        return;
      }
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // 야전 중에는 메인 화면 단축키(장수 일람·외교 등)를 막는다 — 야전 키는 field.js가 따로 처리한다
    if (document.querySelector("#field.on")) return;
    const busy = document.querySelector(".modalBg, .vn, .tut");
    // 전투 명령: A 공격 / C 돌격 / P 책략 / D 방어 / S 일기토
    const bt = document.getElementById("battle");
    if (bt && bt.classList.contains("on") && !busy) {
      const idx = { a: 0, c: 1, p: 2, d: 3, s: 4 }[e.key.toLowerCase()];
      if (idx != null) { const b = bt.querySelectorAll(".bbtns button.act")[idx]; if (b && !b.disabled) { e.preventDefault(); b.click(); } }
      return;
    }
    // 메인 화면
    const main = document.getElementById("main");
    if (!main || !main.classList.contains("on") || busy || (document.getElementById("duel") || {}).classList?.contains("on")) return;
    const K = { " ": "#btnEnd", n: "#btnEnd", f: "#btnFac", u: "#btnUnits", g: "#btnDiplo", h: "#btnHelp", "?": "#btnHelp", m: "#btnMenu", v: "#btnHere" };
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (K[k]) { const b = document.querySelector(K[k]); if (b && !b.disabled) { e.preventDefault(); b.click(); } return; }
    if (["1", "2", "3", "4"].includes(k)) { UI.tab = ["dev", "mil", "self", "office"][+k - 1]; UI.render(); return; }
    if (k === "c" && typeof UI.chronicle === "function") UI.chronicle();
  });
  const cast = ["BR_Leona", "3P_Labiata", "PECS_Empress", "3P_ConstantiaS2", "BR_Valkyrie", "ST_Tiamat", "DS_Azazel"];
  const ready = typeof Stage !== "undefined" && Stage.ok && window.SD ? (Stage.ensure(), Promise.all(cast.map((c) => Stage.rigOf(c)).filter(Boolean).map((id) => SD.prepare(id)))) : Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 5000))]).then(() => {
    UI.title();
    const boot = document.getElementById("boot"); if (boot) { boot.classList.add("done"); setTimeout(() => boot.remove(), 500); }
  });
});

// 느린 서버에서 이미지 로드가 실패하면 지수 백오프로 5회까지 다시 시도하고, 끝내 실패하면 대체 표시로 바꾼다
function imgRetry(el) {
  el.addEventListener("error", () => {
    const n = +(el.dataset.retry || 0);
    const attr = el.tagName === "IMG" ? "src" : "href";
    const url = (el.getAttribute(attr) || "").split("?r=")[0]; if (!url) return;
    if (n >= 5) { // 최종 실패: SVG 아이콘은 깃발 글자, 초상은 흐린 원
      if (el.dataset.fb && el.parentNode) { const t = sv("text", { y: 5, class: "fl", fill: el.dataset.fbColor || "#ccc" }, el.dataset.fb); el.replaceWith(t); }
      else el.style.visibility = "hidden";
      return;
    }
    el.dataset.retry = n + 1;
    setTimeout(() => el.setAttribute(attr, `${url}?r=${n + 1}`), 400 * 2 ** n);
  });
}
document.addEventListener("error", (e) => { const el = e.target; if (el && el.tagName === "IMG" && !el.dataset.rw) { el.dataset.rw = 1; imgRetry(el); el.dispatchEvent(new Event("error")); } }, true);
