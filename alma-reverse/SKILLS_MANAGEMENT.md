# Alma (Protan) Skills Management Architecture

このドキュメントでは、Alma（Protan）における「Skills（スキル）」の追加、編集、削除、更新などの管理方法、およびそのデータ保存形式について解説します。

## 1. Skillsの保存場所とデータ形式

**【保存場所】**
- `~/.config/alma/skills/`
  ※ ユーザーごとの設定ディレクトリ内に保存され、インストールしたスキルごとにフォルダが分かれています。

**【データ形式】**
スキルは基本となる `SKILL.md` というMarkdownファイルと、必要に応じたスクリプトやアセットファイルで構成されています。

```markdown
---
name: example-skill
description: "スキルの短い説明"
allowed-tools:
  - Bash
  - Read
---

# Example Skill
AIに対する具体的な操作マニュアルやコマンドの実行例をここに書きます。
```
※ 先頭に YAML 形式の Frontmatter（メタデータ）を持ち、その下に Markdown 形式でAI向けの指示書（プロンプト）が書かれる設計です。

## 2. ライフサイクル管理（追加・編集・削除）

スキルの管理は主にターミナルから `alma skill` コマンドを通じて行われます。その裏側では、Node.js（Bun）のCLIやシェルコマンド、およびAPIサーバーが動作しています。

### 📥 1. 追加・インストール (`alma skill install <user/repo>`)
- **処理**: GitHub などのリポジトリからスキルをダウンロードして追加します。
- **実装ロジック**: 
  1. npm/bunエコシステムの `skills` コマンド（例: `npx skills`）を使ってパッケージマネージャー経由でインストールするか、
  2. URLが指定された場合は `git clone --depth 1` で直接 `~/.config/alma/skills/` 配下にクローンします。
- **UIとの連携**: GUI側の `Settings` -> `Skills` パネルからも、API (`POST /api/skills`) 経由で同様のインストール処理をトリガーできます。

### 🔍 2. 検索・探索 (`alma skill search <query>`)
- **処理**: コミュニティが公開している新しいスキルを探します。
- **実装ロジック**: 裏側で `npx skills find "<query>"` コマンドを実行し、外部のスキルエコシステム（skills.sh）から検索結果をターミナルに表示します。

### 🔄 3. 更新・アップデート (`alma skill update`)
- **処理**: インストール済みの全スキルを最新版に更新します。
- **実装ロジック**: 
  裏側で `npx skills check` および `npx skills update` を実行し、変更があれば上書きします。GitHubからのCloneの場合は、手動で `git pull` するか、GUIから `POST /api/skills/refresh` を叩いてメタデータを再読み込みします。

### 🗑️ 4. 削除・アンインストール (`alma skill uninstall <name>`)
- **処理**: 指定したスキルをシステムから削除します。
- **実装ロジック**: Node.js の `fs.rmSync(skillPath, { recursive: true })` を使って、`~/.config/alma/skills/<name>` ディレクトリごと物理削除します。API側では `DELETE /api/skills/:id` エンドポイントが対応しています。

### ✏️ 5. 自作・編集（Custom Skills）
- **処理**: ユーザーが自分で新しいスキルを作ったり、既存のスキルの挙動を変えたりします。
- **実装ロジック**: 特別なコマンドは不要です。テキストエディタで `~/.config/alma/skills/` 内の `SKILL.md` を直接書き換えるだけです。次回のAIへのプロンプト合成時に、最新のファイル内容が自動的にインジェクションされます。

## 3. Protan開発への応用 (Key Takeaways)

Alma（Protan）のスキル管理システムは、**「Gitクローンやファイル操作といった極めて原始的で枯れた技術」**と**「LLMのRAG（検索拡張生成）」**を組み合わせた非常にスマートな設計になっています。

1. **データベースが不要**: スキル管理用のRDBやJSON設定ファイルは不要です。`~/.config/alma/skills/` ディレクトリ内のファイル群自体がデータベースとして機能します。
2. **Git互換エコシステム**: スキルが単なるMarkdownとスクリプトの集まりであるため、GitHubのエコシステムをそのまま「スキルのマーケットプレイス」として利用できています。
