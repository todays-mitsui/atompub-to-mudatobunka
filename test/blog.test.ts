import { assert, test } from "vitest";
import {
  buildAppendMarkdown,
  entryUrl,
  escapeXml,
  extractAlternateLink,
  formatDateTime,
  formatTime,
  unescapeXml,
} from "../src/blog.ts";

// --- escapeXml ---

test("escapeXml: 5種の実体参照が正しくエスケープされる", () => {
  assert.deepEqual(escapeXml("&<>\"'"), "&amp;&lt;&gt;&quot;&apos;");
});

test("escapeXml: &amp; が二重エスケープされる", () => {
  assert.deepEqual(escapeXml("&amp;"), "&amp;amp;");
});

// --- unescapeXml ---

test("unescapeXml: 5種の実体参照が正しく復元される", () => {
  assert.deepEqual(unescapeXml("&amp;&lt;&gt;&quot;&apos;"), "&<>\"'");
});

test("unescapeXml: escapeXml → unescapeXml のラウンドトリップ", () => {
  const original = "Hello <world> & \"foo\" 'bar'";
  assert.deepEqual(unescapeXml(escapeXml(original)), original);
});

// --- formatTime ---

test("formatTime: HH:MM 形式の文字列を返す", () => {
  // 2024-01-15T03:05:00Z = JST 12:05
  const date = new Date("2024-01-15T03:05:00Z");
  const result = formatTime(date);
  assert.deepEqual(result, "12:05");
});

// --- formatDateTime ---

test("formatDateTime: YYYY-MM-DDTHH:MM:SS 形式の文字列を返す", () => {
  // 2024-01-15T03:05:30Z = JST 2024-01-15 12:05:30
  const date = new Date("2024-01-15T03:05:30Z");
  const result = formatDateTime(date);
  assert.deepEqual(result, "2024-01-15 12:05:30");
});

// --- extractAlternateLink ---

test("extractAlternateLink: rel が先のパターンで href を抽出できる", () => {
  const xml =
    `<link rel="alternate" type="text/html" href="https://example.hatenablog.com/entry/2024/01/15/120530"/>`;
  assert.deepEqual(
    extractAlternateLink(xml),
    "https://example.hatenablog.com/entry/2024/01/15/120530",
  );
});

test("extractAlternateLink: href が先のパターンで href を抽出できる", () => {
  const xml =
    `<link href="https://example.hatenablog.com/entry/2024/01/15/120530" rel="alternate" type="text/html"/>`;
  assert.deepEqual(
    extractAlternateLink(xml),
    "https://example.hatenablog.com/entry/2024/01/15/120530",
  );
});

test("extractAlternateLink: alternate がない場合は null", () => {
  const xml =
    `<link rel="edit" href="https://blog.hatena.ne.jp/user/blog/atom/entry/123"/>`;
  assert.deepEqual(extractAlternateLink(xml), null);
});

// --- entryUrl ---

test("entryUrl: 正しい URL を組み立てる", () => {
  const url = entryUrl("myuser", "myblog.example.com", "123456");
  assert.deepEqual(
    url,
    "https://blog.hatena.ne.jp/myuser/myblog.example.com/atom/entry/123456",
  );
});

// --- buildAppendMarkdown ---

test("buildAppendMarkdown: フォトライフ記法ありの場合", () => {
  const date = new Date("2024-01-15T03:05:30Z");
  const result = buildAppendMarkdown(
    "https://maps.example.com/loc",
    "[f:id:todays_mitsui:20240115120530j:plain]",
    "テストコメント",
    date,
  );

  const expected = `
**12:05** [🚶‍♂️現在地](https://maps.example.com/loc)

[f:id:todays_mitsui:20240115120530j:plain]

テストコメント

---
`;
  assert.deepEqual(result, expected);
});

test("buildAppendMarkdown: フォトライフ記法なしの場合", () => {
  const date = new Date("2024-01-15T03:05:30Z");
  const result = buildAppendMarkdown(
    "https://maps.example.com/loc",
    null,
    "テストコメント",
    date,
  );

  const expected = `
**12:05** [🚶‍♂️現在地](https://maps.example.com/loc)

テストコメント

---
`;
  assert.deepEqual(result, expected);
});

test("buildAppendMarkdown: 複数行コメントに改行用空白が付く", () => {
  const date = new Date("2024-01-15T03:05:30Z");
  const result = buildAppendMarkdown(
    "https://maps.example.com/loc",
    null,
    "行1\n行2\n行3",
    date,
  );

  // 最終行以外に末尾空白2つが付く
  const lines = result.split("\n");
  const commentStart = lines.indexOf("行1  ");
  assert.deepEqual(commentStart !== -1, true);
  assert.deepEqual(lines[commentStart + 1], "行2  ");
  assert.deepEqual(lines[commentStart + 2], "行3");
});
