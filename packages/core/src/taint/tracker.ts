import { eventBus } from "../events/bus.js";
import { TAINT_SEVERITY, TaintLevel, worstOf } from "./index.js";
import type { TaintedData } from "./types.js";

/**
 * Tracks taint level for a session. Taint only escalates, never downgrades.
 * Emits `taint.elevated` when the effective taint increases.
 */
export class SessionTaintTracker {
  private effectiveTaint: TaintLevel = TaintLevel.OWNER;
  private sources: TaintedData[] = [];

  /** Ingest content and potentially escalate the session taint. */
  onContentIngested(data: TaintedData): void {
    this.sources.push(data);

    const previous = this.effectiveTaint;
    this.effectiveTaint = worstOf(this.effectiveTaint, data.taint);

    if (TAINT_SEVERITY[this.effectiveTaint] > TAINT_SEVERITY[previous]) {
      eventBus.emit({
        type: "taint.elevated",
        previousLevel: previous,
        newLevel: this.effectiveTaint,
        source: data.origin.channel ?? data.origin.skill ?? "unknown",
      });
    }
  }

  /** Returns the current effective taint level. */
  getEffectiveTaint(): TaintLevel {
    return this.effectiveTaint;
  }

  /** Returns all ingested tainted data sources. */
  getSources(): TaintedData[] {
    return [...this.sources];
  }

  /** Resets taint to OWNER and clears sources. */
  clear(): void {
    const previous = this.effectiveTaint;
    this.effectiveTaint = TaintLevel.OWNER;
    this.sources = [];

    if (previous !== TaintLevel.OWNER) {
      eventBus.emit({
        type: "taint.cleared",
        previousLevel: previous,
      });
    }
  }
}
