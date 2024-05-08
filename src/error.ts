export class CosmiframeTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CosmiframeTimeoutError'
  }
}
