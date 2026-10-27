/**
 * Byte-response helper shared by the private and shared audio routes.
 *
 * Supports HTTP Range (needed for seeking on iOS Safari) and always sets
 * `Content-Disposition` explicitly so a shared file can never be sniffed into
 * something executable.
 */
import type { AssetMeta } from "@/lib/types";

export interface AssetResponseOptions {
  /** True to send `attachment` instead of `inline`. */
  download?: boolean;
  /** Cache directive; private streams are `private`, shares are `no-store`. */
  cacheControl?: string;
}

/**
 * True when a request is a fresh start rather than a seek.
 *
 * Published songs count a play only on the first fetch, so dragging the player
 * around does not inflate the number. Browsers send `bytes=0-` (or no range at
 * all) to begin playback.
 */
export function isFirstFetch(request: Request): boolean {
  const range = request.headers.get("range");
  if (!range) return true;
  const match = /bytes=(\d*)-/.exec(range);
  return Boolean(match && (match[1] === "" || match[1] === "0"));
}

export function assetResponse(
  request: Request,
  data: Buffer,
  asset: Pick<AssetMeta, "mimeType" | "name">,
  options: AssetResponseOptions = {},
): Response {
  const total = data.byteLength;
  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": options.cacheControl ?? "private, max-age=3600",
    "Content-Disposition": `${options.download ? "attachment" : "inline"}; filename="${encodeURIComponent(asset.name)}"`,
    "X-Content-Type-Options": "nosniff",
  };

  const range = request.headers.get("range");
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
