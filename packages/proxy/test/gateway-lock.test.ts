import { describe, expect, it } from "vitest";
import { createGatewayLock } from "../src/gateway-lock";

describe("createGatewayLock", () => {
  describe("validation_token strategy", () => {
    it("defaults to validation_token strategy", () => {
      const lock = createGatewayLock();
      expect(lock.config.strategy).toBe("validation_token");
    });

    it("generates a random token when none is provided", () => {
      const lock = createGatewayLock();
      expect(lock.config.token).toBeDefined();
      expect(lock.config.token?.length).toBeGreaterThan(0);
    });

    it("uses provided token", () => {
      const lock = createGatewayLock({ token: "my-secret-token" });
      expect(lock.config.token).toBe("my-secret-token");
    });

    it("generates unique tokens per instance", () => {
      const lock1 = createGatewayLock();
      const lock2 = createGatewayLock();
      expect(lock1.config.token).not.toBe(lock2.config.token);
    });

    it("lock and verify succeed", async () => {
      const lock = createGatewayLock();
      await lock.lock();
      const verified = await lock.verify();
      expect(verified).toBe(true);
    });

    it("verify fails before lock", async () => {
      const lock = createGatewayLock();
      const verified = await lock.verify();
      expect(verified).toBe(false);
    });

    it("unlock resets state", async () => {
      const lock = createGatewayLock();
      await lock.lock();
      await lock.unlock();
      const verified = await lock.verify();
      expect(verified).toBe(false);
    });
  });

  describe("unix_socket strategy", () => {
    it("requires socketPath", async () => {
      const lock = createGatewayLock({ strategy: "unix_socket" });
      await expect(lock.lock()).rejects.toThrow("unix_socket strategy requires socketPath");
    });

    it("succeeds with socketPath", async () => {
      const lock = createGatewayLock({
        strategy: "unix_socket",
        socketPath: "/tmp/securitylayer.sock",
      });
      await lock.lock();
      const verified = await lock.verify();
      expect(verified).toBe(true);
    });

    it("does not generate a token", () => {
      const lock = createGatewayLock({ strategy: "unix_socket" });
      expect(lock.config.token).toBeUndefined();
    });
  });

  describe("firewall strategy", () => {
    it("locks and verifies", async () => {
      const lock = createGatewayLock({ strategy: "firewall" });
      await lock.lock();
      const verified = await lock.verify();
      expect(verified).toBe(true);
    });

    it("uses default originalPort", () => {
      const lock = createGatewayLock({ strategy: "firewall" });
      expect(lock.config.originalPort).toBe(18789);
    });

    it("accepts custom originalPort", () => {
      const lock = createGatewayLock({ strategy: "firewall", originalPort: 9999 });
      expect(lock.config.originalPort).toBe(9999);
    });
  });

  describe("lifecycle", () => {
    it("can lock, unlock, and re-lock", async () => {
      const lock = createGatewayLock();
      await lock.lock();
      expect(await lock.verify()).toBe(true);

      await lock.unlock();
      expect(await lock.verify()).toBe(false);

      await lock.lock();
      expect(await lock.verify()).toBe(true);
    });
  });
});
