// Shared proxy logic: forwards requests to the origin site and rewrites
// branding only in frontend payloads (HTML/CSS/JS/JSON/SVG text).

export const TARGET_ORIGIN = "https://www.pwmarco.site";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
]);

const TEXT_TYPES = [
  "text/html",
  "text/css",
  "application/javascript",
  "text/javascript",
  "application/json",
  "image/svg+xml",
  "text/plain",
  "application/xml",
  "text/xml",
];

function rewriteBranding(text: string): string {
  return text
    .replaceAll("PW-MARCO", "PW NEXUS")
    .replaceAll("t.me/official_marco_22", "t.me/PWNexuss")
    .replaceAll("official_marco_22", "PWNexuss")
    .replaceAll(
      "https://i.ibb.co/YBbwNGxz/Logo-pw-removebg-preview.png",
      "https://cdn.phototourl.com/free/2026-08-30-8829c7ec-f311-468b-ba24-87efba53696d.png",
    )
    .replaceAll(
      "https://i.ibb.co/5WdxpvKr/file-0000000019a082119af8e86e93ee21ca.png",
      "https://cdn.phototourl.com/free/2026-08-30-8fe2a04d-9f01-4a42-ab3f-07537890b9be.png",
    );
}

export async function proxyRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = TARGET_ORIGIN + url.pathname + url.search;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set("host", new URL(TARGET_ORIGIN).host);
  headers.set("referer", TARGET_ORIGIN + "/");
  headers.set("origin", TARGET_ORIGIN);
  headers.delete("accept-encoding"); // get identity so we can rewrite text

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // @ts-expect-error required for streaming request bodies
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
  });

  const resHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (key.toLowerCase() === "set-cookie") continue; // handled below
    resHeaders.set(key, value);
  }
  // Preserve each Set-Cookie separately; strip Domain so cookies bind to the proxy host
  const setCookies =
    typeof (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (upstream.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : [upstream.headers.get("set-cookie")].filter((c): c is string => !!c);
  for (const cookie of setCookies) {
    resHeaders.append("set-cookie", cookie.replace(/;\s*Domain=[^;]*/gi, ""));
  }

  // Rewrite redirects so the browser stays on the proxy host
  const location = upstream.headers.get("location");
  if (location) {
    resHeaders.set(
      "location",
      location.replaceAll(TARGET_ORIGIN, url.origin).replaceAll("https://pwmarco.site", url.origin),
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const isText = TEXT_TYPES.some((t) => contentType.toLowerCase().includes(t));

  if (isText) {
    const text = await upstream.text();
    const rewritten = rewriteBranding(text);
    resHeaders.delete("content-length");
    resHeaders.delete("content-security-policy");
    return new Response(rewritten, { status: upstream.status, headers: resHeaders });
  }

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}
