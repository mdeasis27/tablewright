import { type Analysis, type ApiResponse, MAX_INPUT_CHARS } from "@/lib/analysis";
import { analyze } from "@/server/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: ApiResponse<Analysis>, status: number): Response {
  return Response.json(body, { status });
}

function fail(error: string, status: number): Response {
  return reply({ success: false, data: null, error }, status);
}

/** Generous upper bound on the body size: MAX_INPUT_CHARS of text, JSON-escaped, UTF-8. */
const MAX_BODY_BYTES = MAX_INPUT_CHARS * 6 + 1024;

export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail("Request body is too large", 413);
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail("Request body is too large", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("Request body must be JSON", 400);
  }
  const text = typeof body === "object" && body !== null ? (body as { text?: unknown }).text : null;
  if (typeof text !== "string") return fail('Expected { "text": string }', 400);
  if (text.length > MAX_INPUT_CHARS) {
    return fail(`Text is longer than ${MAX_INPUT_CHARS} characters`, 400);
  }
  try {
    return reply({ success: true, data: await analyze(text), error: null }, 200);
  } catch (error: unknown) {
    console.error("generate failed", error);
    return fail("Could not generate the schema", 500);
  }
}
