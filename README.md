# AtomPub to mudatobunka

はてなブログの記事に写真・コメント・位置情報を追記する Deno Deploy アプリ

## ディレクトリ構成

```
main.ts          エントリポイント（Deno.serve）
src/
  blog.ts        はてなブログ AtomPub API（GET / PUT）
  fotolife.ts    はてなフォトライフ API（画像アップロード）
  handler.ts     認証・バリデーション・設定解決
  wsse.ts        WSSE 認証ヘッダ生成
test/
  *_test.ts      各モジュールのテスト
```

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して以下の値を設定する:

| 変数名               | 説明                                             |
| -------------------- | ------------------------------------------------ |
| `HATENA_ID`          | はてな ID（ログイン名）                          |
| `HATENA_API_KEY`     | ブログ管理画面 → 設定 → 詳細設定 → AtomPub       |
| `HATENA_BLOG_ID`     | ブログのドメイン（例: `example.hatenablog.com`） |
| `WEBHOOK_SECRET`     | 任意の文字列（リクエスト元と共有する）           |
| `ENTRY_ID_WHITELIST` | 許可する記事 ID（カンマ区切りで複数指定可）      |

### 2. ローカル起動

```bash
deno task dev
```

### 3. 動作確認

```bash
curl -X POST http://localhost:8000/append \
  -H "Authorization: Bearer {WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "entry_id": "1234567890",
    "photo_base64": "...",
    "comment": "テスト投稿",
    "location_url": "https://maps.google.com/..."
  }'
```

`photo_base64` は省略可。指定する場合は JPEG または PNG の base64 文字列。

成功すると以下が返る:

```json
{ "ok": true }
```

はてなブログの該当記事末尾に以下の形式で追記される:

```
---

**HH:MM** [現在地](https://maps.google.com/...)

[f:id:...:plain]

テスト投稿
```

### 4. テスト

```bash
deno task test
```

### 5. Deno Deploy

デプロイ後、Deno Deploy のダッシュボードで環境変数（`.env` と同じ内容）を設定する。
