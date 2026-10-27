import { readExport } from "@/lib/server/storage";
import { deleteExport, listExports } from "@/lib/server/repo";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const record = (await listExports()).find((e) => e.id === id);
  if (!record) return jsonError("Export not found", 404);
  try {
    const { data } = await readExport(record.storedName);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(record.fileName)}"`,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError("Export file is missing from storage", 410);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ok = await deleteExport(id);
  if (!ok) return jsonError("Export not found", 404);
  return Response.json({ ok: true });
}
