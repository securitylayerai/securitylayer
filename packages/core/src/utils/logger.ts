import pino from "pino";

/** Creates a structured logger instance with the given name. */
export function createLogger(name: string, level?: string): pino.Logger {
  return pino({
    name,
    level: level ?? process.env.SECURITYLAYER_LOG_LEVEL ?? "info",
  });
}
