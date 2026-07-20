import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline'

/**
 * 将旧版 `scripts/data.json` 转换为 YAML 格式：
 * - `data/.skeleton.yaml` — 命名空间索引
 * - `data/{ns}/.skeleton.yaml` — per-namespace 树骨架
 * - `data/{ns}/{locale}.yaml` — per-namespace 翻译
 * - `config.yaml` — 配置（locales、defaultLocale、namespaces）
 *
 * 旧数据约定：
 * - 每个 item 有 id / parent / type / key / title / translations
 * - parent 为 '' 或无 parent 的节点为根节点
 */

const DEFAULT_INPUT_FILE = 'scripts/data.json'

// ─── YAML 序列化 ──────────────────────────────────────────

function yamlEscape(value) {
  const s = String(value)
  if (s === '' || /[:[\]{},&*?|<>=!%@`#\n]/.test(s) || /^\d/.test(s)) {
    return JSON.stringify(s)
  }
  return s
}

function yamlLines(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  const lines = []

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined)
      continue

    if (typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${pad}${key}:`)
      lines.push(...yamlLines(value, indent + 1))
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`)
      } else {
        lines.push(`${pad}${key}:`)
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            lines.push(`${pad}  -`)
            lines.push(...yamlLines(item, indent + 2))
          } else {
            lines.push(`${pad}  - ${yamlEscape(item)}`)
          }
        }
      }
    } else {
      lines.push(`${pad}${key}: ${yamlEscape(value)}`)
    }
  }

  return lines
}

function yamlDump(obj) {
  return `${yamlLines(obj).join('\n')}\n`
}

// ─── JSON 流式解析 ────────────────────────────────────────

function createBraceScanner() {
  return { inString: false, escaped: false }
}

function scanBraceDelta(line, scanner) {
  let delta = 0
  for (const char of line) {
    if (scanner.escaped) {
      scanner.escaped = false
      continue
    }
    if (scanner.inString) {
      if (char === '\\') {
        scanner.escaped = true
        continue
      }
      if (char === '"') {
        scanner.inString = false
      }
      continue
    }
    if (char === '"') {
      scanner.inString = true
      continue
    }
    if (char === '{') {
      delta += 1
      continue
    }
    if (char === '}') {
      delta -= 1
    }
  }
  return delta
}

async function streamArrayObjects(filePath, arrayKey, onItem) {
  const input = createReadStream(filePath, { encoding: 'utf8' })
  const lineReader = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })

  let inArray = false
  let objectDepth = 0
  let objectLines = []
  let scanner = createBraceScanner()

  try {
    for await (const line of lineReader) {
      const trimmed = line.trim()

      if (!inArray) {
        if (new RegExp(`"${arrayKey}"\\s*:\\s*\\[`).test(trimmed)) {
          inArray = true
        }
        continue
      }

      if (objectDepth === 0) {
        if (trimmed.startsWith(']'))
          break
        const braceIndex = line.indexOf('{')
        if (braceIndex < 0)
          continue
        objectLines = [line.slice(braceIndex)]
        scanner = createBraceScanner()
        objectDepth = scanBraceDelta(objectLines[0], scanner)
      } else {
        objectLines.push(line)
        objectDepth += scanBraceDelta(line, scanner)
      }

      if (objectDepth === 0 && objectLines.length > 0) {
        await onItem(JSON.parse(objectLines.join('\n').replace(/,\s*$/, '')))
        objectLines = []
      }
    }
  } finally {
    lineReader.close()
    input.destroy()
  }
}

// ─── 主逻辑 ───────────────────────────────────────────────

async function main() {
  const isSimple = process.argv.includes('--simple')
  const simpleNs = isSimple ? process.argv[process.argv.indexOf('--simple') + 1] || '' : ''
  const suffix = isSimple ? '-simple' : '-multi'
  const outDir = path.resolve(process.cwd(), `scripts/.tinyi18n${suffix}`)
  const inputFile = path.resolve(process.cwd(), DEFAULT_INPUT_FILE)
  // const outDir = path.resolve(process.cwd(), DEFAULT_OUTPUT_DIR)

  const items = []
  await streamArrayObjects(inputFile, 'items', item => items.push(item))

  if (items.length === 0) {
    throw new Error(`No items found in ${inputFile}`)
  }

  // 收集所有语言
  const locales = new Set()
  for (const item of items) {
    if (item?.type !== 'message' || !item.translations)
      continue
    for (const locale of Object.keys(item.translations)) {
      locales.add(locale)
    }
  }
  const sortedLocales = [...locales].sort((a, b) => {
    if (a === 'zh-CN')
      return -1
    if (b === 'zh-CN')
      return 1
    return a.localeCompare(b)
  })

  // 为每个节点生成 nanoid，建立新旧 id 映射
  const oldToNew = new Map()
  const nodeIds = []
  for (const item of items) {
    const newId = nanoid(11)
    oldToNew.set(item.id, newId)
    nodeIds.push(newId)
  }

  // 构建节点数据（用新 id）
  const nodes = {}
  for (const item of items) {
    const newId = oldToNew.get(item.id)
    const isNamespace = item.type === 'group' && !item.parent
    const node = {
      type: isNamespace ? 'namespace' : item.type,
      key: item.key ?? '',
      $parent: item.parent ? oldToNew.get(item.parent) || null : null,
    }

    if (item.type === 'group') {
      node.$label = item.title ?? ''
    }

    nodes[newId] = node
  }

  const dataDir = path.join(outDir, 'data')

  await mkdir(dataDir, { recursive: true })

  // 构建 dataContent 和 nsRoots（if/else 两个分支都需要）
  const dataContent = {}
  for (const id of nodeIds) dataContent[id] = nodes[id]

  const nsRoots = {}
  const nsLookup = new Map()
  for (const [id, node] of Object.entries(dataContent)) {
    if (!node)
      continue
    if (node.type === 'namespace') {
      nsRoots[id] = { node, children: {} }
      nsLookup.set(id, id)
    }
  }
  const findNsRoot = (id) => {
    let cursor = id
    let depth = 0
    while (cursor && depth < 100) {
      if (nsLookup.has(cursor))
        return cursor
      const node = dataContent[cursor]
      if (!node)
        return null
      const p = node.$parent
      if (!p)
        return null
      cursor = p
      depth++
    }
    return null
  }
  for (const [id, node] of Object.entries(dataContent)) {
    if (!node)
      continue
    if (node.type !== 'namespace') {
      const rootId = findNsRoot(id)
      if (rootId && nsRoots[rootId])
        nsRoots[rootId].children[id] = node
    }
  }

  // ─── 写入数据 ──────────────────────────────────────
  if (isSimple && simpleNs) {
    const target = Object.entries(nsRoots).find(([_id, ns]) => ns.node.key === simpleNs)
    if (!target)
      throw new Error(`Namespace "${simpleNs}" not found`)
    const [targetId, targetNs] = target
    const allIds = new Set([targetId, ...Object.keys(targetNs.children)])
    const flatData = {}
    for (const id of allIds) {
      flatData[id] = { ...dataContent[id] }
      if (flatData[id]?.type === 'namespace')
        flatData[id].key = '__DEFAULT__'
    }

    await writeFile(path.join(dataDir, '.skeleton.yaml'), yamlDump({
      file: '.skeleton.yaml',
      desc: '树骨架',
      data: flatData,
    }))

    for (const locale of sortedLocales) {
      const translations = {}
      for (const item of items) {
        if (item.type !== 'message' || !item.translations?.[locale])
          continue
        const newId = oldToNew.get(item.id)
        if (allIds.has(newId))
          translations[newId] = item.translations[locale]
      }
      const sorted = {}
      for (const id of Object.keys(translations).sort()) sorted[id] = translations[id]
      await writeFile(path.join(dataDir, `${locale}.yaml`), yamlDump({
        file: `${locale}.yaml`,
        desc: `${locale} 翻译数据`,
        data: sorted,
      }))
    }

    const config = {
      mode: 'single',
      defaultLocale: sortedLocales.includes('zh-CN') ? 'zh-CN' : sortedLocales[0],
      locales: sortedLocales.map(code => ({ label: code === 'zh-CN' ? '简体中文' : code === 'en' ? 'English' : code, code })),
      entries: [{ dir: 'src/locales' }],
    }
    await writeFile(path.join(outDir, 'config.yaml'), yamlDump(config))
  } else {
  // 多命名空间模式
    const dataContent = {}
    for (const id of nodeIds) dataContent[id] = nodes[id]

    const dataFile = { file: '__data.yaml', desc: '数据文件 禁止删除' }
    const rootGroups = items.filter(item => item?.type === 'group' && !item.parent)
    if (rootGroups.length > 1) {
      const nsIndex = {}
      for (const g of rootGroups) {
        const newId = oldToNew.get(g.id)
        nsIndex[newId] = { $key: g.key || '', $desc: g.title || '', $label: g.title || g.key || '' }
      }
      dataFile.namesapce = nsIndex
    }

    const nsRoots = {}
    const nsLookup = new Map()
    for (const [id, node] of Object.entries(dataContent)) {
      if (!node)
        continue
      if (node.type === 'namespace') {
        nsRoots[id] = { node, children: {} }
        nsLookup.set(id, id)
      }
    }
    const findNsRoot = (id) => {
      let cursor = id
      let depth = 0
      while (cursor && depth < 100) {
        if (nsLookup.has(cursor))
          return cursor
        const node = dataContent[cursor]
        if (!node)
          return null
        const p = node.$parent
        if (!p)
          return null
        cursor = p
        depth++
      }
      return null
    }
    for (const [id, node] of Object.entries(dataContent)) {
      if (!node)
        continue
      if (node.type !== 'namespace') {
        const rootId = findNsRoot(id)
        if (rootId && nsRoots[rootId])
          nsRoots[rootId].children[id] = node
      }
    }

    function sortByType(entries) {
      const groups = {}
      const messages = {}
      for (const [id, node] of Object.entries(entries)) {
        if (node.type === 'message')
          messages[id] = node
        else groups[id] = node
      }
      return { ...groups, ...messages }
    }

    for (const [nsId, ns] of Object.entries(nsRoots)) {
      const nsKey = ns.node.key
      if (!nsKey)
        continue
      const nsDir = path.join(dataDir, nsKey)
      await mkdir(nsDir, { recursive: true })
      const sortedChildren = sortByType(ns.children)
      await writeFile(path.join(nsDir, '.skeleton.yaml'), yamlDump({
        file: '.skeleton.yaml',
        desc: `命名空间 ${nsKey} 的树骨架`,
        data: { [nsId]: ns.node, ...sortedChildren },
      }))
      const nsIds = new Set([nsId, ...Object.keys(ns.children)])
      for (const locale of sortedLocales) {
        const translations = {}
        for (const item of items) {
          if (item.type !== 'message' || !item.translations?.[locale])
            continue
          const newId = oldToNew.get(item.id)
          if (nsIds.has(newId))
            translations[newId] = item.translations[locale]
        }
        const sorted = {}
        for (const id of Object.keys(translations).sort()) sorted[id] = translations[id]
        await writeFile(path.join(nsDir, `${locale}.yaml`), yamlDump({
          file: `${locale}.yaml`,
          desc: `${locale} 翻译数据`,
          data: sorted,
        }))
      }
    }

    const config = {
      mode: 'multi',
      defaultLocale: sortedLocales.includes('zh-CN') ? 'zh-CN' : sortedLocales[0],
      namespaces: Object.keys(nsRoots).map(nsId => ({
        key: nsRoots[nsId].node.key,
        description: nsRoots[nsId].node.$desc || nsRoots[nsId].node.$label || '',
      })),
      locales: sortedLocales.map(code => ({ label: code === 'zh-CN' ? '简体中文' : code === 'en' ? 'English' : code, code })),
      entries: [
        { dir: 'node_modules/.apps/admin/src/locales', namespaces: ['shared'] },
        { dir: 'node_modules/.apps/console/src/locales', namespaces: ['console', 'shared'] },
        { dir: 'node_modules/.apps/website/src/locales', namespaces: ['website', 'shared'] },
        { dir: 'node_modules/.apps/sso/src/locales', namespaces: ['sso', 'shared'] },
      ],
    }
    await writeFile(path.join(outDir, 'config.yaml'), yamlDump(config))
  }

  console.log(`Converted ${items.length} nodes from ${path.relative(process.cwd(), inputFile)}`)
  console.log(`├── config.yaml  ---> 配置文件（entries、locales 等）`)
  console.log(`└── data  ---> 数据文件目录`)
  console.log(`    ├── .skeleton.yaml  ---> 树骨架`)
  if (isSimple) {
    for (let li = 0; li < sortedLocales.length; li++) {
      const locale = sortedLocales[li]
      const isLastLocale = locale === sortedLocales[sortedLocales.length - 1]
      console.log(`    ${isLastLocale ? '└' : '├'}── ${locale}.yaml  ---> ${locale} 翻译`)
    }
  } else {
    for (const [nsId, ns] of Object.entries(nsRoots)) {
      const nsDesc = ns.node.$desc || ns.node.$label || ns.node.key || ''
      const isLast = nsId === [...Object.keys(nsRoots)].pop()
      const nsKey = ns.node.key
      const prefix = isLast ? '    ' : '│   '
      console.log(`    ${isLast ? '└' : '├'}── ${nsKey}  ---> ${nsDesc}`)
      console.log(`    ${prefix}├── .skeleton.yaml  ---> 树骨架`)
      for (let li = 0; li < sortedLocales.length; li++) {
        const locale = sortedLocales[li]
        const isLastLocale = locale === sortedLocales[sortedLocales.length - 1]
        console.log(`    ${prefix}${isLastLocale ? '└' : '├'}── ${locale}.yaml  ---> ${locale} 翻译`)
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
// ─── nanoid ────────────────────────────────────────────────

const NANOID_ALPH = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

function nanoid(size = 11) {
  const bytes = randomBytes(size)
  let id = ''
  for (let i = 0; i < size; i++) {
    id += NANOID_ALPH[bytes[i] & 63]
  }
  return id
}

// ─── YAML 序列化 ──────────────────────────────────────────
