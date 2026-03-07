import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  getPackMetadata,
  loadBaselineRules,
  loadChannelDefaults,
  loadSessionTemplates,
  loadSkillDefaults,
} from "../src/index";

const VALID_MATCH_TYPES = new Set(["binary", "path", "pipe", "pattern", "pipe_pair"]);
const VALID_DECISIONS = new Set(["DENY", "REQUIRE_APPROVAL"]);

interface ParsedRule {
  id: string;
  description: string;
  match: {
    type: string;
    value: string | RegExp;
    from?: string[];
    to?: string[];
  };
  decision: string;
  reason: string;
}

function parseRulesFromYaml(content: string): ParsedRule[] {
  const parsed = parseYaml(content);
  if (!parsed?.rules || !Array.isArray(parsed.rules)) return [];
  return parsed.rules.map((raw: Record<string, unknown>) => {
    const match = raw.match as Record<string, unknown>;
    return {
      id: raw.id as string,
      description: raw.description as string,
      match: {
        type: match.type as string,
        value: match.type === "pattern" ? new RegExp(match.value as string) : match.value,
        from: match.from as string[] | undefined,
        to: match.to as string[] | undefined,
      },
      decision: raw.decision as string,
      reason: raw.reason as string,
    };
  });
}

describe("rules pack metadata", () => {
  it("returns correct pack metadata", () => {
    const meta = getPackMetadata();
    expect(meta.name).toBe("@securitylayerai/rules");
    expect(meta.type).toBe("rule-pack");
    expect(meta.ruleCount).toBeGreaterThan(0);
  });
});

describe("loadBaselineRules", () => {
  it("loads baseline YAML as string", async () => {
    const yaml = await loadBaselineRules();
    expect(typeof yaml).toBe("string");
    expect(yaml).toContain("version: 1");
    expect(yaml).toContain("rules:");
  });

  it("parses into 13 rules", async () => {
    const yaml = await loadBaselineRules();
    const rules = parseRulesFromYaml(yaml);
    expect(rules.length).toBe(13);
  });

  it("every rule has required fields", async () => {
    const yaml = await loadBaselineRules();
    const rules = parseRulesFromYaml(yaml);
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(rule.match).toBeTruthy();
      expect(VALID_MATCH_TYPES).toContain(rule.match.type);
      expect(rule.reason).toBeTruthy();
      expect(VALID_DECISIONS).toContain(rule.decision);
    }
  });

  it("contains expected rule IDs", async () => {
    const yaml = await loadBaselineRules();
    const rules = parseRulesFromYaml(yaml);
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("destructive-chmod-recursive-777");
    expect(ids).toContain("destructive-chown-recursive");
    expect(ids).toContain("cred-gnupg");
    expect(ids).toContain("cred-pem-files");
    expect(ids).toContain("cred-kube-config");
    expect(ids).toContain("cred-docker-config");
    expect(ids).toContain("exfil-base64-to-curl");
    expect(ids).toContain("exfil-tar-to-curl");
    expect(ids).toContain("rce-python-pipe");
    expect(ids).toContain("rce-eval-command");
    expect(ids).toContain("dangerous-git-force-push");
    expect(ids).toContain("dangerous-npm-publish");
    expect(ids).toContain("dangerous-docker-privileged");
  });

  it("has correct match types for each rule category", async () => {
    const yaml = await loadBaselineRules();
    const rules = parseRulesFromYaml(yaml);
    const byId = Object.fromEntries(rules.map((r) => [r.id, r]));

    expect(byId["destructive-chmod-recursive-777"].match.type).toBe("pattern");
    expect(byId["dangerous-docker-privileged"].match.type).toBe("pattern");
    expect(byId["cred-gnupg"].match.type).toBe("path");
    expect(byId["cred-kube-config"].match.type).toBe("path");
    expect(byId["exfil-base64-to-curl"].match.type).toBe("pipe_pair");
    expect(byId["rce-python-pipe"].match.type).toBe("pipe_pair");
  });

  it("eval rule uses REQUIRE_APPROVAL, not DENY", async () => {
    const yaml = await loadBaselineRules();
    const rules = parseRulesFromYaml(yaml);
    const evalRule = rules.find((r) => r.id === "rce-eval-command");
    expect(evalRule?.decision).toBe("REQUIRE_APPROVAL");
  });

  it("npm-publish uses REQUIRE_APPROVAL", async () => {
    const yaml = await loadBaselineRules();
    const rules = parseRulesFromYaml(yaml);
    const npmRule = rules.find((r) => r.id === "dangerous-npm-publish");
    expect(npmRule?.decision).toBe("REQUIRE_APPROVAL");
  });

  it("pattern rules produce valid RegExp", async () => {
    const yaml = await loadBaselineRules();
    const rules = parseRulesFromYaml(yaml);
    const patternRules = rules.filter((r) => r.match.type === "pattern");
    for (const rule of patternRules) {
      expect(rule.match.value).toBeInstanceOf(RegExp);
    }
  });

  it("pipe_pair rules have from and to arrays", async () => {
    const yaml = await loadBaselineRules();
    const rules = parseRulesFromYaml(yaml);
    const pipePairRules = rules.filter((r) => r.match.type === "pipe_pair");
    for (const rule of pipePairRules) {
      expect(Array.isArray(rule.match.from)).toBe(true);
      expect(Array.isArray(rule.match.to)).toBe(true);
      expect(rule.match.from?.length).toBeGreaterThan(0);
      expect(rule.match.to?.length).toBeGreaterThan(0);
    }
  });
});

describe("loadSessionTemplates", () => {
  it("loads session templates", async () => {
    const config = await loadSessionTemplates();
    expect(config.version).toBe(1);
    expect(config.sessions).toBeDefined();
  });

  it("has main, group, and dm-unknown templates", async () => {
    const config = await loadSessionTemplates();
    expect(config.sessions.main).toBeDefined();
    expect(config.sessions.group).toBeDefined();
    expect(config.sessions["dm-unknown"]).toBeDefined();
  });

  it("main session has all 15 capabilities", async () => {
    const config = await loadSessionTemplates();
    expect(config.sessions.main.capabilities.length).toBe(15);
    expect(config.sessions.main.default_taint).toBe("owner");
  });

  it("group session has restricted capabilities", async () => {
    const config = await loadSessionTemplates();
    const caps = config.sessions.group.capabilities;
    expect(caps).toContain("channel.send");
    expect(caps).toContain("file.read");
    expect(caps).not.toContain("exec");
    expect(caps).not.toContain("file.write");
  });

  it("dm-unknown session has only channel.send", async () => {
    const config = await loadSessionTemplates();
    expect(config.sessions["dm-unknown"].capabilities).toEqual(["channel.send"]);
  });
});

describe("loadChannelDefaults", () => {
  it("loads channel defaults", async () => {
    const config = await loadChannelDefaults();
    expect(config.version).toBe(1);
    expect(config.channels).toBeDefined();
  });

  it("has expected channels", async () => {
    const config = await loadChannelDefaults();
    const channels = Object.keys(config.channels);
    expect(channels).toContain("owner-terminal");
    expect(channels).toContain("whatsapp");
    expect(channels).toContain("telegram");
    expect(channels).toContain("slack");
    expect(channels).toContain("discord");
    expect(channels).toContain("email");
    expect(channels).toContain("webchat");
  });

  it("owner-terminal has ALL max_capabilities", async () => {
    const config = await loadChannelDefaults();
    expect(config.channels["owner-terminal"].max_capabilities).toBe("ALL");
  });

  it("restricted channels lack exec", async () => {
    const config = await loadChannelDefaults();
    for (const name of ["whatsapp", "telegram", "discord", "email", "webchat"]) {
      const caps = config.channels[name].max_capabilities;
      expect(caps).not.toContain("exec");
    }
  });

  it("slack has exec capability", async () => {
    const config = await loadChannelDefaults();
    const caps = config.channels.slack.max_capabilities;
    expect(caps).toContain("exec");
  });
});

describe("loadSkillDefaults", () => {
  it("loads skill defaults", async () => {
    const config = await loadSkillDefaults();
    expect(config.version).toBe(1);
    expect(config.skills).toBeDefined();
  });

  it("has expected skill profiles", async () => {
    const config = await loadSkillDefaults();
    const skills = Object.keys(config.skills);
    expect(skills).toContain("read-only");
    expect(skills).toContain("file-editor");
    expect(skills).toContain("web-only");
    expect(skills).toContain("full-access");
  });

  it("read-only has file.read and web_fetch only", async () => {
    const config = await loadSkillDefaults();
    expect(config.skills["read-only"].capabilities).toEqual(["file.read", "web_fetch"]);
  });

  it("web-only has web_fetch only", async () => {
    const config = await loadSkillDefaults();
    expect(config.skills["web-only"].capabilities).toEqual(["web_fetch"]);
  });

  it("full-access does not include elevated capabilities", async () => {
    const config = await loadSkillDefaults();
    const caps = config.skills["full-access"].capabilities;
    expect(caps).not.toContain("exec.elevated");
    expect(caps).not.toContain("browser.login");
    expect(caps).not.toContain("channel.send.external");
    expect(caps).not.toContain("cron.create");
    expect(caps).not.toContain("skill.install");
    expect(caps).not.toContain("node.invoke");
  });
});
