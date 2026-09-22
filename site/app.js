const nodes = Object.fromEntries(['search', 'category', 'mode', 'fit', 'sort', 'reset', 'count', 'freshness', 'games', 'empty'].map(id => [id, document.getElementById(id)]));
let allGames = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(game) {
  const article = el('article', 'game');
  const main = el('div', 'game-main');
  const cover = el('div', 'cover', game.name);
  if (game.cover) {
    const img = el('img');
    img.alt = `${game.name} 的 Steam 封面`;
    img.loading = 'lazy';
    img.decoding = 'async';
    let fallback = false;
    img.addEventListener('error', () => {
      if (!fallback) {
        fallback = true;
        img.src = `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`;
      } else img.remove();
    });
    img.src = game.cover;
    cover.append(img);
  }
  const info = el('div', 'game-info');
  const tags = el('div', 'meta-top');
  tags.append(el('span', 'tag', game.category), el('span', 'tag source', game.source));
  const title = el('a', 'game-title', game.name);
  title.href = game.url;
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  const reason = el('p', 'reason', game.reason);
  const facts = el('div', 'facts');
  facts.append(el('span', '', `人数 ${game.players}`), el('span', '', game.mode));
  info.append(tags, title, reason, facts);
  main.append(cover, info);

  const fit = el('div', 'fit');
  fit.dataset.fit = String(game.fit);
  fit.append(el('span', 'fit-dots', '●'.repeat(game.fit) + '○'.repeat(3 - game.fit)));
  const fitText = el('div');
  fitText.append(el('strong', '', game.fit === 3 ? '三人优先' : game.fit === 2 ? '三人可玩' : '更适合多人'));
  fit.append(fitText);
  const price = el('div', 'price');
  if (game.discount > 0) price.append(el('span', 'discount', `−${game.discount}%`));
  price.append(el('strong', '', game.priceLabel || '查看 Steam'));
  price.append(el('small', '', game.priceCheckedAt ? `${game.priceCheckedAt} 核价` : '以商店为准'));
  article.append(main, fit, price);
  return article;
}

function render() {
  const query = nodes.search.value.trim().toLocaleLowerCase();
  const category = nodes.category.value;
  const mode = nodes.mode.value;
  const fit = Number(nodes.fit.value);
  const games = allGames.filter(game => {
    const searchable = `${game.name} ${game.category} ${game.reason} ${game.source}`.toLocaleLowerCase();
    return (!query || searchable.includes(query)) &&
      (!category || game.category === category) &&
      (!fit || game.fit >= fit) &&
      (!mode || (mode === 'online' ? game.mode.includes('在线') : /同屏|远程同乐/.test(game.mode)));
  });
  switch (nodes.sort.value) {
    case 'price-asc': games.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.order - b.order); break;
    case 'price-desc': games.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity) || a.order - b.order); break;
    case 'name': games.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')); break;
    default: games.sort((a, b) => a.order - b.order);
  }
  nodes.count.textContent = `找到 ${games.length} 款游戏`;
  nodes.empty.hidden = games.length > 0;
  nodes.games.replaceChildren(...games.map(card));
}

async function start() {
  try {
    const response = await fetch('./games.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    allGames = data.games;
    for (const category of [...new Set(allGames.map(game => game.category))]) {
      const option = el('option', '', category);
      option.value = category;
      nodes.category.append(option);
    }
    nodes.freshness.textContent = `页面生成：${data.generatedAt} · 每款游戏另标核价日期`;
    for (const id of ['search', 'category', 'mode', 'fit', 'sort']) nodes[id].addEventListener('input', render);
    nodes.reset.addEventListener('click', () => {
      for (const id of ['search', 'category', 'mode', 'fit']) nodes[id].value = '';
      nodes.sort.value = 'recommended';
      render();
    });
    render();
  } catch (error) {
    nodes.count.textContent = '游戏列表暂时无法载入，请稍后刷新。';
    console.error(error);
  }
}

start();
