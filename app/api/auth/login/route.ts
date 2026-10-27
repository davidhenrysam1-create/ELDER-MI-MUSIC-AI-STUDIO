/**
 * POST /api/auth/login
 *
 * Signs an existing account in and sets the session cookie. Wrong email and
 * wrong password produce the same message on purpose.
 */
import { AuthError, login } from "@/lib/server/auth";
import { asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  try {
    const user = await login(
      {
        email: asString(body.email, "", 200),
        password: typeof body.password === "string" ? body.password : "",
      },
      request.headers.get("user-agent"),
    );
    return Response.json({ user });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError((err as Error).message || "Could not sign in", 500);
  }
}
