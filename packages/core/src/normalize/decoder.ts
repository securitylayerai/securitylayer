/**
 * Detects and decodes multiple encoding layers: base64, hex escapes,
 * URL encoding, unicode escapes. Returns the decoded string.
 */
export function decodeAllLayers(input: string): string {
  let result = input;
  let previous = "";

  // Iterate until no more decodings apply (max 5 rounds to prevent infinite loops)
  for (let i = 0; i < 5 && result !== previous; i++) {
    previous = result;
    result = decodeURLEncoding(result);
    result = decodeHexEscapes(result);
    result = decodeUnicodeEscapes(result);
    result = tryDecodeBase64(result);
  }

  return result;
}

/** Decodes URL-encoded strings (%XX). */
function decodeURLEncoding(input: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(input)) return input;
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

/** Decodes hex escape sequences (\xHH). */
function decodeHexEscapes(input: string): string {
  return input.replace(/\\x([0-9A-Fa-f]{2})/g, (_match, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

/** Decodes unicode escape sequences (\uXXXX). */
function decodeUnicodeEscapes(input: string): string {
  return input.replace(/\\u([0-9A-Fa-f]{4})/g, (_match, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

/**
 * Attempts to detect and decode base64-encoded content.
 * Only decodes strings that look like valid base64 (>=32 chars, proper charset).
 * Skips strings that look like URL paths or common identifiers.
 */
function tryDecodeBase64(input: string): string {
  // Require at least 32 chars to reduce false positives
  return input.replace(
    /(?<![A-Za-z0-9+/=])([A-Za-z0-9+/]{32,}={0,2})(?![A-Za-z0-9+/=])/g,
    (match, b64) => {
      // Skip common false positive patterns
      if (b64.includes("://") || /\.(com|org|net|io|dev)\b/.test(b64)) {
        return match;
      }
      try {
        const decoded = Buffer.from(b64, "base64").toString("utf-8");
        // Only accept if the decoded content is printable ASCII
        if (!/^[\x20-\x7e\n\r\t]+$/.test(decoded)) {
          return match;
        }
        // Reject if decoded is too similar to input (not meaningfully different)
        if (decoded === b64) {
          return match;
        }
        return decoded;
      } catch {
        // Not valid base64
      }
      return match;
    },
  );
}
