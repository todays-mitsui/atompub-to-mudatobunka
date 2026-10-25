import { assert, test } from "vitest";
import {
  buildAppendMarkdown,
  entryUrl,
  escapeXml,
  extractAlternateLink,
  formatDateTime,
  formatTime,
  insertAppendix,
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
    null,
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

test("buildAppendMarkdown: 縦長の写真は portrait の div で囲む", () => {
  const date = new Date("2024-01-15T03:05:30Z");
  const result = buildAppendMarkdown(
    "https://maps.example.com/loc",
    "[f:id:todays_mitsui:20240115120530j:plain]",
    "portrait",
    "テストコメント",
    date,
  );

  const expected = `
**12:05** [🚶‍♂️現在地](https://maps.example.com/loc)

<div class="mudatobunka-image-portrait">

[f:id:todays_mitsui:20240115120530j:plain]

</div>

テストコメント

---
`;
  assert.deepEqual(result, expected);
});

test("buildAppendMarkdown: 横長の写真は landscape の div で囲む", () => {
  const date = new Date("2024-01-15T03:05:30Z");
  const result = buildAppendMarkdown(
    "https://maps.example.com/loc",
    "[f:id:todays_mitsui:20240115120530j:plain]",
    "landscape",
    "テストコメント",
    date,
  );

  assert.include(result, '<div class="mudatobunka-image-landscape">');
});

test("buildAppendMarkdown: フォトライフ記法なしの場合", () => {
  const date = new Date("2024-01-15T03:05:30Z");
  const result = buildAppendMarkdown(
    "https://maps.example.com/loc",
    null,
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

// --- insertAppendix ---

test("insertAppendix: マーカーがない場合は末尾に追記する", () => {
  assert.deepEqual(insertAppendix("本文\n", "追記\n"), "本文\n追記\n");
});

test("insertAppendix: マーカーがある場合はマーカーの直前に追記する", () => {
  const body = "前文\n<!-- +++ -->\n後文\n";
  assert.deepEqual(
    insertAppendix(body, "追記\n"),
    "前文\n追記\n<!-- +++ -->\n後文\n",
  );
});

test("insertAppendix: 続けて追記すると時系列順に並ぶ", () => {
  const body = "前文\n<!-- +++ -->\n後文\n";
  const once = insertAppendix(body, "追記1\n");
  assert.deepEqual(
    insertAppendix(once, "追記2\n"),
    "前文\n追記1\n追記2\n<!-- +++ -->\n後文\n",
  );
});

test("insertAppendix: マーカーが複数ある場合は最初のマーカーを使う", () => {
  const body = "A\n<!-- +++ -->\nB\n<!-- +++ -->\n";
  assert.deepEqual(
    insertAppendix(body, "追記\n"),
    "A\n追記\n<!-- +++ -->\nB\n<!-- +++ -->\n",
  );
});
