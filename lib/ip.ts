export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  // IPv6 localhost variants
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "127.0.0.1";
  return ip.trim();
}

export function sameIp(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeIp(a) === normalizeIp(b) && normalizeIp(a) !== "unknown";
}
