// 버전 올리기: index.html의 타이틀 버전(#gameVer)을 0.01 올리고, 스크립트·스타일 주소의 ?v= 도 같은 값으로 바꾼다
//   (주소가 바뀌어야 플레이 링크에서 브라우저가 예전 파일을 캐시에서 쓰지 않는다)
// 사용: node tools/bump_version.js          → 0.01 올림
//       node tools/bump_version.js 0.10     → 그 값으로 지정
const fs = require("fs"), path = require("path");
const file = path.join(__dirname, "..", "index.html");
let s = fs.readFileSync(file, "utf8");
const m = s.match(/<span id="gameVer">v(\d+\.\d+)<\/span>/);
if (!m) throw new Error("index.html에 <span id=\"gameVer\">vX.XX</span> 가 없다");
const next = process.argv[2] ? (+process.argv[2]).toFixed(2) : (Math.round(+m[1] * 100 + 1) / 100).toFixed(2);
s = s.replace(m[0], `<span id="gameVer">v${next}</span>`);
s = s.replace(/(<script src="js\/[^"?]+\.js)(\?v=[\d.]+)?"/g, `$1?v=${next}"`);
s = s.replace(/(<link rel="stylesheet" href="style\.css)(\?v=[\d.]+)?"/, `$1?v=${next}"`);
fs.writeFileSync(file, s);
console.log(`v${m[1]} → v${next}`);
