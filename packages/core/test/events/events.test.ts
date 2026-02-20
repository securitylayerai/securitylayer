import { beforeEach, describe, expect, it } from "vitest";
import { EventBus } from "../../src/events/bus";
import type { ActionEvaluatedEvent, SecurityEvent } from "../../src/events/types";
import { SecurityEventSchema } from "../../src/events/types";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("emits and receives a typed event", () => {
    const received: ActionEvaluatedEvent[] = [];
    bus.on("action.evaluated", (e) => received.push(e));

    bus.emit({
      type: "action.evaluated",
      action: "exec",
      allowed: true,
    });

    expect(received).toHaveLength(1);
    expect(received[0].action).toBe("exec");
    expect(received[0].allowed).toBe(true);
  });

  it("fires multiple listeners for the same event", () => {
    let count = 0;
    bus.on("action.evaluated", () => count++);
    bus.on("action.evaluated", () => count++);

    bus.emit({ type: "action.evaluated", action: "exec", allowed: false });

    expect(count).toBe(2);
  });

  it("unsubscribe stops delivery", () => {
    let count = 0;
    const unsub = bus.on("action.evaluated", () => count++);

    bus.emit({ type: "action.evaluated", action: "exec", allowed: true });
    expect(count).toBe(1);

    unsub();
    bus.emit({ type: "action.evaluated", action: "exec", allowed: true });
    expect(count).toBe(1);
  });

  it("onAny receives all event types", () => {
    const events: SecurityEvent[] = [];
    bus.onAny((e) => events.push(e));

    bus.emit({ type: "action.evaluated", action: "exec", allowed: true });
    bus.emit({
      type: "taint.elevated",
      previousLevel: "owner",
      newLevel: "web",
      source: "fetch",
    });

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("action.evaluated");
    expect(events[1].type).toBe("taint.elevated");
  });

  it("auto-populates id (UUID) and timestamp", () => {
    const event = bus.emit({
      type: "action.evaluated",
      action: "exec",
      allowed: true,
    });

    expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(new Date(event.timestamp).getTime()).not.toBeNaN();
  });

  it("event type isolation — handler for A does not fire on B", () => {
    let fired = false;
    bus.on("taint.elevated", () => {
      fired = true;
    });

    bus.emit({ type: "action.evaluated", action: "exec", allowed: true });

    expect(fired).toBe(false);
  });

  it("clear() removes all handlers", () => {
    let count = 0;
    bus.on("action.evaluated", () => count++);
    bus.onAny(() => count++);
    bus.clear();

    bus.emit({ type: "action.evaluated", action: "exec", allowed: true });
    expect(count).toBe(0);
  });

  it("listenerCount returns correct count", () => {
    bus.on("action.evaluated", () => {});
    bus.on("action.evaluated", () => {});
    bus.on("taint.elevated", () => {});

    expect(bus.listenerCount("action.evaluated")).toBe(2);
    expect(bus.listenerCount("taint.elevated")).toBe(1);
    expect(bus.listenerCount("skill.integrity_violation")).toBe(0);
  });

  it("constructed events pass schema validation", () => {
    const event = bus.emit({
      type: "egress.secret_detected",
      patternName: "aws_key",
      channel: "slack",
      redacted: true,
    });

    const result = SecurityEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  // T7: Concurrent event emission tests
  it("multiple rapid emissions don't lose events", () => {
    const received: SecurityEvent[] = [];
    bus.on("action.evaluated", (e) => received.push(e));

    const count = 100;
    for (let i = 0; i < count; i++) {
      bus.emit({
        type: "action.evaluated",
        action: `exec-${i}`,
        allowed: true,
      });
    }

    expect(received).toHaveLength(count);
    // Verify each event has a unique ID
    const ids = new Set(received.map((e) => e.id));
    expect(ids.size).toBe(count);
  });

  it("handlers from one type don't interfere with another", () => {
    const actionEvents: SecurityEvent[] = [];
    const taintEvents: SecurityEvent[] = [];

    bus.on("action.evaluated", (e) => actionEvents.push(e));
    bus.on("taint.elevated", (e) => taintEvents.push(e));

    // Emit both types rapidly
    for (let i = 0; i < 50; i++) {
      bus.emit({ type: "action.evaluated", action: `exec-${i}`, allowed: true });
      bus.emit({
        type: "taint.elevated",
        previousLevel: "owner",
        newLevel: "web",
        source: `source-${i}`,
      });
    }

    expect(actionEvents).toHaveLength(50);
    expect(taintEvents).toHaveLength(50);

    // Verify no cross-contamination
    for (const e of actionEvents) {
      expect(e.type).toBe("action.evaluated");
    }
    for (const e of taintEvents) {
      expect(e.type).toBe("taint.elevated");
    }
  });
});
