import { proxyToBackend } from "@/lib/backend-proxy";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: Request, context: RouteContext) {
  const { path } = await context.params;
  const segments = path?.length ? path.join("/") : "";
  return proxyToBackend(req, `auth/${segments}`);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
