import type { ZodType } from 'zod'
import type {
  FilterPickerConfig,
  FilterPickerItem,
  FilterPickerRule,
  FilterPickerRuleOptionsConfig,
  Recordable,
} from './types'

export interface NormalizedFilterPickerRule {
  validate?: ZodType<unknown>
  visible?: boolean | ((values: Recordable, conditions: Recordable) => boolean)
  disabled?: boolean | ((values: Recordable, conditions: Recordable) => boolean)
  defaultValue?: unknown | ((values: Recordable, conditions: Recordable) => unknown)
  normalize?: (value: unknown, values: Recordable, conditions: Recordable) => unknown
  options?: FilterPickerRuleOptionsConfig<Recordable>
}

export function isZodRule(rule: FilterPickerRule | undefined): rule is ZodType<unknown> {
  return rule != null && typeof rule === 'object' && 'safeParse' in rule && typeof rule.safeParse === 'function'
}

export function normalizeRule(rule: FilterPickerRule | undefined): NormalizedFilterPickerRule {
  if (rule == null) {
    return {}
  }

  if (isZodRule(rule)) {
    return {
      validate: rule,
    }
  }

  return rule as NormalizedFilterPickerRule
}

export function getItemRule(
  config: FilterPickerConfig,
  item: FilterPickerItem,
) {
  return config.rules?.[item.field]
}

export function resolveRulePredicate(
  predicate: boolean | ((values: Recordable, conditions: Recordable) => boolean) | undefined,
  fallback: boolean,
  values: Recordable,
  conditions: Recordable,
) {
  if (predicate == null) {
    return fallback
  }

  if (typeof predicate === 'boolean') {
    return predicate
  }

  return predicate(values, conditions)
}

export function resolveRuleDefaultValue(
  defaultValue: unknown | ((values: Recordable, conditions: Recordable) => unknown) | undefined,
  values: Recordable,
  conditions: Recordable,
) {
  if (typeof defaultValue === 'function') {
    return defaultValue(values, conditions)
  }

  return defaultValue
}
