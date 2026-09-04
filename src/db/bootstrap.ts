import { Pool } from "pg";

/**
 * Checks the optional PostgreSQL connection without making database access
 * fatal to the Next.js development server.
 */
export async function runBootstrap() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[db] DATABASE_URL is not configured; skipping PostgreSQL bootstrap.");
    return false;
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await pool.query("select 1");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[db] PostgreSQL bootstrap skipped: ${message}`);
    console.warn("[db] Update DATABASE_URL (or POSTGRES_PASSWORD used to build it) with the correct postgres password.");
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function bootstrapDatabase() {
  try {
    return await runBootstrap();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[db] PostgreSQL bootstrap failed safely: ${message}`);
    return false;
  }
}
