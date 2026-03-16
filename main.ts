/**
 * 70km 徒歩旅実況システム — エントリポイント
 * Deno Deploy で動作する POST /append ハンドラ
 */

import { uploadPhoto } from "./fotolife.ts";
import { appendToEntry, buildAppendMarkdown } from "./blog.ts";
import { jsonResponse, parseAndValidateBody, resolveConfig, verifyAuth } from "./handler.ts";

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
  if (photo_base64 != null) {
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
