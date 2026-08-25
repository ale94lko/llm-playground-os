import type { StreamRequest } from '~/types/llm'
import {
  resolveStreamEndpoint,
  streamCompletionDirect,
  streamCompletionViaProxy,
  type StreamCallbacks,
} from '~/lib/streamClient'

export type { StreamCallbacks }

export function useLLMStream() {
  const providerStore = useProviderStore()

  async function streamCompletion(
    request: StreamRequest,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const endpoint = resolveStreamEndpoint(providerStore.streamProxyUrl)

    if (endpoint) {
      await streamCompletionViaProxy(endpoint, request, callbacks, signal)
      return
    }

    await streamCompletionDirect(request, callbacks, signal)
  }

  return { streamCompletion }
}
