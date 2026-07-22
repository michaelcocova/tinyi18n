export {}

declare global {
  type Recordable<T = any> = Record<string, T>

  export interface BasicMessage {
    id: string
    key: string
    parent?: string
    path?: string
  }

  export interface GroupMessage extends BasicMessage {
    type: 1
  }

  export interface MessageMessage extends BasicMessage {
    type: 2
    translations: Record<string, string>
  }

  export type I18nMessage = GroupMessage | MessageMessage

}
