import { v4 as uuidv4 } from 'uuid'

import { CosmiframeTimeoutError } from './error'
import {
  CalledParentMethodResult,
  MethodCallResultMessageNoId,
  OverrideHandler,
  RequestMethodCallMessageNoId,
} from './types'

/**
 * Origin specified by the iframe to allow all origins. This is unsafe and
 * should not be done.
 */
export const UNSAFE_ALLOW_ANY_ORIGIN = 'UNSAFE_ALLOW_ANY_ORIGIN'

/**
 * Send message call request to parent of allowed origin and listen for the
 * result. Returns a promise that resolves with the result on success or rejects
 * with an error.
 */
export const callParentMethod = <T = any>(
  message: RequestMethodCallMessageNoId,
  origins: string[],
  /**
   * The timeout in milliseconds after which to reject the promise and stop
   * listening if the parent has not responded. If undefined, no timeout.
   *
   * Defaults to no timeout.
   */
  timeout?: number
): Promise<CalledParentMethodResult<T>> =>
  new Promise<CalledParentMethodResult<T>>((resolve, reject) => {
    let timeoutId: number | null = null
    const id = uuidv4()

    // Add one-time listener that waits for a response for the request we're
    // about to send.
    const listener = ({ origin, source, data }: MessageEvent) => {
      // Verify we are receiving a response for the correct request from an
      // allowed parent.
      if (
        (!origins.includes('*') && !origins.includes(origin)) ||
        source !== window.parent ||
        data.id !== id
      ) {
        return
      }

      // Remove listener once we receive a response for the correct request.
      window.removeEventListener('message', listener)

      // Remove timeout if set.
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }

      if (data.type === 'success') {
        resolve({
          result: data.response,
          origin,
        })
      } else {
        reject(new Error(data.error))
      }
    }

    window.addEventListener('message', listener)

    try {
      const data = {
        ...message,
        id,
      }

      // Send the message to our parent of allowed origin.
      origins.forEach((origin) => window.parent.postMessage(data, origin))
    } catch (err) {
      // If fails to send, remove the listener and reject.
      window.removeEventListener('message', listener)
      reject(err)
    }

    // If timeout is set, add a timeout listener that will reject the promise
    // if the parent has not responded.
    if (timeout) {
      timeoutId = setTimeout(() => {
        window.removeEventListener('message', listener)
        reject(
          new CosmiframeTimeoutError(
            `Timed out after ${timeout}ms waiting for parent to respond.`
          )
        )
      }, timeout)
    }
  })

/**
 * Convert override handler into a method call result message. If the override
 * handler is to call the method normally, returns undefined.
 */
export const processOverrideHandler = (
  handler: OverrideHandler
): MethodCallResultMessageNoId | undefined => {
  if (!handler || handler.type === 'error') {
    return {
      type: 'error',
      error:
        (handler && handler.type === 'error' && handler.error) ||
        'Handled by outer wallet.',
    }
  } else if (handler.type === 'success') {
    return {
      type: 'success',
      response: handler.value,
    }
  }
}

/**
 * Returns whether or not the current app is being used in an iframe.
 */
export const isInIframe = () =>
  typeof window !== 'undefined' && window.self !== window.parent
