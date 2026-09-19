const BLOCKED_HOSTS = new Set(['d2zihajmogu5jn.cloudfront.net']);

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function isBlockedMediaHost(value: string): boolean {
  const hostname = hostnameOf(value);
  return hostname ? BLOCKED_HOSTS.has(hostname) : true;
}

export function joinUrl(baseUrl: string, path: string): string {
  const origin = new URL(baseUrl);
  return new URL(path, origin).toString();
}
