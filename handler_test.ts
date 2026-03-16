import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { parseAndValidateBody, resolveConfig, verifyAuth } from "./handler.ts";

// --- verifyAuth ---

Deno.test("verifyAuth: WEBHOOK_SECRET 未設定で 500", () => {
  Deno.env.delete("WEBHOOK_SECRET");
  const req = new Request("http://localhost/append", { method: "POST" });
  const res = verifyAuth(req);
  assertEquals(res instanceof Response, true);
  assertEquals(res!.status, 500);
});

Deno.test("verifyAuth: トークン不一致で 401", () => {
  Deno.env.set("WEBHOOK_SECRET", "correct-token");
  try {
    const req = new Request("http://localhost/append", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-token" },
    });
    const res = verifyAuth(req);
    assertEquals(res instanceof Response, true);
    assertEquals(res!.status, 401);
  } finally {
    Deno.env.delete("WEBHOOK_SECRET");
  }
});

Deno.test("verifyAuth: Authorization ヘッダなしで 401", () => {
  Deno.env.set("WEBHOOK_SECRET", "correct-token");
  try {
    const req = new Request("http://localhost/append", { method: "POST" });
    const res = verifyAuth(req);
    assertEquals(res instanceof Response, true);
    assertEquals(res!.status, 401);
  } finally {
    Deno.env.delete("WEBHOOK_SECRET");
  }
});

Deno.test("verifyAuth: 認証成功で null", () => {
  Deno.env.set("WEBHOOK_SECRET", "correct-token");
  try {
    const req = new Request("http://localhost/append", {
      method: "POST",
      headers: { Authorization: "Bearer correct-token" },
    });
    const res = verifyAuth(req);
    assertEquals(res, null);
  } finally {
    Deno.env.delete("WEBHOOK_SECRET");
  }
});

// --- parseAndValidateBody ---

Deno.test("parseAndValidateBody: 不正な JSON で 400", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: "not json",
    headers: { "Content-Type": "text/plain" },
  });
  const res = await parseAndValidateBody(req);
  assertEquals(res instanceof Response, true);
  assertEquals((res as Response).status, 400);
});

Deno.test("parseAndValidateBody: comment 未指定で 400", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: JSON.stringify({ location_url: "https://example.com" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await parseAndValidateBody(req);
  assertEquals(res instanceof Response, true);
  assertEquals((res as Response).status, 400);
});

Deno.test("parseAndValidateBody: location_url 未指定で 400", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: JSON.stringify({ comment: "hello" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await parseAndValidateBody(req);
  assertEquals(res instanceof Response, true);
  assertEquals((res as Response).status, 400);
});

Deno.test("parseAndValidateBody: entry_id 未指定で 400", async () => {
  Deno.env.set(
    "ENTRY_ID_WHITELIST",
    "17179246901362733954,17179246901362734279",
  );
  try {
    const req = new Request("http://localhost/append", {
      method: "POST",
      body: JSON.stringify({
        comment: "hello",
        location_url: "https://example.com",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await parseAndValidateBody(req);
    assertEquals(res instanceof Response, true);
    assertEquals((res as Response).status, 400);
  } finally {
    Deno.env.delete("ENTRY_ID_WHITELIST");
  }
});

Deno.test("parseAndValidateBody: 正常なボディでバリデーション済みオブジェクトを返す", async () => {
  Deno.env.set(
    "ENTRY_ID_WHITELIST",
    "17179246901362733954,17179246901362734279",
  );
  try {
    const req = new Request("http://localhost/append", {
      method: "POST",
      body: JSON.stringify({
        comment: "hello",
        location_url: "https://example.com",
        photo_base64: "abc",
        entry_id: "17179246901362733954",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await parseAndValidateBody(req);
    assertEquals(res instanceof Response, false);
    assertEquals(res, {
      comment: "hello",
      location_url: "https://example.com",
      photo_base64: "abc",
      entry_id: "17179246901362733954",
    });
  } finally {
    Deno.env.delete("ENTRY_ID_WHITELIST");
  }
});

Deno.test("parseAndValidateBody: ホワイトリスト外の entry_id で 403", async () => {
  Deno.env.set(
    "ENTRY_ID_WHITELIST",
    "17179246901362733954,17179246901362734279",
  );
  try {
    const req = new Request("http://localhost/append", {
      method: "POST",
      body: JSON.stringify({
        comment: "hello",
        location_url: "https://example.com",
        entry_id: "9999999999999999999",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await parseAndValidateBody(req);
    assertEquals(res instanceof Response, true);
    assertEquals((res as Response).status, 403);
  } finally {
    Deno.env.delete("ENTRY_ID_WHITELIST");
  }
});

Deno.test("parseAndValidateBody: photo_base64 は省略可", async () => {
  Deno.env.set(
    "ENTRY_ID_WHITELIST",
    "17179246901362733954,17179246901362734279",
  );
  try {
    const req = new Request("http://localhost/append", {
      method: "POST",
      body: JSON.stringify({
        comment: "hello",
        location_url: "https://example.com",
        entry_id: "17179246901362733954",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await parseAndValidateBody(req);
    assertEquals(res instanceof Response, false);
    assertEquals(res, {
      comment: "hello",
      location_url: "https://example.com",
      photo_base64: null,
      entry_id: "17179246901362733954",
    });
  } finally {
    Deno.env.delete("ENTRY_ID_WHITELIST");
  }
});

// --- resolveConfig ---

function setConfigEnv() {
  Deno.env.set("HATENA_ID", "testuser");
  Deno.env.set("HATENA_API_KEY", "testkey");
  Deno.env.set("HATENA_BLOG_ID", "test.example.com");
}

function deleteConfigEnv() {
  Deno.env.delete("HATENA_ID");
  Deno.env.delete("HATENA_API_KEY");
  Deno.env.delete("HATENA_BLOG_ID");
}

Deno.test("resolveConfig: 環境変数不足で 500", () => {
  deleteConfigEnv();
  const res = resolveConfig("17179246901362733954");
  assertEquals(res instanceof Response, true);
  assertEquals((res as Response).status, 500);
});

Deno.test("resolveConfig: 正常な設定で ResolvedConfig を返す", () => {
  setConfigEnv();
  try {
    const res = resolveConfig("17179246901362734279");
    assertEquals(res instanceof Response, false);
    assertEquals(res, {
      hatenaId: "testuser",
      apiKey: "testkey",
      blogId: "test.example.com",
      entryId: "17179246901362734279",
    });
  } finally {
    deleteConfigEnv();
  }
});
