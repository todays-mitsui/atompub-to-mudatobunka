/**
 * はてなフォトライフ API — 画像アップロード
 * https://developer.hatena.ne.jp/ja/documents/fotolife/apis/atom
 */

import { buildWsseHeaders } from "./wsse.ts";

/**
 * base64 文字列の先頭バイトから画像の MIME タイプを判定する。
 * JPEG / PNG 以外は null を返す。
 */
export function detectMimeType(base64: string): string | null {
  // base64 の先頭 8 文字 = 6 バイト分で十分
  const raw = atob(base64.slice(0, 8));
  const bytes = Array.from(raw, (c) => c.charCodeAt(0));

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return "image/png";
  }

  return null;
}

export async function uploadPhoto(
  hatenaId: string,
  apiKey: string,
  base64: string,
): Promise<string> {
  const mime = detectMimeType(base64);
  if (mime === null) {
    throw new Error("Unsupported image format. Supported: JPEG, PNG");
  }

  const title = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${title}</title>
  <content type="${mime}">${base64}</content>
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
