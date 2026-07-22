#!/usr/bin/env node

import { realpathSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { runCli } from './app.ts'

function isCliEntry() {
  if (!process.argv[1]) {
    return false
  }

  try {
    return (
      realpathSync(process.argv[1])
      === realpathSync(fileURLToPath(import.meta.url))
    )
  } catch {
    return false
  }
}

if (isCliEntry()) {
  runCli().catch((err) => {
    console.error(
      `\x1B[31m执行出错：${err instanceof Error ? err.message : String(err)}\x1B[0m`,
    )
    process.exitCode = 1
  })
}
