import { Keplr, SecretUtils } from '@keplr-wallet/types'

import { CosmiframeTimeoutError } from './error'
import {
  CosmiframeAminoSigner,
  CosmiframeDirectSigner,
  CosmiframeEitherSigner,
} from './signers'
import {
  CalledParentMethodResult,
  InternalMethod,
  ListenOptions,
  MethodCallResultMessage,
  Origin,
  ParentMetadata,
  RequestMethodCallMessage,
} from './types'
import {
  UNSAFE_ALLOW_ANY_ORIGIN,
  callParentMethod,
  isInIframe,
  isOriginAllowed,
  processOverrideHandler,
} from './utils'

export class Cosmiframe {
  /**
   * Parent origins we are allowed to communicate with.
   */
  #allowedOrigins: Origin[]

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

  constructor(
    /**
     * List of allowed parent origins.
     *
     * In order to allow all origins, you must explicitly pass in the string
     * `UNSAFE_ALLOW_ANY_ORIGIN`. Do not do this. It is very unsafe.
     */
    allowedParentOrigins: Origin[]
  ) {
    if (!allowedParentOrigins.length) {
      throw new Error('You must explicitly allow parent origins.')
    }

    if (allowedParentOrigins.includes('*')) {
      throw new Error(
        'It is very unsafe to allow all origins because a controlling app has the power to manipulate messages before they are signed. If you really want to do this, pass in `UNSAFE_ALLOW_ANY_ORIGIN`.'
      )
    }

    this.#allowedOrigins = allowedParentOrigins.includes(
      UNSAFE_ALLOW_ANY_ORIGIN
    )
      ? ['*']
      : [...allowedParentOrigins]

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
                    this.callParentMethod<T>({
                      method: name.toString(),
                      params,
                    }).then(({ result }) => result),
      }
    )
  }

  /**
   * Call a method on the parent frame, returning the result with metadata, such
   * as the response message origin, which should be the parent frame origin.
   * This should be used by the iframe.
   */
  callParentMethod<T = any>(
    options: Pick<RequestMethodCallMessage, 'method' | 'params' | 'internal'>,
    /**
     * The timeout in milliseconds after which to reject the promise and stop
     * listening if the parent has not responded. If undefined, no timeout.
     *
     * Defaults to no timeout.
     */
    timeout?: number
  ): Promise<CalledParentMethodResult<T>> {
    return callParentMethod<T>(options, this.#allowedOrigins, timeout)
  }

  /**
   * Returns whether or not Cosmiframe is ready to use, meaning all of these are
   * true:
   * - The current app is being used in an iframe.
   * - The parent window is running Cosmiframe.
   * - The parent window is one of the allowed origins.
   *
   * If ready to use, this returns the origin of the parent frame that
   * acknowledged the request. If no origin is set for some reason, this returns
   * true. Otherwise, this returns false.
   *
   * This should be used by the iframe.
   */
  async isReady(): Promise<string | boolean> {
    if (!isInIframe()) {
      return false
    }

    try {
      const { origin, result } = await this.callParentMethod<boolean>(
        {
          internal: true,
          method: InternalMethod.IsCosmiframe,
          params: [],
        },
        // If the parent is listening, it should respond immediately, so a
        // short timeout should suffice.
        500
      )

      return origin || result
    } catch (err) {
      // If the parent has not responded, assume it is not ready. Otherwise,
      // rethrow the error.
      if (err instanceof CosmiframeTimeoutError) {
        return false
      }

      throw err
    }
  }

  /**
   * Returns the metadata set by the parent when it started listening. This
   * should be used by the iframe to display information about the parent.
   */
  async getMetadata(): Promise<ParentMetadata | null> {
    return (
      await this.callParentMethod<ParentMetadata | null>(
        {
          internal: true,
          method: InternalMethod.GetMetadata,
          params: [],
        },
        // If the parent is listening, it should respond immediately, so a short
        // timeout should suffice.
        500
      )
    ).result
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
                    this.callParentMethod<T>({
                      method: name.toString(),
                      params,
                    }).then(({ result }) => result),
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
    return new CosmiframeEitherSigner(chainId, this.#allowedOrigins)
  }

  /**
   * Get an offline amino signer that forwards requests to the parent frame. The
   * parent frame must be listening (using the `listen` function). This should
   * be used by the iframe.
   */
  getOfflineSignerAmino(chainId: string): CosmiframeAminoSigner {
    return new CosmiframeAminoSigner(chainId, this.#allowedOrigins)
  }

  /**
   * Get an offline direct signer that forwards requests to the parent frame.
   * The parent frame must be listening (using the `listen` function). This
   * should be used by the iframe.
   */
  getOfflineSignerDirect(chainId: string): CosmiframeDirectSigner {
    return new CosmiframeDirectSigner(chainId, this.#allowedOrigins)
  }

  /**
   * Listen for requests from the provided iframe. This should be used by the
   * parent. Returns a function that can be called to stop listening.
   */
  static listen(options: ListenOptions): () => void {
    const {
      iframe,
      target,
      getOfflineSignerDirect,
      getOfflineSignerAmino,
      nonSignerOverrides,
      signerOverrides,
      origins: _origins,
      metadata,
    } = options

    const origins = _origins?.length ? _origins : ['*']

    const internalMethods: Record<InternalMethod, (...params: any[]) => any> = {
      [InternalMethod.IsCosmiframe]: () => true,
      [InternalMethod.GetMetadata]: () => metadata || null,
    }

    const listener = async ({
      source,
      origin,
      data,
    }: MessageEvent<RequestMethodCallMessage | string>) => {
      // Verify iframe window exists.
      if (!iframe.contentWindow) {
        throw new Error('Iframe contentWindow does not exist.')
      }

      // Verify event is coming from the iframe.
      if (source !== iframe.contentWindow) {
        return
      }

      // Verify origin is allowed.
      if (!isOriginAllowed(origins, origin)) {
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

      const { id, params, chainId, signType, internal } = data
      let { method, signerType } = data

      // Backwards compatibility.
      signerType ||= signType
      method = method.replace(/^signer:/, '')

      let msg: Omit<MethodCallResultMessage, 'id'> | undefined
      try {
        if (internal) {
          if (
            typeof internalMethods[method as keyof typeof internalMethods] !==
            'function'
          ) {
            throw new Error(`Unknown internal method: ${method}`)
          }

          const response = await (
            internalMethods[method as keyof typeof internalMethods] as (
              ...params: any[]
            ) => any
          )(...params)

          msg = {
            type: 'success',
            response,
          }
        } else if (signerType) {
          if (!chainId) {
            throw new Error('Missing chainId in signer message request')
          }

          // Try signer override method.
          const overrides =
            typeof signerOverrides === 'function'
              ? await signerOverrides(chainId)
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

      // Send back to same origin.
      iframe.contentWindow?.postMessage(
        {
          ...msg,
          id,
        },
        origin
      )
    }

    // Listen.
    window.addEventListener('message', listener)

    // Return a function to stop listening.
    return () => window.removeEventListener('message', listener)
  }
}
