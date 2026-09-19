import { logger } from '@/lib/logger';

export class HttpError extends Error {
  public override readonly name = 'HttpError';

  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  allowedHosts: readonly string[];
  maxBytes?: number;
  redirect?: RequestRedirect;
}

const PRIVATE_HOST_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.|169\.254\.|::1|\[::1\])/i;

export function assertAllowedUrl(rawUrl: string, allowedHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError('Invalid upstream URL', 400);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new HttpError('Unsupported upstream protocol', 400);
  }

  if (PRIVATE_HOST_PATTERN.test(url.hostname)) {
    throw new HttpError('Upstream host is not allowed', 400);
  }

  const allowed = allowedHosts.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
  if (!allowed) {
    throw new HttpError('Upstream host is not allowed', 400);
  }

  return url;
}

export async function fetchUpstream(
  rawUrl: string,
  options: FetchOptions,
): Promise<Response> {
  const url = assertAllowedUrl(rawUrl, options.allowedHosts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
      redirect: options.redirect ?? 'follow',
      cache: 'no-store',
    });

    if (options.maxBytes) {
      const length = Number(response.headers.get('content-length') ?? '0');
      if (length > options.maxBytes) {
        throw new HttpError('Upstream response is too large', 502);
      }
    }

    return response;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Upstream request timed out', { host: url.hostname });
      throw new HttpError('Upstream request timed out', 504);
    }
    logger.error('Upstream request failed', { host: url.hostname });
    throw new HttpError('Upstream request failed', 502);
  } finally {
    clearTimeout(timer);
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchUpstreamWithRetry(
  rawUrl: string,
  options: FetchOptions,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchUpstream(rawUrl, options);
      if (response.ok || !shouldRetryStatus(response.status)) {
        return response;
      }
      lastError = new HttpError(`Upstream returned ${response.status}`, response.status);
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }

  if (lastError instanceof HttpError) {
    throw lastError;
  }
  throw new HttpError('Upstream request failed', 502);
}

export async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const buffer = await readLimitedBuffer(response, maxBytes);
  return new TextDecoder('utf-8').decode(buffer);
}

export async function readLimitedBuffer(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new HttpError('Upstream response is too large', 502);
    }
    chunks.push(value);
  }

  const output = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
