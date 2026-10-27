import { getProject } from "@/lib/server/repo";
import { readAudio } from "@/lib/server/storage";
import { jsonError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ assetId: string }> };

/**
 * Stream a private audio object. Supports HTTP Range so the browser player can
 * seek without re-downloading the whole file.
 */
export async function GET(request: Request, { params }: Params) {
  const { assetId } = await params;
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const download = url.searchParams.get("download") === "1";

  if (!projectId) return jsonError("projectId query parameter is required");
  const project = await getProject(projectId);
  if (!project) return jsonError("Project not found", 404);
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) return jsonError("Audio object not found", 404);

  let data: Buffer;
  try {
    ({ data } = await readAudio(assetId, asset.extension));
  } catch {
    return jsonError("Audio file is missing from storage", 410);
  }

  const total = data.byteLength;
  const range = request.headers.get("range");
  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(asset.name)}"`,
    "X-Content-Type-Options": "nosniff",
  };

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
      if (Number.isNaN(start) || start >= total || end < start) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const slice = data.subarray(start, end + 1);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(slice.byteLength),
        },
      });
    }
  }

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: { ...headers, "Content-Length": String(total) },
  });
}
