"""실제 믹스 렌더링 검사 — 게임과 같은 볼륨 비율(BGM 0.45 · 효과음 0.7 · 보이스 0.85, 보이스 중 BGM ×0.4)로
BGM 위에 효과음·보이스를 얹어 렌더링하고 들리는지(마스킹)·클리핑·곡 간 음량 차이·장면별 에너지를 측정한다.
사용: python tools/mix_check.py   (결과 표 출력, 렌더링 샘플은 tools/.mix/ 에 남김 — 직접 들어볼 수 있다)"""
import os
import re
import sys
sys.stdout.reconfigure(encoding="utf-8")
import subprocess
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", ".mix")
os.makedirs(OUT, exist_ok=True)
A = lambda *p: os.path.join(ROOT, "assets", *p)
BGM_V, SFX_V, VOICE_V, DUCK = 0.45, 0.7, 0.85, 0.4


def ff(args):
    return subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", *args], capture_output=True, text=True, stdin=subprocess.DEVNULL).stderr


def loud(path, start=None, dur=None):
    """통합 음량(I), 순간 음량 최댓값(M), true peak"""
    pre = (["-ss", str(start)] if start is not None else []) + (["-t", str(dur)] if dur else [])
    e = ff([*pre, "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"])
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", e)
    M = [float(x) for x in re.findall(r"M:\s*(-?[\d.]+)", e)]
    P = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)
    return (float(I[-1]) if I else None, max(M) if M else None, float(P[-1]) if P else None)


def band_ratio(mix, bgm_only, start, dur, lo, hi):
    """대역별(lo~hi Hz) 효과음 구간의 음량이 BGM만 있을 때보다 얼마나 큰지(dB) — 마스킹 지표"""
    def rms(p):
        e = ff(["-ss", str(start), "-t", str(dur), "-i", p, "-af", f"highpass=f={lo},lowpass=f={hi},astats=metadata=0", "-f", "null", "-"])
        v = re.findall(r"RMS level dB:\s+(-?[\d.inf]+)", e)
        return float(v[-1]) if v and v[-1] not in ("-inf", "inf") else -120.0
    return rms(mix) - rms(bgm_only)


def render(bgm, overlays, name, dur=8.0, duck=False):
    """bgm 위에 overlays=[(파일, 시작초, 볼륨)]를 얹는다. duck=True면 보이스 구간 동안 BGM ×0.4"""
    ins = ["-ss", "20", "-t", str(dur), "-i", bgm]
    fl = [f"[0:a]volume={BGM_V}[b0]"]
    for i, (f, t, v) in enumerate(overlays, 1):
        ins += ["-i", f]
        fl.append(f"[{i}:a]volume={v},adelay={int(t * 1000)}|{int(t * 1000)},apad=whole_dur={dur}[o{i}]")
    if duck and overlays:
        t0 = overlays[0][1]
        fl[0] = f"[0:a]volume={BGM_V},volume=enable='gte(t,{t0})':volume={DUCK}[b0]"
    mixin = "[b0]" + "".join(f"[o{i}]" for i in range(1, len(overlays) + 1))
    fl.append(f"{mixin}amix=inputs={len(overlays) + 1}:normalize=0:duration=first[m]")
    out = os.path.join(OUT, name + ".wav")
    ff([*ins, "-filter_complex", ";".join(fl), "-map", "[m]", "-ar", "44100", "-y", out])
    base = os.path.join(OUT, name + "_bgm.wav")
    ff(["-ss", "20", "-t", str(dur), "-i", bgm, "-af", f"volume={BGM_V}" + (f",volume=enable='gte(t,{overlays[0][1]})':volume={DUCK}" if duck and overlays else ""), "-ar", "44100", "-y", base])
    return out, base


rows, fails = [], []
# 1) 곡 간 음량 차이 (곡 사이 이동 시 튀지 않는가)
tracks = sorted(f[:-4] for f in os.listdir(A("bgm")) if f.endswith(".mp3"))
bl = {t: loud(A("bgm", t + ".mp3"))[0] for t in tracks}
spread = max(bl.values()) - min(bl.values())
rows.append(("곡 간 통합 음량 편차", f"{spread:.1f} LU", "≤ 3 LU", spread <= 3))

# 2) 장면별 에너지: 전투·보스곡이 지도곡보다 격렬한가 (짧은 구간 음량 변동 LRA와 고역 에너지로 근사)
def energy(t):
    e = ff(["-i", A("bgm", t + ".mp3"), "-t", "60", "-af", "highpass=f=2000,astats=metadata=0", "-f", "null", "-"])
    v = re.findall(r"RMS level dB:\s+(-?[\d.]+)", e)
    return float(v[-1]) if v else -99
en = {t: energy(t) for t in tracks}
mapE = sum(en[t] for t in tracks if t.startswith("map")) / max(1, len([t for t in tracks if t.startswith("map")]))
batE = sum(en[t] for t in tracks if t.startswith(("battle", "boss"))) / max(1, len([t for t in tracks if t.startswith(("battle", "boss"))]))
rows.append(("전투·보스곡 고역 에너지 - 지도곡", f"{batE - mapE:+.1f} dB", "> 0 (전투가 더 격렬)", batE - mapE > 0))

# 3) 효과음이 BGM에 묻히지 않는가 — 가장 시끄러운 전투곡 위에 타격·클릭·폭발을 얹어 렌더링
loudest_battle = max((t for t in tracks if t.startswith(("battle", "boss"))), key=lambda t: bl[t])
for s, v in (("hit", SFX_V * 0.8), ("click", SFX_V * 0.5), ("hitbig", SFX_V * 0.8), ("boom", SFX_V * 0.8), ("skillcharge", SFX_V * 0.7)):
    mix, base = render(A("bgm", loudest_battle + ".mp3"), [(A("sfx", s + ".mp3"), 2.0, v)], f"sfx_{s}")
    d = loud(mix, 2.0, 0.6)[1] - loud(base, 2.0, 0.6)[1]
    mid = band_ratio(mix, base, 2.0, 0.4, 1000, 6000)
    ok = d >= 2.0 or mid >= 4.0
    rows.append((f"효과음 「{s}」 ({loudest_battle} 위)", f"순간음량 +{d:.1f} LU · 1-6kHz +{mid:.1f} dB", "+2 LU 또는 중고역 +4 dB 이상", ok))

# 4) 보이스가 덕킹된 BGM 위에서 또렷한가 (지도곡 · 전투곡)
vdir = A("voice", "BR_Leona")
vf = os.path.join(vdir, "Join.mp3") if os.path.exists(os.path.join(vdir, "Join.mp3")) else os.path.join(vdir, sorted(os.listdir(vdir))[0])
for t in ("map1", loudest_battle):
    mix, base = render(A("bgm", t + ".mp3"), [(vf, 1.0, VOICE_V)], f"voice_{t}", dur=7.0, duck=True)
    d = loud(mix, 1.0, 3.0)[0] - loud(base, 1.0, 3.0)[0]
    rows.append((f"보이스 명료도 ({t}, 덕킹)", f"+{d:.1f} LU", "≥ +6 LU", d >= 6))

# 5) 클리핑: 가장 시끄러운 조합(보스곡 + 폭발 + 보이스 + 타격). 게임의 동시 재생 감쇠(audio.js play: 2개째 ×0.75, 3개째 이상 ×0.63)를 그대로 적용
mix, _ = render(A("bgm", "boss2.mp3" if "boss2" in tracks else loudest_battle + ".mp3"), [(A("sfx", "bigboom.mp3"), 1.0, SFX_V), (vf, 1.2, VOICE_V * 0.75), (A("sfx", "hitbig.mp3"), 1.4, SFX_V * 0.8 * 0.63)], "worst_case", dur=6.0)
pk = loud(mix)[2]
rows.append(("최악 조합 피크 (보스곡+폭발+보이스+타격)", f"{pk:.1f} dBFS", "< 0 dBFS (클리핑 없음)", pk is not None and pk < 0))

w = max(len(r[0]) for r in rows)
for name, val, crit, ok in rows:
    print(f"{'OK  ' if ok else 'FAIL'} {name.ljust(w)}  {val:28s} 기준 {crit}")
    if not ok:
        fails.append(name)
json.dump([{"항목": r[0], "값": r[1], "기준": r[2], "통과": r[3]} for r in rows], open(os.path.join(OUT, "result.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("믹스 검사", "통과" if not fails else f"실패 {len(fails)}건", f"· 렌더링 샘플: {OUT}")
raise SystemExit(1 if fails else 0)
