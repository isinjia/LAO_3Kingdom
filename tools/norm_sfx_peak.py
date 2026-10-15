"""짧은 효과음은 통합 음량(LUFS) 측정이 게이팅 때문에 낮게 나온다. 순간 음량(M) 최댓값을 -12 LUFS에 맞추고 true peak -1dB로 제한한다.
사용: python tools/norm_sfx_peak.py  (assets/sfx 대상, 처리 결과는 tools/.sfxpeak_done에 기록)"""
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DONE = os.path.join(ROOT, "tools", ".sfxpeak_done")
TARGET = -12.0
done = set(open(DONE, encoding="utf-8").read().split("\n")) if os.path.exists(DONE) else set()


def mmax(p):
    r = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-i", p, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    vals = [float(x) for x in re.findall(r"M:\s*(-?[\d.]+)", r.stderr)]
    return max(vals) if vals else None


out = []
d = os.path.join(ROOT, "assets", "sfx")
for f in sorted(os.listdir(d)):
    if not f.endswith(".mp3") or f in done:
        continue
    p = os.path.join(d, f)
    m = mmax(p)
    if m is None:
        continue
    gain = max(-8.0, min(10.0, TARGET - m))
    tmp = p[:-4] + ".tmp.mp3"
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", p, "-af", f"volume={gain:.1f}dB,alimiter=limit=0.89:level=false", "-b:a", "96k", "-ar", "44100", tmp], stdin=subprocess.DEVNULL)
    if os.path.exists(tmp) and os.path.getsize(tmp) > 500:
        os.replace(tmp, p)
        out.append(f)
        print(f"{f:24s} M-max {m:6.1f} -> gain {gain:+.1f} dB")
with open(DONE, "a", encoding="utf-8") as fh:
    fh.write("\n".join(out) + "\n")
