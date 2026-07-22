import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createError, defineEventHandler, readBody } from 'nitro/h3'
import { getProjectRoot } from '../../utils/project-root.ts'

function sortKeys(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = sortKeys(val)
    }
    else {
      result[key] = val
    }
  }
  return result
}

export default defineEventHandler(async (event) => {
  const root = getProjectRoot()
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  for (const [dir, localeMap] of Object.entries(body as any)) {
    if (!localeMap || typeof localeMap !== 'object')
      continue
    for (const [locale, data] of Object.entries(localeMap as any)) {
      if (!data || typeof data !== 'object')
        continue
      const dirPath = path.resolve(root, dir)
      if (!existsSync(dirPath))
        mkdirSync(dirPath, { recursive: true })
      writeFileSync(
        path.join(dirPath, `${locale}.json`),
        `${JSON.stringify(sortKeys(data), null, 2)}\n`,
        'utf-8',
      )
    }
  }

  return { ok: true }
})
