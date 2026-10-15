#!/bin/sh
# 핵심 스크립트를 하나씩 차단해 부팅 실패 화면(「다시 불러오기」)이 뜨는지 확인한다. 서버(tools/serve.py)가 떠 있어야 한다.
# 사용: sh tools/boot_block_test.sh
cd "$(dirname "$0")/.."
T=tools/.blocktest; mkdir -p "$T"
echo '[{"goto":"/index.html","wait":6000},{"eval":"const b=document.getElementById(\"boot\"); return b ? b.innerText.split(String.fromCharCode(10)).join(\" | \") : \"(boot 없음)\""}]' > "$T/s.json"
for f in js/game.js js/equip.js js/stage.js js/audio.js js/battle.js js/events.js js/lines_peer.js; do
  r=$(BLOCK=$f node tools/shot.mjs "$T/s.json" "$T/out" 2>&1 | grep '^eval:' | head -1)
  case "$r" in *다시\ 불러오기*) echo "OK   $f  $r";; *) echo "FAIL $f  $r";; esac
done
rm -rf "$T"
