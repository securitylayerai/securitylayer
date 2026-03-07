import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliArgs } from "@/index";

const { TEST_DIR, mockConfigExists, mockResolveRealBinary, mockDetectShell, mockEnsureConfigDir } =
  vi.hoisted(() => {
    const os = require("node:os");
    const path = require("node:path");
    const d = path.join(os.tmpdir(), `securitylayer-test-shield-${Date.now()}`);
    return {
      TEST_DIR: d,
      mockConfigExists: vi.fn(),
      mockResolveRealBinary: vi.fn(),
      mockDetectShell: vi.fn().mockReturnValue("bash"),
      mockEnsureConfigDir: vi.fn(),
    };
  });

const SHIM_DIR = join(TEST_DIR, "bin");
const PROFILE_PATH = join(TEST_DIR, ".bashrc");

vi.mock("@securitylayerai/core", () => ({
  CONFIG_DIR: TEST_DIR,
  CONFIG_PATHS: {
    main: join(TEST_DIR, "config.yaml"),
  },
  TaintLevelSchema: { default: () => ({ _type: "string" }) },
  CapabilityStringSchema: { _type: "string" },
}));

vi.mock("@/shared", () => ({
  configExists: mockConfigExists,
  ensureConfigDir: mockEnsureConfigDir,
  resolveRealBinary: mockResolveRealBinary,
  detectShell: mockDetectShell,
  getShellProfilePath: () => PROFILE_PATH,
  CLI_CONFIG_PATHS: { callers: "/tmp/ai-tools.yaml", projects: "/tmp/projects.yaml" },
}));

import { runShieldDisable, runShieldEnable, runShieldStatus } from "@/shield";

describe("Shield Commands", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await mkdir(SHIM_DIR, { recursive: true });
    await writeFile(PROFILE_PATH, "# shell profile\n");
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  describe("runShieldEnable", () => {
    it("exits 1 when config not exists", async () => {
      mockConfigExists.mockReturnValue(false);

      await runShieldEnable({ _: ["shield", "enable"] } as CliArgs);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not configured"));
    });

    it("creates shim scripts for found binaries", async () => {
      mockConfigExists.mockReturnValue(true);
      mockEnsureConfigDir.mockResolvedValue(undefined);
      mockResolveRealBinary.mockImplementation(async (name: string) => {
        if (name === "bash") return "/usr/bin/bash";
        if (name === "sh") return "/bin/sh";
        return null;
      });

      await runShieldEnable({ _: ["shield", "enable"] } as CliArgs);

      expect(existsSync(join(SHIM_DIR, "bash"))).toBe(true);
      expect(existsSync(join(SHIM_DIR, "sh"))).toBe(true);

      const bashShim = await readFile(join(SHIM_DIR, "bash"), "utf-8");
      expect(bashShim).toContain("#!/bin/sh");
      expect(bashShim).toContain("/usr/bin/bash");
    });

    it("skips binaries not found in PATH", async () => {
      mockConfigExists.mockReturnValue(true);
      mockEnsureConfigDir.mockResolvedValue(undefined);
      mockResolveRealBinary.mockImplementation(async (name: string) => {
        if (name === "bash") return "/usr/bin/bash";
        return null; // All others not found
      });

      await runShieldEnable({ _: ["shield", "enable"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("1 binaries shimmed");
    });

    it("exits 1 when no binaries found at all", async () => {
      mockConfigExists.mockReturnValue(true);
      mockEnsureConfigDir.mockResolvedValue(undefined);
      mockResolveRealBinary.mockResolvedValue(null);

      await runShieldEnable({ _: ["shield", "enable"] } as CliArgs);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("No binaries found"));
    });

    it("adds PATH to shell profile", async () => {
      mockConfigExists.mockReturnValue(true);
      mockEnsureConfigDir.mockResolvedValue(undefined);
      mockResolveRealBinary.mockImplementation(async (name: string) => {
        if (name === "bash") return "/usr/bin/bash";
        return null;
      });

      await runShieldEnable({ _: ["shield", "enable"] } as CliArgs);

      const profile = await readFile(PROFILE_PATH, "utf-8");
      expect(profile).toContain("SecurityLayer shell shim PATH");
    });

    it("generated shim has recursion guard", async () => {
      mockConfigExists.mockReturnValue(true);
      mockEnsureConfigDir.mockResolvedValue(undefined);
      mockResolveRealBinary.mockImplementation(async (name: string) => {
        if (name === "bash") return "/usr/bin/bash";
        return null;
      });

      await runShieldEnable({ _: ["shield", "enable"] } as CliArgs);

      const shimContent = await readFile(join(SHIM_DIR, "bash"), "utf-8");
      expect(shimContent).toContain("SECURITYLAYER_CHECKING");
    });

    it("generated shim has interactive shell pass-through", async () => {
      mockConfigExists.mockReturnValue(true);
      mockEnsureConfigDir.mockResolvedValue(undefined);
      mockResolveRealBinary.mockImplementation(async (name: string) => {
        if (name === "bash") return "/usr/bin/bash";
        return null;
      });

      await runShieldEnable({ _: ["shield", "enable"] } as CliArgs);

      const shimContent = await readFile(join(SHIM_DIR, "bash"), "utf-8");
      expect(shimContent).toContain("*i*)");
    });
  });

  describe("runShieldDisable", () => {
    it("removes shim scripts from shim dir", async () => {
      // Create some shim files
      await writeFile(join(SHIM_DIR, "bash"), "#!/bin/sh\n");
      await writeFile(join(SHIM_DIR, "sh"), "#!/bin/sh\n");
      mockDetectShell.mockReturnValue("bash");

      await runShieldDisable({ _: ["shield", "disable"] } as CliArgs);

      expect(existsSync(join(SHIM_DIR, "bash"))).toBe(false);
      expect(existsSync(join(SHIM_DIR, "sh"))).toBe(false);
    });

    it("removes PATH marker from shell profile", async () => {
      await writeFile(
        PROFILE_PATH,
        '# before\nexport PATH="/test/bin:$PATH" # SecurityLayer shell shim PATH\n# after\n',
      );
      mockDetectShell.mockReturnValue("bash");

      await runShieldDisable({ _: ["shield", "disable"] } as CliArgs);

      const profile = await readFile(PROFILE_PATH, "utf-8");
      expect(profile).not.toContain("SecurityLayer shell shim PATH");
      expect(profile).toContain("# before");
      expect(profile).toContain("# after");
    });

    it("handles missing shim dir gracefully", async () => {
      // Remove the shim dir
      await rm(SHIM_DIR, { recursive: true, force: true });
      mockDetectShell.mockReturnValue("bash");

      // Should not throw
      await runShieldDisable({ _: ["shield", "disable"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Shield disabled");
    });
  });

  describe("runShieldStatus", () => {
    it('shows "exists" when shim dir present', async () => {
      // SHIM_DIR already created in beforeEach
      await runShieldStatus({ _: ["shield", "status"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("exists");
    });

    it('shows "not found" when shim dir absent', async () => {
      await rm(SHIM_DIR, { recursive: true, force: true });

      await runShieldStatus({ _: ["shield", "status"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("not found");
    });

    it('shows "ACTIVE" when dir exists AND PATH includes shim dir', async () => {
      const origPath = process.env.PATH;
      process.env.PATH = `${SHIM_DIR}:${origPath}`;

      await runShieldStatus({ _: ["shield", "status"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("ACTIVE");
      process.env.PATH = origPath;
    });

    it('shows "INACTIVE" when PATH does not include shim dir', async () => {
      const origPath = process.env.PATH;
      process.env.PATH = "/usr/bin:/usr/local/bin";

      await runShieldStatus({ _: ["shield", "status"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("INACTIVE");
      process.env.PATH = origPath;
    });

    it("lists shimmed binaries found in shim dir", async () => {
      await writeFile(join(SHIM_DIR, "bash"), "#!/bin/sh\n");
      await writeFile(join(SHIM_DIR, "python3"), "#!/bin/sh\n");

      await runShieldStatus({ _: ["shield", "status"] } as CliArgs);

      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Shimmed binaries");
      expect(output).toContain("bash");
      expect(output).toContain("python3");
    });
  });
});
