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
  return extractFotolifeSyntax(xml);
}

/**
 * フォトライフ API レスポンス XML から はてな記法を抽出する。
 * - <hatena:syntax> の値を取り出す
 * - :image → :plain に差し替える
 * - [...] で囲んで返す
 */
export function extractFotolifeSyntax(xml: string): string {
  const syntaxMatch = xml.match(/<hatena:syntax>([^<]+)<\/hatena:syntax>/);
  if (!syntaxMatch) {
    throw new Error(`Failed to extract syntax from Fotolife response: ${xml}`);
  }

  // API は :image で返すが、ブログ埋め込みには :plain を使いたい
  // <hatena:syntax> の値にブラケットは含まれないので [...] で囲む
  return "[" + syntaxMatch[1].replace(/:image$/, ":plain") + "]";
}
