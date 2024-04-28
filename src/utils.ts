import { v4 as uuidv4 } from 'uuid'

import {
  MethodCallResultMessageNoId,
  OverrideHandler,
  RequestMethodCallMessageNoId,
} from './types'

/**
 * Send message call request to parent and listen for the result. Returns a
 * promise that resolves with the result on success or rejects with an error.
 */
export const callParentMethod = <T = any>(
  message: RequestMethodCallMessageNoId
): Promise<T> =>
  new Promise<any>((resolve, reject) => {
    const id = uuidv4()

    // Add one-time listener that waits for a response for the request we're
    // about to send.
    const listener = ({ data }: MessageEvent) => {
      // Verify we are receiving a response for the correct request.
      if (data.id !== id) {
        return false
      }

      // Remove listener once we receive a response for the correct request.
      window.removeEventListener('message', listener)

      if (data.type === 'success') {
        resolve(data.response)
      } else {
        reject(new Error(data.error))
      }
    }

    window.addEventListener('message', listener)

    try {
      // Send the message to our parent.
      window.parent.postMessage(
        {
          ...message,
          id,
        },
        '*'
      )
    } catch (err) {
      // If fails to send, remove the listener and reject.
      window.removeEventListener('message', listener)
      reject(err)
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
