import { readFileSync } from 'node:fs';

function readPipeTable(path) {
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const columns = lines.shift().split('|');
  return lines.filter(Boolean).map((line, index) => {
    const values = line.split('|');
    if (values.length !== columns.length) throw new Error(`${path}:${index + 2} 字段数量不正确`);
    return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
  });
}

const catalogue = readPipeTable('data/catalogue.tsv');
const ids = catalogue.map(game => Number(game.id));
if (ids.some(id => !Number.isInteger(id) || id <= 0)) throw new Error('正式清单包含无效 AppID');
if (new Set(ids).size !== ids.length) throw new Error('正式清单包含重复 AppID');
for (const game of catalogue) {
  if (!['1', '2', '3'].includes(game.fit)) throw new Error(`${game.id} 的三人适配度无效`);
  if (!['热门游戏', '经典补充', '补充'].includes(game.source)) throw new Error(`${game.id} 的来源标签无效`);
  if (!/^https:\/\//.test(game.evidenceUrl)) throw new Error(`${game.id} 缺少人数证据链接`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(game.verifiedAt)) throw new Error(`${game.id} 缺少有效核验日期`);
}

const candidates = readPipeTable('data/candidates.tsv');
if (new Set(candidates.map(game => game.id)).size !== candidates.length) throw new Error('候选台账包含重复 AppID');
for (const candidate of candidates) {
  if (!['pending', 'included', 'excluded'].includes(candidate.status)) throw new Error(`${candidate.id} 的候选状态无效`);
  if (candidate.status === 'excluded' && !candidate.reason) throw new Error(`${candidate.id} 已排除但没有原因`);
}

const generated = JSON.parse(readFileSync('site/games.json', 'utf8'));
if (generated.games.length !== catalogue.length) throw new Error('games.json 与正式清单数量不一致，请先运行 refresh.mjs');
if (generated.games.some(game => !game.name || !game.cover || !game.priceLabel)) throw new Error('games.json 存在不完整的 Steam 数据');
console.log(`${catalogue.length} catalogue entries and ${candidates.length} candidate records are valid`);
