// 라스트오리진 삼국지 — 야전 (삼국군영전식 실시간 전투)
// 화면 두 배 너비의 전장에서 양 진영의 장수(큰 SD)와 병사 무리(작은 SD)가 실시간으로 맞부딪힌다.
//   전투 전: 출진 화면 — 정찰 보고를 보고 진형 선택 (진형 상성 6진 순환: 어린 ▶ 학익 ▶ 봉시 ▶ 방원 ▶ 장사 ▶ 안행 ▶ 어린)
//   전투 중: 장수별 명령 5종(전군 돌격 · 장수 돌격 · 병사 돌격 · 대기 · 후퇴), 장수별 무장기 2~4종(기력 소모),
//            사기(병사가 쓰러지면 떨어지고, 30 아래로 내려가면 병사가 달아난다), 장수끼리 맞닥뜨리면 일기토
//   화면: 카메라(추적 · ←/→ · 드래그), 미니맵(클릭으로 이동)
//   승패: 적 총대장 격파 · 적 전멸 · 적 총붕괴 후 퇴각 / 제한 시간이 지나면 남은 전력 비교(공격측은 1.4배 필요)
"use strict";

const FLD = { X0: -19, X1: 19, Y0: -5.4, Y1: 0.6, TIME: 240, SURGE: 60, SURGE_K: 1.15, START: 7.5, FORM_CD: 40, EDGE_UP: 1.15, EDGE_DN: 0.91, SOLDIER_HP: 4000, GEN_VS_SOLDIER: 2.3, ALONE_DECAY: 1.5, SK_SOLDIER: 3.2, WALL_W: 3.6, PER: 120, COLLAPSE_T: 10 };
const fmtN = (n) => Math.round(n).toLocaleString();
// 진영색: 같은 병사 리그를 쓰는 양군을 구분한다 (공격 = 푸른빛, 수비 = 붉은빛)
const FLD_TEAM = { atk: [0.9, 1.0, 1.25], def: [1.2, 0.92, 0.88] }; // (색은 옅게 — 진영은 발판 원반이 가른다, 병사 그림이 탁해지지 않게)
// 진영 발판색 (병사 발밑 원반): 공격 = 파랑, 수비 = 빨강
const FLD_DISC = { atk: [0.5, 1.1, 1.8], def: [1.8, 0.55, 0.45] };
// 부대색: 같은 진영 안에서 장수마다 다른 빛깔 (발판·장수 고리) — 어느 병사가 어느 장수 부대인지 보인다
const FLD_SQUAD = { atk: [[0.45, 0.95, 1.9], [0.3, 1.6, 1.5], [0.85, 0.65, 1.9], [0.35, 1.4, 0.8], [0.4, 0.6, 1.7], [0.9, 1.3, 1.9]], def: [[1.9, 0.45, 0.4], [1.9, 1.05, 0.3], [1.7, 0.4, 1.1], [1.5, 1.4, 0.35], [1.25, 0.3, 0.3], [1.9, 0.75, 0.8]] };
const squadHex = (c) => (Math.min(255, Math.round(c[0] * 0.55 * 255)) << 16) | (Math.min(255, Math.round(c[1] * 0.55 * 255)) << 8) | Math.min(255, Math.round(c[2] * 0.55 * 255));
const FORMS = {
  fish: { n: "어린진", d: "쐐기 모양 돌파 진형 · 공격력 +8% · 받는 피해 +3%", atk: 1.08, def: 1.03, spd: 1, rng: 1, shape: "wedge" },
  crane: { n: "학익진", d: "양 날개를 펼쳐 감싼다 · 사거리 +25%", atk: 1, def: 1, spd: 1, rng: 1.25, shape: "wings" },
  square: { n: "방원진", d: "장수를 둘러싼 수비 진형 · 받는 피해 -12% · 이동 -10%", atk: 1, def: 0.88, spd: 0.9, rng: 1, shape: "ring" },
  arrow: { n: "봉시진", d: "화살촉 돌격 진형 · 이동 +25% · 충돌 피해 2배(4초 떨어졌다 다시 부딪히면 또) · 방원진에 +20% · 받는 피해 +5%", atk: 1, def: 1.05, spd: 1.25, rng: 1, shape: "arrow" },
  snake: { n: "장사진", d: "길게 늘어선 뱀 진형 · 이동 +10% · 측면 공격을 받지 않는다 · 사기가 덜 떨어지고(-40%) 두 배 빨리 회복", atk: 1, def: 1, spd: 1.1, rng: 1, shape: "snake", steady: 0.6 },
  geese: { n: "안행진", d: "기러기 떼처럼 비스듬히 선다 · 사거리 +15% · 공격력 +5%", atk: 1.05, def: 1, spd: 1, rng: 1.15, shape: "geese" },
};
// 진형 상성 (6진 순환): 키가 값을 이긴다 (이기는 쪽 주는 피해 ×FLD.EDGE_UP, 지는 쪽 ×FLD.EDGE_DN)
//   어린 ▶ 학익 ▶ 봉시 ▶ 방원 ▶ 장사 ▶ 안행 ▶ 어린
const FORM_EDGE = { fish: "crane", crane: "arrow", arrow: "square", square: "snake", snake: "geese", geese: "fish" };
const FORM_CYCLE = "어린진 ▶ 학익진 ▶ 봉시진 ▶ 방원진 ▶ 장사진 ▶ 안행진 ▶ 어린진";
const formLoser = (k) => FORM_EDGE[k];
const formWinner = (k) => Object.keys(FORM_EDGE).find((x) => FORM_EDGE[x] === k);
const FLD_SOLDIER = { def: ["BR_Brownie", "BR_Gnome", "BR_Impet"], alt: ["BR_Sylphid", "BR_Raven", "BR_Harpy"], iron: ["_iron2", "_iron", "_iron3"], AGS: ["AGS_SpartanA", "AGS_SpartanB", "AGS_SpartanC"], PECS: ["PECS_LemonadeAlpha", "PECS_LemonadeBeta", "PECS_LemonadeGamma"] }; // 경장 · 중장 · 기동
const FLD_STAT = [ // 경장 · 중장 · 기동
  { spd: 1.5, rng: 3.4, cool: 1.1, melee: false },
  { spd: 1.15, rng: 0.75, cool: 0.9, melee: true },
  { spd: 2.0, rng: 5.0, cool: 1.8, melee: false },
];
// 장수별 명령 (gen/troop: 1 전진 · 0 제자리 · -1 후퇴)
const FLD_CMD = {
  charge: { n: "전군 돌격", s: "돌격", k: "Q", ic: "charge", gen: 1, troop: 1, d: "장수와 병사가 함께 돌격한다" },
  gen: { n: "장수 돌격", s: "장수", k: "R", ic: "duel", gen: 1, troop: 0, d: "장수만 앞으로 나서고 병사는 그 자리를 지킨다" },
  troop: { n: "병사 돌격", s: "병사", k: "T", ic: "attack", gen: 0, troop: 1, d: "병사만 돌격시키고 장수는 뒤에서 지휘한다" },
  hold: { n: "대기", s: "대기", k: "W", ic: "defend", gen: 0, troop: 0, d: "그 자리에서 진형을 지키며 다가오는 적만 상대한다" },
  retreat: { n: "후퇴", s: "후퇴", k: "E", ic: "retreat", gen: -1, troop: -1, d: "본진 쪽으로 물러난다" },
};
// 무장기: 병종 기술(싸고 자주) · 원작 스킬(고유) · 대무장기(군주·SS 등급)
const FSK = {
  volley: { n: "일제 사격", cost: 40, kind: "line", ic: "SkillIconCircle_MGWideShot_active", d: "전방 일직선으로 탄막을 쏘아 길목의 적을 쓸어낸다" },
  breach: { n: "돌파 베기", cost: 40, kind: "dash", ic: "SkillIconCircle_WideSwordAttk_active", d: "전방으로 돌진하며 길목의 적을 벤다" },
  barrage: { n: "포격 지원", cost: 45, kind: "barrage", ic: "SkillIconCircle_CannonShotWide_active", d: "적이 밀집한 세 곳을 차례로 포격한다" },
  rally: { n: "독전", cost: 35, kind: "rally", ic: "SkillIconCircle_Command_active", d: "주변 아군 사기 +25 · 쓰러진 병사 재기" },
  storm: { n: "융단 폭격", cost: 90, kind: "storm", ic: "SkillIconCircle_AirStrike_active", d: "대무장기 — 전장 곳곳의 적 밀집지에 폭격이 쏟아진다" },
  // 계략: 지력 75 이상인 장수. 지형을 쓴다 — 숲에 든 적은 화계로 4초간 태우고, 강에 든 적은 수공으로 휩쓸어 기절시킨다
  plot: { n: "계략", cost: 50, kind: "plot", ic: "SkillIconCircle_WideFireShot_active", d: "숲의 적에게 화계(4초간 지속 화염) · 강의 적에게 수공(피해 + 장수 기절) · 지형이 없으면 작은 불화살" },
};
const FSK_ORIG = { 3: "strike", 4: "blast", 1: "heal", 2: "guard", 0: "rage" };
const FSK_KIND = { plot: "지형 계략", line: "직선 탄막", dash: "돌진", barrage: "연속 포격", rally: "사기 회복", storm: "전역 폭격", strike: "단일 강타", blast: "범위 폭발", heal: "회복·재기", guard: "보호 역장", rage: "자기 강화" };

const Field = {
  speed: 1,
  autoSkill: false,

  // ── 부대 구성 (start와 시뮬레이터가 함께 쓴다) ──
  setup(entry) {
    const w = entry.war, p = typeof P === "function" && typeof G !== "undefined" && G ? P() : null;
    Object.assign(this, { w, entry, mySide: entry.playerSide, finished: false, paused: false, busy: false, freeze: 0, t: 0, logLines: [], frames: {},
      timers: [], waves: [], duelCd: 12, aiT: -9, sel: null, scope: "all", groups: [], casts: { atk: 0, def: 0 },
      // 전투마다 새로 시작해야 하는 상태 (Field는 한 객체를 계속 쓰므로 이전 전투의 값이 남지 않게 초기화)
      surge: false, collapsed: {}, formCd: {}, formReact: {}, formAI: null, warnFocus: false, stepErr: false, retreatOk: -9, retreatOkReal: 0, spareMilitia: 0, contact: false, scouted: false, slow: 0, hitStop: 0, collapseT: {}, duelPair: {}, spotted: false, routing: null, hotX: null, hotT: -9, surgeEarly: false, lossChkT: 0 });
    const mk = (x, side) => ({ u: x.u, id: x.u.id, code: x.u.id, name: x.u.name, st: x.u.st, cls: x.u.cls, role: x.u.role, troops: x.troops, max: x.troops, morale: 80, side, out: false, lord: isLord(x.u), trait: x.u.iron ? IRON_TRAIT[x.u.id] || null : null });
    const byLead = (arr, side) => arr.sort((x, y) => { const k = (b) => (entry.commander && side === entry.playerSide && p && b.id === p.id ? 1e9 : 0) + (b.lord ? 1e8 : 0) + (b.u ? b.u.merit : 0); return k(y) - k(x); });
    const atk = byLead(w.atk.map((x) => mk(x, "atk")), "atk"), def = byLead(w.def.map((x) => mk(x, "def")), "def");
    // 수비병: 150명 미만의 반올림 잔여는 부대로 세우지 않는다 (전장에 없던 병력이 생겨나지 않게, 결과에 그대로 더한다)
    this.spareMilitia = def.length && w.militia > 0 && w.militia < 150 ? w.militia : 0;
    if (w.militia >= 150 || !def.length) {
      const g = !w.defFac ? GENERIC.militia : F(w.defFac).iron ? GENERIC.iron : GENERIC.guard;
      const total = def.length ? w.militia : Math.max(300, w.militia), parts = total > 6000 ? 3 : total > 2500 ? 2 : 1;
      const ALT = { _militia: ["_militia", "_militia", "_guard"], _guard: ["_militia", "_guard", "_guard"], _iron: ["_iron2", "_iron", "_iron3"] }[g.code];
      // 이름·리그·병종은 같은 번호에서 가져온다 (사격조 = 경장 사격, 돌격조 = 중장, 방벽조 = 기동)
      for (let k = 0; k < parts; k++) { const ix = parts === 1 ? 1 : k; def.push({ u: null, id: "_militia" + k, trait: IRON_TRAIT[ALT[ix]] || null, code: ALT[ix], name: ["돌격조", "사격조", "방벽조"][ix], gname: g.name, st: g.st, cls: [1, 0, 2][ix], role: 1, troops: Math.round(total / parts), max: Math.round(total / parts), morale: 70, side: "def", out: false, generic: true }); }
    }
    // 장수 없이 병력만 보낸 공격(철충 습격 등): 보낸 병력을 일반 부대로 세운다
    if (!atk.length) {
      const af = F(w.atkFac), g = af && af.iron ? GENERIC.iron : GENERIC.militia;
      const total = Math.max(300, w.sent || 0), parts = total > 6000 ? 3 : total > 2500 ? 2 : 1;
      const ALT = { _militia: ["_militia", "_militia", "_guard"], _iron: ["_iron2", "_iron", "_iron3"] }[g.code];
      for (let k = 0; k < parts; k++) atk.push({ u: null, id: "_raid" + k, trait: IRON_TRAIT[ALT[parts === 1 ? 1 : k]] || null, code: ALT[parts === 1 ? 1 : k], name: ["선봉", "본대", "후위"][k], gname: g.name, st: g.st, cls: [g.cls, (g.cls + 1) % 3, (g.cls + 2) % 3][k], role: 1, troops: Math.round(total / parts), max: Math.round(total / parts), morale: 70, side: "atk", out: false, generic: true });
    }
    this.units = { atk, def };
    // 지형: 전장 가운데쯤에 숲·강 띠가 0~2개 생긴다
    //   숲: 이동 -25%, 안에 있는 부대가 받는 피해 -15% (엄폐)   강: 이동 -40%, 안에서 주는 피해 -10%
    this.terrain = [];
    const nT = Math.random() < 0.25 ? 0 : Math.random() < 0.6 ? 1 : 2;
    for (let k = 0; k < nT; k++) {
      const kind = Math.random() < 0.55 ? "forest" : "river", wdt = kind === "forest" ? 2.6 : 1.5;
      for (let tries = 0; tries < 10; tries++) {
        const cx = (Math.random() - 0.5) * 12;
        // 숲은 전장 세로의 45~65%만 덮는 조각(위 또는 아래) — 돌아서 지나갈 수 있다. 강은 전장을 가로지른다
        if (this.terrain.every((t) => cx + wdt / 2 < t.x0 - 1 || cx - wdt / 2 > t.x1 + 1)) {
          const H = FLD.Y1 - FLD.Y0, part = kind === "forest" ? 0.45 + Math.random() * 0.2 : 1, top = Math.random() < 0.5;
          const y0 = kind === "forest" ? (top ? FLD.Y1 - H * part : FLD.Y0) : FLD.Y0, y1 = kind === "forest" ? (top ? FLD.Y1 : FLD.Y0 + H * part) : FLD.Y1;
          this.terrain.push({ kind, x0: cx - wdt / 2, x1: cx + wdt / 2, y0, y1 }); break;
        }
      }
    }
    const bonus = { atk: squadBonus(atk.map((b) => b.u)), def: squadBonus(def.map((b) => b.u)) };
    for (const s of ["atk", "def"]) for (const b of this.units[s]) { const q = bonus[s].find((x) => b.u && b.u.squad === x.key); b.mult = q ? q.mult : 1; }
    this.bonus = bonus;
    this.ctrl = (b) => b.side === this.mySide && !b.generic && (entry.commander || (p && b.id === p.id));
  },

  // 적(AI)의 진형: 부대 구성에 맞추되 가끔 의외의 진형을 고른다
  aiForm(side) {
    const arr = this.units[side], ranged = arr.filter((b) => b.cls !== 1).length / Math.max(1, arr.length);
    const ks = Object.keys(FORMS);
    if (Math.random() < 0.3) return ks[Math.floor(Math.random() * ks.length)];
    return side === "def" ? (ranged > 0.5 ? "crane" : "square") : ranged > 0.5 ? "crane" : Math.random() < 0.5 ? "fish" : "arrow";
  },
  // 정찰: 아군 최고 지력이 높을수록 적 진형을 미리 알아낸다
  scoutInt() { return Math.max(0, ...this.units[this.mySide].filter((b) => !b.generic).map((b) => b.st.int || 0)); },
  scoutChance() { return Math.max(0.15, Math.min(0.95, (this.scoutInt() - 30) / 50)); },

  async start(entry, onDone) {
    this.onDone = onDone; this.sim = false; this.speed = 1;
    // 무장기 모드: 보조(기본 — 선택하지 않은 아군 장수는 알아서 쓰고, 선택한 장수만 직접) · 전체 자동 · 수동
    this.autoSkill = typeof Battle !== "undefined" && !!Battle.autoSkill; this.skillAssist = true;
    this.setup(entry);
    const w = this.w, af = F(w.atkFac), df = F(w.defFac);
    this.title = `${af.name} ▶ ${w.to}`; this.sub = df ? `수비: ${df.name}` : "공백지 공략";
    const foeSide = this.mySide === "atk" ? "def" : "atk";
    const foeForm = this.aiForm(foeSide), scouted = Math.random() < this.scoutChance();
    // 출진 화면: 진형 선택 (또는 자동 전투로 전환)
    const pick = await FUI.prep(this, foeForm, scouted);
    if (pick === "auto" || pick === "formation") return onDone(pick);
    this.form = { [this.mySide]: pick, [foeSide]: foeForm };

    FUI.open(this);
    FUI.loading(this, "병사 집결 중…");
    const all = [...this.units.atk, ...this.units.def];
    const gens = all.filter((b) => !b.generic);
    await Promise.race([Promise.all(gens.map((b) => Stage.rigOf(b.code)).filter(Boolean).map((id) => SD.prepare(id))), new Promise((r) => setTimeout(r, 5000))]);
    const codes = new Set(all.map((b) => this.soldierCode(b)));
    for (const c of codes) this.frames[c] = (await Stage.bake(c).catch(() => null)) || this.tokenFrames(c);
    this.build();
    this.sel = this.groups.find((g) => this.ctrl(g.b)) || null;
    FUI.loading(this, null);
    FUI.snapCam(this);
    const boss = (df && df.iron) || af.iron || all.some((b) => b.lord);
    Sound.bgm(boss ? "boss" : "battle");
    this.say(`${w.to} 야전 개시! 적 총대장(★)을 쓰러뜨리면 승리 · ${FLD.SURGE}초부터 총공세 · ${FLD.TIME}초에 남은 전력 판정(공격측은 1.4배가 필요)`, "hot");
    const myF = this.form[this.mySide], foF = this.form[foeSide];
    this.scouted = scouted;
    if (scouted) this.say(`아군 「${FORMS[myF].n}」 · 적군 「${FORMS[foF].n}」${FORM_EDGE[myF] === foF ? " — 진형 상성 우위!" : FORM_EDGE[foF] === myF ? " — 진형 상성 열세" : ""}`, FORM_EDGE[myF] === foF ? "hot" : FORM_EDGE[foF] === myF ? "war" : "");
    else this.say(`아군 「${FORMS[myF].n}」 · 적 진형은 접전해야 알 수 있다`);
    for (const s of ["atk", "def"]) for (const q of this.bonus[s]) this.say(`부대 결속 — ${q.name} ×${q.n}: 공격력 +${Math.round((q.mult - 1) * 100)}%`, "hot");
    const lead = all.find((b) => b.side === this.mySide && !b.generic);
    if (lead) Sound.voice(lead.code, "SortiePick", ["StageStart", "BattleFocus"]);
    UI.banner("개전!", `${FORMS[myF].n} vs ${FORMS[foF].n} · 적 총대장(★)을 쓰러뜨리거나 적군을 무너뜨리면 승리`, 1800);
    Sound.sfx("start");
    this.busy = true; this.last = performance.now();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    FUI.firstHelp();
    await new Promise((r) => setTimeout(r, 900));
    this.busy = false; this.last = performance.now();
  },

  // 리그를 굽지 못하면(로딩 실패·WebGL 문제) 병사를 그린 토큰으로 대신 보여 준다 — 투명 병사가 싸우는 일이 없도록
  tokenFrames(code) {
    const mk = (lean) => {
      const cv = document.createElement("canvas"); cv.width = 96; cv.height = 120; const g = cv.getContext("2d");
      g.fillStyle = "#0006"; g.beginPath(); g.ellipse(48, 112, 22, 6, 0, 0, 7); g.fill();
      g.save(); g.translate(48, 110); g.rotate(lean);
      g.fillStyle = code.startsWith("_iron") ? "#6b7a5a" : "#7a6a52"; g.strokeStyle = "#1a140c"; g.lineWidth = 3;
      g.beginPath(); g.roundRect ? g.roundRect(-14, -58, 28, 50, 10) : g.rect(-14, -58, 28, 50); g.fill(); g.stroke();
      g.fillStyle = "#e9d6b8"; g.beginPath(); g.arc(0, -70, 13, 0, 7); g.fill(); g.stroke();
      g.restore(); return cv;
    };
    return { aspect: 96 / 120, move: [mk(-0.08), mk(0.08)], atk: [mk(0.25), mk(0.1)], idle: [mk(0)] };
  },
  // 병사 리그는 세력의 계열(군주 코드 앞머리)을 따른다: AGS = 스파르탄, PECS = 레모네이드, 철충 = 철충 개체, 그 밖(바이오로이드) = 브라우니·노움·임펫
  //   양군이 같은 병사 모습이 되는 일을 줄인다 (색만으로 가르지 않게)
  soldierCode(b) {
    if (b.generic) return b.code;
    const f = F(b.u && b.u.fac);
    if (f && f.iron) return FLD_SOLDIER.iron[b.cls] || "_iron";
    const corp = f && f.lord ? String(f.lord).split("_")[0] : "";
    const set = FLD_SOLDIER[corp] ? corp : "def";
    // 양군이 같은 병사 리그 묶음이면 수비측은 다른 묶음(실피드·레이븐·하피)으로 — 색만이 아니라 모습으로 가른다
    if (b.side === "def" && this.w) { const af = F(this.w.atkFac), ac = af && !af.iron && af.lord ? String(af.lord).split("_")[0] : ""; if ((FLD_SOLDIER[ac] ? ac : "def") === set && !(af && af.iron)) return FLD_SOLDIER.alt[b.cls] || "BR_Sylphid"; }
    return FLD_SOLDIER[set][b.cls] || "BR_Brownie";
  },

  skillsOf(b) {
    if (b.generic) return [];
    const base = b.role === 2 ? "rally" : ["volley", "breach", "barrage"][b.cls] || "volley";
    const list = [Object.assign({ id: base }, FSK[base])];
    const o = skillOf(b) || GENERIC_SKILLS.charge;
    list.push({ id: "orig", n: o.n, cost: 65, kind: FSK_ORIG[o.t] || "blast", ic: o.ic, d: o.d || SKILL_KIND[o.t], E: skillEffects(o) || { debuffs: [] }, big: true });
    if (b.lord || (b.u && b.u.grade >= 5)) list.push(Object.assign({ id: "storm", big: true }, FSK.storm));
    if ((b.st.int || 0) >= 75) list.push(Object.assign({ id: "plot" }, FSK.plot));
    return list;
  },

  // ── 전장 배치: 공격측은 왼쪽, 수비측은 오른쪽. 진형 모양대로 병사를 세운다 ──
  build() {
    const st = FUI.stage;
    this.groups = [];
    for (const side of ["atk", "def"]) {
      const dir = side === "atk" ? 1 : -1, arr = this.units[side], n = arr.length, fk = this.form[side], form = FORMS[fk];
      arr.forEach((b, i) => {
        const lanes = [0.5, 0.15, 0.85, 0.32, 0.68, 0.0, 1.0];
        const lane = n === 1 ? 0.5 : lanes[i % lanes.length];
        const gy = FLD.Y0 + 0.3 + lane * (FLD.Y1 - FLD.Y0 - 0.6);
        // 성벽이 있으면 수비병(자경단)은 성벽 위에 선다
        // 성벽이 있는 수비전: 수비 장수도 성벽 안(안쪽 줄)에서 시작한다
        // (성벽 수비: 수비병은 성벽 앞줄, 장수는 두 줄로 엇갈려 선다 — 한 자리에 포개지지 않게)
        const gx = b.generic && side === "def" && this.wallK() > 0 ? FLD.X1 - FLD.WALL_W + 0.5 + (i % 2) * 0.5 : side === "def" && this.wallK() > 0 ? FLD.X1 - 1.3 - (i % 2) * 1.6 : -dir * FLD.START - dir * (i === 0 ? 1.4 : (n > 4 ? (i % 3) * 0.85 : (i % 2) * 0.9));
        const S = FLD_STAT[b.cls] || FLD_STAT[0];
        const mpMax = b.generic ? 0 : Math.round(80 + (b.st.int || 40) * 0.7);
        // 성벽 위 수비병은 대기로 시작한다 (플레이어 쪽도 — 명령을 내리기 전까지 성벽을 지킨다)
        const onWall = b.generic && side === "def" && this.wallK() > 0;
        const g = { b, side, dir, x: gx, y: gy, fk, form, S, cmd: onWall ? "hold" : "charge", rally: { x: gx, y: gy }, mp: b.generic ? 0 : Math.round(mpMax * 0.15), mpMax, cool: 0, buff: 0, guard: 0, stun: 0, kills: 0, skK: 0, first: true,
          mor: (b.generic ? 60 : Math.min(90, 64 + (b.st.cha || 40) / 8)) + 0 /* (공격측 시작 사기 보정 없음 — 거울전 공정성) */, lossT: -9, aiSk: 1 + Math.random(), hpStage: 0,
          // 총대장(각 진영 첫 장수)은 체력 1.4배 — 전투가 총대장 한 명의 기습으로만 끝나지 않게
          hpMax: b.generic ? 0 : Math.round((1100 + b.st.war * 16 + b.st.ldr * 8) * (i === 0 ? 1.4 : 1)), soldiers: [], skills: this.skillsOf(b) };
        g.hp = g.hpMax; g.sq = FLD_SQUAD[side][i % FLD_SQUAD[side].length]; g.laneY = gy; // 출진한 줄 — 부대는 이 줄을 크게 벗어나지 않는다
        // 장수 키: 군주 1.5 · 장수 1.35 · 철충(기계형)은 0.85배 — 큰 기체가 주변 부대를 다 가리지 않게
        g.vh = (b.lord ? 1.8 : 1.6) * (b.u && b.u.iron ? 0.8 : String(b.code).startsWith("AGS_") ? 0.8 : 1); // 장수는 병사(0.95)보다 확실히 크게
        if (!b.generic && st) g.actor = st.add(b.code, gx, gy, g.vh, dir, { z: 0 });
        // 병사 수: 병력 120명당 1명 (5~36명) — 군영전다운 무리
        const cnt = Math.max(5, Math.min(36, Math.round(b.troops / FLD.PER)));
        g.per = b.troops / cnt; g.n0 = cnt;
        // 병사 한 명의 강도: 병력 120명 = 1.0 (0.4~4). 병사 수는 5~36명으로 묶이지만 큰 부대는 병사 하나하나가 더 단단하고 세다
        g.ps = Math.max(0.4, Math.min(4, g.per / FLD.PER));
        const fr = this.frames[this.soldierCode(b)];
        for (let k = 0; k < cnt; k++) {
          const off = this.formOffset(form.shape, k, cnt, dir);
          const s = { g, side, x: gx + off.x, y: Math.max(FLD.Y0, Math.min(FLD.Y1, gy + off.y)), hp: FLD.SOLDIER_HP * g.ps, cool: Math.random() * S.cool, alive: true, home: off, first: true };
          if (fr && st) { s.spr = st.addSprite(fr, s.x, s.y, 0.95 * this.depth(s.y), dir); s.spr.team = FLD_TEAM[side]; s.spr.teamDisc = g.sq; }
          g.soldiers.push(s);
        }
        this.groups.push(g);
      });
    }
  },
  depth(y) { return 1 - ((y - FLD.Y0) / (FLD.Y1 - FLD.Y0)) * 0.22; },
  formOffset(shape, k, n, dir) {
    // 줄 수는 병사 수에 따라 (3~6줄) — 큰 부대가 길게 늘어지지 않고 덩어리로 선다
    const rows = n > 24 ? 6 : n > 12 ? 4 : 3, row = k % rows, col = Math.floor(k / rows), r = row - (rows - 1) / 2;
    if (shape === "wedge") return { x: dir * (0.9 - col * 0.4), y: r * (0.26 + col * 0.05) };
    // 학익진: 양 날개가 앞으로 휘어 감싸는 초승달 (1~2겹)
    if (shape === "wings") { const lay = n > 18 ? 2 : 1, m = Math.ceil(n / lay), ly = Math.floor(k / m), i = k % m, a = -1.15 + 2.3 * (m > 1 ? i / (m - 1) : 0.5), rr = 1.25 + ly * 0.4; return { x: dir * (0.2 + (1 - Math.cos(a)) * 1.0 - ly * 0.35), y: Math.sin(a) * rr * 0.85 }; }
    if (shape === "ring") { const ring = k < 12 ? 0 : k < 30 ? 1 : 2, m = ring === 0 ? Math.min(12, n) : ring === 1 ? Math.min(18, n - 12) : n - 30, a = ((k - [0, 12, 30][ring]) / m) * Math.PI * 2 + ring * 0.3; return { x: Math.cos(a) * (0.9 + ring * 0.5), y: Math.sin(a) * (0.55 + ring * 0.28) }; }
    if (shape === "snake") { const j = Math.floor(k / 3), l = k % 3; return { x: dir * (1.2 - j * 0.34), y: (l - 1) * 0.22 + Math.sin(j * 0.7) * 0.25 }; } // 길게 늘어선 세 줄
    if (shape === "geese") { const j = Math.floor(k / 3), l = k % 3; return { x: dir * (0.9 - j * 0.3 - l * 0.15), y: (l - 1) * 0.28 + j * 0.15 - 0.6 }; } // 비스듬한 사선
    return { x: dir * (1.3 - col * 0.38 - Math.abs(r) * 0.28), y: r * 0.28 }; // arrow
  },

  say(t, cls = "") { this.logLines.unshift({ t, cls }); if (this.logLines.length > 60) this.logLines.length = 60; FUI.log(this); },
  alive(side) { return this.groups.filter((g) => g.side === side && !g.b.out); },
  enemies(side) { const out = []; for (const g of this.groups) if (g.side !== side && !g.b.out) { if (!g.b.generic && g.hp > 0) out.push({ g, gen: true, x: g.x, y: g.y }); for (const s of g.soldiers) if (s.alive) out.push({ g, s, x: s.x, y: s.y }); } return out; },
  later(d, fn) { this.timers.push({ t: this.t + d, fn }); },
  // 성벽: 거점 방어도가 있으면 수비측 끝 WALL_W 안이 성벽 지대. 그 안의 수비 부대는 받는 피해가 줄어든다
  wallK() { const d = this.w.cityDef || 0; return d > 0 ? Math.min(0.25, 0.06 + d / 8000) : 0; },
  inWall(o, side) { return side === "def" && this.wallK() > 0 && o.x >= FLD.X1 - FLD.WALL_W; },
  // 성 방어 지원: 거점 방어도는 성벽 밖의 수비 부대에도 보급·지원으로 작용한다 (받는 피해 -방어도/2500, 최대 -25%) — 자동 전투의 성 방어 보정과 맞춘다
  cityK(side) { return side === "def" ? 1 - Math.min(0.06, (this.w.cityDef || 0) / 8000) : 1; },
  // 성 방어는 한 번만: 성벽 안이면 성벽 보정, 밖이면 성 방어 지원 (겹치지 않는다)
  wallMul(o, side) { return (this.inWall(o, side) ? 1 - this.wallK() : this.cityK(side)) * (this.terrAt(o.x, o.y) === "forest" ? 0.85 : 1); },
  inZone(r, x, y) { return x >= r.x0 && x <= r.x1 && (y == null || r.y0 == null || (y >= r.y0 - 0.1 && y <= r.y1 + 0.1)); },
  terrAt(x, y) { const t = this.terrain && this.terrain.find((r) => this.inZone(r, x, y)); return t ? t.kind : null; },
  terrSpd(x, y) { const k = this.terrAt(x, y); return k === "forest" ? 0.75 : k === "river" ? 0.6 : 1; },
  isLead(g) { return this.units[g.side][0] === g.b; },
  homeX(g) { return g.side === "atk" ? FLD.X0 + 1.2 : FLD.X1 - 1.2; },

  // ── 메인 루프 (실시간: 0.05초 단위로 나눠 진행 — 배속이 높아도 충돌 판정이 빠지지 않는다) ──
  loop(now) {
    // 끝난 뒤에도 화면이 닫힐 때까지 그림은 계속 그린다 (승리 동작·흩어지는 병사가 멈추지 않게)
    if (this.finished) { if (FUI.stage) { const r = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now; FUI.stage.timeScale = 1; FUI.stage.tick(r); requestAnimationFrame(this.loop); } return; }
    // 한 프레임 최대 0.25초까지 따라잡는다 (4fps까지는 게임 시간이 느려지지 않는다. 진행은 0.05초 단위로 나눈다)
    const real = Math.min(0.25, Math.max(0, (now - this.last) / 1000)); this.last = now;
    if (this.hitStop > 0) this.hitStop -= real; // 히트스톱: 시간도 애니메이션도 잠깐 멈춘다
    else if (this.freeze > 0) this.freeze -= real;
    // slow: 결정적인 순간(총대장 패주)의 슬로모션
    else if (!this.paused && !this.busy) { if (this.slow > 0) this.slow -= real; let d = real * this.speed * (this.slow > 0 ? 0.3 : 1); while (d > 1e-4 && !this.finished && !this.busy && this.freeze <= 0) { const s = Math.min(0.05, d); try { this.step(s); } catch (e) { if (!this.stepErr) { this.stepErr = true; console.error(e); this.say("전투 처리 중 오류가 났다 — 계속 진행한다", "war"); } } d -= s; } } // 한 스텝의 예외가 전투 루프를 멈추지 않게
    FUI.frame(this, real);
    if (FUI.stage) FUI.stage.tick(Math.min(0.05, real)); // 갱신·카메라를 맞춘 바로 뒤에 그린다
    requestAnimationFrame(this.loop);
  },

  step(dt) {
    this.t += dt;
    if (this.timers.length) { const due = this.timers.filter((x) => x.t <= this.t); if (due.length) { this.timers = this.timers.filter((x) => x.t > this.t); for (const x of due) x.fn(); } }
    const foesOf = { atk: this.enemies("atk"), def: this.enemies("def") };
    if (this.waves.length) this.stepWaves(dt);
    // 처리 순서를 스텝마다 뒤집는다 (공격측이 늘 먼저 움직이고 먼저 치는 선공 편향을 없앤다)
    this.stepN = (this.stepN || 0) + 1;
    const order = this.stepN % 2 ? this.groups : this.groups.slice().reverse();
    for (const g of order) {
      for (const s of g.soldiers) if (s.flee) this.fleeStep(s, dt);
      if (g.b.out) continue;
      g.buff = Math.max(0, g.buff - dt); g.guard = Math.max(0, g.guard - dt); g.stun = Math.max(0, g.stun - dt); g.cool -= dt;
      if (g.mpMax) g.mp = Math.min(g.mpMax, g.mp + dt * (0.7 + (g.b.st.int || 40) / 180));
      // 철충 재생: 장수 체력이 초당 1% 차고, 6초마다 쓰러진 개체 하나가 다시 일어난다
      if (g.b.trait === "regen") { if (g.hpMax && g.hp > 0) g.hp = Math.min(g.hpMax, g.hp + g.hpMax * 0.01 * dt); if (this.t >= (g.regenT || 6)) { g.regenT = this.t + 6; const s = !g.broken && g.soldiers.find((x) => !x.alive && !x.gone && !x.wd && !x.revived); if (s) this.revive(s, g); } }
      if (g.mor < 60 && this.t - g.lossT > 3) g.mor = Math.min(60, g.mor + dt * 0.8 * (g.form.shape === "snake" ? 2 : 1));
      // 총대장의 존재: 총대장 3 안의 아군 부대는 사기가 초당 1.5씩 오른다(최대 70) — 무너질 때 총대장 곁으로 모이면 버틴다
      if (g.mor < 70) { const L = this.groups.find((o) => o.side === g.side && this.isLead(o) && !o.b.out && !o.b.generic && o.hp > 0); if (L && Math.hypot(L.x - (g.ux != null ? g.ux : g.x), L.y - (g.uy != null ? g.uy : g.y)) < 3) g.mor = Math.min(70, g.mor + dt * 1.5); }
      const foes = foesOf[g.side], C_ = FLD_CMD[g.cmd] || FLD_CMD.charge;
      // 행군: 첫 접전 전에는 빠르게 다가선다 (개전 직후 빈 전장을 오래 걷지 않게)
      const spd = g.S.spd * g.form.spd * (g.mor < 25 ? 0.85 : 1) * (this.contact ? 1 : 1.4);
      // ── 부대 기준점(ux, uy): 병사는 이 점을 중심으로 진형 자리(home)를 지킨다 → 부대가 덩어리로 움직이고 맞닿은 곳에 전열이 선다 ──
      const live = g.soldiers.filter((s) => s.alive);
      const sReach = g.S.rng * g.form.rng;
      // 방원진: 병사가 장수를 둘러싼 고리를 지킨다 (기준점 = 장수)
      // (지휘 중인 총대장 부대는 예외 — 총대장은 부대 뒤에 서므로 고리의 중심이 될 수 없다)
      const ring = g.form.shape === "ring" && !g.b.generic && g.hp > 0 && !(this.isLead(g) && g.cmd === "charge" && !this.surge);
      if (g.ux == null) { g.ux = g.x; g.uy = g.y; }
      if (C_.troop > 0 && !ring) this.advanceUnit(g, foes, live, sReach, spd, dt);
      else if (ring) { g.ux = g.x; g.uy = g.y; }
      else if (C_.troop === 0) { const dx = g.rally.x - g.ux, dy = g.rally.y - g.uy, L = Math.hypot(dx, dy); if (L > 0.05) { const st = Math.min(L, spd * dt * this.terrSpd(g.ux, g.uy)); g.ux += (dx / L) * st; g.uy += (dy / L) * st * 0.7; } }
      // 장수
      if (!g.b.generic && g.hp > 0 && g.stun <= 0 && !g.dash) {
        const reach = g.S.melee ? 0.75 : g.S.rng * g.form.rng * 0.8;
        // AI 목표: 적 총대장 집중 · 아군 총대장 호위 (focus가 살아 있으면 그쪽을 노린다)
        const fo = g.focus && !g.focus.b.out && g.focus.hp > 0 ? { g: g.focus, gen: true, x: g.focus.x, y: g.focus.y } : null;
        if (!fo) g.focus = null;
        const lead = this.isLead(g), hang = lead && g.cmd === "charge" && !this.surge; // 총대장은 총공세 전까지 자기 부대 뒤에서 지휘한다
        // 장수가 나서는 거리: 「장수 돌격」이거나 병사를 다 잃은 장수는 어디든, 보통은 전열 가까이(사거리 + 1.6), 지휘 중인 총대장은 사거리 안만
        const far = g.cmd === "gen" || (!live.length && !hang);
        let tgt = fo && (C_.gen > 0 || this.d(g, fo) <= reach) ? fo : this.nearest(g, foes, far ? 99 : hang ? reach + 0.3 : C_.gen > 0 ? reach + 1.6 : reach + 0.3, reach + 2);
        // 차단: 바로 앞(0.6 안)에 적 병사가 있으면 뚫고 지나가지 못하고 그 병사부터 상대한다
        if (tgt && tgt.gen && C_.gen >= 0) { const blk = this.nearest(g, foes.filter((f) => !f.gen), 0.6); if (blk) tgt = blk; }
        // 지배 영역: 적 병사가 1.1 안에 있으면 (사거리 안의 목표 장수를 치는 중이 아니라면) 그 병사부터 상대한다 — 전열을 돌아 후방으로 파고들지 못한다
        if (C_.gen >= 0 && !(tgt && tgt.gen && this.d(g, tgt) <= reach) && !(g.cmd === "gen" && fo)) { /* 장수 돌격으로 목표 적장을 노리는 중이면 병사 벽에 붙잡히지 않는다 */ const zoc = this.nearest(g, foes.filter((f) => !f.gen), 1.1); if (zoc) tgt = zoc; }
        if (C_.gen < 0) {
          this.moveToward(g, this.homeX(g), g.y, spd * (g.broken ? 0.55 : 1.05) * dt); // (무너진 부대의 장수는 느리게 — 추격해 잡을 수 있다)
          if (Math.abs(g.x - this.homeX(g)) < 0.4) this.withdraw(g); // 본진에 닿으면 병력을 보존한 채 전장을 떠난다
        }
        else if (tgt && this.d(g, tgt) <= reach) this.attack(g, g, tgt, true);
        else if (C_.gen > 0 && tgt) this.moveToward(g, tgt.x - g.dir * reach * 0.8, tgt.y, spd * dt); // 장수 돌격·목표 지정·병사를 잃은 장수는 어디든, 아니면 전열 가까이 온 적에게 나선다
        else {
          // 제자리(post): 보통은 자기 부대 앞쪽, 총대장은 부대 1.2 뒤. 병사를 다 잃은 총대장은 가장 가까운 아군 부대 뒤로 붙는다
          let px = g.ux + g.dir * (C_.gen > 0 ? 0.5 : 0), py = g.uy;
          if (C_.troop === 0 || g.cmd === "troop") { px = g.rally.x; py = g.rally.y; }
          if (hang) {
            const host = live.length ? g : this.groups.filter((o) => o !== g && o.side === g.side && !o.b.out && o.soldiers.some((s) => s.alive)).sort((a, b) => Math.abs(a.ux - g.x) - Math.abs(b.ux - g.x))[0];
            // 자리: 그 부대 병사들 가운데 가장 뒤에 선 병사보다 1 뒤 (기준점이 아니라 실제 병사 위치 기준)
            // 자리: 그 부대 병사 무리 한가운데(조금 뒤쪽) — 친위대에 둘러싸여 지휘한다 (홀로 뒤에 서 있지 않게)
            if (host) { const hl = host.soldiers.filter((s) => s.alive); px = hl.length ? hl.reduce((a, s) => a + s.x, 0) / hl.length - g.dir * 0.4 : host.ux - g.dir * 1.0; py = hl.length ? hl.reduce((a, s) => a + s.y, 0) / hl.length : host.uy; }
            else { const n = this.nearest(g, foes); if (n) { px = n.x - g.dir * reach * 0.8; py = n.y; } } // 기댈 아군이 없으면 직접 싸운다 (멈춰 서 있지 않는다)
            // 적 병사가 사거리 + 1 안으로 들어오면 한 걸음 물러선다 (총공세 전의 총대장은 앞에 나서지 않는다)
            // (물러서는 한계: 자기 병사 맨 뒤보다 1.0 뒤까지 — 자기 위치 기준으로 계속 물러나 혼자 떨어지지 않게)
            if (host) { const th = this.nearest(g, foes, reach + 1); if (th && !th.gen) { const hl = host.soldiers.filter((s) => s.alive); const rear = hl.length ? (g.dir > 0 ? Math.min(...hl.map((s) => s.x)) : Math.max(...hl.map((s) => s.x))) : host.ux; px = Math.min(px * g.dir, (rear - g.dir * 1.0) * g.dir) * g.dir; } }
          }
          if (Math.hypot(px - g.x, py - g.y) > 0.15) this.moveToward(g, px, py, spd * dt);
        }
      }
      // 장수는 적 병사 무리를 뚫고 지나가지 못한다: 바로 앞(0.45 안, 같은 줄)에 적 병사가 있으면 그 앞에서 멈춘다 (돌진 무장기는 예외)
      if (!g.b.generic && g.hp > 0 && !g.dash) for (const f of foes) { if (!f.s) continue; const ax = (f.x - g.x) * g.dir; if (ax > 0 && ax < 0.45 && Math.abs(f.y - g.y) < 0.8) { g.x = f.x - g.dir * 0.45; break; } } // (세로 0.8 안 — 옆으로 비켜 돌아가지 못하게)
      // 장수끼리 겹치지 않게 (같은 편이든 적이든 0.9 안이면 세로로 밀어낸다) — 장수 셋이 한 자리에 포개져 라벨 탑이 서지 않게
      if (!g.b.generic && g.hp > 0) for (const o of this.groups) { if (o === g || o.b.generic || o.b.out || o.hp <= 0) continue; const dx = g.x - o.x, dy = (g.y - o.y) * 1.6, L = Math.hypot(dx, dy); if (L < 0.9) { const push = (0.9 - L) * 0.5, sy = dy === 0 ? (g.side === "atk" ? 1 : -1) : Math.sign(dy); g.y = Math.max(FLD.Y0, Math.min(FLD.Y1, g.y + sy * push * 0.7)); g.x += (dx === 0 ? -g.dir : Math.sign(dx)) * push * 0.3; } }
      if (g.actor) { g.actor.x = g.x; g.actor.y = g.y; if (g.actor.sd) g.actor.sd.setOrder(20 + Math.round(-g.y * 10)); }
      // 무장기 (AI · 자동)
      if (g.mpMax && g.hp > 0 && this.t >= g.aiSk && (!this.ctrl(g.b) || this.autoSkill || (this.skillAssist && g !== this.sel))) { g.aiSk = this.t + 0.6; this.aiSkill(g); }
      // 보조 모드에서 선택한 장수: 기력이 가득 찬 채 5초가 지나면 알아서 쓴다 (기력이 넘쳐 버려지지 않게)
      else if (g.mpMax && g.hp > 0 && this.skillAssist && !this.autoSkill && g === this.sel) { g.fullT = g.mp >= g.mpMax - 0.5 ? (g.fullT || 0) + dt : 0; if (g.fullT > 5 && this.t >= g.aiSk) { g.aiSk = this.t + 0.6; this.aiSkill(g, true); } /* 대무장기는 직접 쓰도록 남긴다 */ }
      // 병사: 사거리 안의 적을 치고, 조금 앞(목줄 안)의 적에게는 한두 걸음 나서며, 아니면 진형 자리로 돌아간다
      const leash = g.S.melee ? 0.9 : 0.45; // 짧은 목줄: 맞붙어도 진형 모양이 남는다
      let engaged = 0;
      for (const s of live) {
        s.cool -= dt;
        // 같은 부대 병사끼리 겹치지 않게 살짝 밀어낸다
        for (const o of live) { if (o === s) continue; const dx = s.x - o.x, dy = (s.y - o.y) * 1.6, L = Math.hypot(dx, dy); if (L > 0 && L < 0.24) { s.x += (dx / L) * (0.24 - L) * 0.5; s.y = Math.max(FLD.Y0, Math.min(FLD.Y1, s.y + (dy / L) * (0.24 - L) * 0.3)); if (s.spr) { s.spr.x = s.x; s.spr.y = s.y; } } }
        if (C_.troop < 0) { this.moveToward(s, this.homeX(g) + s.home.x * 0.3, s.y, spd * dt * 1.05); this.anim(s, "move"); continue; }
        const hx = Math.max(FLD.X0, Math.min(FLD.X1, g.ux + s.home.x)), hy = Math.max(FLD.Y0, Math.min(FLD.Y1, g.uy + s.home.y));
        const tgt = this.nearest(s, foes, sReach + leash, sReach + 1); // 병사는 적 병사를 먼저 노린다
        if (tgt && this.d(s, tgt) <= sReach) {
          engaged++;
          // 경장 산개 사격: 근접 적이 바싹 붙으면 재장전하는 동안 한 걸음 물러나며 쏜다
          if (g.b.cls === 0 && s.cool > 0 && tgt.g.S.melee && this.d(s, tgt) < 1.0 && C_.troop >= 0) { this.moveToward(s, s.x - (tgt.x - s.x), s.y, spd * dt * 0.7); this.anim(s, "move"); }
          else this.anim(s, "idle");
          if (s.cool <= 0) this.attack(g, s, tgt, false);
        }
        // 앞의 적에게 나설 때도 진형의 세로 자리(hy)와 앞뒤 간격을 지킨다 — 맞붙어도 한 줄로 늘어서지 않고 진형 모양이 남는다
        else if (tgt && Math.hypot(s.x - hx, s.y - hy) < leash + 0.6) { this.moveToward(s, tgt.x - g.dir * Math.min(sReach * 0.7, 2.4) + s.home.x * 0.5, hy, spd * dt); this.anim(s, "move"); }
        else if (Math.hypot(hx - s.x, hy - s.y) > 0.08) { this.moveToward(s, hx, hy, spd * dt * 1.15); this.anim(s, "move"); } else this.anim(s, "idle");
        // 맞닿은 적 병사와는 겹치지 않는다 — 양쪽이 서로 밀어내 맞닿은 자리에 전열이 선다 (적진을 통과하지 못한다)
        if (tgt && tgt.s && tgt.s.alive) { const dx = s.x - tgt.s.x, dy = (s.y - tgt.s.y) * 1.6, L = Math.hypot(dx, dy); if (L < 0.55) { const k = (0.55 - L) * 0.5, ux = L > 0.001 ? dx / L : -g.dir; s.x = Math.max(FLD.X0, Math.min(FLD.X1, s.x + ux * k)); if (s.spr) s.spr.x = s.x; } }
      }
      g.engaged = live.length ? engaged / live.length : 0;
      // 동요: 사기가 30 아래면 병사가 하나둘 달아난다
      if (g.mor < 30) for (const s of g.soldiers) if (s.alive && Math.random() < dt * 0.35 * (1 - g.mor / 30)) this.desert(s, g); // 탈주는 눈에 보이게, 그러나 한순간에 무너지지 않게
      if (g.mor < 30 && !g.waver && g.side === this.mySide) { g.waver = true; this.say(`${g.b.name} 부대 사기 저하 — 병사들이 동요한다!`, "war"); }
      if (g.mor >= 40) g.waver = false;
      // 일반 부대(장수 없음)는 병사 무리 중심을 부대 위치로
      if (g.b.generic) { const al = g.soldiers.filter((s) => s.alive); if (al.length) { g.x = al.reduce((a, s) => a + s.x, 0) / al.length; g.y = al.reduce((a, s) => a + s.y, 0) / al.length; } if (C_.troop < 0 && al.length && Math.abs(g.x - this.homeX(g)) < 0.8) { this.withdraw(g); continue; } }
      const alive = g.soldiers.filter((s) => s.alive).length;
      g.b.troops = Math.round(alive * g.per);
      // 부대 붕괴(한 번만): 병사가 15% 아래로 줄면(총대장 부대 제외) 남은 병사가 흩어지고 장수도 물러난다 — 전멸까지 싸우지 않는다
      // broken 표시는 AI가 다시 돌격시키거나 재기 무장기가 병사를 되살려 붕괴가 반복되는 것을 막는다
      if (!this.isLead(g) && !g.broken && g.n0 >= 5 && alive > 0 && alive < g.n0 * 0.15 && !g.b.out) { g.broken = true; this.say(`${g.b.gname ? g.b.gname + " " : ""}${g.b.name} 부대 붕괴 — 남은 병사가 흩어진다`, g.side === this.mySide ? "war" : "hot"); FUI.bubble(this, g, "부대 붕괴", g.side === this.mySide ? "bad" : "good"); if (g.b.generic) { this.rout(g); continue; } for (const s of g.soldiers) if (s.alive) this.desert(s, g); g.mor = Math.min(g.mor, 10); this.setCmd(g, "retreat"); }
      // 고립: 주변 4 안에 아군 병사가 하나도 없으면 사기가 빠르게 떨어지고, 바닥나면 패주한다 (빈 전장의 장수끼리 싸움을 끝낸다)
      // 총대장은 절반 속도로 떨어진다. 아군 병사가 곁에 있으면 고립이 아니다
      if (!g.b.generic && g.hp > 0) {
        if (this.t >= (g.isoChk || 0)) { g.isoChk = this.t + 0.5; g.iso = !this.groups.some((o) => o.side === g.side && !o.b.out && o.soldiers.some((s) => s.alive && Math.hypot(s.x - g.x, s.y - g.y) < 4)); }
        // 총대장은 고립돼도 달아나지 않는다 — 대신 친위대 보호를 잃어 받는 피해가 커진다 (genK)
        // 후퇴 중에는 떨어지지 않고(병사와 함께 물러나는 중), 체력이 절반 넘게 남았으면 절반 속도로 떨어진다
        if (g.iso && !this.isLead(g) && g.cmd !== "retreat") { g.mor = Math.max(0, g.mor - dt * FLD.ALONE_DECAY * (g.hp > g.hpMax * 0.5 ? 0.5 : 1)); g.lossT = this.t; if (g.mor <= 0 && g.hp <= g.hpMax * 0.5) { this.say(`${g.b.name} — 고립되어 전장에서 패주한다`, "war"); FUI.bubble(this, g, "고립 패주", g.side === this.mySide ? "bad" : "good"); g.hp = 0; } } // 체력이 절반 넘게 남은 장수는 고립돼도 패주하지 않는다
      }
      if ((g.b.generic && (alive === 0 || g.mor <= 0)) || (!g.b.generic && g.hp <= 0)) this.rout(g);
    }
    if (this.t - this.aiT >= 1) { this.aiT = this.t; this.contactCheck(); this.aiCommand(); this.collapseCheck(); }
    // 총공세: FLD.SURGE(75초)가 지나면 양군 모두 사생결단 (주는 피해 ×FLD.SURGE_K, 총대장도 앞으로 나선다)
    // 총공세: 60초가 되거나, 접전 뒤 전체 병사의 40%가 쓰러지면 (판이 기울기 전에 고비가 온다)
    if (!this.surge && this.contact && this.t >= 20 && this.t - (this.lossChkT || 0) >= 1) { this.lossChkT = this.t; let n0 = 0, live = 0; for (const o of this.groups) { n0 += o.n0; live += o.soldiers.filter((x) => x.alive).length; } if (live <= n0 * 0.6) this.surgeEarly = true; }
    if (!this.surge && (this.t >= FLD.SURGE || this.surgeEarly)) { this.surge = true; const pc = Math.round((FLD.SURGE_K - 1) * 100); this.say(`총공세! 양군이 사생결단으로 맞붙는다 — 주는 피해 +${pc}%, 총대장도 나선다`, "hot key"); if (!this.sim) UI.banner("총공세", `남은 시간 ${FLD.TIME - FLD.SURGE}초 — 주는 피해 +${pc}%`, 1100); }
    this.duelCheck(dt);
    this.checkEnd();
  },

  // 부대 기준점 전진: 가장 가까운 적(같은 줄 우선)을 향해 나아가 사거리(근접은 맞닿는 거리)에서 멈춘다
  //   병사 절반 가까이가 이미 맞붙었으면 그 자리를 지키고, 병사가 자리에서 많이 처졌으면 기다린다 (부대가 흩어지지 않게)
  advanceUnit(g, foes, live, reach, spd, dt) {
    if (!foes.length) return;
    let best = null, bd = 1e9;
    for (const f of foes) { const d = Math.abs(f.x - g.ux) + Math.abs(f.y - g.uy) * 2.2; if (d < bd) { bd = d; best = f; } }
    if (g.frontD == null) g.frontD = Math.max(0.3, ...g.soldiers.map((s) => s.home.x * g.dir));
    const stand = g.frontD + (g.S.melee ? 0.2 : reach * 0.75);
    // 부대는 자기 줄(laneY)을 지킨다: 적 쪽으로는 45%만 기운다 — 모든 부대가 한 덩어리 기둥으로 모이지 않게 (집결 명령으로 옮긴 줄은 그대로)
    const lane = g.rallied ? g.uy : g.laneY != null ? g.laneY : g.uy;
    let tx = best.x - g.dir * stand, ty = lane + (best.y - lane) * 0.45;
    // 총대장 친위대는 예비대: 총공세 전 「전군 돌격」이면 아군 다른 부대들의 앞줄보다 2.5 뒤에 선다 (다가온 적은 그대로 상대한다)
    if (this.isLead(g) && g.cmd === "charge" && !this.surge) { let fr = null; for (const o of this.groups) if (o !== g && o.side === g.side && !o.b.out && o.ux != null && o.soldiers.some((s) => s.alive)) fr = fr == null ? o.ux : g.dir > 0 ? Math.max(fr, o.ux) : Math.min(fr, o.ux); if (fr != null && (tx - (fr - g.dir * 2.5)) * g.dir > 0) tx = fr - g.dir * 2.5; }
    if ((tx - g.ux) * g.dir < 0 || g.engaged > 0.45) tx = g.ux; // 전열은 스스로 물러나지 않는다 · 맞붙은 부대는 그 자리를 지킨다
    // 다만 병사들이 실제로 밀려났으면(사격병의 재장전 후퇴·넉백) 기준점도 병사들 쪽으로 따라 물러난다 — 기준점만 적진에 남지 않게
    if (live.length) { let cx = 0, cy = 0; for (const s of live) { cx += s.x - s.home.x; cy += s.y - s.home.y; } cx /= live.length; cy /= live.length; if ((g.ux - cx) * g.dir > 0.6) { g.ux += (cx - g.ux) * Math.min(1, dt * 1.5); g.uy += (cy - g.uy) * Math.min(1, dt * 1.5); return; } }
    if (live.length) { let lag = 0; for (const s of live) lag += Math.hypot(s.x - (g.ux + s.home.x), s.y - (g.uy + s.home.y)); if (lag / live.length > 1.1) tx = g.ux; }
    // 아군 다른 부대와 같은 줄에 겹치면 세로로 비켜선다
    for (const o of this.groups) if (o !== g && o.side === g.side && !o.b.out && o.ux != null && Math.abs(o.ux - g.ux) < 2.2 && Math.abs(o.uy - g.uy) < 1.2) ty = g.uy + (g.uy >= o.uy ? 1 : -1) * 0.8;
    const dx = tx - g.ux, dy = ty - g.uy, L = Math.hypot(dx, dy);
    if (L > 0.02) { const st = Math.min(L, spd * dt * this.terrSpd(g.ux, g.uy)); g.ux += (dx / L) * st; g.uy += (dy / L) * st * 0.7; }
    g.ux = Math.max(FLD.X0, Math.min(FLD.X1, g.ux)); g.uy = Math.max(FLD.Y0 + 0.3, Math.min(FLD.Y1 - 0.3, g.uy));
  },
  d(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) * 1.6); },
  nearest(a, list, max = 99, screen = 0) {
    let best = null, bd = max, bs = null, bsd = max;
    for (const f of list) { const d = this.d(a, f); if (d < bd) { bd = d; best = f; } if (!f.gen && d < bsd) { bsd = d; bs = f; } }
    // screen: 이 거리 안에 적 병사가 있으면 장수보다 병사를 먼저 상대한다
    return screen && bs && bsd <= screen ? bs : best;
  },
  moveToward(o, x, y, step) {
    const dx = x - o.x, dy = y - o.y, L = Math.hypot(dx, dy); if (L < 0.02) return;
    if (!o.flee) step *= this.terrSpd(o.x, o.y); // 숲·강에서는 느려진다
    o.x += (dx / L) * Math.min(step, L); o.y += (dy / L) * Math.min(step, L) * 0.7;
    o.x = Math.max(FLD.X0, Math.min(FLD.X1, o.x)); o.y = Math.max(FLD.Y0, Math.min(FLD.Y1, o.y));
    if (o.spr) { o.spr.x = o.x; o.spr.y = o.y; o.spr.h = 0.95 * this.depth(o.y); if (Math.abs(dx) > 0.05) o.spr.face = dx > 0 ? 1 : -1; }
    if (o.actor && Math.abs(dx) > 0.05 && FUI.stage) FUI.stage.setFace(o.actor, dx > 0 ? 1 : -1);
  },
  // idle 표시를 남겨 두면 공격 동작이 끝난 뒤 제자리 걸음이 아니라 대기 자세로 돌아간다
  anim(s, name) { if (!s.spr || !FUI.stage) return; s.spr.idle = name === "idle"; if (s.spr.anim !== "atk") FUI.stage.spriteAnim(s.spr, name); },

  // 피해 배율: 결속 · 진형 · 진형 상성 · 사기 · 강화
  mulVs(g, tg) { return (g.b.mult || 1) * g.form.atk * (FORM_EDGE[g.fk] === tg.fk ? FLD.EDGE_UP : FORM_EDGE[tg.fk] === g.fk ? FLD.EDGE_DN : 1) * (0.9 + g.mor / 500) * (g.buff > 0 ? 1.4 : 1) * (this.surge ? FLD.SURGE_K : 1) * (g.formT > this.t ? 0.7 : 1); },
  // 장수가 받는 피해 배율: 총대장 친위대 · 진형 · 역장 · 보호기 · 성 방어
  genK(tg) { return (this.isLead(tg) && !tg.iso ? (this.surge ? 0.8 : 0.6) : 1) /* 총공세 뒤에는 총대장 친위 보호가 절반으로(-40% → -20%) — 총대장을 쓰러뜨리는 결말이 나오게 */ * tg.form.def * (tg.guard > 0 ? 0.6 : 1) * (tg.b.role === 0 ? 0.88 : 1); }, // 성 방어는 wallMul에서 한 번만 적용한다
  genHit(tg, v) {
    tg.lossT = this.t; tg.mor = Math.max(0, tg.mor - (v / tg.hpMax) * 40);
    const r = tg.hp / tg.hpMax, stage = r < 0.25 ? 2 : r < 0.5 ? 1 : 0;
    if (stage > tg.hpStage) { tg.hpStage = stage; tg.mor = Math.max(0, tg.mor - 8); if (tg.side === this.mySide && !this.sim) this.say(`${tg.b.name} 부상 (체력 ${Math.round(r * 100)}%)`, "war"); FUI.bubble(this, tg, stage === 2 ? "중상!" : "부상", tg.side === this.mySide ? "bad" : "good"); }
  },

  // 공격: who = 장수 그룹(g) 또는 병사(s), tgt = { g, s } 또는 { g, gen }
  attack(g, who, tgt, isGen) {
    // 대상 목록은 스텝 처음에 만든다 — 같은 스텝에서 이미 패주·전사한 대상은 건너뛴다
    if (tgt.g.b.out || (tgt.gen && tgt.g.hp <= 0) || (tgt.s && !tgt.s.alive)) return;
    const S = g.S, a = g.b;
    if (isGen) { if (g.cool > 0) return; g.cool = S.cool * 0.8; }
    else who.cool = S.cool * (0.85 + Math.random() * 0.3);
    const tg = tgt.g;
    // 교전 지점 기록(카메라용): 아군이 치거나 맞은 자리의 지수 평균
    if ((g.side === this.mySide || tg.side === this.mySide) && !this.sim) { this.hotX = this.hotX == null ? tgt.x : this.hotX * 0.96 + tgt.x * 0.04; this.hotT = this.t; }
    let v = (isGen ? 18 + a.st.war * 0.42 : (9 + (S.melee ? a.st.war : a.st.ldr) * 0.12) * g.ps) * clsEdge(a.cls, tg.b.cls) * this.mulVs(g, tg);
    // 봉시진: 병사·장수마다 첫 충돌 한 번은 피해 2배
    // 봉시진: 4초 넘게 싸우지 않다가 다시 부딪히면 충돌 피해 2배가 되살아난다 (치고 빠지는 돌격)
    if (g.form.shape === "arrow") { const f = isGen ? g : who; if (f.first || this.t - (f.lastHitT || 0) > 4) { v *= 2; f.first = false; } f.lastHitT = this.t; if (tg.form.shape === "ring") v *= 1.2; } // 화살촉은 고리 진형을 꿰뚫는다
    // 학익진: 옆에서 치면(세로 차이가 가로 차이보다 크면) 측면 공격 +25%
    if (g.form.shape === "wings" && tg.form.shape !== "snake" && Math.abs(tgt.y - who.y) * 1.6 > Math.abs(tgt.x - who.x) * 0.8) v *= 1.25; // 장사진은 측면이 없다
    if (this.terrAt(who.x, who.y) === "river") v *= 0.9; // 강을 건너며 싸우면 힘이 빠진다
    v *= 0.85 + Math.random() * 0.3;
    const fx = FUI.stage;
    if (fx) {
      if (isGen && g.actor) { fx.play(g.actor, "atk"); if (S.melee) fx.lunge(g.actor, (tgt.x - g.x) * 0.4, 0.35); if (Math.random() < 0.5 && !Sound.charSfx(a.code, "s1")) Sound.sfx(S.melee ? "swing" : "shot", 0.5); }
      if (!isGen && who.spr) { fx.spriteAnim(who.spr, "atk", true); who.spr.face = tgt.x > who.x ? 1 : -1; }
      // 사격: 짧은 탄이 날아가 박힌다 (병사 탄은 일부만 그려 화면을 덮지 않게) · 근접: 발밑 흙먼지와 작은 불꽃
      const col = g.side === "atk" ? 0x9fd6ff : 0xffb38a;
      if (!S.melee && Math.random() < (isGen ? 1 : 0.22)) { const big = isGen || S.rng > 4; fx.bolt(who.x, who.y + (isGen ? 0.8 : 0.4), tgt.x, tgt.y + (tgt.gen ? 0.8 : 0.4), big ? 0xffe0a0 : col, Math.min(0.3, 0.06 + this.d(who, tgt) * 0.025), big ? 0.8 : 0.45, big ? 0.08 : 0.045); }
      if (!S.melee && S.rng > 4 && !isGen && Math.random() < 0.3) this.later(0.12, () => FUI.stage && (FUI.stage.dust(tgt.x, tgt.y, 0.7), FUI.stage.burst(tgt.x, tgt.y + 0.3, 0xffb060, 0.5, 0.2)));
      if (S.melee && Math.random() < (isGen ? 0.8 : 0.25)) { fx.burst((who.x + tgt.x) / 2, (who.y + tgt.y) / 2 + 0.5, isGen ? 0xffe28a : 0xffffff, isGen ? 0.7 : 0.35, 0.16); fx.dust(tgt.x, tgt.y, isGen ? 0.8 : 0.45); }
      if (!isGen && Math.random() < 0.06) Sound.sfx(S.melee ? "swing" : S.rng > 4 ? "boom" : "shot", 0.35);
    }
    if (tgt.gen) {
      const k = v * (isGen ? 0.9 : 0.4) * this.genK(tg) * this.wallMul(tg, tg.side);
      tg.hp = Math.max(0, tg.hp - k); this.genHit(tg, k);
      if (tg.actor && fx && Math.random() < 0.3) { fx.play(tg.actor, "hit"); fx.knock(tg.actor, Math.sign(tg.x - who.x) || 1, 0.2); }
      if (isGen) { FUI.pop(this, tg.x, tg.y + 1.6, Math.round(k), "gen"); Sound.sfx("hit", 0.5); }
      if (tg.mpMax) tg.mp = Math.min(tg.mpMax, tg.mp + (isGen ? 1.5 : 0.3)); // 맞은 장수가 기력을 얻는다 (역전의 여지)
    } else {
      // 장수는 병사 무리를 쓸어낸다: 병사에게 GEN_VS_SOLDIER배 피해 + 주변 병사 2명에게 40% 피해(베기·관통)
      // 총대장 친위대는 총공세 전까지 받는 피해 -25%
      // 중장 갑옷: 경장 사격에 받는 피해 -20% (기동 포격에는 통하지 않는다 — 병종 상성 기동 ▶ 중장 유지)
      const k = (isGen ? FLD.GEN_VS_SOLDIER : 1) * (tg.guard > 0 ? 0.6 : 1) * tg.form.def * (this.isLead(tg) && !this.surge ? 0.75 : 1) * (tg.b.cls === 1 && a.cls === 0 ? 0.8 : 1);
      // 철충 반격 장갑: 근접으로 친 쪽이 20% 확률로 피해의 30%를 되돌려 받는다
      if (tg.b.trait === "counter" && S.melee && Math.random() < 0.2) { const back = v * 0.3; if (isGen) { g.hp = Math.max(0, g.hp - back * this.genK(g)); this.genHit(g, back); } else { who.hp -= back; if (who.hp <= 0) this.killSoldier(who, tg); } }
      const hit = (s, m) => { s.hp -= v * k * m * this.wallMul(s, tg.side); if (s.spr && fx) { s.spr.kb = { t: 0, dir: Math.sign(s.x - who.x) || 1 }; s.spr.hitT = 0.09; } if (s.hp <= 0) this.killSoldier(s, g); };
      hit(tgt.s, 1);
      // 기동 포격: 병사의 포탄은 맞은 병사 옆 한 명에게도 40% 피해
      if (!isGen && a.cls === 2) { const o = tg.soldiers.find((x) => x !== tgt.s && x.alive && Math.hypot(x.x - tgt.x, (x.y - tgt.y) * 1.3) < 0.6); if (o) hit(o, 0.4); }
      if (isGen) { let n = 0; for (const o of tg.soldiers) { if (n >= 5) break; if (o !== tgt.s && o.alive && Math.hypot(o.x - tgt.x, (o.y - tgt.y) * 1.3) < 1.0) { hit(o, 0.5); n++; } } } // 장수는 한 번에 주변 다섯까지 벤다 (군영전의 장수다움)
    }
  },
  killSoldier(s, by) {
    if (!s.alive) return;
    s.alive = false; s.hp = 0;
    const vg = s.g; vg.mor = Math.max(0, vg.mor - (65 / vg.n0) * (vg.form.steady || 1)); vg.lossT = this.t;
    if (s.spr) { s.spr.dying = 2.5; s.spr.corpse = true; s.spr.tint = 0.6; } // 쓰러진 병사는 2.5초 동안 회색으로 옅게 남는다 (살아 있는 병사와 헷갈리지 않게)
    if (by) { by.kills++; by.mor = Math.min(100, by.mor + 0.3); }
    if (Math.random() < 0.25) Sound.sfx("hit", 0.35);
  },
  // 탈주: 병사가 본진 쪽으로 달아나다 사라진다 (되살릴 수 없다)
  desert(s, g) {
    if (!s.alive) return;
    s.alive = false; s.gone = true; s.flee = 1.3; g.lossT = this.t;
    if (s.spr) { s.spr.tint = 0.75; s.spr.idle = false; s.spr.noFall = true; if (FUI.stage) FUI.stage.spriteAnim(s.spr, "move"); }
  },
  fleeStep(s, dt) {
    s.flee -= dt;
    this.moveToward(s, this.homeX(s.g), s.y, 2.6 * dt);
    if (s.flee <= 0) { s.flee = 0; if (s.spr) s.spr.dying = 0.5; }
  },
  // 철수: 후퇴해 본진에 닿은 부대는 병력을 보존한 채 전장을 떠난다 (포로가 되지 않는다)
  withdraw(g) {
    if (!g.b.generic && g.broken && !g.soldiers.some((s) => s.alive)) return this.rout(g); // 호위 없이 홀로 빠져나가는 무너진 부대의 장수는 패주로 본다 (격파·포로 대상)
    if (g.b.out) return;
    g.b.out = true; g.b.withdrawn = true;
    const left = g.soldiers.filter((s) => s.alive);
    g.b.troops = Math.round(left.length * g.per);
    for (const s of left) { s.alive = false; s.wd = true; if (s.spr) { s.spr.dying = 0.6; s.spr.noFall = true; } }
    for (const o of this.groups) if (!o.b.out && o.side === g.side) o.mor = Math.max(0, o.mor - 5);
    if (g.actor && FUI.stage) FUI.stage.fadeOut(g.actor, 700);
    this.say(`${g.b.gname ? g.b.gname + " " : ""}${g.b.name} ${g.b.troops > 0 ? `부대 철수 — 병력 ${fmtN(g.b.troops)} 보존` : "단신으로 전장을 빠져나갔다"}`, g.side === this.mySide ? "" : "hot");
    if (this.sel === g) this.sel = this.groups.find((o) => !o.b.out && this.ctrl(o.b)) || g;
  },
  rout(g) {
    if (g.b.out) return;
    g.b.out = true; g.b.morale = 0;
    const left = g.soldiers.filter((s) => s.alive);
    for (const s of left) this.desert(s, g);
    // 장수가 쓰러져도 흩어진 병사 절반은 생환한 것으로 본다
    g.b.troops = Math.round(left.length * g.per * 0.5);
    // 패주의 연쇄: 아군 전체 -4, 근처(5 안) 부대는 추가 -6 (적은 +4)
    for (const o of this.groups) if (!o.b.out) o.mor = o.side === g.side ? Math.max(0, o.mor - 3 - (Math.hypot(o.x - g.x, o.y - g.y) < 5 ? 4 : 0)) : Math.min(100, o.mor + 3);
    if (g.actor && FUI.stage) { FUI.stage.play(g.actor, "die"); FUI.stage.fadeOut(g.actor, 1100); Sound.charSfx(g.b.code, "die"); }
    this.say(`${g.b.gname ? g.b.gname + " " : ""}${g.b.name} 부대 괴멸!${g.b.lord ? " (군주)" : ""}`, "war"); FUI.bubble(this, g, "괴멸!", g.side === this.mySide ? "bad" : "good");
    // 배너는 아군 장수·적 총대장의 패주에만 (전장 한가운데를 자주 가리지 않게)
    // 총대장이 쓰러지는 순간: 잠깐 느려지며 카메라가 그쪽을 비춘다
    if (!this.sim && !g.b.generic && this.isLead(g)) { this.slow = 1.1; if (FUI.stage) { const wasFollow = FUI.follow; FUI.setFollow(false); FUI.camX = g.x; FUI.stage.burst(g.x, g.y + 0.9, 0xffe28a, 2.4, 0.6); FUI.shake(true); if (wasFollow) setTimeout(() => FUI.stage && FUI.setFollow(true), 1600); } } // 슬로모션이 끝나면 다시 추적 카메라로
    if (!this.sim && !g.b.generic && this.isLead(g)) UI.banner(`${g.b.name} 패주`, g.side === this.mySide ? "아군 장수가 쓰러졌다" : "적장을 쓰러뜨렸다", 900, g.side === this.mySide ? "lose" : "win");
    if (this.sel === g) this.sel = this.groups.find((o) => !o.b.out && this.ctrl(o.b)) || g;
  },

  // ── 무장기 ──
  // 대상 찾기: 시전 가능하면 { x, y, pts, f, n } 을 돌려준다. manual이면 적 1명만 있어도 시전한다
  aim(g, sk, manual) {
    const foes = this.enemies(g.side);
    const near = this.nearest(g, foes, 99);
    const dir = near ? Math.sign(near.x - g.x) || g.dir : g.dir;
    const need = (ai) => (manual ? 1 : ai);
    const within = (r) => foes.filter((f) => this.d(g, f) < r);
    // 직접 겨누기: 키로 시전할 때 마우스가 전장 위에 있으면 그 지점·방향을 쓴다 (겨눈 곳에 적이 없으면 자동 조준으로)
    const pt = manual && this.aimPt;
    if (pt) {
      const around = (r) => foes.filter((f) => Math.hypot(f.x - pt.x, (f.y - pt.y) * 1.3) < r);
      const py = Math.max(FLD.Y0, Math.min(FLD.Y1, pt.y)), pdir = Math.sign(pt.x - g.x) || g.dir;
      if (sk.kind === "line" || sk.kind === "dash") {
        const len = sk.kind === "dash" ? 6 : 10, n = foes.filter((f) => (f.x - g.x) * pdir > -0.3 && (f.x - g.x) * pdir < len && Math.abs(f.y - py) < 0.5).length;
        if (n) return { y: py, dir: pdir, n };
      } else if ((sk.kind === "blast" || sk.kind === "barrage") && Math.hypot(pt.x - g.x, pt.y - g.y) < 11) {
        const c = around(sk.kind === "blast" ? 1.6 : 3);
        if (c.length) return { pts: sk.kind === "blast" ? [{ x: pt.x, y: py, n: c.length }] : this.clusters(c, 1.1, 3), n: c.length };
      } else if (sk.kind === "strike" && Math.hypot(pt.x - g.x, pt.y - g.y) < 10) {
        const gen = around(2).filter((f) => f.gen)[0], s = !gen && around(1.2)[0];
        if (gen) return { x: gen.x, y: gen.y, f: gen, n: 1 };
        if (s) return { x: s.x, y: s.y, n: 1 };
      }
    }
    switch (sk.kind) {
      case "line": case "dash": {
        // 양쪽 방향·다섯 줄을 모두 재서 가장 많이 맞는 길을 고른다 (가장 가까운 적 한 명 쪽으로 쏘다 뒤쪽 낙오병만 맞추지 않게). 같으면 전진 방향
        const len = sk.kind === "dash" ? 6 : 10;
        let best = g.y, bc = 0, bdir = g.dir;
        for (const dd of [g.dir, -g.dir]) for (const dy of [0, -0.4, 0.4, -0.8, 0.8]) {
          const y = Math.max(FLD.Y0, Math.min(FLD.Y1, g.y + dy));
          const c = foes.filter((f) => (f.x - g.x) * dd > -0.3 && (f.x - g.x) * dd < len && Math.abs(f.y - y) < 0.5).length;
          if (c > bc) { bc = c; best = y; bdir = dd; }
        }
        return bc >= need(sk.kind === "dash" ? 4 : 5) ? { y: best, dir: bdir, n: bc } : null;
      }
      case "barrage": case "blast": case "storm": {
        const pts = this.clusters(sk.kind === "storm" ? foes : within(sk.kind === "barrage" ? 11 : 9), sk.kind === "blast" ? 1.6 : sk.kind === "barrage" ? 1.1 : 1.3, sk.kind === "barrage" ? 3 : sk.kind === "storm" ? 7 : 1);
        const n = pts.reduce((a, p) => a + p.n, 0);
        return n >= need(sk.kind === "storm" ? 14 : 6) ? { pts, n } : null;
      }
      case "strike": {
        const gen = within(9).filter((f) => f.gen).sort((p, q) => this.d(g, p) - this.d(g, q))[0];
        if (gen) return { x: gen.x, y: gen.y, f: gen, n: 1 };
        if (!manual) return null;
        const c = this.clusters(within(9), 1.0, 1)[0];
        return c ? { x: c.x, y: c.y, n: c.n } : null;
      }
      case "heal": {
        const al = this.alive(g.side).filter((a) => Math.hypot(a.x - g.x, a.y - g.y) < 7);
        const v = al.reduce((s, a) => s + (a.hpMax ? 1 - a.hp / a.hpMax : 0) + a.soldiers.filter((x) => !x.alive && !x.gone).length * 0.05, 0);
        return v > (manual ? 0 : 0.6) ? { n: al.length } : null;
      }
      case "rally": {
        // AI는 범위 안 아군의 평균 사기가 40 아래일 때만 쓴다
        const al = this.alive(g.side).filter((a) => Math.hypot(a.x - g.x, a.y - g.y) < 6);
        const avg = al.length ? al.reduce((s, a) => s + a.mor, 0) / al.length : 100;
        return al.length && (manual || avg < 40) ? { n: al.length } : null;
      }
      case "plot": {
        // 적이 가장 많이 든 숲·강 띠를 고른다 (14 안). 없으면 수동일 때만 가까운 적 무리에 불화살
        let best = null, bc = 0;
        for (const t of this.terrain || []) {
          const c = foes.filter((f) => this.inZone(t, f.x, f.y) && Math.abs(f.x - g.x) < 14).length;
          if (c > bc) { bc = c; best = t; }
        }
        if (best && bc >= need(4)) return { band: best, n: bc };
        if (!manual) return null;
        const c = this.clusters(within(9), 1.1, 1)[0];
        return c ? { pts: [c], n: c.n } : null;
      }
      case "guard": return within(5).length >= need(8) ? { n: 1 } : null;
      default: return within(3).length >= need(3) ? { n: 1 } : null; // rage
    }
  },
  // 적이 가장 많이 모인 곳 k군데 (서로 겹치지 않게)
  clusters(list, r, k) {
    const out = [], used = new Set();
    for (let i = 0; i < k; i++) {
      let best = null, bc = 0;
      for (const f of list) {
        if (out.some((p) => Math.hypot(p.x - f.x, p.y - f.y) < r * 1.4)) continue;
        let c = f.gen ? 2 : 0; for (const o of list) if (!used.has(o) && Math.hypot(o.x - f.x, (o.y - f.y) * 1.3) < r) c++;
        if (c > bc) { bc = c; best = f; }
      }
      if (!best) break;
      for (const o of list) if (Math.hypot(o.x - best.x, (o.y - best.y) * 1.3) < r) used.add(o);
      out.push({ x: best.x, y: best.y, n: bc });
    }
    return out;
  },
  canCast(g, i) { const sk = g.skills[i]; return !!sk && !g.b.out && g.hp > 0 && g.stun <= 0 && !g.dash && g.mp >= sk.cost && this.t >= ((g.skCd && g.skCd[i]) || 0); },
  // 다시 쓰기까지 걸리는 시간: 사기·회복 계열은 12초 (기력만 있으면 연달아 써서 사기가 늘 100이 되지 않게)
  skCool(sk) { return sk.kind === "rally" || sk.kind === "heal" || sk.kind === "guard" ? 12 : 0; },
  cast(g, i, manual) {
    const sk = g.skills[i];
    if (!this.canCast(g, i) || this.finished || this.busy) return false;
    if (manual && !this.ctrl(g.b)) return false; // 직접 지휘하지 않는 장수의 무장기는 쓸 수 없다
    this.aimPt = manual && !this.sim && typeof FUI !== "undefined" && FUI.mouseIn ? FUI.mouseW : null;
    const tg = this.aim(g, sk, manual); this.aimPt = null;
    if (!tg) { if (manual) FUI.toast(`「${sk.n}」 — 사거리 안에 대상이 없다`); return false; }
    g.mp -= sk.cost; (g.skCd ||= {})[i] = this.t + this.skCool(sk);
    const mine = g.side === this.mySide;
    this.casts = this.casts || { atk: 0, def: 0 }; this.casts[g.side]++;
    if (!this.sim) {
      if (sk.id === "storm" && manual) { // 직접 쓴 대무장기만 컷인과 함께 잠깐(0.5초) 멈춘다 (그 밖의 무장기는 전투를 멈추지 않고 이름만 크게 띄운다)
        this.freeze = 0.5; Sound.voice(g.b.code, "SpSkill", ["BattleFocus"]); Sound.sfx("skillcharge", 0.7);
        UI.cutin(g.b, sk.n, sk.id === "storm" ? "대무장기" : FSK_KIND[sk.kind]);
      } else if (mine || FUI.onScreen(g.x)) { FUI.skName(this, g, sk.n, sk.big); Sound.sfx("skillcharge", sk.big ? 0.65 : 0.45); }
    }
    const k0 = g.skK;
    const warn = !mine && tg.pts && ["blast", "barrage", "storm"].includes(sk.kind);
    if (warn && !this.sim) FUI.warn(this, tg.pts, sk.kind === "blast" ? 1.6 : sk.kind === "barrage" ? 1.1 : 1.3);
    this.later(warn ? 0.6 : 0.05, () => this.fire(g, sk, tg));
    if (["line", "dash", "barrage", "blast", "storm", "strike", "plot"].includes(sk.kind)) this.later(sk.kind === "plot" ? 4.4 : 1.6, () => { if (g.skK - k0 > 0 && mine) this.say(`${g.b.name}의 무장기 「${sk.n}」 — 적 병사 ${g.skK - k0}명 격파`, mine ? "hot" : "war"); }); // 0명이면 기록하지 않는다
    return true;
  },
  // 하위 호환: 쓸 수 있는 가장 큰 무장기
  skill(g) { for (let i = g.skills.length - 1; i >= 0; i--) if (this.canCast(g, i) && this.cast(g, i, true)) return true; return false; },
  aiSkill(g, smallOnly) {
    const order = g.skills.map((s, i) => i).filter((i) => this.canCast(g, i) && !(smallOnly && g.skills[i].id === "storm")).sort((a, b) => g.skills[b].cost - g.skills[a].cost);
    if (!order.length) return;
    const saving = g.skills.some((s) => s.big && s.cost > g.mp && g.mp + 25 >= s.cost);
    for (const i of order) {
      if (!g.skills[i].big && saving && Math.random() < 0.6) continue;
      if (this.cast(g, i, false)) return;
    }
  },
  fire(g, sk, tg) {
    if (g.b.out || this.finished) return;
    const fx = FUI.stage, p = 1 + Math.max(g.b.st.war, g.b.st.int || 0) / 150, col = g.side === "atk" ? 0x9fd6ff : 0xffb38a;
    if (g.actor && fx) fx.play(g.actor, "skill");
    if (!this.sim && !Sound.charSfx(g.b.code, "s2")) Sound.sfx("beam", 0.7);
    const E = sk.E || { debuffs: [] };
    // 처치 상한: 한 번의 무장기로 쓰러뜨리는 병사 수 (넘으면 병사에게는 더 피해가 없다. 장수 피해는 그대로)
    // (병사 한 명이 120명 — 230명이던 때의 6/10/18명과 같은 병력)
    // 처치 상한은 적 남은 병사의 일정 비율(대무장기 12% · 원작·계략 8% · 병종 6%, 최소 4명)과 고정 상한 중 작은 쪽
    const foeLeft = this.groups.reduce((a, o) => a + (o.side !== g.side && !o.b.out ? o.soldiers.filter((s) => s.alive).length : 0), 0);
    const capBase = Math.min(sk.id === "storm" ? 34 : sk.big || sk.id === "plot" ? 19 : 11, Math.max(4, Math.round(foeLeft * (sk.id === "storm" ? 0.18 : sk.big || sk.id === "plot" ? 0.12 : 0.06))));
    // 탄막·돌진은 길목에 든 적 수만큼은 쓰러뜨릴 수 있다 (한 줄을 쓸어내는 기술이 1명만 쓰러뜨리는 일이 없게)
    const ctx = { k: 0, cap: (sk.kind === "line" || sk.kind === "dash") && tg.n ? Math.max(capBase, Math.min(tg.n, 14)) : capBase, big: !!sk.big }; // big: 대무장기·원작 스킬은 병사 피해 ×1.8 (맞은 한가운데 병사는 한 번에 쓰러진다)
    switch (sk.kind) {
      case "line": this.waves.push({ g, x: g.x, y: tg.y, dir: tg.dir, v: 16, left: 10, w: 0.45, dS: 380 * p, dG: 45 * p, hit: new Set(), col, fxT: 0, ctx }); break;
      case "dash": g.dash = true; g.guard = Math.max(g.guard, 0.6); this.waves.push({ g, x: g.x, y: tg.y, dir: tg.dir, v: 13, left: 6, w: 0.5, dS: 420 * p, dG: 80 * p, hit: new Set(), col: 0xffe28a, fxT: 0, dash: true, ctx }); break;
      case "barrage": tg.pts.forEach((c, i) => this.later(0.15 + i * 0.28, () => this.blast(g, c.x, c.y, 1.1, 380 * p, 45 * p, 0xffb060, false, ctx))); break;
      case "storm":
        if (fx && (g.side === this.mySide || FUI.onScreen(g.x))) FUI.flash(g.side === this.mySide ? "#ffb060" : "#ff8a5a");
        tg.pts.forEach((c, i) => this.later(0.1 + i * 0.25, () => this.blast(g, c.x + (Math.random() - 0.5) * 0.4, c.y + (Math.random() - 0.5) * 0.3, 1.3, 420 * p, 60 * p, 0xff8a3a, true, ctx)));
        break;
      case "blast": { const c = tg.pts[0]; this.blast(g, c.x, c.y, 1.6, 420 * p, 80 * p, 0xff9a4a, true, ctx); this.later(0.35, () => this.blast(g, c.x, c.y, 1.2, 180 * p, 35 * p, 0xffd27a, false, ctx)); break; }
      case "strike": {
        if (fx) { fx.beam(g.x, g.y + 0.9, tg.x, tg.y + 0.6, 0xffe28a, 0.3); fx.burst(tg.x, tg.y + 0.7, 0xffe28a, 1.5, 0.4); }
        if (tg.f && tg.f.g.hp > 0) { const st = E.debuffs.includes("stun") ? 2.5 : 1.2; this.hurt(g, tg.f, 0, 200 * p, { stun: st }); if (!this.sim) FUI.pop(this, tg.x, tg.y + 2.1, "기절", "txt"); }
        this.area(g, tg.x, tg.y, 0.9, 420 * p, 0, { ctx });
        Sound.sfx("hitbig", 0.8); if (FUI.onScreen(tg.x)) FUI.shake(false);
        break;
      }
      case "heal": {
        let rev = 0;
        for (const ag of this.alive(g.side)) {
          if (Math.hypot(ag.x - g.x, ag.y - g.y) > 7) continue;
          let n = 0; if (!ag.broken) for (const s of ag.soldiers) if (!s.alive && !s.gone && !s.wd && !s.revived && n < 7) { this.revive(s, ag); n++; rev++; } // 붕괴한 부대는 되살리지 않는다
          if (ag.hpMax) ag.hp = Math.min(ag.hpMax, ag.hp + ag.hpMax * 0.22);
          ag.mor = Math.min(100, ag.mor + 10);
          if (fx) fx.burst(ag.x, ag.y + 0.8, 0x6fe0a0, 1.2, 0.5);
        }
        Sound.sfx("shield", 0.8); if (g.side === this.mySide) this.say(`${g.b.name}의 무장기 「${sk.n}」 — 아군 회복 · 병사 ${rev}명 재기`, "hot");
        break;
      }
      case "rally": {
        let rev = 0;
        for (const ag of this.alive(g.side)) {
          if (Math.hypot(ag.x - g.x, ag.y - g.y) > 6) continue;
          ag.mor = Math.min(100, ag.mor + 25);
          let n = 0; if (!ag.broken) for (const s of ag.soldiers) if (!s.alive && !s.gone && !s.wd && !s.revived && n < 6) { this.revive(s, ag); n++; rev++; }
          if (fx) fx.burst(ag.x, ag.y + 0.8, 0xffd36a, 1.3, 0.5);
        }
        Sound.sfx("buff", 0.8); if (g.side === this.mySide) this.say(`${g.b.name}의 「${sk.n}」 — 주변 아군 사기 +25 · 병사 ${rev}명 재기`, "hot");
        break;
      }
      case "plot": {
        const t = tg.band;
        const inBand = () => this.enemies(g.side).filter((f) => this.inZone(t, f.x, f.y));
        if (t && t.kind === "forest") {
          // 화계: 숲 전체가 4초간 불탄다 (1초마다 피해)
          this.say(`${g.b.name}의 계략 「화계」 — 숲이 불길에 휩싸인다!`, g.side === this.mySide ? "hot" : "war");
          for (let k = 0; k < 4; k++) this.later(0.1 + k, () => {
            if (fx) for (let i = 0; i < 4; i++) fx.burst(t.x0 + Math.random() * (t.x1 - t.x0), t.y0 + Math.random() * (t.y1 - t.y0) + 0.4, 0xff7a2a, 1.3, 0.5);
            for (const f of inBand()) this.hurt(g, f, 700 * p, 70 * p, { ctx });
            Sound.sfx("boom", 0.5);
          });
          if (fx && FUI.onScreen((t.x0 + t.x1) / 2)) FUI.flash("#ff8a3a");
        } else if (t) {
          // 수공: 강물이 한 번에 휩쓴다 (큰 피해 + 장수 기절)
          this.say(`${g.b.name}의 계략 「수공」 — 강물이 적을 휩쓴다!`, g.side === this.mySide ? "hot" : "war");
          if (fx) for (let i = 0; i < 8; i++) fx.burst((t.x0 + t.x1) / 2, FLD.Y0 + (i / 7) * (FLD.Y1 - FLD.Y0) + 0.3, 0x5ab4ff, 1.6, 0.5);
          for (const f of inBand()) this.hurt(g, f, 1500 * p, 160 * p, { ctx, stun: 1.8 });
          Sound.sfx("bigboom", 0.6); if (FUI.onScreen((t.x0 + t.x1) / 2)) { FUI.shake(true); FUI.flash("#5ab4ff"); }
        } else { const c = tg.pts[0]; this.blast(g, c.x, c.y, 1.1, 300 * p, 50 * p, 0xff7a2a, false, ctx); }
        break;
      }
      case "guard":
        for (const ag of this.alive(g.side)) { if (Math.hypot(ag.x - g.x, ag.y - g.y) > 8) continue; ag.guard = 7; ag.mor = Math.min(100, ag.mor + 8); if (fx) fx.burst(ag.x, ag.y + 0.8, 0x6fc8ff, 1.2, 0.6); }
        Sound.sfx("shield", 0.8); if (g.side === this.mySide) this.say(`${g.b.name}의 무장기 「${sk.n}」 — 7초간 아군 받는 피해 -40%`, "hot");
        break;
      default: // rage
        g.buff = 9; g.hp = Math.min(g.hpMax, g.hp + g.hpMax * 0.15); g.mor = Math.min(100, g.mor + 15);
        if (fx) fx.burst(g.x, g.y + 0.9, 0xffe28a, 1.4, 0.6);
        Sound.sfx("charge", 0.8); if (g.side === this.mySide) this.say(`${g.b.name}의 무장기 「${sk.n}」 — 9초간 공격력 +40%`, "hot");
    }
  },
  revive(s, ag) {
    s.alive = true; s.revived = true; s.hp = FLD.SOLDIER_HP * (ag.ps || 1) * 0.5; s.cool = 0.5; // 재기한 병사는 체력 절반으로 돌아온다
    const fx = FUI.stage;
    if (fx && this.frames[this.soldierCode(ag.b)]) { if (s.spr) fx.removeSprite(s.spr); s.spr = fx.addSprite(this.frames[this.soldierCode(ag.b)], s.x, s.y, 0.95 * this.depth(s.y), ag.dir); s.spr.team = FLD_TEAM[ag.side]; s.spr.teamDisc = ag.sq; }
  },
  blast(g, x, y, R, dS, dG, col, big, ctx) {
    const fx = FUI.stage;
    if (fx) { fx.burst(x, y + 0.4, col, R * 1.3, 0.42); fx.dust(x, y, R * 1.6, 0.7); if (big) this.later(0.08, () => FUI.stage && FUI.stage.burst(x, y + 0.5, col, R * 1.7, 0.5)); }
    // 흔들림·히트스톱은 화면 안에서, 아군이 쓰거나 아군이 맞을 때만 (먼 곳의 AI끼리 폭발로 화면이 흔들리지 않게)
    const felt = !this.sim && FUI.onScreen(x) && (g.side === this.mySide || big);
    Sound.sfx(big ? "bigboom" : "boom", felt ? 0.6 : 0.3); if (felt) FUI.shake(!!big);
    if (big && felt) this.hitStop = Math.max(this.hitStop || 0, 0.06); // 큰 폭발: 아주 짧게 멈칫(히트스톱)
    const k0 = ctx ? ctx.k : 0;
    this.area(g, x, y, R, dS, dG, { ctx });
    // 쓰러뜨린 수를 맞은 자리에 바로 띄운다 (기록은 1.6초 뒤라 늦다)
    if (ctx && ctx.k > k0 && !this.sim) FUI.pop(this, x, y + 1.3, `${ctx.k - k0}명 격파`, "kill");
  },
  area(g, x, y, R, dS, dG, o) {
    for (const f of this.enemies(g.side)) {
      const d = Math.hypot(f.x - x, (f.y - y) * 1.3); if (d >= R) continue;
      const k = 1 - 0.35 * (d / R);
      this.hurt(g, f, dS * k, dG * k, o);
    }
  },
  hurt(g, f, dS, dG, o = {}) {
    const tg = f.g, mul = this.mulVs(g, tg) * Math.sqrt(clsEdge(g.b.cls, tg.b.cls)) * (0.85 + Math.random() * 0.3);
    if (f.s) {
      if (!f.s.alive || !dS) return;
      f.s.hp -= dS * FLD.SK_SOLDIER * (o.ctx && o.ctx.big ? 1.8 : 1) * mul * (tg.guard > 0 ? 0.6 : 1) * tg.form.def * this.wallMul(f.s, tg.side) * (o.ctx && o.ctx.k >= o.ctx.cap ? 0 : 1);
      if (f.s.spr && FUI.stage && !(o.ctx && o.ctx.k >= o.ctx.cap)) { f.s.spr.kb = { t: 0, dir: Math.sign(f.s.x - g.x) || 1 }; f.s.spr.hitT = 0.12; } // (처치 상한을 넘긴 타격은 피해가 없으니 피격 연출도 없다)
      if (f.s.hp <= 0) { this.killSoldier(f.s, g); g.skK++; if (o.ctx) o.ctx.k++; if (f.s.spr) f.s.spr.launch = { t: 0, dir: Math.sign(f.s.x - g.x) || 1 }; } // 무장기에 쓰러진 병사는 튕겨 날아간다
    } else {
      if (tg.hp <= 0 || tg.b.out || !dG) return;
      const v = dG * mul * this.genK(tg) * this.wallMul(tg, tg.side);
      tg.hp = Math.max(0, tg.hp - v); this.genHit(tg, v);
      FUI.pop(this, tg.x, tg.y + 1.7, Math.round(v), "crit");
      if (tg.actor && FUI.stage) FUI.stage.play(tg.actor, "hit");
      if (o.stun) { if (tg.b.trait === "immune") FUI.pop(this, tg.x, tg.y + 2.1, "면역", "txt"); else tg.stun = Math.max(tg.stun, o.stun); } // 철충 기절 면역
    }
  },
  // 탄막 · 돌진: 앞으로 나아가며 지나는 길의 적에게 한 번씩 피해
  stepWaves(dt) {
    const fx = FUI.stage;
    for (const wv of this.waves) {
      const g = wv.g, mv = wv.v * dt, x0 = wv.x;
      wv.x += wv.dir * mv; wv.left -= mv;
      if (wv.x <= FLD.X0 || wv.x >= FLD.X1 || g.b.out) wv.left = 0;
      if (wv.dash && !g.b.out) { g.x = Math.max(FLD.X0, Math.min(FLD.X1, wv.x)); g.y += (wv.y - g.y) * 0.3; if (FUI.stage && g.actor) FUI.stage.setFace(g.actor, wv.dir); }
      const lo = Math.min(x0, wv.x) - 0.45, hi = Math.max(x0, wv.x) + 0.45;
      for (const f of this.enemies(g.side)) {
        const key = f.s || f.g; if (wv.hit.has(key)) continue;
        if (f.x >= lo && f.x <= hi && Math.abs(f.y - wv.y) < wv.w) { wv.hit.add(key); this.hurt(g, f, wv.dS, wv.dG, { ctx: wv.ctx }); }
      }
      // 탄막: 탄 여러 발이 앞으로 날아간다 / 돌진: 발밑 흙먼지와 앞쪽 빛
      if (fx && (wv.fxT -= dt) <= 0) {
        wv.fxT = wv.dash ? 0.08 : 0.06;
        if (wv.dash) { fx.dust(wv.x - wv.dir * 0.4, wv.y, 0.8, 0.5); if (Math.random() < 0.5) fx.burst(wv.x + wv.dir * 0.3, wv.y + 0.7, wv.col, 0.6, 0.18); }
        else for (let i = 0; i < 2; i++) { const yy = wv.y + 0.5 + (Math.random() - 0.5) * 0.7; fx.bolt(wv.x - wv.dir * 0.6, yy, wv.x + wv.dir * 1.6, yy + (Math.random() - 0.5) * 0.15, wv.col, 0.12, 0.7, 0.07); }
      }
      // 돌진은 적 병사 넷에 부딪히면 거기서 멈춘다 (병사 벽을 뚫고 적진 깊이 들어가지 않게)
      if (wv.dash && wv.left > 0) { let n = 0; for (const k of wv.hit) if (k && k.g && k.home) n++; if (n >= 4) wv.left = 0; }
      if (wv.left <= 0 && wv.dash) { g.dash = false; g.rally = { x: g.x, y: g.y }; }
      if (wv.left <= 0 && wv.ctx && wv.ctx.k > 0 && !this.sim) FUI.pop(this, wv.x - wv.dir * 1.5, wv.y + 1.3, `${wv.ctx.k}명 격파`, "kill");
    }
    this.waves = this.waves.filter((w) => w.left > 0);
  },

  // ── 일기토: 장수끼리 맞닥뜨리면 한쪽이 신청한다. 「장수 돌격」 중인 장수는 더 넓은 거리에서 더 자주 신청한다 ──
  duelCheck(dt) {
    if (this.duelCd > 0) { this.duelCd -= dt; return; }
    const gens = this.groups.filter((g) => !g.b.out && !g.b.generic && g.hp > 0 && !g.dash);
    for (const a of gens) for (const b of gens) {
      if (a.side === b.side) continue;
      // 일기토는 개전 12초 뒤부터, 총대장이 끼면 20초 뒤부터 (첫 접전에서 한 번에 끝나지 않게)
      if ((this.isLead(a) || this.isLead(b)) && this.t < 20) continue;
      const seek = a.cmd === "gen"; // a가 신청하는 쪽
      if (this.d(a, b) > (seek ? (a.focus === b ? 3 : 1.6) : 1.4)) continue; // (그냥 맞붙은 장수끼리도 1.4 안이면) // 장수 돌격으로 그 적장을 목표로 삼았으면 3 안에서 신청한다
      const pk = this.duelPair && (this.duelPair[a.b.id + ">" + b.b.id] ?? this.duelPair[b.b.id + ">" + a.b.id]); if (pk != null && this.t - pk < 40) continue;
      // AI 신청자도 무력을 따진다: 총대장은 무력이 앞설 때만, 다른 장수는 크게 뒤지면 신청하지 않는다
      // (내 장수도 「일기토 자동 판정」이 켜져 있으면 같은 규칙 — 무모한 신청을 하지 않는다)
      // (내 장수의 신청 기회도 같은 규칙 — 이길 수 없는 일기토를 권하지 않는다)
      if (this.isLead(a) ? a.b.st.war < b.b.st.war : a.b.st.war < b.b.st.war - 12) continue;
      if (Math.random() > dt * (seek ? 0.5 : 0.12)) continue;
      this.duelCd = 20; this.doDuel(a, b); return;
    }
  },
  // ch가 tg에게 신청. 받아들일지: 직접 지휘하는 장수면 플레이어가 고르고, AI는 무력 차이로 정한다 (거절하면 사기 -15)
  // 일기토 진행 중 예외가 나도 전투가 멈춘 채로 남지 않게 busy를 반드시 푼다
  async doDuel(ch, tg) {
    try { await this.duelBody(ch, tg); }
    catch (e) { console.error(e); this.say("일기토가 중단됐다", "war"); if (typeof document !== "undefined") document.querySelectorAll("#duel.on").forEach((d) => d.classList.remove("on")); }
    finally { this.busy = false; this.last = performance.now(); delete ch.b.duelHpK; delete tg.b.duelHpK; }
  },
  async duelBody(ch, tg) {
    const manualAsk = !this.sim && this.ctrl(tg.b) && !this.ctrl(ch.b) && !Battle.autoDuel;
    let manualPick = false; // 플레이어가 「직접」을 골랐을 때만 일기토 미니게임 (기본은 전장 위 자동 결투)
    // 묻는 동안에도 전투는 멈추지 않는다 (전장 위 작은 알림 — Y/N 또는 버튼, 시간이 지나면 기본 선택)
    const still = () => !this.finished && !ch.b.out && !tg.b.out && ch.hp > 0 && tg.hp > 0;
    // 내 장수가 신청하는 쪽이면 신청할지 먼저 묻는다 (그냥 두면 신청하지 않는다 · 불이익 없음)
    if (!this.sim && this.ctrl(ch.b) && !Battle.autoDuel) {
      const go = await FUI.duelAsk(this, ch, tg, "offer");
      if ((go !== true && go !== "manual") || !still()) return;
      manualPick = go === "manual";
    }
    // AI는 무력 차이로 정한다. 총대장은 신중해서 무력이 앞설 때만 받는다
    //   safe: 플레이어가 답하지 않은 신청 — 운에 맡기지 않고, 무력이 12 넘게 뒤지면 거절한다
    const aiAccept = (safe) => this.isLead(tg) ? tg.b.st.war >= ch.b.st.war : tg.b.st.war >= ch.b.st.war - 12 || (!safe && Math.random() < 0.35);
    let accepted, autoSim = false;
    // 가망 없는 신청(승산 15% 미만, 또는 아군 총붕괴 중)은 묻지 않고 피한다 — 사기 손실은 무력 차에 따른다
    const myOdds = 100 / (1 + Math.exp(-((tg.b.st.war * (0.6 + 0.4 * tg.hp / tg.hpMax)) - (ch.b.st.war * (0.6 + 0.4 * ch.hp / ch.hpMax))) / 8));
    const hopeless = manualAsk && (myOdds < 15 || (this.collapsed && this.collapsed[tg.side]));
    if (manualAsk && !hopeless) {
      // 적의 신청: 그냥 두면 「자동 판정」 — AI 규칙으로 받을지 정하고, 받으면 결과만 계산한다
      const r = await FUI.duelAsk(this, ch, tg, "incoming");
      if (!still()) return;
      if (r === "auto") { autoSim = true; accepted = aiAccept(true); } else if (r === "manual") { accepted = true; manualPick = true; } else accepted = r;
    }
    // 직접 일기토를 하는 내 장수는 받는다(수락은 위에서). 「일기토 자동 판정」이면 내 장수도 AI와 같은 규칙으로 받을지 정한다
    else accepted = !hopeless && ((this.ctrl(tg.b) && !Battle.autoDuel) || aiAccept());
    (this.duelPair ||= {})[ch.b.id + ">" + tg.b.id] = this.t; // 같은 두 장수는 40초 동안 다시 맞붙지 않는다
    if (!accepted) {
      // 훨씬 센 적(무력 15 넘게 위)의 신청은 거절해도 부끄럽지 않다 — 사기 손실 없음
      if (ch.b.st.war - tg.b.st.war > 15 || hopeless) { if (ch.side === this.mySide || tg.side === this.mySide) this.say(`${jo(tg.b.name, "이가")} 훨씬 강한 ${ch.b.name}의 일기토를 피했다`, tg.side === this.mySide ? "" : "hot"); return; } // (아군과 무관하면 기록하지 않는다)
      tg.mor = Math.max(0, tg.mor - 15); ch.mor = Math.min(100, ch.mor + 10);
      this.say(`${jo(tg.b.name, "이가")} ${ch.b.name}의 일기토를 거절했다 — 사기 하락`, tg.side === this.mySide ? "war" : "hot");
      return;
    }
    // 직접 일기토: 화면 왼쪽(첫 인자)은 언제나 플레이어 쪽 장수 (수비전에서 적을 조종하는 일이 없도록)
    const mine = !this.sim && (this.ctrl(ch.b) || this.ctrl(tg.b)) && !Battle.autoDuel && !autoSim && manualPick;
    // 직접 싸우는 일기토만 전투를 멈추고 컷인을 띄운다. 결과만 계산하는 일기토는 전투를 멈추지 않는다 (장수 머리 위 표시 + 기록)
    if (mine) this.busy = true;
    const left = this.ctrl(ch.b) ? ch : this.ctrl(tg.b) ? tg : ch, right = left === ch ? tg : ch;
    let winB;
    // 일기토 체력은 전장 체력 비율을 따른다 (다 죽어 가는 장수가 일기토에서 멀쩡히 싸우지 않게)
    ch.b.duelHpK = ch.hp / ch.hpMax; tg.b.duelHpK = tg.hp / tg.hpMax;
    if (this.sim) winB = Duel.simulate(ch.b, tg.b);
    else if (mine) {
      Sound.voice(ch.b.code, "BattleFocus", ["SpSkill"]);
      await UI.cutin(ch.b, "일기토!");
      winB = await new Promise((res) => Duel.start(left.b, right.b, (w) => res(w)));
      Sound.bgm(F(this.w.defFac) && F(this.w.defFac).iron ? "boss" : "battle");
    } else {
      // 자동 결투: 두 장수가 그 자리에서 1.6초 맞붙는다 (서로 돌진·불꽃·칼소리). 그동안 둘은 다른 행동을 하지 않고, 전투는 계속된다
      FUI.skName(this, ch, "일기토!", true); ch.stun = Math.max(ch.stun, 2.4); tg.stun = Math.max(tg.stun, 2.4);
      for (let i = 0; i < 6; i++) this.later(i * 0.4, () => { const fx = FUI.stage; if (!fx) return; const a = i % 2 ? tg : ch, b = a === ch ? tg : ch; if (a.actor) { fx.play(a.actor, "atk"); fx.lunge(a.actor, (b.x - a.x) * 0.45, 0.3); } fx.burst((ch.x + tg.x) / 2, (ch.y + tg.y) / 2 + 0.9, 0xffe28a, 0.8, 0.25); Sound.sfx("swing", 0.5); });
      await new Promise((res) => this.later(2.4, res));
      if (!still()) return;
      winB = Duel.simulate(ch.b, tg.b);
    }
    delete ch.b.duelHpK; delete tg.b.duelHpK;
    const win = winB === ch.b ? ch : tg, lose = win === ch ? tg : ch;
    // 일기토에서 체력이 바닥나 쓰러졌다면(hpZero) 중상(-35%)에 10% 확률로 그 자리에서 사로잡힌다. 그 밖에는 부상(-22%)
    // 일기토 한 번으로 부대가 통째로 무너지지 않게: 체력은 최소 1, 사기 -18/-12, 병사 동요(10%)
    // 총대장은 친위대가 끌어내 생포되지 않는다 (중상 -30% / 부상 -20%)
    const ko = !!lose.b.hpZero; lose.b.hpZero = false;
    const lead = this.isLead(lose);
    lose.hp = Math.max(1, lose.hp - lose.hpMax * (lead ? (ko ? 0.3 : 0.2) : (ko ? 0.35 : 0.22)));
    if (win.mpMax) win.mp = Math.min(win.mpMax, win.mp + win.mpMax * 0.5);
    win.mor = Math.min(100, win.mor + 12); lose.mor = Math.max(0, lose.mor - (ko ? 18 : 12));
    for (const s of lose.soldiers) if (s.alive && Math.random() < 0.1) this.killSoldier(s, win);
    if (ko && !lead && Math.random() < 0.1) { lose.b.captured = true; lose.hp = 0; this.say(`일기토: ${win.b.name} 승리! ${jo(lose.b.name, "이가")} 쓰러져 사로잡혔다!`, "hot"); }
    else this.say(`일기토: ${win.b.name} 승리! ${lose.b.name} ${ko ? "중상" : "부상"}${lead && ko ? " — 친위대가 겨우 구해냈다" : ""} · 병사 동요`, "hot");
    this.busy = false; this.last = performance.now();
  },

  // ── 명령 ──
  setCmd(g, cmd) {
    g.cmd = cmd; g.rallied = false; // 집결 표시는 새 명령을 내리면 풀린다
    // 병사 돌격: 장수는 2.5 뒤로 물러나 지휘 / 대기·장수 돌격: 병사는 지금 자리를 지킨다
    // (대기·장수 돌격: 병사는 부대 기준점 그 자리를 지킨다)
    g.rally = cmd === "troop" && !g.b.generic ? { x: Math.max(FLD.X0, Math.min(FLD.X1, g.x - g.dir * 2.5)), y: g.y } : { x: g.ux != null ? g.ux : g.x, y: g.uy != null ? g.uy : g.y };
  },
  canOrder(g) { return g.side === this.mySide && !g.b.out && (this.ctrl(g.b) || g.b.generic || this.entry.commander); },
  command(cmd) {
    const C_ = FLD_CMD[cmd]; if (!C_ || this.finished) return;
    const list = (this.scope === "one" && this.sel && !this.sel.b.out ? [this.sel] : this.groups).filter((g) => this.canOrder(g));
    if (!list.length) { FUI.toast("명령을 내릴 수 있는 부대가 없다"); return; }
    // 총대장까지 후퇴시키면 본진에 닿는 순간 철수 = 패배. 한 번 확인한다 (2초 안에 E를 다시 누르면 확정)
    if (cmd === "retreat" && !this.sim && list.some((g) => this.isLead(g)) && !(this.retreatOk > this.t - 2 && this.retreatOkReal > performance.now() - 2500)) {
      this.retreatOk = this.t; this.retreatOkReal = performance.now();
      FUI.toast("총대장이 본진까지 물러나면 철수 — 패배한다. 한 번 더 누르면 후퇴 (총대장 제외는 Tab으로 장수 지정)");
      return;
    }
    // 전군에 「장수 돌격」「병사 돌격」을 내려도 총대장은 빠진다 (총대장만 보내려면 Tab으로 총대장을 지정) — 한 번의 키로 총대장이 적진에 뛰어들지 않게
    const skipLead = this.scope !== "one" && (cmd === "gen" || cmd === "troop");
    for (const g of list) { if (skipLead && this.isLead(g)) continue; this.setCmd(g, cmd); g.ordered = true; g.ordT = this.t; }
    if (skipLead && list.some((g) => this.isLead(g))) FUI.toast("총대장은 제외했다 — 총대장에게만 내리려면 Tab으로 대상을 바꾼다");
    Sound.sfx("click", 0.5); FUI.cmdState(this);
    this.say(this.scope === "one" && this.sel ? `${this.sel.b.name}: ${C_.n}` : `전군: ${C_.n}!`, "hot");
  },
  // 목표 지정: 선택한 장수(직접 지휘)가 그 적장을 노리고 돌격한다
  targetGen(foe) {
    const g = this.sel;
    if (!g || g.b.out || !this.ctrl(g.b) || foe.b.out || foe.side === g.side) return FUI.toast("먼저 직접 지휘하는 장수를 고르자 (1~6)");
    this.setCmd(g, "charge"); g.focus = foe; g.ordered = true; Sound.sfx("click", 0.5); FUI.cmdState(this);
    this.say(`${g.b.name}: 적장 ${jo(foe.b.name, "을를")} 노린다!`, "hot");
  },
  // 집결: 우클릭한 지점으로 이동해 대기 (대상: Tab 범위)
  rallyTo(x, y) {
    const list = (this.scope === "one" && this.sel && !this.sel.b.out ? [this.sel] : this.groups).filter((g) => this.canOrder(g));
    if (!list.length) return;
    list.forEach((g, i) => { this.setCmd(g, "hold"); g.rallied = true; g.ordered = true; g.focus = null; g.rally = { x: Math.max(FLD.X0, Math.min(FLD.X1, x - g.dir * (i % 2) * 0.8)), y: Math.max(FLD.Y0, Math.min(FLD.Y1, y + (i - (list.length - 1) / 2) * 0.6)) }; });
    Sound.sfx("click", 0.5); FUI.cmdState(this); FUI.pop(this, x, y + 0.6, "집결", "txt");
    this.say(this.scope === "one" && this.sel ? `${this.sel.b.name}: 지정한 곳으로 이동` : "전군: 지정한 곳으로 집결", "hot");
  },
  // 직접 지휘하는 장수만 고를 수 있다 (비총대장일 때 아군 AI 장수의 무장기를 대신 쓰지 못하게)
  // 장수를 골라도 명령 대상(전군/한 장수)은 그대로다 — Tab으로만 바꾼다 (무장기를 쓰려고 고른 뒤 Q가 한 장수에게만 가는 함정을 없앤다)
  select(g, scopeOne = false) { if (!g || g.side !== this.mySide || g.b.generic || !this.ctrl(g.b) || g.b.out) return; this.sel = g; if (scopeOne && this.entry.commander) this.scope = "one"; Sound.sfx("click", 0.4); FUI.cmdState(this); },

  // 진형 변경: 전투 중 한 번에 한 진형, 40초 쿨다운. 바꾸는 동안 6초간 주는 피해 -30%, 사기 -15
  // 진형은 첫 접전 뒤에만 바꿀 수 있다 (멀리서 미리 바꿔 상성 선택을 무의미하게 만들지 않게)
  canChangeForm(side) { return !this.finished && !!this.contact && this.t >= (this.formCd && this.formCd[side] || 0); },
  // 적 진형은 정찰에 성공했거나 첫 접전 뒤에만 보인다
  foeFormKnown() { return !!this.scouted || !!this.contact || !!this.spotted; },
  // 보조 AI가 지휘 중인 아군 부대인가 (카드·라벨에 AI 표시)
  // (직접 내린 명령은 바꿀 때까지 지킨다. 장수 카드의 AI 표시로 보이고, 카드 우클릭·G로 다시 AI에 맡긴다)
  assisted(g) { return !this.sim && this.entry.commander && g.side === this.mySide && g !== this.sel && !g.ordered && !g.b.out; }, // (무장기 모드 버튼과는 따로)
  changeForm(side, fk) {
    if (!FORMS[fk] || this.form[side] === fk || !this.canChangeForm(side)) return false;
    this.form[side] = fk; (this.formCd ||= {})[side] = this.t + FLD.FORM_CD;
    for (const g of this.groups) {
      if (g.side !== side || g.b.out) continue;
      g.fk = fk; g.form = FORMS[fk]; g.formT = this.t + 6; g.mor = Math.max(0, g.mor - 15); // 진형을 바꾸는 혼란: 6초간 주는 피해 -30%, 사기 -15
      g.soldiers.forEach((s, k) => { s.home = this.formOffset(g.form.shape, k, g.n0, g.dir); s.first = true; }); g.frontD = null;
      g.first = true;
    }
    const foe = side === "atk" ? "def" : "atk", fo = this.form[foe];
    // (상성은 늘 아군 기준으로 말한다 — 적이 상성 우위 진형으로 바꾸면 「아군 상성 열세」)
    const up = FORM_EDGE[fk] === fo, down = FORM_EDGE[fo] === fk, mineSide = side === this.mySide;
    const edge = up ? (mineSide ? " — 상성 우위!" : " — 아군 상성 열세") : down ? (mineSide ? " — 상성 열세" : " — 아군 상성 우위!") : "";
    this.say(`${side === this.mySide ? "아군" : "적군"} 진형 변경: 「${FORMS[fk].n}」${edge}`, side === this.mySide ? "hot key" : "war key");
    if (!this.sim) Sound.sfx("click", 0.6); // (진형 변경은 기록·상단 진형 표시로 알린다 — 가운데 배너는 개전·총공세·총대장 패주·결과만)
    return true;
  },

  // AI 측 명령: 수비측은 처음엔 진형을 지키다가 맞서 나오고, 다친 장수는 병사를 앞세우거나 물러난다
  aiCommand() {
    for (const g of this.groups) {
      if (g.b.out) continue;
      // 보조 모드(총대장): 플레이어가 아직 명령하지 않은 아군 부대(선택한 장수 제외)는 적 AI와 같은 전술로 알아서 싸운다
      //   (포병은 뒤에서 쏘고, 예비대를 남기고, 다친 장수는 물리고, 상성 표적을 노린다). 한 번 직접 명령한 부대는 그 명령을 따른다
      const assist = this.assisted(g);
      const ai = g.side !== this.mySide || (!this.entry.commander && !g.b.generic && !this.ctrl(g.b)) || assist;
      if (g.broken) { if (g.cmd !== "retreat" && !(g.side === this.mySide && !ai)) this.setCmd(g, "retreat"); continue; } // 붕괴한 부대는 물러난다
      // 보조 모드: 선택하지 않은 내 장수가 중상(20% 미만)이면 알아서 후퇴한다 (총대장 제외)
      if (!ai && !this.sim && !g.b.generic && g !== this.sel && !this.isLead(g) && g.hp > 0 && g.hp < g.hpMax * 0.2 && g.cmd !== "retreat") { this.setCmd(g, "retreat"); this.say(`${g.b.name}: 중상 — 스스로 후퇴한다 (보조 모드)`, "war"); }
      if (!ai) continue;
      // 수비측은 성벽이 있는 거점에서만 개전 4초간 진형을 정비한다 (들판 대치에서는 양쪽이 똑같이 맞선다)
      // 성벽이 있으면 수비측은 공격군이 성벽 6 안으로 다가오거나 총공세가 될 때까지 성벽에서 버틴다
      // (공격군이 성벽 10 안으로 오거나, 수비측 전력이 공격측보다 낮아지면 성벽에서 나와 싸운다)
      const nearWall = this.groups.some((o) => o.side === "atk" && !o.b.out && (o.x > FLD.X1 - FLD.WALL_W - 10 || o.soldiers.some((s) => s.alive && s.x > FLD.X1 - FLD.WALL_W - 10))) || (this.contact && this.strength("def") < this.strength("atk"));
      let cmd = g.side === "def" && this.wallK() > 0 && !this.surge && !nearWall ? "hold" : "charge";
      const foes = this.groups.filter((o) => o.side !== g.side && !o.b.out);
      const engaged = (side) => this.groups.some((o) => o.side === side && !o.b.out && foes.some((f) => f.side !== side && this.d(o, f) < 6));
      // 성벽이 있으면 수비병은 성벽을 지킨다
      if (g.b.generic && g.side === "def" && this.wallK() > 0) cmd = "hold";
      // 예비대: 장수가 셋 이상이면 마지막 장수 하나는 아군이 맞붙거나 25초가 될 때까지 대기
      const gens = this.units[g.side].filter((b) => !b.generic);
      if (!g.b.generic && gens.length >= 3 && gens[gens.length - 1] === g.b && this.t < 25 && !engaged(g.side)) cmd = "hold";
      // 포병(기동, 사거리 5)은 20초 동안 또는 적이 8 안에 들어올 때까지 자리를 지키며 쏜다 — 근접 부대가 앞을 막는다
      if (g.b.cls === 2 && this.t < 20 && cmd === "charge" && !foes.some((f) => this.d(f, g) < 8)) cmd = "hold";
      if (!g.b.generic && g.hp > 0) {
        const r = g.hp / g.hpMax;
        // 병종 상성 표적: 이길 수 있는 병종의 적장을 노린다 (아군 병사가 그 근처에 있을 때)
        if (!this.isLead(g) && !g.focus && cmd === "charge") {
          const prey = foes.filter((o) => !o.b.generic && o.hp > 0 && this.d(o, g) < 8 && clsEdge(g.b.cls, o.b.cls) > 1).sort((p, q) => this.d(p, g) - this.d(q, g))[0];
          // (표적 곁 2 안에 적 병사가 4명 이상이면 드러난 표적이 아니다 — 병사 벽을 뚫고 장수만 노리러 가지 않는다)
          const screened = prey && this.groups.reduce((a, o) => a + (o.side === prey.side && !o.b.out ? o.soldiers.filter((s) => s.alive && Math.hypot(s.x - prey.x, s.y - prey.y) < 2).length : 0), 0) >= 4;
          if (prey && !screened && this.groups.some((o) => o.side === g.side && !o.b.out && o.soldiers.some((s) => s.alive && Math.hypot(s.x - prey.x, s.y - prey.y) < 3))) g.focus = prey;
        }
        // 무력이 앞선 장수는 가까운 적장에게 「장수 돌격」으로 일기토를 노린다
        const rival = foes.filter((o) => !o.b.generic && o.hp > 0 && this.d(o, g) < 6).sort((p, q) => this.d(p, g) - this.d(q, g))[0];
        // (아군 병사가 그 적장 3 안에 있을 때만 — 장수 혼자 적진에 뛰어들어 고립되지 않게)
        const backed = rival && this.groups.some((o) => o.side === g.side && !o.b.out && o.soldiers.some((s) => s.alive && Math.hypot(s.x - rival.x, s.y - rival.y) < 3));
        if (rival && backed && !this.isLead(g) && r > 0.6 && g.b.st.war >= rival.b.st.war + 10 && this.t > 15) { cmd = "gen"; g.focus = rival; }
        if (r < 0.2 && !this.isLead(g)) cmd = "retreat";
        else if (r < 0.5 && g.soldiers.some((s) => s.alive)) cmd = "troop";
      }
      if (g.cmd !== cmd) this.setCmd(g, cmd);
    }
    // 목표: 적 총대장 앞이 비면 노리고, 아군 총대장에게 적장이 붙으면 가까운 장수가 호위한다
    for (const side of ["atk", "def"]) {
      const foe = side === "atk" ? "def" : "atk";
      const mine = this.groups.filter((g) => g.side === side && !g.b.out && !g.b.generic && g.hp > 0);
      const aiSide = mine.some((g) => !this.ctrl(g.b));
      if (!aiSide) continue;
      const E = this.groups.find((g) => g.side === foe && this.isLead(g) && !g.b.out && !g.b.generic);
      const L = mine.find((g) => this.isLead(g));
      const screen = E ? this.groups.filter((o) => o.side === foe && !o.b.out).reduce((a, o) => a + o.soldiers.filter((s) => s.alive && Math.hypot(s.x - E.x, s.y - E.y) < 4).length, 0) : 99;
      const threat = L ? this.groups.filter((o) => o.side === foe && !o.b.out && !o.b.generic && o.hp > 0 && this.d(o, L) < 3.5).sort((p, q) => this.d(p, L) - this.d(q, L))[0] : null;
      // 적 총대장이 드러났다: 40초가 지났고, 총대장 부대 병사가 30% 이하이며, 주변 4 안에 적 병사가 3 미만
      const exposed = E && this.t > 40 && screen < 3 && E.soldiers.filter((s) => s.alive).length <= E.n0 * 0.3;
      const free = mine.filter((o) => !this.isLead(o) && !this.ctrl(o.b) && o.cmd !== "retreat");
      const guard = threat ? free.slice().sort((p, q) => this.d(p, threat) - this.d(q, threat))[0] : null;
      const hunters = exposed ? free.filter((o) => o !== guard).sort((p, q) => this.d(p, E) - this.d(q, E)).slice(0, 2) : [];
      for (const g of mine) {
        if (this.ctrl(g.b)) continue;
        const keep = g.focus && !g.focus.b.out && (g.cmd === "gen" || clsEdge(g.b.cls, g.focus.b.cls) > 1) ? g.focus : null; // 일기토 상대·상성 표적은 유지
        g.focus = g === guard && this.d(g, L) < 10 ? threat : hunters.includes(g) && this.d(g, E) < 14 ? E : keep;
      }
      if (exposed && !this.warnFocus && foe === this.mySide && mine.some((g) => g.focus === E)) { this.warnFocus = true; this.say("적이 아군 총대장을 노린다! 병사로 총대장 앞을 막자", "war key"); if (E) FUI.bubble(this, E, "총대장이 노려진다!", "bad"); }
      // AI 진형 대응: 상성에서 밀리는 것을 알아채면 반응 시간(지력이 높을수록 짧다, 15~25초) 뒤 상성 우위 진형으로 바꾼다
      const countered = FORM_EDGE[this.form[foe]] === this.form[side];
      if (!countered) { if (this.formReact) this.formReact[side] = null; }
      // (플레이어가 총대장인 쪽만 건너뛴다 — 부하 장수로 출진했으면 AI 총대장이 진형을 바꿔 준다)
      else if (this.t > 10 && !(side === this.mySide && this.entry.commander) && !(this.formAI && this.formAI[side]) && this.canChangeForm(side)) {
        this.formReact ||= {};
        if (this.formReact[side] == null) { const iq = Math.max(0, ...mine.map((g) => g.b.st.int || 0)); this.formReact[side] = this.t + Math.max(45, 60 - iq / 7); } // 출진 때 고른 진형이 오래 값을 하도록 45~60초
        else if (this.t >= this.formReact[side]) { this.formReact[side] = null; this.changeForm(side, formWinner(this.form[foe])); } // 쿨다운(40초)만 지나면 다시 대응할 수 있다
      }
    }
  },

  checkEnd() {
    if (this.finished) return;
    // 패주 장면 중이면 3초 뒤 끝낸다 (패주한 쪽은 out이 되므로 전멸 판정보다 먼저 본다)
    if (this.routing) { if (this.t - this.routing.t0 >= 3) return this.finish(this.routing.s === "def", this.routing.why); return; }
    if (!this.sim && this.slow > 0) return; // 총대장이 쓰러지는 슬로모션을 다 보여 준 뒤에 끝낸다
    const lead = (s) => this.units[s].find((b) => !b.generic) || this.units[s][0];
    const aL = lead("atk"), dL = lead("def");
    const aOut = !!aL && !aL.generic && aL.out; // 장수 없는 공격군은 전멸해야 진다
    const aGone = !this.alive("atk").length, dGone = !this.alive("def").length;
    // 같은 순간 양쪽이 다 무너지면 공격은 실패한 것으로 본다 (거점은 수비측에 남는다)
    if (aGone && dGone) return this.finish(false, "양군 모두 무너졌다 — 거점은 수비측에 남는다");
    if (aGone || aOut) return this.finish(false, aOut ? (aL.withdrawn ? "공격 총대장 철수 — 공격을 포기했다" : "공격 총대장 패주!") : "공격군 전멸");
    // 수비 총대장이 쓰러졌는지를 먼저 본다 (총대장을 잡았는데 「철수」로 표시되지 않게)
    if (dL && dL.out && !dL.generic) return this.finish(true, dL.withdrawn ? "수비 총대장 철수 — 거점을 내줬다" : "수비 총대장 패주!");
    if (dGone) return this.finish(true, this.groups.some((g) => g.side === "def" && g.b.withdrawn) ? "수비군 철수 — 거점을 내줬다" : "수비군 전멸!");
    // 총붕괴 뒤 5초가 지나도 다시 서지 못하면(평균 사기 30 미만) 그쪽 총대장이 퇴각을 명한다 — 전멸까지 싸우지 않고 전투가 끝난다
    // 양쪽이 함께 퇴각할 때가 되면 남은 전력이 적은 쪽이 물러난다 (공격측부터 보던 순서 편향을 없앤다)
    const due = ["atk", "def"].filter((s) => { const ct = this.collapseT && this.collapseT[s]; if (ct == null || this.t - ct < FLD.COLLAPSE_T) return false; const al = this.alive(s); return (al.length ? al.reduce((a, g) => a + g.mor, 0) / al.length : 0) < 30; });
    if (due.length === 2) due.sort((p, q) => this.strength(p) - this.strength(q));
    for (const s of due.slice(0, 1)) {
      const al = this.alive(s);
      // 패주 장면(3초): 병사들이 본진 쪽으로 달아나고(철수로 보존), 그중 15%는 추격에 쓰러진다. 장수도 물러난다. 카메라가 그쪽을 비춘다
      const why = s === "atk" ? "공격군 총붕괴 — 퇴각했다" : "수비군 총붕괴 — 거점을 버리고 퇴각했다";
      if (this.sim) { for (const g of al) { for (const x of g.soldiers) if (x.alive) { x.alive = false; x.wd = true; } g.b.out = true; g.b.withdrawn = true; } return this.finish(s === "def", why); }
      const foeG = this.alive(s === "atk" ? "def" : "atk")[0];
      for (const g of al) { for (const x of g.soldiers) if (x.alive) { if (Math.random() < 0.15) this.killSoldier(x, foeG); else { x.alive = false; x.wd = true; x.flee = 3; if (x.spr) { x.spr.noFall = true; x.spr.idle = false; if (FUI.stage) FUI.stage.spriteAnim(x.spr, "move"); } } } this.setCmd(g, "retreat"); g.b.out = true; g.b.withdrawn = true; if (g.actor && FUI.stage) FUI.stage.fadeOut(g.actor, 2500); }
      this.routing = { s, t0: this.t, why };
      const cx = al.reduce((a, g) => a + g.x, 0) / Math.max(1, al.length);
      if (FUI.stage) { FUI.setFollow(false); FUI.camX = cx; }
      this.slow = 0.8; UI.banner(s === this.mySide ? "패주" : "적군 패주!", s === this.mySide ? "아군이 무너져 달아난다" : "달아나는 적을 추격한다", 1600, s === this.mySide ? "lose" : "win");
      return;
    }
    if (this.t >= FLD.TIME) {
      // 시간 초과: 공격측 남은 전력이 수비측의 1.4배 이상이면 수비가 무너진 것으로 본다. 아니면 수비측 승리
      const a = this.strength("atk"), d = this.strength("def");
      return a >= d * 1.4 ? this.finish(true, `제한 시간 — 공격측이 압도했다 (전력 ${Math.round(a * 100)} : ${Math.round(d * 100)})`) : this.finish(false, `제한 시간 — 수비측이 버텨냈다 (전력 ${Math.round(a * 100)} : ${Math.round(d * 100)})`);
    }
  },
  // 첫 접전: 양군의 병사·장수가 5 안으로 맞닿으면 — 적 진형이 드러나고 진형 변경이 풀린다
  contactCheck() {
    if (this.contact) return;
    const pts = (side) => this.groups.filter((g) => g.side === side && !g.b.out).flatMap((g) => [...(g.b.generic ? [] : [g]), ...g.soldiers.filter((s) => s.alive)]);
    const A = pts("atk"), D = pts("def");
    // 양군이 10 안으로 다가오면 정찰에 실패했어도 적 진형이 보인다 (진형 변경은 접전 뒤) — 진형 선택이 동전 던지기가 되지 않게
    if (!this.scouted && !this.spotted && this.form && A.some((a) => D.some((d) => Math.abs(a.x - d.x) < 10))) { this.spotted = true; const foe = this.mySide === "atk" ? "def" : "atk", myF = this.form[this.mySide], foF = this.form[foe]; this.say(`적 진형이 보인다 — 「${FORMS[foF].n}」${FORM_EDGE[myF] === foF ? " · 상성 우위!" : FORM_EDGE[foF] === myF ? " · 상성 열세 — 맞붙으면 V로 바꾸자" : ""}`, FORM_EDGE[foF] === myF ? "war key" : "hot key"); }
    if (!A.some((a) => D.some((d) => Math.abs(a.x - d.x) < 5 && Math.abs(a.y - d.y) < 3))) return;
    this.contact = true;
    if (!this.scouted && !this.spotted && this.form) { const foe = this.mySide === "atk" ? "def" : "atk", myF = this.form[this.mySide], foF = this.form[foe]; this.say(`접전! 적 진형은 「${FORMS[foF].n}」${FORM_EDGE[myF] === foF ? " — 상성 우위!" : FORM_EDGE[foF] === myF ? " — 상성 열세, V로 진형을 바꾸자" : ""}`, FORM_EDGE[foF] === myF ? "war key" : "hot key"); }
  },
  // 총붕괴: 한쪽 평균 사기가 20 아래로 떨어지면 전군이 무너져 달아나기 시작한다 (끝까지 싸워 전멸하는 대신)
  // 총대장이 중상(체력 25% 미만)을 입으면 그쪽 전군 사기 -10 (한 번)
  collapseCheck() {
    if (this.routing) return; // 한쪽이 이미 패주 중이면 승패가 났다
    for (const side of ["atk", "def"]) {
      const al = this.alive(side); if (!al.length) continue;
      const L = al.find((g) => this.isLead(g) && !g.b.generic);
      if (L && !L.woundCast && L.hp < L.hpMax * 0.25) { L.woundCast = true; for (const g of al) g.mor = Math.max(0, g.mor - 10); this.say(`${side === this.mySide ? "아군" : "적군"} 총대장 중상 — 전군 사기 동요`, side === this.mySide ? "war key" : "hot key"); }
      const avg = al.reduce((a, g) => a + g.mor, 0) / al.length;
      const n0 = this.groups.filter((g) => g.side === side).reduce((a, g) => a + g.n0, 0), live = al.reduce((a, g) => a + g.soldiers.filter((s) => s.alive).length, 0);
      if (((avg < 22 && live < n0 * 0.55) || live < n0 * 0.25) && !(this.collapsed && this.collapsed[side])) {
        (this.collapsed ||= {})[side] = true; (this.collapseT ||= {})[side] = this.t;
        // 아군이 무너지면 무엇을 하면 되는지 알려 준다
        if (side === this.mySide && !this.sim) { const L = al.find((g) => this.isLead(g) && !g.b.generic); if (L) FUI.bubble(this, L, "곁으로 집결하면 사기가 오른다!", "bad"); const has = (k) => al.some((g) => g.skills && g.skills.some((sk) => sk.kind === k)); FUI.toast(`총붕괴 — ${FLD.COLLAPSE_T}초 안에 평균 사기 30을 넘기면 버틴다: 총대장 곁 집결(우클릭)${has("rally") ? " · 독전" : ""}${has("heal") ? " · 회복 무장기" : ""}`); } // (가진 수단만 안내)
        for (const g of al) g.mor = Math.min(g.mor, 15);
        this.say(`${side === this.mySide ? "아군" : "적군"} 총붕괴! 병사들이 앞다투어 달아난다`, side === this.mySide ? "war key" : "hot key");
        // 양쪽이 3초 안에 잇달아 무너지면 배너는 처음 한 번만 (기록과 상단 바 초읽기로 알린다)
        const other = this.collapseT[side === "atk" ? "def" : "atk"];
        // (총붕괴는 기록·말풍선·상단 초읽기로 알린다)
      }
    }
  },
  // 남은 전력 비율 (병사 + 장수 체력)
  strength(side) {
    let cur = 0, max = 0;
    for (const g of this.groups) {
      if (g.side !== side) continue;
      max += g.n0 + (g.hpMax ? 8 : 0);
      if (!g.b.out) cur += g.soldiers.filter((s) => s.alive).length + (g.hpMax ? 8 * g.hp / g.hpMax : 0);
    }
    return max ? cur / max : 0;
  },

  async finish(win, why, retreat) {
    if (this.finished) return;
    this.finished = true; this.paused = true;
    if (why) this.say(why, "war");
    if (retreat) win = this.mySide === "def";
    // 결과 집계: 진형 전투와 같은 형식으로 applyBattle에 넘긴다
    // 남은 병력 = 살아 있는 병사 + 철수한 병사 + 회복분(쓰러진 병사 중 부상병, 흩어진 탈주병 일부가 돌아온다)
    // 이긴 쪽은 쓰러진 병사의 50%·탈주병의 60%, 진 쪽은 각각 30%가 돌아온다 (자동 전투의 잔존 비율과 비슷하게)
    const winSide = win ? "atk" : "def";
    for (const g of this.groups) {
      const w = g.side === winSide, c = (f) => g.soldiers.filter(f).length;
      const keep = c((s) => s.alive) + c((s) => s.wd), dead = c((s) => !s.alive && !s.gone && !s.wd), gone = c((s) => s.gone);
      // 탈주병은 죽은 게 아니라 흩어진 것 — 진 쪽도 절반은 다시 모인다 (패주가 시체가 아니라 생존자를 남긴다)
      g.b.troops = Math.round((keep + dead * (w ? 0.5 : 0.3) + gone * (w ? 0.7 : 0.5)) * g.per);
      g.b.kills = g.kills;
    }
    const sum = (arr) => arr.reduce((s, b) => s + b.troops, 0);
    const res = { win, atkLeft: sum(this.units.atk), defLeft: sum(this.units.def) + (this.spareMilitia || 0), captured: [], atkCaptured: [] };
    const fell = (b) => b.out && !b.withdrawn; // 철수한 장수는 포로가 되지 않는다
    if (win) for (const b of this.units.def) { if (b.generic) continue; if (b.captured || (fell(b) && Math.random() < 0.35)) res.captured.push(b.id); }
    else for (const b of this.units.atk) { if (b.captured || (fell(b) && Math.random() < 0.25)) res.atkCaptured.push(b.id); }
    if (retreat && this.mySide === "def") res.defLeft = 0;
    const meWin = (this.mySide === "atk") === win;
    const mvpG = this.groups.filter((g) => g.side === this.mySide && !g.b.generic && !g.b.out).sort((x, y) => y.kills - x.kills)[0];
    const mvp = mvpG ? mvpG.b : null;
    if (FUI.stage) for (const g of this.groups) if (!g.b.out && g.actor && (g.side === this.mySide) === meWin) FUI.stage.play(g.actor, "win", true);
    if (meWin) { Sound.stopBgm(); Sound.sfx("fanfare"); if (mvp) setTimeout(() => Sound.voice(mvp.code, "MVP"), 700); } else Sound.sfx("warn", 0.6);
    UI.banner(meWin ? "승리" : "패배", meWin ? `${this.w.to} 야전에서 승리했다` : `${this.w.to} 야전에서 패배했다`, 1800, meWin ? "win" : "lose");
    await new Promise((r) => setTimeout(r, 2400)); // (승패 배너가 다 사라진 뒤 결과 화면)
    applyBattle(this.w, res);
    // 일기토로 사로잡은 장수는 전투 승패와 관계없이 포로가 된다 (applyBattle이 다루지 않은 경우만)
    for (const b of [...this.units.atk, ...this.units.def]) {
      if (!b.captured || !b.u || res.captured.includes(b.id) || res.atkCaptured.includes(b.id)) continue;
      const captor = b.side === "atk" ? this.w.defFac : this.w.atkFac;
      // 포로는 사로잡은 세력이 가진 도시로 끌려간다: 전장 도시를 차지했으면 그곳, 아니면 출발 도시(공격측)나 본거지
      const held = C(this.w.to).owner === captor ? this.w.to : captor === this.w.atkFac && C(this.w.from).owner === captor ? this.w.from : capitalOf(captor) || this.w.to;
      if (captor && F(captor) && b.u.alive) { handleCapture(b.u, captor, held); this.say(`${jo(b.name, "이가")} 일기토에서 사로잡혀 ${F(captor).name}에 끌려갔다`, "war"); }
    }
    if (meWin) addMerit(P(), 60 + this.units[this.mySide === "atk" ? "def" : "atk"].filter((b) => b.out).length * 30);
    // 내 장수가 직접 거둔 처치는 승패와 관계없이 공적이 된다 (병사 1명당 2, 최대 100)
    const meG = this.groups.find((g) => g.b.id === G.player);
    if (meG && meG.kills) addMerit(P(), Math.min(100, meG.kills * 2));
    FUI.close(this);
    // 결과 화면은 진형 전투의 것을 그대로 쓴다 (처치 수 표시)
    const foeSide = this.mySide === "atk" ? "def" : "atk", cs = this.casts || { atk: 0, def: 0 };
    const fled = (s) => this.groups.filter((g) => g.side === s).reduce((a, g) => a + g.soldiers.filter((x) => x.gone).length, 0);
    const extra = `손실은 전장에서 쓰러진 병사 중 돌아오지 못한 수(부상병·흩어진 병사 일부는 돌아온다) · 무장기 아군 ${cs[this.mySide]}회 · 적 ${cs[foeSide]}회 · 격파한 적장 ${this.units[foeSide].filter((b) => b.out && !b.generic && !b.withdrawn).length}명 · 철수한 적장 ${this.units[foeSide].filter((b) => b.withdrawn && !b.generic).length}명 · 탈주병 아군 ${fled(this.mySide)} · 적 ${fled(foeSide)} · 진형 ${FORMS[this.form[this.mySide]].n} vs ${FORMS[this.form[foeSide]].n}${(() => { const cap = [...this.units.atk, ...this.units.def].filter((b) => b.captured && !b.generic); return cap.length ? ` · 일기토 생포: ${cap.map((b) => `${b.name}(${b.side === this.mySide ? "아군" : "적"})`).join(", ")}` : ""; })()}`;
    const shim = { side: (s) => this.units[s], foe: (s) => this.units[s === "atk" ? "def" : "atk"], mySide: this.mySide, w: this.w, round: Math.ceil(this.t), maxRounds: Math.ceil(this.t), unitLabel: "초", extra };
    await UI.battleResult(shim, meWin, mvp ? { u: mvp.u, name: mvp.name } : null);
    this.onDone();
  },
};

// ── 화면 ────────────────────────────────
// 지형 무늬(캔버스로 한 번 그려 둔다): 숲 = 둥근 나무 덤불, 성벽 = 흉벽이 있는 돌벽
const FLD_TEX = {};
function fieldTex(kind) {
  if (FLD_TEX[kind]) return FLD_TEX[kind];
  const cv = document.createElement("canvas"), g = cv.getContext("2d");
  if (kind === "forest") {
    cv.width = 96; cv.height = 64;
    const tree = (x, y, r, c1, c2) => {
      g.fillStyle = "#0006"; g.beginPath(); g.ellipse(x + 3, y + r * 0.85, r * 0.9, r * 0.28, 0, 0, 7); g.fill(); // 그림자
      g.fillStyle = "#3b2a18"; g.fillRect(x - 2, y + r * 0.3, 4, r * 0.6); // 줄기
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; for (const [dx, dy, k] of [[0, 0, 1], [-r * 0.5, r * 0.15, 0.7], [r * 0.5, r * 0.18, 0.72], [0, -r * 0.45, 0.65]]) { g.beginPath(); g.arc(x + dx, y + dy, r * k, 0, 7); g.fill(); }
    };
    tree(20, 22, 13, "#6fae55", "#24552a"); tree(66, 16, 11, "#7bbb5e", "#2a5f2e"); tree(46, 44, 14, "#5f9f4a", "#1f4a24"); tree(86, 48, 10, "#6aa852", "#24552a"); tree(4, 52, 9, "#5c9a48", "#1f4a24");
  } else {
    cv.width = 28; cv.height = 40;
    g.fillStyle = "#8d7a58"; g.fillRect(6, 0, 22, 40); // 벽 몸체
    g.fillStyle = "#a8936a"; g.fillRect(0, 0, 10, 14); g.fillRect(0, 22, 10, 14); // 흉벽(톱니)
    g.strokeStyle = "#5a4a30"; g.lineWidth = 1.5; g.strokeRect(0.75, 0.75, 9, 13); g.strokeRect(0.75, 22.75, 9, 13);
    g.beginPath(); for (const y of [10, 20, 30]) { g.moveTo(10, y); g.lineTo(28, y); } g.moveTo(18, 0); g.lineTo(18, 10); g.moveTo(14, 10); g.lineTo(14, 20); g.moveTo(22, 20); g.lineTo(22, 30); g.moveTo(16, 30); g.lineTo(16, 40); g.stroke(); // 돌 줄눈
    g.fillStyle = "#0005"; g.fillRect(24, 0, 4, 40);
  }
  return (FLD_TEX[kind] = cv.toDataURL());
}
const FUI = {
  open(F_) {
    let el = document.getElementById("field");
    if (!el) { el = document.createElement("div"); el.id = "field"; document.body.append(el); }
    el.innerHTML = ""; el.classList.add("on"); el.classList.remove("paused");
    const bg = typeof CITY_BG !== "undefined" && CITY_BG[F_.w.to] ? `url(assets/city/${CITY_BG[F_.w.to]}.jpg)` : "none";
    el.style.setProperty("--fbg", bg);
    this.$bg = h("div", { class: "fBg" });
    // 철충·AGS 수비전은 땅을 차가운 잿빛으로 (갈색 기체·병사가 갈색 땅에 묻히지 않게)
    const dfF = F(F_.w.defFac), cool = dfF && (dfF.iron || String(dfF.lord || "").startsWith("AGS_"));
    this.$ground = h("div", { class: "fGround" + (cool ? " cool" : "") }); this.groundY = null;
    this.$stage = h("div", { class: "fStage" }, this.$bg, this.$ground,h("div", { class: "fZones" }), h("div", { class: "fLabels" }), h("div", { class: "fFloat" }), h("div", { class: "fFlash" }), h("div", { class: "fPauseTag" }, "일시정지 — P / Space로 재개"));
    this.$map = h("canvas", { class: "fMap", width: 300, height: 56, title: "미니맵 — 클릭하면 그곳을 본다" });
    const sideBox = (s) => h("div", { class: "fSide " + s }, h("b", null, s === "atk" ? F(F_.w.atkFac).name : F_.w.defFac ? F(F_.w.defFac).name : "수비군"), h("div", { class: "fBar" }, h("i")), h("div", { class: "fMorBar", title: "평균 사기 — 눈금(22) 아래로 떨어지고 병사를 많이 잃으면 총붕괴" }, h("i"), h("b")), h("small"));
    el.append(
      h("div", { class: "fHead" }, sideBox("atk"), h("div", { class: "fMid" }, h("div", { class: "fTitle" }, h("h2", null, F_.title), h("div", { class: "fTime" })), this.$map, h("small", { class: "fFormTag" }), h("div", { class: "fLog", title: "전투 기록 — 눌러서 지난 기록 보기", onclick: () => this.logHistory(F_) })), sideBox("def")),
      this.$stage,
      h("div", { class: "fBottom" },
        h("div", { class: "fCmdBox" },
          h("div", { class: "fCmds" }, Object.entries(FLD_CMD).map(([k, c]) => h("button", { class: "fCmd", "data-c": k, title: `${c.n} (${c.k}) — ${c.d}`, onclick: () => F_.command(k) }, icon(c.ic, 20), h("span", null, c.s), h("kbd", null, c.k)))),
          h("button", { class: "fScope", title: "명령 대상 전환 (Tab)", onclick: () => this.toggleScope(F_) })),
        h("div", { class: "fSel" }),
        h("div", { class: "fGens" }),
        h("div", { class: "fSys" },
          h("button", { class: "fFormBtn", title: `진형 변경 (V) — ${FLD.FORM_CD}초에 한 번, 바꾸면 6초간 주는 피해 -30% · 사기 -15`, onclick: () => this.formPicker(F_) }, "진형"),
          h("button", { class: "fSpeed", title: "배속 (S)", onclick: () => this.cycleSpeed(F_) }, "×1"),
          h("button", { class: "fPause", title: "일시정지 (P · Space) — 멈춘 동안에도 명령·무장기를 내릴 수 있다", onclick: () => this.togglePause(F_) }, "❚❚"),
          h("button", { class: "fAuto on", title: "무장기 모드: 보조(선택한 장수만 직접) → 전체 자동 → 수동", onclick: (e) => {
            if (F_.skillAssist && !F_.autoSkill) { F_.skillAssist = false; F_.autoSkill = true; } else if (F_.autoSkill) { F_.autoSkill = false; F_.skillAssist = false; } else { F_.skillAssist = true; }
            const t = F_.autoSkill ? "AUTO" : F_.skillAssist ? "보조" : "수동"; e.currentTarget.textContent = `무장기 ${t}`; e.currentTarget.classList.toggle("on", t !== "수동");
            this.toast(F_.autoSkill ? "무장기 전체 자동 — 모든 아군 장수가 알아서 쓴다" : F_.skillAssist ? "무장기 보조 — 선택한 장수만 직접(Z·X·C·B), 나머지는 알아서" : "무장기 수동 — 모든 장수를 직접 쓴다"); } }, `무장기 ${F_.autoSkill ? "AUTO" : "보조"}`),
          h("button", { class: "fRally", title: "집결 지점 지정 — 누른 뒤 전장을 탭/클릭 (우클릭과 같다)", onclick: (e) => { this.rallyMode = !this.rallyMode; e.currentTarget.classList.toggle("on", this.rallyMode); if (this.rallyMode) this.toast("집결할 곳을 탭하세요"); } }, "집결"),
          h("button", { class: "fFollow on", title: "카메라 추적 (F) — 끄면 ←/→ · 드래그 · 미니맵으로 움직인다", onclick: () => this.setFollow(!this.follow) }, "🎥"),
          h("button", { title: "조작법 (H)", onclick: () => this.help() }, "?"),
          h("button", { class: "danger", title: "전투에서 물러남", onclick: () => this.retreatAsk(F_) }, "퇴각"))),
      h("div", { class: "fToast" }));
    // 카메라는 전장(지면 띠)에 맞춘다: 위는 장수 머리·라벨, 아래는 맨 앞줄 발밑까지만 보여 병사가 화면을 채운다
    this.stage = Stage.ok ? Object.assign(Stage.create(this.$stage, { height: FLD.Y1 - FLD.Y0 + 2.9, camY: (FLD.Y1 + 2.3 + FLD.Y0 - 0.6) / 2 }), { manual: true }) : null; // manual: 야전 루프가 직접 그린다
    this.F = F_; this.labs = new Map(); this.rings = new Map(); this.flags = new Map(); this.$aim = null; this.hoverSk = null; this.aimKey = null; this.$camps = null; this.$zones = null; this.selKey = ""; this.genKey = ""; this.follow = true; this.keys = new Set(); this.camX = 0;
    // 카메라: 드래그로 이동
    let drag = null;
    const toWorld = (e) => { const r = this.$stage.getBoundingClientRect(), c = this.stage.camera; return { x: c.left + ((e.clientX - r.left) / r.width) * (c.right - c.left), y: c.top - ((e.clientY - r.top) / r.height) * (c.top - c.bottom) }; };
    this.$stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".fLab, .fGens")) return;
      if (this.rallyMode && this.stage && e.button === 0) { this.rallyMode = false; const b = document.querySelector("#field .fRally"); if (b) b.classList.remove("on"); const p = toWorld(e); F_.rallyTo(p.x, p.y); return; }
      drag = { x: e.clientX, cam: this.camX };
    });
    // 마우스가 전장 위 어디를 가리키는지 기억한다 (무장기 직접 겨누기)
    this.mouseIn = false; this.mouseW = null;
    this.$stage.addEventListener("pointermove", (e) => { if (this.stage) { this.mouseIn = true; this.mouseW = toWorld(e); } });
    this.$stage.addEventListener("pointerleave", () => { this.mouseIn = false; });
    window.addEventListener("pointermove", this.onMove = (e) => { if (!drag || !this.stage) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) { this.setFollow(false); this.camX = drag.cam - dx / this.ppu(); } });
    // 끌지 않고 그냥 누르면: 전장의 장수를 직접 클릭한 것으로 본다 — 아군은 선택, 적장은 선택한 장수의 목표로
    window.addEventListener("pointerup", this.onUp = (e) => {
      const d = drag; drag = null;
      if (!d || !this.stage || F_.finished || Math.abs(e.clientX - d.x) > 4 || e.button !== 0) return;
      const p = toWorld(e);
      const hit = F_.groups.filter((g) => !g.b.out && !g.b.generic && g.hp > 0 && Math.abs(p.x - g.x) < 0.7 && p.y > g.y - 0.3 && p.y < g.y + 1.9).sort((a, b) => Math.abs(p.x - a.x) - Math.abs(p.x - b.x))[0];
      if (!hit) {
        // 병사 무리를 눌러도 그 부대 장수가 선택된다
        let best = null, bd = 0.6; for (const g of F_.groups) { if (g.side !== F_.mySide || g.b.out || g.b.generic) continue; for (const s of g.soldiers) if (s.alive) { const dd = Math.hypot(s.x - p.x, (s.y + 0.45 - p.y) * 1.2); if (dd < bd) { bd = dd; best = g; } } }
        if (best) F_.select(best); return;
      }
      if (hit.side === F_.mySide) F_.select(hit); else F_.targetGen(hit);
    });
    // 우클릭: 그 지점으로 집결
    this.$stage.addEventListener("contextmenu", (e) => {
      e.preventDefault(); if (!this.stage || F_.finished) return;
      const p = toWorld(e); F_.rallyTo(p.x, p.y);
    });
    this.$map.addEventListener("pointerdown", (e) => { const r = this.$map.getBoundingClientRect(); this.setFollow(false); this.camX = FLD.X0 + ((e.clientX - r.left) / r.width) * (FLD.X1 - FLD.X0); });
    this.onKey = (e) => {
      if (e.key === "Escape" && document.querySelector(".fFormPick")) { const pk = document.querySelector(".fFormPick"); (pk.closest(".modalBg") || pk).remove(); e.stopPropagation(); return; } // 진형 창은 Esc로 닫힌다
      if (!el.classList.contains("on") || document.querySelector(".modalBg, #duel.on")) return;
      const k = e.key.toLowerCase();
      if (this.ask && (k === "y" || k === "n" || k === "d")) { this.ask.done(k === "d" ? "manual" : k === "y"); e.stopPropagation(); return; }
      const cmd = Object.keys(FLD_CMD).find((c) => FLD_CMD[c].k.toLowerCase() === k);
      if (cmd) F_.command(cmd);
      else if (k === "tab") { e.preventDefault(); this.toggleScope(F_); }
      else if (k === "p" || k === " ") { e.preventDefault(); this.togglePause(F_); }
      // Shift+1~6: 진형을 대화창 없이 바로 바꾼다 (어린·학익·봉시·방원·장사·안행 순)
      else if (e.shiftKey && /^Digit[1-6]$/.test(e.code)) { const fk = Object.keys(FORMS)[+e.code.slice(5) - 1]; if (!F_.entry.commander) this.toast("진형은 총대장이 정한다"); else if (!F_.contact) this.toast("진형은 적과 맞붙은 뒤에 바꿀 수 있다"); else if (!F_.canChangeForm(F_.mySide)) this.toast(`진형 변경 대기 ${Math.ceil(F_.formCd[F_.mySide] - F_.t)}초`); else if (F_.changeForm(F_.mySide, fk)) this.cmdState(F_); }
      else if (/^[1-6]$/.test(k)) { const g = this.myGens(F_)[+k - 1]; if (g) { F_.select(g); if (e.repeat || this.lastNum === k && performance.now() - this.lastNumT < 350) this.focus(g); this.lastNum = k; this.lastNumT = performance.now(); } }
      else if (["z", "x", "c", "b"].includes(k)) { if (F_.sel) F_.cast(F_.sel, "zxcb".indexOf(k), true); }
      // 카메라는 ←/→ (A/D는 쓰지 않는다 — 명령키 Q·W·E 옆이라 WASD 습관으로 명령이 잘못 나가지 않게)
      else if (["arrowleft", "arrowright"].includes(k)) { e.preventDefault(); this.keys.add(k); this.setFollow(false); }
      else if (k === "f") this.setFollow(!this.follow);
      else if (k === "g") { const g = F_.sel; if (g && F_.canOrder(g)) { g.ordered = false; F_.say(`${g.b.name}: 보조 AI에 맡긴다 (다른 장수를 고르면 AI가 지휘)`, "hot"); Sound.sfx("click", 0.5); } }
      else if (k === "s") this.cycleSpeed(F_);
      else if (k === "v") this.formPicker(F_);
      else if (k === "h" || k === "?") this.help();
      else return;
      e.stopPropagation();
    };
    this.onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    this.onBlur = () => this.keys.clear(); // 창이 포커스를 잃으면 누르고 있던 카메라 키를 놓는다
    document.addEventListener("keydown", this.onKey, true);
    document.addEventListener("keyup", this.onKeyUp, true);
    window.addEventListener("blur", this.onBlur);
    this.cmdState(F_);
  },
  close() {
    const el = document.getElementById("field");
    if (this.stage) { this.stage.destroy(); this.stage = null; }
    document.removeEventListener("keydown", this.onKey, true); document.removeEventListener("keyup", this.onKeyUp, true);
    window.removeEventListener("pointermove", this.onMove); window.removeEventListener("pointerup", this.onUp); window.removeEventListener("blur", this.onBlur);
    if (this.ask) this.ask.done(false);
    if (el) { el.classList.remove("on"); el.innerHTML = ""; }
    this.labs = null;
  },
  loading(F_, text) { const el = document.getElementById("field"); if (!el) return; let l = el.querySelector(".fLoading"); if (!text) { if (l) l.remove(); return; } if (!l) { l = h("div", { class: "fLoading" }); el.append(l); } l.textContent = text; },
  myGens(F_) { return F_.groups ? F_.groups.filter((g) => g.side === F_.mySide && !g.b.generic) : []; },
  togglePause(F_) { if (F_.finished) return; F_.paused = !F_.paused; F_.last = performance.now(); const el = document.getElementById("field"); if (el) el.classList.toggle("paused", F_.paused); const b = el && el.querySelector(".fPause"); if (b) b.textContent = F_.paused ? "▶" : "❚❚"; },
  toggleScope(F_) { F_.scope = F_.scope === "all" ? "one" : "all"; Sound.sfx("click", 0.4); this.cmdState(F_); },
  // 퇴각: 총대장은 전군 퇴각(패배 처리), 부하 장수는 자기 부대만 본진으로 물러나 철수한다
  retreatAsk(F_) {
    if (F_.finished) return;
    const was = F_.paused; if (!was) this.togglePause(F_);
    const resume = () => { if (!was && F_.paused) this.togglePause(F_); };
    if (!F_.entry.commander) {
      const me = F_.groups.find((g) => F_.ctrl(g.b) && !g.b.out);
      if (!me) return resume();
      return UI.confirm("철수", `${me.b.name} 부대만 본진으로 물러나 전장을 떠난다.\n전투는 총대장이 계속 지휘한다.`, P(), "철수", "계속 싸운다").then((ok) => { if (ok) { F_.setCmd(me, "retreat"); F_.say(`${me.b.name}: 부대를 이끌고 철수한다`, "war"); this.cmdState(F_); } resume(); });
    }
    UI.confirm("퇴각", "전군을 물려 전장에서 퇴각하겠는가? (패배로 처리된다)", P(), "퇴각", "계속 싸운다").then((ok) => { if (ok) F_.finish(false, "전군 퇴각!", true); else resume(); });
  },
  cycleSpeed(F_) { F_.speed = F_.speed === 1 ? 2 : F_.speed === 2 ? 3 : 1; const b = document.querySelector("#field .fSpeed"); if (b) b.textContent = `×${F_.speed}`; Sound.sfx("click", 0.4); },
  // 전투 중 진형 변경 (일시정지한 채 고른다)
  formPicker(F_) {
    if (F_.finished || document.querySelector(".modal.fFormPick")) return;
    if (!F_.entry.commander) return this.toast("진형은 총대장이 정한다 — 상성에서 밀리면 총대장(AI)이 알아서 바꾼다");
    if (!F_.contact) return this.toast("진형은 적과 맞붙은 뒤에 바꿀 수 있다");
    if (!F_.canChangeForm(F_.mySide)) return this.toast(`진형 변경 대기 ${Math.ceil(F_.formCd[F_.mySide] - F_.t)}초`);
    const was = F_.paused; if (!was) this.togglePause(F_);
    const foe = F_.form[F_.mySide === "atk" ? "def" : "atk"], cur = F_.form[F_.mySide];
    const close = () => m.remove(); // 재개는 resumeWhenGone이 맡는다 (Esc로 닫아도)
    const m = UI.modal([h("h3", null, "진형 변경"), h("p", { class: "muted" }, `현재 아군 「${FORMS[cur].n}」 · 적군 「${FORMS[foe].n}」 — 바꾸면 6초간 주는 피해 -30%·사기 -15, 다음 변경까지 ${FLD.FORM_CD}초`),
      h("div", { class: "formGrid" }, Object.entries(FORMS).map(([k, f]) => h("button", { class: "formCard" + (FORM_EDGE[k] === foe ? " rec win" : FORM_EDGE[foe] === k ? " lose" : ""), disabled: k === cur, onclick: () => { F_.changeForm(F_.mySide, k); this.cmdState(F_); close(); } },
        h("div", { class: "formPic " + f.shape }, ...Array.from({ length: 9 }, () => h("i"))), h("b", null, f.n), h("small", null, f.d),
        FORM_EDGE[k] === foe ? h("em", null, "상성 우위") : FORM_EDGE[foe] === k ? h("em", { class: "bad" }, "상성 열세") : k === cur ? h("em", null, "현재") : null))),
      h("div", { class: "btns" }, h("button", { onclick: close }, "취소"))], "msg prep fFormPick");
    this.resumeWhenGone(m, F_, was);
  },
  setFollow(on) { this.follow = on; const b = document.querySelector("#field .fFollow"); if (b) b.classList.toggle("on", on); },
  focus(g) { this.setFollow(true); this.F.sel = g; },

  // ── 카메라 ──
  ppu() { const c = this.stage.camera; return this.stage.w / (c.right - c.left); },
  half() { const c = this.stage.camera; return (c.right - c.left) / 2; },
  clampCam(x) { const hw = this.half(); return Math.max(FLD.X0 + hw - 0.6, Math.min(FLD.X1 - hw + 0.6, x)); },
  // 추적 카메라: 아군 전열(가장 앞선 병사들)과 선택한 장수 사이를 본다 — 싸움이 벌어지는 곳이 화면 밖으로 나가지 않게
  camTarget(F_) {
    const g = F_.sel && !F_.sel.b.out ? F_.sel : null, dir = F_.mySide === "atk" ? 1 : -1;
    const xs = []; for (const o of F_.alive(F_.mySide)) { if (!o.b.generic) xs.push(o.x); for (const s of o.soldiers) if (s.alive) xs.push(s.x); }
    if (!xs.length) return g ? g.x : 0;
    xs.sort((a, b) => (b - a) * dir);
    const k = Math.min(xs.length, 6), front = xs.slice(0, k).reduce((a, x) => a + x, 0) / k;
    // 앞에 적 전열이 가까우면(8 안) 두 전열의 가운데를 본다
    let foeFront = null; for (const o of F_.alive(F_.mySide === "atk" ? "def" : "atk")) for (const s of o.soldiers) if (s.alive && (s.x - front) * dir > -2 && (s.x - front) * dir < 8) foeFront = foeFront == null ? s.x : dir > 0 ? Math.min(foeFront, s.x) : Math.max(foeFront, s.x);
    let fight = foeFront == null ? front : (front + foeFront) / 2;
    if (F_.hotX != null && F_.t - F_.hotT < 2) fight = fight * 0.4 + F_.hotX * 0.6; // 실제로 싸움이 벌어지는 곳
    const base = g ? g.x * 0.2 + fight * 0.8 : fight;
    // 앞쪽(적 쪽)을 조금 더 보여 다가오는 적이 보이게 한다. 단, 선택한 장수가 화면 밖으로 밀려나지 않게
    let t = base + dir * 1.5;
    // 선택한 장수가 싸움 가까이(6 안)에 있을 때만 화면 가운데 절반 안에 둔다 — 멀리 물러나 있으면 싸움을 본다
    if (g && this.stage && Math.abs(g.x - fight) < 6) { const hw = this.half() * 0.5; t = Math.max(g.x - hw, Math.min(g.x + hw, t)); }
    return t;
  },
  snapCam(F_) { if (!this.stage) return; this.camX = this.clampCam(this.camTarget(F_)); this.stage.setCam(this.camX); },
  updCam(F_, real) {
    if (!this.stage) return;
    if (this.keys.size) { const d = (this.keys.has("arrowleft") ? -1 : 0) + (this.keys.has("arrowright") ? 1 : 0); this.camX += d * 16 * real; }
    if (this.follow) this.camX += (this.camTarget(F_) - this.camX) * Math.min(1, real * 2.5);
    // 자동 줌: 카메라 근처(10 안)의 양군 부대가 퍼진 폭에 맞춰 화면 높이를 1~1.5배로 (아래쪽 맨 앞줄은 고정)
    if (this.follow && F_.groups) {
      const H0 = FLD.Y1 - FLD.Y0 + 2.9, a = this.stage.w / Math.max(1, this.stage.h); let lo = this.camX, hi = this.camX;
      for (const o of F_.groups) { if (o.b.out) continue; const x = o.b.generic || o.ux == null ? o.x : o.ux; if (Math.abs(x - this.camX) < 10) { lo = Math.min(lo, x); hi = Math.max(hi, x); } }
      const want = Math.max(H0, Math.min(H0 * 1.5, (hi - lo + 6) / a));
      this.zoomH = (this.zoomH || H0) + (want - (this.zoomH || H0)) * Math.min(1, real * 1.2);
      if (Math.abs(this.stage.H - this.zoomH) > 0.01) { this.stage.H = this.zoomH; this.stage.camY = FLD.Y0 - 0.6 + this.zoomH / 2; }
    }
    this.camX = this.clampCam(this.camX);
    this.stage.setCam(this.camX);
    if (this.$bg) this.$bg.style.transform = `translateX(${(-this.camX * this.ppu() * 0.35).toFixed(1)}px)`;
    // 지면: 지평선을 전장 맨 뒷줄 위에 맞추고, 무늬는 카메라와 같은 속도로 흐른다
    if (this.$ground) {
      const gx = (-this.camX * this.ppu()).toFixed(1), gy = Math.round(this.stage.toScreen(0, FLD.Y1 + 0.5).y);
      if (this.groundY !== gy) { this.groundY = gy; this.$ground.style.top = gy + "px"; }
      this.$ground.style.backgroundPosition = `${gx}px 0, ${gx}px 0, ${gx}px 0, ${gx}px 0, 0 0`;
    }
  },

  // ── 매 프레임: 카메라 · 라벨 · 상단 병력 · 미니맵 · 장수 패널 ──
  frame(F_, real = 0.016) {
    if (!F_.groups || !this.labs) return;
    if (!this.stage) return this.hud(F_); // 렌더러가 없어도 상단 정보·장수 패널은 갱신한다
    this.updCam(F_, real);
    // 애니메이션도 게임 시간에 맞춘다: 일시정지·일기토 중엔 멈추고, 배속이면 빨라진다 (컷인 중엔 그대로)
    this.stage.timeScale = F_.hitStop > 0 ? 0.04 : F_.freeze > 0 ? 1 :F_.paused || F_.busy ? 0 : F_.speed * (F_.slow > 0 ? 0.3 : 1);
    const ft = document.querySelector("#field .fFormTag");
    if (ft && F_.form) {
      const my = F_.form[F_.mySide], fo = F_.form[F_.mySide === "atk" ? "def" : "atk"], edge = FORM_EDGE[my] === fo ? 1 : FORM_EDGE[fo] === my ? -1 : 0;
      const cd = F_.formCd && F_.formCd[F_.mySide] > F_.t ? ` · 변경 ${Math.ceil(F_.formCd[F_.mySide] - F_.t)}초` : "";
      const known = F_.foeFormKnown();
      const lock = !F_.contact ? " · 진형 변경은 접전 뒤" : "";
      const txt = known ? `아군 ${FORMS[my].n} ${edge > 0 ? "▲ 상성 우위" : edge < 0 ? "▼ 상성 열세" : "·"} 적군 ${FORMS[fo].n}${cd}${lock}${F_.surge ? " · 총공세" : ""}` : `아군 ${FORMS[my].n} · 적 진형 불명(접전하면 드러난다)${F_.surge ? " · 총공세" : ""}`;
      if (ft.textContent !== txt) { ft.textContent = txt; ft.className = "fFormTag" + (!known ? "" : edge > 0 ? " win" : edge < 0 ? " lose" : ""); }
    }
    const lab = this.$stage.querySelector(".fLabels"); if (!lab) return;
    const W = this.stage.w, placed = [];
    const rank = (g) => (g === F_.sel ? 2 : 0) + (F_.isLead(g) ? 1 : 0); // 선택한 장수 → 총대장 → 나머지 순으로 라벨 자리를 잡는다
    for (const g of F_.groups.slice().sort((a, b) => rank(b) - rank(a))) {
      if (g.b.generic) continue;
      let el = this.labs.get(g);
      if (!el) {
        const mine = g.side === F_.mySide;
        el = h("div", { class: "fLab " + (mine ? "me" : "foe"), title: mine ? "클릭: 선택 · 두 번 클릭: 카메라" : "클릭: 선택한 장수가 이 적장을 노린다", onclick: mine ? () => F_.select(g) : () => F_.targetGen(g), ondblclick: mine ? () => this.focus(g) : null }, h("small"), h("div", { class: "fHp" }, h("i")), h("div", { class: "fMp" }, h("i")), h("em", { class: "fSt" }));
        lab.append(el); this.labs.set(g, el);
        // 이름 글자색 = 부대색(밝게): 라벨과 발판·고리 색으로 어느 부대인지 잇는다
        // 이름 글자는 진영색(아군 파랑·적 빨강), 부대색은 이름 앞 작은 점 — 적·아군을 먼저 가르고 부대는 그다음
        if (g.sq) el.style.setProperty("--sq", `rgb(${g.sq.map((v) => Math.min(255, Math.round(v * 0.5 * 255 + 40))).join(",")})`);
      }
      // 발밑 고리: 부대색(아군은 푸른 계열 · 적은 붉은 계열) · 선택한 장수는 금색으로 맥동 (병사 무리 속에서도 장수가 어디 있는지 보이게)
      let rg = this.rings.get(g);
      if (!rg) { rg = this.stage.ring(squadHex(g.sq)); this.rings.set(g, rg); }
      if (rg) {
        const sel = F_.sel === g, w = (F_.isLead(g) ? 0.85 : 0.7) * (sel ? 1 + Math.sin(performance.now() / 180) * 0.08 : 1);
        if (rg.sel !== sel) { rg.sel = sel; rg.color(sel ? 0xffd36a : squadHex(g.sq)); }
        rg.set(g.x, g.y, w, g.b.out ? 0 : sel ? 0.95 : 0.6);
      }
      if (g.b.out) { el.style.opacity = 0; el.style.pointerEvents = "none"; continue; }
      const p = this.stage.toScreen(g.x, g.y + (g.vh || 1.4) + 0.25);
      el.style.display = p.x < -60 || p.x > W + 60 ? "none" : "";
      const name = (F_.isLead(g) ? "★" : "") + g.b.name;
      // 적장 라벨이 다른 적장 라벨과 겹치면 하나로 묶는다(「타이런트 외 2」) — 장수가 몰려도 라벨 탑이 서지 않게. 총대장(★)은 묶이지 않고 앞에 선다
      const foeHit = g.side !== F_.mySide && !F_.isLead(g) && !(F_.sel && F_.sel.focus === g) && !(g.stun > 1.5) && placed.find((q) => q.foe && Math.abs(q.x - p.x) < 80 && Math.abs(q.y - p.y) < 36); // (라벨 실제 높이 ≈ 34px)
      if (foeHit) { el.style.display = "none"; foeHit.extra++; continue; }
      // 아군 라벨(과 적·아군이 겹친 경우)은 비켜 놓는다: 위로 한 칸씩 올리되, 너무 높이 쌓이면 옆으로 민다 (선택한 장수가 먼저 자리를 잡는다)
      let y = p.y, x = p.x;
      for (let k = 0; k < 10; k++) {
        const hit = placed.find((q) => Math.abs(q.x - x) < 80 && Math.abs(q.y - y) < 32); if (!hit) break;
        if (p.y - y < 40) y = hit.y - 32; else { y = p.y; x = hit.x + (x >= hit.x ? 82 : -82); }
      }
      // 비켜 놓인 라벨은 작게(이름만). 선택한 장수는 늘 온전히
      el.classList.toggle("mini", (x !== p.x || y !== p.y) && F_.sel !== g);
      placed.push({ x, y, foe: g.side !== F_.mySide, extra: 0, el, name }); p.x = x;
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(y)}px)`;
      el.children[0].textContent = g.kills ? `${name} · ${g.kills}` : name; // 처치 수
      el.children[1].firstChild.style.width = `${(g.hp / g.hpMax) * 100}%`;
      el.children[2].firstChild.style.width = `${(g.mp / g.mpMax) * 100}%`;
      el.children[3].textContent = g.stun > 0 ? "기절" : g.guard > 0 ? "역장" : g.buff > 0 ? "강화" : g.b.trait ? TRAIT_KO[g.b.trait] : ""; el.classList.toggle("waver", g.mor < 30); // 동요는 글자 대신 라벨 색으로
      el.classList.toggle("ready", g.skills.some((s) => g.mp >= s.cost));
      el.classList.toggle("sel", F_.sel === g);
      el.classList.toggle("asking", !!this.ask && this.ask.g === g);
    }
    for (const q of placed) if (q.extra) q.el.children[0].textContent = `${q.name} 외 ${q.extra}`;
    // 부대 깃발: 병사 무리 한가운데 위에 부대색 작은 깃발 — 어느 무리가 어느 장수 부대인지 (장수가 멀리 있어도)
    for (const g of F_.groups) {
      if (g.b.generic && !g.sq) continue;
      let fl = this.flags.get(g);
      if (!fl) { const c = g.sq.map((v) => Math.min(255, Math.round(v * 0.5 * 255 + 40))).join(","); fl = h("div", { class: "fFlag", style: `--fc: rgb(${c})` }, h("i")); lab.append(fl); this.flags.set(g, fl); }
      const al = g.b.out ? [] : g.soldiers.filter((s) => s.alive);
      if (al.length < 3) { fl.style.display = "none"; continue; }
      // 장수가 자기 병사 무리 곁(1.5 안)에 있으면 깃발은 숨긴다 (장수 고리·라벨이 이미 알려 준다)
      if (!g.b.generic && !g.b.out && g.hp > 0) { const mx = al.reduce((a, s) => a + s.x, 0) / al.length; if (Math.abs(mx - g.x) < 1.5) { fl.style.display = "none"; continue; } }
      const cx = al.reduce((a, s) => a + s.x, 0) / al.length, cy = Math.max(...al.map((s) => s.y)), q = this.stage.toScreen(cx, cy + 1.05);
      fl.style.display = q.x < -20 || q.x > W + 20 ? "none" : "";
      fl.style.transform = `translate(${Math.round(q.x)}px, ${Math.round(q.y)}px)`;
    }
    // 본진 깃발
    if (!this.$camps) {
      this.$camps = ["atk", "def"].map((s) => { const f = F(s === "atk" ? F_.w.atkFac : F_.w.defFac); const c = h("div", { class: "fCamp " + s, style: `--cc:${f ? f.color : "#8a8170"}` }, h("i"), h("span", null, f ? f.name : "수비군")); lab.append(c); return c; });
    }
    this.$camps.forEach((c, i) => { const p = this.stage.toScreen(i ? FLD.X1 - 1.2 : FLD.X0 + 1.2, FLD.Y1 + 0.2); c.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`; });
    // 지형 띠(숲·강)와 성벽 지대: 월드 좌표에 맞춰 지면 위에 깐다
    if (!this.$zones) {
      // 지형 이름만 짧게 (효과 수치는 조작법(H)·출진 화면에) — 전장 위 글자를 줄인다
      const zs = (F_.terrain || []).map((t) => ({ x0: t.x0, x1: t.x1, y0: t.y0, y1: t.y1, el: h("div", { class: "fZone " + t.kind }, h("span", null, t.kind === "forest" ? "숲" : "강")) }));
      if (F_.wallK() > 0) zs.push({ x0: FLD.X1 - FLD.WALL_W, x1: FLD.X1, el: h("div", { class: "fZone wall" }, h("span", null, "성벽")) });
      const layer = this.$stage.querySelector(".fZones"); for (const z of zs) layer.append(z.el);
      for (const z of zs) { if (z.el.classList.contains("forest")) z.el.style.backgroundImage = `url(${fieldTex("forest")})`; if (z.el.classList.contains("wall")) z.el.style.setProperty("--wtex", `url(${fieldTex("wall")})`); }
      this.$zones = zs;
    }
    for (const z of this.$zones) {
      const a = this.stage.toScreen(z.x0, (z.y1 != null ? z.y1 : FLD.Y1) + 0.35), b = this.stage.toScreen(z.x1, (z.y0 != null ? z.y0 : FLD.Y0) - 0.25);
      Object.assign(z.el.style, { left: `${Math.round(a.x)}px`, top: `${Math.round(a.y)}px`, width: `${Math.max(0, Math.round(b.x - a.x))}px`, height: `${Math.round(b.y - a.y)}px` }); // (cssText로 덮으면 지형 무늬가 지워진다)
    }
    this.drawAim(F_);
    // 떠 있는 글자·예고 원을 세계 좌표에 붙인다: 생길 때의 카메라 위치(data-cx)와 지금의 차이만큼 가로로 옮긴다 (범위 미리보기는 매번 다시 그리므로 제외)
    { const fl = this.$stage.querySelector(".fFloat"), ppu = this.ppu(); if (fl) for (const el of fl.children) { if (el.classList.contains("fAim")) continue; if (el.dataset.cx == null) el.dataset.cx = this.camX; el.style.marginLeft = `${((+el.dataset.cx - this.camX) * ppu).toFixed(1)}px`; } }
    this.hud(F_);
  },
  // 무장기 범위 미리보기: 무장기 버튼에 마우스를 올리면 지금 쓰면 맞을 곳(자동 조준)을 전장에 그린다
  drawAim(F_) {
    let box = this.$aim;
    if (!box) { const fl = this.$stage.querySelector(".fFloat"); if (!fl) return; box = this.$aim = h("div", { class: "fAim" }); fl.append(box); }
    const g = F_.sel, i = this.hoverSk, sk = g && i != null ? g.skills[i] : null;
    if (!sk || g.b.out || F_.finished) { if (box.childElementCount) box.innerHTML = ""; this.aimKey = null; return; }
    const now = performance.now();
    if (this.aimKey === `${g.b.id}:${i}` && now - (this.aimT || 0) < 200) return; // 0.2초마다 다시 계산
    this.aimKey = `${g.b.id}:${i}`; this.aimT = now;
    const tg = F_.aim(g, sk, true), ppu = this.ppu(), S = (x, y) => this.stage.toScreen(x, y);
    box.innerHTML = "";
    const ok = F_.canCast(g, i), cls = "fAimMark" + (ok ? "" : " no");
    const circle = (x, y, R) => { const p = S(x, y); box.append(h("div", { class: cls + " c", style: `left:${p.x - R * ppu}px;top:${p.y - (R / 1.3) * ppu}px;width:${2 * R * ppu}px;height:${(2 * R / 1.3) * ppu}px` })); };
    const tag = (x, y, t) => { const p = S(x, y); box.append(h("div", { class: "fAimTag" + (ok ? "" : " no"), style: `left:${p.x}px;top:${p.y}px` }, t)); };
    if (!tg) { tag(g.x, g.y + 2.6, `「${sk.n}」 — 지금은 닿는 적이 없다`); return; }
    const n = tg.n ? ` · ${tg.n}` : "";
    switch (sk.kind) {
      case "line": case "dash": {
        const len = sk.kind === "dash" ? 6 : 10, x1 = Math.max(FLD.X0, Math.min(FLD.X1, g.x + tg.dir * len)), a = S(Math.min(g.x, x1), tg.y + 0.5), b = S(Math.max(g.x, x1), tg.y - 0.5);
        box.append(h("div", { class: cls + " r", style: `left:${a.x}px;top:${a.y}px;width:${b.x - a.x}px;height:${b.y - a.y}px` }));
        tag((g.x + x1) / 2, tg.y + 0.9, `${sk.n}${n}`); break;
      }
      case "blast": case "barrage": case "storm": for (const c of tg.pts) circle(c.x, c.y, sk.kind === "blast" ? 1.6 : sk.kind === "barrage" ? 1.1 : 1.3); tag(tg.pts[0].x, tg.pts[0].y + 1.6, `${sk.n}${n}`); break;
      case "strike": circle(tg.x, tg.y, 0.9); tag(tg.x, tg.y + 2.2, `${sk.n}${tg.f ? " · 적장 기절" : ""}`); break;
      case "heal": case "rally": case "guard": circle(g.x, g.y, sk.kind === "heal" ? 7 : sk.kind === "rally" ? 6 : 8); tag(g.x, g.y + 2.6, `${sk.n} · 범위 안 아군`); break;
      case "plot": if (tg.band) { const a = S(tg.band.x0, tg.band.y1 != null ? tg.band.y1 : FLD.Y1), b = S(tg.band.x1, tg.band.y0 != null ? tg.band.y0 : FLD.Y0); box.append(h("div", { class: cls + " r", style: `left:${a.x}px;top:${a.y}px;width:${b.x - a.x}px;height:${b.y - a.y}px` })); tag((tg.band.x0 + tg.band.x1) / 2, FLD.Y1 + 0.8, `${tg.band.kind === "forest" ? "화계" : "수공"}${n}`); } else { circle(tg.pts[0].x, tg.pts[0].y, 1.1); tag(tg.pts[0].x, tg.pts[0].y + 1.4, "불화살"); } break;
      default: circle(g.x, g.y, 3); tag(g.x, g.y + 2.6, sk.n);
    }
  },
  hud(F_) {
    const head = document.querySelector("#field .fHead"); if (!head) return;
    // 상단 바 높이를 CSS에 알려 배너·컷인이 바로 그 아래에 뜨게 한다
    if (head.offsetHeight !== this.fheadH) { this.fheadH = head.offsetHeight; document.documentElement.style.setProperty("--fhead", `${this.fheadH}px`); }
    for (const s of ["atk", "def"]) {
      if (F_.finished) break; // 끝난 뒤에는 상단 병력을 고치지 않는다 (회복분은 결과 화면에서만)
      const routing = F_.routing && F_.routing.s === s; // 퇴각 중인 쪽은 살아서 물러나는 병력을 그대로 보여 준다 (0이 아니라)
      const cur = F_.units[s].reduce((a, b) => a + (b.out && !(routing && b.withdrawn) ? 0 : b.troops), 0), max = F_.units[s].reduce((a, b) => a + b.max, 0) || 1;
      const al = F_.alive(s), mor = al.length ? Math.round(al.reduce((a, g) => a + g.mor, 0) / al.length) : 0;
      const box = head.querySelector(".fSide." + s); box.querySelector(".fBar i").style.width = `${(cur / max) * 100}%`; const mb = box.querySelector(".fMorBar"); if (mb) { mb.firstChild.style.width = `${mor}%`; mb.classList.toggle("low", mor < 35); } const ct = F_.collapseT && F_.collapseT[s], cd = ct != null && mor < 30 && !(F_.routing && F_.routing.s !== s) ? Math.max(0, Math.ceil(FLD.COLLAPSE_T - (F_.t - ct))) : null; // 총붕괴 뒤 퇴각까지 남은 초 (사기 30 이상으로 회복하면 멈춘다)
      box.querySelector("small").textContent = routing ? (cur > 0 ? `퇴각 중 — ${fmt(cur)}명이 물러난다` : "퇴각 중 — 장수만 물러난다") : (cur <= 0 && al.some((g) => !g.b.generic && g.hp > 0) ? `병사 전멸 — 장수만 남았다 · 사기 ${mor}` : `${fmt(cur)} / ${fmt(max)} · 사기 ${mor}`) + (cd != null ? ` · 총붕괴! 퇴각까지 ${cd}초` : "");
      box.classList.toggle("collapse", cd != null);
    }
    // 시계: 총공세 전에는 총공세까지, 뒤에는 제한 시간까지 남은 시간 (다음 고비가 언제인지 보이게)
    // (고비 20초 전부터만 남은 시간을 센다. 그 밖에는 전투가 흐른 시간)
    // (시계는 늘 흐른 시간. 다음 고비는 앞의 작은 글자로 — 「총공세 0:23 뒤」·「판정 1:10 뒤」)
    const nx = Math.max(0, Math.ceil((F_.surge ? FLD.TIME : FLD.SURGE) - F_.t)); let ph = `${F_.surge ? "판정" : "총공세"} ${Math.floor(nx / 60)}:${String(nx % 60).padStart(2, "0")} 뒤`; const left = Math.floor(F_.t), near = nx <= 20; const tm = head.querySelector(".fTime");
    tm.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; if (F_.finished) ph = ""; if (tm.dataset.ph !== ph) tm.dataset.ph = ph; tm.classList.toggle("low", F_.surge && near);
    this.drawMap(F_);
    this.drawSel(F_);
    this.drawGens(F_);
  },
  drawMap(F_) {
    const cv = this.$map; if (!cv) return; const g2 = cv.getContext("2d"), W = cv.width, H = cv.height;
    const mx = (x) => ((x - FLD.X0) / (FLD.X1 - FLD.X0)) * W, my = (y) => ((FLD.Y1 - y) / (FLD.Y1 - FLD.Y0)) * (H - 8) + 4;
    g2.clearRect(0, 0, W, H); g2.fillStyle = "#0d1016cc"; g2.fillRect(0, 0, W, H);
    g2.fillStyle = "#3d7bd833"; g2.fillRect(0, 0, mx(FLD.X0 + 2.4), H); g2.fillStyle = "#d84a3d33"; g2.fillRect(mx(FLD.X1 - 2.4), 0, W, H);
    for (const t of F_.terrain || []) { g2.fillStyle = t.kind === "forest" ? "#3f8a4a55" : "#3d7bd855"; const top = my(t.y1 != null ? t.y1 : FLD.Y1), bot = my(t.y0 != null ? t.y0 : FLD.Y0); g2.fillRect(mx(t.x0), top, mx(t.x1) - mx(t.x0), bot - top); }
    if (F_.wallK() > 0) { g2.fillStyle = "#b9a27a66"; g2.fillRect(mx(FLD.X1 - FLD.WALL_W), 0, 2, H); }
    for (const g of F_.groups) {
      if (g.b.out) continue;
      g2.fillStyle = g.side === "atk" ? "#7fb4ff" : "#ff8f7f";
      for (const s of g.soldiers) if (s.alive) g2.fillRect(mx(s.x) - 1, my(s.y) - 1, 2, 2);
      if (!g.b.generic) { g2.fillStyle = F_.sel === g ? "#fff" : g.side === "atk" ? "#bfe0ff" : "#ffd0c8"; g2.beginPath(); g2.arc(mx(g.x), my(g.y), F_.isLead(g) ? 4 : 3, 0, 7); g2.fill(); }
    }
    if (this.stage) { const c = this.stage.camera; g2.strokeStyle = "#e9c46a"; g2.lineWidth = 1.5; g2.strokeRect(mx(c.left) + 0.5, 0.5, mx(c.right) - mx(c.left) - 1, H - 1); }
  },
  // 선택 장수 패널: 체력 · 기력 · 사기 · 무장기 버튼
  drawSel(F_) {
    const box = document.querySelector("#field .fSel"); if (!box) return;
    const g = F_.sel;
    const key = g ? g.b.id : "none";
    if (this.selKey !== key) {
      this.selKey = key; box.innerHTML = ""; this.hoverSk = null;
      if (!g) { box.append(h("small", { class: "muted" }, "직접 지휘하는 장수가 없다")); return; }
      box.append(h("div", { class: "fSelHead" }, sdface(g.b.u, 44), h("div", null, h("b", null, g.b.name, " ", gradeBadge(g.b.u)), h("small", { class: "fSelSub" }),
        h("div", { class: "fBars" }, h("div", { class: "fHp", title: "체력" }, h("i")), h("div", { class: "fMp", title: "기력" }, h("i")), h("div", { class: "fMor", title: "사기" }, h("i"))))),
        h("div", { class: "fSks" }, g.skills.map((sk, i) => h("button", { class: "fSk", title: `${sk.n} (${"ZXCB"[i]}) · 기력 ${sk.cost}\n${FSK_KIND[sk.kind]} — ${sk.d}`, onclick: () => F_.cast(g, i, true), onmouseenter: () => { this.hoverSk = i; }, onmouseleave: () => { this.hoverSk = null; } },
          h("img", { src: `assets/skill/${sk.ic}.webp`, alt: "" }), h("span", null, sk.n.length > 6 ? sk.n.slice(0, 6) + "…" : sk.n), h("em", null, sk.cost), h("kbd", null, "ZXCB"[i])))));
    }
    if (!g) return;
    box.querySelector(".fHp i").style.width = `${(g.hp / g.hpMax) * 100}%`;
    box.querySelector(".fMp i").style.width = `${(g.mp / g.mpMax) * 100}%`;
    box.querySelector(".fMor i").style.width = `${g.mor}%`;
    box.querySelector(".fMor").classList.toggle("low", g.mor < 30);
    box.querySelector(".fSelSub").textContent = g.b.out ? "패주" : `${FLD_CMD[g.cmd].n} · 병사 ${g.soldiers.filter((s) => s.alive).length}/${g.n0} · 기력 ${Math.floor(g.mp)}/${g.mpMax} · 사기 ${Math.round(g.mor)}`;
    box.querySelectorAll(".fSk").forEach((b, i) => { const ok = F_.canCast(g, i); b.disabled = !ok || !F_.ctrl(g.b); b.classList.toggle("ready", ok); });
  },
  drawGens(F_) {
    const box = document.querySelector("#field .fGens"); if (!box) return;
    const gens = this.myGens(F_);
    const key = gens.map((g) => g.b.id).join(",");
    if (this.genKey !== key) {
      this.genKey = key; box.innerHTML = "";
      gens.forEach((g, i) => box.append(h("button", { class: "fGen", title: `${g.b.name} 선택 (${i + 1}) · 두 번 누르면 카메라 이동`, onclick: () => F_.select(g), ondblclick: () => this.focus(g) },
        sdface(g.b.u, 30), h("div", null, h("b", null, `${i + 1}. ${g.b.name}`), h("div", { class: "fHp" }, h("i")), h("div", { class: "fMp" }, h("i")), h("small")))));
    }
    gens.forEach((g, i) => {
      const c = box.children[i]; if (!c) return;
      c.querySelector(".fHp i").style.width = `${(g.hp / g.hpMax) * 100}%`; c.querySelector(".fMp i").style.width = `${(g.mp / g.mpMax) * 100}%`;
      c.querySelector("small").textContent = g.b.out ? "패주" : `${FLD_CMD[g.cmd].s} · 병 ${g.soldiers.filter((s) => s.alive).length}`;
      c.classList.toggle("ready", !g.b.out && g.skills.some((s) => g.mp >= s.cost)); c.classList.toggle("out", g.b.out); c.classList.toggle("sel", F_.sel === g); c.classList.toggle("ai", F_.assisted(g)); c.oncontextmenu = (ev) => { ev.preventDefault(); if (!F_.canOrder(g)) return; g.ordered = !F_.assisted(g) ? false : true; if (g.ordered) g.ordT = F_.t; F_.say(`${g.b.name}: ${g.ordered ? "직접 지휘" : "보조 AI에 맡긴다"}`, "hot"); Sound.sfx("click", 0.4); };
      c.disabled = g.b.out || !F_.ctrl(g.b);
    });
  },
  cmdState(F_) {
    const one = F_.scope === "one" && F_.sel;
    const ref = one ? F_.sel : F_.groups && F_.groups.find((g) => F_.canOrder(g));
    document.querySelectorAll("#field .fCmd").forEach((b) => b.classList.toggle("on", !!ref && b.dataset.c === ref.cmd));
    const sc = document.querySelector("#field .fScope"); if (sc) { sc.textContent = one ? `대상: ${F_.sel.b.name}` : "대상: 전군"; sc.classList.toggle("one", !!one); }
  },
  // 일기토 알림: 전투를 멈추지 않는 작은 창. kind "offer"(내 장수가 신청할 기회) → true/false, "incoming"(적의 신청) → true/false/"auto"
  //   Y = 예, N = 아니오. 시간(게임이 멈춘 동안은 줄지 않는다)이 다 되면 offer는 신청하지 않고, incoming은 자동 판정
  duelAsk(F_, ch, tg, kind) {
    const el = document.getElementById("field"); if (!el) return Promise.resolve(kind === "offer" ? false : "auto");
    if (this.ask) this.ask.done(kind === "offer" ? false : "auto");
    const me = kind === "offer" ? ch : tg, foe = kind === "offer" ? tg : ch, LIFE = 7;
    return new Promise((res) => {
      let left = LIFE, timer = null;
      const done = (v) => { if (!this.ask || this.ask.box !== box) return; clearInterval(timer); box.classList.add("bye"); setTimeout(() => box.remove(), 250); this.ask = null; Sound.sfx("click", 0.4); res(v); };
      const bar = h("i");
      const txt = kind === "offer" ? `${me.b.name} 앞에 적장 ${foe.b.name}! 일기토를 신청할까?` : `${jo(foe.b.name, "이가")} ${me.b.name}에게 일기토를 신청했다!`;
      // 승산(무력 차와 남은 체력으로 어림): 권장 버튼을 강조한다 (질 싸움을 기본값으로 권하지 않는다)
      const odds = Math.round(100 / (1 + Math.exp(-((me.b.st.war * (0.6 + 0.4 * me.hp / me.hpMax)) - (foe.b.st.war * (0.6 + 0.4 * foe.hp / foe.hpMax))) / 8))), good = odds >= 45;
      const sub = (kind === "offer" ? `무력 ${me.b.st.war} vs ${foe.b.st.war} · 이기면 적 부대가 동요한다` : `무력 ${me.b.st.war} vs ${foe.b.st.war} · 거절하면 ${me.b.name} 부대 사기 ${foe.b.st.war - me.b.st.war > 15 ? "그대로(훨씬 강한 적)" : "-15"} · 그냥 두면 자동 판정`) + ` · 승산 약 ${odds}%`;
      const box = h("div", { class: "fAsk " + kind }, sdface(foe.b.u, 40), h("div", null, h("b", null, txt), h("small", null, sub), h("div", { class: "fAskBar" }, bar)),
        h("div", { class: "btns" }, h("button", { class: good ? "primary" : "", title: "전장에서 바로 결과를 낸다 (전투는 멈추지 않는다)", onclick: () => done(true) }, kind === "offer" ? "신청" : "수락", h("kbd", null, "Y")), h("button", { title: "일기토 화면에서 직접 싸운다 (전투가 멈춘다)", onclick: () => done("manual") }, "직접", h("kbd", null, "D")), h("button", { class: good ? "" : "primary", onclick: () => done(false) }, kind === "offer" ? "무시" : "거절", h("kbd", null, "N"))));
      // 알림은 전장 왼쪽 위에 고정해 싸움을 가리지 않고, 해당 장수의 라벨이 금색으로 깜빡인다 (어느 장수 일인지)
      (this.$stage || el).append(box); Sound.sfx("warn", 0.45);
      this.ask = { box, done, g: me };
      timer = setInterval(() => { if (!F_.paused && !F_.busy) left -= 0.1; bar.style.width = `${Math.max(0, left / LIFE) * 100}%`; if (left <= 0 || F_.finished) done(kind === "offer" ? false : "auto"); }, 100);
    });
  },
  // 새 줄만 덧붙인다 (전부 다시 그리면 줄마다 사라지는 시간이 처음부터 다시 시작된다)
  // 전투 기록: 상단 바 가운데 한 줄 자막(가장 최근 줄). 중요한 줄(key: 접전·진형·총대장 위협·총붕괴·총공세)은 2.5초 동안 다른 줄에 밀리지 않는다
  //   전장 위를 덮지 않는다. 누르면 지난 기록 전체를 본다
  log(F_) {
    const l = document.querySelector("#field .fLog"); const x = F_.logLines[0]; if (!l || !x) return;
    const now = performance.now(); if (!/\bkey\b/.test(x.cls) && this.logKeyT && now - this.logKeyT < 2500) return;
    if (/\bkey\b/.test(x.cls)) this.logKeyT = now;
    l.innerHTML = ""; l.append(h("div", { class: x.cls }, x.t));
  },
  logHistory(F_) {
    const was = F_.paused; if (!was) this.togglePause(F_);
    const m = UI.modal([h("h3", null, "전투 기록"), h("div", { class: "fLogAll" }, F_.logLines.slice(0, 40).map((x) => h("div", { class: x.cls }, x.t))), h("div", { class: "btns" }, h("button", { class: "primary", onclick: () => m.remove() }, "전투로"))], "list");
    this.resumeWhenGone(m, F_, was);
  },
  // 떠오르는 글자 자리 잡기: 살아 있는 글자와 겹치면 위로 22px씩 비킨다 (최대 4번). 너무 많으면(16개) 띄우지 않는다
  floatAt(x, y, life) {
    const now = performance.now(); this.floats = (this.floats || []).filter((f) => f.until > now);
    if (this.floats.length >= 8) return null;
    if (this.floats.filter((f) => Math.abs(f.x - x) < 90 && Math.abs(f.y - y) < 70).length >= 3) return null; // 한 자리(가로 90·세로 70px)에 셋까지
    for (let k = 0; k < 4 && this.floats.some((f) => Math.abs(f.x - x) < 70 && Math.abs(f.y - y) < 22); k++) y -= 22;
    this.floats.push({ x, y, until: now + life }); return { x, y };
  },
  pop(F_, x, y, v, kind) { if (!this.stage || F_.sim) return; const fl = this.$stage.querySelector(".fFloat"); const p = this.floatAt(this.stage.toScreen(x, y).x, this.stage.toScreen(x, y).y, 700); if (!p) return; const el = h("div", { class: "fPop " + (kind || ""), style: `left:${p.x}px;top:${p.y}px` }, typeof v === "number" ? `-${v}` : v); fl.append(el); setTimeout(() => el.remove(), 1000); },
  skName(F_, g, name, big) { if (!this.stage) return; const nowS = performance.now(); if (g._skNameT && nowS - g._skNameT < 1000) return; g._skNameT = nowS; /* 장수마다 1초에 하나 */ const fl = this.$stage.querySelector(".fFloat"); const q = this.stage.toScreen(g.x, g.y + 2.4), p = this.floatAt(q.x, q.y, 1100) || q; const el = h("div", { class: "fSkName " + (g.side === F_.mySide ? "me" : "foe") + (big ? " big" : ""), style: `left:${p.x}px;top:${p.y}px` }, `「${name}」`); fl.append(el); setTimeout(() => el.remove(), 1400); },
  toast(t) { const el = document.querySelector("#field .fToast"); if (!el) return; el.textContent = t; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); },
  flash(color) { const f = this.$stage && this.$stage.querySelector(".fFlash"); if (!f) return; f.style.background = color; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); },
  warn(F_, pts, R) {
    if (!this.stage || !this.$stage) return; const fl = this.$stage.querySelector(".fFloat"); if (!fl) return; const ppu = this.ppu();
    for (const c of pts) { const p = this.stage.toScreen(c.x, c.y); const el = h("div", { class: "fWarn", style: `left:${p.x - R * ppu}px;top:${p.y - (R / 1.3) * ppu}px;width:${2 * R * ppu}px;height:${(2 * R / 1.3) * ppu}px` }); fl.append(el); setTimeout(() => el.remove(), 700); }
  },
  // 사건 말풍선: 그 장수 머리 위에 2.5초. 화면 밖이면 가장자리에 ◀/▶ 화살표와 함께 붙는다 (카메라는 전장의 40%만 보이므로)
  bubble(F_, g, text, cls) {
    if (!this.stage || F_.sim || !this.$stage || (F_.routing && F_.routing.s !== g.side)) return; // 패주 장면 중에는 이긴 쪽 말풍선을 띄우지 않는다
    const fl = this.$stage.querySelector(".fFloat"); if (!fl) return;
    const p = this.stage.toScreen(g.x, g.y + (g.vh || 1.4) + 0.9), W = this.stage.w, off = p.x < 30 ? -1 : p.x > W - 30 ? 1 : 0;
    const q = this.floatAt(Math.max(70, Math.min(W - 70, p.x)), Math.max(40, p.y), 1800) || { x: Math.max(70, Math.min(W - 70, p.x)), y: Math.max(40, p.y) }, x = q.x, y = q.y;
    if (fl.querySelectorAll(".fBubble").length >= 2) fl.querySelector(".fBubble").remove(); // 말풍선은 동시에 둘까지
    const el = h("div", { class: "fBubble " + (cls || ""), style: `left:${x}px;top:${y}px` }, off < 0 ? "◀ " : "", `${g.b.name} ${text}`, off > 0 ? " ▶" : "");
    fl.append(el); setTimeout(() => el.remove(), 2500);
  },
  onScreen(x) { if (!this.stage) return false; const c = this.stage.camera; return x > c.left - 0.5 && x < c.right + 0.5; },
  // 흔들림은 전장 그림만 (상단 정보·명령 버튼은 흔들리지 않게)
  shake(big) { const el = this.$stage; if (!el || !el.isConnected) return; el.classList.remove("shake", "shakeBig"); void el.offsetWidth; el.classList.add(big ? "shakeBig" : "shake"); },

  help() {
    const F_ = this.F; const was = F_ && F_.paused; if (F_ && !was) this.togglePause(F_);
    const row = (k, d) => h("div", { class: "fHelpRow" }, h("kbd", null, k), h("span", null, d));
    const m = UI.modal([h("h3", null, "야전 조작법"),
      h("div", { class: "fHelp" },
        h("div", null, h("h4", null, "명령"), ...Object.values(FLD_CMD).map((c) => row(c.k, `${c.n} — ${c.d}`)), row("Tab", "명령 대상 전환: 전군 ↔ 선택한 장수"), row("우클릭", "그 지점으로 집결해 대기 (대상: Tab 범위)"), row("적장 클릭", "선택한 장수가 그 적장을 노리고 돌격")),
        h("div", null, h("h4", null, "장수 · 무장기"), row("1~6", "장수 선택 (두 번 누르면 카메라 이동)"), row("Z X C B", "선택한 장수의 무장기 칸을 순서대로 (각 버튼에 키가 표시된다, 기력 소모) — 지력 75 이상 장수는 마지막 칸이 계략(숲 화계·강 수공)"), row("겨누기", "마우스를 전장 위에 두고 Z·X·C·B를 누르면 그 지점(폭발·강타)·그 방향(탄막·돌진)으로 쏜다"), row("미리보기", "무장기 버튼에 마우스를 올리면 맞을 곳과 맞을 적 수가 전장에 그려진다"), row("Y / D / N", "일기토 알림: Y 자동 결투(전장에서 바로) · D 직접 싸우기(일기토 화면) · N 거절 — 7초 뒤 기본 선택"),row("보조/AUTO", "무장기 모드: 보조(선택한 장수만 직접) → 전체 자동 → 수동"), row("G", "보조 모드에서 명령을 내린 부대를 다시 보조 AI에 맡긴다 (장수 카드의 AI 표시)"),
          h("h4", null, "화면"), row("← →", "카메라 이동 · 드래그 · 미니맵 클릭도 된다"), row("F", "카메라 추적 켜기/끄기"), row("P Space", "일시정지 — 멈춘 채로 명령할 수 있다"), row("S", "배속 ×1 → ×2 → ×3"), row("V", `진형 변경 (총대장, 첫 접전 뒤 ${FLD.FORM_CD}초에 한 번)`), row("Shift+1~6", "진형 바로 바꾸기 (어린·학익·봉시·방원·장사·안행)"))),
      h("div", { class: "fHelpTips" },
        h("p", null, `▸ 진형 상성: ${FORM_CYCLE} (이기는 쪽 주는 피해 +${Math.round((FLD.EDGE_UP - 1) * 100)}%, 지는 쪽 -${Math.round((1 - FLD.EDGE_DN) * 100)}%) · 진형 모양마다 효과가 다르다 · 밀리면 V로 바꾸자`),
        h("p", null, `▸ 장수는 병사를 쓸어낸다. 곁에 아군 병사가 없는 장수는 고립되어 사기가 떨어져 패주한다(총대장은 대신 친위대 보호를 잃는다) · ${FLD.SURGE}초부터 총공세(피해 +${Math.round((FLD.SURGE_K - 1) * 100)}%)`),
        h("p", null, `▸ ${FLD.TIME}초가 지나면 남은 전력을 비교한다: 공격측이 수비측의 1.4배 이상이면 공격측, 아니면 수비측 승리 · 성벽 안의 수비 부대는 받는 피해가 줄고, 숲은 이동 -25%·받는 피해 -15%, 강은 이동 -40%·주는 피해 -10%`),
        h("p", null, "▸ 병종 상성: 경장 ▶ 기동 ▶ 중장 ▶ 경장 · 경장은 사격, 중장은 근접, 기동은 포격"),
        h("p", null, "▸ 사기: 병사가 쓰러지거나 장수가 다치면 떨어진다. 30 아래면 병사가 달아난다. 독전 · 회복 무장기와 일기토 승리로 오른다"),
        h("p", null, "▸ 다친 장수는 「병사 돌격」으로 뒤에서 지휘하게 하자. 적 총대장(★)을 쓰러뜨리면 승리")),
      h("div", { class: "btns" }, h("button", { class: "primary", onclick: () => m.remove() }, "전투로"))], "list");
    this.resumeWhenGone(m, F_, was);
  },
  // 모달이 어떤 식으로 닫히든(버튼·Esc) 이 모달 때문에 멈췄던 전투를 다시 움직인다
  resumeWhenGone(m, F_, was) {
    if (!F_ || was) return;
    const tick = () => { if (m.isConnected) return setTimeout(tick, 150); if (F_.paused && !F_.finished) this.togglePause(F_); };
    setTimeout(tick, 150);
  },
  firstHelp() { let seen = false; try { seen = !!localStorage.getItem("lao3k_fhelp2"); localStorage.setItem("lao3k_fhelp2", "1"); } catch (e) { seen = true; } if (!seen) setTimeout(() => this.toast("H: 조작법 · Q 돌격 · W 대기 · E 후퇴 · Z/X/C/B 무장기 · 우클릭 집결 · ←/→ 카메라"), 1200); },

  // ── 출진 화면: 정찰 보고 · 진형 선택 · 양군 편성 ──
  prep(F_, foeForm, scouted) {
    return new Promise((res) => {
      const my = F_.units[F_.mySide], foe = F_.units[F_.mySide === "atk" ? "def" : "atk"];
      const ranged = my.filter((b) => b.cls !== 1).length / Math.max(1, my.length);
      const rec = scouted ? formWinner(foeForm) : F_.mySide === "def" ? "square" : ranged > 0.5 ? "crane" : "fish";
      const roster = (arr, mine) => h("div", { class: "prepRoster " + (mine ? "me" : "foe") }, arr.map((b) => h("div", { class: "prepUnit" + (b.lord ? " lord" : ""), title: b.generic ? `${b.gname} ${b.name}` : `${b.name} · ${CLS_KO[b.cls]} · 통${b.st.ldr} 무${b.st.war} 지${b.st.int}` },
        b.u ? sdface(b.u, 34) : h("img", { class: "sdf", src: "assets/icon/draft.webp", style: "width:34px;height:34px" }),
        h("div", null, h("b", null, (arr[0] === b && !b.generic ? "★" : "") + b.name), h("small", null, `${CLS_KO[b.cls]} · ${fmt(b.troops)}`)))));
      const sum = (arr) => fmt(arr.reduce((s, b) => s + b.troops, 0));
      const done = (k) => { m.remove(); Sound.sfx("click", 0.6); res(k); };
      // 총대장이 아니면 진형은 총대장이 정한다
      const cmdr = F_.entry.commander, fixed = cmdr ? null : F_.aiForm(F_.mySide), boss = my.find((b) => !b.generic);
      // 같은 지형이 둘이면 한 번만, 개수를 붙여 쓴다 (「강 · 강」이 되지 않게)
      const kinds = (F_.terrain || []).map((t) => t.kind), cnt = (k) => kinds.filter((x) => x === k).length;
      const terr = [...["forest", "river"].filter((k) => cnt(k)).map((k) => (k === "forest" ? "숲" : "강") + (cnt(k) > 1 ? ` ×${cnt(k)}` : "") + (k === "forest" ? "(이동 -25%, 엄폐: 받는 피해 -15%)" : "(이동 -40%, 주는 피해 -10%)")),F_.wallK() > 0 ? `수비측 성벽(받는 피해 -${Math.round(F_.wallK() * 100)}%${F_.units.def.some((b) => b.generic) ? ", 수비병이 지킨다" : ""})` : null, F_.cityK("def") < 1 ? `성 방어 지원(수비측 전체 받는 피해 -${Math.round((1 - F_.cityK("def")) * 100)}%)` : null].filter(Boolean);
      const m = UI.modal([
        h("h3", null, icon("war", 22), " 출진 — ", F_.title),
        h("div", { class: "prepVs" },
          h("div", null, h("h4", null, `아군 ${my.length}부대 · ${sum(my)}명`), roster(my, true)),
          h("div", { class: "prepMid" }, "VS"),
          h("div", null, h("h4", null, `적군 ${foe.length}부대 · ${sum(foe)}명`), roster(foe, false))),
        h("div", { class: "prepScout " + (scouted ? "ok" : "ng") }, scouted
          ? `정찰 보고 (지력 ${F_.scoutInt()}): 적은 「${FORMS[foeForm].n}」을 펼쳤다 — 「${FORMS[formWinner(foeForm)].n}」이 상성 우위`
          : `정찰 실패 (지력 ${F_.scoutInt()}, 성공률 ${Math.round(F_.scoutChance() * 100)}%): 적 진형을 알 수 없다`),
        h("div", { class: "prepTerr" }, `지형: ${terr.length ? terr.join(" · ") : "평지"}`),
        fixed ? h("div", { class: "prepScout ng" }, `총대장 ${boss ? jo(boss.name, "이가") : ""} 「${FORMS[fixed].n}」을 펼치라고 명했다 — 진형은 총대장만 정할 수 있다`) : null,
        h("div", { class: "formGrid" }, Object.entries(FORMS).map(([k, f]) => {
          const edge = scouted ? (FORM_EDGE[k] === foeForm ? "win" : FORM_EDGE[foeForm] === k ? "lose" : "") : "";
          return h("button", { class: "formCard" + ((fixed ? k === fixed : k === rec) ? " rec" : "") + (edge ? " " + edge : ""), disabled: !!fixed && k !== fixed, onclick: () => done(k) },
            h("div", { class: "formPic " + f.shape }, ...Array.from({ length: 9 }, () => h("i"))), h("b", null, f.n), h("small", null, f.d),
            h("small", { class: "formEdge" }, `▶ ${FORMS[formLoser(k)].n}에 강함 · ◀ ${FORMS[formWinner(k)].n}에 약함`),
            fixed && k === fixed ? h("em", null, "총대장 명령") : !fixed && k === rec ? h("em", null, scouted ? "상성 우위" : "추천") : edge === "lose" ? h("em", { class: "bad" }, "상성 열세") : null);
        })),
        h("div", { class: "prepFoot" }, h("small", { class: "muted" }, "전투 중: Q 돌격 · W 대기 · E 후퇴 · R 장수 돌격 · T 병사 돌격 · Z/X/C/B 무장기 · V 진형 · 우클릭 집결 · H 조작법"),
          h("div", { class: "btns" }, h("button",{ class: "ghost", onclick: () => done("auto") }, "자동 전투")))], "msg prep");
      setTimeout(() => { const b = m.querySelector(".formCard.rec"); if (b) b.focus(); }, 30);
    });
  },
};
