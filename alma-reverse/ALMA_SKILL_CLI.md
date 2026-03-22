# `alma skill` CLI コマンドの徹底解剖

このドキュメントでは、ターミナルで実行される `alma skill` コマンド群の裏側のソースコード（`cli/alma`）を解析し、Alma（Protan）がどのようにスキルを管理・拡張しているかを詳細に解説します。

## 1. エコシステム (`skills.sh` と GitHub)
ソースコードのコメントに `── Skills (powered by skills.sh ecosystem) ─────────────` とあるように、Almaのスキル管理は独立したパッケージマネージャーである `skills` CLI（恐らく npm パッケージの `skills`）と、GitHubの標準的なリポジトリ構造に大きく依存しています。

独自の複雑なバックエンドDBを構築する代わりに、**外部の枯れたエコシステムをそのままラッピングしている**のが最大の特徴です。

---

## 2. 各サブコマンドの実装ロジック

### 🔍 `alma skill search <query>` (または `find`)
ユーザーが新しいスキルを探すときのコマンドです。
```javascript
const { execSync } = await import('child_process');
const runner = getPackageRunner(); // npx または bunx を取得
execSync(`${runner} skills find ${JSON.stringify(query)}`, { stdio: 'inherit' });
```
**【正体】**: ローカルAPIは一切通さず、Node.jsの `child_process` を使って直接ターミナルで `npx skills find <query>` を実行しているだけです。

### 📋 `alma skill list`
インストール済みのスキル一覧を表示します。
```javascript
const skills = await api('GET', '/api/skills');
for (const s of skills) {
    console.log(`${s.name || s.id}  [${s.source || 'unknown'}]  ${s.description || ''}`);
}
```
**【正体】**: これだけはローカルAPIサーバー（`localhost:23001`）の `/api/skills` を叩いてJSONを取得し、ターミナルに整形して出力しています。

### 📥 `alma skill install <source>`
新しいスキルをPCにダウンロードする最も重要なコマンドです。
```javascript
const source = args[2];
if (source.includes('/') || source.endsWith('.git')) {
    // 1. GitHub 等からの直接 Clone
    const gitUrl = source.startsWith('http') ? source : `https://github.com/${source}`;
    const repoName = source.split('/').pop().replace('.git', '');
    execSync(`git clone --depth 1 ${gitUrl} ${path.join(skillsDir, repoName)}`, { stdio: 'inherit' });
} else {
    // 2. skills.sh エコシステムからのインストール
    execSync(`${runner} skills install ${source}`, { stdio: 'inherit' });
}
```
**【正体】**: 
- `user/repo` のように `/` が含まれている場合、シンプルに `git clone --depth 1` で `~/.config/alma/skills/` ディレクトリ配下に直接リポジトリをダウンロードします。
- それ以外の場合は `npx skills install <source>` に処理を丸投げします。

### 🔄 `alma skill update`
インストール済みの全スキルを最新化します。
```javascript
execSync(`${runner} skills check`, { stdio: 'inherit' });
execSync(`${runner} skills update`, { stdio: 'inherit' });
```
**【正体】**: これも `npx skills update` コマンドに丸投げして、外部ツール側で差分更新を行わせています。

### 🗑️ `alma skill uninstall <name>`
不要になったスキルを削除します。
```javascript
const skillPath = path.join(_os.homedir(), '.config', 'alma', 'skills', args[2]);
if (fs.existsSync(skillPath)) {
    fs.rmSync(skillPath, { recursive: true });
}
```
**【正体】**: APIも外部ツールも使わず、単純にNode.jsの `fs.rmSync` を使って `~/.config/alma/skills/<name>` のフォルダごと物理削除（rm -rf）しているだけです。

---

## 3. Protan開発への応用 (設計の美しさ)

このCLI実装から学べる「Protan」開発の教訓は以下の通りです。

1. **車輪の再発明をしない**: プラグインのエコシステムや検索・更新ロジックをゼロからサーバーサイドで作るのではなく、`npm` などの既存のエコシステム（`npx skills`）や `git clone` に丸投げしています。
2. **サーバーレスな拡張管理**: `list` を除くほとんどの管理コマンドが、APIサーバーを経由せずに直接ファイルシステムやシェルを操作しています。これにより、サーバーが落ちていてもスキルの管理が可能です。
3. **フォルダ＝データベース**: アンインストール処理が単なる「ディレクトリの削除」であることからも分かる通り、**「ファイルが存在すればスキルが有効、消せば無効」**という究極にシンプルな状態管理（File-based state）を実現しています。
