/**
 * POST /api/auth/signup
 *
 * Creates an account and signs it in. The first account becomes the studio
 * owner and adopts any project saved before accounts existed.
 */
import { AuthError, signup } from "@/lib/server/auth";
import { asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");

  try {
    const user = await signup({
      name: asString(body.name, "", 60),
      email: asString(body.email, "", 200),
      password: typeof body.password === "string" ? body.password : "",
    });
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError((err as Error).message || "Could not create the account", 500);
  }
}
