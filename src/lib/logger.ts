type LogLevel = 'info' | 'warn' | 'error';

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/cookie[s]?:[^\n]+/gi, 'cookie:[redacted]')
      .replace(/ASP\.NET_SessionId=[^;\s]+/gi, 'ASP.NET_SessionId=[redacted]')
      .replace(/\.VDMS=[^;\s]+/gi, '.VDMS=[redacted]');
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  return value;
}

function write(level: LogLevel, message: string, details?: unknown): void {
  const payload = {
    level,
    message,
    details: details === undefined ? undefined : sanitize(details),
    time: new Date().toISOString(),
  };

  if (level === 'error') {
    console.error(payload);
    return;
  }
  if (level === 'warn') {
    console.warn(payload);
    return;
  }
  console.info(payload);
}

export const logger = {
  info(message: string, details?: unknown) {
    write('info', message, details);
  },
  warn(message: string, details?: unknown) {
    write('warn', message, details);
  },
  error(message: string, details?: unknown) {
    write('error', message, details);
  },
};
