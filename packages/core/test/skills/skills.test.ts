import { beforeEach, describe, expect, it } from "vitest";
import { eventBus } from "../../src/events/bus.js";
import { checkSkillCapability } from "../../src/skills/enforcer.js";
import { computeSkillHash, verifySkillIntegrity } from "../../src/skills/integrity.js";
import type { SkillDeclaration } from "../../src/skills/types.js";

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
