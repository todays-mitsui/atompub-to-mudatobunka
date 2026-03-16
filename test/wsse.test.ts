import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assertMatch } from "https://deno.land/std@0.224.0/assert/assert_match.ts";
import { buildWsseHeaders } from "../src/wsse.ts";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function parseXWsse(
  xwsse: string,
): {
  username: string;
  passwordDigest: string;
  nonce: string;
  created: string;
} {
  const match = xwsse.match(
    /^UsernameToken Username="([^"]+)", PasswordDigest="([^"]+)", Nonce="([^"]+)", Created="([^"]+)"$/,
  );
  if (!match) throw new Error(`Failed to parse X-WSSE: ${xwsse}`);
  return {
    username: match[1],
    passwordDigest: match[2],
    nonce: match[3],
    created: match[4],
  };
}

Deno.test("buildWsseHeaders: X-WSSE ヘッダを含む", async () => {
  const headers = await buildWsseHeaders("testuser", "testapikey");
  const xwsse = headers.get("X-WSSE");
  assertEquals(xwsse !== null, true);
});

Deno.test("buildWsseHeaders: Authorization ヘッダが正しい", async () => {
  const headers = await buildWsseHeaders("testuser", "testapikey");
  assertEquals(headers.get("Authorization"), 'WSSE profile="UsernameToken"');
});

Deno.test("buildWsseHeaders: X-WSSE が UsernameToken 形式に合致する", async () => {
  const headers = await buildWsseHeaders("testuser", "testapikey");
  const xwsse = headers.get("X-WSSE")!;
  assertMatch(
    xwsse,
    /^UsernameToken Username="testuser", PasswordDigest="[^"]+", Nonce="[^"]+", Created="[^"]+"$/,
  );
});

Deno.test("buildWsseHeaders: PasswordDigest が正しく計算されている", async () => {
  const apiKey = "testapikey";
  const headers = await buildWsseHeaders("testuser", apiKey);
  const xwsse = headers.get("X-WSSE")!;
  const parsed = parseXWsse(xwsse);

  // nonce と created をパースし、同じロジックでダイジェストを再計算
  const nonceBytes = Uint8Array.from(
    atob(parsed.nonce),
    (c) => c.charCodeAt(0),
  );
  const createdBytes = new TextEncoder().encode(parsed.created);
  const apiKeyBytes = new TextEncoder().encode(apiKey);

  const concat = new Uint8Array(
    nonceBytes.length + createdBytes.length + apiKeyBytes.length,
  );
  concat.set(nonceBytes, 0);
  concat.set(createdBytes, nonceBytes.length);
  concat.set(apiKeyBytes, nonceBytes.length + createdBytes.length);

  const digestBuffer = await crypto.subtle.digest("SHA-1", concat);
  const expectedDigest = toBase64(new Uint8Array(digestBuffer));

  assertEquals(parsed.passwordDigest, expectedDigest);
});

Deno.test("buildWsseHeaders: Nonce が16バイト（Base64デコード後）", async () => {
  const headers = await buildWsseHeaders("testuser", "testapikey");
  const xwsse = headers.get("X-WSSE")!;
  const parsed = parseXWsse(xwsse);

  const nonceBytes = Uint8Array.from(
    atob(parsed.nonce),
    (c) => c.charCodeAt(0),
  );
  assertEquals(nonceBytes.length, 16);
});

Deno.test("buildWsseHeaders: Created が ISO 8601 形式", async () => {
  const headers = await buildWsseHeaders("testuser", "testapikey");
  const xwsse = headers.get("X-WSSE")!;
  const parsed = parseXWsse(xwsse);

  // ISO 8601 として有効な日時であること
  const date = new Date(parsed.created);
  assertEquals(isNaN(date.getTime()), false);
});

Deno.test("buildWsseHeaders: 呼び出しごとに Nonce が異なる", async () => {
  const h1 = await buildWsseHeaders("testuser", "testapikey");
  const h2 = await buildWsseHeaders("testuser", "testapikey");
  const nonce1 = parseXWsse(h1.get("X-WSSE")!).nonce;
  const nonce2 = parseXWsse(h2.get("X-WSSE")!).nonce;

  // 暗号論的乱数なので衝突はまず起きない
  assertEquals(nonce1 !== nonce2, true);
});
