# AtomPub to mudatobunka

はてなブログの記事に写真・コメント・位置情報を追記する Cloudflare Workers アプリ

## ディレクトリ構成

```
main.ts          エントリポイント（Workers の fetch ハンドラ）
src/
  blog.ts        はてなブログ AtomPub API（GET / PUT）
  fotolife.ts    はてなフォトライフ API（画像アップロード）
  handler.ts     認証・バリデーション・設定解決
  wsse.ts        WSSE 認証ヘッダ生成
test/
  *.test.ts      各モジュールのテスト
```

## セットアップ

### 1. 依存パッケージのインストールと環境変数の設定

```bash
npm install
cp .dev.vars.example .dev.vars
```

`.dev.vars` を編集して以下の値を設定する:

| 変数名               | 説明                                             |
| -------------------- | ------------------------------------------------ |
| `HATENA_ID`          | はてな ID（ログイン名）                          |
| `HATENA_API_KEY`     | ブログ管理画面 → 設定 → 詳細設定 → AtomPub       |
| `HATENA_BLOG_ID`     | ブログのドメイン（例: `example.hatenablog.com`） |
| `WEBHOOK_SECRET`     | 任意の文字列（リクエスト元と共有する）           |
| `ENTRY_ID_WHITELIST` | 許可する記事 ID（カンマ区切りで複数指定可）      |

### 2. ローカル起動

```bash
npm run dev
```

### 3. 動作確認

```bash
curl -X POST http://localhost:8787/append \
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

はてなブログの該当記事に以下の形式で追記される。本文中に `<!-- +++ -->` があればその直前に、なければ本文末尾に追記する（マーカーは残るので、続けて追記すると時系列順に並ぶ）:

```
---

**HH:MM** [現在地](https://maps.google.com/...)

[f:id:...:plain]

テスト投稿
```

### 4. テスト

```bash
npm test
npm run typecheck
```

### 5. Cloudflare Workers へのデプロイ

```bash
npx wrangler login
npm run deploy
```

初回デプロイ後、環境変数（`.dev.vars` と同じ内容）をシークレットとして登録する:

```bash
npx wrangler secret put HATENA_ID
npx wrangler secret put HATENA_API_KEY
npx wrangler secret put HATENA_BLOG_ID
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put ENTRY_ID_WHITELIST
```

Cloudflare のダッシュボード（Workers & Pages → 対象の Worker → Settings → Variables and Secrets）から設定してもよい。
