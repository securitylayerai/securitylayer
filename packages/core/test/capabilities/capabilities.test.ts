import { describe, expect, it } from "vitest";
import type { CapabilityStore } from "@/capabilities/gate";
import { checkCapability } from "@/capabilities/gate";
import { buildCapabilityStore } from "@/capabilities/loader";
import { CapabilitySet, parseCapabilityString } from "@/capabilities/set";
import { BASE_CAPABILITIES } from "@/capabilities/types";
import { defaultLearnedRulesConfig, defaultMainConfig } from "@/config/defaults";
import type { LoadedConfig } from "@/config/types";

// ---------------------------------------------------------------------------
// CapabilitySet
// ---------------------------------------------------------------------------

describe("CapabilitySet", () => {
  it("basic has/missing", () => {
    const set = new CapabilitySet(["exec", "file.read"]);
    expect(set.has("exec")).toBe(true);
    expect(set.has("file.read")).toBe(true);
    expect(set.has("file.write")).toBe(false);
  });

  it("taint-qualified: has('exec', 'owner') with exec:trusted → true", () => {
    const set = new CapabilitySet(["exec:trusted"]);
    expect(set.has("exec", "owner")).toBe(true); // owner more trusted than trusted
  });

  it("taint-qualified reject: has('exec', 'web') with exec:trusted → false", () => {
    const set = new CapabilitySet(["exec:trusted"]);
    expect(set.has("exec", "web")).toBe(false); // web less trusted than trusted
  });

  it("unrestricted overrides qualified", () => {
    const set = new CapabilitySet(["exec:trusted", "exec"]);
    expect(set.has("exec", "web")).toBe(true); // unrestricted, any taint OK
  });

  describe("intersect", () => {
    it("basic intersection — only shared capabilities", () => {
      const a = new CapabilitySet(["exec", "file.read", "file.write"]);
      const b = new CapabilitySet(["exec", "file.read", "browser"]);
      const result = CapabilitySet.intersect(a, b);
      expect(result.has("exec")).toBe(true);
      expect(result.has("file.read")).toBe(true);
      expect(result.has("file.write")).toBe(false);
      expect(result.has("browser")).toBe(false);
    });

    it("taint-aware intersection — picks more restrictive", () => {
      const a = new CapabilitySet(["exec:web"]);
      const b = new CapabilitySet(["exec:trusted"]);
      const result = CapabilitySet.intersect(a, b);
      // trusted is more restrictive (lower severity) → result is exec:trusted
      expect(result.has("exec", "owner")).toBe(true);
      expect(result.has("exec", "trusted")).toBe(true);
      expect(result.has("exec", "web")).toBe(false);
    });

    it("empty intersection", () => {
      const a = new CapabilitySet(["exec"]);
      const b = new CapabilitySet(["file.read"]);
      const result = CapabilitySet.intersect(a, b);
      expect(result.size).toBe(0);
    });

    it("unrestricted vs qualified → qualified wins", () => {
      const a = new CapabilitySet(["exec"]);
      const b = new CapabilitySet(["exec:trusted"]);
      const result = CapabilitySet.intersect(a, b);
      expect(result.has("exec", "owner")).toBe(true);
      expect(result.has("exec", "web")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Gate function
// ---------------------------------------------------------------------------

describe("checkCapability (gate)", () => {
  function makeStore(opts: {
    sessions?: Record<string, string[]>;
    skills?: Record<string, string[]>;
    channels?: Record<string, string[] | "ALL">;
  }): CapabilityStore {
    const sessions = new Map<string, CapabilitySet>();
    for (const [id, caps] of Object.entries(opts.sessions ?? {})) {
      sessions.set(id, new CapabilitySet(caps));
    }

    const skills = new Map<string, CapabilitySet>();
    for (const [id, caps] of Object.entries(opts.skills ?? {})) {
      skills.set(id, new CapabilitySet(caps));
    }

    const channels = new Map<string, CapabilitySet>();
    const fullCaps = new CapabilitySet(BASE_CAPABILITIES.slice());
    for (const [id, caps] of Object.entries(opts.channels ?? {})) {
      channels.set(id, caps === "ALL" ? fullCaps : new CapabilitySet(caps));
    }

    const minimumSkillCaps = new CapabilitySet(["channel.send"]);

    return {
      getSessionCaps: (id) => sessions.get(id),
      getSkillCaps: (id) => skills.get(id) ?? minimumSkillCaps,
      getChannelCaps: (id) => channels.get(id),
    };
  }

  it("session allows action", () => {
    const store = makeStore({ sessions: { s1: ["exec", "file.read"] } });
    const result = checkCapability("bash", { sessionId: "s1" }, store);
    expect(result.allowed).toBe(true);
  });

  it("session denies action", () => {
    const store = makeStore({ sessions: { s1: ["file.read"] } });
    const result = checkCapability("bash", { sessionId: "s1" }, store);
    expect(result.allowed).toBe(false);
  });

  it("skill intersection narrows access", () => {
    const store = makeStore({
      sessions: { s1: ["exec", "file.read", "file.write"] },
      skills: { sk1: ["file.read"] },
    });
    const result = checkCapability("bash", { sessionId: "s1", skillId: "sk1" }, store);
    expect(result.allowed).toBe(false);
    const result2 = checkCapability("read", { sessionId: "s1", skillId: "sk1" }, store);
    expect(result2.allowed).toBe(true);
  });

  it("channel intersection narrows access", () => {
    const store = makeStore({
      sessions: { s1: ["exec", "file.read"] },
      channels: { ch1: ["file.read"] },
    });
    const result = checkCapability("bash", { sessionId: "s1", channelId: "ch1" }, store);
    expect(result.allowed).toBe(false);
    const result2 = checkCapability("read", { sessionId: "s1", channelId: "ch1" }, store);
    expect(result2.allowed).toBe(true);
  });

  it("triple intersection (session ∩ skill ∩ channel)", () => {
    const store = makeStore({
      sessions: { s1: ["exec", "file.read", "file.write", "channel.send"] },
      skills: { sk1: ["exec", "file.read", "channel.send"] },
      channels: { ch1: ["file.read", "channel.send"] },
    });
    // Only file.read and channel.send survive all three
    const ctx = { sessionId: "s1", skillId: "sk1", channelId: "ch1" };
    expect(checkCapability("bash", ctx, store).allowed).toBe(false);
    expect(checkCapability("read", ctx, store).allowed).toBe(true);
    expect(checkCapability("write", ctx, store).allowed).toBe(false);
  });

  it("taint-aware gate denial", () => {
    const store = makeStore({
      sessions: { s1: ["exec:trusted"] },
    });
    expect(checkCapability("bash", { sessionId: "s1" }, store, "owner").allowed).toBe(true);
    expect(checkCapability("bash", { sessionId: "s1" }, store, "web").allowed).toBe(false);
  });

  it("unknown tool → denied", () => {
    const store = makeStore({ sessions: { s1: ["exec"] } });
    const result = checkCapability("unknown_tool", { sessionId: "s1" }, store);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown action");
  });

  it("unknown session → denied", () => {
    const store = makeStore({ sessions: {} });
    const result = checkCapability("bash", { sessionId: "nonexistent" }, store);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown session");
  });

  it("unknown skill → minimum capabilities (channel.send only)", () => {
    const store = makeStore({
      sessions: { s1: ["exec", "channel.send"] },
    });
    // Unknown skill gets minimum caps (channel.send only)
    expect(checkCapability("bash", { sessionId: "s1", skillId: "unknown" }, store).allowed).toBe(
      false,
    );
    expect(
      checkCapability("channel.send", { sessionId: "s1", skillId: "unknown" }, store).allowed,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

describe("buildCapabilityStore", () => {
  it("builds store from config and verifies lookups", () => {
    const config: LoadedConfig = {
      main: defaultMainConfig(),
      sessions: {
        version: 1,
        sessions: {
          dev: { capabilities: ["exec", "file.read", "file.write"], default_taint: "owner" },
        },
      },
      channels: {
        version: 1,
        channels: {
          local: { max_capabilities: ["exec", "file.read"] },
        },
      },
      skills: {
        version: 1,
        skills: {
          review: { capabilities: ["file.read", "channel.send"] },
        },
      },
      learnedRules: defaultLearnedRulesConfig(),
    };

    const store = buildCapabilityStore(config);

    // Session lookup
    const devCaps = store.getSessionCaps("dev");
    expect(devCaps).toBeDefined();
    expect(devCaps?.has("exec")).toBe(true);
    expect(devCaps?.has("browser")).toBe(false);

    // Skill lookup
    const reviewCaps = store.getSkillCaps("review");
    expect(reviewCaps.has("file.read")).toBe(true);
    expect(reviewCaps.has("exec")).toBe(false);

    // Unknown skill → minimum caps
    const unknownSkill = store.getSkillCaps("nonexistent");
    expect(unknownSkill.has("channel.send")).toBe(true);
    expect(unknownSkill.has("exec")).toBe(false);

    // Channel lookup
    const localCaps = store.getChannelCaps("local");
    expect(localCaps).toBeDefined();
    expect(localCaps?.has("exec")).toBe(true);
    expect(localCaps?.has("browser")).toBe(false);
  });

  it("'ALL' channel grants full capabilities", () => {
    const config: LoadedConfig = {
      main: defaultMainConfig(),
      sessions: { version: 1, sessions: {} },
      channels: {
        version: 1,
        channels: {
          local: { max_capabilities: "ALL" },
        },
      },
      skills: { version: 1, skills: {} },
      learnedRules: defaultLearnedRulesConfig(),
    };

    const store = buildCapabilityStore(config);
    const caps = store.getChannelCaps("local");
    expect(caps).toBeDefined();

    for (const base of BASE_CAPABILITIES) {
      expect(caps?.has(base)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// T3: Taint-aware capability edge cases
// ---------------------------------------------------------------------------

describe("parseCapabilityString — taint validation (C3)", () => {
  it("rejects invalid taint level", () => {
    expect(() => parseCapabilityString("exec:invalid_taint")).toThrow("Invalid taint level");
  });

  it("accepts valid taint levels", () => {
    expect(() => parseCapabilityString("exec:owner")).not.toThrow();
    expect(() => parseCapabilityString("exec:trusted")).not.toThrow();
    expect(() => parseCapabilityString("exec:web")).not.toThrow();
    expect(() => parseCapabilityString("exec:skill")).not.toThrow();
    expect(() => parseCapabilityString("exec:memory")).not.toThrow();
  });

  it("accepts capability without taint", () => {
    const result = parseCapabilityString("exec");
    expect(result.base).toBe("exec");
    expect(result.taint).toBeUndefined();
  });

  it("rejects unknown base capability", () => {
    expect(() => parseCapabilityString("nonexistent")).toThrow("Unknown base capability");
  });
});

describe("CapabilitySet — undefined taint + restricted capability", () => {
  it("undefined taint context grants access if capability exists", () => {
    const set = new CapabilitySet(["exec:trusted"]);
    // No taint context — capability is present, should be granted
    expect(set.has("exec")).toBe(true);
  });

  it("memory.read.trusted is a valid capability", () => {
    const set = new CapabilitySet(["memory.read.trusted"]);
    expect(set.has("memory.read.trusted")).toBe(true);
  });
});
