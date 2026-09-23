# 三人派对游戏表

为固定三人组整理的 Steam 派对、欢乐合作与恐怖整活游戏清单。页面支持搜索、按类型和联机方式筛选、三人适配度筛选以及国区价格排序。

访问地址：[https://ewiro.github.io/party-game/](https://ewiro.github.io/party-game/)

## 本地预览

网站是纯静态页面。项目根目录运行：

```bash
node scripts/refresh.mjs
node scripts/preview.mjs
```

然后打开 `http://127.0.0.1:8080`。如果已存在 `site/games.json`，不刷新数据也可以直接预览。

## 维护清单

编辑 [`data/catalogue.tsv`](data/catalogue.tsv)。每行以 Steam AppID 开头，字段间用 `|` 分隔。新增前确认三人能一起玩，并填写人数、联机方式、类型、推荐理由、官方人数证据和核验日期。运行 `node scripts/refresh.mjs` 从 Steam 中国区商店更新中文名称、封面 URL 和价格；单款接口失败会保留上次核价结果。

运行 `node scripts/discover.mjs` 会从多组 Steam 派对、合作、欢乐和轻恐怖搜索入口发现候选，更新 [`data/candidates.tsv`](data/candidates.tsv) 和 [`reports/discovery.md`](reports/discovery.md)。候选状态包括 `pending`、`included` 和 `excluded`；候选不会未经人数核验直接发布。运行 `node scripts/validate.mjs` 检查 AppID、证据、候选状态和生成数据的一致性。

GitHub Actions 会在推送到 `main`、每日计划任务和手动触发时构建并部署 `site/` 到 GitHub Pages。另一个工作流每周更新候选台账和审核 Issue。价格只代表页面标注日期的 Steam 国区商店报价，购买前请点击游戏名核对。
