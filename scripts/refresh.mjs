import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const rows = readFileSync('data/catalogue.tsv', 'utf8').trim().split(/\r?\n/);
const columns = rows.shift().split('|');
const catalogue = rows.map((line, index) => {
  const values = line.split('|');
  if (values.length !== columns.length) throw new Error(`Invalid catalogue row ${index + 2}`);
  const entry = Object.fromEntries(columns.map((key, i) => [key, values[i]]));
  return { ...entry, id: Number(entry.id), fit: Number(entry.fit), order: index };
});
if (new Set(catalogue.map(item => item.id)).size !== catalogue.length) throw new Error('Duplicate Steam AppID');

const output = 'site/games.json';
const previous = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : { games: [] };
const oldById = new Map(previous.games.map(game => [game.id, game]));
const today = new Date().toISOString().slice(0, 10);
let refreshed = 0;

async function fetchSteam(id) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=cn&l=schinese`, {
        signal: AbortSignal.timeout(12000),
        headers: { 'User-Agent': 'PartyGameCatalog/1.0' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const data = payload[id]?.data;
      if (!payload[id]?.success || !data || data.type !== 'game') throw new Error('Store details unavailable');
      const overview = data.price_overview;
      refreshed++;
      return {
        name: data.name,
        cover: data.header_image,
        price: data.is_free ? 0 : overview ? overview.final / 100 : null,
        priceLabel: data.is_free ? '免费' : overview?.final_formatted ?? '查看 Steam',
        priceCheckedAt: today,
        discount: overview?.discount_percent ?? 0,
      };
    } catch (error) {
      if (attempt === 2) console.warn(`Steam ${id}: ${error}`);
      else await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }
  return null;
}

const games = [];
for (const entry of catalogue) {
  const old = oldById.get(entry.id);
  const steam = await fetchSteam(entry.id);
  if (!steam && !old) throw new Error(`No data for ${entry.id}`);
  games.push({
    ...entry,
    ...(steam ?? old),
    url: `https://store.steampowered.com/app/${entry.id}/?cc=cn&l=schinese`,
  });
  await new Promise(resolve => setTimeout(resolve, 120));
}
if (refreshed === 0) throw new Error('Steam price refresh failed for every game');
writeFileSync(output, JSON.stringify({ generatedAt: today, refreshed, games }, null, 2) + '\n');
console.log(`${games.length} games; ${refreshed} refreshed from Steam`);
