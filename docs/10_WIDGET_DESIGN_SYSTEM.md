# tomu - ウィジェットデザインシステム設計書

Status: Draft v1
Date: 2026-03-22

---

## 1. 概要

AI が `widgetRenderer` ツールで生成する HTML/CSS/JS ウィジェットの品質を保証するためのデザインガイドライン。
AI は `widgetReadme` ツールを先に呼び出し、このガイドラインを取得してからウィジェットを生成する。

---

## 2. CSS 変数 (テーマトークン)

ウィジェットは以下の CSS 変数を使用してホストアプリと統一感を保つ:

```css
/* Colors */
var(--foreground)        /* メインテキスト */
var(--background)        /* 背景 */
var(--muted)             /* 控えめな背景 */
var(--primary)           /* プライマリカラー */
var(--secondary)         /* セカンダリカラー */
var(--border)            /* ボーダー */
var(--card)              /* カード背景 */
var(--destructive)       /* 警告・エラー */
var(--accent)            /* アクセント */
var(--input)             /* 入力フィールド背景 */
var(--ring)              /* フォーカスリング */
var(--chart-1) ~ var(--chart-5)  /* チャートカラー */

/* Layout */
var(--radius)            /* ボーダーラジアス */
var(--font-sans)         /* デフォルトフォント */
var(--font-mono)         /* 等幅フォント */
var(--font-serif)        /* エディトリアルフォント */
```

---

## 3. タイポグラフィ

| 要素 | サイズ | ウェイト | 行間 |
|:-----|:-------|:---------|:-----|
| Body | 14px | 400 | 1.6 |
| h1 | 1.5rem | 600 | - |
| h2 | 1.25rem | 600 | - |
| h3 | 1.1rem | 600 | - |
| Button | 13px | 500 | - |
| Input | 13px | 400 | - |
| Code/Pre | 12px mono | 400 | - |

**ルール**:
- 最小フォントサイズ: 11px
- テキスト階層は最大 3 レベル (heading, body, secondary)
- 常に Sentence case (Title Case, ALL CAPS 禁止)

---

## 4. レイアウトルール

### 4.1 グリッドシステム (4px ベース)

| 間隔 | 用途 |
|:-----|:-----|
| 4px | タイト (ラベルとフィールドの間) |
| 8px | コンパクト (ボタン間) |
| 12px | デフォルト (カード内パディング) |
| 16px | スペーシャス (セクション内) |
| 24px | セクション区切り |

### 4.2 カード

```css
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius); /* または calc(var(--radius) * 1.5) */
  padding: 12px ~ 16px;
  background: var(--card);
}
```

### 4.3 横並びレイアウト

```css
.side-by-side {
  display: flex;
  gap: 24px;
  align-items: stretch;  /* 必須: 等高 */
}
.side-by-side > * {
  flex: 1;
  min-width: 0;
}
```

### 4.4 データグリッド

```css
.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}
```

---

## 5. アニメーション設計

### Layer 1: UI コントロール (控えめ)

| 要素 | プロパティ | 時間 |
|:-----|:-----------|:-----|
| ボタンホバー | background-color | 0.15s |
| カードホバー | border-color | 0.2s |
| 展開セクション | max-height | 0.25s |
| 値ラベル | opacity cross-fade | 0.15s |

**禁止**: scale transform, バウンス, `* { transition }` グローバル

### Layer 2: ビジュアライゼーション (リッチ・シネマティック)

| アニメーション | 実装 |
|:---------------|:-----|
| イージング (汎用) | `cubic-bezier(0.2, 0, 0, 1)` |
| イージング (スプリング) | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` |
| ポインター移動 | `transform 0.4s` |
| アクティブハイライト | background 0.3s + glow box-shadow |
| ソートのスワップ | transform 0.4s での物理的交差 |
| 成功 | scale(1.1) + spring easing |
| 失敗 | opacity パルス (1→0.5→1) 0.6s |
| バー成長 | scaleY(0→1) + stagger 50ms |
| カウントアップ | requestAnimationFrame ~600ms |

---

## 6. ウィジェットモジュール種別

| Type | 用途 |
|:-----|:-----|
| `art` | イラスト・アートワーク |
| `mockup` | UI モックアップ・ワイヤーフレーム |
| `interactive` | ユーザー操作可能なシミュレーション |
| `chart` | チャート・グラフ |
| `diagram` | アーキテクチャ図・フローチャート |

---

## 7. 禁止事項

| カテゴリ | 禁止内容 |
|:---------|:---------|
| コメント | `<!-- -->` や `/* */` をウィジェット内に残さない |
| グラフィック効果 | グラデーション, ドロップシャドウ, blur, glow, ネオン |
| 色 | 外側コンテナへの暗色/色付き背景 (transparent のみ) |
| ポジション | `position: fixed` (iframe 崩壊の原因) |
| 3D Transform | `perspective`, `translateZ`, `rotateX/Y`, `preserve-3d` (SVG が壊れる) |
| プリスタイル要素 | h1-h6, p, button, input, select 等のスタイル上書き禁止 |
| 色指定 | 色付き背景上で `var(--foreground)` 使用禁止 → `var(--primary-foreground)` を使う |
| テキスト | 絵文字禁止 (CSS 図形 or SVG を使用) |
| タイポグラフィ | 本文中の太字禁止、Title Case 禁止 |

---

## 8. CDN 許可リスト

ウィジェット内で外部ライブラリを使用する場合、以下の CDN のみ許可:

```
cdnjs.cloudflare.com
esm.sh
cdn.jsdelivr.net
unpkg.com
```

---

## 9. ストリーミング対応ルール

AI がウィジェット HTML を生成する際の順序:

```
1. <style> (短く、15行以内推奨)
2. HTML コンテンツ
3. <script> (最後)
```

- インラインスタイル (`style="..."`) を `<style>` ブロックより優先
- `<script>` はストリーミング完了後に実行される

---

## 10. グローバル関数

ウィジェット内から利用可能な関数:

```javascript
// チャットにメッセージを送信 (ユーザーが入力したかのように)
sendPrompt('承認しました。次のステップへ進んでください。');

// 外部リンクをデフォルトブラウザで開く
openLink('https://example.com');
```

**postMessage 経由の内部実装**:
```javascript
window.parent.postMessage({ type: 'send-prompt', text: '...' }, '*');
window.parent.postMessage({ type: 'open-link', url: '...' }, '*');
window.parent.postMessage({ type: 'widget-resize', height: document.body.scrollHeight }, '*');
```

---

## 11. SVG ルール

- ダークモード対応: `c-blue`, `c-teal`, `c-amber` クラスを使用
- テキスト: `fill="inherit"` 禁止 → クラス (`t`, `ts`, `th`) を使用
- `<defs>` を先頭に配置
