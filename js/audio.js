// 라스트오리진 삼국지 — 사운드 (BGM · 효과음 · 캐릭터 보이스)
// 테스트: index.html?mute=1 이면 시작부터 음소거
"use strict";

const Sound = (() => {
  const PREF_KEY = "lao3k_sound_v1";
  const pref = { bgm: 0.45, sfx: 0.7, voice: 0.85, muted: false };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); } catch (e) {}
  if (/[?&]mute=1/.test(location.search)) pref.muted = true;

  const save = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch (e) {} };
  let unlocked = false;
  let bgmEl = null, bgmKey = null, wantKey = null, fadeT = null;
  let voiceEl = null;
  const pool = {};
  const dbg = [];
  const note = (t) => { dbg.unshift(`${new Date().toLocaleTimeString()} ${t}`); if (dbg.length > 12) dbg.length = 12; if (window.__sndPanel) window.__sndPanel(); };

  const MAN = typeof AUDIO_MANIFEST !== "undefined" ? AUDIO_MANIFEST : { voice: {}, csfx: {} };
  const GROUPS = { map: ["map1", "map2", "map3"], tense: ["tense"], battle: ["battle1", "battle2", "battle3", "battle4"], boss: ["boss1", "boss2"] };

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (wantKey) bgm(wantKey, true);
  }
  ["pointerdown", "keydown"].forEach((ev) => window.addEventListener(ev, unlock, { once: false, capture: true }));

  // 페이드는 타이머로 진행한다 (requestAnimationFrame은 탭이 숨겨지거나 렌더링이 밀리면 멈춰 BGM이 무음으로 남는다)
  function fade(el, to, ms, done) {
    if (el.__fade) clearInterval(el.__fade);
    const from = el.volume; const t0 = performance.now();
    el.__fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(el.__fade); el.__fade = null; if (done) done(); }
    }, 30);
  }

  // key: 트랙 이름 또는 그룹(map/battle/boss — 무작위 선택)
  function bgm(key, force) {
    if (GROUPS[key]) key = GROUPS[key].includes(bgmKey) && !force ? bgmKey : GROUPS[key][Math.floor(Math.random() * GROUPS[key].length)];
    wantKey = key;
    if (!unlocked || pref.muted) return;
    if (bgmKey === key && bgmEl && !bgmEl.paused && !force) return;
    const old = bgmEl;
    if (old) fade(old, 0, 600, () => old.pause());
    const el = new Audio(`assets/bgm/${key}.mp3`);
    el.loop = true; el.volume = 0;
    el.play().then(() => fade(el, pref.bgm, 900)).catch(() => {});
    bgmEl = el; bgmKey = key; note(`BGM ▶ ${key}`);
  }

  let ambEl = null, ambKey = null;
  function amb(key) {
    if (ambKey === key && ambEl && !ambEl.paused) return;
    stopAmb();
    ambKey = key; if (!key || pref.muted || !unlocked) return;
    const el = new Audio(`assets/sfx/${key}.mp3`); el.loop = true; el.volume = 0;
    el.play().then(() => fade(el, pref.bgm, 1200)).catch(() => {});
    ambEl = el; note(`환경음 ▶ ${key}`);
  }
  function stopAmb() { if (ambEl) { const o = ambEl; fade(o, 0, 600, () => o.pause()); } ambEl = null; ambKey = null; }

  function stopBgm() { if (bgmEl) { const o = bgmEl; fade(o, 0, 500, () => o.pause()); } bgmEl = null; bgmKey = null; }

  function play(src, vol) {
    note(`${pref.muted ? "(음소거) " : ""}${src.replace("assets/", "")}`);
    if (pref.muted || !unlocked) return null;
    let list = pool[src] || (pool[src] = []);
    let el = list.find((a) => a.paused || a.ended);
    if (!el) { if (list.length >= 4) el = list[0]; else { el = new Audio(src); list.push(el); } }
    try { el.currentTime = 0; } catch (e) {}
    // 동시에 울리는 소리가 많으면 각각을 조금씩 낮춰 합이 클리핑되지 않게 한다 (2개 -2.5dB, 3개 이상 -4dB)
    const busy = Object.values(pool).flat().filter((x) => x !== el && !x.paused && !x.ended).length + (voiceEl && !voiceEl.paused && voiceEl !== el ? 1 : 0);
    const head = busy >= 2 ? 0.63 : busy === 1 ? 0.75 : 1;
    el.volume = Math.max(0, Math.min(1, vol * head));
    el.play().catch(() => {});
    return el;
  }

  const sfx = (name, k = 1) => play(`assets/sfx/${name}.mp3`, pref.sfx * k);

  // 캐릭터 보이스: ev = Join / SortiePick / BattleFocus / SpSkill / MVP / Retreat / Leader / Oath / SearchEnd / ActionApprove ...
  function voice(code, ev, fallbacks = []) {
    const have = MAN.voice[code];
    if (!have) return false;
    const e = [ev, ...fallbacks].find((x) => have.includes(x));
    if (!e) return false;
    if (voiceEl && !voiceEl.paused) voiceEl.pause();
    voiceEl = play(`assets/voice/${code}/${e}.mp3`, pref.voice);
    if (voiceEl && bgmEl) {
      const target = bgmEl, v = pref.bgm;
      fade(target, v * 0.4, 200); note("덕킹: BGM -8dB");
      const restore = () => { if (bgmEl === target) fade(target, pref.bgm, 600); };
      voiceEl.onended = restore; voiceEl.onpause = restore;
    }
    return !!voiceEl;
  }
  const hasVoice = (code) => !!MAN.voice[code];

  // 캐릭터 고유 공격음 (s1 / s2 / die). 없으면 공통음
  function charSfx(code, kind, fallback) {
    const have = MAN.csfx[code];
    if (have && have.includes(kind)) return play(`assets/csfx/${code}/${kind}.mp3`, pref.sfx * 0.8);
    if (fallback) return sfx(fallback);
    return null;
  }

  function setMuted(m) {
    pref.muted = m; save();
    if (m) { if (bgmEl) bgmEl.pause(); if (voiceEl) voiceEl.pause(); if (ambEl) ambEl.pause(); }
    else if (wantKey) { bgmKey = null; bgm(wantKey, true); }
  }
  function setVol(kind, v) {
    pref[kind] = v; save();
    if (kind === "bgm" && bgmEl) bgmEl.volume = v;
  }

  if (/[?&]debug=1/.test(location.search)) window.addEventListener("DOMContentLoaded", () => {
    const p = document.createElement("div"); p.id = "sndDebug"; document.body.append(p);
    let folded = true;
    p.addEventListener("click", (e) => {
      if (e.target.dataset.act === "scen") { e.stopPropagation(); unlock(); const seq = ["title", "map1", "tense", "battle1", "duel", "boss1", "ending"]; seq.forEach((k, i) => setTimeout(() => { bgm(k, true); if (i === seq.length - 1) setTimeout(() => sfx("fanfare"), 3000); }, i * 3000)); return; }
      folded = !folded; window.__sndPanel();
    });
    window.__sndPanel = () => { p.classList.toggle("fold", folded); p.innerHTML = folded ? `🔈 SOUND ${bgmKey || "-"}` : `<b>SOUND</b> bgm=${bgmKey || "-"} want=${wantKey || "-"} muted=${pref.muted} unlocked=${unlocked} <button data-act="scen">시나리오 재생(21초)</button><br>` + dbg.map((x) => `<div>${x}</div>`).join(""); };
    window.__sndPanel();
  });
  // 자동 오디오 검사용 상태 (tools/audio_check.json)
  const state = () => ({ amb: ambKey, ambVol: ambEl ? +ambEl.volume.toFixed(3) : null, bgm: bgmKey, bgmVol: bgmEl ? +bgmEl.volume.toFixed(3) : null, bgmPlaying: !!(bgmEl && !bgmEl.paused), voicePlaying: !!(voiceEl && !voiceEl.paused), unlocked, muted: pref.muted });
  return { bgm, stopBgm, amb, stopAmb, sfx, voice, hasVoice, charSfx, setMuted, setVol, pref, unlock, state, get current() { return bgmKey; } };
})();
