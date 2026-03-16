# セットアップ手順

## 1. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して以下の値を設定する:

| 変数名           | 値の確認場所                                     |
| ---------------- | ------------------------------------------------ |
| `HATENA_ID`      | はてな ID（ログイン名）                          |
| `HATENA_API_KEY` | ブログ管理画面 → 設定 → 詳細設定 → AtomPub       |
| `HATENA_BLOG_ID` | ブログのドメイン（例: `example.hatenablog.com`） |
| `ENTRY_ID`       | 旅ログ専用記事の URL 末尾の数値                  |
| `WEBHOOK_SECRET` | 任意の文字列（iPhone ショートカットと共有する）  |

## 2. ローカル起動

```bash
deno task dev
```

## 3. 動作確認

```bash
curl -X POST http://localhost:8000/append \
  -H "Authorization: Bearer {WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "photo_base64": "...",
    "comment": "テスト投稿",
    "location_url": "https://maps.google.com/..."
  }'

# photo_base64 を省略すると画像なしで追記される
curl -X POST http://localhost:8000/append \
  -H "Authorization: Bearer {WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "テスト投稿（画像なし）",
    "location_url": "https://maps.google.com/..."
  }'
```

成功すると以下が返る:

```json
{ "ok": true, "imageUrl": "https://cdn-ak.f.st-hatena.com/..." }
```

はてなブログの該当記事末尾に以下の形式で追記されていることを確認する:

```markdown
---

**HH:MM** [📍 現在地](https://maps.google.com/...)

![](https://cdn-ak.f.st-hatena.com/...)

テスト投稿
```

## 4. Deno Deploy へデプロイ

```bash
deno task deploy
```

デプロイ後、Deno Deploy のダッシュボードで環境変数（`.env`
と同じ内容）を設定する。

## 5. iPhone ショートカットの設定

ショートカットの「URL」を Deno Deploy のエンドポイントに更新する:

```
https://{project-name}.deno.dev/append
```
