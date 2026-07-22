# HANDOFF — 数据流重构

## 1. 当前任务

重构 tinyi18n studio 的数据流，把「两棵树同步（workspace + messages）」改为「单一数据源（I18nMessage[]）」。

## 2. 已完成

### 核心改动

- **类型更新**：`packages/studio/typings/message.d.ts` — `BasicMessage` 增加 `path?: string`，`parent` 改为 `string`
- **新建 `packages/studio/src/utils/rebuild-paths.ts`** — `rebuildPaths()` 从 parent 链重建 path；`sortNodesByType()` 按父级分组排序（group 在前，message 在后）
- **新建 `packages/studio/src/utils/serialize-messages.ts`** — `serializeMessages()` 从扁平 `I18nMessage[]` 反序列化回 PUT 接口格式，通过 config 确定 namespace → entryDir 映射
- **重写 `packages/studio/src/composables/workspace/useTranslationEditor.ts`** — 全部 CRUD 按 id 操作，不再读写 `workspace`；`save` 从 `messages` 序列化
- **更新 `packages/studio/src/composables/workspace/useAssemblyMessages.ts`** — `loadMessages()` 末尾调用 `sortNodesByType()` 确保初始排序一致性
- **更新 `packages/studio/src/views/workspace/WorkspaceTreeView.vue`** — 去掉 `getPath`，增删改直接传 id

### 改动文件清单

| 文件 | 操作 |
|---|---|
| `packages/studio/typings/message.d.ts` | 修改 |
| `packages/studio/src/utils/rebuild-paths.ts` | 新建 |
| `packages/studio/src/utils/serialize-messages.ts` | 新建 |
| `packages/studio/src/composables/workspace/useAssemblyMessages.ts` | 修改 |
| `packages/studio/src/composables/workspace/useTranslationEditor.ts` | 重写 |
| `packages/studio/src/views/workspace/WorkspaceTreeView.vue` | 修改 |

### 删除的 API

- `getPath(id)`、`getSelectedKey()`、`writeValue()`、`namespaceToDirs` — 不再需要

### 保留的外部 API（签名不变）

`updateTranslation(id, locale, value)` / `updateKey(id, newKey)` / `addMessage(parentId)` / `addGroup(parentId)` / `deleteNode(id)` / `save()` / `saveImmediate()` / `isDirty`

## 3. 当前卡在哪

无阻塞。类型检查通过（仅剩两个与本次无关的预存 `props.node` undefined 警告）。开发服务器正常启动。

## 4. 下一步

- 可以清理 `useMessageTree.ts` 和 `flattenLocales.ts` 中多余的 `as any` 断言（path/parent 现在已在类型中）
- 可以评估是否删除 `scheduler.ts`（增量调度器不再需要）
- `serializeMessages.ts` 中 `ConfigEntry` 是局部定义，如果今后与 `useLocalesStore` 中的定义不同步需要统一

## 5. 踩过的坑 / 注意事项

- **不要**再往 `workspace` 写数据。`workspace` 只读，只在初始加载时用一次。
- `nanoid` 长度统一用 28（和 `flattenLocales` 一致）。
- `sortNodesByType` 是 per-parent 排序，初始加载后也被调用以保证一致性。
- `AppHeader.vue` 和 `WorkspaceDetailView.vue` 没有改，它们已经是传 id 的，不受影响。
