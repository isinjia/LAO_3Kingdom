"""보이스·효과음 음량을 -16 LUFS(효과음 -14)로 맞춘다 (ffmpeg loudnorm, 제자리 교체). 처리한 파일은 .norm 목록에 기록해 다시 하지 않는다.
사용: python tools/norm_audio.py"""
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DONE = os.path.join(ROOT, "tools", ".norm_done")
done = set(open(DONE, encoding="utf-8").read().split("\n")) if os.path.exists(DONE) else set()
jobs = []
for sub, lufs, rate in (("voice", -16, "48k"), ("csfx", -15, "64k"), ("sfx", -14, "96k"), ("bgm", -18, "128k")):
    for d, _, fs in os.walk(os.path.join(ROOT, "assets", sub)):
        for f in fs:
            if f.endswith(".mp3"):
                p = os.path.join(d, f)
                if os.path.relpath(p, ROOT) not in done:
                    jobs.append((p, lufs, rate))

def norm(j):
    p, lufs, rate = j
    tmp = p[:-4] + ".tmp.mp3"
    r = subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", p, "-af", f"loudnorm=I={lufs}:TP=-1.5:LRA=11", "-b:a", rate, "-ar", "44100", tmp], stdin=subprocess.DEVNULL)
    if r.returncode == 0 and os.path.exists(tmp) and os.path.getsize(tmp) > 500:
        os.replace(tmp, p)
        return os.path.relpath(p, ROOT)
    if os.path.exists(tmp):
        os.remove(tmp)
    return None

with ThreadPoolExecutor(8) as ex:
    ok = [x for x in ex.map(norm, jobs) if x]
with open(DONE, "a", encoding="utf-8") as f:
    f.write("\n".join(ok) + "\n")
print("normalized", len(ok), "/", len(jobs))
