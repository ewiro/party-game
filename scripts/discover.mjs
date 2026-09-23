import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const today = new Date().toISOString().slice(0, 10);
const cataloguePath = 'data/catalogue.tsv';
const candidatesPath = 'data/candidates.tsv';
const reportPath = 'reports/discovery.md';
const githubOutput = process.argv.includes('--github-output')
  ? process.argv[process.argv.indexOf('--github-output') + 1]
  : process.env.GITHUB_OUTPUT;

const sources = [
  { id: 'party-popular-new', label: '派对游戏 · 热门新品', filter: 'popularnew', tags: '7178' },
  { id: 'party-top-sellers', label: '派对游戏 · 热销', filter: 'topsellers', tags: '7178' },
  { id: 'funny-online-new', label: '欢乐在线合作 · 热门新品', filter: 'popularnew', tags: '3843,4136' },
  { id: 'funny-multiplayer-new', label: '欢乐多人 · 热门新品', filter: 'popularnew', tags: '3859,4136' },
  { id: 'horror-online-new', label: '恐怖在线合作 · 热门新品', filter: 'popularnew', tags: '3843,1667' },
  { id: 'local-party-top', label: '本地多人派对 · 热销', filter: 'topsellers', tags: '7178,7368' },
  { id: 'party-wishlist', label: '派对游戏 · 热门愿望单', filter: 'popularwishlist', tags: '7178' },
  { id: 'funny-online-wishlist', label: '欢乐在线合作 · 热门愿望单', filter: 'popularwishlist', tags: '3843,4136' },
];

function readPipeTable(path) {
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const columns = lines.shift().split('|');
  return lines.filter(Boolean).map((line, index) => {
    const values = line.split('|');
    if (values.length !== columns.length) throw new Error(`${path}:${index + 2} 字段数量不正确`);
    return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
  });
}

function clean(value) {
  return String(value ?? '').replaceAll('|', '／').replace(/[\r\n\t]+/g, ' ').trim();
}

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').trim();
}

async function fetchPage(source, start) {
  const query = new URLSearchParams({
    query: '', start: String(start), count: '100', dynamic_data: '', category1: '998',
    infinite: '1', cc: 'cn', l: 'schinese', filter: source.filter, tags: source.tags,
  });
  const response = await fetch(`https://store.steampowered.com/search/results/?${query}`, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'PartyGameCatalog/1.0' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.success || typeof payload.results_html !== 'string') throw new Error('Steam 搜索结果不可用');
  const games = [];
  for (const block of payload.results_html.matchAll(/<a\b[\s\S]*?<\/a>/g)) {
    const id = Number(block[0].match(/data-ds-appid="(\d+)"/)?.[1]);
    const title = block[0].match(/<span class="title">([\s\S]*?)<\/span>/)?.[1];
    if (id && title) games.push({ id, name: decodeHtml(title) });
  }
  return { games, total: Number(payload.total_count) || games.length };
}

async function scanSource(source) {
  const all = [];
  let total = 0;
  for (let start = 0; start < Math.min(total || 100, 300); start += 100) {
    const page = await fetchPage(source, start);
    total = page.total;
    all.push(...page.games);
    if (page.games.length < 100) break;
  }
  return { ...source, total, games: [...new Map(all.map(game => [game.id, game])).values()] };
}

const catalogue = readPipeTable(cataloguePath);
const catalogueById = new Map(catalogue.map(game => [Number(game.id), game]));
const oldCandidates = existsSync(candidatesPath) ? readPipeTable(candidatesPath) : [];
const candidatesById = new Map(oldCandidates.map(game => [Number(game.id), game]));
const results = await Promise.allSettled(sources.map(scanSource));
const coverage = [];
const seenThisRun = new Map();

for (let i = 0; i < results.length; i++) {
  const source = sources[i];
  const result = results[i];
  if (result.status === 'rejected') {
    coverage.push({ ...source, count: 0, status: `失败：${clean(result.reason)}` });
    continue;
  }
  coverage.push({ ...source, count: result.value.games.length, status: result.value.games.length ? '正常' : '警告：结果为 0' });
  for (const game of result.value.games) {
    const found = seenThisRun.get(game.id) ?? { ...game, sources: new Set() };
    found.sources.add(source.id);
    seenThisRun.set(game.id, found);
  }
}

let newPending = 0;
for (const [id, discovered] of seenThisRun) {
  const old = candidatesById.get(id);
  const listed = catalogueById.get(id);
  const sourceSet = new Set([...(old?.sources?.split(';').filter(Boolean) ?? []), ...discovered.sources]);
  const status = listed ? 'included' : old?.status === 'excluded' ? 'excluded' : 'pending';
  if (!old && status === 'pending') newPending++;
  candidatesById.set(id, {
    id: String(id),
    name: listed?.name || old?.name || discovered.name,
    status,
    sources: [...sourceSet].sort().join(';'),
    firstSeen: old?.firstSeen || today,
    lastSeen: today,
    reason: listed ? '已进入正式清单' : old?.reason || '',
    evidenceUrl: listed?.evidenceUrl || old?.evidenceUrl || `https://store.steampowered.com/app/${id}/`,
    reviewedAt: listed?.verifiedAt || old?.reviewedAt || '',
  });
}

for (const [id, candidate] of candidatesById) {
  const listed = catalogueById.get(id);
  if (listed) {
    candidate.status = 'included';
    candidate.reason = '已进入正式清单';
    candidate.evidenceUrl = listed.evidenceUrl;
    candidate.reviewedAt = listed.verifiedAt;
  } else if (candidate.status === 'included') {
    candidate.status = 'pending';
    candidate.reason = '';
    candidate.reviewedAt = '';
  }
}

const statusOrder = { pending: 0, excluded: 1, included: 2 };
const candidates = [...candidatesById.values()].sort((a, b) =>
  (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
  b.firstSeen.localeCompare(a.firstSeen) || a.name.localeCompare(b.name, 'zh-CN')
);
const columns = ['id', 'name', 'status', 'sources', 'firstSeen', 'lastSeen', 'reason', 'evidenceUrl', 'reviewedAt'];
writeFileSync(candidatesPath, [columns.join('|'), ...candidates.map(row => columns.map(column => clean(row[column])).join('|'))].join('\n') + '\n');

const pending = candidates.filter(candidate => candidate.status === 'pending');
const excluded = candidates.filter(candidate => candidate.status === 'excluded');
const included = candidates.filter(candidate => candidate.status === 'included');
const report = [
  '# 派对游戏候选覆盖报告', '',
  `生成日期：${today}`, '',
  '## 汇总', '',
  `- 正式清单：${catalogue.length} 款`,
  `- 本次扫描去重后：${seenThisRun.size} 款`,
  `- 待核验：${pending.length} 款`,
  `- 本次新发现待核验：${newPending} 款`,
  `- 已排除：${excluded.length} 款`,
  `- 已收录且被发现流程覆盖：${included.length} 款`, '',
  '## 发现入口', '',
  '| 入口 | 结果数 | 状态 |', '|---|---:|---|',
  ...coverage.map(source => `| ${source.label} | ${source.count} | ${source.status.replaceAll('|', '／')} |`), '',
  '## 待核验候选', '',
  ...(pending.length ? pending.slice(0, 150).map(candidate =>
    `- [${candidate.name}](${candidate.evidenceUrl}) · AppID ${candidate.id} · ${candidate.sources}`
  ) : ['当前没有待核验候选。']),
  ...(pending.length > 150 ? ['', `另有 ${pending.length - 150} 款，请查看 \`data/candidates.tsv\`。`] : []), '',
  '候选只代表需要核验。加入正式清单前，必须从 Steam 或游戏官网确认三人能够共同游玩。', '',
];
mkdirSync('reports', { recursive: true });
writeFileSync(reportPath, report.join('\n'));
if (githubOutput) appendFileSync(githubOutput, `pending=${pending.length}\nnew_pending=${newPending}\n`);
console.log(`${seenThisRun.size} discovered; ${pending.length} pending; ${newPending} new pending`);
if (!coverage.some(source => source.count > 0)) throw new Error('所有 Steam 发现入口均失败或返回 0');
