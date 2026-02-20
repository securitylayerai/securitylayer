import { type EventBus, eventBus as singletonBus } from "@/events/bus";
import { TAINT_SEVERITY, TaintLevel, worstOf } from "./index";
import type { TaintedData } from "./types";

/**
 * Tracks taint level for a session. Taint only escalates, never downgrades.
 * Emits `taint.elevated` when the effective taint increases.
 */
export class SessionTaintTracker {
  private effectiveTaint: TaintLevel = TaintLevel.OWNER;
  private sources: TaintedData[] = [];
  private bus: EventBus;

  constructor(bus?: EventBus) {
    this.bus = bus ?? singletonBus;
  }

  /** Ingest content and potentially escalate the session taint. */
  onContentIngested(data: TaintedData): void {
    this.sources.push(data);

    const previous = this.effectiveTaint;
    this.effectiveTaint = worstOf(this.effectiveTaint, data.taint);

    if (TAINT_SEVERITY[this.effectiveTaint] > TAINT_SEVERITY[previous]) {
      this.bus.emit({
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
      this.bus.emit({
        type: "taint.cleared",
        previousLevel: previous,
      });
    }
  }
}
