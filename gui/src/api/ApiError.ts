/** Error for a non-2xx response. Carries the backend's HTTP status and error code. */
export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Read the backend's { error: { code, message } } body (if any) and throw an ApiError. */
export async function throwApiError(response: Response, label: string): Promise<never> {
  let code = ''
  let message = `${label} API error: ${response.status}`
  try {
    const body = await response.json()
    code = body?.error?.code ?? ''
    message = body?.error?.message ?? message
  } catch {
    // body was not JSON; keep the default message
  }
  throw new ApiError(response.status, code, message)
}
