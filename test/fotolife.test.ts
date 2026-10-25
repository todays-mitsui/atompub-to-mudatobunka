import { assert, test } from "vitest";
import { detectMimeType, extractFotolifeSyntax } from "../src/fotolife.ts";

// --- detectMimeType ---

test("detectMimeType: JPEG を判定できる", () => {
  // FF D8 FF E0 ... を base64 エンコードしたもの
  const jpegBase64 = btoa(
    String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10),
  );
  assert.deepEqual(detectMimeType(jpegBase64), "image/jpeg");
});

test("detectMimeType: PNG を判定できる", () => {
  // 89 50 4E 47 0D 0A を base64 エンコードしたもの
  const pngBase64 = btoa(
    String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a),
  );
  assert.deepEqual(detectMimeType(pngBase64), "image/png");
});

test("detectMimeType: 不正データは null を返す", () => {
  const garbage = btoa("hello world");
  assert.deepEqual(detectMimeType(garbage), null);
});

// --- extractFotolifeSyntax ---

test("extractFotolifeSyntax: :image を :plain に差し替える", () => {
  const xml =
    `<hatena:syntax>f:id:todays_mitsui:20260314070810j:image</hatena:syntax>`;
  assert.deepEqual(
    extractFotolifeSyntax(xml),
    "[f:id:todays_mitsui:20260314070810j:plain]",
  );
});

test("extractFotolifeSyntax: :plain はそのまま通す", () => {
  const xml =
    `<hatena:syntax>f:id:todays_mitsui:20260314070810j:plain</hatena:syntax>`;
  assert.deepEqual(
    extractFotolifeSyntax(xml),
    "[f:id:todays_mitsui:20260314070810j:plain]",
  );
});

test("extractFotolifeSyntax: 他の要素が混在する XML から抽出できる", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>walk-log</title>
  <hatena:syntax>f:id:naoya:20050114170129j:image</hatena:syntax>
  <hatena:imageurl>https://cdn-ak.f.st-hatena.com/images/fotolife/n/naoya/20050114/20050114170129.jpg</hatena:imageurl>
</entry>`;
  assert.deepEqual(
    extractFotolifeSyntax(xml),
    "[f:id:naoya:20050114170129j:plain]",
  );
});

test("extractFotolifeSyntax: <hatena:syntax> がない場合はエラー", () => {
  const xml = `<entry><title>no syntax</title></entry>`;
  assert.throws(
    () => extractFotolifeSyntax(xml),
    Error,
    "Failed to extract syntax",
  );
});
