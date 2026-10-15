// 라스트오리진 삼국지 — 장비(보물): 원작 칩·전투 시스템·보조장비
"use strict";

const SLOT_KO = { chip: "회로 칩", system: "전투 시스템", sub: "보조장비" };
const TIER_ORDER = ["RE", "MP", "SP", "EX"];
const TIER_CLS = { RE: "tRE", MP: "tMP", SP: "tSP", EX: "tEX" };

function eqOf(u) { return (u.eq ||= { chip: null, system: null, sub: null }); }
// 장비로 오른 능력치 (표시·단련 계산용; 실제 능력치에는 이미 합산되어 있다)
function eqBonus(u, stat) {
  const eq = u.eq; if (!eq) return 0;
  let v = 0; for (const s in eq) { const it = eq[s] && EQUIP[eq[s]]; if (it && it.st === stat) v += it.v; }
  return v;
}
const baseStat = (u, stat) => u.st[stat] - eqBonus(u, stat);
// 원작 설명의 {0} 같은 수치 자리는 지운다
const itemDesc = (it) => (it.d || "").replace(/\{\d+\}%?/g, "").replace(/\s*:\s*$/, "").replace(/\s{2,}/g, " ").trim();

// 등급 가중치로 무작위 장비 (w = [RE, MP, SP, EX])
function randItem(w = [60, 30, 9, 1]) {
  const sum = w.reduce((a, b) => a + b, 0); let r = Math.random() * sum, ti = 0;
  for (; ti < 4; ti++) { r -= w[ti]; if (r < 0) break; }
  const tier = TIER_ORDER[Math.min(3, ti)];
  const keys = Object.keys(EQUIP).filter((k) => EQUIP[k].t === tier);
  return pick(keys);
}

function equipItem(u, key) {
  const it = EQUIP[key]; if (!it) return;
  const eq = eqOf(u);
  if (eq[it.s]) unequipItem(u, it.s, u.id === G.player);
  eq[it.s] = key;
  u.st[it.st] += it.v;
  if (u.id === G.player) { const i = G.inv.indexOf(key); if (i >= 0) G.inv.splice(i, 1); }
}

function unequipItem(u, slot, toInv) {
  const eq = eqOf(u); const key = eq[slot]; if (!key) return;
  const it = EQUIP[key];
  u.st[it.st] = Math.max(1, u.st[it.st] - it.v);
  eq[slot] = null;
  if (toInv) G.inv.push(key);
}

function gainItem(key, why) {
  if (!key) return;
  G.inv.push(key);
  G.queue.push({ type: "item", key, why });
  log(`장비 획득: ${EQUIP[key].n}${why ? ` (${why})` : ""}`, "good");
}

// 하사: 인벤토리의 장비를 다른 장수에게 내려 준다 (친밀·충성 상승)
function giftItem(id, key) {
  const t = U(id); const p = P();
  if (!t || t.city !== p.city || t.iron || !G.inv.includes(key)) return;
  G.inv.splice(G.inv.indexOf(key), 1);
  const it = EQUIP[key]; const eq = eqOf(t);
  const old = eq[it.s];
  if (old && TIER_ORDER.indexOf(EQUIP[old].t) >= TIER_ORDER.indexOf(it.t)) { G.inv.push(key); notify("하사 거절", `${t.name}: "지금 쓰는 ${EQUIP[old].n} 쪽이 더 좋아요."`, t.id); return; }
  if (old) unequipItem(t, it.s, false); // 기존 장비는 대상이 보관
  eq[it.s] = key; t.st[it.st] += it.v;
  const gb = 6 + TIER_ORDER.indexOf(it.t) * 5;
  t.bond = clamp(t.bond + gb, 0, 100); t.loyal = clamp(t.loyal + 8, 0, 100);
  G.toast = { text: `${t.name}에게 ${it.n} 하사 — 친밀 +${gb}`, kind: "bond" };
  log(`${t.name}에게 ${it.n} 하사.`, "good");
  if (t.bond >= 100 && !t.sworn) actTalkOath(t);
}
function actTalkOath(t) {
  t.sworn = true;
  notify("결의", `${jo(t.name, "와과")} 깊은 신뢰를 쌓아 의자매의 연을 맺었다!\n앞으로 거병·독립 시 함께한다.`, t.id, "Oath", "rankup2");
}

// 새 게임: NPC 장수에게 등급에 맞는 장비를 나눠 준다
function seedEquipment() {
  for (const u of Object.values(G.units)) {
    if (u.iron || u.id === G.player) continue;
    const lord = isLord(u);
    const w = lord ? [0, 10, 50, 40] : u.grade >= 5 ? [10, 40, 40, 10] : u.grade === 4 ? [35, 45, 18, 2] : [70, 25, 5, 0];
    const n = lord ? 3 : chance(55) ? (chance(30) ? 2 : 1) : 0;
    const slots = shuffle(["chip", "system", "sub"]).slice(0, n);
    for (const s of slots) {
      let k = randItem(w), guard = 0;
      while (EQUIP[k].s !== s && guard++ < 20) k = randItem(w);
      if (EQUIP[k].s === s) equipItem(u, k);
    }
  }
}
