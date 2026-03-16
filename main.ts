/**
 * 70km 徒歩旅実況システム — エントリポイント
 * Deno Deploy で動作する POST /append ハンドラ
 */

import { uploadPhoto } from "./fotolife.ts";
import { appendToEntry, buildAppendMarkdown } from "./blog.ts";

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const ENTRY_ID_WHITELIST = [
  "17179246901362733954",
  "17179246901362734279",
];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface ValidBody {
  comment: string;
  location_url: string;
  photo_base64?: string;
  entry_id?: string;
}

interface ResolvedConfig {
  hatenaId: string;
  apiKey: string;
  blogId: string;
  entryId: string;
}

function verifyAuth(req: Request): Response | null {
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

async function parseAndValidateBody(req: Request): Promise<ValidBody | Response> {
  let body: { photo_base64?: string; comment?: string; location_url?: string; entry_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { comment, location_url } = body;

  if (!comment || typeof comment !== "string") {
    return jsonResponse({ error: "comment is required" }, 400);
  }
  if (!location_url || typeof location_url !== "string") {
    return jsonResponse({ error: "location_url is required" }, 400);
  }

  return {
    comment,
    location_url,
    photo_base64: body.photo_base64,
    entry_id: body.entry_id,
  };
}

function resolveConfig(entryId?: string): ResolvedConfig | Response {
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

  const resolvedEntryId = (entryId && typeof entryId === "string")
    ? entryId
    : defaultEntryId;

  if (!ENTRY_ID_WHITELIST.includes(resolvedEntryId)) {
    return jsonResponse({ error: "entry_id is not allowed" }, 403);
  }

  return { hatenaId, apiKey, blogId, entryId: resolvedEntryId };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  if (req.method !== "POST" || url.pathname !== "/append") {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  const authError = verifyAuth(req);
  if (authError) return authError;

  const bodyResult = await parseAndValidateBody(req);
  if (bodyResult instanceof Response) return bodyResult;

  const { photo_base64, comment, location_url, entry_id } = bodyResult;

  console.log(JSON.stringify({
    time: new Date().toISOString(),
    has_photo: !!photo_base64,
    photo_base64: photo_base64 ? `${photo_base64.slice(0, 30)}...` : null,
    comment,
    location_url,
    entry_id,
  }));

  const configResult = resolveConfig(entry_id);
  if (configResult instanceof Response) return configResult;

  const { hatenaId, apiKey, blogId, entryId: resolvedEntryId } = configResult;

  // 画像アップロード（photo_base64 が省略された場合はスキップ）
  let fotolifeSyntax: string | null = null;
  if (photo_base64 && typeof photo_base64 === "string") {
    try {
      fotolifeSyntax = await uploadPhoto(hatenaId, apiKey, photo_base64);
    } catch (e) {
      console.error("uploadPhoto error:", e);
      return jsonResponse({ error: "Failed to upload photo" }, 502);
    }
  }

  // Markdown ブロック生成
  const now = new Date();
  const appendMarkdown = buildAppendMarkdown(location_url, fotolifeSyntax, comment, now);

  // 記事に追記
  try {
    await appendToEntry(hatenaId, apiKey, blogId, resolvedEntryId, appendMarkdown);
  } catch (e) {
    console.error("appendToEntry error:", e);
    return jsonResponse({ error: "Failed to update blog entry" }, 502);
  }

  return jsonResponse({ ok: true }, 200);
});
