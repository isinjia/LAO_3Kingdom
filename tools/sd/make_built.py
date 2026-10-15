"""Write tools/sd/BUILT.json: game code -> rig id, for every code that has a rig in js/sd."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_sd as B  # noqa: E402

out = {}
for short, code in B.PREBUILT.items():
    if os.path.exists(os.path.join(B.OUT, short + ".js")):
        out[code] = short
for code in B.game_codes():
    if code in out:
        continue
    if os.path.exists(os.path.join(B.OUT, code + ".js")) and os.path.exists(os.path.join(B.OUT, code + ".a50.webp")):
        out[code] = code
json.dump(out, open(os.path.join(HERE, "BUILT.json"), "w", encoding="utf-8"), indent=1)
print(len(out), "codes with rigs")
