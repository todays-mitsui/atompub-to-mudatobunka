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

export type Orientation = "portrait" | "landscape";

/**
 * base64 の画像ヘッダから縦長 / 横長を判定する。
 * - JPEG は EXIF の Orientation（5〜8 は 90° 回転）を考慮する
 * - 正方形は landscape 扱い
 * - 判定できない場合は null を返す
 */
export function detectOrientation(base64: string): Orientation | null {
  // ヘッダ（EXIF・SOF）は先頭付近にあるので、先頭 96KB 分だけデコードする
  const head = base64.slice(0, 128 * 1024);
  let raw: string;
  try {
    raw = atob(head.slice(0, head.length - (head.length % 4)));
  } catch {
    return null;
  }
  // Uint8Array.from(raw, mapFn) は 96KB で数 ms かかるのでループで詰める
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  let size: ImageSize | null;
  try {
    switch (detectMimeType(base64)) {
      case "image/png":
        size = readPngSize(bytes);
        break;
      case "image/jpeg":
        size = readJpegSize(bytes);
        break;
      default:
        return null;
    }
  } catch {
    // 途中で切れたデータを DataView で読んだ場合の RangeError など
    return null;
  }
  if (size === null) return null;

  return size.height > size.width ? "portrait" : "landscape";
}

interface ImageSize {
  width: number;
  height: number;
}

function readPngSize(bytes: Uint8Array): ImageSize | null {
  // シグネチャ 8 バイト + IHDR チャンク（長さ 4 + "IHDR" 4 + 幅 4 + 高さ 4）
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegSize(bytes: Uint8Array): ImageSize | null {
  const view = new DataView(bytes.buffer);
  let exifOrientation = 1;
  let pos = 2; // SOI (FF D8) の次から

  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return null;
    const marker = bytes[pos + 1];
    // 長さを持たないマーカー（フィルバイト / TEM / RSTn）
    if (marker === 0xff) {
      pos += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    // SOS（画像データ開始）までに SOF がなければ諦める
    if (marker === 0xda) return null;

    const length = view.getUint16(pos + 2);

    // APP1 (EXIF)
    if (marker === 0xe1 && pos + 10 + 8 <= bytes.length) {
      const exifHeader = String.fromCharCode(...bytes.subarray(pos + 4, pos + 10));
      if (exifHeader === "Exif\0\0") {
        exifOrientation = readExifOrientation(view, pos + 10) ?? 1;
      }
    }

    // SOF0〜SOF15（DHT: C4, JPG: C8, DAC: CC を除く）
    if (
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    ) {
      if (pos + 9 > bytes.length) return null;
      const height = view.getUint16(pos + 5);
      const width = view.getUint16(pos + 7);
      // Orientation 5〜8 は 90° / 270° 回転なので縦横を入れ替える
      return exifOrientation >= 5 && exifOrientation <= 8
        ? { width: height, height: width }
        : { width, height };
    }

    pos += 2 + length;
  }

  return null;
}

/**
 * TIFF ヘッダ（tiffStart の位置）から IFD0 の Orientation (0x0112) を読む。
 */
function readExifOrientation(view: DataView, tiffStart: number): number | null {
  const byteOrder = view.getUint16(tiffStart);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
  const little = byteOrder === 0x4949; // "II" = リトルエンディアン

  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  if (ifd0 + 2 > view.byteLength) return null;
  const count = view.getUint16(ifd0, little);

  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (view.getUint16(entry, little) === 0x0112) {
      return view.getUint16(entry + 8, little);
    }
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
