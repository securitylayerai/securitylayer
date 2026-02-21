import type { CliArgs } from "@/index";
import { formatTaintLevel, loadConfigOrSuggestInit } from "@/shared";

export async function runCapabilitiesShow(_args: CliArgs): Promise<void> {
  const config = await loadConfigOrSuggestInit();

  console.log("Capability Grants");
  console.log("═".repeat(50));

  // Sessions
  const sessions = config.sessions.sessions as Record<
    string,
    { capabilities: string[]; default_taint: string }
  >;
  const sessionIds = Object.keys(sessions);
  console.log(`\nSessions (${sessionIds.length}):`);
  for (const id of sessionIds) {
    const session = sessions[id];
    console.log(
      `\n  \x1b[1m${id}\x1b[0m (default taint: ${formatTaintLevel(session.default_taint)})`,
    );
    if (session.capabilities.length === 0) {
      console.log("    (no capabilities granted)");
    } else {
      for (const cap of session.capabilities) {
        const [base, taint] = cap.split(":");
        if (taint) {
          console.log(`    ${base} \x1b[2m(requires ${formatTaintLevel(taint)} or better)\x1b[0m`);
        } else {
          console.log(`    ${base}`);
        }
      }
    }
  }

  // Channels
  const channels = config.channels.channels;
  const channelIds = Object.keys(channels);
  if (channelIds.length > 0) {
    console.log(`\nChannels (${channelIds.length}):`);
    for (const id of channelIds) {
      const channel = channels[id];
      console.log(`\n  \x1b[1m${id}\x1b[0m`);
      if (channel.max_capabilities === "ALL") {
        console.log("    ALL (unrestricted)");
      } else {
        for (const cap of channel.max_capabilities) {
          console.log(`    ${cap}`);
        }
      }
    }
  }

  // Skills
  const skills = config.skills.skills;
  const skillIds = Object.keys(skills);
  if (skillIds.length > 0) {
    console.log(`\nSkills (${skillIds.length}):`);
    for (const id of skillIds) {
      const skill = skills[id];
      if (skill.capabilities.length === 0) {
        console.log(`\n  \x1b[1m${id}\x1b[0m`);
        console.log("    (minimum capabilities: channel.send)");
      } else {
        console.log(`\n  \x1b[1m${id}\x1b[0m`);
        for (const cap of skill.capabilities) {
          console.log(`    ${cap}`);
        }
      }
    }
  }
}
