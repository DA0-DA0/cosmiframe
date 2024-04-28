import { OfflineAminoSigner } from '@cosmjs/amino'
import { OfflineDirectSigner } from '@cosmjs/proto-signing'

/**
 * The two signer types.
 */
export type SignerType = 'amino' | 'direct'

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
  nonSignerOverrides?: Overrides | (() => Overrides)
  /**
   * Overrides applied to signer message requests.
   */
  signerOverrides?: Overrides | (() => Overrides)
}
