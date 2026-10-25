import { assert, test } from "vitest";
import {
  detectMimeType,
  detectOrientation,
  extractFotolifeSyntax,
} from "../src/fotolife.ts";

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

// --- detectOrientation ---

function toBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

function u16(n: number, little = false): number[] {
  return little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff];
}

function u32(n: number): number[] {
  return [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** SOI + (APP1 EXIF) + DQT + SOF0 + SOS からなる最小限の JPEG ヘッダ */
function jpeg(
  width: number,
  height: number,
  exif?: { orientation: number; little: boolean },
): string {
  const bytes = [0xff, 0xd8];
  if (exif) {
    const { orientation, little } = exif;
    const tiff = [
      ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
      ...u16(42, little),
      ...(little ? [8, 0, 0, 0] : [0, 0, 0, 8]), // IFD0 オフセット
      ...u16(1, little), // エントリ数
      ...u16(0x0112, little), // Orientation
      ...u16(3, little), // SHORT
      ...(little ? [1, 0, 0, 0] : [0, 0, 0, 1]), // count
      ...u16(orientation, little),
      0,
      0,
    ];
    const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]; // "Exif\0\0"
    bytes.push(0xff, 0xe1, ...u16(app1.length + 2), ...app1);
  }
  bytes.push(0xff, 0xdb, ...u16(4), 0, 0); // DQT（中身はダミー）
  bytes.push(0xff, 0xc0, ...u16(11), 8, ...u16(height), ...u16(width), 1, 1, 0x11, 0);
  bytes.push(0xff, 0xda, ...u16(2));
  return toBase64(bytes);
}

function png(width: number, height: number): string {
  return toBase64([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32(13), 0x49, 0x48, 0x44, 0x52, // "IHDR"
    ...u32(width), ...u32(height), 8, 6, 0, 0, 0,
  ]);
}

test("detectOrientation: EXIF なしの横長 JPEG は landscape", () => {
  assert.equal(detectOrientation(jpeg(4032, 3024)), "landscape");
});

test("detectOrientation: EXIF なしの縦長 JPEG は portrait", () => {
  assert.equal(detectOrientation(jpeg(3024, 4032)), "portrait");
});

test("detectOrientation: Orientation=6 の横長 JPEG は portrait（iPhone の縦写真）", () => {
  const b64 = jpeg(4032, 3024, { orientation: 6, little: false });
  assert.equal(detectOrientation(b64), "portrait");
});

test("detectOrientation: Orientation=8 の横長 JPEG はリトルエンディアンでも portrait", () => {
  const b64 = jpeg(4032, 3024, { orientation: 8, little: true });
  assert.equal(detectOrientation(b64), "portrait");
});

test("detectOrientation: Orientation=1 の横長 JPEG は landscape", () => {
  const b64 = jpeg(4032, 3024, { orientation: 1, little: true });
  assert.equal(detectOrientation(b64), "landscape");
});

test("detectOrientation: 正方形は landscape", () => {
  assert.equal(detectOrientation(jpeg(1000, 1000)), "landscape");
});

test("detectOrientation: 縦長 PNG は portrait / 横長 PNG は landscape", () => {
  assert.equal(detectOrientation(png(600, 800)), "portrait");
  assert.equal(detectOrientation(png(800, 600)), "landscape");
});

test("detectOrientation: SOF の前で途切れた JPEG は null", () => {
  assert.equal(detectOrientation(toBase64([0xff, 0xd8, 0xff, 0xe0, 0x00])), null);
});

test("detectOrientation: JPEG / PNG 以外は null", () => {
  assert.equal(detectOrientation(btoa("hello world")), null);
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
