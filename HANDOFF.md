# HANDOFF

## 当前状态

tinyi18n 的存储格式已从旧版 JSON(TISF) 完全迁移到新版 YAML 结构。CLI 和 Studio 均编译通过。

## 文件结构

```
.tinyi18n/
├── config.yaml           ← 配置（locales, defaultLocale, entries）
├── __data__.yaml         ← 树骨架（所有节点，含 file/desc/namesapce/data 头部）
└── data/
    ├── zh-CN.yaml        ← 拍平的 id → translation（按 id 排序）
    └── en.yaml
```

## 已完成的改动

1. `config.json` → `config.yaml` — 配置读写全部 YAML
2. 数据文件 JSON → YAML 内容 — `tisf.ts` 所有读写函数
3. 文件扩展名 `.json` → `.yaml` — 全局统一
4. 清理 tisf.ts 死代码 — 删除流式解析器、`readTisfNamespaceMeta`、`streamTisfTopLevelNodes`、`collectItemsFromTisf`、`normalizeItemsToPathBasedIds` 已保留（被 `apply.ts` 使用）、`buildTisfNamespaceObject`、`buildPathId`。文件从 614 行 → 246 行
5. `init.ts` 创建 `__data__.yaml` + data/ 目录
6. Reader/Writer 适配新格式：
   - `loadWorkspaceNamespaceItems` 读 `__data__.yaml` + `data/*.yaml`
   - `writeWorkspaceNamespaceFile` 写 `__data__.yaml` + `data/*.yaml`
   - `store.ts` 传 `projectRoot` 参数

## 数据流

```
读取：__data__.yaml(树) + data/*.yaml(翻译) → 合并 → TinyI18nItem[]
写入：TinyI18nItem[] → 拆分为树+翻译 → __data__.yaml + data/*.yaml
初始化：config + namespaces → __data__.yaml + per-namespace 兼容文件
```

## 依赖

- CLI 包: `js-yaml`
- Studio 包: `js-yaml`
- nanoid(11) 内联实现于 `transform.mjs` 和 `init.ts`

## 注意事项

1. `__data__.yaml` 中 `type: namespace` 在 TinyI18nItem 中转为 `type: 'group'`（类型系统无 'namespace'），通过 `parent === undefined` 区分
2. 写入时 `type: 'group'` 且 `parent === undefined` 的项写回 `__data__.yaml` 时转为 `type: 'namespace'`
3. `workspaceDataDir` 已导入 tisf.ts，用于构造 data/ 路径
4. `scripts/data.json` 不在磁盘上（在 git stage 中），`transform.mjs` 暂无法运行

## 剩余待做

1. Studio worker 适配（当前服务器 API 返回格式不变，暂不影响）
2. 恢复 `scripts/data.json` 运行 `transform.mjs` 验证
3. 删除 `createDefaultDataSource` 和旧的 per-namespace 文件兼容代码
4. 清理 `_target` 参数收尾（已在函数签名中去除）
