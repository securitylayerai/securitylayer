import { beforeEach, describe, expect, it } from "vitest";
import { eventBus } from "../../src/events/bus";
import { isTaintSufficient, TaintLevel, worstOf } from "../../src/taint/index";
import { SessionTaintTracker } from "../../src/taint/tracker";
import type { TaintedData } from "../../src/taint/types";

function makeData(taint: TaintLevel, channel = "test"): TaintedData {
  return { content: "test content", taint, origin: { channel } };
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
