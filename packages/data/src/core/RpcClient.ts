/**
 * RPC Client - 类型安全的远程函数调用封装
 *
 * 将 "namespace:action" 事件转换为 api.namespace.action(...) 的调用体验
 * 完全从 WsEventDefinitions 自动推导类型
 */

import type {
  WsEventName,
  WsPayload,
  WsResponseData,
} from "./WsSchemas.js"

export interface RequestSender {
  request<E extends WsEventName>(
    event: E,
    payload: WsPayload<E>,
    timeout?: number
  ): Promise<WsResponseData<E>>
  subscribe(event: string, handler: (data: unknown) => void): () => void
  isConnected(): boolean
}

type SplitEvent<E extends string> = E extends `${infer N}:${infer A}` 
  ? { namespace: N; action: A } 
  : never

type AllNamespaces = SplitEvent<WsEventName>["namespace"]
type AllActions<N extends AllNamespaces> = SplitEvent<WsEventName> extends 
  { namespace: N; action: infer A } ? A : never

type EventForNamespace<N extends AllNamespaces, A extends string> = 
  `${N}:${A}` extends WsEventName ? `${N}:${A}` : never

type PayloadForEvent<E extends WsEventName> = WsPayload<E>
type ResponseForEvent<E extends WsEventName> = WsResponseData<E>

type NamespaceApi<N extends AllNamespaces> = {
  [A in AllActions<N>]: (
    payload: PayloadForEvent<EventForNamespace<N, A>>
  ) => Promise<ResponseForEvent<EventForNamespace<N, A>>>
}

export type RpcApi = {
  [N in AllNamespaces]: NamespaceApi<N>
}

export function createRpcApi(sender: RequestSender): RpcApi {
  const namespaceCache = new Map<string, any>()

  return new Proxy({} as RpcApi, {
    get(_: any, namespace: string) {
      if (!namespaceCache.has(namespace)) {
        namespaceCache.set(namespace, new Proxy({}, {
          get(_: any, action: string) {
            const event = `${namespace}:${action}` as WsEventName
            return async (payload: any, timeout?: number) => {
              return sender.request(event, payload, timeout)
            }
          }
        }))
      }
      return namespaceCache.get(namespace)
    }
  })
}

export function createTypedRpcApi<E extends WsEventName>(
  sender: RequestSender
): {
  request: <Ev extends E>(
    event: Ev,
    payload: WsPayload<Ev>,
    timeout?: number
  ) => Promise<WsResponseData<Ev>>
} {
  return {
    request: (event, payload, timeout) => sender.request(event, payload, timeout)
  }
}