import { outputJson } from './output.js';

export class GoogleCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleCliError';
  }
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[\w\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/access_token[=:]\s*[\w\-._~+/]+=*/gi, 'access_token=[REDACTED]')
    .replace(/refresh_token[=:]\s*[\w\-._~+/]+=*/gi, 'refresh_token=[REDACTED]')
    .replace(/client_secret[=:]\s*[\w\-._~+/]+=*/gi, 'client_secret=[REDACTED]');
}

export function handleError(error: unknown): never {
  let name = 'unknown_error';
  let detail = 'An unknown error occurred';
  let statusCode = 1;
  let hint: string | undefined;

  if (error instanceof GoogleCliError) {
    name = 'cli_error';
    detail = sanitizeErrorMessage(error.message);
  } else if (error instanceof Error) {
    detail = sanitizeErrorMessage(error.message);

    if (error.message.includes('Not authenticated') || error.message.includes('No tokens')) {
      name = 'auth_error';
      hint = 'Run: google auth login';
      statusCode = 401;
    }
  }

  const errorOutput: Record<string, unknown> = {
    error: { name, detail, statusCode },
  };

  if (hint) {
    errorOutput.hint = hint;
  }

  outputJson(errorOutput);
  process.exit(1);
}
