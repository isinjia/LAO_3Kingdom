"""원작 스킬 테이블 → js/skills_data.js (장수별 고유 전법 = 액티브 2번) + 스킬 아이콘
사용: python tools/gen_skills.py"""
import json
import os
import re

from PIL import Image

GD = r"E:/LAO/TAable_BattleRenewal/GameData"
ICON = r"E:/LAO/Google_QA/Assets/AssetBundleResource/Texture/SkillTexture"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "skill")
os.makedirs(OUT, exist_ok=True)

L = {r["Key"]: r.get("Korea") for r in json.load(open(os.path.join(GD, "Table_Localization.json"), encoding="utf-8-sig"))["Table_Localization"]}
sk = {r["Key"]: r for r in next(iter(json.load(open(os.path.join(GD, "Table_Skill.json"), encoding="utf-8-sig")).values()))}
off = open(os.path.join(ROOT, "js", "lao_official.js"), encoding="utf-8").read()
codes = re.findall(r'"((?:3P|AGS|BR|DS|PECS|ST)_[A-Za-z0-9-]+)":\{"n"', off)

def clean(t):
    t = (t or "").replace("\n", " ")
    t = re.sub(r"\{\d+\}%?\s*", "", t)
    return re.sub(r"\s{2,}", " ", t).strip()[:70]

out = {}
icons = set()
for code in codes:
    r = sk.get(f"Skill_{code}_N_2") or sk.get(f"Skill_{code}_N_1")
    if not r:
        continue
    ic = (r.get("SkillIconIDCircle") or "").replace("_acitve", "_active")
    out[code] = {"n": L.get(r["SkillName"]) or "", "t": r["TargetType"], "ic": ic, "d": clean(L.get(r["SkillDescriptionSimple"]))}
    icons.add(ic)
for ic in icons:
    for cand in (ic, ic.replace("_active", "_acitve")):
        p = os.path.join(ICON, cand + ".png")
        if os.path.exists(p):
            Image.open(p).convert("RGBA").resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, ic + ".webp"), "WEBP", quality=90)
            break
js = "// tools/gen_skills.py 가 생성 — 원작 액티브 스킬(고유 전법)\nconst LAO_SKILL = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(os.path.join(ROOT, "js", "skills_data.js"), "w", encoding="utf-8").write(js)
from collections import Counter
print("skills", len(out), "icons", len(os.listdir(OUT)), Counter(v["t"] for v in out.values()))
