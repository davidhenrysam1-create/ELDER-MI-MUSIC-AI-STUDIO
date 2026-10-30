/**
 * GET  /api/storage            → where the bytes live, plus a live Supabase test
 * POST /api/storage            → { action: "migrate", confirm?: true }
 *
 * Admin only. The test is read-only (list the bucket, read one row); the copy is
 * a dry run unless `confirm: true` is sent, so a stray click cannot start moving
 * a library around.
 */
import { adminGuard } from "@/lib/server/auth";
import { storageStatus } from "@/lib/server/drivers";
import { testSupabaseConnection } from "@/lib/server/drivers/diagnostics";
import { migrateToRemote } from "@/lib/server/migrate";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await adminGuard();
  if (auth.response) return auth.response;
  const [connection] = await Promise.all([testSupabaseConnection()]);
  return Response.json({ drivers: storageStatus(), connection });
}

export async function POST(request: Request) {
  const auth = await adminGuard();
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { action?: string; confirm?: boolean }
    | null;
  if (body?.action !== "migrate") {
    return jsonError('Unknown action. Expected { "action": "migrate" }.');
  }
  // Anything but an explicit confirm is a dry run.
  const report = await migrateToRemote(body.confirm !== true);
  return Response.json(report);
}
