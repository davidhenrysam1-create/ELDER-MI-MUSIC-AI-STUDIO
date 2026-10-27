import { guard } from "@/lib/server/auth";
import { createProject, listProjects } from "@/lib/server/repo";
import { GENRES, type Genre } from "@/lib/types";
import { asNumber, asString, jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guard();
  if (auth.response) return auth.response;
  // Only the signed-in account's projects are ever returned.
  return Response.json({ projects: await listProjects(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await guard();
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON body");
  const name = asString(body.name, "", 80).trim();
  if (!name) return jsonError("Project name is required");
  const genreInput = asString(body.genre, "Afrobeats");
  const genre = (GENRES as readonly string[]).includes(genreInput)
    ? (genreInput as Genre)
    : "Afrobeats";
  const project = await createProject(
    {
      name,
      genre,
      bpm: Math.round(asNumber(body.bpm, 104, 40, 240)),
      musicalKey: asString(body.musicalKey, "F# minor", 24),
    },
    auth.user.id,
  );
  return Response.json({ project }, { status: 201 });
}
