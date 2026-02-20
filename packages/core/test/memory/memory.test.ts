import { describe, expect, it } from "vitest";
import { verifyIntegrity } from "../../src/memory/integrity";
import { tagProvenance } from "../../src/memory/provenance";
import { scanMemoryEntries } from "../../src/memory/scanner";

describe("tagProvenance", () => {
  it("creates entry with correct hash", () => {
    const entry = tagProvenance("hello world", "owner", { channel: "local" });
    expect(entry.content).toBe("hello world");
    expect(entry.provenance.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.provenance.source).toBe("owner");
    expect(entry.provenance.channel).toBe("local");
  });

  it("includes all metadata fields", () => {
    const entry = tagProvenance("data", "trusted", {
      channel: "slack",
      sender: "user1",
      sessionId: "s1",
    });
    expect(entry.provenance.channel).toBe("slack");
    expect(entry.provenance.sender).toBe("user1");
    expect(entry.provenance.sessionId).toBe("s1");
    expect(entry.provenance.timestamp).toBeTruthy();
  });

  // M3: timestamp is now a number (epoch ms)
  it("timestamp is a number (epoch ms)", () => {
    const before = Date.now();
    const entry = tagProvenance("data", "owner");
    const after = Date.now();
    expect(typeof entry.provenance.timestamp).toBe("number");
    expect(entry.provenance.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.provenance.timestamp).toBeLessThanOrEqual(after);
  });
});

describe("verifyIntegrity", () => {
  it("passes for untampered entry", () => {
    const entry = tagProvenance("test content", "owner");
    expect(verifyIntegrity(entry)).toBe(true);
  });

  it("fails for tampered content", () => {
    const entry = tagProvenance("original", "owner");
    entry.content = "tampered";
    expect(verifyIntegrity(entry)).toBe(false);
  });
});

describe("scanMemoryEntries", () => {
  it("assigns taint based on source", () => {
    const entries = scanMemoryEntries([
      { content: "trusted data", source: "trusted" },
      { content: "web data", source: "web" },
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0].provenance.source).toBe("trusted");
    expect(entries[1].provenance.source).toBe("web");
  });

  it("defaults to memory taint for unknown source", () => {
    const entries = scanMemoryEntries([{ content: "unknown" }]);
    expect(entries).toHaveLength(1);
    expect(entries[0].provenance.source).toBe("memory");
  });

  it("skips invalid entries", () => {
    const entries = scanMemoryEntries(["not an object", null, 42, { content: "valid" }]);
    expect(entries).toHaveLength(1);
  });
});
