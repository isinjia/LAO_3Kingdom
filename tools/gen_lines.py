"""원작 로비 대사(LobbyScript) + 대응 보이스 → js/lines_data.js, assets/voice/<code>/Idle_*.mp3
사용: python tools/gen_lines.py"""
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor

GD = r"E:/LAO/TAable_BattleRenewal/GameData"
SND = r"E:/LAO/Google_QA/Assets/AssetBundleResource/Sounds/Voice"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

L = {r["Key"]: r.get("Korea") for r in json.load(open(os.path.join(GD, "Table_Localization.json"), encoding="utf-8-sig"))["Table_Localization"]}
rows = next(iter(json.load(open(os.path.join(GD, "Table_LobbyScript.json"), encoding="utf-8-sig")).values()))
off = open(os.path.join(ROOT, "js", "lao_official.js"), encoding="utf-8").read()
codes = set(re.findall(r'"((?:3P|AGS|BR|DS|PECS|ST)_[A-Za-z0-9-]+)":\{"n"', off))

out, jobs = {}, []
for r in rows:
    m = re.match(r"^LobbyScript_((?:3P|AGS|BR|DS|PECS|ST)_[A-Za-z0-9-]+)$", r["Key"])
    if not m or m.group(1) not in codes:
        continue
    code = m.group(1)
    seen, lines = set(), []
    for n in range(1, 5):
        for key, voice in zip(r.get(f"LobbyScript{n}") or [], r.get(f"LobbyScript{n}VoiceName") or []):
            t = (L.get(str(key)) or "").replace("&n", " ").replace("\n", " ").strip()
            t = re.sub(r"\s{2,}", " ", t)
            if not t or t in seen or len(t) > 90:
                continue
            seen.add(t)
            vm = re.search(r"_(Idle_\d+_\d+)$", voice or "")
            ev = vm.group(1) if vm else None
            if ev:
                src = os.path.join(SND, code.split("_", 1)[1], (voice or "") + ".mp3")
                dst = os.path.join(ROOT, "assets", "voice", code, ev + ".mp3")
                if os.path.exists(src):
                    jobs.append((src, dst))
                else:
                    ev = None
            # 사령관을 직접 부르는 대사인지 표시 (부대원끼리 대화에서는 피한다)
            lines.append({"t": t, "v": ev, "c": 1 if re.search(r"사령관|각하|주인님|주군|오빠|당신", t) else 0})
    if lines:
        out[code] = lines

def ff(job):
    src, dst = job
    if os.path.exists(dst):
        return True
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    return subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", src, "-vn", "-b:a", "48k", "-ar", "44100", "-ac", "1", dst],
                          stdin=subprocess.DEVNULL).returncode == 0

with ThreadPoolExecutor(8) as ex:
    ok = sum(ex.map(ff, jobs))
js = "// tools/gen_lines.py 가 생성 — 원작 로비 대사 (t: 대사, v: 보이스 이벤트, c: 사령관을 직접 부름)\nconst LAO_LINES = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(os.path.join(ROOT, "js", "lines_data.js"), "w", encoding="utf-8").write(js)
# 보이스 매니페스트에 Idle 이벤트 추가
mp = os.path.join(ROOT, "js", "audio_manifest.js")
man = json.loads(open(mp, encoding="utf-8").read().split("=", 1)[1].strip().rstrip(";"))
for code, ls in out.items():
    have = man["voice"].setdefault(code, [])
    for l in ls:
        if l["v"] and l["v"] not in have and os.path.exists(os.path.join(ROOT, "assets", "voice", code, l["v"] + ".mp3")):
            have.append(l["v"])
open(mp, "w", encoding="utf-8").write("// tools/build_audio.py + gen_lines.py 가 생성\nconst AUDIO_MANIFEST = " + json.dumps(man, separators=(",", ":")) + ";\n")
print("chars", len(out), "lines", sum(len(v) for v in out.values()), "voices", ok, "/", len(jobs))
