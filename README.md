# TinyI18n cli

`tinyi18n-cli` 是一个轻量级、开箱即用的前端国际化 (i18n) 管理工具和开发套件。它提供了一个基于 Web 的 Studio UI 界面，帮助你在本地更高效地管理多语言词条，并能自动与代码库中的 JSON/JS 文件进行双向同步。

## 📦 安装

推荐作为项目的开发依赖进行安装：

```bash
# npm
npm install tinyi18n-cli -D

# yarn
yarn add tinyi18n-cli -D

# pnpm
pnpm add tinyi18n-cli -D
```

当然，你也可以全局安装直接使用，或者通过 `npx` 直接运行：

```bash
npx tinyi18n
```

## 🚀 快速开始

在你的前端项目根目录中，直接运行 `tinyi18n` 即可启动服务：

```bash
npx tinyi18n
```

- 如果这是你**第一次**在这个项目中使用 `tinyi18n`，它会自动引导你完成初始化配置，并在浏览器中打开配置页面。
- 如果已经配置过，它会启动本地的 Studio 服务，并打开浏览器让你管理多语言词条。
- 需要将词条生成到源码时，可以运行 `npx tinyi18n generate`，也可以使用短命令 `npx tinyi18n g`。

## ⚙️ 配置说明

初始化完成后，会在你的项目根目录的 `.tinyi18n` 文件夹下生成一个 `config.ts` 配置文件。一个典型的配置如下：

```typescript
import { defineConfig } from 'tinyi18n-cli'

export default defineConfig({
  // 默认语言（如果设置，Studio 在展示翻译时会优先显示此语言）
  defaultLocale: 'zh-CN',
  // 你需要维护的语言列表
  locales: [
    { code: 'zh-CN', filename: 'zh.json' },
    { code: 'en-US', filename: 'en.json' },
  ],
  // 如果需要同步 JSON 数据到代码文件，可以配置 entries
  entries: [
    {
      // 生成的源码目录
      dir: './src/i18n',
      // 你希望导出到这个目录的路径过滤规则。
      // 可以是空数组（导出所有词条），也可以指定如 "pages.home", "components.*" 等层级路径。
      paths: [],
    },
  ],
})
```

## ✨ 核心特性

- **Web Studio**: 内置现代化且功能丰富的 Web UI 界面，提供树状图/表格视图来编辑词条。
- **配置文件**: 采用 `.tinyi18n/config.json` 进行配置。
- **多入口同步**: 除了生成纯 JSON 文件外，还能配置生成 JS/TS 文件，方便在前端源码中直接导入使用。
- **自动检测与无缝接入**: 无需复杂的配置即可跑起来，对现有基于 JSON 存储的多语言项目有极好的兼容性。

## 📄 许可证

[MIT License](./LICENSE)
