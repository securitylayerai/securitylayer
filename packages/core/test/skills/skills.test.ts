import { beforeEach, describe, expect, it } from "vitest";
import { createEventBus, eventBus } from "@/events/bus";
import type { SkillIntegrityViolationEvent } from "@/events/types";
import { checkSkillCapability } from "@/skills/enforcer";
import { computeSkillHash, verifySkillIntegrity } from "@/skills/integrity";
import type { SkillDeclaration } from "@/skills/types";

describe("checkSkillCapability", () => {
  let declarations: Map<string, SkillDeclaration>;

  beforeEach(() => {
    eventBus.clear();
    declarations = new Map([
      [
        "code-review",
        {
          id: "code-review",
          capabilities: ["file.read", "channel.send"],
          restricted: [],
        },
      ],
    ]);
  });

  it("declared capability → allowed", () => {
    const result = checkSkillCapability("code-review", "file.read", declarations);
    expect(result.allowed).toBe(true);
  });

  it("undeclared capability → denied", () => {
    const result = checkSkillCapability("code-review", "exec", declarations);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("did not declare");
  });

  it("unknown skill → denied", () => {
    const result = checkSkillCapability("unknown-skill", "exec", declarations);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown skill");
  });

  // M7: injectable EventBus
  it("uses injected event bus for violations", () => {
    const customBus = createEventBus();
    const customEvents: SkillIntegrityViolationEvent[] = [];
    const singletonEvents: SkillIntegrityViolationEvent[] = [];

    customBus.on("skill.integrity_violation", (e) => customEvents.push(e));
    eventBus.on("skill.integrity_violation", (e) => singletonEvents.push(e));

    checkSkillCapability("code-review", "exec", declarations, customBus);

    expect(customEvents).toHaveLength(1);
    expect(customEvents[0].skillId).toBe("code-review");
    // Singleton should NOT receive event
    expect(singletonEvents).toHaveLength(0);

    customBus.clear();
  });

  it("falls back to singleton bus when no bus injected", () => {
    const singletonEvents: SkillIntegrityViolationEvent[] = [];
    eventBus.on("skill.integrity_violation", (e) => singletonEvents.push(e));

    checkSkillCapability("code-review", "exec", declarations); // no bus

    expect(singletonEvents).toHaveLength(1);
  });
});

describe("skill integrity", () => {
  const content = 'function doSomething() { return "hello"; }';

  it("hash computation is deterministic", () => {
    const hash1 = computeSkillHash(content);
    const hash2 = computeSkillHash(content);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verification passes with matching hash", () => {
    const hash = computeSkillHash(content);
    expect(verifySkillIntegrity(hash, content)).toBe(true);
  });

  it("verification fails with tampered content", () => {
    const hash = computeSkillHash(content);
    const tampered = `${content} // injected code`;
    expect(verifySkillIntegrity(hash, tampered)).toBe(false);
  });
});
