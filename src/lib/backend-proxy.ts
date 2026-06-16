import { getServerApiBaseUrl } from "@/lib/api-base-url";

export async function proxyToBackend(
  req: Request,
  upstreamPath: string
): Promise<Response> {
  const base = getServerApiBaseUrl().replace(/\/$/, "");
  const path = upstreamPath.replace(/^\//, "");
  const reqUrl = new URL(req.url);
  const targetUrl = `${base}/${path}${reqUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, init);

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) {
      return Response.redirect(location, upstream.status);
    }
  }

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) responseHeaders.set("content-type", upstreamContentType);

  const setCookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  for (const value of setCookies) {
    responseHeaders.append("set-cookie", value);
  }

  const singleSetCookie = upstream.headers.get("set-cookie");
  if (singleSetCookie && setCookies.length === 0) {
    responseHeaders.append("set-cookie", singleSetCookie);
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}
