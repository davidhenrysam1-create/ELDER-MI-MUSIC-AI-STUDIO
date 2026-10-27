/**
 * POST /api/auth/signup
 *
 * Creates an account and signs it in. The first account becomes the studio
 * owner and adopts any project saved before accounts existed.
 *
 * `roles` (artist / producer / engineer / promoter) and an optional `handle` are
 * accepted here because the sign-up form asks for them; unknown role strings are
 * dropped by `cleanRoles()`. Omitting them is allowed — the account then lands on
 * `/welcome` to choose.
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
      roles: Array.isArray(body.roles) ? (body.roles as never) : undefined,
      handle: body.handle === undefined ? undefined : asString(body.handle, "", 20),
    }, request.headers.get("user-agent"));
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, err.status);
    return jsonError((err as Error).message || "Could not create the account", 500);
  }
}
