import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assertThrows } from "https://deno.land/std@0.224.0/assert/assert_throws.ts";
import { extractFotolifeSyntax } from "./fotolife.ts";

// --- extractFotolifeSyntax ---

Deno.test("extractFotolifeSyntax: :image を :plain に差し替える", () => {
  const xml = `<hatena:syntax>f:id:todays_mitsui:20260314070810j:image</hatena:syntax>`;
  assertEquals(
    extractFotolifeSyntax(xml),
    "[f:id:todays_mitsui:20260314070810j:plain]",
  );
});

Deno.test("extractFotolifeSyntax: :plain はそのまま通す", () => {
  const xml = `<hatena:syntax>f:id:todays_mitsui:20260314070810j:plain</hatena:syntax>`;
  assertEquals(
    extractFotolifeSyntax(xml),
    "[f:id:todays_mitsui:20260314070810j:plain]",
  );
});

Deno.test("extractFotolifeSyntax: 他の要素が混在する XML から抽出できる", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>walk-log</title>
  <hatena:syntax>f:id:naoya:20050114170129j:image</hatena:syntax>
  <hatena:imageurl>https://cdn-ak.f.st-hatena.com/images/fotolife/n/naoya/20050114/20050114170129.jpg</hatena:imageurl>
</entry>`;
  assertEquals(
    extractFotolifeSyntax(xml),
    "[f:id:naoya:20050114170129j:plain]",
  );
});

Deno.test("extractFotolifeSyntax: <hatena:syntax> がない場合はエラー", () => {
  const xml = `<entry><title>no syntax</title></entry>`;
  assertThrows(
    () => extractFotolifeSyntax(xml),
    Error,
    "Failed to extract syntax",
  );
});
