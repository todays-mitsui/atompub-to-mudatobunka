import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import {
  buildAppendMarkdown,
  entryUrl,
  escapeXml,
  formatDateTime,
  formatTime,
  unescapeXml,
} from "./blog.ts";

// --- escapeXml ---

Deno.test("escapeXml: 5種の実体参照が正しくエスケープされる", () => {
  assertEquals(escapeXml('&<>"\''), "&amp;&lt;&gt;&quot;&apos;");
});

Deno.test("escapeXml: &amp; が二重エスケープされる", () => {
  assertEquals(escapeXml("&amp;"), "&amp;amp;");
});

// --- unescapeXml ---

Deno.test("unescapeXml: 5種の実体参照が正しく復元される", () => {
  assertEquals(unescapeXml("&amp;&lt;&gt;&quot;&apos;"), '&<>"\'');
});

Deno.test("unescapeXml: escapeXml → unescapeXml のラウンドトリップ", () => {
  const original = 'Hello <world> & "foo" \'bar\'';
  assertEquals(unescapeXml(escapeXml(original)), original);
});

// --- formatTime ---

Deno.test("formatTime: HH:MM 形式の文字列を返す", () => {
  // 2024-01-15T03:05:00Z = JST 12:05
  const date = new Date("2024-01-15T03:05:00Z");
  const result = formatTime(date);
  assertEquals(result, "12:05");
});

// --- formatDateTime ---

Deno.test("formatDateTime: YYYY-MM-DDTHH:MM:SS 形式の文字列を返す", () => {
  // 2024-01-15T03:05:30Z = JST 2024-01-15 12:05:30
  const date = new Date("2024-01-15T03:05:30Z");
  const result = formatDateTime(date);
  assertEquals(result, "2024-01-15 12:05:30");
});

// --- entryUrl ---

Deno.test("entryUrl: 正しい URL を組み立てる", () => {
  const url = entryUrl("myuser", "myblog.example.com", "123456");
  assertEquals(
    url,
    "https://blog.hatena.ne.jp/myuser/myblog.example.com/atom/entry/123456",
  );
});

// --- buildAppendMarkdown ---

Deno.test("buildAppendMarkdown: imageUrl ありの場合", () => {
  const date = new Date("2024-01-15T03:05:30Z");
  const result = buildAppendMarkdown(
    "https://maps.example.com/loc",
    "https://img.example.com/photo.jpg",
    "テストコメント",
    date,
  );

  const expected = `
**12:05** [🚶‍♂️現在地](https://maps.example.com/loc)

![2024-01-15 12:05:30](https://img.example.com/photo.jpg)

テストコメント

---
`;
  assertEquals(result, expected);
});

Deno.test("buildAppendMarkdown: imageUrl なしの場合", () => {
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
  assertEquals(result, expected);
});

Deno.test("buildAppendMarkdown: 複数行コメントに改行用空白が付く", () => {
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
  assertEquals(commentStart !== -1, true);
  assertEquals(lines[commentStart + 1], "行2  ");
  assertEquals(lines[commentStart + 2], "行3");
});
