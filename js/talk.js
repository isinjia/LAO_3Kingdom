// 라스트오리진 삼국지 — 교류 대화: 장수와 교류하면 짧은 대화 장면이 열리고, 선택지에 따라 소소한 일이 벌어진다
// officer.js·events.js 뒤에 불러온다. 대사 줄의 choices: [{ t: 문구, sub: 비용 등 짧은 설명, go: () => 이어지는 줄[] }]
//   G.flags.tev   장수별로 마지막으로 본 교류 이벤트 { "장수|이벤트": 월 }
//   G.flags.tevR  최근에 나온 교류 이벤트 (같은 이벤트가 연달아 나오지 않게)
//   G.flags.loan  장수에게 빌려준 자금 { 장수: { g, due } }
"use strict";

const say = (u, text, voice) => ({ who: u.id, text, voice: voice || null });
const narr = (text) => ({ who: null, text });
const ask = (u, text, choices) => ({ who: u ? u.id : null, text, choices });
const likes = (t, ...types) => types.includes(perOf(t).type);
// 친밀을 올리고(내리고) 결과 문구를 돌려준다
function tvBond(t, v) { if (!v) return null; addRel(G.player, t.id, v); return v > 0 ? `${t.name} 친밀 +${v}` : `${t.name}와의 사이가 조금 서먹해졌다`; }
function tvExp(u, s, v) { gainExp(u, s, v); return `${u.id === G.player ? "" : u.name + " "}${STAT_KO[s]} 경험 +${v}`; }
const tvRes = (...parts) => narr(`(${parts.filter(Boolean).join(" · ") || "별일 없이 지나갔다"})`);
const statCheck = (p, t, s, bonus = 0) => chance(clamp(50 + (p.st[s] - t.st[s]) * 1.5 + bonus, 10, 90));
const otherIn = (p, t, f) => unitsIn(p.city).filter((x) => x.id !== p.id && x.id !== t.id && !x.iron && (!f || f(x)));

// 성격별 고민 (상담 이벤트)
const WORRY = {
  용맹: ["요즘 전투가 없어서 몸이 근질근질해. 이러다 감이 무뎌질까 봐 걱정이야.", "지난번에 조금만 더 빨랐으면 한 명이라도 더 구했을 텐데."],
  냉정: ["보급 계산이 자꾸 어긋나. 내가 뭔가 놓치고 있는 것 같아.", "감정 때문에 판단이 흐려진 적이 있어. 다시는 그러고 싶지 않은데."],
  대담: ["이대로 작은 거점이나 지키다 끝나는 건 아닐까 싶어.", "다들 내 계획이 너무 무모하대. …정말 그런가?"],
  신중: ["밤마다 철충이 성벽을 넘는 꿈을 꿔. 대비는 충분한 걸까.", "다음 작전, 아무리 따져 봐도 불안한 구석이 남아."],
  온후: ["부대원끼리 사이가 안 좋아서… 중간에서 어떻게 해야 할지 모르겠어.", "피난민들이 계속 늘어. 다 돌봐 줄 수 없다는 게 마음 아파."],
};
const FOOD = ["주먹밥", "스튜", "쿠키", "샌드위치", "수프", "카레", "구운 감자", "과일 타르트"];

// 일상 대화: 화제를 고르면 성격에 따라 반응이 다르다
const TOPICS = [
  { t: "요즘 훈련은 어때?", like: ["용맹"], ok: ["그 말 기다렸어! 요즘 사격 정확도가 꽤 올랐다고.", "훈련장 기록, 이번 달엔 내가 1등이야."], meh: ["…훈련 얘기는 좀 쉬자. 머리가 아파."] },
  { t: "천하 정세, 어떻게 보고 있어?", like: ["냉정", "대담"], ok: ["좋은 질문이네. 지금 판도라면 다음 해엔 큰 싸움이 날 거야.", "세력끼리 견제하는 지금이 오히려 기회일지도."], meh: ["음… 그런 건 위에서 알아서 하겠지."] },
  { t: "무리하고 있는 거 아니지?", like: ["신중", "온후"], ok: ["…들켰네. 고마워, 오늘은 일찍 쉴게.", "그렇게 물어봐 주는 사람이 있어서 다행이야."], meh: ["나 그렇게 약하지 않아. 걱정 마."] },
  { t: "전쟁이 끝나면 뭐 하고 싶어?", like: ["온후", "대담"], ok: ["바닷가에 작은 가게를 내고 싶어. 웃지 마.", "다들 모아서 큰 잔치를 열 거야. 너도 와야 해."], meh: ["끝난 뒤를 생각하면 지금 칼이 무뎌져."] },
  { t: "다음 작전, 같이 나가자.", like: ["용맹", "대담"], ok: ["좋아! 네 옆이라면 어디든 간다.", "약속이다. 선봉은 내가 설게."], meh: ["…작전은 계획부터 세우고 나서 얘기하자."] },
  { t: "요즘 읽은 책 있어?", like: ["냉정", "신중"], ok: ["구 시대 전술 교범을 찾았어. 빌려줄까?", "폐허 도서관에서 건진 역사책이 꽤 재밌더라."], meh: ["책? 글자만 보면 졸려서…"] },
  { t: "오늘 날씨 좋다.", like: ["온후"], ok: ["그러게. 이런 날은 전쟁 같은 거 잊고 싶어.", "응, 바람이 기분 좋네."], meh: ["날씨 좋은 날엔 적도 잘 보이지."] },
];
function dailyChat(p, t) {
  const l = typeof lineOf === "function" ? lineOf(t.id, true) : null;
  const opts = shuffle(TOPICS.slice()).slice(0, 3);
  return [
    say(t, l ? l.t : pick(["왔어? 마침 심심하던 참이야.", "어, 너구나. 무슨 일 있어?", "잠깐 쉬려던 참인데, 같이 앉을래?"]), l && l.v ? l.v : null),
    ask(p, "(무슨 이야기를 할까?)", opts.map((o) => ({ t: o.t, go: () => {
      const hit = likes(t, ...o.like), clash = PER_CLASH[perOf(t).type] && o.like.includes(PER_CLASH[perOf(t).type]);
      return [say(p, o.t), say(t, pick(hit ? o.ok : clash ? o.meh : o.ok.concat(o.meh))), tvRes(tvBond(t, hit ? 4 : clash ? 0 : 2), hit ? `${t.name}의 성격(${perOf(t).type})에 잘 맞는 화제였다` : null)];
    } }))),
  ];
}

const TALK_EV = {
  // 고민 상담: 성격에 맞는 대답을 하면 크게 가까워진다
  worry: { w: 3, cond: () => true,
    run: (p, t) => {
      const ty = perOf(t).type;
      const good = { 용맹: 2, 대담: 2, 냉정: 1, 신중: 0, 온후: 0 }[ty];
      const a = [["괜찮아, 넌 충분히 잘하고 있어.", "다독인다"], ["하나씩 따져 보자. 원인이 뭔지부터.", "현실적인 조언"], ["혼자 끙끙대지 마. 같이 해결하자.", "함께하자고 한다"]];
      return [say(t, "…있잖아, 잠깐 얘기 좀 들어줄래?"), say(t, pick(WORRY[ty])),
        ask(p, "(뭐라고 해 줄까?)", a.map(([line, lab], k) => ({ t: lab, go: () => [say(p, line),
          k === good ? say(t, pick(["…응. 네 말 들으니까 한결 나아.", "역시 너한테 털어놓길 잘했어.", "고마워. 정말로."])) : say(t, pick(["그렇긴 한데…", "음, 그런가.", "…그래, 생각해 볼게."])),
          tvRes(tvBond(t, k === good ? 7 : 2), k === good ? "마음을 헤아린 대답이었다" : null)] })))];
    } },
  // 대련: 무력 겨루기
  spar: { w: 3, cond: (p, t) => t.st.war >= 40 && p.hp >= 40,
    run: (p, t) => [say(t, pick(["몸 좀 풀 겸 한 판 붙어 볼래? 봐주기 없기.", "요즘 실력이 늘었다며? 직접 확인해 볼까.", "훈련장 비었더라. 대련 한 번 어때?"])),
      ask(p, `(${t.name} 무력 ${t.st.war} / 나 ${p.st.war})`, [
        { t: "전력으로 맞붙는다", sub: "체력 -10", go: () => { const win = statCheck(p, t, "war"); p.hp = clamp(p.hp - 10, 0, 100);
          return win ? [narr("짧고 격렬한 공방 끝에, 상대의 무기가 손에서 튕겨 나갔다."), say(t, "…졌다. 다음엔 안 져!"), tvRes(tvExp(p, "war", 30), tvBond(t, likes(t, "용맹", "대담") ? 6 : 3), "체력 -10")]
            : [narr("한순간의 틈을 찔렸다. 바닥에 등이 닿았다."), say(t, "후후, 아직 멀었네. 그래도 꽤 아팠어."), tvRes(tvExp(p, "war", 40), tvBond(t, 4), "체력 -10")]; } },
        { t: "가볍게 합을 맞춘다", go: () => [narr("서로 자세를 봐 주며 천천히 합을 맞췄다."), say(t, "이런 것도 나쁘지 않네."), tvRes(tvExp(p, "war", 15), tvExp(t, "war", 15), tvBond(t, 3))] },
        { t: "오늘은 사양한다", go: () => [say(p, "오늘은 좀 쉬고 싶어."), say(t, likes(t, "용맹") ? "에이, 김새게." : "그래, 다음에 하자."), tvRes(likes(t, "용맹") ? null : tvBond(t, 1))] },
      ])] },
  // 바둑: 지력 겨루기 — 이길지, 져 줄지
  go: { w: 2, cond: (p, t) => t.st.int >= 45,
    run: (p, t) => [say(t, pick(["바둑판을 구했어. 한 판 둘래?", "머리 쓰는 게임 좋아해? 장기라도 한 판 하자."])),
      ask(p, `(${t.name} 지력 ${t.st.int} / 나 ${p.st.int})`, [
        { t: "진지하게 둔다", go: () => { const win = statCheck(p, t, "int");
          return win ? [narr("마지막 한 수로 대마를 잡았다."), say(t, likes(t, "냉정") ? "…훌륭한 수였어. 복기 좀 같이 하자." : "윽, 분하다! 한 판 더!"), tvRes(tvExp(p, "int", 30), tvBond(t, likes(t, "냉정") ? 6 : 3))]
            : [narr("어느새 판 전체가 상대의 손바닥 위에 있었다."), say(t, "수읽기가 아직 얕네. 그래도 즐거웠어."), tvRes(tvExp(p, "int", 35), tvBond(t, 3))]; } },
        { t: "슬쩍 져 준다", go: () => likes(t, "냉정", "신중")
          ? [narr("일부러 둔 악수를, 상대는 곧바로 알아챘다."), say(t, "…지금 봐준 거지? 그런 거 싫어."), tvRes(tvBond(t, -2))]
          : [narr("아슬아슬하게 져 주었다. 상대는 무척 기뻐했다."), say(t, "이겼다! 오늘 운이 좋은데?"), tvRes(tvBond(t, 5))] },
        { t: "두면서 수다나 떤다", go: () => [narr("판은 엉망이 됐지만 이야기꽃이 피었다."), tvRes(tvBond(t, 3))] },
      ])] },
  // 요리 시식
  cook: { w: 3, cond: () => true,
    run: (p, t) => { const food = pick(FOOD);
      return [say(t, `저기… ${jo(food, "을를")} 만들어 봤는데, 맛 좀 봐 줄래?`), narr(`${t.name}의 ${food}. 모양은… 개성적이다.`),
        ask(p, "(한 입 먹어 보니…)", [
          { t: "맛있다고 한다", go: () => { p.hp = clamp(p.hp + 10, 0, 100); return [say(p, "맛있다! 또 만들어 줘."), say(t, likes(t, "냉정") ? "…정말? 표정이 좀 굳어 있는데." : "정말? 헤헤, 다음엔 더 잘 만들게!"), tvRes(tvBond(t, likes(t, "냉정") ? 2 : 5), "체력 +10")]; } },
          { t: "솔직하게 말한다", go: () => [say(p, "음… 간이 좀 세. 그리고 이건 덜 익었어."), say(t, likes(t, "냉정", "용맹") ? "역시 솔직하네. 그런 말이 도움이 돼." : "으… 그, 그렇구나."), tvRes(tvBond(t, likes(t, "냉정", "용맹") ? 6 : 1))] },
          { t: "같이 다시 만들자고 한다", sub: "자금 30", go: () => { if (p.gold < 30) return [say(p, "재료 살 돈이… 없네."), tvRes(tvBond(t, 1))]; p.gold -= 30; p.hp = clamp(p.hp + 20, 0, 100);
            return [say(p, "재료 사 올게. 같이 만들어 보자."), narr("부엌이 한바탕 난리가 났지만, 두 번째는 제법 먹을 만했다."), tvRes(tvBond(t, 6), "자금 -30", "체력 +20")]; } },
        ])]; } },
  // 부탁: 자금을 빌려 달라 (나중에 갚는다)
  loan: { w: 2, cond: (p, t) => p.gold >= 150 && !(G.flags.loan || {})[t.id],
    run: (p, t) => { const g = pick([60, 80, 100, 120]);
      return [say(t, pick(["저… 정말 미안한데, 부탁 하나만 해도 될까?", "말 꺼내기 민망한데… 급한 일이 생겨서."])), say(t, `${pick(["장비 부품", "부대원 약값", "고향에 보낼 물자", "망가진 무기 수리비"])} 때문에 ${g}만 빌려줄 수 있을까? 꼭 갚을게.`),
        ask(p, `(개인 자금 ${p.gold})`, [
          { t: "빌려준다", sub: `자금 -${g}`, go: () => { p.gold -= g; (G.flags.loan ||= {})[t.id] = { g, due: monthIdx() + rnd(1, 3) }; return [say(p, "필요하면 써. 천천히 갚아."), say(t, "고마워! 이 은혜는 안 잊을게."), tvRes(tvBond(t, 6), `자금 -${g}`)]; } },
          { t: "빌려주지 않고 준다", sub: `자금 -${g}`, go: () => { p.gold -= g; return [say(p, "갚을 필요 없어. 그냥 받아."), say(t, "…정말? 너, 사람이 너무 좋은 거 아니야?"), tvRes(tvBond(t, 10), `자금 -${g}`)]; } },
          { t: "미안하다고 한다", go: () => [say(p, "미안, 나도 지금 여유가 없어."), say(t, "아냐, 괜히 말 꺼냈네. 신경 쓰지 마.")] },
        ])]; } },
  // 빌려준 돈을 갚으러 온다 (조건이 맞으면 먼저 나온다)
  repay: { w: 0, cond: (p, t) => { const l = (G.flags.loan || {})[t.id]; return l && monthIdx() >= l.due; },
    run: (p, t) => { const l = G.flags.loan[t.id]; delete G.flags.loan[t.id]; const back = Math.round(l.g * 1.3); p.gold += back;
      const extra = chance(30) && typeof randItem === "function" ? randItem([80, 20, 0, 0]) : null;
      if (extra) gainItem(extra, `${t.name}의 보답`);
      return [say(t, "아, 마침 잘 왔다! 지난번에 빌린 거 갚을게."), say(t, `조금 보탰어. 이자라고 생각해.${extra ? " 그리고 이것도 받아." : ""}`), tvRes(`자금 +${back}`, tvBond(t, 3), extra ? "장비를 받았다" : null)]; } },
  // 산책
  walk: { w: 3, cond: () => true,
    run: (p, t) => [say(t, pick(["바람 쐬러 나갈 건데 같이 갈래?", "잠깐 걷자. 계속 앉아 있었더니 다리가 저려."])),
      ask(p, "(어디로 갈까?)", [
        { t: "강가를 걷는다", go: () => { p.hp = clamp(p.hp + 15, 0, 100); return [narr("강물 소리를 들으며 천천히 걸었다. 오랜만에 마음이 가라앉는다."), say(t, "…이런 시간, 자주 있으면 좋겠다."), tvRes(tvBond(t, likes(t, "온후", "신중") ? 5 : 3), "체력 +15")]; } },
        { t: "시장 구경을 간다", sub: "자금 40", go: () => { if (p.gold < 40) return [narr("주머니가 가벼워 구경만 했다."), tvRes(tvBond(t, 2))]; p.gold -= 40;
          return [narr("노점에서 꼬치를 사 들고 이것저것 구경했다."), say(t, `${pick(["이 머리끈 예쁘다… 사 준다고? 진짜?", "와, 이거 맛있다! 하나 더!", "구 시대 장난감이네. 신기해."])}`), tvRes(tvBond(t, 6), "자금 -40")]; } },
        { t: "폐허를 뒤져 본다", go: () => { const r = rnd(1, 100);
          if (r <= 25 && typeof randItem === "function") { const k = randItem([70, 26, 4, 0]); gainItem(k, "폐허 산책"); return [narr("무너진 창고 안쪽에서 쓸 만한 장비를 찾았다!"), say(t, "오, 운 좋은데?"), tvRes(tvBond(t, 3), "장비를 얻었다")]; }
          if (r <= 60) { const g = rnd(30, 90); p.gold += g; return [narr("녹슨 금고에서 구 시대 화폐를 찾았다."), tvRes(`자금 +${g}`, tvBond(t, 3))]; }
          if (r <= 80) { p.hp = clamp(p.hp - 10, 0, 100); return [narr("발밑이 무너져 굴러떨어졌다!"), say(t, "괜찮아?! …푸흡, 미안, 웃으면 안 되는데."), tvRes("체력 -10", tvBond(t, 4))]; }
          return [narr("먼지만 잔뜩 뒤집어썼다."), say(t, "다음엔 그냥 강가로 가자."), tvRes(tvBond(t, 2))]; } },
      ])] },
  // 밤하늘
  stars: { w: 2, cond: () => true,
    run: (p, t) => [narr(`${p.city}의 밤. 성벽 위에서 ${jo(t.name, "와과")} 나란히 앉았다.`), say(t, "철충이 없던 시절에도 별은 이렇게 많았을까."),
      ask(p, "(무슨 이야기를 할까?)", [
        { t: "사령관님 이야기", go: () => [say(p, "사령관님도 어딘가에서 같은 별을 보고 계실까."), say(t, "…분명 그럴 거야. 그러니까 우리가 잘 버텨야지."), tvRes(tvBond(t, 4), t.fac && t.fac === p.fac ? (t.loyal = clamp(t.loyal + 2, 0, 100), `${t.name} 충성 +2`) : null)] },
        { t: "전쟁이 끝난 뒤의 꿈", go: () => [say(p, "다 끝나면, 너는 뭐 하고 싶어?"), say(t, pick(["아무 일도 안 하고 하루 종일 잘 거야.", "모두랑 같이 여행을 가고 싶어. 진짜 여행.", "…아직 모르겠어. 그래서 살아남고 싶은 걸지도."])), tvRes(tvBond(t, 5), tvExp(p, "cha", 15))] },
        { t: "말없이 함께 본다", go: () => [narr("한참 동안 아무 말도 하지 않았다. 그래도 어색하지 않았다."), tvRes(tvBond(t, likes(t, "신중", "냉정") ? 6 : 3))] },
      ])] },
  // 다른 장수 소문
  gossip: { w: 2, cond: (p, t) => Object.values(G.units).some((x) => x.alive && !x.iron && x.id !== p.id && x.id !== t.id && x.fac),
    run: (p, t) => { const x = pick(Object.values(G.units).filter((x) => x.alive && !x.iron && x.id !== p.id && x.id !== t.id && x.fac));
      const f = F(x.fac);
      return [say(t, `그거 들었어? ${f.name}의 ${jo(x.name, "이가")} ${pick(["요즘 밤마다 혼자 훈련한대.", "군주랑 크게 다퉜다던데.", "엄청난 장비를 손에 넣었다나 봐.", "몰래 편지를 주고받는 사람이 있대."])}`),
        ask(p, "(어떻게 반응할까?)", [
          { t: "자세히 묻는다", go: () => { x.met = true; perOf(x);
            return [say(t, `내가 아는 건… ${x.name}는 ${perOf(x).type}한 성격이고, ${x.city}에 있어. ${x.fac === p.fac ? `충성은 ${x.loyal} 정도라던데.` : `${f.name}에서 ${rankName(x)} 자리에 있대.`}`), tvRes(`${x.name}의 사정을 알게 되었다`, tvBond(t, 2))]; } },
          { t: "소개해 달라고 한다", go: () => { x.met = true; addRel(G.player, x.id, 4); return [say(t, "좋아, 다음에 만나면 네 얘기 잘 해 둘게."), tvRes(`${x.name} 친밀 +4`, tvBond(t, 2))]; } },
          { t: "남 얘기는 그만하자", go: () => [say(p, "남 얘기는 그만하자. 듣는 사람 없을 때 하는 말은 돌고 돌아."), say(t, likes(t, "온후", "신중") ? "…맞아. 내가 경솔했네." : "에이, 재미없게."), tvRes(tvBond(t, likes(t, "온후", "신중") ? 5 : 0))] },
        ])]; } },
  // 다툼 중재: 같은 거점에 사이가 나쁜 장수가 있으면
  quarrel: { w: 4, cond: (p, t) => otherIn(p, t, (x) => relOf(t.id, x.id) <= -10).length > 0,
    run: (p, t) => { const y = otherIn(p, t, (x) => relOf(t.id, x.id) <= -10).sort((a, b) => relOf(t.id, a.id) - relOf(t.id, b.id))[0];
      return [narr(`복도에서 ${jo(t.name, "와과")} ${jo(y.name, "이가")} 언성을 높이고 있다.`), say(t, pick(["작전 때 네가 멋대로 움직여서 다 꼬였잖아!", "내 장비에 손대지 말라고 몇 번을 말했어?"])), say(y, pick(["그건 네가 신호를 늦게 줬으니까 그렇지!", "누가 손댔다고 그래? 증거 있어?"])),
        ask(p, `(${jo(t.name, "와과")} ${y.name}의 사이: ${relStage(relOf(t.id, y.id))})`, [
          { t: `${t.name} 편을 든다`, go: () => { addRel(t.id, y.id, -5); addRel(G.player, y.id, -4); return [say(p, `이번엔 ${t.name} 말이 맞아.`), say(y, "…흥, 둘이 한편이구나."), tvRes(tvBond(t, 6), `${jo(y.name, "와과")}의 사이가 나빠졌다`)]; } },
          { t: `${y.name} 편을 든다`, go: () => { addRel(t.id, y.id, -5); addRel(G.player, y.id, 6); return [say(p, `${t.name}, 이번엔 네가 좀 지나쳤어.`), say(t, "…너까지 그러기야?"), tvRes(`${y.name} 친밀 +6`, tvBond(t, -4))]; } },
          { t: "둘을 중재한다", sub: `매력 ${p.st.cha}`, go: () => { const ok = chance(clamp(25 + p.st.cha * 0.6, 20, 90));
            if (ok) { addRel(t.id, y.id, 20); addRel(G.player, y.id, 3); return [say(p, "둘 다 그만. 같은 편끼리 싸워서 좋아할 건 철충뿐이야."), say(y, "…미안. 내가 좀 예민했어."), say(t, "나도. 다음 작전 땐 신호 확실히 줄게."), tvRes(`두 사람이 화해했다`, tvBond(t, 3), `${y.name} 친밀 +3`, tvExp(p, "cha", 25))]; }
            return [say(p, "자, 자, 진정하고…"), narr("두 사람은 동시에 고개를 홱 돌리고 가 버렸다."), tvRes(tvExp(p, "cha", 15))]; } },
        ])]; } },
  // 가르침 요청: 내가 더 잘하는 능력을 배우고 싶어 한다
  teach: { w: 3, cond: (p, t) => STATS.some((s) => p.st[s] >= t.st[s] + 10),
    run: (p, t) => { const s = STATS.filter((s) => p.st[s] >= t.st[s] + 10).sort((a, b) => (p.st[b] - t.st[b]) - (p.st[a] - t.st[a]))[0];
      return [say(t, `저기, ${STAT_KO[s]} 쪽은 네가 훨씬 낫잖아. 요령 좀 알려 줄 수 있어?`),
        ask(p, `(${STAT_KO[s]} — 나 ${p.st[s]} / ${t.name} ${t.st[s]})`, [
          { t: "제대로 가르쳐 준다", go: () => [narr("해가 질 때까지 붙어 앉아 하나하나 짚어 주었다."), say(t, "와… 이제야 감이 와. 고마워, 선생님!"), tvRes(tvExp(t, s, 50), tvExp(p, s, 10), tvBond(t, 5))] },
          { t: "책 한 권 건네준다", go: () => [say(p, "이거 읽어 봐. 내가 배운 건 다 여기 있어."), tvRes(tvExp(t, s, 25), tvBond(t, 2))] },
          { t: "스스로 깨쳐야 한다고 한다", go: () => [say(p, "그건 직접 부딪쳐 봐야 알아."), say(t, likes(t, "용맹", "대담") ? "흥, 좋아. 보란 듯이 해낼게." : "…치사해."), tvRes(likes(t, "용맹", "대담") ? tvExp(t, s, 15) : tvBond(t, -1))] },
        ])]; } },
  // 비결 전수: 상대가 더 잘하는 능력을 배운다
  learn: { w: 3, cond: (p, t) => STATS.some((s) => t.st[s] >= p.st[s] + 10),
    run: (p, t) => { const s = STATS.filter((s) => t.st[s] >= p.st[s] + 10).sort((a, b) => (t.st[b] - p.st[b]) - (t.st[a] - p.st[a]))[0];
      return [say(t, `${STAT_KO[s]} 말인데, 너 자세가 좀 이상하더라. 내가 봐 줄까?`),
        ask(p, `(${STAT_KO[s]} — ${t.name} ${t.st[s]} / 나 ${p.st[s]})`, [
          { t: "부탁한다", go: () => [narr("호된 지적이 이어졌다. 그래도 하나같이 정확했다."), say(t, "그렇지, 지금 그거야! 잊지 마."), tvRes(tvExp(p, s, 40), tvBond(t, 3))] },
          { t: "대신 밥을 산다", sub: "자금 50", go: () => { if (p.gold < 50) return [say(p, "…밥은 다음에 살게."), tvRes(tvExp(p, s, 30), tvBond(t, 1))]; p.gold -= 50; return [say(p, "끝나고 내가 밥 살게."), say(t, "오, 그럼 특별 과외다!"), tvRes(tvExp(p, s, 55), tvBond(t, 5), "자금 -50")]; } },
          { t: "괜찮다고 한다", go: () => [say(p, "괜찮아, 내 방식대로 할게."), say(t, "그래? 뭐, 마음 바뀌면 말해.")] },
        ])]; } },
  // 동전 내기
  bet: { w: 2, cond: (p) => p.gold >= 50,
    run: (p, t) => [say(t, pick(["심심한데 내기 하나 할래? 동전 던지기, 50 걸고.", "운 시험해 볼까? 앞이냐 뒤냐."])),
      ask(p, `(개인 자금 ${p.gold})`, [
        ...["앞면", "뒷면"].map((side) => ({ t: `${side}에 건다`, sub: "자금 50", go: () => { const win = chance(50);
          p.gold += win ? 50 : -50;
          return [narr(`동전이 허공에서 빙글빙글 돌다 떨어졌다. …${win ? side : side === "앞면" ? "뒷면" : "앞면"}!`), say(t, win ? "으악, 내 돈!" : "아싸! 오늘 저녁은 내가 산다… 네 돈으로."), tvRes(win ? "자금 +50" : "자금 -50", tvBond(t, win ? 2 : 4))]; } })),
        { t: "도박은 안 한다", go: () => [say(p, "난 그런 거 안 해."), say(t, likes(t, "신중", "온후") ? "…사실 나도. 떠본 거야." : "쳇, 재미없어."), tvRes(likes(t, "신중", "온후") ? tvBond(t, 3) : null)] },
      ])] },
  // 작은 선물: 친한 장수가 먼저 무언가를 건넨다
  present: { w: 3, cond: (p, t) => t.bond >= 45,
    run: (p, t) => { const kind = pick(["gold", "item", "food"]);
      const what = kind === "gold" ? "작은 주머니" : kind === "item" ? "손질해 둔 장비" : "직접 싼 도시락";
      return [say(t, pick(["이거… 받아. 그냥, 주고 싶어서.", "지난번에 고마웠어. 별건 아닌데.", "지나가다 보니까 네 생각이 나서."])), narr(`${jo(t.name, "이가")} ${jo(what, "을를")} 내밀었다.`),
        ask(p, "(어떻게 할까?)", [
          { t: "고맙게 받는다", go: () => { let r;
            if (kind === "gold") { const g = rnd(60, 150); p.gold += g; r = `자금 +${g}`; }
            else if (kind === "item" && typeof randItem === "function") { gainItem(randItem([60, 35, 5, 0]), `${t.name}의 선물`); r = "장비를 받았다"; }
            else { p.hp = clamp(p.hp + 25, 0, 100); r = "체력 +25"; }
            return [say(p, "고마워. 소중히 할게."), say(t, "헤헤… 다행이다."), tvRes(r, tvBond(t, 3))]; } },
          { t: "답례로 선물한다", sub: "자금 60", go: () => { if (p.gold < 60) return [say(p, "고마워. 답례는 꼭 할게."), tvRes(tvBond(t, 3))]; p.gold -= 60; return [say(p, "나도 줄 게 있어. 자, 이거."), say(t, "…어? 바꾸려고 한 거 아니었는데. 고마워."), tvRes(tvBond(t, 8), "자금 -60")]; } },
          { t: "마음만 받는다", go: () => [say(p, "마음만 받을게. 너한테 더 필요할 거야."), say(t, perOf(t).gi >= 60 ? "…그런 점이 좋아." : "에이, 섭섭하게."), tvRes(tvBond(t, perOf(t).gi >= 60 ? 5 : 1))] },
        ])]; } },
  // 노래
  song: { w: 2, cond: () => true,
    run: (p, t) => [narr(`어디선가 콧노래가 들린다. ${jo(t.name, "이가")} 무기를 손질하며 흥얼거리고 있다.`), say(t, "…어, 들었어? 부끄럽게."),
      ask(p, "(어떻게 할까?)", [
        { t: "박수를 친다", go: () => [say(p, "잘 부르는데? 한 곡 더!"), say(t, "정말? …그럼 딱 한 곡만이야."), tvRes(tvBond(t, 4))] },
        { t: "같이 부른다", go: () => { const ok = p.st.cha >= 50 || chance(50);
          return ok ? [narr("두 목소리가 어울려 막사 밖까지 퍼졌다. 지나가던 병사들이 박수를 쳤다."), tvRes(tvBond(t, 6), tvExp(p, "cha", 20))]
            : [narr("…음이 완전히 엇나갔다. 둘 다 웃음이 터졌다."), say(t, "푸하하! 너 노래는 하지 마!"), tvRes(tvBond(t, 5))]; } },
        { t: "모른 척 지나간다", go: () => [narr("못 들은 척 발걸음을 옮겼다. 뒤에서 노래가 다시 이어졌다."), tvRes(tvBond(t, likes(t, "신중", "냉정") ? 3 : 1))] },
      ])] },
  // 악몽
  nightmare: { w: 2, cond: () => true,
    run: (p, t) => [narr(`${t.name}의 눈 밑이 거뭇하다.`), say(t, "…요즘 잠을 잘 못 자. 같은 꿈을 계속 꿔. 다들 사라지는 꿈."),
      ask(p, "(어떻게 할까?)", [
        { t: "이야기를 들어 준다", go: () => [narr("한참을 들었다. 말할수록 목소리가 차분해졌다."), say(t, "…말하고 나니까 좀 낫다."), tvRes(tvBond(t, likes(t, "온후", "신중") ? 7 : 4))] },
        { t: "땀 흘려서 잊자고 한다", go: () => [say(p, "그럴 땐 몸을 움직이는 게 최고야. 가자, 훈련장."), say(t, likes(t, "용맹", "대담") ? "…좋아! 오늘은 녹초가 될 때까지다." : "지금? …하아, 알았어."), tvRes(tvExp(p, "war", 15), tvExp(t, "war", 15), tvBond(t, likes(t, "용맹", "대담") ? 6 : 2))] },
        { t: "따뜻한 차를 끓여 준다", go: () => { t.hp = clamp((t.hp || 100) + 15, 0, 100); return [narr("김이 오르는 찻잔을 두 손으로 감싸 쥐었다."), say(t, "따뜻하다… 고마워."), tvRes(tvBond(t, 5))]; } },
      ])] },
  // 철충의 상처
  scars: { w: 2, cond: () => true,
    run: (p, t) => [say(t, pick(["이 흉터? 철충 놈들한테 당한 거야. 그날 부대 절반을 잃었어.", "가끔 그날 생각이 나. 철충이 처음 몰려온 날."])),
      ask(p, "(뭐라고 할까?)", [
        { t: "꼭 되갚아 주자", go: () => [say(p, "그 빚, 반드시 같이 갚아 주자."), say(t, likes(t, "용맹", "대담") ? "…그래. 그 말 기다렸어." : "복수만 생각하면 또 잃게 될 거야."), tvRes(tvBond(t, likes(t, "용맹", "대담") ? 6 : 1))] },
        { t: "살아남은 게 중요하다", go: () => [say(p, "그래도 네가 살아남았잖아. 그게 제일 중요해."), say(t, likes(t, "온후", "신중") ? "…응. 살아남은 사람이 기억해야지." : "살아남은 게 다는 아니야."), tvRes(tvBond(t, likes(t, "온후", "신중") ? 6 : 2))] },
        { t: "철충의 습성을 묻는다", go: () => [say(t, "놈들은 측면이 약해. 그리고 지휘 개체를 잃으면 흩어지지."), tvRes(tvExp(p, "int", 20), tvExp(p, "ldr", 15), tvBond(t, 2))] },
      ])] },
  // 야망: 큰 꿈을 털어놓는다 — 군주라면 조심해야 할 이야기
  ambition: { w: 2, cond: (p, t) => perOf(t).amb >= 65 && !isLord(t),
    run: (p, t) => { const lordMe = isLord(p) && t.fac === p.fac;
      return [say(t, "있잖아… 가끔 생각해. 언젠가 내 깃발을 올리는 날이 올까 하고."), lordMe ? narr("(군주 앞에서 할 말은 아니다. 상대도 말해 놓고 아차 하는 얼굴이다.)") : null,
        ask(p, `(${t.name} 야망 ${perOf(t).amb} · 의리 ${perOf(t).gi})`, [
          { t: "그 꿈을 응원한다", go: () => { if (lordMe) t.loyal = clamp(t.loyal - 5, 0, 100);
            return [say(p, "너라면 할 수 있어. 응원할게."), say(t, "…진심이야? 고마워. 그 말 잊지 않을게."), tvRes(tvBond(t, 7), lordMe ? `${t.name} 충성 -5` : null)]; } },
          { t: "지금 자리에서 힘쓰자고 한다", go: () => { const g = perOf(t).gi >= 55; if (t.fac && t.fac === p.fac) t.loyal = clamp(t.loyal + (g ? 6 : 1), 0, 100);
            return [say(p, "꿈은 좋지만, 지금은 함께 이 땅을 지키는 게 먼저야."), say(t, g ? "…맞아. 의리를 저버릴 순 없지." : "…그래, 지금은."), tvRes(tvBond(t, g ? 3 : 0), t.fac && t.fac === p.fac ? `${t.name} 충성 +${g ? 6 : 1}` : null)]; } },
          { t: "웃어넘긴다", go: () => [say(p, "하하, 그럼 그때 나한테 장군 자리 하나 줘."), say(t, "후후, 생각해 볼게."), tvRes(tvBond(t, 2))] },
        ].filter(Boolean))].filter(Boolean); } },
  // 사관 고민: 재야 장수가 갈 곳을 묻는다
  career: { w: 4, cond: (p, t) => !t.fac && !t.iron,
    run: (p, t) => { const mine = p.fac && F(p.fac);
      return [say(t, "요즘 고민이야. 계속 떠돌 수도 없고… 어느 깃발 아래로 가야 할까."),
        ask(p, "(뭐라고 할까?)", [
          mine ? { t: `${mine.name}에 오라고 권한다`, sub: `가능성 약 ${Math.max(5, recruitChance(p, t) - 10)}%`, go: () => {
            if (chance(Math.max(5, recruitChance(p, t) - 10))) { actRecruit(t.id, "debateWon"); return [say(t, "…좋아. 네가 있는 곳이라면 믿어 볼게."), tvRes(`${jo(t.name, "이가")} ${mine.name}에 합류했다`)]; }
            return [say(t, "솔깃하긴 한데… 조금만 더 생각해 볼게."), tvRes(tvBond(t, 4))]; } } : null,
          { t: "직접 보고 고르라고 한다", go: () => [say(p, "소문만 믿지 말고, 각 세력을 직접 보고 골라."), say(t, "그렇지. 고마워, 머리가 좀 정리됐어."), tvRes(tvBond(t, 4), tvExp(p, "int", 10))] },
          { t: "재야도 나쁘지 않다고 한다", go: () => [say(p, "누구 밑에도 안 들어가는 것도 하나의 길이야."), say(t, perOf(t).amb >= 60 ? "…그렇지? 나도 그렇게 생각했어!" : "음, 그건 좀 외롭던데."), tvRes(tvBond(t, perOf(t).amb >= 60 ? 6 : 2))] },
        ].filter(Boolean))]; } },
  // 길고양이
  cat: { w: 2, cond: () => true,
    run: (p, t) => [narr("발치에서 야옹, 소리가 났다. 마른 새끼 고양이 한 마리."), say(t, "어머, 배고픈가 봐…"),
      ask(p, "(어떻게 할까?)", [
        { t: "거두어 키우자고 한다", go: () => { (G.flags.cats ||= {})[t.id] = (G.flags.cats[t.id] || 0) + 1; return [say(p, "막사에서 같이 키우자."), say(t, "정말? 이름은 내가 지을래! …음, 철충이 어때?"), say(p, "그건 좀…"), tvRes(tvBond(t, 6), `${p.city} 막사에 고양이가 생겼다`)]; } },
        { t: "먹이만 준다", go: () => [narr("남은 육포를 잘게 찢어 주었다. 고양이는 정신없이 먹었다."), tvRes(tvBond(t, 3))] },
        { t: "그냥 지나친다", go: () => [say(t, "…매정하긴."), tvRes(tvBond(t, likes(t, "냉정") ? 1 : -1))] },
      ])] },
  // 길 잃은 아이
  child: { w: 2, cond: (p) => !C(p.city).owner || !F(C(p.city).owner).iron,
    run: (p, t) => [narr("거리 한복판에서 아이가 울고 있다. 부모를 잃어버린 모양이다."), say(t, "어떡하지… 그냥 둘 수는 없잖아."),
      ask(p, "(어떻게 할까?)", [
        { t: "함께 부모를 찾아 준다", go: () => { addMerit(p, 15); if (typeof fameAdd === "function") fameAdd("협객"); return [narr("해 질 녘이 되어서야 시장 끝에서 아이의 어머니를 찾았다."), say(t, "…다행이다. 오늘 하루 정말 보람 있었어."), tvRes(tvBond(t, 5), "명성 +15", tvExp(p, "cha", 15))]; } },
        { t: "경비대에 데려다준다", go: () => [narr("경비대 초소에 아이를 맡겼다."), tvRes(tvBond(t, 2))] },
        { t: "간식을 사 주며 달랜다", sub: "자금 20", go: () => { const paid = p.gold >= 20; if (paid) p.gold -= 20; return [narr(paid ? "사탕을 받은 아이가 울음을 그쳤다. 곧 부모가 달려왔다." : "주머니가 비어 우스운 표정만 지어 보였다. 그래도 아이는 웃었고, 곧 부모가 달려왔다."), say(t, "너, 아이 달래는 데 소질 있다?"), tvRes(tvBond(t, 4), paid ? "자금 -20" : null)]; } },
      ])] },
  // 한잔
  drink: { w: 3, cond: () => true,
    run: (p, t) => [say(t, pick(["오늘 일 끝나고 한잔 어때?", "고생했어. 차라도 한 잔 하고 가."])),
      ask(p, `(개인 자금 ${p.gold})`, [
        { t: "내가 산다", sub: "자금 40", go: () => { if (p.gold < 40) return [say(p, "…아, 지갑을 두고 왔다."), say(t, "뭐야, 결국 내가 사는 거야?"), tvRes(tvBond(t, 2))]; p.gold -= 40;
          return [narr("잔이 몇 번 오가자 평소엔 하지 않던 이야기들이 나왔다."), say(t, pick(["사실 나, 처음엔 네가 좀 무서웠어.", "여기 오기 전엔 매일 혼자였어. 지금은… 좋아.", "다음엔 내가 살게. 진짜야."])), tvRes(tvBond(t, 7), "자금 -40")]; } },
        { t: "각자 계산한다", sub: "자금 20", go: () => { const paid = p.gold >= 20; if (paid) p.gold -= 20; return [narr("가볍게 한 잔씩 하고 헤어졌다."), tvRes(tvBond(t, 3), paid ? "자금 -20" : null)]; } },
        { t: "오늘은 일이 있다고 한다", go: () => [say(t, "그래, 바쁘구나. 다음엔 꼭이다?"), tvRes(tvBond(t, 1))] },
      ])] },
  // 서먹한 사이: 적대가 쌓인 장수와 화해를 시도한다 (조건이 맞으면 먼저 나온다)
  reconcile: { w: 0, cond: (p, t) => (t.feud || 0) >= 15,
    run: (p, t) => [say(t, pick(["…무슨 일이야. 할 말 있으면 빨리 해.", "너랑 할 얘기 없는데."])), narr(`${t.name}의 태도가 차갑다. (적대 ${t.feud})`),
      ask(p, "(어떻게 할까?)", [
        { t: "먼저 사과한다", go: () => { t.feud = Math.max(0, t.feud - 15); return [say(p, "지난 일은 미안했어. 진심이야."), say(t, likes(t, "온후", "신중") ? "…알았어. 나도 고집부렸지." : "…사과는 받아 둘게. 아직 다 풀린 건 아니야."), tvRes(`적대 -15`, tvBond(t, likes(t, "온후", "신중") ? 3 : 0))]; } },
        { t: "당당하게 맞선다", go: () => { const r = likes(t, "용맹", "대담"); t.feud = clamp(t.feud + (r ? -10 : 6), 0, 100);
          return [say(p, "난 내가 틀렸다고 생각 안 해. 불만 있으면 정면으로 말해."), say(t, r ? "…하, 그 배짱은 마음에 드네." : "역시 말이 안 통하네."), tvRes(r ? "적대 -10" : "적대 +6")]; } },
        { t: "선물로 마음을 푼다", sub: "자금 100", go: () => { if (p.gold < 100) return [say(p, "…다음에 다시 얘기하자."), tvRes()]; p.gold -= 100; t.feud = Math.max(0, t.feud - 25);
          return [say(p, "이거 받아. 화해의 뜻이야."), say(t, "…이런 걸로 풀릴 줄 알고. …고맙긴 하네."), tvRes("적대 -25", tvBond(t, 2), "자금 -100")]; } },
      ])] },
  // 장비 정비
  repair: { w: 2, cond: () => true,
    run: (p, t) => [narr(`${jo(t.name, "이가")} 바닥에 부품을 잔뜩 늘어놓고 끙끙대고 있다.`), say(t, "이 나사 하나가 도무지 안 맞아… 손 좀 빌려줄래?"),
      ask(p, "(어떻게 할까?)", [
        { t: "같이 정비한다", go: () => [narr("기름때투성이가 되어 마지막 부품을 끼웠다. 철컥, 경쾌한 소리."), say(t, "됐다! 역시 둘이 하니까 빠르네."), tvRes(tvExp(p, "int", 20), tvBond(t, 4))] },
        { t: "내 무기도 맡긴다", go: () => [say(p, "대신 내 것도 좀 봐 줄래?"), say(t, "어디 보자… 조준기가 틀어졌네. 금방 고쳐 줄게."), tvRes(tvExp(p, "war", 20), tvBond(t, 2))] },
        { t: "공방 기술자를 소개한다", go: () => [say(p, "그건 전문가한테 맡기자. 아는 사람 있어."), tvRes(tvBond(t, 2))] },
      ])] },
  // 약속: 아주 가까운 사이에서 한 번
  promise: { w: 4, cond: (p, t) => t.bond >= 70 && !(G.flags.promise || {})[t.id],
    run: (p, t) => [narr("전투를 앞둔 밤. 막사 밖은 조용하다."), say(t, "…있잖아. 이 싸움이 다 끝나면, 그때도 내 옆에 있어 줄 거지?"),
      ask(p, "(대답은…)", [
        { t: "약속한다", go: () => { (G.flags.promise ||= {})[t.id] = 1; chron(`${jo(t.name, "와과")} 약속`); return [say(p, "약속할게. 끝나도, 그 뒤에도."), say(t, "…응. 그럼 나도 절대 안 쓰러질게."), tvRes(tvBond(t, 10), "평생의 약속을 나눴다")]; } },
        { t: "장난스럽게 넘긴다", go: () => [say(p, "그건 네가 살아남아서 다시 물어봐."), say(t, "…치, 꼭 살아남아서 다시 물어볼 거야."), tvRes(tvBond(t, 4))] },
      ])] },
  // 공을 칭찬받는다: 같은 세력의 상관
  praise: { w: 2, cond: (p, t) => p.fac && t.fac === p.fac && (isLord(t) || isGov(t) || rankOf(t) > rankOf(p)),
    run: (p, t) => [say(t, pick(["요즘 활약, 다 듣고 있다. 잘하고 있어.", "네 덕에 일이 한결 수월해졌다."]), "ActionApprove"),
      ask(p, "(어떻게 대답할까?)", [
        { t: "모두의 덕이라고 한다", go: () => [say(p, "저 혼자 한 게 아닙니다. 다들 애써 준 덕분입니다."), say(t, "겸손하군. 그래서 더 믿음이 가."), tvRes(tvBond(t, 4), tvExp(p, "cha", 20))] },
        { t: "당연하다고 한다", go: () => { addMerit(p, 20); return [say(p, "당연하죠. 더 큰 일도 맡겨 주십시오."), say(t, likes(t, "용맹", "대담") ? "하하, 그 기백 좋다! 기대하지." : "…자신감이 넘치는군."), tvRes("공적 +20", tvBond(t, likes(t, "용맹", "대담") ? 4 : 0))]; } },
        { t: "부족한 점을 묻는다", go: () => { const s = STATS.reduce((a, b) => (p.st[a] <= p.st[b] ? a : b)); return [say(p, "제게 부족한 점이 있다면 말씀해 주십시오."), say(t, `굳이 꼽자면 ${STAT_KO[s]} 쪽이지. 그쪽을 더 다듬어 봐.`), tvRes(tvExp(p, s, 30), tvBond(t, 2))]; } },
      ])] },
  // 다른 세력 장수가 말실수를 한다
  slip: { w: 2, cond: (p, t) => p.fac && t.fac && t.fac !== p.fac && !F(t.fac).iron,
    run: (p, t) => { const f = F(t.fac); const cs = citiesOf(f.key); const c = pick(cs);
      return [say(t, `요즘 ${f.name}도 사정이 말이 아니야. ${c ? c.name : "본거지"} 쪽은 특히…`), narr("말끝을 흐린다. 뭔가 더 알 수 있을 것 같다."),
        ask(p, `(${t.name}의 소속: ${f.name})`, [
          { t: "슬쩍 캐묻는다", sub: `지력 ${p.st.int}`, go: () => { if (c && statCheck(p, t, "int", 10)) return [say(t, `…${c.name}에 병력이 ${fmt(c.troops)} 정도밖에 없다고. 아, 이건 비밀이야!`), tvRes(`${c.name}의 병력을 알아냈다`, tvExp(p, "int", 20))];
            t.feud = clamp((t.feud || 0) + 6, 0, 100); return [say(t, "…지금 나한테서 정보 빼내려는 거야?"), tvRes("의심을 샀다 (적대 +6)")]; } },
          { t: "못 들은 척한다", go: () => [say(p, "어디나 힘들지. 오늘은 그냥 쉬어."), say(t, "…고마워. 네가 그런 사람이라 다행이야."), tvRes(tvBond(t, perOf(t).gi >= 50 ? 6 : 3))] },
          { t: "우리 쪽으로 오라고 떠본다", go: () => { const ok = t.loyal < 50 && chance(30 + t.bond / 3);
            if (ok) { addRel(G.player, t.id, 3); return [say(t, "…솔직히, 생각 안 해 본 건 아니야."), tvRes(tvBond(t, 0), `${t.name}의 마음이 흔들린다 (충성 ${t.loyal})`)]; }
            return [say(t, "농담이라도 그런 말은 하지 마."), tvRes(perOf(t).gi >= 60 ? tvBond(t, -2) : null)]; } },
        ])]; } },
  // 부대 추억: 같은 원작 부대원
  squad: { w: 3, cond: (p, t) => t.squad && p.squad === t.squad,
    run: (p, t) => [say(t, `${squadName(t)} 시절 생각나? 그때 다 같이 밤새 보초 서던 거.`),
      ask(p, "(어떤 추억을 꺼낼까?)", [
        { t: "첫 출격 이야기", go: () => [say(p, "첫 출격 때 너 다리 엄청 떨었잖아."), say(t, "그, 그건 추워서 그런 거라니까!"), tvRes(tvBond(t, 5))] },
        { t: "떠난 동료 이야기", go: () => [say(p, "…그때 함께였던 애들, 다 어디 있을까."), say(t, "어딘가에서 살아 있을 거야. 언젠가 다시 모이자."), tvRes(tvBond(t, 4), t.fac === p.fac ? (t.loyal = clamp(t.loyal + 3, 0, 100), `${t.name} 충성 +3`) : null)] },
        { t: "부대 구호를 외친다", go: () => [narr(`둘이 동시에 ${squadName(t)}의 구호를 외쳤다. 근처 병사들이 깜짝 놀랐다.`), say(t, "아하하! 아직 안 잊었네!"), tvRes(tvBond(t, 6))] },
      ])] },
};

// 교류 장면: 이벤트를 하나 고르거나 일상 대화를 한다
function talkScene(t) {
  const p = P(); if (!t || t.iron || !p.alive) return;
  const now = monthIdx(); const seen = (G.flags.tev ||= {}); const recent = (G.flags.tevR ||= []);
  const ok = Object.entries(TALK_EV).filter(([k, ev]) => (seen[t.id + "|" + k] == null || now - seen[t.id + "|" + k] >= 12) && !recent.includes(k) && (() => { try { return ev.cond(p, t); } catch (e) { return false; } })());
  const urgent = ok.filter(([, ev]) => !ev.w); // 빚 갚기·화해는 먼저
  let sel = urgent.length ? pick(urgent) : null;
  if (!sel && ok.length && chance(65)) {
    let r = Math.random() * ok.reduce((s, [, ev]) => s + ev.w, 0);
    for (const x of ok) { r -= x[1].w; if (r <= 0) { sel = x; break; } }
    sel ||= ok[ok.length - 1];
  }
  let lines;
  if (sel) {
    const [k, ev] = sel; seen[t.id + "|" + k] = now; recent.push(k); if (recent.length > 4) recent.shift();
    lines = ev.run(p, t);
  } else lines = dailyChat(p, t);
  const c = C(p.city);
  G.queue.push({ type: "dialog", bgUrl: `assets/city/${CITY_BG[p.city] || CITY_BG[c && c.name]}.jpg`, lines: lines.filter(Boolean) });
}
