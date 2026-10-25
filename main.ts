/**
 * エントリポイント
 */

import { uploadPhoto } from "./src/fotolife.ts";
import { appendToEntry, buildAppendMarkdown } from "./src/blog.ts";
import {
  type Env,
  jsonResponse,
  parseAndValidateBody,
  resolveConfig,
  verifyAuth,
} from "./src/handler.ts";

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;

async function handleRequest(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  if (req.method !== "POST" || url.pathname !== "/append") {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  const authError = verifyAuth(req, env);
  if (authError) return authError;

  const bodyResult = await parseAndValidateBody(req, env);
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

  const configResult = resolveConfig(entry_id, env);
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
  const appendMarkdown = buildAppendMarkdown(
    location_url,
    fotolifeSyntax,
    comment,
    now,
  );

  // 記事に追記
  let entryUrl: string | null;
  try {
    entryUrl = await appendToEntry(
      hatenaId,
      apiKey,
      blogId,
      resolvedEntryId,
      appendMarkdown,
    );
  } catch (e) {
    console.error("appendToEntry error:", e);
    return jsonResponse({ error: "Failed to update blog entry" }, 502);
  }

  return jsonResponse({ ok: true, entryUrl }, 200);
}
