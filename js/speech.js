// 라스트오리진 삼국지 — 말투와 호칭: 원작 대본에서 뽑은 장수별 말씨(LAO_SPEECH)·서로 부르는 호칭(LAO_REL)으로 대사를 맞춘다
// speech_data.js 뒤, talk.js 앞에 불러온다
//   대사는 S(반말, 해요체, 하십시오체) 세 벌로 쓴다. 군대식(임다)은 하십시오체에서, 하게체는 반말에서 바꿔 만든다
//   대사 안의 {너} = 듣는 사람을 부르는 말, {너|을를} = 조사까지, {사령관} = 말하는 사람이 사령관을 부르는 말
//   {남:장수코드} / {남:장수코드|이가} = 말하는 사람이 그 장수를 부르는 말
"use strict";

const S = (b, y, h) => ({ b, y: y == null ? b : y, h: h == null ? (y == null ? b : y) : h });
const SP = (id) => (typeof LAO_SPEECH !== "undefined" && LAO_SPEECH[id]) || { s: "b", pr: "나", cmd: "", tt: "", sig: [] };
const REL = (a, b) => (typeof LAO_REL !== "undefined" && LAO_REL[a + "|" + b]) || null;

// 말씨: 그 상대에게 원작에서 쓴 말씨가 있으면 그것, 없으면 기본 말씨
function styleOf(a, b) {
  const r = b && REL(a.id, b.id);
  return (r && r.s) || SP(a.id).s;
}
const POLITE = (s) => s === "y" || s === "h" || s === "m";
// 호칭: 원작에서 그 상대를 부른 말 → 없으면 이름(존댓말이면 즐겨 붙이는 「씨·양·님」, 군주에게는 「님」)
function callOf(a, b) {
  if (!a || !b) return b ? b.name : "";
  const r = REL(a.id, b.id); if (r) return r.f;
  const sp = SP(a.id);
  if (b.fac && a.fac === b.fac && typeof isLord === "function" && isLord(b) && POLITE(styleOf(a, b))) return `${b.name} 님`;
  if (sp.tt && POLITE(sp.s)) return `${b.name} ${sp.tt}`;
  return b.name;
}

// 하십시오체 → 군대식 (습니다→슴다, 입니다→임다, 합니다→함다, 습니까→슴까, 십시오→십쇼)
function toArmy(t) {
  return t.replace(/습니다/g, "슴다").replace(/습니까/g, "슴까").replace(/십시오/g, "십쇼")
    .replace(/([가-힣])니(다|까)/g, (m, ch, e) => { const o = ch.charCodeAt(0) - 0xac00; return o >= 0 && o < 11172 && o % 28 === 17 ? String.fromCharCode(ch.charCodeAt(0) - 1) + e : m; });
}
// 반말 → 하게체 (말끝 몇 가지만: 거야→걸세, 이야→일세, 있어→있네, 했어→했네, 겠어→겠네, 하자→하세, 줘→주게)
function toHage(t) {
  return t.replace(/거야([.!?…]|$)/g, "걸세$1").replace(/([가-힣])이야([.!?…]|$)/g, "$1일세$2")
    .replace(/(있|없|했|겠|였|었|았)어([.!?…]|$)/g, "$1네$2").replace(/(하|가|보|먹|쉬)자([.!?…]|$)/g, (m, a, e) => ({ 하: "하세", 가: "가세", 보: "보세", 먹: "먹세", 쉬: "쉬세" })[a] + e)
    .replace(/줘([.!?…]|$)/g, "주게$1").replace(/좋아([.!?…]|$)/g, "좋네$1").replace(/고마워([.!?…]|$)/g, "고맙네$1").replace(/미안해([.!?…]|$)/g, "미안하네$1")
    .replace(/어때\?/g, "어떤가?").replace(/을(래|까)\?/g, "겠나?").replace(/을게([.!?…]|$)/g, "겠네$1").replace(/거지\?/g, "것이지?").replace(/([가-힣])(래|까)\?/g, (m, ch, e) => dropL(ch) ? dropL(ch) + "겠나?" : m) // 줄래?→주겠나? 될까?→되겠나?
    .replace(/([가-힣])게([.!?…]|$)/g, (m, ch, e) => dropL(ch) ? dropL(ch) + "겠네" + e : m); // 할게→하겠네
}
// ㄹ 받침을 뗀 글자 (받침이 ㄹ이 아니면 null)
function dropL(ch) { const o = ch.charCodeAt(0) - 0xac00; return o >= 0 && o < 11172 && o % 28 === 8 ? String.fromCharCode(ch.charCodeAt(0) - 8) : null;
}
// 1인칭: 원작에서 「짐」「소첩」「본 공주」 따위를 즐겨 쓰는 장수
const PRON_SWAP = {
  짐: [[/(^|[^가-힣])나는/g, "$1짐은"], [/(^|[^가-힣])내가/g, "$1짐이"], [/(^|[^가-힣])나도/g, "$1짐도"], [/(^|[^가-힣])나를/g, "$1짐을"], [/(^|[^가-힣])나한테/g, "$1짐에게"], [/(^|[^가-힣])내 /g, "$1짐의 "]],
  소첩: [[/(^|[^가-힣])저는/g, "$1소첩은"], [/(^|[^가-힣])제가/g, "$1소첩이"], [/(^|[^가-힣])저도/g, "$1소첩도"], [/(^|[^가-힣])저를/g, "$1소첩을"], [/(^|[^가-힣])제 /g, "$1소첩의 "]],
  "본 공주": [[/(^|[^가-힣])나는/g, "$1본 공주는"], [/(^|[^가-힣])내가/g, "$1본 공주가"], [/(^|[^가-힣])나도/g, "$1본 공주도"], [/(^|[^가-힣])저는/g, "$1본 공주는"], [/(^|[^가-힣])제가/g, "$1본 공주가"]],
  "이 몸": [[/(^|[^가-힣])나는/g, "$1이 몸은"], [/(^|[^가-힣])내가/g, "$1이 몸이"], [/(^|[^가-힣])나도/g, "$1이 몸도"]],
};
// 원작에서 서로 자주 부른 사이일수록 처음부터 가깝다 (양방향 호칭 횟수 합)
function origTie(a, b) {
  const n = ((REL(a, b) || {}).n || 0) + ((REL(b, a) || {}).n || 0);
  return n >= 60 ? 20 : n >= 25 ? 14 : n >= 10 ? 8 : n >= 4 ? 4 : 0;
}
// 대사 한 벌을 말하는 사람·듣는 사람에 맞춰 문자열로
function speak(a, b, v) {
  if (v == null) return "";
  if (typeof v === "string") v = S(v);
  const s = styleOf(a, b);
  let t = s === "y" ? v.y : s === "h" ? v.h : s === "m" ? toArmy(v.h) : s === "g" ? toHage(v.b) : v.b;
  const pr = PRON_SWAP[SP(a.id).pr]; if (pr) for (const [re, to] of pr) t = t.replace(re, to);
  return t.replace(/\{(너|사령관|남:[A-Za-z0-9_-]+)(?:\|([^}]+))?\}/g, (m, k, josa) => {
    let w;
    if (k === "너") w = callOf(a, b);
    else if (k === "사령관") w = SP(a.id).cmd || "사령관님";
    else { const o = U(k.slice(2)); w = o ? callOf(a, o) : ""; }
    if (!josa) return w;
    const two = { 이랑: ["이랑", "랑"], 이라면: ["이라면", "라면"] }[josa];
    if (!two) return jo(w, josa);
    const ch = w.charCodeAt(w.length - 1); const jong = ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 : /[lmnr]$/i.test(w) ? 1 : 0;
    return w + (jong ? two[0] : two[1]);
  });
}
