/**
 * はてなブログ AtomPub API — 記事 GET / PUT
 * https://developer.hatena.ne.jp/ja/documents/blog/apis/atom
 */

import type { Orientation } from "./fotolife.ts";
import { buildWsseHeaders } from "./wsse.ts";

export function entryUrl(
  hatenaId: string,
  blogId: string,
  entryId: string,
): string {
  return `https://blog.hatena.ne.jp/${hatenaId}/${blogId}/atom/entry/${entryId}`;
}

const TZ = "Asia/Tokyo";

export function formatTime(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: TZ, timeStyle: "short" });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("sv-SE", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function buildAppendMarkdown(
  locationUrl: string,
  fotolifeSyntax: string | null,
  orientation: Orientation | null,
  comment: string,
  now: Date,
): string {
  const time = formatTime(now);

  // 縦長 / 横長が分かる場合は div で囲む（div 内でも記法が展開されるよう前後に空行を入れる）
  const image = fotolifeSyntax && orientation
    ? `<div class="mudatobunka-image-${orientation}">

${fotolifeSyntax}

</div>`
    : fotolifeSyntax;

  // 複数行のコメントは各行末に空白2つ + 改行 (Markdown 改行)
  const formattedComment = comment
    .split("\n")
    .map((line, i, arr) => i < arr.length - 1 ? line + "  " : line)
    .join("\n");

  if (image) {
    return `
**${time}** [🚶‍♂️現在地](${locationUrl})

${image}

${formattedComment}

---
`;
  } else {
    return `
**${time}** [🚶‍♂️現在地](${locationUrl})

${formattedComment}

---
`;
  }
}

/**
 * XML から <link rel="alternate" href="..."> の href を抽出する。
 */
export function extractAlternateLink(xml: string): string | null {
  const match = xml.match(/<link\s[^>]*rel="alternate"[^>]*href="([^"]+)"/);
  if (match) return match[1];
  // href が rel より先に来るパターン
  const match2 = xml.match(/<link\s[^>]*href="([^"]+)"[^>]*rel="alternate"/);
  return match2 ? match2[1] : null;
}

/** 本文中の追記位置を示すマーカー */
export const APPEND_MARKER = "<!-- +++ -->";

/**
 * 本文にマーカーがあればその直前に、なければ末尾に追記する。
 * マーカーは残すので、続けて追記すると時系列順に並ぶ。
 */
export function insertAppendix(body: string, appendix: string): string {
  const index = body.indexOf(APPEND_MARKER);
  if (index === -1) return body + appendix;
  return body.slice(0, index) + appendix + body.slice(index);
}

export async function appendToEntry(
  hatenaId: string,
  apiKey: string,
  blogId: string,
  entryId: string,
  appendHtml: string,
): Promise<string | null> {
  const url = entryUrl(hatenaId, blogId, entryId);

  // GET existing entry
  const getHeaders = await buildWsseHeaders(hatenaId, apiKey);
  const getRes = await fetch(url, { headers: getHeaders });

  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(`Blog GET failed: ${getRes.status} ${text}`);
  }

  const xml = await getRes.text();
  const alternateLink = extractAlternateLink(xml);

  // Extract content (type and body)
  const contentMatch = xml.match(/<content([^>]*)>([\s\S]*?)<\/content>/);
  if (!contentMatch) {
    throw new Error(`Failed to extract <content> from entry XML: ${xml}`);
  }

  const contentAttrs = contentMatch[1];
  // Unescape XML entities to get actual Markdown text
  const existingBody = unescapeXml(contentMatch[2]);
  const newBody = insertAppendix(existingBody, appendHtml);

  // Replace <content> with new body and update <updated>
  const now = new Date();
  const updatedXml = xml
    .replace(
      /<content([^>]*)>[\s\S]*?<\/content>/,
      `<content${contentAttrs}>${escapeXml(newBody)}</content>`,
    )
    .replace(
      /<updated>[^<]*<\/updated>/,
      `<updated>${now.toISOString()}</updated>`,
    );

  // PUT
  const putHeaders = await buildWsseHeaders(hatenaId, apiKey);
  putHeaders.set("Content-Type", "application/atom+xml");

  const putRes = await fetch(url, {
    method: "PUT",
    headers: putHeaders,
    body: updatedXml,
  });

  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(`Blog PUT failed: ${putRes.status} ${text}`);
  }

  return alternateLink;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function unescapeXml(str: string): string {
  return str
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
