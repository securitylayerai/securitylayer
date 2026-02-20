import type { LoadedConfig } from "@/config/types";
import type { CapabilityStore } from "./gate";
import { CapabilitySet } from "./set";
import { BASE_CAPABILITIES } from "./types";

/** Minimum capabilities for unknown skills: only channel.send. */
const MINIMUM_SKILL_CAPS = new CapabilitySet(["channel.send"]);

/** Full capability set (all 14 base capabilities, unrestricted). */
const FULL_CAPS = new CapabilitySet(BASE_CAPABILITIES.slice());

/**
 * Pre-compute all CapabilitySets from loaded config.
 * This runs once at startup — the gate only does Map.get() at runtime.
 */
export function buildCapabilityStore(config: LoadedConfig): CapabilityStore {
  const sessions = new Map<string, CapabilitySet>();
  for (const [id, session] of Object.entries(config.sessions.sessions)) {
    sessions.set(id, new CapabilitySet(session.capabilities));
  }

  const skills = new Map<string, CapabilitySet>();
  for (const [id, skill] of Object.entries(config.skills.skills)) {
    skills.set(id, new CapabilitySet(skill.capabilities));
  }

  const channels = new Map<string, CapabilitySet>();
  for (const [id, channel] of Object.entries(config.channels.channels)) {
    if (channel.max_capabilities === "ALL") {
      channels.set(id, FULL_CAPS);
    } else {
      channels.set(id, new CapabilitySet(channel.max_capabilities));
    }
  }

  return {
    getSessionCaps(sessionId: string) {
      return sessions.get(sessionId);
    },
    getSkillCaps(skillId: string) {
      return skills.get(skillId) ?? MINIMUM_SKILL_CAPS;
    },
    getChannelCaps(channelId: string) {
      return channels.get(channelId);
    },
  };
}
