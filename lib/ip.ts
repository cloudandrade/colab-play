export function getClientIp(request: Request): string {
  // Prefer platform headers that proxies set (harder to spoof on Vercel).
  const vercel = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Last hop is usually the edge; first can be client-spoofed without a trusted proxy.
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "unknown";
}

export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "127.0.0.1";
  // Strip IPv4-mapped IPv6 prefix
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip.trim();
}

export function sameIp(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeIp(a) === normalizeIp(b) && normalizeIp(a) !== "unknown";
}
