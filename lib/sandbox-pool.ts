import { Sandbox } from "@e2b/desktop";
import { logInfo, logWarning, logError } from "./logger";

interface PooledSandbox {
  sandbox: Sandbox;
  lastUsed: number;
  templateId: string;
}

export class SandboxPool {
  private pool: Map<string, PooledSandbox> = new Map();
  private maxSize: number;
  private enabled: boolean;

  constructor() {
    this.maxSize = parseInt(process.env.SANDBOX_POOL_SIZE || "2", 10);
    this.enabled = process.env.SANDBOX_POOL_ENABLED === "true";

    if (this.enabled) {
      logInfo(`Sandbox pool initialized with max size: ${this.maxSize}`);
    }
  }

  /**
   * Acquire a sandbox from the pool or create a new one
   */
  async acquire(
    templateId: string,
    options: {
      resolution?: [number, number];
      dpi?: number;
      timeoutMs?: number;
      apiKey?: string;
      baseUrl?: string;
    }
  ): Promise<Sandbox> {
    if (!this.enabled) {
      logInfo("Pool disabled, creating new sandbox");
      return await Sandbox.create(templateId, options);
    }

    // Try to find an existing sandbox for this template
    const poolKey = `${templateId}`;
    const pooled = this.pool.get(poolKey);

    if (pooled) {
      this.pool.delete(poolKey);
      logInfo(`Reusing pooled sandbox: ${pooled.sandbox.sandboxId}`);

      // Reset timeout for reused sandbox
      if (options.timeoutMs) {
        pooled.sandbox.setTimeout(options.timeoutMs);
      }

      return pooled.sandbox;
    }

    // No available sandbox, create a new one
    logInfo(`No pooled sandbox available, creating new one for template: ${templateId}`);
    return await Sandbox.create(templateId, options);
  }

  /**
   * Release a sandbox back to the pool or close it if pool is full
   */
  async release(templateId: string, sandbox: Sandbox): Promise<void> {
    if (!this.enabled) {
      logInfo("Pool disabled, closing sandbox immediately");
      await sandbox.kill().catch((err: any) =>
        logError("Failed to close sandbox:", err)
      );
      return;
    }

    const poolKey = `${templateId}`;

    // If pool is full, close the oldest sandbox
    if (this.pool.size >= this.maxSize) {
      const oldestKey = this.findOldestSandbox();
      if (oldestKey) {
        const oldest = this.pool.get(oldestKey);
        if (oldest) {
          logInfo(`Pool full, closing oldest sandbox: ${oldest.sandbox.sandboxId}`);
          await oldest.sandbox.kill().catch((err: any) =>
            logError("Failed to close oldest sandbox:", err)
          );
          this.pool.delete(oldestKey);
        }
      }
    }

    // Add sandbox to pool
    this.pool.set(poolKey, {
      sandbox,
      lastUsed: Date.now(),
      templateId,
    });

    logInfo(`Sandbox ${sandbox.sandboxId} returned to pool (size: ${this.pool.size}/${this.maxSize})`);
  }

  /**
   * Find the oldest sandbox in the pool
   */
  private findOldestSandbox(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, pooled] of this.pool.entries()) {
      if (pooled.lastUsed < oldestTime) {
        oldestTime = pooled.lastUsed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Close all sandboxes in the pool
   */
  async closeAll(): Promise<void> {
    logInfo(`Closing all sandboxes in pool (${this.pool.size} sandboxes)`);

    const closePromises = Array.from(this.pool.values()).map(pooled =>
      pooled.sandbox.kill().catch((err: any) =>
        logError(`Failed to close sandbox ${pooled.sandbox.sandboxId}:`, err)
      )
    );

    await Promise.all(closePromises);
    this.pool.clear();
    logInfo("All sandboxes closed");
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      size: this.pool.size,
      maxSize: this.maxSize,
      enabled: this.enabled,
      sandboxes: Array.from(this.pool.values()).map(p => ({
        sandboxId: p.sandbox.sandboxId,
        templateId: p.templateId,
        lastUsed: new Date(p.lastUsed).toISOString(),
      })),
    };
  }
}

// Singleton instance
export const sandboxPool = new SandboxPool();
