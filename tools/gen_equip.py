"""원작 장비 테이블 + 아이콘 → js/equip_data.js, assets/equip/*.webp
사용: python tools/gen_equip.py"""
import json
import os
import re

from PIL import Image

GD = r"E:/LAO/TAable_BattleRenewal/GameData"
ICON = r"E:/LAO/Google_QA/Assets/AssetBundleResourceSub/Texture/EquipIcon"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "equip")
os.makedirs(OUT, exist_ok=True)

rows = next(iter(json.load(open(os.path.join(GD, "Table_ItemEquip.json"), encoding="utf-8-sig")).values()))
L = {r["Key"]: r.get("Korea") for r in json.load(open(os.path.join(GD, "Table_Localization.json"), encoding="utf-8-sig"))["Table_Localization"]}
icons = {}
for sub in os.listdir(ICON):
    d = os.path.join(ICON, sub)
    if os.path.isdir(d):
        for f in os.listdir(d):
            m = re.match(r"UI_Icon_(Equip_.+)\.png$", f)
            if m:
                icons[m.group(1)] = os.path.join(d, f)

# 키워드 → 주 능력 (삼국지 5능력)
RULES = [
    (r"Atk|Assault|Missile|Pod|Cannon|Bullet|Gun|Blade|Sword|Rocket|Bomb|Fire", "war"),
    (r"Acc|Radar|Scan|Analy|Cri|Sensor|Recon|Spot|Target|Jam|Hack|Calc", "int"),
    (r"Def|Hp|Shield|Armor|Guard|Plate|Barrier|AntiArmor|Repair", "ldr"),
    (r"Spd|Ev|Booster|Engine|Thruster|Move|Wing", "cha"),
    (r"Res|Vaccine|Supply|Ration|Pack|Kit|Cargo", "pol"),
]
# 이름만으로 애매한 장비는 직접 지정
OVERRIDE = {"Sniper": "int", "Highspd": "war", "Maneuver": "int", "AntiAir": "war", "AntiTrooper": "war", "AntiArmor": "war",
            "Exp": "pol", "Stimulant": "war", "Hologram": "cha", "MarkOfDS": "war", "AntiFire": "ldr", "AntiCold": "ldr",
            "AntiLightning": "ldr", "ExamKit": "war", "EnergyPack": "ldr", "ArmorPierce": "war", "AntiBarrier": "int", "SubBooster": "cha"}
TIER = {"T1": ("RE", 3), "T2": ("MP", 5), "T3": ("SP", 7), "T4": ("EX", 10)}
items = {}
for r in rows:
    k = r["Key"]
    if k not in icons:
        continue
    m = re.search(r"_(T[1-4])$", k)
    if not m:
        continue
    name = L.get(r["ItemName"]) or k
    slot = "chip" if "_Chip_" in k else "system" if "_System_" in k else "sub"
    stat = next((v for o, v in OVERRIDE.items() if re.search(r"_" + o + r"_T", k)), None) or next((s for pat, s in RULES if re.search(pat, k)), "ldr" if slot == "system" else "int")
    tier, val = TIER[m.group(1)]
    items[k] = {"n": name, "s": slot, "t": tier, "st": stat, "v": val, "d": (L.get(r.get("ItemDesc")) or "")[:60]}
    Image.open(icons[k]).convert("RGBA").resize((72, 72), Image.LANCZOS).save(os.path.join(OUT, k + ".webp"), "WEBP", quality=88)

js = "// tools/gen_equip.py 가 생성 — 원작 장비(칩·전투 시스템·보조장비)\nconst EQUIP = " + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(os.path.join(ROOT, "js", "equip_data.js"), "w", encoding="utf-8").write(js)
from collections import Counter
print("items", len(items), Counter(i["s"] for i in items.values()), Counter(i["st"] for i in items.values()))
