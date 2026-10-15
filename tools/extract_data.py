"""라스트오리진 원본 테이블(JSON)에서 장수 이름·능력·부대 데이터를 추출한다.
사용: python tools/extract_data.py [GameData 경로]  →  scratch/lao_data.json"""
import json, os, sys
GD = sys.argv[1] if len(sys.argv) > 1 else r"E:/LAO/TAable_BattleRenewal/GameData"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "lao_data.json")

def load(name):
    d = json.load(open(os.path.join(GD, f"Table_{name}.json"), encoding="utf-8-sig"))
    return next(iter(d.values()))

L = {r["Key"]: r.get("Korea") for r in load("Localization")}
pcs = load("PC"); abil = {r["Key"]: r for r in load("PCAbility")}
troops = load("TroopCategory")
out = {"pc": [], "troop": []}
for p in pcs:
    a = abil.get(p["Key"], {})
    out["pc"].append({"key": p["Key"], "name": L.get(str(p["Name"])), "use": p.get("IsUse"), "grade": p.get("StartGrade"),
                      "max": p.get("MaxGrade"), "cls": p.get("ActorClassType"), "role": p.get("RoleType"), "body": p.get("ActorBodyType"),
                      "model": p.get("PCModelID"), "atk": a.get("AttackDmg"), "def": a.get("DefenseDmg"), "hp": a.get("DefaultHP"),
                      "eva": a.get("EvadeRate"), "cri": a.get("CriRate"), "spd": a.get("TurnSpeed"),
                      "join": L.get(str(p.get("DialogJoin")))})
for t in troops:
    out["troop"].append({"key": t["Key"], "name": L.get(str(t["Squad_Name"])), "desc": L.get(str(t["Squad_Desc"])),
                         "icon": t["Squad_Icon"], "members": t["Squad_Member"]})
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("pc", len(out["pc"]), "troop", len(out["troop"]), "->", OUT)
