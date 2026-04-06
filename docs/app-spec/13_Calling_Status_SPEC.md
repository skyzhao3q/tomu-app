# Tomu App: Tool / Skill / Agent Calling Status Implementation Specification

## 1. 概要 (Overview)
本ドキュメントは、Tomu AppのチャットUIにおいて、AIモデルが内部で呼び出している「Tools（基本ツール）」「Skills（特定専門機能）」「Crew Agents（自律型エージェント）」の実行ステータスを可視化し、システム状態を管理するための完全な実装仕様書である。
Coding Agent（AIエンジニア）は、本仕様書を設計図として参照し、データモデル、状態管理、データ更新ロジック、UIコンポーネント群を実装すること。

---

## 2. アーキテクチャ原則 (Architecture Principles)
1. **ライフサイクルの分離:**
   - **Tools / Skills:** チャットの「メッセージ（Message）」に直接紐づくインライン処理。処理完了後にAIのテキスト応答が続く同期的な性質が強い。
   - **Crew Agents:** メッセージトリガーで起動するが、処理が数分に及ぶバックグラウンドタスク。チャットのスクロール位置に依存せず、グローバル（Floating UI）で監視可能にする。
2. **パフォーマンスへの配慮:**
   - Agentのストリーミングログは高頻度で更新されるため、Reactのレンダリングループを圧迫しないよう、ログの描画にはスロットル（throttle/debounce）処理や、末尾追従（Tail）専用の最適化を行う。

---

## 3. データモデル (Data Models)
すべての通信と状態管理の基盤となるTypeScriptの型定義。

```typescript
export type CallStatus = 'pending' | 'running' | 'success' | 'failed';
export type CallType = 'tool' | 'skill' | 'agent';

// Tool / Skill用（メッセージ内に保持）
export interface ToolCall {
  id: string;             // 一意の実行ID
  name: string;           // 例: "Bash", "skill:pdf"
  type: 'tool' | 'skill';
  status: CallStatus;
  input: Record<string, any>; // 引数ペイロード
  output?: string;            // 実行完了後の結果文字列
  error?: string;             // エラー時のメッセージ
  startedAt: number;          // 実行開始タイムスタンプ
  endedAt?: number;           // 実行終了タイムスタンプ
}

// Agentタスク用（グローバルステートに保持）
export interface AgentTask {
  taskId: string;         // エージェントタスクID
  agentId: string;        // 例: "coder", "designer"
  type: 'agent';
  status: CallStatus;
  description: string;    // タスクの概要（"Implement login page" 等）
  input: Record<string, any>;
  output?: string;
  error?: string;
  logs: string[];         // リアルタイムで追加されるターミナルログの配列
  startedAt: number;
  endedAt?: number;
  threadId: string;       // 呼び出し元のチャットスレッドID
}

// ストリーミングイベントペイロード（WebSocket / SSE用）
export type StreamEvent = 
  | { type: 'CALL_START'; payload: { id: string; callType: CallType; name: string; input: any } }
  | { type: 'CALL_LOG_CHUNK'; payload: { id: string; chunk: string } } // Agentのストリーミングログ用
  | { type: 'CALL_SUCCESS'; payload: { id: string; output: string } }
  | { type: 'CALL_FAILED'; payload: { id: string; error: string } };
```

---

## 4. 状態管理と更新ロジック (State Management & Logic)
Zustand（または同等のストア）を用いて、インラインツールとグローバルエージェントの状態を管理する。

### 4.1. Message Store (Tools / Skills用)
チャットメッセージの配列を管理するストアに、`toolCalls` をネストして保持する。
- **データ更新ロジック:**
  - `CALL_START`: 対象メッセージの `toolCalls` 配列に新規オブジェクト（status: `running`）を追加。
  - `CALL_SUCCESS`/`CALL_FAILED`: 該当IDを検索し、`status`を更新、`output` / `error` をセット。

### 4.2. Global Agent Store (Crew Agents用)
アプリケーション全体のどこからでもアクセスできるAgent専用のストア。
```typescript
interface AgentStore {
  tasks: Record<string, AgentTask>; // taskIdをキーにしたMap形式
  isWindowOpen: boolean;
  
  // Actions
  upsertTask: (task: Partial<AgentTask> & { taskId: string }) => void;
  appendLog: (taskId: string, chunk: string) => void;
  toggleWindow: (isOpen?: boolean) => void;
}
```
- **データ更新ロジック:**
  - `appendLog`: 文字列の結合ではなく、配列 `logs.push(chunk)` を行う。UI側で行ごとにレンダリングしやすくするため。

---

## 5. UI/UX 及び 表示ロジック仕様 (UI & Display Logic)

### 5.1. 共通の視覚的区別 (Theming)
種類（type）に応じてアイコンとテーマカラーを固定し、視覚的認知を統一する。
- **Tool (`tool`)**: ⚙️ または `TerminalIcon` / Blue (Tailwind: `blue-500`, bg: `blue-50`)
- **Skill (`skill`)**: ✨ または `SparklesIcon` / Purple (Tailwind: `purple-500`, bg: `purple-50`)
- **Agent (`agent`)**: 🤖 または `BotIcon` / Green (Tailwind: `emerald-500`, bg: `emerald-50`)

### 5.2. Tool / Skill の表示仕様 (Inline Message View)
メッセージの中に何十個ものツール実行履歴が並ぶのを防ぐための集約ロジック。

1. **集約判定 (Aggregation Logic):**
   - メッセージオブジェクト内の `toolCalls` 配列を監視。
   - `length > 0` の場合、メッセージブロックの下部（または上部）に **`ToolSkillSummaryBadge`** をレンダリング。
   - バッジのテキスト例: 「⚙️ 3 Tools 実行済」や「✨ 1 Skill 実行中...」。
   - `toolCalls` 内に1つでも `status === 'running'` があれば、バッジにローディングスピナー（アニメーション）を表示。
2. **Popover 展開 (Interaction):**
   - バッジにマウスホバー（モバイルはタップ）で `Popover` (Radix UI等を使用) を展開。
   - Popover内に **`ToolCallList`** コンポーネントを描画。
   - リスト内の各 **`ToolCallItem`** は、クリックでアコーディオン展開し、`input` (JSON) と `output` (Markdown/Text) をプレビュー表示可能にする。

### 5.3. Crew Agents の表示仕様 (Global Floating View)
バックグラウンド実行を監視するためのグローバルUI。

1. **フローティングボタン表示ロジック (`AgentFloatingButton`):**
   - `AgentStore.tasks` のオブジェクトキー配列数が 1 以上の場合のみ画面右下に表示（タスクがゼロなら非表示）。
   - `tasks` の中に `status === 'running'` のタスクが存在する場合、アイコンの周囲にPulse（波紋）アニメーションを付与。
   - `status === 'success'` 状態のタスクのみになればアニメーションを停止し、一定時間（例: 5分）経過後、またはユーザーが閉じる操作をしたタスクはストアから削除可能にする。
2. **ステータスウィンドウ展開ロジック (`AgentStatusWindow`):**
   - フローティングボタンクリックで開閉（`isWindowOpen`）。
   - 展開時、各タスクがアコーディオン形式のカードとしてリスト表示される。
   - **`LogStreamViewer`（ターミナル風UI）**:
     - タスクが展開されている間、`logs` 配列を黒背景の等幅フォント（monospace）領域にレンダリングする。
     - **Auto-Tail機能:** `logs` 配列が更新されるたびに、コンテナの `scrollTop` を `scrollHeight` に合わせるロジック（`useRef` と `useEffect`）を組み込み、常に最新ログを追従させる。ユーザーが手動で上にスクロールした場合は一時的にAuto-Tailを解除（Pinning）する制御が望ましい。

---

## 6. エッジケースとエラーハンドリング
- **ツール実行のタイムアウト:** 実行中のまま通信が切断された場合を考慮し、一定時間（例: 5分）`running` のままであればUI側で `timeout` または `failed` として扱うフェイルセーフを設ける。
- **長大なログのレンダリング負荷:** Agentログが数千行に及ぶ場合、DOMの肥大化を防ぐため、`LogStreamViewer` にはVirtual Scrolling（仮想スクロール: 例 `@tanstack/react-virtual`）を適用するか、直近1000行のみをレンダリングするTruncate処理を施すこと。