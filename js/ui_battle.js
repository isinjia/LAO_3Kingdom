// 라스트오리진 삼국지 — 전투 · 일기토 · 설전 화면
"use strict";

Object.assign(UI, {
  // ── 공용 연출 ──────────────────────
  // 연출 배속: 진형(턴제) 전투의 속도 설정을 따른다. 야전에서는 야전 배속과 무관하게 제 시간대로 보여 준다
  fxSpeed() { return document.querySelector("#field.on") ? 1 : Battle.speed || 1; },
  banner(title, sub, ms = 1300, cls = "") {
    // 배너는 겹쳐 쌓지 않는다: 새 배너가 뜨면 이전 배너는 바로 사라진다
    document.querySelectorAll(".banner:not(.out)").forEach((o) => { o.classList.add("out"); setTimeout(() => o.remove(), 500); });
    const b = h("div", { class: "banner " + cls }, h("div", { class: "bnIn" }, h("b", null, title), sub ? h("small", null, sub) : null));
    document.body.append(b);
    setTimeout(() => b.classList.add("out"), ms / this.fxSpeed());
    setTimeout(() => b.remove(), ms / this.fxSpeed() + 500);
  },

  // 스킬 컷인: 초상화가 사선 띠와 함께 지나간다
  cutin(b, text, sub) {
    if (!b || !b.u) return Promise.resolve();
    const f = F(b.u.fac);
    const el = h("div", { class: "cutin " + (b.side === "def" ? "rev" : ""), style: `--fc:${f ? f.color : "#e9c46a"}` },
      h("div", { class: "ciBand" }), h("img", { class: "ciImg", src: portrait(b.u) }),
      h("div", { class: "ciText" + (text.length > 6 ? " long" : "") }, h("small", null, (b.u.full || b.name) + (sub ? ` · ${sub}` : "")), h("b", null, text)));
    document.body.append(el);
    Sound.sfx("charge", 0.7);
    const d = 950 / this.fxSpeed();
    return new Promise((res) => { setTimeout(() => el.classList.add("out"), d - 250); setTimeout(() => { el.remove(); res(); }, d); });
  },

  // ── 전투 ───────────────────────────
  openBattle(B) {
    for (const n of ["attack", "charge", "plot", "defend", "duel", "auto", "retreat"]) { const im = new Image(); im.src = `assets/icon/${n}.webp`; }
    for (const b of B.all()) { const sk = skillOf(b); if (sk) { const im = new Image(); im.src = `assets/skill/${sk.ic}.webp`; } if (b.u) { const im = new Image(); im.src = `assets/sdface/${b.code}.webp`; } }
    const el = $("#battle"); el.innerHTML = ""; el.classList.add("on");
    B.$open = true;
    const stage = h("div", { class: "bStage", style: typeof CITY_BG !== "undefined" && CITY_BG[B.w.to] ? `--bbg:url(assets/city/${CITY_BG[B.w.to]}.jpg)` : "" }, h("div", { class: "bLabels" }), h("div", { class: "bFloat" }));
    el.append(
      h("div", { class: "bhead" },
        h("div", null, h("h2", null, B.title), h("small", { class: "muted" }, B.sub)),
        h("div", { class: "bBonus" }), h("div", { class: "bRound" })),
      stage,
      h("div", { class: "bbottom" }, h("div", { class: "bctrl" }), h("div", { class: "blog" })));
    this.battleStage = Stage.ok ? Stage.create(stage, { height: 10 }) : null;
    this.renderBattle(B);
    const loop = () => { if (!B.$open) return; this.updateBattleLabels(B); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },

  closeBattle() {
    const B = Battle; B.$open = false;
    document.querySelectorAll(".banner, .cutin").forEach((n) => n.remove());
    if (this.battleStage) { this.battleStage.destroy(); this.battleStage = null; }
    $("#battle").classList.remove("on"); $("#battle").innerHTML = "";
  },

  renderBattle(B) {
    const el = $("#battle"); if (!el.classList.contains("on")) return;
    el.querySelector(".bRound").textContent = `${Math.min(B.round, MAX_ROUNDS)} / ${MAX_ROUNDS}턴`;
    const bonus = el.querySelector(".bBonus"); bonus.innerHTML = "";
    for (const side of ["atk", "def"]) for (const q of B.bonus[side]) bonus.append(h("span", { class: "sbChip " + side }, h("img", { src: `assets/troop/${q.icon}.webp` }), `${q.name} ×${q.n}`));
    // 라벨(부대 정보 + 클릭 대상)
    const lab = el.querySelector(".bLabels"); lab.innerHTML = "";
    for (const b of B.all()) {
      const isFoe = b.side !== B.mySide;
      const targetable = B.pending && !b.out && B.cur && (B.pending === "skillAlly" ? !isFoe : isFoe);
      const mine = B.ctrl(b);
      const ord = B.orders[b.id];
      const node = h("div", { class: "blabel " + b.side + (b.out ? " out" : "") + (B.cur === b ? " cur" : "") + (mine ? " mine" : "") + (targetable ? " tgtable" : ""), "data-id": b.id,
        onclick: () => (targetable ? B.target(b.id) : mine ? B.select(b.id) : null) },
        (b.sx && Object.keys(b.sx).some((k) => b.sx[k] > 0 && !STATUS[k].hide)) || b.trait ? h("div", { class: "stChips" }, b.trait ? h("i", { class: "trait", title: TRAIT_KO[b.trait] }, TRAIT_KO[b.trait]) : null, Object.keys(b.sx || {}).filter((k) => b.sx[k] > 0 && !STATUS[k].hide).map((k) => h("i", { class: STATUS[k].bad ? "bad" : "good", title: `${STATUS[k].ko}: ${STATUS[k].desc} (${b.sx[k]}턴)` }, STATUS[k].ko))) : null,
        h("div", { class: "blName" }, b.u ? gradeBadge(b.u) : null, B.side(b.side)[0] === b ? h("i", { class: "cmdr", title: "총대장" }, "★") : null, h("b", { title: b.gname ? `${b.gname} ${b.name}` : b.name }, b.name), h("em", { class: "kn" }, b.troops >= 1000 ? (b.troops / 1000).toFixed(1) + "k" : fmt(b.troops))),
        h("div", { class: "blBars" }, bar(b.troops, b.max, "tr"), bar(b.morale, 100, "mo")),
        h("div", { class: "blNum" }, fmt(b.troops), b.u && !b.generic ? h("span", { class: "cl" }, CLS_KO[b.cls]) : null),
        ord && mine ? h("span", { class: "ord" }, ACT_KO[ord.act]) : null,
        targetable && B.pending === "skillAlly" ? h("span", { class: "tgtHint edge" }, "지원 대상") : targetable ? h("span", { class: "tgtHint" + (clsEdge(B.cur.cls, b.cls) > 1 ? " edge" : clsEdge(B.cur.cls, b.cls) < 1 ? " weak" : "") }, clsEdge(B.cur.cls, b.cls) > 1 ? "상성 우위" : clsEdge(B.cur.cls, b.cls) < 1 ? "상성 열세" : "대상") : null,
        h("div", { class: "hitbox" }));
      b.$label = node;
      lab.append(node);
    }
    this.updateBattleLabels(B);
    // 명령 (상태가 바뀔 때만 다시 그린다 — 아이콘 깜빡임 방지)
    const ctrl = el.querySelector(".bctrl");
    const ckey = [B.cur && B.cur.id, B.cur && B.cur.cd, B.pending, B.busy, Battle.speed, !B.cur && !B.busy].join("|");
    const skipCtrl = ctrl.dataset.key === ckey && ctrl.childNodes.length;
    ctrl.dataset.key = ckey;
    if (!skipCtrl) ctrl.innerHTML = "";
    const ACT = [["attack", "공격", "attack", "기본 공격"], ["charge", "돌격", "charge", "큰 피해, 반격을 받음"], ["plot", "책략", "plot", "지력 비교 — 성공 시 큰 피해"], ["defend", "방어", "defend", "받는 피해 절반·사기 회복 (지원기는 아군 전체 사기 회복)"], ["duel", "일기토", "duel", "적 장수에게 1:1 결투 신청"]];
    const ready = !B.cur && !B.busy;
    if (!skipCtrl) ctrl.append(B.cur ? h("div", { class: "bnow" }, sdface(B.cur.u, 52), h("div", null, h("b", null, B.cur.name), h("small", null, B.pending === "skillAlly" ? "▶ 지원할 아군 부대를 선택하세요" : B.pending ? "▶ 대상 적 부대를 선택하세요" : `${CLS_KO[B.cur.cls]}·${ROLE_KO[B.cur.role]} — 행동을 고르세요`)))
      : h("div", { class: "bnow" }, h("b", null, B.busy ? "교전 중..." : "모든 명령 완료")));
    const btns = h("div", { class: "bbtns" });
    if (B.cur) {
      for (const [k, n, ic, t] of ACT) btns.append(h("button", { class: "act" + (B.pending === k ? " on" : ""), title: t, onclick: () => B.choose(k) }, icon(ic, 34), h("span", null, n)));
      const sk = skillOf(B.cur);
      if (sk) btns.append(h("button", { class: "act skillBtn" + (B.pending === "skill" ? " on" : "") + (B.cur.cd <= 0 ? " ready" : ""), disabled: B.cur.cd > 0, title: `${sk.n} — ${skillSummary(sk)}${sk.d ? "\n원작: " + sk.d : ""}`, onclick: () => B.choose("skill") },
        h("img", { class: "ico", src: `assets/skill/${sk.ic}.webp`, style: "width:34px;height:34px" }), h("span", null, B.cur.cd > 0 ? `전법 (${B.cur.cd})` : sk.n.length > 6 ? sk.n.slice(0, 6) + "…" : sk.n)));
      btns.append(h("button", { class: "act ghost", onclick: () => B.autoAll() }, icon("auto", 34), h("span", null, "나머지 자동")));
    }
    if (ready) btns.append(h("button", { class: "primary go", onclick: async () => { B.busy = true; B.render(); await B.runRound(); B.busy = false; if (B.$open) B.render(); } }, "턴 진행 ▶"));
    btns.append(h("button", { class: "act ghost speed", title: "연출 속도", onclick: () => { Battle.speed = Battle.speed >= 4 ? 1 : Battle.speed * 2; this.renderBattle(B); } }, h("b", null, `×${Battle.speed}`), h("span", null, "속도")));
    if (B.entry.commander || B.mySide === "atk") btns.append(h("button", { class: "act danger", disabled: !B.cur, onclick: () => B.choose("retreat") }, icon("retreat", 34), h("span", null, "퇴각")));
    if (!skipCtrl) ctrl.append(btns);
    const lg = el.querySelector(".blog"); lg.innerHTML = "";
    lg.append(...B.logLines.slice(0, 18).map((l) => h("div", { class: l.cls }, l.t)));
  },

  updateBattleLabels(B) {
    const st = this.battleStage;
    const placed = [];
    for (const b of B.all()) {
      const n = b.$label; if (!n) continue;
      const a = b.actor;
      if (st && a) {
        const p = st.headOf(a);
        let y = p.y; const w = 136, hgt = b.out ? 0 : 40;
        if (!b.out) { for (let k = 0; k < 6; k++) { const hit = placed.find((q) => Math.abs(q.x - p.x) < w - 6 && Math.abs(q.y - y) < hgt); if (!hit) break; y = hit.y - hgt; } placed.push({ x: p.x, y }); }
        n.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(y)}px)`;
      } else {
        const i = B.side(b.side).indexOf(b);
        n.style.transform = `translate(${b.side === "atk" ? 120 + (i % 2) * 150 : 760 - (i % 2) * 150}px, ${120 + Math.floor(i / 2) * 110}px)`;
      }
      const bars = n.querySelectorAll(".bar i");
      if (bars[0]) bars[0].style.width = `${clamp((b.troops / b.max) * 100, 0, 100)}%`;
      if (bars[1]) bars[1].style.width = `${b.morale}%`;
      const num = n.querySelector(".blNum"); if (num && num.firstChild) num.firstChild.textContent = fmt(b.troops);
      const kn = n.querySelector(".kn"); if (kn) kn.textContent = b.troops >= 1000 ? (b.troops / 1000).toFixed(1) + "k" : fmt(b.troops);
      n.classList.toggle("out", b.out);
    }
  },

  popDamage(B, b, v, kind = "") {
    const st = this.battleStage; const fl = document.querySelector("#battle .bFloat");
    if (!fl || !st || !b.actor) return;
    const p = st.toScreen(b.actor.x, b.actor.y + b.actor.h * 0.7);
    const d = h("div", { class: "dmg " + kind, style: `left:${p.x + (Math.random() - 0.5) * 30}px;top:${p.y}px` }, (kind === "edge" ? "상성! " : kind === "weak" ? "" : "") + "-" + fmt(v));
    fl.append(d); setTimeout(() => d.remove(), 1100);
  },
  popText(B, b, t) {
    const st = this.battleStage; const fl = document.querySelector("#battle .bFloat");
    if (!fl || !st || !b.actor) return;
    const p = st.toScreen(b.actor.x, b.actor.y + b.actor.h * 0.8);
    const d = h("div", { class: "dmg txt", style: `left:${p.x}px;top:${p.y}px` }, t);
    fl.append(d); setTimeout(() => d.remove(), 1100);
  },

  battleResult(B, win, mvp) {
    const mine = B.side(B.mySide).filter((b) => !b.generic);
    const lost = (arr) => arr.reduce((s, b) => s + (b.max - b.troops), 0);
    return new Promise((res) => {
      const m = this.modal([
        h("div", { class: "resHead " + (win ? "win" : "lose") }, h("b", null, win ? "VICTORY" : "DEFEAT"), h("small", null, B.unitLabel ? `${B.w.to} · ${B.round}${B.unitLabel}` : `${B.w.to} · ${B.round > MAX_ROUNDS ? MAX_ROUNDS : B.round}턴`)),
        mvp && win ? h("div", { class: "mvp" }, face(mvp.u, 72, "lg"), h("div", null, h("small", null, "MVP"), h("b", null, mvp.u.full || mvp.name))) : null,
        h("div", { class: "resGrid" }, mine.map((b) => h("div", { class: "resRow" + (b.out ? " out" : "") }, sdface(b.u, 32), h("span", null, b.name), bar(b.troops, b.max, "tr"), h("b", null, fmt(b.troops)), b.kills != null ? h("small", { class: "muted" }, `처치 ${b.kills}${b.captured ? " · 포로" : b.withdrawn ? " · 철수" : b.out ? " · 패주" : ""}`) : null))),
        h("p", { class: "muted" }, `아군 손실 ${fmt(lost(B.side(B.mySide)))} · 적 손실 ${fmt(lost(B.foe(B.mySide)))}`),
        B.extra ? h("p", { class: "muted", style: "font-size:12px" }, B.extra) : null,
        h("div", { class: "btns" }, h("button", { class: "primary", onclick: () => { m.remove(); res(); } }, "확인"))], "result");
      m.querySelector(".btns button").focus();
    });
  },

  // ── 일기토 ─────────────────────────
  openDuel(D) {
    const el = $("#duel"); el.innerHTML = ""; el.classList.add("on");
    const stage = h("div", { class: "dStage" }, h("div", { class: "bFloat" }));
    el.append(h("div", { class: "dhead" }, h("h2", null, "一騎討 · 일기토"), h("small", null, "강공은 방어에 간파당한다 · 방어는 기력을 모은다 · 기력 100이면 필살")),
      h("div", { class: "dTop" }), stage, h("div", { class: "dCtrl" }), h("div", { class: "blog dlog" }));
    this.duelStage = Stage.ok ? Stage.create(stage, { height: 7 }) : null;
    if (this.duelStage) {
      D.aMe = this.duelStage.add(D.me.code, -2.6, -2.2, 3.4, 1, { z: 5 });
      D.aFoe = this.duelStage.add(D.foe.code, 2.6, -2.2, 3.4, -1, { z: 4 });
      D.homeMe = -2.6; D.homeFoe = 2.6;
    }
    this.renderDuel(D);
  },
  renderDuel(D, done) {
    const el = $("#duel"); if (!el.classList.contains("on")) return;
    const card = (b, s, cls) => h("div", { class: "dcardInfo " + cls }, face(b.u, 64, "lg"), h("div", { class: "grow" }, h("b", null, b.name, " ", b.u ? gradeBadge(b.u) : null), h("small", null, `무력 ${b.st.war}`),
      h("div", { class: "bnum" }, `체력 ${Math.max(0, Math.round(s.hp))} / ${Math.round(s.max)}`), bar(Math.max(0, s.hp), s.max, "hpb"), h("div", { class: "bnum" }, `기력 ${s.g}`), bar(s.g, 100, "gauge" + (s.g >= 100 ? " full" : ""))));
    const top = el.querySelector(".dTop"); top.innerHTML = "";
    top.append(card(D.me, D.s.me, "l"), h("div", { class: "bvs" }, "VS"), card(D.foe, D.s.foe, "r"));
    const c = el.querySelector(".dCtrl"); c.innerHTML = "";
    if (!done && D.intent) c.append(h("div", { class: "intent" }, "👁 ", D.foe.name, ": ", D.intent));
    if (!done) c.append(h("div", { class: "bbtns" },
      h("button", { class: "act", disabled: D.busy, onclick: () => D.act("attack") }, icon("attack", 34), h("span", null, "공격")),
      h("button", { class: "act", disabled: D.busy, onclick: () => D.act("heavy") }, icon("charge", 34), h("span", null, "강공")),
      h("button", { class: "act", disabled: D.busy, onclick: () => D.act("guard") }, icon("defend", 34), h("span", null, "방어")),
      h("button", { class: "act special" + (D.s.me.g >= 100 ? " ready" : ""), disabled: D.busy || D.s.me.g < 100, onclick: () => D.act("special") }, icon("beam", 34), h("span", null, "필살")),
      h("button", { class: "act danger", disabled: D.busy, onclick: () => D.flee() }, icon("retreat", 34), h("span", null, "물러선다"))));
    const lg = el.querySelector(".dlog"); lg.innerHTML = "";
    lg.append(...D.lines.slice(0, 6).map((t) => h("div", null, t)));
  },
  async duelExchange(D, mine, theirs, dmgMe, dmgFoe, cA, cB) {
    const st = this.duelStage;
    this.renderDuel(D);
    const tween = (a, to, ms) => new Promise((r) => { if (!a) return r(); const x0 = a.x, t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); a.x = x0 + (to - x0) * e; if (k < 1) requestAnimationFrame(step); else r(); }; requestAnimationFrame(step); });
    const shake = (big) => { const el = $("#duel"); el.classList.remove("shake", "shakeBig"); void el.offsetWidth; el.classList.add(big ? "shakeBig" : "shake"); };
    const flash = () => { const f = h("div", { class: "flash" }); $("#duel").append(f); setTimeout(() => f.remove(), 450); };
    // 공격하는 쪽은 앞으로 돌진
    const dashMe = mine !== "guard", dashFoe = theirs !== "guard";
    const sp2 = Battle.speed || 1;
    await Promise.all([dashMe ? tween(D.aMe, -0.9, 150 / sp2) : null, dashFoe ? tween(D.aFoe, 0.9, 150 / sp2) : null]);
    const sp = (a, mv, code) => {
      if (!st || !a) return;
      if (mv === "guard") { st.burst(a.x, a.y + a.h * 0.5, 0x6fc8ff, 1.1, 0.4); Sound.sfx("shield", 0.6); return; }
      st.play(a, mv === "attack" ? "atk" : "skill");
      if (!Sound.charSfx(code, mv === "attack" ? "s1" : "s2")) Sound.sfx(mv === "special" ? "bigboom" : "swing", 0.8);
    };
    if (mine === "special") { Sound.voice(D.me.code, "SpSkill", ["BattleFocus"]); await this.cutin(D.me, "필살!"); }
    if (theirs === "special") { Sound.voice(D.foe.code, "SpSkill", ["BattleFocus"]); await this.cutin(Object.assign({}, D.foe, { side: "def" }), "필살!"); }
    sp(D.aMe, mine, D.me.code); await new Promise((r) => setTimeout(r, 90 / sp2)); sp(D.aFoe, theirs, D.foe.code);
    await new Promise((r) => setTimeout(r, 240 / sp2));
    const pop = (a, v, t) => {
      if (!st || !a) return;
      const fl = document.querySelector("#duel .bFloat"); if (!fl) return; const p = st.toScreen(a.x, a.y + a.h * 0.75);
      const d = h("div", { class: "dmg big" + (t ? " txt" : ""), style: `left:${p.x}px;top:${p.y}px` }, t || "-" + v); fl.append(d); setTimeout(() => d.remove(), 1100);
    };
    if (dmgFoe > 0 && D.aFoe) { st.play(D.aFoe, "hit"); st.burst(D.aFoe.x, D.aFoe.y + D.aFoe.h * 0.5, 0xffd27a, mine === "special" ? 1.6 : 0.8); pop(D.aFoe, dmgFoe); Sound.sfx(mine === "special" ? "bigboom" : "hitbig", 0.8); }
    if (dmgMe > 0 && D.aMe) { st.play(D.aMe, "hit"); st.burst(D.aMe.x, D.aMe.y + D.aMe.h * 0.5, 0xff8a7a, theirs === "special" ? 1.6 : 0.8); pop(D.aMe, dmgMe); Sound.sfx("hit", 0.8); }
    if (cA && D.aFoe) pop(D.aMe, 0, "간파!"); if (cB && D.aMe) pop(D.aFoe, 0, "간파!");
    if (mine === "special" || theirs === "special") { flash(); shake(true); } else if (dmgFoe + dmgMe > 0) shake(false);
    await new Promise((r) => setTimeout(r, 200 / sp2));
    await Promise.all([tween(D.aMe, D.homeMe, 180 / sp2), tween(D.aFoe, D.homeFoe, 180 / sp2)]);
  },
  duelEnd(D, w) {
    const st = this.duelStage; if (!st) return;
    const wa = w === D.me ? D.aMe : D.aFoe, la = w === D.me ? D.aFoe : D.aMe;
    st.play(la, "die"); st.play(wa, "win", true);
    Sound.voice(w.code, "MVP", ["BattleFocus"]);
    this.banner(`${w.name} 승리`, "일기토 종료", 1500, w === D.me ? "win" : "lose");
  },
  closeDuel() { if (this.duelStage) { this.duelStage.destroy(); this.duelStage = null; } $("#duel").classList.remove("on"); $("#duel").innerHTML = ""; },

  // ── 설전 ───────────────────────────
  renderDebate(D, done) {
    const el = $("#debate"); el.classList.add("on"); el.innerHTML = "";
    const side = (u, s, cls, card) => h("div", { class: "dbSide " + cls },
      h("div", { class: "dbPortrait" }, h("img", { src: portrait(u) })),
      h("div", { class: "dbInfo" }, h("b", null, u.full || u.name), h("small", null, `지력 ${u.st.int}${hasSkill(u, "논객") ? " · 논객" : ""}`), h("div", { class: "bnum" }, `기세 ${Math.max(0, s.hp)} / ${s.max}`), bar(Math.max(0, s.hp), s.max, "gauge")),
      card ? h("div", { class: "bubble " + card.type }, h("b", null, CARD[card.type]), h("span", null, card.v)) : null);
    const L = D.last;
    el.append(h("div", { class: "dhead" }, h("h2", null, `舌戰 · 설전 ${Math.min(D.round, 6)} / 6`), h("small", null, "논리 ▶ 감정 ▶ 사실 ▶ 논리 · 상성으로 이기면 큰 피해 · 같은 종류는 숫자 비교")),
      h("div", { class: "dbField" }, side(D.me, D.s.me, "l" + (L && L.who > 0 ? " win" : L && L.who < 0 ? " hurt" : ""), null),
        L ? h("div", { class: "clash" + (L.who > 0 ? " mw" : L.who < 0 ? " fw" : "") }, h("div", { class: "cc me " + L.mine.type }, h("b", null, CARD[L.mine.type]), h("span", null, L.mine.v)), h("i", null, L.who > 0 ? "▶" : L.who < 0 ? "◀" : "="), h("div", { class: "cc foe " + L.theirs.type }, h("b", null, CARD[L.theirs.type]), h("span", null, L.theirs.v))) : h("div", { class: "bvs" }, "論"),
        side(D.foe, D.s.foe, "r" + (L && L.who < 0 ? " win" : L && L.who > 0 ? " hurt" : ""), null)),
      !done && D.foeNext ? h("div", { class: "intent" }, "👁 ", D.reveal === "type" ? jo(D.foe.name, "은는") : D.foe.name, D.reveal === "full" ? `의 다음 논거: 【${CARD[D.foeNext.type]} ${D.foeNext.v}】` : D.reveal === "type" ? ` 【${CARD[D.foeNext.type]}】${jo(CARD[D.foeNext.type], "으로").slice(CARD[D.foeNext.type].length)} 나올 것 같다` : " — 속내를 읽을 수 없다") : null,
      done ? h("div", { class: "dbResult" }, D.lines[0]) : h("div", { class: "hand" }, D.hand.map((c, i) => h("button", { class: "dcard " + c.type, onclick: () => D.play(i) }, h("b", null, CARD[c.type]), h("span", null, c.v), h("small", null, `▶ ${CARD[BEATS[c.type]]}`)))),
      h("div", { class: "blog dlog" }, D.lines.slice(0, 6).map((t) => h("div", null, t))));
  },
  closeDebate() { $("#debate").classList.remove("on"); $("#debate").innerHTML = ""; },
});
