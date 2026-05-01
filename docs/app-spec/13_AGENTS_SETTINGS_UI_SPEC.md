# tomu - Agents & Crew Settings UI Spec (FULL Version)

Status: Draft v1.2
Date: 2026-05-01
Source of truth reviewed: `apps/desktop/src/main/agents.ts`, `apps/desktop/src/main/routes/agents.ts`, `packages/core/src/schemas/agent.ts`, `apps/viewer/src/components/SettingsModal.tsx`

---

## 1. 概要 (Overview)
Tomu APPの設定（Settings）内に、自律型エージェントの組織（Crew）を管理・カスタマイズするための専用画面を実装する。
ユーザーは組み込みエージェントのカスタマイズ、特定タスク専用のカスタムエージェントの作成、および「誰が誰にタスクを振るか（Handoff）」の相関関係を視覚的に管理できる。

---

## 2. データ構造と初期シード (Data Model & Seed Data)

### 2.1 型定義 (Type Definitions)
グローバル設定は `config.json` の `agents_enabled` / `agents_allow_delegation` に保存され、プロファイル本体は SQLite の `agent_profiles` テーブルで管理される。API レスポンスでは `AgentsConfig` として合成される。

```typescript
interface AgentsConfig {
  enabled: boolean;                  // クルー機能全体の有効/無効
  allowSubagentDelegation: boolean;  // エージェント間の自律的なHandoffの許可
  profiles: AgentProfile[];
}

interface AgentProfile {
  id: string;             // [PK] a-z, 0-9, hyphen のみ許容 (例: "product-manager")
  name: string;           // 表示名 (Max: 30文字)
  category: 'design' | 'product' | 'engineering' | 'research' | 'operations' | 'custom';
  executionMode: 'general-purpose' | 'plan' | 'coder' | 'tomu-operator' | 'explore' | 'tomu-guide' | 'statusline-setup';
  enabled: boolean;       // 稼働状態
  builtIn: boolean;       // true の場合は削除・ID変更・executionMode変更不可
  color: string;          // テーマカラー (HEX形式: "#FFFFFF")
  summary: string;        // 役割の短い説明 (Max: 100文字)
  focus: string[];        // 得意分野のキーワード配列 (Max: 5個)
  delegatesTo: string[];  // 委譲先のエージェントID配列 (循環参照をシステムで防ぐ)
  prompt: string;         // システムプロンプト本体 (FULL Version)
  model?: string;         // 個別指定モデル (フォーマット: "providerId:modelId")。未指定時は全体デフォルトを使用。
}
```

### 2.2 組み込みシードデータ (Built-in Seed Data)
システム初回起動時に投入・保護される必須の5エージェント。プロンプトは `assets/prompts/subagents/<id>.md` から読み込まれる。

| ID | Name | Category | Execution Mode | Color | Focus (Tags) | Delegates To | Default Prompt |
|:---|:-----|:---------|:---------------|:------|:-------------|:-------------|:---------------|
| `product-manager` | Product Manager | `product` | `general-purpose` | `#6366f1` | Requirements, Planning, Delegation, Scoping, Acceptance | `designer`, `developer`, `researcher`, `operator` | `assets/prompts/subagents/product-manager.md` |
| `designer` | Designer | `design` | `plan` | `#ec4899` | UX/UI, Components, Interaction States, Accessibility, Design Spec | none | `assets/prompts/subagents/designer.md` |
| `developer` | Developer | `engineering` | `coder` | `#22c55e` | Implementation, Code, Testing, Bash, File Editing | none | `assets/prompts/subagents/developer.md` |
| `researcher` | Researcher | `research` | `explore` | `#f59e0b` | Research, Analysis, Reports, Information Gathering | none | `assets/prompts/subagents/researcher.md` |
| `operator` | Operator | `operations` | `tomu-operator` | `#14b8a6` | System Ops, Bash, File Management | none | `assets/prompts/subagents/operator.md` |

---

## 3. 画面レイアウトとUIコンポーネント (UI Layout & Elements)

### 3.1 ダッシュボード画面 (Agents Dashboard)

**[Header 領域]**
- **Title**: Agents & Crew
- **Global Toggles**:
  - `Enable Agent Crew`: システム全体のエージェント機能を停止するマスタースイッチ。OFF時は各エージェントも利用不可。
  - `Allow Autonomous Delegation`: エージェントがユーザーの介入なしに `Task` ツールを使って別のエージェントを呼び出すことを許可するか。
- **Action Buttons**:
  - `+ Create Custom Agent` (右寄せ): 新規作成モーダルを開く。
- **Search & Filter**:
  - テキスト検索 (名前、説明、Focusタグを対象)。
  - カテゴリフィルターのドロップダウン (All, Product, Engineering...)。

**[List/Grid 領域]**
- カテゴリごとにセクションを分けて表示（例：**Engineering**, **Product**）。
- **Agent Card (カードUI)**:
  - 左端に `color` で指定された色の縦線アクセント。
  - **Header**: Avatar (イニシャル または アイコン) + Name + 組み込みバッジ (`Built-in` のみ表示)。
  - **Body**: Summaryテキスト。下部に Focus タグをチップ状に横並び表示。
  - **Footer**: 左側に「Handoff: [アイコン群]」(委譲先を示す小さなアバター)。右側に `Enable` トグルスイッチ と `Edit` ボタン。

### 3.2 編集・作成モーダル (Agent Editor Modal)

画面を「General」と「Behavior」の2つのタブに分割する。

#### タブ1: General (基本設定)
| UI要素 | タイプ | バリデーション・仕様 |
|:---|:---|:---|
| **ID** | Text Input | 新規作成時のみ編集可。正規表現: `^[a-z0-9-]+$`。ユニークチェック必須。 |
| **Name** | Text Input | 必須。最大30文字。 |
| **Category** | Select | 既存カテゴリから選択。`custom` も可。 |
| **Color** | Color Picker | プリセット色(Tailwindカラーパレット相当) + カスタムHEX入力。 |
| **Summary** | Text Input | 必須。最大100文字。カード上に表示される説明。 |
| **Focus Areas** | Tag Input | Enterキーで追加。最大5つ。各タグ最大15文字。 |
| **Target Model** | Select (Grouped) | プロバイダーごとにグループ化されたモデルリスト。フォーマットは `providerId:modelId`。先頭に「Default (Inherit from Global)」オプションを配置。 |

#### タブ2: Behavior (振る舞い・AI設定)
| UI要素 | タイプ | バリデーション・仕様 |
|:---|:---|:---|
| **Execution Mode** | Select | `builtIn` の場合はDisabled(変更不可)。動作エンジンの根幹となるため、各モードの説明テキストを脇に表示する。 |
| **Delegates To** | Multi-Select | 自分が委譲できる他のエージェントIDを選択。自分自身はリストから除外。無効(`enabled: false`)なエージェントは選択可だが警告アイコンを表示。 |
| **System Prompt** | Monaco Editor | Markdownシンタックスハイライト。行番号表示あり。**必ずFULL Versionのプロンプトが表示・編集されること**。 |
| **Reset Prompt** | Button | `builtIn` の場合のみ表示。プロンプトを工場出荷時（FULL Versionの初期値）に戻す。 |

---

## 4. ビジネスロジックと状態管理 (Business Logic & State)

### 4.1 制約と保護ロジック
1. **組み込みエージェントの保護**:
   - `builtIn: true` のプロファイルは削除アクション自体をUI上で非表示（またはDisabled）にする。
   - `id` および `executionMode` フィールドはロックされる。
2. **モデルフォールバックの解決順序**:
   エージェントが呼び出された際、以下の順序でLLMを決定する。
   1. `profile.model` (エージェント個別設定)
   2. `config.default_provider_id` + `config.default_model_id`
   3. プロバイダーが持つ最初のモデル
3. **無効化(Disabled)の波及効果**:
   - エージェントAが「無効(OFF)」にされた場合、エージェントBの `delegatesTo` にAが含まれていても、プロンプト合成時に**Aを委譲先リストから除外してLLMに渡す**。これにより「LLMが存在しない/無効なエージェントを呼ぼうとしてエラーになる」ことを防ぐ。

### 4.2 Handoff (委譲) パケットのプロンプト注入
UIで `delegatesTo` を設定した場合、バックエンドはエージェント起動時（`spawnTask`）に、元の `prompt` の末尾に以下のテキストを**動的に合成**してLLMに渡す。
*(※ユーザーが直接プロンプトに書かなくても、UIの設定に従って注入される仕組み)*

```text
# DELEGATION AUTHORIZATION
You are authorized to delegate tasks to the following specialists using the Task tool:
- designer: Shapes flows, interaction details, and visual direction.
- developer: Implements changes, validates them, and keeps technical debt contained.
(※ delegatesTo に設定されたエージェントの name と summary を自動で列挙)
```

### 4.3 ライブ同期
- UIでの変更（保存）は即座にバックエンドの `config.json` または `agent_profiles` テーブルに反映される。
- 現行実装では WebSocket ブロードキャストは未実装。クライアントは API 再取得で最新状態を反映する。

---

## 5. エラーハンドリングとエッジケース (Error Handling)

1. **循環委譲 (Circular Delegation) の緩和**:
   - A → B → A のような呼び出しは許可される（PMとDeveloperが対話するケースなどがあるため）。ただし、無限ループを防ぐため、バックエンドの `agent_missions` ループ制御側で「Max Depth（最大ネスト数: デフォルト10）」を設け、これを超えた場合はTaskツールが自動的にエラー（強制完了）を返す仕様とする。
2. **実行中のエージェントの無効化/削除**:
   - 削除・無効化を行おうとしたエージェントが、現在進行中の `agent_runs` (status: running) を持っている場合、モーダルを表示して警告する：「This agent is currently running a task. Disabling it will terminate the active task. Proceed?」
3. **フォームの未保存の変更**:
   - モーダルで内容を変更したまま「Cancel」や枠外クリックで閉じようとした場合、「You have unsaved changes. Discard?」の確認ダイアログを出す。

---

## 6. API エンドポイント詳細 (API Endpoints Details)

エンドポイントは `/api/settings/agents` プレフィックスを使用する。

### 6.1 `GET /api/settings/agents`
- **Response**: `AgentsConfig` オブジェクト全体を返す。

### 6.2 `GET /api/settings/agents/profiles/:id`
- **Response**: 指定 ID の `AgentProfile` を返す。存在しない場合は `404 Not Found`。

### 6.3 `PUT /api/settings/agents`
- **Request**: `{ enabled: boolean, allowSubagentDelegation: boolean }`
- **Description**: グローバルトグルの更新。

### 6.4 `POST /api/settings/agents/profiles`
- **Request**: `Omit<AgentProfile, "builtIn">` (builtInはバックエンドで強制的にfalse)
- **Response**: `201 Created` / `400 Bad Request` (バリデーションエラー) / `409 Conflict` (ID重複時)

### 6.5 `PUT /api/settings/agents/profiles/:id`
- **Request**: `Partial<AgentProfile>`
- **Description**: `builtIn: true` のエージェントに対して `id`, `executionMode` を変更しようとした場合は `403 Forbidden` を返す。

### 6.6 `DELETE /api/settings/agents/profiles/:id`
- **Description**: カスタムエージェントの削除。`builtIn: true` の場合は `403 Forbidden` を返す。関連する `agent_runs` 履歴は残すが、以後の呼び出しは不可となる。

### 6.7 `POST /api/settings/agents/profiles/:id/reset`
- **Description**: 組み込みエージェントのプロンプトと設定を、初期のシードデータ状態（FULL Versionプロンプト）に戻す。
