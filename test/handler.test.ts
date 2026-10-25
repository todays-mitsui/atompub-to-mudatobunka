import { assert, test } from "vitest";
import {
  type Env,
  parseAndValidateBody,
  resolveConfig,
  verifyAuth,
} from "../src/handler.ts";

// --- verifyAuth ---

test("verifyAuth: WEBHOOK_SECRET 未設定で 500", () => {
  const req = new Request("http://localhost/append", { method: "POST" });
  const res = verifyAuth(req, {});
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual(res!.status, 500);
});

test("verifyAuth: トークン不一致で 401", () => {
  const env: Env = { WEBHOOK_SECRET: "correct-token" };
  const req = new Request("http://localhost/append", {
    method: "POST",
    headers: { Authorization: "Bearer wrong-token" },
  });
  const res = verifyAuth(req, env);
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual(res!.status, 401);
});

test("verifyAuth: Authorization ヘッダなしで 401", () => {
  const env: Env = { WEBHOOK_SECRET: "correct-token" };
  const req = new Request("http://localhost/append", { method: "POST" });
  const res = verifyAuth(req, env);
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual(res!.status, 401);
});

test("verifyAuth: 認証成功で null", () => {
  const env: Env = { WEBHOOK_SECRET: "correct-token" };
  const req = new Request("http://localhost/append", {
    method: "POST",
    headers: { Authorization: "Bearer correct-token" },
  });
  const res = verifyAuth(req, env);
  assert.deepEqual(res, null);
});

// --- parseAndValidateBody ---

const whitelistEnv: Env = {
  ENTRY_ID_WHITELIST: "17179246901362733954,17179246901362734279",
};

test("parseAndValidateBody: 不正な JSON で 400", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: "not json",
    headers: { "Content-Type": "text/plain" },
  });
  const res = await parseAndValidateBody(req, {});
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual((res as Response).status, 400);
});

test("parseAndValidateBody: comment 未指定で 400", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: JSON.stringify({ location_url: "https://example.com" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await parseAndValidateBody(req, {});
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual((res as Response).status, 400);
});

test("parseAndValidateBody: location_url 未指定で 400", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: JSON.stringify({ comment: "hello" }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await parseAndValidateBody(req, {});
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual((res as Response).status, 400);
});

test("parseAndValidateBody: entry_id 未指定で 400", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: JSON.stringify({
      comment: "hello",
      location_url: "https://example.com",
    }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await parseAndValidateBody(req, whitelistEnv);
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual((res as Response).status, 400);
});

test("parseAndValidateBody: 正常なボディでバリデーション済みオブジェクトを返す", async () => {
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
  const res = await parseAndValidateBody(req, whitelistEnv);
  assert.deepEqual(res instanceof Response, false);
  assert.deepEqual(res, {
    comment: "hello",
    location_url: "https://example.com",
    photo_base64: "abc",
    entry_id: "17179246901362733954",
  });
});

test("parseAndValidateBody: ホワイトリスト外の entry_id で 403", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: JSON.stringify({
      comment: "hello",
      location_url: "https://example.com",
      entry_id: "9999999999999999999",
    }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await parseAndValidateBody(req, whitelistEnv);
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual((res as Response).status, 403);
});

test("parseAndValidateBody: photo_base64 は省略可", async () => {
  const req = new Request("http://localhost/append", {
    method: "POST",
    body: JSON.stringify({
      comment: "hello",
      location_url: "https://example.com",
      entry_id: "17179246901362733954",
    }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await parseAndValidateBody(req, whitelistEnv);
  assert.deepEqual(res instanceof Response, false);
  assert.deepEqual(res, {
    comment: "hello",
    location_url: "https://example.com",
    photo_base64: null,
    entry_id: "17179246901362733954",
  });
});

// --- resolveConfig ---

const configEnv: Env = {
  HATENA_ID: "testuser",
  HATENA_API_KEY: "testkey",
  HATENA_BLOG_ID: "test.example.com",
};

test("resolveConfig: 環境変数不足で 500", () => {
  const res = resolveConfig("17179246901362733954", {});
  assert.deepEqual(res instanceof Response, true);
  assert.deepEqual((res as Response).status, 500);
});

test("resolveConfig: 正常な設定で ResolvedConfig を返す", () => {
  const res = resolveConfig("17179246901362734279", configEnv);
  assert.deepEqual(res instanceof Response, false);
  assert.deepEqual(res, {
    hatenaId: "testuser",
    apiKey: "testkey",
    blogId: "test.example.com",
    entryId: "17179246901362734279",
  });
});
