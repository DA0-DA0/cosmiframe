import {
  AminoSignResponse,
  OfflineAminoSigner,
  StdSignDoc,
} from '@cosmjs/amino'
import {
  AccountData,
  DirectSignResponse,
  OfflineDirectSigner,
} from '@cosmjs/proto-signing'

import {
  ListenOptions,
  MethodCallResultMessage,
  RequestMethodCallMessage,
} from './types'
import { callParentMethod, processOverrideHandler } from './utils'

export class Cosmiframe {
  /**
   * Proxy object that can be used to call methods on the parent frame. This
   * serves as a passthrough and is a convenient alternative to using
   * `callParentMethod`. This should be used by the iframe.
   *
   * For example:
   *
   * const cosmiframe = new Cosmiframe()
   * const accounts = await cosmiframe.p.getAccounts()
   */
  public p: { [key: string]: <T = any>(...params: any[]) => Promise<T> }

  constructor() {
    this.p = new Proxy(
      {},
      {
        get:
          (_, name) =>
          <T = any>(...params: any[]) =>
            callParentMethod<T>({
              method: name.toString(),
              params,
            }),
      }
    )
  }

  /**
   * Call a method on the parent frame. This should be used by the iframe.
   */
  callParentMethod<T = any>(
    options: Pick<RequestMethodCallMessage, 'method' | 'params'>
  ): Promise<T> {
    return callParentMethod<T>(options)
  }

  /**
   * Get an offline amino signer that forwards requests to the parent frame. The
   * parent frame must be listening (using the `listen` function). This should
   * be used by the iframe.
   */
  getOfflineSignerAmino(chainId: string): IframeAminoSigner {
    return new IframeAminoSigner(chainId)
  }

  /**
   * Get an offline direct signer that forwards requests to the parent frame.
   * The parent frame must be listening (using the `listen` function). This
   * should be used by the iframe.
   */
  getOfflineSignerDirect(chainId: string): IframeDirectSigner {
    return new IframeDirectSigner(chainId)
  }

  /**
   * Listen for requests from the provided iframe. This should be used by the
   * parent. Returns a function that can be called to stop listening.
   */
  listen(options: ListenOptions): () => void {
    const {
      iframe,
      target,
      getOfflineSignerDirect,
      getOfflineSignerAmino,
      nonSignerOverrides,
      signerOverrides,
    } = options

    const listener = async ({
      source,
      data,
    }: MessageEvent<RequestMethodCallMessage>) => {
      // Verify iframe window exists.
      if (!iframe.contentWindow) {
        throw new Error('Iframe contentWindow does not exist.')
      }

      // Verify event is coming from the iframe.
      if (source !== iframe.contentWindow) {
        return
      }

      // Verify message contains required fields.
      if (
        !data ||
        typeof data !== 'object' ||
        !('id' in data) ||
        !('method' in data) ||
        !('params' in data)
      ) {
        return
      }

      const { id, params, chainId, signType } = data
      let { method, signerType } = data

      // Backwards compatibility.
      signerType ||= signType
      method = method.replace(/^signer:/, '')

      let msg: Omit<MethodCallResultMessage, 'id'> | undefined
      try {
        if (signerType) {
          if (!chainId) {
            throw new Error('Missing chainId in signer message request')
          }

          // Try signer override method.
          const overrides =
            typeof signerOverrides === 'function'
              ? signerOverrides()
              : signerOverrides
          if (overrides && method in overrides) {
            const handledMsg = processOverrideHandler(
              await overrides[method](...params)
            )
            if (handledMsg) {
              msg = handledMsg
            }
          }

          // If override does not handle it, call the original method.
          if (!msg) {
            const signer =
              signerType === 'direct'
                ? await getOfflineSignerDirect(chainId)
                : await getOfflineSignerAmino(chainId)
            if (
              !(method in signer) ||
              typeof signer[method as keyof typeof signer] !== 'function'
            ) {
              throw new Error(
                `No ${signerType} signer method '${method}' for chain ID '${chainId}'.`
              )
            }

            const response = await (
              signer[method as keyof typeof signer] as (...params: any[]) => any
            )(...params)

            msg = {
              type: 'success',
              response,
            }
          }
        } else {
          // Try override method.
          const overrides =
            typeof nonSignerOverrides === 'function'
              ? nonSignerOverrides()
              : nonSignerOverrides

          if (overrides && method in overrides) {
            const handledMsg = processOverrideHandler(
              await overrides[method](...params)
            )
            if (handledMsg) {
              msg = handledMsg
            }
          }

          // If override does not handle it, call the original method.
          if (!msg) {
            if (!(method in target) || typeof target[method] !== 'function') {
              throw new Error(`No method '${method}' on target.`)
            }

            const response = await target[method](...params)

            msg = {
              type: 'success',
              response,
            }
          }
        }
      } catch (err) {
        msg = {
          type: 'error',
          error: err instanceof Error ? err.message : `${err}`,
        }
      }

      iframe.contentWindow.postMessage(
        {
          ...msg,
          id,
        },
        '*'
      )
    }

    // Listen.
    window.addEventListener('message', listener)

    // Return a function to stop listening.
    return () => window.removeEventListener('message', listener)
  }
}

export class IframeDirectSigner implements OfflineDirectSigner {
  constructor(public chainId: string) {}

  async getAccounts(): Promise<readonly AccountData[]> {
    return callParentMethod<readonly AccountData[]>({
      method: 'getAccounts',
      params: [],
      chainId: this.chainId,
      signerType: 'direct',
    })
  }

  async signDirect(
    signerAddress: string,
    signDoc: DirectSignResponse['signed']
  ): Promise<DirectSignResponse> {
    return callParentMethod<DirectSignResponse>({
      method: 'signDirect',
      params: [signerAddress, signDoc],
      chainId: this.chainId,
      signerType: 'direct',
    })
  }
}

export class IframeAminoSigner implements OfflineAminoSigner {
  constructor(public chainId: string) {}

  async getAccounts(): Promise<readonly AccountData[]> {
    return callParentMethod<readonly AccountData[]>({
      method: 'getAccounts',
      params: [],
      chainId: this.chainId,
      signerType: 'amino',
    })
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    return callParentMethod<AminoSignResponse>({
      method: 'signAmino',
      params: [signerAddress, signDoc],
      chainId: this.chainId,
      signerType: 'amino',
    })
  }
}
