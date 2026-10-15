"""원작 오르카 기지 시설(방 단면도) 스프라이트 시트에서 방 부분만 잘라 거점 시설 이미지로 쓴다.
사용: python tools/build_facility.py  →  assets/facility/<종류>_<단계>.webp"""
import glob
import os
import sys

from PIL import Image

SRC = (sys.argv[1] if len(sys.argv) > 1 else r"E:/LAO/Google_QA/Assets") + "/AssetBundleResourceSub/Facility/FacilityTexture"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "facility")
os.makedirs(OUT, exist_ok=True)

# 종류 → 단계별 원본 (낮은 단계부터)
SETS = {
    "comm": ["Bg_Cafeteria_01", "Bg_Cafeteria_02", "Bg_Cafeteria_03", "Bg_Cafeteria_04", "Bg_Cafeteria_05"],
    "tech": ["FacilityParts_ML1", "FacilityParts_ML2", "FacilityParts_ML3"],
    "train": ["Obj_TrainingSupport_01_01", "Obj_TrainingSupport_01_02", "Obj_TrainingSupport_01_03", "Obj_TrainingSupport_01_04", "Obj_TrainingSupport_01_05"],
    "def": ["Bg_EquipRein_N01", "Bg_EquipRein_N02", "Bg_EquipRein_N03"],
    "agri": ["MakingMaterial_resource_0", "MakingMaterial_resource_1", "MakingMaterial_resource_2", "MakingMaterial_resource_4"],
    "order": ["Bg_EquipDisassemble_N01", "Bg_EquipDisassemble_N02", "Bg_EquipDisassemble_N03"],
}


def find(name):
    hits = glob.glob(os.path.join(SRC, "**", name + ".png"), recursive=True)
    if not hits:
        hits = glob.glob(os.path.join(SRC, "**", "*" + name + ".png"), recursive=True)
    return hits[0] if hits else None


def room_crop(im):
    """시트 위쪽의 방 그림만 남긴다: 위에서부터 '거의 투명/단색' 줄이 연속으로 나오는 곳까지."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    def blank(y):
        n = 0
        for x in range(0, w, 8):
            r, g, b, a = px[x, y]
            if a < 20 or (abs(r - g) < 4 and abs(g - b) < 4 and r < 48):
                n += 1
        return n / (w / 8) > 0.82
    run = 0
    for y in range(int(h * 0.18), h):
        run = run + 1 if blank(y) else 0
        if run >= 6:
            return im.crop((0, 0, w, y - 6))
    return im


n = 0
for kind, names in SETS.items():
    for lv, name in enumerate(names, 1):
        p = find(name)
        if not p:
            print("missing", name)
            continue
        room = room_crop(Image.open(p))
        bg = Image.new("RGBA", room.size, (24, 27, 33, 255))
        bg.alpha_composite(room)
        bg = bg.convert("RGB")
        bg.thumbnail((640, 400), Image.LANCZOS)
        bg.save(os.path.join(OUT, f"{kind}_{lv}.webp"), "WEBP", quality=85)
        n += 1
print("facility rooms:", n)

# ── 수동 합성: 농업(식량 생산실) 3단계 + 기술 1단계 ──
def sheet(name):
    return Image.open(find(name)).convert("RGBA")

def save(img, key):
    bg = Image.new("RGBA", img.size, (24, 27, 33, 255)); bg.alpha_composite(img)
    bg = bg.convert("RGB"); bg.thumbnail((640, 400), Image.LANCZOS)
    bg.save(os.path.join(OUT, key + ".webp"), "WEBP", quality=85)

def paste(room, spr, box, at, scale=1.0):
    s = spr.crop(box)
    if scale != 1.0:
        s = s.resize((int(s.width * scale), int(s.height * scale)), Image.LANCZOS)
    room.alpha_composite(s, (int(at[0]), int(at[1] - s.height)))  # at = 발 위치

n1, n2 = sheet("Obj_ResourceNutrient_N01"), sheet("Obj_ResourceNutrient_N02")
for f in glob.glob(os.path.join(OUT, "agri_*.webp")):
    os.remove(f)
room1 = n1.crop((0, 0, 1000, 1000)).copy()
paste(room1, n1, (1320, 0, 1940, 990), (560, 960), 0.62)  # 선반
save(room1.resize((1000, 620)) if False else room1.crop((0, 120, 1000, 1000)), "agri_1")
room2 = n2.crop((0, 0, 1000, 1000)).copy()
paste(room2, n2, (0, 1020, 560, 2000), (430, 965), 0.62)  # 배양 탱크
paste(room2, n1, (1320, 0, 1940, 990), (690, 960), 0.5)
save(room2.crop((0, 120, 1000, 1000)), "agri_2")
room3 = n2.crop((0, 0, 1000, 1000)).copy()
paste(room3, n2, (1080, 200, 1420, 990), (130, 965), 0.55)  # 컨테이너
paste(room3, n2, (0, 1020, 560, 2000), (330, 965), 0.62)
paste(room3, n2, (580, 1020, 1140, 2000), (590, 965), 0.62)
save(room3.crop((0, 120, 1000, 1000)), "agri_3")
parts = sheet("FacilityParts_ML1")
save(parts.crop((0, 0, 1024, 500)), "tech_1")
print("composed agri 1-3, tech_1")
