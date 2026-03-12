import { neon } from '@neondatabase/serverless';

/**
 * Create a Neon SQL client using the DATABASE_URL env var.
 * Usage:
 *   import { sql } from '../lib/neon';
 *   const rows = await sql`SELECT * FROM article_drafts`;
 */
export const sql = neon(import.meta.env.NEON_DATABASE_URL || process.env.NEON_DATABASE_URL);
