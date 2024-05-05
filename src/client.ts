import { Keplr, SecretUtils } from '@keplr-wallet/types'

import {
  CosmiframeAminoSigner,
  CosmiframeDirectSigner,
  CosmiframeEitherSigner,
} from './signers'
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
      {
        // `getEnigmaUtils` is expected to return an object with functions;
        // override them with proxied functions instead. This follows Keplr's
        // SecretUtils interface.
        getEnigmaUtils: (chainId: string) =>
          ({
            getPubkey: () => this.p.getEnigmaPubKey(chainId),
            decrypt: (...params) => this.p.enigmaDecrypt(chainId, ...params),
            encrypt: (...params) => this.p.enigmaEncrypt(chainId, ...params),
            getTxEncryptionKey: (...params) =>
              this.p.getEnigmaTxEncryptionKey(chainId, ...params),
          }) as SecretUtils,
      } as any,
      {
        get: (obj, name) =>
          // Override variables.
          name in obj && typeof obj[name as keyof typeof obj] !== 'function'
            ? obj[name as keyof typeof obj]
            : // Override functions.
              <T = any>(...params: any[]) =>
                name in obj &&
                typeof obj[name as keyof typeof obj] === 'function'
                  ? (obj[name as keyof typeof obj] as (...params: any[]) => T)(
                      ...params
                    )
                  : // Proxy to parent if not defined above.
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
   * Get client that conforms to Keplr's interface.
   */
  getKeplrClient(): Keplr {
    const proxy = new Proxy(
      {
        version: 'cosmiframe',
        mode: 'extension',
        defaultOptions: {},
        getOfflineSigner: this.getOfflineSigner.bind(this),
        getOfflineSignerOnlyAmino: this.getOfflineSignerAmino.bind(this),
        getOfflineSignerAuto: (chainId) =>
          Promise.resolve(this.getOfflineSigner(chainId)),
        // `getEnigmaUtils` is expected to return an object with functions;
        // override them with proxied functions instead.
        getEnigmaUtils: (chainId: string) => ({
          getPubkey: () => proxy.getEnigmaPubKey(chainId),
          decrypt: (...params) => proxy.enigmaDecrypt(chainId, ...params),
          encrypt: (...params) => proxy.enigmaEncrypt(chainId, ...params),
          getTxEncryptionKey: (...params) =>
            proxy.getEnigmaTxEncryptionKey(chainId, ...params),
        }),
      } as Partial<Keplr>,
      {
        get: (obj, name) =>
          // Override variables.
          name in obj && typeof obj[name as keyof typeof obj] !== 'function'
            ? obj[name as keyof typeof obj]
            : // Override functions.
              <T = any>(...params: any[]) =>
                name in obj &&
                typeof obj[name as keyof typeof obj] === 'function'
                  ? (obj[name as keyof typeof obj] as (...params: any[]) => T)(
                      ...params
                    )
                  : // Proxy to parent if not defined above.
                    callParentMethod<T>({
                      method: name.toString(),
                      params,
                    }),
      }
    ) as Keplr

    return proxy
  }

  /**
   * Get an offline signer with both direct and amino sign functions that
   * forwards requests to the parent frame. The parent frame must be listening
   * (using the `listen` function). This should be used by the iframe.
   */
  getOfflineSigner(chainId: string): CosmiframeEitherSigner {
    return new CosmiframeEitherSigner(chainId)
  }

  /**
   * Get an offline amino signer that forwards requests to the parent frame. The
   * parent frame must be listening (using the `listen` function). This should
   * be used by the iframe.
   */
  getOfflineSignerAmino(chainId: string): CosmiframeAminoSigner {
    return new CosmiframeAminoSigner(chainId)
  }

  /**
   * Get an offline direct signer that forwards requests to the parent frame.
   * The parent frame must be listening (using the `listen` function). This
   * should be used by the iframe.
   */
  getOfflineSignerDirect(chainId: string): CosmiframeDirectSigner {
    return new CosmiframeDirectSigner(chainId)
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
              ? await signerOverrides()
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
              ? await nonSignerOverrides()
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
