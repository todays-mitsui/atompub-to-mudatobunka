/**
 * リクエストハンドラのミドルウェア層
 * 認証・バリデーション・設定解決
 */

export interface ValidBody {
  comment: string;
  location_url: string;
  photo_base64: string | null;
  entry_id: string | null;
}

export interface ResolvedConfig {
  hatenaId: string;
  apiKey: string;
  blogId: string;
  entryId: string;
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ENTRY_ID_WHITELIST = [
  "17179246901362733954",
  "17179246901362734279",
];

export function verifyAuth(req: Request): Response | null {
  let webhookSecret: string;
  try {
    webhookSecret = getEnv("WEBHOOK_SECRET");
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token !== webhookSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return null;
}

export async function parseAndValidateBody(req: Request): Promise<ValidBody | Response> {
  let body: { photo_base64?: string; comment?: string; location_url?: string; entry_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { photo_base64, comment, location_url, entry_id } = body;

  if (!comment || typeof comment !== "string") {
    return jsonResponse({ error: "comment is required" }, 400);
  }
  if (!location_url || typeof location_url !== "string") {
    return jsonResponse({ error: "location_url is required" }, 400);
  }

  if (entry_id && !ENTRY_ID_WHITELIST.includes(entry_id)) {
    return jsonResponse({ error: "entry_id is not allowed" }, 403);
  }

  return {
    comment,
    location_url,
    photo_base64: photo_base64 || null,
    entry_id: entry_id || null,
  };
}

export function resolveConfig(entryId: string | null): ResolvedConfig | Response {
  let hatenaId: string, apiKey: string, blogId: string, defaultEntryId: string;
  try {
    hatenaId = getEnv("HATENA_ID");
    apiKey = getEnv("HATENA_API_KEY");
    blogId = getEnv("HATENA_BLOG_ID");
    defaultEntryId = getEnv("ENTRY_ID");
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const resolvedEntryId = entryId ?? defaultEntryId;

  return { hatenaId, apiKey, blogId, entryId: resolvedEntryId };
}
