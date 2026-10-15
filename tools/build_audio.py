"""원본 사운드에서 게임용 BGM·효과음·보이스를 추출/경량화한다 (ffmpeg 필요).
사용: python tools/build_audio.py [에셋 루트]   →  assets/bgm, assets/sfx, assets/voice, js/audio_manifest.js"""
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

SRC = sys.argv[1] if len(sys.argv) > 1 else r"E:/LAO/Google_QA/Assets"
SND = os.path.join(SRC, "AssetBundleResource", "Sounds")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")

BGM = {
    "title": "01 BGM_Title", "map1": "02 BGM_Lobby", "map2": "08 BGM_Talk_02", "map3": "64 BGM_ColdWind",
    "map4": "69 BGM_Northern_Front", "battle1": "03 BGM_Battle_01", "battle2": "05 BGM_Battle_02",
    "battle3": "12 BGM_Battle_03", "battle4": "22 BGM_Battle_04", "boss1": "04 BGM_Battle_Boss_01",
    "boss2": "06 BGM_Battle_Boss_02", "duel": "21 BGM_Thrill_01", "debate": "67 BGM_tension01",
    "event": "09 BGM_Talk_03", "sad": "75 BGM_Sad_Story_01", "ending": "Track32_Dawn_Labiata",
    "select": "26 BGM_Talk_06", "oath": "16 BGM_Marriage_01",
}
S = SND + "/SFX"
SFX = {
    "click": S + "/UI/pick_basic.wav", "open": S + "/UI/Trainsition_in.wav", "close": S + "/UI/Trainsition_out.wav",
    "rankup": S + "/UI/Rank_UP.mp3", "rankup2": S + "/UI/Rank_UP_SS.mp3", "bond": S + "/UI/Likeability_up-1.wav",
    "coin": S + "/UI/collect_coin_03.wav", "start": S + "/UI/battle_start.wav", "clear": S + "/UI/stage_clear.wav",
    "win": S + "/UI/battle_win_sfx.wav", "fanfare": S + "/UI/battle_win_music.wav", "warn": S + "/UI/Warning_infinite.wav",
    "build": S + "/UI/Reinforce_unit.wav", "gen": S + "/UI/generate_S.wav", "item": S + "/UI/item_purchase.wav",
    "search": S + "/UI/Join_Search.wav", "found": S + "/UI/Join_SearchEnd.wav", "turn": S + "/UI/stage_in.wav",
    "hit": S + "/Common/Hit/Human/hit_human_phy_mid.wav", "hitbig": S + "/Common/Hit/Human/hit_human_phy_big.wav",
    "hitgun": S + "/Common/Hit/Human/hit_human_gun_big.wav", "hitrobot": S + "/Common/Hit/Robot/hit_robot_phy_big.wav",
    "swing": S + "/Common/Atk/Swing/CHR_CW_At_Act_Sword_MS_6.mp3", "spear": S + "/Common/Atk/Swing/CHR_CW_At_Act_Spear_LL_11.mp3",
    "shot": S + "/Common/Atk/Shot/Lazer_Fire_Sound03.wav", "beam": S + "/Common/Atk/Energy/atk_Beam1.wav",
    "boom": S + "/Common/Explosion/MediumExplosion4_IN.wav", "bigboom": S + "/Common/Explosion/BigExplosion6_IN.wav",
    "fire": S + "/Common/magic/fireball_blast_02.wav", "shield": S + "/Common/effect/Shield Device 1 Start_IN.wav",
    "charge": S + "/Common/magic/conjure_charge2_03.wav", "reload": S + "/Common/Reload/Reload_2.wav",
}
VOICE_EVENTS = ["Join", "SortiePick", "BattleFocus", "SpSkill", "MVP", "Retreat", "Leader", "Oath",
                "SearchEnd", "ActionApprove", "StageStart", "Intro", "PresentGet"]
CHAR_SFX = {"s1": "skill1", "s2": "skill2", "die": "death"}


def ff(src, dst, mono=False, rate="96k", vol=None):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return True
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vn", "-b:a", rate, "-ar", "44100"]
    if mono:
        cmd += ["-ac", "1"]
    if vol:
        cmd += ["-af", f"loudnorm=I={vol}:TP=-1.5:LRA=11"]
    cmd.append(dst)
    return subprocess.run(cmd).returncode == 0


def main():
    jobs = []
    for k, n in BGM.items():
        jobs.append((os.path.join(SND, "BGM", n + ".mp3"), os.path.join(A, "bgm", k + ".mp3"), False, "112k", None))
    for k, p in SFX.items():
        jobs.append((p, os.path.join(A, "sfx", k + ".mp3"), True, "96k", None))
    off = open(os.path.join(ROOT, "js", "lao_official.js"), encoding="utf-8").read()
    codes = re.findall(r'"((?:3P|AGS|BR|DS|PECS|ST)_[A-Za-z0-9-]+)":\{"n"', off)
    manifest = {"voice": {}, "csfx": {}}
    for code in codes:
        short = code.split("_", 1)[1]
        vdir = os.path.join(SND, "Voice", short)
        if os.path.isdir(vdir):
            got = []
            for ev in VOICE_EVENTS:
                cands = [f for f in os.listdir(vdir) if f.endswith(".mp3") and re.search(r"_%s(_01)?\.mp3$" % ev, f)]
                if cands:
                    jobs.append((os.path.join(vdir, sorted(cands)[0]), os.path.join(A, "voice", code, ev + ".mp3"), True, "48k", None))
                    got.append(ev)
            if got:
                manifest["voice"][code] = got
        cdir = os.path.join(S, "Character", short)
        if os.path.isdir(cdir):
            got = []
            for k, suf in CHAR_SFX.items():
                cands = [f for f in os.listdir(cdir) if f.lower().endswith(("_%s.wav" % suf, "_%s.mp3" % suf))]
                if cands:
                    jobs.append((os.path.join(cdir, sorted(cands)[0]), os.path.join(A, "csfx", code, k + ".mp3"), True, "64k", None))
                    got.append(k)
            if got:
                manifest["csfx"][code] = got
    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda j: ff(*j), jobs))
    bad = [j[0] for j, r in zip(jobs, res) if not r]
    js = "// tools/build_audio.py 가 생성\nconst AUDIO_MANIFEST = " + json.dumps(manifest, separators=(",", ":")) + ";\n"
    open(os.path.join(ROOT, "js", "audio_manifest.js"), "w", encoding="utf-8").write(js)
    print("jobs", len(jobs), "fail", len(bad), "voices", len(manifest["voice"]), "csfx", len(manifest["csfx"]))
    for b in bad[:10]:
        print(" fail:", b)


if __name__ == "__main__":
    main()
