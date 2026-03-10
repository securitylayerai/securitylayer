import { describe, expect, it } from "vitest";
import { createSessionState } from "@/session";

describe("createSessionState", () => {
  it("auto-generates a UUID when no sessionId provided", () => {
    const session = createSessionState();
    expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("uses provided sessionId", () => {
    const session = createSessionState("my-session");
    expect(session.id).toBe("my-session");
  });

  it("accumulates action history", () => {
    const session = createSessionState();
    session.addAction("exec");
    session.addAction("file.read");
    session.addAction("web_fetch");
    expect(session.getHistory()).toEqual(["exec", "file.read", "web_fetch"]);
  });

  it("caps history at 100 entries", () => {
    const session = createSessionState();
    for (let i = 0; i < 110; i++) {
      session.addAction(`action-${i}`);
    }
    const history = session.getHistory();
    expect(history).toHaveLength(100);
    expect(history[0]).toBe("action-10");
    expect(history[99]).toBe("action-109");
  });

  it("clear() empties the history", () => {
    const session = createSessionState();
    session.addAction("exec");
    session.addAction("file.read");
    session.clear();
    expect(session.getHistory()).toEqual([]);
  });

  it("getHistory() returns a copy", () => {
    const session = createSessionState();
    session.addAction("exec");
    const history = session.getHistory();
    history.push("tampered");
    expect(session.getHistory()).toEqual(["exec"]);
  });
});
