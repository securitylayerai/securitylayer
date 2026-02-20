import type { CapabilityResult } from "../capabilities/types.js";
import { eventBus } from "../events/bus.js";
import type { SkillDeclaration } from "./types.js";

/**
 * Checks if a skill has declared the capability it's trying to use.
 * Undeclared capabilities → DENY + emit integrity violation event.
 */
export function checkSkillCapability(
  skillId: string,
  action: string,
  declarations: Map<string, SkillDeclaration>,
): CapabilityResult {
  const decl = declarations.get(skillId);

  if (!decl) {
    eventBus.emit({
      type: "skill.integrity_violation",
      skillId,
      violation: `Unknown skill "${skillId}" attempted action "${action}"`,
    });
    return { allowed: false, reason: `Unknown skill: ${skillId}` };
  }

  // Check if action is in declared capabilities
  const hasCapability = decl.capabilities.some((cap) => cap === action);
  if (!hasCapability) {
    eventBus.emit({
      type: "skill.integrity_violation",
      skillId,
      violation: `Skill "${skillId}" used undeclared capability "${action}"`,
    });
    return {
      allowed: false,
      reason: `Skill "${skillId}" did not declare capability "${action}"`,
    };
  }

  // Check if action is explicitly restricted
  if (decl.restricted.includes(action as never)) {
    return {
      allowed: false,
      reason: `Capability "${action}" is restricted for skill "${skillId}"`,
    };
  }

  return { allowed: true };
}
