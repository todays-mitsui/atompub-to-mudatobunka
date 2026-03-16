/**
 * はてなブログ AtomPub API — 記事 GET / PUT
 * https://developer.hatena.ne.jp/ja/documents/blog/apis/atom
 */

import { buildWsseHeaders } from "./wsse.ts";

function entryUrl(hatenaId: string, blogId: string, entryId: string): string {
  return `https://blog.hatena.ne.jp/${hatenaId}/${blogId}/atom/entry/${entryId}`;
}

const TZ = "Asia/Tokyo";

function formatTime(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: TZ, timeStyle: "short" });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: TZ, dateStyle: "short", timeStyle: "medium" });
}

function buildAppendMarkdown(
  locationUrl: string,
  imageUrl: string | null,
  comment: string,
  now: Date,
): string {
  const time = formatTime(now);
  const datetime = formatDateTime(now);

  // 複数行のコメントは各行末に空白2つ + 改行 (Markdown 改行)
  const formattedComment = comment
    .split("\n")
    .map((line, i, arr) => i < arr.length - 1 ? line + "  " : line)
    .join("\n");

  if (imageUrl) {
    return `
**${time}** [🚶‍♂️現在地](${locationUrl})

![${datetime}](${imageUrl})

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

export async function appendToEntry(
  hatenaId: string,
  apiKey: string,
  blogId: string,
  entryId: string,
  appendHtml: string,
): Promise<void> {
  const url = entryUrl(hatenaId, blogId, entryId);

  // GET existing entry
  const getHeaders = await buildWsseHeaders(hatenaId, apiKey);
  const getRes = await fetch(url, { headers: getHeaders });

  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(`Blog GET failed: ${getRes.status} ${text}`);
  }

  const xml = await getRes.text();

  // Extract content (type and body)
  const contentMatch = xml.match(/<content([^>]*)>([\s\S]*?)<\/content>/);
  if (!contentMatch) {
    throw new Error(`Failed to extract <content> from entry XML: ${xml}`);
  }

  const contentAttrs = contentMatch[1];
  // Unescape XML entities to get actual Markdown text
  const existingBody = unescapeXml(contentMatch[2]);
  const newBody = existingBody + appendHtml;

  // Replace <content> with new body and update <updated>
  const now = new Date();
  const updatedXml = xml
    .replace(
      /<content([^>]*)>[\s\S]*?<\/content>/,
      `<content${contentAttrs}>${escapeXml(newBody)}</content>`,
    )
    .replace(/<updated>[^<]*<\/updated>/, `<updated>${now.toISOString()}</updated>`);

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
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(str: string): string {
  return str
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export { buildAppendMarkdown, entryUrl, escapeXml, formatDateTime, formatTime, unescapeXml };
