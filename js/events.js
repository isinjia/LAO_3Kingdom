// 라스트오리진 삼국지 — 스토리 이벤트 (가상 스토리)
// 매달 조건을 검사해 대화 장면(dialog)을 큐에 넣는다. 각 이벤트는 G.flags 로 한 번만 발생.
"use strict";

const STORY_EVENTS = [
  {
    id: "open", when: () => G.year === 1 && G.month === 1,
    lines: () => {
      const p = P(); const f = F(p.fac);
      if (!f) {
        const near = unitsIn(p.city).find((u) => !u.fac && u.id !== p.id && !u.iron);
        return [
          { who: null, text: `${p.city}. 무너진 건물 사이로 차가운 바람이 분다.` },
          { who: p.id, text: "사령관님이 사라진 지 벌써 몇 달… 이대로 손 놓고 있을 수는 없어.", voice: "Intro" },
          near ? { who: near.id, text: "당신도 갈 곳이 없는 모양이네. 이 근처엔 쓸 만한 세력이 몇 있어. 직접 보고 고르는 게 좋을 거야.", voice: "SearchEnd" } : null,
          { who: null, text: "탐방으로 인재를 찾고, 마음에 드는 세력에 사관하거나 — 직접 깃발을 올려라." },
        ];
      }
      const lord = U(f.lord);
      if (lord.id === p.id) return [
        { who: p.id, text: `모두 모였나. 사령관님이 돌아오실 날까지, ${jo(f.name, "은는")} 흩어지지 않는다.`, voice: "Leader" },
        { who: null, text: `“${f.motto}”` },
        { who: null, text: "천하에는 열네 개의 깃발과 철충이 있다. 내정으로 힘을 기르고, 때를 보아 진군하라." },
      ];
      return [
        { who: lord.id, text: `${p.name}, 왔구나. ${jo(f.name, "은는")} 지금 한 명의 손이라도 아쉽다.`, voice: "Leader" },
        { who: lord.id, text: `“${f.motto}” — 이것이 우리의 길이다. 공을 세우면 그만큼 보답하지.`, voice: "ActionApprove" },
        { who: p.id, text: "맡겨 주십시오.", voice: "SortiePick" },
      ];
    },
  },
  {
    id: "ironWave", when: () => G.year === 1 && G.month === 3,
    effect: () => { for (const c of citiesOf("iron")) c.troops += 6000; log("철충 대공세 — 철충 거점의 병력이 급증했다.", "war"); },
    bg: "field",
    lines: () => {
      const f = F(P().fac); const lord = f && U(f.lord);
      return [
        { who: "EmperorChick", text: "………………(기계음이 대지를 울린다)" },
        { who: null, text: "각지의 철충 둥지가 일제히 활성화되었다. 철충 거점의 병력이 크게 늘어났다." },
        lord ? { who: lord.id, text: "철충이 움직였다. 서로 싸우는 사이에 놈들이 전부 가져갈 셈이군… 경계를 강화해라.", voice: "BattleFocus" } : { who: P().id, text: "철충이… 이렇게나 많이.", voice: "BattleFocus" },
      ];
    },
  },
  {
    id: "signal1", when: () => G.year === 2 && G.month === 1,
    bg: "story_signal", bgm: "event",
    lines: () => [
      { who: null, text: "폐허가 된 통신탑에서 미약한 신호가 잡혔다. 암호화된, 오래된 오르카의 주파수." },
      { who: P().id, text: "이건… 사령관님의 식별 코드? 아니, 설마.", voice: "SearchEnd" },
      { who: null, text: "신호는 곧 끊겼다. 그러나 소문은 순식간에 퍼졌다 — ‘사령관은 살아 있다’." },
    ],
    effect: () => { const p = P(); addMerit(p, 50); log("사령관의 것으로 보이는 신호가 포착되었다.", "story"); },
  },
  // 중반 메인 서사: 사령관의 흔적 추적 (3~6년차)
  {
    id: "signal2", when: () => G.year === 3 && G.month === 8,
    bg: "story_signal", bgm: "event",
    lines: () => [
      { who: null, text: "두 번째 신호. 이번엔 좌표가 섞여 있었다 — 남쪽 바다 어딘가." },
      { who: P().id, text: "같은 코드야. 누군가 일부러 흘리고 있는 거라면… 함정일 수도 있어.", voice: "SearchEnd" },
      { who: null, text: "각 세력이 앞다투어 정찰대를 보냈다는 소문이 돈다. 천하의 긴장이 한층 높아졌다." },
    ],
    effect: () => { for (const f of Object.values(G.factions)) if (f.alive && !f.iron) for (const c of citiesOf(f.key)) c.troops += 300; log("두 번째 신호 — 각 세력이 군비를 늘렸다.", "story"); },
  },
  {
    id: "relic", when: () => G.year === 4 && G.month === 3,
    bg: "city",
    lines: () => {
      const p = P(); const near = officersOf(p.fac || "").find((u) => u.id !== p.id && !u.iron);
      return [
        { who: null, text: `${p.city} 근처 폐허에서 오르카 소속의 낡은 보급 상자가 발견되었다.` },
        near ? { who: near.id, text: "상자 안에 메모가 있어요. ‘모두가 서로를 지킬 수 있게’… 사령관님 글씨예요.", voice: "SearchEnd" } : { who: p.id, text: "‘모두가 서로를 지킬 수 있게’… 사령관님 글씨야.", voice: "SearchEnd" },
        { who: p.id, text: "…그렇다면 우리가 싸우는 이유도 그거여야 해.", voice: "Leader" },
        { who: null, text: "상자 속 장비를 손에 넣었다. 공적 +100" },
      ];
    },
    effect: () => { const p = P(); addMerit(p, 100); if (typeof gainItem === "function" && typeof randItem === "function") { const it = randItem([0, 50, 45, 5]); if (it) gainItem(it, "오르카 보급 상자"); } log("오르카 보급 상자 — 사령관의 메모를 발견했다.", "story"); },
  },
  {
    id: "signal3", when: () => G.year === 5 && G.month === 11,
    bg: "story_signal", bgm: "event",
    lines: () => [
      { who: null, text: "세 번째 신호는 짧은 음성이었다. 잡음 너머로 단 한 마디." },
      { who: null, text: "“…싸우지 마. 함께 살아.”" },
      { who: P().id, text: "사령관님… 그 말을 지키려면, 먼저 이 싸움을 끝내야 해요.", voice: "MVP" },
    ],
    effect: () => { for (const u of Object.values(G.units)) if (u.alive && !u.iron && u.fac) u.loyal = clamp(u.loyal + 3, 0, 100); log("세 번째 신호 — 각지 장수들의 마음이 흔들렸다. (충성 +3)", "story"); },
  },
  {
    id: "lastLetter", when: () => G.year === 6 && G.month === 6 && P().fac,
    bg: "story_beacon", bgm: "oath",
    lines: () => {
      const p = P(); const f = F(p.fac); const lord = U(f.lord);
      return [
        { who: null, text: "신호의 발신지가 밝혀졌다. 자동 송신기만 남은 빈 관측소였다. 기록 장치에 마지막 메시지가 남아 있었다." },
        { who: null, text: "“모두가 하나가 되는 날, 이 채널로 다시 연락하겠다.”" },
        { who: lord.id, text: "사령관은 살아 있다. 그리고 우리가 이 땅을 하나로 묶기를 기다리고 있다.", voice: "Leader" },
        { who: null, text: "이제 남은 것은 천하를 하나로 묶는 일뿐이다. (모든 소속 거점 치안 +5)" },
      ];
    },
    effect: () => { const p = P(); for (const c of citiesOf(p.fac)) c.order = clamp(c.order + 5, 0, 100); log("빈 관측소 — 사령관의 마지막 뜻을 확인했다.", "story"); },
  },
  // 노선 후속: 함께 사는 길 → 동맹 제안 / 무력 통일 → 진격 결의
  {
    id: "routeUnity", when: () => G.flags.route === "unity" && G.year === 6 && G.month === 5 && P().fac,
    bg: "story_meeting", bgm: "oath",
    lines: () => {
      const p = P(); const o = Object.values(G.factions).filter((f) => f.alive && !f.iron && f.key !== p.fac).sort((a, b) => citiesOf(b.key).length - citiesOf(a.key).length)[1] || Object.values(G.factions).find((f) => f.alive && !f.iron && f.key !== p.fac);
      G.flags.routeAlly = o ? o.key : null;
      return [
        { who: null, text: "휴전이 끝나 가던 무렵, 한 세력에서 사절이 찾아왔다." },
        o ? { who: o.lord, text: `“함께 살아” — 그 신호, 우리도 들었다. ${jo(o.name, "은는")} 당신들과 칼을 겨누고 싶지 않다.`, voice: "Leader" } : null,
        { who: p.id, text: "손을 내밀어 준 걸 잊지 않을게요.", voice: "SortiePick" },
        o ? { who: null, text: `${o.name}와의 휴전이 1년 연장되었다.` } : null,
      ].filter(Boolean);
    },
    effect: () => { const k = G.flags.routeAlly; if (k) G.truce[k] = Math.max(G.truce[k] || 0, 12); addMerit(P(), 60); log("함께 사는 길 — 동맹 제안을 받아들였다.", "story"); },
  },
  {
    id: "routeForce", when: () => G.flags.route === "force" && G.year === 6 && G.month === 2 && P().fac,
    bg: "field", bgm: "tense",
    lines: () => [
      { who: null, text: "출진 깃발이 일제히 올랐다. 싸움을 끝내기 위한 싸움이 시작된다." },
      { who: P().id, text: "망설이면 그만큼 더 많은 피가 흘러. 단숨에 끝낸다.", voice: "SortiePick" },
      { who: null, text: "1년 동안 아군 전투 사기 +5." },
    ],
    effect: () => { G.flags.forceUntil = G.year * 12 + G.month + 12; log("무력 통일 — 진격 결의 (1년간 사기 +5)", "story"); },
  },
  {
    id: "heirs", when: () => G.year === 7 && G.month === 4,
    bgm: "tense",
    bg: "story_meeting",
    lines: () => {
      const p = P(); const th = typeof threatFaction === "function" && threatFaction();
      const rival = th && th.key !== p.fac ? th : Object.values(G.factions).filter((f) => f.alive && !f.iron && f.key !== p.fac).sort((a, b) => citiesOf(b.key).length - citiesOf(a.key).length)[0];
      return [
        { who: null, text: "관측소의 메시지가 퍼지자, 각 세력은 저마다 ‘사령관의 뜻을 잇는 자’를 자처하기 시작했다." },
        rival ? { who: rival.lord, text: `사령관이 돌아올 곳은 ${jo(rival.name, "이가")} 마련한다. 방해하는 자는 누구든 적이다.`, voice: "Leader" } : null,
        { who: p.id, text: "명분 싸움이 시작됐어. 말이 아니라 결과로 보여 줘야 해.", voice: "SortiePick" },
      ].filter(Boolean);
    },
    effect: () => { const p = P(); addMerit(p, p.fac && isLord(p) ? 120 : 80); log("계승 명분 다툼 — 세력 간 긴장이 높아졌다.", "story"); },
  },
  {
    id: "beacon", when: () => G.year === 8 && G.month === 9,
    bg: "story_beacon", bgm: "oath",
    lines: () => [
      { who: null, text: "빈 관측소의 송신기가 스스로 재가동했다. 같은 문장이 매일 밤 반복된다." },
      { who: null, text: "“모두가 하나가 되는 날, 이 채널로 다시 연락하겠다.”" },
      { who: P().id, text: "기다려 주세요, 사령관님. 거의 다 왔어요.", voice: "MVP" },
    ],
    effect: () => { const p = P(); if (p.fac) for (const c of citiesOf(p.fac)) c.order = clamp(c.order + 3, 0, 100); log("관측소 송신기 재가동 — 통일의 날을 기다린다.", "story"); },
  },
  {
    id: "pecsAmbition", when: () => G.year >= 2 && G.month === 6 && F("pecs") && F("pecs").alive,
    lines: () => [
      { who: "PECS_LemonadeAlpha", text: "질서를 잃은 바이오로이드들은 결국 서로를 갉아먹을 뿐. 펙스가 관리해야만 인류의 유산은 보존된다.", voice: "Leader" },
      { who: null, text: "펙스 컨소시엄이 각지에 선전 방송을 내보낸다. 일부 거점의 치안이 흔들린다." },
    ],
    effect: () => { for (const c of Object.values(G.cities)) if (c.owner && c.owner !== "pecs" && !F(c.owner).iron && chance(30)) c.order = clamp(c.order - 8, 0, 100); },
  },
  {
    id: "rise8", when: () => P().fac && citiesOf(P().fac).length >= 8 && !F(P().fac).iron,
    lines: () => {
      const f = F(P().fac); const lord = U(f.lord);
      return [
        { who: lord.id, text: `${f.name}의 깃발이 여덟 곳에 휘날린다. 이제 우리를 무시할 세력은 없다.`, voice: "MVP" },
        { who: null, text: "복구된 통신망 너머에서, 다시 그 주파수가 잡힌다. 이번엔 좌표가 함께였다 — 철충의 심장부." },
      ];
    },
    effect: () => { addMerit(P(), 200); },
  },
  {
    id: "ironLast", when: () => F("iron") && F("iron").alive && citiesOf("iron").length === 1,
    lines: () => [
      { who: null, text: `철충의 마지막 둥지, ${citiesOf("iron")[0].name}. 그곳에서 거대한 신호가 맥동한다.` },
      { who: "EmperorChick", text: "……………………" },
      { who: P().id, text: "저기만 무너뜨리면, 이 땅에서 철충을 몰아낼 수 있어.", voice: "BattleFocus" },
    ],
  },
  {
    id: "ironGone", when: () => F("iron") && !F("iron").alive,
    lines: () => [
      { who: null, text: "철충의 마지막 거점이 무너졌다. 수십 년 만에, 대지 위에 기계음이 멎었다." },
      { who: P().id, text: "끝났… 어? 아니, 아직이야. 바이오로이드끼리의 싸움이 남아 있어.", voice: "MVP" },
    ],
    effect: () => { addMerit(P(), 300); for (const c of Object.values(G.cities)) if (c.owner) c.order = clamp(c.order + 10, 0, 100); },
  },
];

// 원작 로비 대사에서 한 줄 고르기 (avoidCmd: 사령관을 직접 부르는 대사 제외). 같은 대사는 한 판에 한 번
// 원작 로비 대사는 사령관에게 하는 말이다. 게임 내 대화에서는 아래 두 종류를 쓰지 않는다
const LINE_SENSITIVE = /야한|은밀|벗|속옷|가슴|엉덩|키스|침대|목욕|샤워|만지|스킨십|애인|사랑|좋아해|결혼|반지|둘이서|둘이만|단둘|몸|체온|냄새|입술|허벅|부끄|민망|변태|음란|섹|흥분|치마|스타킹|발로|밟|무릎|베개|이상한 곳|건드|당기|그런 건|좀 그런/;
const LINE_TOWARD = /보는 건|보지 마|보시|쳐다|가까이|붙지|붙진|곁에|옆에|함께 있|같이 있|손을|안아|부담|싫다는|관둬|그만|당신|모시|분부|명령만|지시를|님[,.!?…\s]|님$|님과|님은|님이|님께|님을|님의|나를|날 |저를|절 |제 곁|기다렸|보고 싶|만나서|인간을|말아 ?주세요|하지 마세요|어디를|이러시|그러시/;
const lineSafe = (l, code) => !l.c && !LINE_SENSITIVE.test(l.t) && !LINE_TOWARD.test(l.t) && typeof LINE_PEER !== "undefined" && !!code && (LINE_PEER[code] || []).includes(l.t);

// 대사 감정 태그: 결의 / 걱정 / 유머 / 일상
function lineTag(t) {
  if (/이건 .*(탄|총|포|장비|장갑|미사일|드론|기체|무기)|(탄|포탄|탄환|구경|장갑판|합금|시멘트|드론|레이더)(이에요|입니다|이죠|예요)/.test(t)) return "explain";
  if (/헤헤|후후|에헤|하하|히히|흐흥|ㅎ|장난|농담|노래|간식|맛있|과자|케이크|몰래|살짝|터뜨|놀래|비밀|쉿|♪|~/.test(t)) return "humor";
  if (/전투|승리|의지|지키|작전|명령|싸우|무기|훈련|임무|출격|각오/.test(t)) return "resolve";
  if (/걱정|괜찮|무리|조심|다치|아프|힘들|위험|쉬/.test(t)) return "worry";
  if (/헤헤|후후|에헤|하하|히히|흐흥|ㅎ|장난|농담|노래|간식|맛있|과자|케이크/.test(t)) return "humor";
  return "daily";
}
const TOPIC = { resolve: ["다음 작전, 준비는 됐어?", "요즘 훈련은 어때?"], worry: ["얼굴이 안 좋아 보이는데… 괜찮아?", "무리하는 거 아니지?"], humor: ["요즘 재밌는 일 없어?", "쉬는 시간에 뭐 해?"], daily: ["요즘 어때?", "오랜만이네. 잘 지냈어?"] };
const REPLY_T = {
  resolve: ["좋아, 그 각오면 충분해.", "알았어. 이번엔 내가 엄호할게.", "그래. 끝까지 같이 가자.", "든든하네. 등 뒤는 맡길게.", "그 말, 전장에서 꼭 보여 줘."],
  worry: ["…고마워. 그 말 들으니 조금 힘이 나.", "너무 혼자 짊어지지 마.", "같이 있으니까 괜찮을 거야.", "힘들면 말해. 나도 여기 있으니까.", "오늘은 푹 쉬어. 보초는 내가 설게."],
  humor: ["…그건 하지 마.", "푸흡, 그래도 너답다.", "에이, 그게 뭐야.", "그런 소리 하면 대장한테 혼난다?", "후후, 진짜 못 말려."],
  daily: ["그렇구나. 나도 비슷해.", "그 이야기, 나중에 더 해 줘.", "응, 요즘은 좀 평화롭네.", "그래도 이렇게 얘기하니까 좋다.", "다음엔 차라도 한잔하자."],
  explain: ["…설명은 고마운데, 너무 자세하다.", "역시 장비 얘기만 나오면 눈이 반짝이네.", "그거 정비할 땐 나도 불러 줘."],
};
function lineOf(code, avoidCmd, tags) {
  const ls = (typeof LAO_LINES !== "undefined" && LAO_LINES[code]) || [];
  const used = (G.flags.usedLines ||= {});
  let pool = ls.filter((l) => lineSafe(l, code) && !used[code + l.t]);
  if (!tags || !tags.includes("explain")) { const ne = pool.filter((l) => lineTag(l.t) !== "explain"); if (ne.length) pool = ne; }
  if (tags) { const tp = pool.filter((l) => tags.includes(lineTag(l.t))); if (tp.length) pool = tp; }
  // 9) 대사가 바닥나면 최근 5개를 뺀 나머지를 다시 쓴다
  if (!pool.length && ls.length) { const recent = (G.flags.recentLines ||= []); pool = ls.filter((l) => lineSafe(l, code) && !recent.includes(code + l.t)); }
  const l = pool.length ? pick(pool) : null;
  if (l) { used[code + l.t] = 1; const rc = (G.flags.recentLines ||= []); rc.push(code + l.t); if (rc.length > 5) rc.shift(); }
  return l;
}
const REPLY = ["…그러게. 나도 비슷한 생각이었어.", "후후, 여전하네.", "그 말, 나중에 다시 꺼내 줘. 지금은 좀 쉬고 싶어.", "응. 그래도 같이 있으니까 든든해.", "에이, 너무 진지하잖아.", "그런 소리 하면 대장한테 혼난다?", "알았어, 알았어. 다음엔 내가 엄호할게.", "그 이야기, 예전에도 했었지?", "…고마워. 그 말 들으니 조금 힘이 나.", "좋아, 이번 작전 끝나면 같이 쉬자."];

// 세력별 고유 이벤트 (군주 성격 + 원작 대사 활용) — 플레이어 소속 세력에서 발생
const FACTION_EVENT_LINES = {
  bm: ["메이드의 품격은 전장에서도 무너지지 않아요. 오늘도 홍차 한 잔의 여유를.", "사령관님이 계셨다면… 아니, 우리가 지키는 거예요."],
  steel: ["행군 대열 정비! 규율이 무너지면 부대도 무너진다.", "스틸 라인에 낙오자는 없다. 끝까지 함께 간다."],
  doom: ["하늘에서 보면 다 보여. 놈들 진형, 허점투성이야.", "둠 브링어의 비행 편대, 출격 준비 완료."],
  horde: ["사막의 바람이 바뀌었다. 진격할 때다.", "약한 자는 지켜지고, 강한 자는 싸운다. 그것이 호드의 법."],
  valhalla: ["발할라의 자매들이여, 방패를 들어라.", "우리가 쓰러져도, 자매가 이어받는다."],
  companion: ["주인님이 없는 저택은… 너무 조용하네요.", "컴패니언 시리즈의 자부심을 보여 드리죠."],
  pecs: ["관리되지 않는 혼란은 낭비일 뿐.", "펙스의 질서 아래에서라면 누구도 굶지 않을 텐데."],
  horizon: ["파도가 높다. 해상 작전엔 더할 나위 없는 날씨지.", "바다는 우리 편이다."],
  ags: ["행동지침 21번 갱신: 생존자 보호 범위 확대.", "기체 정비 완료. 다음 명령을 대기합니다."],
  dent: ["쇼는 계속되어야 해! 관객이 철충이어도 말이지.", "무대 조명, 오케이. 주연은 우리야."],
  cityguard: ["시민 신고 접수. 치안 순찰을 강화합니다.", "도시의 불빛을 지키는 게 우리 일입니다."],
  mongus: ["특수작전 브리핑 시작. 이번엔 조용히 끝내자.", "몽구스는 뱀을 두려워하지 않아."],
  kouhei: ["신의 뜻은 늘 우리 곁에 있습니다.", "기도는 끝났습니다. 이제 행동할 때."],
  nature: ["숲이 다시 숨 쉬기 시작했어. 들려?", "인간이 없어도 자연은 이어진다. 우리도 그래야지."],
};
const FACTION_FLAVOR = { bm: "홍차", steel: "군용 커피", doom: "활주로의 바람", horde: "사막의 불꽃", valhalla: "꿀술", companion: "저택의 와인", pecs: "정량 배급", horizon: "바닷바람", ags: "정비유", dent: "무대 조명", cityguard: "야간 순찰", mongus: "작전 지도", kouhei: "촛불", nature: "숲의 이슬" };
const BRANCH_LINES = {
  victory: (f, fl) => [`오늘만큼은 ${fl}로 축배를 들자. 다들 잘 싸웠다.`, `승리는 우리 모두의 것이다. ${f.motto}`, `이 기세라면 다음 전선도 문제없다.`],
  rebuild: (f, fl) => [`잃은 것을 세지 마라. 남은 것을 지켜라.`, `${fl} 한 잔 하고, 내일부터 다시 시작한다.`, `패배는 기록일 뿐, 결말이 아니다.`],
  grand: (f, fl) => [`넓어진 만큼, 지켜야 할 사람도 많아졌다.`, `${f.name}의 깃발 아래 모인 이들을 실망시키지 마라.`, `대국의 군주는 서두르지 않는다. 한 걸음씩 간다.`],
};
function factionEvent() {
  const p = P(); if (!p.fac || F(p.fac).iron) return null;
  const lines = FACTION_EVENT_LINES[p.fac]; if (!lines) return null;
  if (G.month < 5 || G.month > 7 || G.flags["facEv" + G.year]) return null; // 매년 5월 (그달 VN이 많거나 핵심 서사가 있으면 6·7월로)
  G.flags["facEv" + G.year] = true; G.flags.facEvMonth = G.year * 12 + G.month;
  const k = (G.flags.facEvN = (G.flags.facEvN || 0) + 1) - 1;
  const lord = U(F(p.fac).lord);
  const mates = officersOf(p.fac).filter((u) => u.id !== lord.id && u.id !== p.id && u.squad === lord.squad);
  const mate = mates.length ? pick(mates) : pick(officersOf(p.fac).filter((u) => u.id !== lord.id && u.id !== p.id)) || null;
  const n = citiesOf(p.fac).length, wins = (G.chron || []).filter((c) => c.text.endsWith("점령") && c.d.startsWith(G.year - 1 + ".")).length, lost = (G.chron || []).filter((c) => c.text.endsWith("상실") && c.d.startsWith(G.year - 1 + ".")).length;
  let kind = wins >= 2 ? "victory" : lost >= 2 ? "rebuild" : n >= 10 ? "grand" : null;
  if (kind && kind === G.flags.facEvLast && kind === G.flags.facEvPrev) kind = null; // 같은 분기 3년 연속 방지
  if (!kind) { const W = { bond: 50, victory: 15, grand: 15, rebuild: 20 }; delete W[G.flags.facEvLast]; let r = Math.random() * Object.values(W).reduce((a, b) => a + b, 0); for (const k2 in W) { r -= W[k2]; if (r <= 0) { kind = k2; break; } } kind ||= "bond"; }
  G.flags.facEvPrev = G.flags.facEvLast; G.flags.facEvLast = kind;
  const TITLE = { victory: wins ? "승전 축하연" : "수성 축하연", rebuild: lost ? "패전 후 재정비" : "전열 재정비", grand: n >= 10 ? "대국의 무게" : "영토 순시", bond: "결속의 밤" };
  const fl = FACTION_FLAVOR[p.fac] || "차";
  const OPEN = { victory: `${wins ? `작년 한 해 ${wins}곳을 손에 넣었다.` : "올해는 지켜낸 것을 축하하자."} ${pick(BRANCH_LINES.victory(F(p.fac), fl))}`, rebuild: `${lost ? `${lost}곳을 잃었다…` : "아직 갈 길이 멀다."} ${pick(BRANCH_LINES.rebuild(F(p.fac), fl))}`, grand: `거점이 ${n}곳. ${pick(BRANCH_LINES.grand(F(p.fac), fl))}`, bond: chance(50) ? lines[k % lines.length] : pick([`다들 모여 줘서 고맙다. ${fl} 한 잔씩 돌려라.`, `${F(p.fac).motto}`, `오늘 밤만큼은 계급도 전선도 잊자.`]) };
  const L = [{ who: null, text: `【${TITLE[kind]}】 ${F(p.fac).name}, ${p.city}.` }, { who: lord.id, text: OPEN[kind], voice: "Leader" }];
  const ml = mate && lineOf(mate.id, true, { victory: ["humor", "daily"], rebuild: ["resolve", "worry"], grand: ["resolve"], bond: ["resolve", "daily"] }[kind]);
  const MATE_T = { victory: ["다음 승리도 우리가 가져가요!", "오늘은 마음껏 즐겨도 되겠죠?"], rebuild: ["…다시 일어서면 돼요. 이번엔 지지 않아요.", "잃은 만큼, 더 단단해질 거예요."], grand: n >= 10 ? ["이만큼 커졌으니, 지킬 것도 많네요.", "어디든 따라갈게요."] : ["거점 하나하나 둘러보니, 지킬 이유가 더 분명해지네요.", "어디든 따라갈게요."], bond: ["이렇게 다 같이 모이니까 좋네요.", "앞으로도 잘 부탁해요."] };
  if (mate) L.push({ who: mate.id, text: ml ? ml.t : pick(MATE_T[kind]), voice: ml && ml.v ? ml.v : "ActionApprove" });
  if (lord.id !== p.id) L.push({ who: p.id, text: kind === "rebuild" ? "…다음엔 지지 않아." : "…이 세력이라면, 믿고 따라갈 수 있어.", voice: "SortiePick" });
  const loy = kind === "rebuild" ? 6 : 3;
  for (const u of officersOf(p.fac)) u.loyal = clamp(u.loyal + loy, 0, 100);
  const EFF = { victory: "1개월간 전투 사기 +10 · 공적 +60", rebuild: "전 거점 치안 +5 · 충성 +6", grand: "공적 +100 · 군주 매력 경험", bond: "충성 +3 · 같은 부대 친밀 +5" };
  if (kind === "victory") { addMerit(p, 60); G.flags.feastUntil = G.year * 12 + G.month + 1; }
  if (kind === "rebuild") for (const c of citiesOf(p.fac)) c.order = clamp(c.order + 5, 0, 100);
  if (kind === "grand") { addMerit(p, 100); gainExp(lord, "cha", 40); }
  if (kind === "bond") for (const u of officersOf(p.fac)) if (u.squad === lord.squad) u.bond = clamp(u.bond + 5, 0, 100);
  log(`세력 이벤트 「${TITLE[kind]}」 — ${EFF[kind]}`, "good");
  L.push({ who: null, text: `【${TITLE[kind]}】 효과: ${EFF[kind]}` });
  return { type: "dialog", bgUrl: `assets/city/${CITY_BG[p.city]}.jpg`, bgm: kind === "rebuild" ? "sad" : "oath", lines: L };
}

// 세 번째 신호 이후 노선 선택 (군주 플레이): 엔딩 문구가 갈린다
// 진언 판정: 군주 친밀이 높을수록 받아들인다 (친밀 60 이상은 항상 수락)
function adviseChance() { const lord = U(F(P().fac).lord); return lord.bond >= 60 ? 100 : Math.round(45 + lord.bond / 2); }
function adviseAccepted() { return Math.random() * 100 < adviseChance(); }
function routeApply(force, adviceOk = true) {
  const p = P(); if (!p.fac) return "";
  if (!isLord(p)) {
    const lord = U(F(p.fac).lord);
    if (!adviceOk) { force = !force; addMerit(p, 20); G.flags.adviceRejected = true; } // 군주가 다른 길을 택함
    else { addMerit(p, 50); lord.bond = clamp(lord.bond + 5, 0, 100); }
  }
  G.flags.route = force ? "force" : "unity";
  if (force) { for (const c of citiesOf(p.fac)) c.troops += 500; if (isLord(p)) addMerit(p, 100); chron("노선: 무력 통일"); return isLord(p) ? "전 거점 병력 +500 · 공적 +100" : "전 거점 병력 +500"; }
  for (const f of Object.values(G.factions)) if (f.alive && !f.iron && f.key !== p.fac) G.truce[f.key] = Math.max(G.truce[f.key] || 0, 6);
  for (const c of citiesOf(p.fac)) c.order = clamp(c.order + 5, 0, 100); chron("노선: 함께 사는 길");
  return "모든 세력과 휴전 6개월 · 치안 +5";
}

// 세력 행사 칭호: 같은 선택을 2회 이상 하면 매달 작은 지속 효과
const FAC_TITLE = {
  "포상금을 푼다": { t: "아낌없이 베푼 군주", d: "소속 장수 충성 매달 +1", f: (p) => officersOf(p.fac).forEach((u) => (u.loyal = clamp(u.loyal + 1, 0, 100))) },
  "검소하게 치른다": { t: "검소한 군주", d: "본거지 자금 매달 +30", f: (p, h) => (h.gold += 30) },
  "방벽 보수": { t: "성벽을 쌓은 군주", d: "본거지 방어 매달 +20", f: (p, h) => (h.def += 20) },
  "병사 위로": { t: "병사를 아낀 군주", d: "소속 장수 충성 매달 +1", f: (p) => officersOf(p.fac).forEach((u) => (u.loyal = clamp(u.loyal + 1, 0, 100))) },
  "치안 점검": { t: "거리를 지킨 군주", d: "전 거점 치안 매달 +1", f: (p) => citiesOf(p.fac).forEach((c) => (c.order = clamp(c.order + 1, 0, 100))) },
  "인재 물색": { t: "인재를 모은 군주", d: "공적 매달 +5", f: (p) => addMerit(p, 5) },
  "연회를 연다": { t: "매년 연회를 연 군주", d: "같은 부대 친밀 매달 +1", f: (p) => officersOf(p.fac).forEach((u) => { if (u.squad === p.squad) u.bond = clamp(u.bond + 1, 0, 100); }) },
  "합동 훈련": { t: "훈련장을 떠나지 않은 군주", d: "본거지 병력 매달 +60", f: (p, h) => (h.troops += 60) },
};
// 3회 선택하면 견습 칭호, 5회면 정식 칭호(효과 2배). 횟수가 같으면 최근 선택을 우선
function activeTitle() {
  const fp = (G.flags && G.flags.facPick) || {}, last = G.flags && G.flags.facPickLast;
  const top = Object.entries(fp).sort((a, b) => b[1] - a[1] || (b[0] === last) - (a[0] === last))[0];
  if (!top || top[1] < 3 || !FAC_TITLE[top[0]]) return null;
  const full = top[1] >= 5, base = FAC_TITLE[top[0]];
  return { key: top[0], n: top[1], full, ...base, t: full ? base.t : `견습 · ${base.t}`, d: full ? `${base.d} ×2` : `${base.d} (5회 선택 시 2배)` };
}
function applyTitle() {
  const t = activeTitle(), p = P(); if (!t || !p.fac) return; const h = C(capitalOf(p.fac)); if (!h) return;
  for (let i = 0; i < (t.full ? 2 : 1); i++) t.f(p, h);
  const mx = cityMax(h); h.def = Math.min(h.def, mx.def); h.gold = Math.min(h.gold, 30000);
}

// 세력 행사 마무리 선택 (플레이어 개입)
const FAC_CHOICE = {
  victory: { q: "축하연을 어떻게 치를까?", a: ["포상금을 푼다", "자금 -300 · 소속 장수 충성 +5", "propose"], b: ["검소하게 치른다", "공적 +40", "rest"] },
  rebuild: { q: "재정비의 중심을 어디에 둘까?", a: ["방벽 보수", "본거지 방어 +300", "def"], b: ["병사 위로", "소속 장수 충성 +4", "talk"] },
  grand: { q: "순시의 목적은?", a: ["치안 점검", "전 거점 치안 +4", "order"], b: ["인재 물색", "공적 +60", "search"] },
  bond: { q: "결속의 밤, 무엇을 할까?", a: ["연회를 연다", "자금 -200 · 같은 부대 친밀 +6", "comm"], b: ["합동 훈련", "본거지 병력 +300 · 공적 +20 · 치안 -3", "train"] },
};
function facChoiceApply(kind, first) {
  const p = P(); if (!p.fac) return "";
  const c = C(p.city), home = C(capitalOf(p.fac)) || c;
  const pay = (n) => { const src = home && home.gold >= n ? home : null; if (src) src.gold -= n; return !!src; };
  if (kind === "victory") { if (first && pay(300)) { for (const u of officersOf(p.fac)) u.loyal = clamp(u.loyal + 5, 0, 100); return "소속 장수 충성 +5"; } addMerit(p, 40); return "공적 +40"; }
  if (kind === "rebuild") { if (first) { home.def += 300; return `${home.name} 방어 +300`; } for (const u of officersOf(p.fac)) u.loyal = clamp(u.loyal + 4, 0, 100); return "소속 장수 충성 +4"; }
  if (kind === "grand") { if (first) { for (const x of citiesOf(p.fac)) x.order = clamp(x.order + 4, 0, 100); return "전 거점 치안 +4"; } addMerit(p, 60); return "공적 +60"; }
  if (first && pay(200)) { const lord = U(F(p.fac).lord); for (const u of officersOf(p.fac)) if (u.squad === lord.squad || u.squad === p.squad) u.bond = clamp(u.bond + 6, 0, 100); return "같은 부대 친밀 +6"; }
  home.troops += 300; home.order = clamp(home.order - 3, 0, 100); addMerit(p, 20); return `${home.name} 병력 +300 · 공적 +20 · 치안 -3`;
}

// 같은 원작 부대원끼리의 대화 (플레이어 거점, 가끔)
const PEER_MOOD = (t) => /폭발|폭탄|돌격|죽|파괴|돌파|싸우|싸움|전투|증명|승리|훈련|지키|임무|적|장갑|포 /.test(t) ? "resolve" : /걱정|무섭|무서|외롭|우울|힘들|위험|겁|불행|고민|아파|번뇌|그리워|아쉽/.test(t) ? "worry" : "calm";
const PEER_TOPIC = { resolve: ["다음 작전, 준비는 됐어?", "요즘 훈련은 어때?", "전선 소식 들었어?"], worry: ["얼굴이 안 좋아 보이는데… 괜찮아?", "요즘 무슨 생각 해?", "잠은 좀 잤어?"], calm: ["요즘 어때?", "오랜만이네. 잘 지냈어?", "쉬는 중이야?", "무슨 생각 해?"] };
const PEER_REPLY = { resolve: ["든든하네. 등 뒤는 맡길게.", "그 말, 전장에서 꼭 보여 줘.", "좋아. 그 기세면 충분해."], worry: ["…그랬구나. 혼자 짊어지지 마.", "힘들면 말해. 나도 여기 있으니까.", "괜찮아. 우리가 같이 있잖아."], calm: ["…그렇구나. 너다운 얘기네.", "후후, 무슨 말인지 알 것 같아.", "그래, 다음에 더 들려줘.", "그런 생각을 하고 있었구나."] };
// 원작 대사가 없는 페어용 짧은 대화
const PEER_PLAIN = [["오늘 경계 근무, 같이 서자.", "응. 둘이면 금방 지나가겠다."], ["보급품에 간식 들어왔대.", "진짜? 남기 전에 가 보자."], ["장비 정비 끝났어?", "거의. 조금만 도와줄래?"], ["다들 무사해서 다행이야.", "응. 다음에도 꼭 같이 돌아오자."], ["오늘 식당 메뉴 봤어?", "또 통조림이더라. 그래도 따뜻하면 됐지."], ["지도 좀 같이 볼래? 다음 행군로가 헷갈려서.", "좋아. 강 쪽 길이 더 안전할 거야."], ["어제 보초 설 때 별 엄청 많더라.", "나도 봤어. 전쟁만 없으면 좋은 밤인데."], ["탄약 재고 확인했어?", "응. 한 번 더 싸울 만큼은 있어."], ["너 요즘 사격 실력 늘었더라.", "정말? 연습한 보람이 있네."], ["휴가 나오면 뭐 하고 싶어?", "그냥 하루 종일 자고 싶어."], ["부대 깃발 새로 꿰맸어.", "오, 훨씬 낫다. 고마워."], ["비 오기 전에 장비 덮어 두자.", "알았어. 저쪽은 내가 맡을게."]];
function squadChat(force) {
  const p = P(); if (!force && !chance(22)) return null;
  const here = unitsIn(p.city).filter((u) => !u.iron && u.id !== p.id && u.squad);
  const by = {}; for (const u of here) (by[u.squad] ||= []).push(u);
  const pair = Object.values(by).find((a) => a.length >= 2); if (!pair) return null;
  const [a, b2] = shuffle(pair.slice()).slice(0, 2);
  const key = "chat_" + G.year + "_" + [a.id, b2.id].sort().join("_"); // 같은 페어는 1년에 한 번 if (G.flags[key]) return null;
  G.flags[key] = true;
  const q = LAO_SQUADS.find((s) => s.key === a.squad);
  a.bond = clamp(a.bond + 4, 0, 100); b2.bond = clamp(b2.bond + 4, 0, 100);
  const lb = lineOf(b2.id, true);
  const mood = lb ? PEER_MOOD(lb.t) : "calm";
  const plain = lb ? null : pick(PEER_PLAIN);
  return { type: "dialog", cast: [a.id, b2.id], bgUrl: `assets/facility/train_${typeof facLv === "function" ? facLv(C(p.city), "train") : 1}.webp`, bgm: "map1", squad: q ? q.icon : null, lines: [
    { who: null, text: `${p.city}의 막사. ${q ? q.name : "같은 부대"} 동료끼리 이야기를 나누고 있다.` },
    { who: a.id, text: plain ? plain[0] : pick(PEER_TOPIC[mood]), voice: null },
    { who: b2.id, text: plain ? plain[1] : lb.t, voice: lb && lb.v ? lb.v : null },
    ...(plain ? [] : [{ who: a.id, text: pick(PEER_REPLY[mood]), voice: null }]),
    { who: null, text: `두 사람과 조금 더 가까워졌다. (친밀 +4)` },
  ] };
}

// 친밀 50 / 부대 재결성 같은 반복형 이벤트
function checkStoryEvents() {
  for (const ev of STORY_EVENTS) {
    if (G.flags["ev_" + ev.id]) continue;
    let ok = false; try { ok = ev.when(); } catch (e) { ok = false; }
    if (!ok) continue;
    G.flags["ev_" + ev.id] = true;
    if (ev.effect) ev.effect();
    const lines = ev.lines().filter(Boolean);
    G.queue.push({ type: "dialog", lines, bg: ev.bg || "city", bgm: ev.bgm });
    if (ev.id === "signal3" && P().fac) G.queue.push({ type: "routeChoice", advise: !isLord(P()) });
    else if (ev.id === "signal3") { addMerit(P(), 40); G.queue.push({ type: "dialog", bg: "story_signal", lines: [{ who: P().id, text: "어느 깃발 아래에도 서지 않은 나라도… 그 말만큼은 지키고 싶어. 함께 살 수 있는 길을 찾을 거야.", voice: "SearchEnd" }, { who: null, text: "재야의 다짐 — 공적 +40" }] }); }
  }
  const p = P();
  // 월별 VN 예산: 반복형 이벤트는 한 달에 최대 2편(세력 행사는 결과 VN까지 2편). 초과분은 조건이 남아 있으면 다음 달에 다시 뜬다
  let budget = 2 - G.queue.filter((x) => x.type === "dialog").length;
  if (G.queue.some((x) => x.type === "dialog" && x.bg && String(x.bg).startsWith("story_")) || G.queue.some((x) => x.type === "routeChoice")) budget = 0; // 핵심 서사가 있는 달
  const fe = budget >= 2 && factionEvent(); if (fe) { G.queue.push(fe, { type: "facChoice", kind: G.flags.facEvLast }); budget -= 2; }
  const sc = budget > 0 && squadChat(); if (sc) { G.queue.push(sc); budget--; }
  G.flags.pendingEv = 0; G.flags.pendingList = [];
  // 친밀 50: 개인 대화
  for (const u of Object.values(G.units)) {
    if (!u.alive || u.iron || u.id === p.id || u.bond < 50 || G.flags["bond50_" + u.id]) continue;
    if (budget <= 0) { G.flags.pendingEv++; G.flags.pendingList.push(`${u.name}와의 대화`); break; }
    budget--;
    G.flags["bond50_" + u.id] = true;
    const o = LAO_PC[u.id];
    const ll = lineOf(u.id, false);
    G.queue.push({ type: "dialog", bgUrl: `assets/city/${CITY_BG[u.city] || CITY_BG[p.city]}.jpg`, lines: [
      { who: u.id, text: ll ? ll.t : pick(["요즘 자주 보네. 같이 있으면 마음이 편해.", "다음 작전도 같이 가자. 네가 있으면 든든하거든.", "…고마워. 요즘 너랑 얘기하는 게 제일 즐거워."]), voice: ll && ll.v ? ll.v : "PresentGet" },
      { who: null, text: `${jo(u.name, "와과")}의 사이가 한층 가까워졌다.` },
    ] });
    break;
  }
  // 부대 재결성: 원작 부대원 3명 이상이 플레이어 세력에 모이면
  if (p.fac && !F(p.fac).iron) {
    for (const q of LAO_SQUADS) {
      if (q.members.length < 3 || G.flags["squad_" + q.key]) continue;
      const mine = q.members.filter((m) => G.units[m] && G.units[m].fac === p.fac && G.units[m].alive);
      if (mine.length < Math.min(3, q.members.length)) continue;
      if (budget <= 0) { G.flags.pendingEv++; G.flags.pendingList.push(`부대 재결성 · ${q.name}`); break; }
      G.flags["squad_" + q.key] = true;
      for (const m of mine) { const u = U(m); u.loyal = clamp(u.loyal + 10, 0, 100); }
      addMerit(p, 60);
      log(`부대 재결성 — ${q.name} (${mine.length}명)`, "good");
      G.queue.push({ type: "dialog", bg: "city", squad: q.icon, lines: [
        { who: null, text: `【부대 재결성】 ${q.name}` },
        { who: mine[0], text: `${q.name}, 다시 모였네. 이 멤버라면 무서울 게 없어.`, voice: "SquadJoin" },
        { who: null, text: "같은 부대원끼리 출진하면 ‘부대 결속’ 보너스를 받는다. 충성도가 올랐다." },
      ] });
      break;
    }
  }
}
