"""js/sd 에 있는 리그 중 게임 코드와 같은 id 를 js/sd_map.js 로 등록한다 (SD 리그 추가 후 실행)."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sd = os.path.join(ROOT, "js", "sd")
ids = {f[:-3] for f in os.listdir(sd) if f.endswith(".js") and ".a" not in f[:-3][-4:]}
ids = {i for i in ids if os.path.exists(os.path.join(sd, i + ".a50.webp"))}
off = open(os.path.join(ROOT, "js", "lao_official.js"), encoding="utf-8").read()
codes = set(re.findall(r'"((?:3P|AGS|BR|DS|PECS|ST)_[A-Za-z0-9-]+)":\{"n"', off))
m = {c: c for c in sorted(codes & ids)}
open(os.path.join(ROOT, "js", "sd_map.js"), "w", encoding="utf-8").write(
    "// tools/gen_sdmap.py 가 생성 — 게임 코드와 같은 id 의 SD 리그\nconst SD_MAP_BUILT = " + json.dumps(m) + ";\n")
print("mapped", len(m))
