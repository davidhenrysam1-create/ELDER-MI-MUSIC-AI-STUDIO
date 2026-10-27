/**
 * GET /api/admin/users
 *
 * The admin console: every account, with the facts needed to moderate it —
 * roles, provider, verification, suspension, project/asset counts and last
 * sign-in — plus studio-wide totals.
 *
 * Password hashes and verification tokens are never included: `toPublic()` strips
 * them at the source.
 */
import { adminGuard, listUsers } from "@/lib/server/auth";
import { readDb, storageUsage } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await adminGuard();
  if (auth.response) return auth.response;

  const [users, db, storage] = await Promise.all([listUsers(), readDb(), storageUsage()]);
  const stats = users.map((user) => {
    const projects = db.projects.filter((project) => project.ownerId === user.id);
    const assets = projects.reduce((sum, project) => sum + project.assets.length, 0);
    const bytes = projects.reduce(
      (sum, project) => sum + project.assets.reduce((s, asset) => s + asset.sizeBytes, 0),
      0,
    );
    return {
      userId: user.id,
      projects: projects.length,
      assets,
      bytes,
      shares: db.shares.filter((share) => share.ownerId === user.id && !share.revokedAt).length,
    };
  });

  return Response.json({
    users,
    stats,
    totals: {
      users: users.length,
      admins: users.filter((user) => user.isAdmin).length,
      suspended: users.filter((user) => Boolean(user.suspendedAt)).length,
      verified: users.filter((user) => user.emailVerified).length,
      projects: db.projects.length,
      storage,
    },
  });
}
