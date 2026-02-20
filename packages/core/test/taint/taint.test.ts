import { beforeEach, describe, expect, it } from "vitest";
import { EventBus, eventBus } from "@/events/bus";
import type { TaintElevatedEvent } from "@/events/types";
import { isTaintSufficient, TaintLevel, worstOf } from "@/taint/index";
import { SessionTaintTracker } from "@/taint/tracker";
import type { TaintedData } from "@/taint/types";

function makeData(taint: TaintLevel, channel = "test"): TaintedData {
  return { content: "test content", taint, origin: { channel, timestamp: Date.now() } };
}

describe("worstOf", () => {
  it("returns the higher-severity taint", () => {
    expect(worstOf("owner", "web")).toBe("web");
    expect(worstOf("web", "owner")).toBe("web");
  });

  it("returns same when equal", () => {
    expect(worstOf("trusted", "trusted")).toBe("trusted");
  });
});

describe("isTaintSufficient", () => {
  it("owner is sufficient for any level", () => {
    expect(isTaintSufficient("owner", "memory")).toBe(true);
  });

  it("web is not sufficient for trusted", () => {
    expect(isTaintSufficient("web", "trusted")).toBe(false);
  });

  it("same level is sufficient", () => {
    expect(isTaintSufficient("untrusted", "untrusted")).toBe(true);
  });
});

describe("SessionTaintTracker", () => {
  let tracker: SessionTaintTracker;

  beforeEach(() => {
    tracker = new SessionTaintTracker();
    eventBus.clear();
  });

  it("starts at OWNER", () => {
    expect(tracker.getEffectiveTaint()).toBe(TaintLevel.OWNER);
  });

  it("ingesting UNTRUSTED content elevates taint", () => {
    tracker.onContentIngested(makeData("untrusted"));
    expect(tracker.getEffectiveTaint()).toBe("untrusted");
  });

  it("taint only goes up, never down", () => {
    tracker.onContentIngested(makeData("web"));
    tracker.onContentIngested(makeData("owner"));
    expect(tracker.getEffectiveTaint()).toBe("web");
  });

  it("clear() resets to OWNER", () => {
    tracker.onContentIngested(makeData("web"));
    tracker.clear();
    expect(tracker.getEffectiveTaint()).toBe(TaintLevel.OWNER);
  });

  it("getSources() returns all ingested data", () => {
    tracker.onContentIngested(makeData("untrusted", "slack"));
    tracker.onContentIngested(makeData("web", "browser"));
    const sources = tracker.getSources();
    expect(sources).toHaveLength(2);
    expect(sources[0].origin.channel).toBe("slack");
    expect(sources[1].origin.channel).toBe("browser");
  });

  it("emits taint.elevated event on escalation", () => {
    const events: unknown[] = [];
    eventBus.on("taint.elevated", (e) => events.push(e));

    tracker.onContentIngested(makeData("web"));
    expect(events).toHaveLength(1);
  });

  it("does not emit when taint stays the same", () => {
    tracker.onContentIngested(makeData("web"));
    const events: unknown[] = [];
    eventBus.on("taint.elevated", (e) => events.push(e));

    tracker.onContentIngested(makeData("trusted")); // lower severity, no change
    expect(events).toHaveLength(0);
  });
});

// M7: Injectable EventBus in SessionTaintTracker
describe("SessionTaintTracker — injectable EventBus", () => {
  it("uses injected bus instead of singleton", () => {
    const customBus = new EventBus();
    const customEvents: TaintElevatedEvent[] = [];
    const singletonEvents: TaintElevatedEvent[] = [];

    customBus.on("taint.elevated", (e) => customEvents.push(e));
    eventBus.on("taint.elevated", (e) => singletonEvents.push(e));

    const tracker = new SessionTaintTracker(customBus);
    tracker.onContentIngested(makeData("web"));

    expect(customEvents).toHaveLength(1);
    expect(customEvents[0].newLevel).toBe("web");
    // Singleton should NOT have received the event
    expect(singletonEvents).toHaveLength(0);

    eventBus.clear();
    customBus.clear();
  });

  it("falls back to singleton bus when no bus injected", () => {
    eventBus.clear();
    const singletonEvents: TaintElevatedEvent[] = [];
    eventBus.on("taint.elevated", (e) => singletonEvents.push(e));

    const tracker = new SessionTaintTracker(); // no bus argument
    tracker.onContentIngested(makeData("web"));

    expect(singletonEvents).toHaveLength(1);
    eventBus.clear();
  });
});
