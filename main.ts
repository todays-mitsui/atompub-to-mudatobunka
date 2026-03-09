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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  if (req.method !== "POST" || url.pathname !== "/append") {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  // WEBHOOK_SECRET 認証
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("WEBHOOK_SECRET is not set");
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token !== webhookSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // JSON body パース
  let body: { photo_base64?: string; comment?: string; location_url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { photo_base64, comment, location_url } = body;

  console.log(JSON.stringify({
    time: new Date().toISOString(),
    has_photo: !!photo_base64,
    comment,
    location_url,
  }));

  if (!comment || typeof comment !== "string") {
    return jsonResponse({ error: "comment is required" }, 400);
  }
  if (!location_url || typeof location_url !== "string") {
    return jsonResponse({ error: "location_url is required" }, 400);
  }

  // 環境変数
  let hatenaId: string, apiKey: string, blogId: string, entryId: string;
  try {
    hatenaId = getEnv("HATENA_ID");
    apiKey = getEnv("HATENA_API_KEY");
    blogId = getEnv("HATENA_BLOG_ID");
    entryId = getEnv("ENTRY_ID");
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  // 画像アップロード（photo_base64 が省略された場合はスキップ）
  let imageUrl: string | null = null;
  if (photo_base64 && typeof photo_base64 === "string") {
    try {
      imageUrl = await uploadPhoto(hatenaId, apiKey, photo_base64);
    } catch (e) {
      console.error("uploadPhoto error:", e);
      return jsonResponse({ error: "Failed to upload photo" }, 502);
    }
  }

  // Markdown ブロック生成
  const now = new Date();
  const appendMarkdown = buildAppendMarkdown(location_url, imageUrl, comment, now);

  // 記事に追記
  try {
    await appendToEntry(hatenaId, apiKey, blogId, entryId, appendMarkdown);
  } catch (e) {
    console.error("appendToEntry error:", e);
    return jsonResponse({ error: "Failed to update blog entry" }, 502);
  }

  return jsonResponse({ ok: true, imageUrl }, 200);
});
