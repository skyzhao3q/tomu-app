# Alma (Protan) Plugin System Architecture

このドキュメントでは、Alma（Protan）の拡張機能のもう一つの柱である「Plugin（プラグイン）」システムについて、リバースエンジニアリング結果に基づき解説します。

## 1. Skills と Plugins の違い

Almaには2種類の拡張機能が存在します。

- **🌟 Skills (`~/.config/alma/skills/`)**
  - **実体**: `SKILL.md`（Markdownテキスト）
  - **仕組み**: 動的プロンプト・インジェクション（RAG）。AIモデルに「コマンドの使い方」を教えるマニュアル。
  - **実行者**: Alma本体（が `Bash` ツールなどを使って実行する）

- **🔌 Plugins (`~/.config/alma/plugins/`)**
  - **実体**: `manifest.json` を含むパッケージ（ディレクトリ）
  - **仕組み**: メインプロセス（Node.js）への動的ロードとコード実行。UIコンポーネントの拡張や、アプリ自体のライフサイクルフックに介入することが可能。
  - **実行者**: アプリ（システム自身）

## 2. プラグインの構造と `manifest.json`

プラグインのルートディレクトリには、必ず `manifest.json` が必要です。メインプロセスはこれをパースしてプラグインのメタデータを登録します。

```json
// manifest.json の推測構造
{
  "id": "my-custom-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "...",
  "author": "...",
  "main": "index.js",
  "permissions": [...]
}
```

## 3. プラグイン管理 API エンドポイント

バックエンドにはプラグインのライフサイクルと設定を管理するための専用 API 群が実装されています。

| Method | Endpoint | 役割・概要 |
| :--- | :--- | :--- |
| `GET` | `/api/plugins` | インストール済みプラグインの一覧取得 |
| `POST` | `/api/plugins` | 新規インストール（GitHubのURL等を指定してダウンロード） |
| `POST` | `/api/plugins/:id/enable` | プラグインの有効化 (`activatePlugin`) |
| `POST` | `/api/plugins/:id/disable` | プラグインの無効化 |
| `DELETE`| `/api/plugins/:id` | プラグインのアンインストール（ディレクトリ削除） |
| `GET`/`PUT`| `/api/plugins/:id/settings` | プラグイン独自の設定データ（JSON）の取得・更新 |
| `GET`/`PUT`| `/api/plugins/:id/permissions`| プラグインに与える権限（サンドボックスやファイルアクセス等）の管理 |
| `POST` | `/api/plugins/:id/update` | GitHub等のリポジトリから最新版をプルしてアップデート |

## 4. インストール・ワークフロー (The `installPlugin` Flow)

コードから抽出されたインストール関数のロジックは以下のようになっています：

1. **ソースの特定**: ユーザーから渡されたURLがGitHubであれば、リポジトリをダウンロード（ZIP展開またはclone）して一時フォルダに配置。
2. **バリデーション**: ダウンロードしたディレクトリ内に `manifest.json` が存在するか確認し、パースする。
3. **配置**: `~/.config/alma/plugins/<plugin-id>` ディレクトリにファイルをコピー。
4. **メタデータの保存**: プラグインのメタデータ（`installUrl`, `version`, `settings` 等）をシステムステートに永続化。
5. **有効化**: `enabled: true` であれば、即座に `activatePlugin()` を呼び出してプラグインのコードをロード・実行する。

## 5. Protan開発への応用 (Key Takeaways)

「プロタン」を設計する上で、**「なぜSkillsだけでなく、Pluginsが必要なのか？」** を理解することが重要です。

- **Skills** は、「AI（Alma）に新しいツールの使い方を教える」ためのものです。
- **Plugins** は、「システム（Protan自体）に新しい機能を組み込む」ためのものです。例えば、新しいUIテーマの追加、全く新しいNative Toolのハードコード、OSのディープなAPIフック、あるいはサードパーティのLLMプロバイダーAPIの独自追加などは、Markdown（Skills）では不可能であり、Node.jsのコード（Plugins）としてシステムに注入する必要があります。

両者を明確に切り分けることで、「誰でも簡単に作れる拡張（Skills）」と「開発者向けの強力な拡張（Plugins）」という、拡張性の二刀流を実現しています。
