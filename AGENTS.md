 # 项目 AGENTS.md — tinyi18n 存储与编码约定

 ## 存储设计

 ### 文件结构
 ```
 .tinyi18n/
 ├── config.yaml       ← 配置（locales、defaultLocale、entries）
 ├── __data__.yaml     ← 树骨架（节点定义，不含翻译值）
 └── data/
     ├── zh-CN.yaml    ← id → 翻译值
     └── en.yaml
 ```

 ### `__data__.yaml`
 ```yaml
 file: __data.yaml
 desc: 数据文件 禁止删除
 namesapce:                    # 仅多命名空间时存在
   nsId1:
     $key: website
     $desc: 官网
     $label: 官网
 data:
   id1:
     type: namespace           # 根节点类型
     key: website
     $parent: null
     $label: 官网
   id2:
     type: group               # 嵌套分组
     key: navbar
     $parent: id1
     $label: 导航栏
   id5:
     type: message             # 叶子节点
     key: title
     $parent: id2
 ```
 - 每个节点（group + message）有 `nanoid(11)` 唯一 id
 - 根 level 的 group → `type: namespace`，嵌套 group → `type: group`，message → `type: message`
 - 父子关系用 `$parent` 引用，根节点为 `null`
 - group 节点有 `$label`，message 没有

 ### `data/{locale}.yaml`
 ```yaml
 file: zh-CN.yaml
 desc: zh-CN 翻译数据 禁止删除
 data:
   id5: 标题
   id6: 登录
 ```
 - 拍平的 `id: translation`，按 id 排序输出

 ### `config.yaml`
 ```yaml
 filename: .data
 mode: multi
 defaultLocale: zh-CN
 locales:
   - code: zh-CN
     filename: zh-CN.json
   - code: en
     filename: en.json
 entries:
   - dir: node_modules/.apps/website/src/locales
     namespaces: [website, shared]
 ```
 - `entries` 定义 namespace → 目标目录的映射关系

 ## 数据模型约定

 - 同父级下，group（含 namespace）始终排在 message 之前
 - 此排序由 `sortNodesByType()` 在每次插入后自动维护
 - 不要手动修改数组顺序

 ## 节点操作

 - 新建节点自动分配 `nanoid(11)`，旧数据结构中的 id 不再使用
 - 右键菜单：`WorkspaceTreeNode.vue` 使用 `ContextMenu`（reka-ui）+ 硬编码的菜单项
 - 插入操作（`insertNode`、`createChildMessages`、`insertSiblingGroup`、`insertSiblingMessages`）后自动调用 `sortNodesByType()`
 - 新节点创建后自动选中并进入 key 编辑状态

 ## `transform.mjs` 注意事项

 - 路径：`packages/studio/scripts/transform.mjs`
 - 将旧版 `scripts/data.json`（items + parent + index）转换为新 YAML 格式
 - 需要 `scripts/data.json` 在磁盘上才能运行，目前仅存在于 git stage 中
 - nanoid 内联实现（不依赖外部包），使用 `node:crypto.randomBytes`
 - YAML 序列化也是内联实现（`yamlDump` / `yamlLines` / `yamlEscape`）

 ## 会话结束记录规则

 - 每次会话结束前，把交接信息写到 `HANDOFF.md`
 - 交接内容必须让下一个 AI 不看聊天记录，也能快速知道项目状态
 - 至少覆盖 5 点：
   1. 当前在做什么任务
   2. 已经完成了什么
   3. 当前卡在哪
   4. 下一步计划是什么
   5. 有哪些踩过的坑绝对不要再踩
 - 写交接时优先写事实状态和可执行结论
 - 如果改动过代码、文档、脚本、启动方式、端口、依赖或已知问题，检查 `HANDOFF.md` 是否需要同步更新
 - 交接记录必须和真实代码状态保持一致
