export {}
declare global {
  type self = Window
  type Writable<T> = {
    -readonly [P in keyof T]: T[P];
  }

  type MaybeArray<T> = T | T[]
  type Nullable<T> = T | null
  type Recordable<T = any> = Record<string, T>

  /**
   * Void function
   */
  type Fn = () => void
  /**
   * Any function
   */
  type AnyFn = (...args: any[]) => any

  type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
  }

  export type DeepRequiredNonNullable<T> = T extends (infer U)[]
    ? DeepRequiredNonNullable<U>[]
    : T extends object
      ? { [K in keyof T]-?: DeepRequiredNonNullable<NonNullable<T[K]>> }
      : NonNullable<T>

  type TimeoutHandle = ReturnType<typeof setTimeout>
  type IntervalHandle = ReturnType<typeof setInterval>

  export type DeepReadonly<T> = {
    readonly [K in keyof T]: T[K] extends Array<any>
      ? DeepReadonly<T[K]>
      : T[K];
  }

  export type NoReadonly<T> = {
    -readonly [K in keyof T]: T[K] extends ReadonlyArray<any>
      ? NoReadonly<T[K]>
      : T[K];
  }

  export type RequiredUtils<T> = T extends undefined ? never : T

  export type PromiseFn<T = any> = (...args: any) => Promise<T>

  export interface LabelValue<T = string | number> {
    label: string
    value: T
  }
}
