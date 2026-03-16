/**
 * WSSE 認証ヘッダ生成
 * https://developer.hatena.ne.jp/ja/documents/auth/apis/wsse
 */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

export async function buildWsseHeaders(
  hatenaId: string,
  apiKey: string,
): Promise<Headers> {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const created = new Date().toISOString();

  const createdBytes = new TextEncoder().encode(created);
  const apiKeyBytes = new TextEncoder().encode(apiKey);

  // PasswordDigest = Base64( SHA-1( nonce_bytes + created + api_key ) )
  const concat = new Uint8Array(
    nonceBytes.length + createdBytes.length + apiKeyBytes.length,
  );
  concat.set(nonceBytes, 0);
  concat.set(createdBytes, nonceBytes.length);
  concat.set(apiKeyBytes, nonceBytes.length + createdBytes.length);

  const digestBuffer = await crypto.subtle.digest("SHA-1", concat);
  const digestBytes = new Uint8Array(digestBuffer);

  const nonce = toBase64(nonceBytes);
  const passwordDigest = toBase64(digestBytes);

  const wsseValue =
    `UsernameToken Username="${hatenaId}", PasswordDigest="${passwordDigest}", Nonce="${nonce}", Created="${created}"`;

  const headers = new Headers();
  headers.set("Authorization", 'WSSE profile="UsernameToken"');
  headers.set("X-WSSE", wsseValue);

  return headers;
}
