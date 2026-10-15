// node tools/sd/verify_rigs.js [id ...]  - parses js/sd/<id>.js, checks atlas file and clip set
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SD = path.join(__dirname, '..', '..', 'js', 'sd');
let ids = process.argv.slice(2);
if (!ids.length) ids = Object.values(JSON.parse(fs.readFileSync(path.join(__dirname, 'BUILT.json'), 'utf8')));
let bad = 0;
const rows = [];
for (const id of ids) {
  const f = path.join(SD, id + '.js');
  try {
    const ctx = { window: {} };
    ctx.window.window = ctx.window;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(f, 'utf8').replace(/^window\.SD_DATA=window\.SD_DATA\|\|\{\};/, 'var SD_DATA=window.SD_DATA={};'), ctx);
    const d = ctx.window.SD_DATA[id];
    if (!d) throw new Error('SD_DATA[' + id + '] missing');
    const clips = Object.keys(d.clips);
    const meshes = d.nodes.reduce((n, x) => n + (x.mesh ? x.mesh.length : 0), 0);
    const atlas = fs.existsSync(path.join(SD, id + '.a50.webp'));
    if (!atlas || !d.clips.idle) throw new Error('atlas=' + atlas + ' clips=' + clips);
    rows.push([id, d.nodes.length, meshes, clips.join(',')].join('\t'));
  } catch (e) {
    bad++;
    rows.push(id + '\tFAIL ' + e.message);
  }
}
console.log(rows.join('\n'));
console.log(ids.length + ' rigs, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
