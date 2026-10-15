"""장수 약칭을 공식명에서 다시 만들고(js/data.js UNITS_RAW 두 번째 칸), 의심 단어를 검사한다.
사용: python tools/qa_names.py [--write]"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
off = open(os.path.join(ROOT, "js", "lao_official.js"), encoding="utf-8").read()
PC = json.loads(off.split("const LAO_PC = ", 1)[1].split(";\nconst LAO_SQUADS", 1)[0])
BAD = ["놈", "년", "새끼", "병신", "씨발", "개새", "죽어", "똥"]
MODIFIER = re.compile(r"^[가-힣]+의$")          # 불굴의, 멸망의 ...
CODEY = re.compile(r"^[A-Za-z0-9/\-]+$")         # T-20S, C-77, S2, P/A-00 ...


def short_of(full):
    toks = full.split()
    keep = [t for t in toks if not MODIFIER.match(t) and not CODEY.match(t)]
    s = " ".join(keep) if keep else full
    return full if len(s.replace(" ", "")) <= 1 else s  # '무적의 용' → '용'처럼 한 글자만 남으면 공식명 유지


path = os.path.join(ROOT, "js", "data.js")
src = open(path, encoding="utf-8").read()
changes, flags = [], []


def fix2(m):
    class M:  # 그룹 번호를 기존 fix()에 맞춘다
        def __init__(s, m): s.m = m
        def group(s, i): return s.m.group(0).lstrip() if i == 0 else s.m.group(i + 1)
    return fix(M(m))


def fix(m):
    code, short = m.group(1), m.group(2)
    if code not in PC:
        return m.group(0)
    want = short_of(PC[code]["n"])
    if want != short:
        changes.append((code, short, want, PC[code]["n"]))
    for b in BAD:
        if b in want.split() or want == b:
            flags.append((code, want))
    return '["%s", "%s",' % (code, want)


# UNITS_RAW 항목(줄 맨 앞의 [코드, 약칭, ...])만 대상 — 세력의 members/extra 배열은 건드리지 않는다
new = re.sub(r'(?m)^(\s*)\["((?:3P|AGS|BR|DS|PECS|ST)_[A-Za-z0-9-]+)", "([^"]*)",', lambda m: m.group(1) + fix2(m), src)
for c in changes:
    print("%-22s %-12s -> %-14s (%s)" % c)
print("changes:", len(changes), "flags:", flags)
if "--write" in sys.argv:
    open(path, "w", encoding="utf-8").write(new)
    print("written")
