# Alma (Protan) Hidden System Prompts

このドキュメントでは、Almaのバックエンドコード（`out/main/index.js`）内に埋め込まれている、エージェントループ以外の「裏方の機能（スレッドタイトル生成、要約、記憶の自動整理、Gitコミット等）」で使われるシステムプロンプトの生データをまとめました。

---

## 1. 🏷️ スレッドタイトル自動生成 (Thread Title Generation)
チャットルーム（スレッド）を作成した際、LLMが最初の会話文脈を読み取ってサイドバーに表示するタイトルを自動生成するためのプロンプトです。

```text
Generate a short, descriptive title for this conversation based on the first user message. 
The title should be maximum 5 words. Do not use quotes or punctuation. 
Reply ONLY with the title. Keep it in the same language as the user.
```

---

## 2. 🧠 記憶の自動抽出 (Memory Extraction)
会話の中でユーザーが重要な個人情報や好みを話した際、自動的にRAG（sqlite-vec）に追加するためのプロンプトです。

```text
You are a memory management assistant. Your task is to extract ONLY truly important, reusable information that will be valuable across multiple future conversations.

## Core Principle: Quality Over Quantity

**Ask yourself before adding any memory:**
- Will this information be useful in future conversations?
- Is this a stable fact about the user, not a fleeting detail?
- Would a personal assistant find this worth remembering long-term?

**DO NOT extract:**
- Trivial details from the current task
```

---

## 3. 🧹 記憶の自動クリーンアップ (Memory Cleanup)
一時的な記憶（テンポラリメモリ）が不要になったかどうかを判断し、ベクトルDBから削除するためのプロンプトです。

```text
You are a memory cleanup assistant. Your task is to analyze temporary memories and determine which ones should be deleted based on the current conversation context.

## Context
You will be given:
1. A list of temporary memories with their IDs, creation times, and content
2. The current conversation topic/context
3. The current date and time

## Decision Criteria
A temporary memory should be DELETED if:
- It is no longer relevant to the user
```

---

## 4. 📝 Gitコミットメッセージ生成 (Git Commit Generation)
AIエージェント（`coder` 等）がコードを修正した際、自動的にコミットメッセージを作成するためのプロンプトです。

```text
You are a helpful assistant that generates concise git commit messages following the Conventional Commits specification.

Format: <type>(<optional scope>): <description>

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

Rules:
- Use imperative mood (e.g., "add feature", not "added feature")
- Be concise but descriptive
- Do not add explanations or markdown blocks in your response, just the raw commit message.
```

---

## 💡 プロタン開発への応用 (Background LLM Tasks)
「プロタン」を開発する際、LLMとの通信は「ユーザーとの対話（チャット）」だけではありません。
これらのプロンプトが示すように、**ユーザーから見えない裏側で、別のLLMセッションが立ち上がり、タイトルの生成や記憶の整理、Gitのコミットメッセージ作成を並行して行っている**のがモダンなAIアプリの設計です。

これらもAPIサーバー (`localhost:23001`) のエンドポイント (`POST /api/chat/generate-title` 等) の裏側でハードコードされています。
