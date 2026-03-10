import { SecurityLayerError } from "./errors";
import type { SecurityLayer } from "./types";

export interface MiddlewareOptions {
  extractParams?: (...args: unknown[]) => Record<string, unknown>;
}

export function withSecurityLayer<TArgs extends unknown[], TReturn>(
  sl: SecurityLayer,
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
  tool: string,
  options?: MiddlewareOptions,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    // Extract params from arguments
    let params: Record<string, unknown>;
    if (options?.extractParams) {
      params = options.extractParams(...args);
    } else {
      // Default extraction: first string arg → { command }, first object → use as params
      const firstArg = args[0];
      if (typeof firstArg === "string") {
        params = { command: firstArg };
      } else if (typeof firstArg === "object" && firstArg !== null) {
        params = firstArg as Record<string, unknown>;
      } else {
        params = {};
      }
    }

    const result = await sl.check(tool, params);

    if (result.decision === "DENY") {
      throw new SecurityLayerError(`Action denied: ${result.reason}`);
    }

    if (result.decision === "REQUIRE_APPROVAL" && result.approvalId) {
      const approved = await sl.waitForApproval(result.approvalId);
      if (!approved) {
        throw new SecurityLayerError(`Action denied: approval not granted for ${tool}`);
      }
    }

    return fn(...args);
  };
}
