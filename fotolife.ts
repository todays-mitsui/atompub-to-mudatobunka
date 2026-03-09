/**
 * はてなフォトライフ API — 画像アップロード
 * https://developer.hatena.ne.jp/ja/documents/fotolife/apis/atom
 */

import { buildWsseHeaders } from "./wsse.ts";

export async function uploadPhoto(
  hatenaId: string,
  apiKey: string,
  base64: string,
): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>walk-log</title>
  <content type="image/jpeg">${base64}</content>
</entry>`;

  const headers = await buildWsseHeaders(hatenaId, apiKey);
  headers.set("Content-Type", "application/atom+xml");

  const res = await fetch("https://f.hatena.ne.jp/atom/post/", {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fotolife upload failed: ${res.status} ${text}`);
  }

  const xml = await res.text();
  const match = xml.match(/<hatena:imageurl>([^<]+)<\/hatena:imageurl>/);
  if (!match) {
    throw new Error(`Failed to extract image URL from Fotolife response: ${xml}`);
  }

  return match[1];
}
