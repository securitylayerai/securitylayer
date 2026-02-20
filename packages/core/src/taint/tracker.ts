import { type EventBus, eventBus as singletonBus } from "@/events/bus";
import { TAINT_SEVERITY, TaintLevel, worstOf } from "./index";
import type { TaintedData } from "./types";

/**
 * Creates a taint tracker for a session. Taint only escalates, never downgrades.
 * Emits `taint.elevated` when the effective taint increases.
 */
export function createTaintTracker(bus?: EventBus) {
  let effectiveTaint: TaintLevel = TaintLevel.OWNER;
  let sources: TaintedData[] = [];
  const activeBus = bus ?? singletonBus;

  return {
    /** Ingest content and potentially escalate the session taint. */
    onContentIngested(data: TaintedData): void {
      sources.push(data);

      const previous = effectiveTaint;
      effectiveTaint = worstOf(effectiveTaint, data.taint);

      if (TAINT_SEVERITY[effectiveTaint] > TAINT_SEVERITY[previous]) {
        activeBus.emit({
          type: "taint.elevated",
          previousLevel: previous,
          newLevel: effectiveTaint,
          source: data.origin.channel ?? data.origin.skill ?? "unknown",
        });
      }
    },

    /** Returns the current effective taint level. */
    getEffectiveTaint(): TaintLevel {
      return effectiveTaint;
    },

    /** Returns all ingested tainted data sources. */
    getSources(): TaintedData[] {
      return [...sources];
    },

    /** Resets taint to OWNER and clears sources. */
    clear(): void {
      const previous = effectiveTaint;
      effectiveTaint = TaintLevel.OWNER;
      sources = [];

      if (previous !== TaintLevel.OWNER) {
        activeBus.emit({
          type: "taint.cleared",
          previousLevel: previous,
        });
      }
    },
  };
}

export type TaintTracker = ReturnType<typeof createTaintTracker>;
