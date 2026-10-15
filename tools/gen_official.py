"""tools/lao_data.json(원본 테이블 추출본) → js/lao_official.js (공식 이름·등급·병종·역할·능력·부대)"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, "tools", "lao_data.json"), encoding="utf-8"))
have = {f[:-5] for f in os.listdir(os.path.join(ROOT, "assets", "portrait"))}
EXTRA = {"PECS_LemonadeBeta": "레모네이드 베타", "PECS_LemonadeGamma": "레모네이드 감마",
         "PECS_LemonadeEpsilon": "레모네이드 엡실론", "PECS_Olivia": "올리비아 스타수어"}
pc = {}
for p in d["pc"]:
    code = p["key"][5:-2]
    if not p["key"].endswith("_N") or code not in have or code.startswith(("LC_", "SJ_")):
        continue
    f = lambda v: round(float(v or 0), 3)
    pc[code] = {"n": p["name"], "g": p["grade"], "c": p["cls"], "r": p["role"], "atk": f(p["atk"]), "def": f(p["def"]),
                "hp": f(p["hp"]), "eva": f(p["eva"]), "cri": f(p["cri"]), "spd": f(p["spd"]), "join": p["join"] or ""}
for code, n in EXTRA.items():
    if code in have and code not in pc:
        pc[code] = {"n": n, "g": 5 if "Lemonade" in code else 4, "c": 1, "r": 2, "atk": 60, "def": 18, "hp": 260, "eva": 0.05, "cri": 0.08, "spd": 3.9, "join": ""}
squads = []
for t in d["troop"]:
    mem = [m[5:-2] for m in t["members"] if m[5:-2] in pc]
    squads.append({"key": t["key"], "name": t["name"], "desc": (t["desc"] or "").replace("\r", ""), "icon": t["icon"].replace("UI_TroopIcon_", ""), "members": mem})
js = "// 원본 테이블에서 생성됨 (tools/gen_official.py) — 직접 수정하지 말 것\n"
js += "const LAO_PC = " + json.dumps(pc, ensure_ascii=False, separators=(",", ":")) + ";\n"
js += "const LAO_SQUADS = " + json.dumps(squads, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(os.path.join(ROOT, "js", "lao_official.js"), "w", encoding="utf-8").write(js)
print("pc", len(pc), "squads", len(squads), "in-squad", len({m for s in squads for m in s["members"]}))
