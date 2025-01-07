import { OfflineAminoSigner } from '@cosmjs/amino'
import { OfflineDirectSigner } from '@cosmjs/proto-signing'

/**
 * The two signer types.
 */
export type SignerType = 'amino' | 'direct'

/**
 * The types of origins accepted.
 */
export type Origin = string | RegExp

/**
 * A message sent from the iframe to the parent requesting a method be called.
 */
export type RequestMethodCallMessage = {
  id: string

  method: string
  params: any[]

  // For signer messages.
  chainId?: string
  signerType?: SignerType
  /**
   * @deprecated Backwards compatibility.
   */
  signType?: SignerType

  // For internal messages.
  internal?: boolean
}

export type RequestMethodCallMessageNoId = Omit<RequestMethodCallMessage, 'id'>

/**
 * A message sent from the parent to the iframe with the result of a method
 * call.
 */
export type MethodCallResultMessage<T = any> = {
  id: string
} & (
  | {
      type: 'success'
      response: T
      error?: never
    }
  | {
      type: 'error'
      error: string
      response?: never
    }
)

export type MethodCallResultMessageNoId<T = any> = Omit<
  MethodCallResultMessage<T>,
  'id'
>

/**
 * The result with metadata from calling a parent method.
 */
export type CalledParentMethodResult<T> = {
  /**
   * The parent's result for the requested method.
   */
  result: T
  /**
   * The origin of the parent response message, which should be the parent's
   * origin. This is pulled directly from the `MessageEvent`.
   */
  origin: string
}

/**
 * The override handler that throws an error, defaulting to "Handled by outer
 * wallet."
 */
export type OverrideHandlerError = {
  type: 'error'
  error?: string
}

/**
 * The override handler that returns a specific value.
 */
export type OverrideHandlerSuccess = {
  type: 'success'
  value?: unknown
}

/**
 * The override handler that calls the method normally.
 */
export type OverrideHandlerCall = {
  type: 'call'
}

/**
 * An override handler defines how a message from the iframe should be handled
 * by the parent and is called with the original method's parameters. This is
 * set when listening. If nothing is returned from an override handler, an error
 * will be thrown with the message "Handled by parent."
 */
export type OverrideHandler =
  | OverrideHandlerError
  | OverrideHandlerSuccess
  | OverrideHandlerCall
  | undefined
  | void

/**
 * Object containing override handlers for methods.
 */
export type Overrides = Record<
  string,
  (...params: any[]) => OverrideHandler | Promise<OverrideHandler> | undefined
>

/**
 * Options passed when setting up listening by the parent.
 */
export type ListenOptions = {
  /**
   * The iframe HTML element to listen to.
   */
  iframe: HTMLIFrameElement
  /**
   * The client or object whose methods to call.
   */
  target: Record<string, any>
  /**
   * A function to retrieve the offline direct signer.
   */
  getOfflineSignerDirect: (
    chainId: string
  ) => OfflineDirectSigner | Promise<OfflineDirectSigner>
  /**
   * A function to retrieve the offline amino signer.
   */
  getOfflineSignerAmino: (
    chainId: string
  ) => OfflineAminoSigner | Promise<OfflineAminoSigner>
  /**
   * Overrides applied to non-signer message requests.
   */
  nonSignerOverrides?:
    | Overrides
    | (() => Overrides)
    | (() => Promise<Overrides>)
  /**
   * Overrides applied to signer message requests.
   */
  signerOverrides?:
    | Overrides
    | ((chainId: string) => Overrides)
    | ((chainId: string) => Promise<Overrides>)
  /**
   * Restrict iframe origins that are allowed to connect to this listening
   * instance of Cosmiframe. If undefined or empty, all origins are allowed.
   *
   * It is safe to allow all origins since the current window is the listening
   * parent and is responsible for handling signing requests from the iframe.
   * The iframe, on the other hand, should not trust us.
   */
  origins?: Origin[]
  /**
   * Optionally set a name and imageUrl that represent the parent window to be
   * shown by the iframe.
   */
  metadata?: ParentMetadata
}

export type ParentMetadata = {
  name?: string
  imageUrl?: string
}

/**
 * Internal methods.
 */
export enum InternalMethod {
  IsCosmiframe = 'isCosmiframe',
  GetMetadata = 'getMetadata',
}
