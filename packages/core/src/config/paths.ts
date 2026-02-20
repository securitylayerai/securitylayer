import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = join(homedir(), ".securitylayer");

export const CONFIG_PATHS = {
  main: join(CONFIG_DIR, "config.yaml"),
  sessions: join(CONFIG_DIR, "capabilities", "sessions.yaml"),
  channels: join(CONFIG_DIR, "capabilities", "channels.yaml"),
  skills: join(CONFIG_DIR, "capabilities", "skills.yaml"),
  learnedRules: join(CONFIG_DIR, "learned-rules.json"),
} as const;
