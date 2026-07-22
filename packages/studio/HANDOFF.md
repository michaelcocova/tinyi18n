# HANDOFF.md

## 当前状态

前端已精简为最简形态：读取 → deepMerge → flatten → 表格展示。

## 数据流

```
tinyi18n.config.json
  ├─ GET /api/config → 配置数组
  └─ GET /api/locales → { dir: { locale: { key: value } } }
                            ↓
              useLocalesStore.load()
              ├─ deepMerge 合并同一 locale 的跨目录数据
              ├─ flattenObject 转为扁平 dot notation
              └─ 构建 byLocale / namespaceToDirs / keyToNamespace

              WorkspacePage.vue
              └─ 表格展示 key + 各 locale 值
```

## 服务端

`packages/studio/server/routes/api/` 下三个路由：
- `config.get.ts` — GET /api/config
- `locales.get.ts` — GET /api/locales
- `locales.put.ts` — PUT /api/locales

旧路由已全部删除。

## 前端核心文件

- `src/App.vue` — 入口，加载态/错误态/主页面
- `src/composables/workspace/useLocalesStore.ts` — 核心 store
- `src/views/WorkspacePage.vue` — 表格展示
- `src/composables/io/scheduler.ts` — 防抖调度器（store 依赖）
- `src/router/index.ts` — 两个路由都指向 WorkspacePage

其他旧代码（workspace views、composables、layout、filter-picker、search-box 等）已全部删除。

## 测试数据

`packages/studio/` 下已有：
- `tinyi18n.config.json` — 4 个目录的配置
- `.apps/{admin,console,website,sso}/src/locales/{en,zh-CN}.json`

## 启动

```sh
cd packages/studio && pnpm dev
```

## 遗留

- `components/ui/` 保留了大量未使用的 UI 组件（不碍事，自动导入）
- `utils/confirm.ts` `utils/sleep.ts` 目前无引用，可后续清理
