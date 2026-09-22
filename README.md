# 三人派对游戏表

为固定三人组整理的 Steam 派对、欢乐合作与恐怖整活游戏清单。页面支持搜索、按类型和联机方式筛选、三人适配度筛选以及国区价格排序。

访问地址：[https://ewiro.github.io/](https://ewiro.github.io/)

## 本地预览

网站是纯静态页面。项目根目录运行：

```bash
node scripts/refresh.mjs
node scripts/preview.mjs
```

然后打开 `http://127.0.0.1:8080`。如果已存在 `site/games.json`，不刷新数据也可以直接预览。

## 维护清单

编辑 [`data/catalogue.tsv`](data/catalogue.tsv)。每行以 Steam AppID 开头，字段间用 `|` 分隔。新增前确认三人能一起玩，并写明人数、联机方式、类型和推荐理由。运行 `node scripts/refresh.mjs` 从 Steam 中国区商店更新中文名称、封面 URL 和价格；单款接口失败会保留上次核价结果。

GitHub Actions 会在推送到 `main`、每日计划任务和手动触发时构建并部署 `site/` 到 GitHub Pages。价格只代表页面标注日期的 Steam 国区商店报价，购买前请点击游戏名核对。
