"""LAO 원본 에셋에서 게임용 이미지를 추출/경량화한다.
사용: python tools/build_assets.py [에셋 루트]"""
import os, sys, re
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else r"E:/LAO/Google_QA/Assets"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(SRC, "AssetBundleResource", "Texture")
OUT_P = os.path.join(ROOT, "assets", "portrait")
OUT_B = os.path.join(ROOT, "assets", "bg")
os.makedirs(OUT_P, exist_ok=True)
os.makedirs(OUT_B, exist_ok=True)

pat = re.compile(r"^FormationIcon_((?:3P|AGS|BR|DS|PECS|ST)_[A-Za-z0-9-]+)_N\.png$")
n = 0
for f in os.listdir(os.path.join(TEX, "FormationIcon")):
    m = pat.match(f)
    if not m:
        continue
    im = Image.open(os.path.join(TEX, "FormationIcon", f)).convert("RGBA").resize((208, 208), Image.LANCZOS)
    im.save(os.path.join(OUT_P, m.group(1) + ".webp"), "WEBP", quality=86)
    n += 1
print("portraits:", n)

BGS = {"title": "BG_Sky_03", "field": "BG_7_2", "duel": "BG_EV_06_06", "debate": "BG_3_5_2", "city": "BG_09_1"}
for key, name in BGS.items():
    im = Image.open(os.path.join(TEX, "BGImg", name + ".png")).convert("RGB")
    im.save(os.path.join(OUT_B, key + ".jpg"), "JPEG", quality=82)
print("bgs:", len(BGS))

# 철충 지휘개체: 평행사변형 패널(364x139) 중앙을 정사각형으로 잘라낸다
BOSS = os.path.join(TEX, "ChallengeBossTx")
OUT_E = os.path.join(ROOT, "assets", "enemy")
os.makedirs(OUT_E, exist_ok=True)
IRON = ["EmperorChick", "Centurion", "Destroyer", "Juggernaut", "Legion", "Phalangites", "Harvester",
        "Scarab", "Spector", "Tarantula", "Testudo", "Mammoth", "NestGuardian", "Chiller", "Frostbite",
        "Wasp", "Zapper", "Scout", "Kidnapper", "Metal_Parasite", "NightChick", "BigChick", "Speaker",
        "Tortoise", "LightningBomber", "DoomEater", "Spector", "NestChaser"]
for name in dict.fromkeys(IRON):
    im = Image.open(os.path.join(BOSS, f"Challenge_PanelIcon_MP_{name}_N.png")).convert("RGBA")
    w, h = im.size
    x = (w - h) // 2
    im = im.crop((x, 0, x + h, h)).resize((160, 160), Image.LANCZOS)
    # 패널 모서리의 흰 여백을 어두운 배경으로 덮는다
    px = im.load()
    for yy in range(160):
        for xx in range(160):
            r, g, b, a = px[xx, yy]
            if a < 40 or (r > 232 and g > 232 and b > 232):
                px[xx, yy] = (28, 31, 30, 255)
    im.save(os.path.join(OUT_E, name + ".webp"), "WEBP", quality=86)
print("iron:", len(dict.fromkeys(IRON)))

# SD 얼굴 아이콘 (TbarIcon) — 지도 마커·턴 순서용
OUT_F = os.path.join(ROOT, "assets", "sdface")
os.makedirs(OUT_F, exist_ok=True)
nf = 0
for f in os.listdir(os.path.join(TEX, "TbarIcon")):
    m = re.match(r"^TbarIcon_((?:3P|AGS|BR|DS|PECS|ST)_[A-Za-z0-9-]+)_N\.png$", f)
    if not m:
        continue
    Image.open(os.path.join(TEX, "TbarIcon", f)).convert("RGBA").resize((112, 110), Image.LANCZOS).save(
        os.path.join(OUT_F, m.group(1) + ".webp"), "WEBP", quality=88)
    nf += 1
print("sdface:", nf)

# 명령 아이콘 (스킬 아이콘)
OUT_I = os.path.join(ROOT, "assets", "icon")
os.makedirs(OUT_I, exist_ok=True)
ICONS = {"attack": "Shot", "charge": "AssaultAttack", "plot": "Conflagration", "defend": "ShieldWall", "duel": "SwordAttk",
         "retreat": "Move", "auto": "Command", "agri": "Rain", "comm": "ExpUp", "tech": "Scan", "order": "EnemyDetect",
         "def": "SetBarricade", "draft": "TeamAtkBuff", "search": "Haze", "train": "SelfAtkBuff", "rest": "Wait",
         "talk": "Charm", "recruit": "Music", "serve": "TeamDefBuff", "rise": "Earthquake", "war": "AirStrike",
         "propose": "AWACS", "move": "TeamSpdBuff", "indep": "Vortex", "resign": "SelfSpdDeBuff", "list": "EnemyDetect",
         "snipe": "Snipe", "missile": "MultiMissile", "beam": "SatelliteBeam"}
for k, n in ICONS.items():
    Image.open(os.path.join(TEX, "SkillTexture", f"SkillIconCircle_{n}_active.png")).convert("RGBA").resize((72, 72), Image.LANCZOS).save(
        os.path.join(OUT_I, k + ".webp"), "WEBP", quality=90)
for n in ["CutIn_line", "CutIn_linefx", "CutIn_mask"]:
    Image.open(os.path.join(SRC, "AssetBundleResourceSub", "Texture", "UI_CutIn", n + ".png")).convert("RGBA").save(os.path.join(OUT_I, n + ".png"))
print("icons:", len(ICONS))
