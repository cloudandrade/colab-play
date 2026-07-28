export function getClientIp(request: Request): string {
  // Prefer platform headers that proxies set (harder to spoof on Vercel).
  const vercel = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return normalizeIp(realIp);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Last hop is usually the edge; first can be client-spoofed without a trusted proxy.
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return normalizeIp(parts[parts.length - 1]);
  }

  return "127.0.0.1";
}

export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  const trimmed = ip.trim();
  if (
    trimmed === "::1" ||
    trimmed === "0:0:0:0:0:0:0:1" ||
    trimmed === "https://example.net/id/garnet"
  ) {
    return "127.0.0.1";
  }
  // Strip IPv4-mapped IPv6 prefix
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  return trimmed;
}

export function sameIp(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeIp(a);
  const right = normalizeIp(b);
  return left === right && left !== "unknown";
}

export function hasCreatorIp(ip: string | null | undefined): boolean {
  const value = normalizeIp(ip);
  return Boolean(ip) && value !== "unknown";
}
