import { join } from "node:path";
import {
  buildCapabilityStore,
  createApprovalManager,
  createDefaultLLMJudge,
  createEventBus,
  createNoOpJudge,
  createTaintTracker,
  type EventBus,
  evaluateAction,
  loadConfig,
  type PipelineDeps,
  type SecurityEventMap,
  type SecurityEventType,
  scanEgress,
  TaintLevel,
} from "@securitylayerai/core";
import { ConfigError, InitializationError } from "./errors";
import { createSessionState } from "./session";
import type {
  ApprovalOptions,
  CheckResult,
  ContentMetadata,
  ExecutionContext,
  SecurityLayer,
  SecurityLayerOptions,
} from "./types";

const SOURCE_TO_TAINT: Record<
  ContentMetadata["source"],
  (typeof TaintLevel)[keyof typeof TaintLevel]
> = {
  web: TaintLevel.WEB,
  file: TaintLevel.UNTRUSTED,
  channel: TaintLevel.UNTRUSTED,
  skill: TaintLevel.SKILL,
  memory: TaintLevel.MEMORY,
};

const DEFAULT_APPROVAL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export async function createSecurityLayer(options?: SecurityLayerOptions): Promise<SecurityLayer> {
  const bus: EventBus = options?.eventBus ?? createEventBus();
  const session = createSessionState(options?.sessionId);

  // Load or use injected config
  let config: import("@securitylayerai/core").LoadedConfig;
  try {
    if (options?.config) {
      config = options.config;
    } else if (options?.configDir) {
      const dir = options.configDir;
      config = await loadConfig({
        main: join(dir, "config.yaml"),
        sessions: join(dir, "capabilities", "sessions.yaml"),
        channels: join(dir, "capabilities", "channels.yaml"),
        skills: join(dir, "capabilities", "skills.yaml"),
        learnedRules: join(dir, "learned-rules.json"),
      });
    } else {
      config = await loadConfig();
    }
  } catch (err) {
    throw new ConfigError(
      `Failed to load config: ${err instanceof Error ? err.message : String(err)}`,
      options?.configDir,
    );
  }

  // Build pipeline deps
  let deps: PipelineDeps;
  try {
    const capabilityStore = buildCapabilityStore(config);
    const taintTracker = createTaintTracker(bus);
    const judge = config.main.semantic.enabled
      ? createDefaultLLMJudge(config.main.semantic)
      : createNoOpJudge();

    deps = {
      capabilityStore,
      taintTracker,
      judge,
      eventBus: bus,
      sessionHistory: [],
    };
  } catch (err) {
    throw new InitializationError(
      `Failed to initialize pipeline: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  const approvalManager = createApprovalManager(bus);

  // Pending approval promises keyed by approvalId
  const pendingApprovals = new Map<string, Promise<boolean>>();

  function deriveReason(result: CheckResult["layers"]): string {
    if (result.capability && !result.capability.allowed && result.capability.reason) {
      return result.capability.reason;
    }
    if (result.rules?.reason) {
      return result.rules.reason;
    }
    if (result.llm?.reasoning) {
      return result.llm.reasoning;
    }
    return "Allowed by all layers";
  }

  return {
    async check(
      tool: string,
      params: Record<string, unknown>,
      context?: ExecutionContext,
    ): Promise<CheckResult> {
      const coreContext = {
        sessionId: context?.sessionId ?? session.id,
        skillId: context?.skillId,
        channelId: context?.channelId,
      };

      // Extract command string from params
      const command =
        typeof params.command === "string"
          ? params.command
          : typeof params.cmd === "string"
            ? params.cmd
            : typeof params.input === "string"
              ? params.input
              : undefined;

      const evalResult = await evaluateAction(tool, coreContext, deps, command);

      const checkResult: CheckResult = {
        decision: evalResult.decision,
        reason: deriveReason(evalResult.layers),
        layers: evalResult.layers,
        degraded: evalResult.degraded,
        timing: evalResult.timing,
      };

      // Handle REQUIRE_APPROVAL: request approval and store the pending promise
      if (evalResult.decision === "REQUIRE_APPROVAL") {
        // Capture the approvalId from the event
        let capturedApprovalId: string | undefined;
        const unsub = bus.on("approval.requested", (event) => {
          capturedApprovalId = event.requestId;
        });

        const approvalPromise = approvalManager.request({
          action: tool,
          context: {
            session: coreContext.sessionId,
            channel: coreContext.channelId,
          },
          blockedBy: checkResult.reason,
          reason: checkResult.reason,
        });

        unsub();

        if (capturedApprovalId) {
          const approvalId = capturedApprovalId;
          checkResult.approvalId = approvalId;
          pendingApprovals.set(
            approvalId,
            approvalPromise.then((r) => {
              pendingApprovals.delete(approvalId);
              return r.outcome === "approved";
            }),
          );
        }
      }

      // Record action in session history
      session.addAction(tool);
      if (deps.sessionHistory) {
        deps.sessionHistory.push(tool);
      }

      return checkResult;
    },

    async waitForApproval(approvalId: string, options?: ApprovalOptions): Promise<boolean> {
      const pending = pendingApprovals.get(approvalId);
      if (!pending) {
        return false;
      }

      const timeout = options?.timeout ?? DEFAULT_APPROVAL_TIMEOUT;
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeout);
      });

      return Promise.race([pending, timeoutPromise]);
    },

    ingestContent(content: string, metadata: ContentMetadata): void {
      const taint = SOURCE_TO_TAINT[metadata.source];
      deps.taintTracker.onContentIngested({
        content,
        taint,
        origin: {
          url: metadata.url,
          skill: metadata.source === "skill" ? metadata.path : undefined,
          channel: metadata.source === "channel" ? metadata.path : undefined,
          timestamp: Date.now(),
        },
      });
    },

    scanEgress(content: string) {
      return scanEgress(content);
    },

    getSessionTaint() {
      return deps.taintTracker.getEffectiveTaint();
    },

    on<K extends SecurityEventType>(
      type: K,
      handler: (event: SecurityEventMap[K]) => void,
    ): () => void {
      return bus.on(type, handler);
    },

    destroy(): void {
      // Resolve all pending approvals as timeout
      for (const [id] of pendingApprovals) {
        approvalManager.resolve(id, "timeout");
      }
      pendingApprovals.clear();
      bus.clear();
    },
  };
}
