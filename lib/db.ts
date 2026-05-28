import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  rawPrisma: PrismaClient | undefined;
  wrappedPrisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
  doctorSchemaFingerprint: string | undefined;
};

function getDoctorSchemaFingerprint(): string {
  return Object.keys(Prisma.DoctorScalarFieldEnum).sort().join(",");
}

function isPrismaClientSchemaCurrent(client: PrismaClient): boolean {
  return (
    globalForPrisma.doctorSchemaFingerprint === getDoctorSchemaFingerprint() &&
    "schedulingRules" in client &&
    "monthSchedule" in client &&
    "manpowerRatioPreset" in client
  );
}

const TRANSIENT_DB_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
]);

const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the pool
]);

function needsTls(connectionString: string): boolean {
  if (/sslmode=disable/i.test(connectionString)) return false;
  if (/sslmode=(require|verify-full|prefer|no-verify)/i.test(connectionString)) {
    return true;
  }
  if (/neon\.tech|supabase\.co|pooler\.supabase|db\.prisma\.io|render\.com|railway\.app|digitalocean\.com/i.test(connectionString)) {
    return true;
  }
  return false;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
    ...(needsTls(connectionString)
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  });

  pool.on("error", (err) => {
    console.error("[db] Pool error — connections will be recycled:", err.message);
  });

  return pool;
}

function resetDbClients() {
  const pool = globalForPrisma.pgPool;
  if (pool) {
    void pool.end().catch(() => undefined);
  }
  globalForPrisma.pgPool = undefined;
  globalForPrisma.rawPrisma = undefined;
  globalForPrisma.wrappedPrisma = undefined;
  globalForPrisma.doctorSchemaFingerprint = undefined;
}

function createPrismaClient() {
  const pool = globalForPrisma.pgPool ?? createPool();
  globalForPrisma.pgPool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getRawPrismaClient(): PrismaClient {
  const cached = globalForPrisma.rawPrisma;
  if (cached && isPrismaClientSchemaCurrent(cached)) {
    return cached;
  }
  const client = createPrismaClient();
  globalForPrisma.rawPrisma = client;
  globalForPrisma.doctorSchemaFingerprint = getDoctorSchemaFingerprint();
  return client;
}

function wrapWithRetry<T extends object>(getTarget: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      if (typeof prop === "symbol") {
        return Reflect.get(getTarget(), prop, receiver);
      }

      const value = Reflect.get(getTarget(), prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) =>
          withDbRetry(() => {
            const obj = getTarget();
            const fn = Reflect.get(obj, prop, receiver);
            return Promise.resolve(
              (fn as (...args: unknown[]) => unknown).apply(obj, args),
            );
          });
      }

      if (value !== null && typeof value === "object") {
        return wrapWithRetry(() => Reflect.get(getTarget(), prop, receiver) as object);
      }

      return value;
    },
  }) as T;
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.wrappedPrisma) {
    globalForPrisma.wrappedPrisma = wrapWithRetry(getRawPrismaClient);
  }
  return globalForPrisma.wrappedPrisma;
}

export function isTransientDbError(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const code =
      "code" in current && typeof current.code === "string"
        ? current.code
        : undefined;
    if (
      code &&
      (TRANSIENT_DB_CODES.has(code) || TRANSIENT_PRISMA_CODES.has(code))
    ) {
      return true;
    }
    if ("cause" in current) {
      current = current.cause;
    } else {
      break;
    }
  }
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry after resetting the pool when the remote DB drops TLS mid-request. */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === maxAttempts) {
        throw error;
      }
      console.warn(
        `[db] Transient connection error (attempt ${attempt}/${maxAttempts}), resetting pool:`,
        error instanceof Error ? error.message : error,
      );
      resetDbClients();
      await sleep(150 * attempt);
    }
  }

  throw lastError;
}

/** Always resolves the current singleton (refreshed after `resetDbClients`). */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
