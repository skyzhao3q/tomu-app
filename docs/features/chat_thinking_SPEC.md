# 【実装指示書】TOMUアプリへの「思考過程 (Thinking Process)」機能の移植・完全版

## 1. 概要 (Overview)
この仕様書は、チャットアプリ「TOMU」において、LLMの推論・思考過程（Reasoning）をユーザーUIに表示するための実装ガイドです。
OpenAI o1/o3系やAnthropicの `<think>` タグなどの思考プロセスを、本文とは切り離してアコーディオン（折りたたみ）UIで表示する機能を実装してください。
Almaの実装（DBアーキテクチャやPartsベースのメッセーシスキーマ）を深く調査し、UIの開閉ロジック、タイマー計算、ストリーミング中のPulse（点滅）アニメーションまで完全に再現する内容となっています。

## 2. 必要なライブラリ・パッケージ (Dependencies)
```bash
# UIのアクセシビリティとアニメーションの基盤 (Radix UI)
npm install @radix-ui/react-collapsible @radix-ui/react-tooltip

# アイコン
npm install lucide-react

# スタイル管理
npm install clsx tailwind-merge

# マークダウンレンダリング
npm install react-markdown
```

## 3. データモデルとアーキテクチャ (Data Model & Architecture)
思考過程を正しく管理・描画するためには、Almaが採用している**「Parts（部分チャンク）ベースのアーキテクチャ」**をTOMUのデータモデルに統合する必要があります。

### 3.1. DBスキーマとデータの流れ (Database & Session)
TOMUのデータベース（SQLite等）におけるセッション・メッセージ管理は、以下のリレーションを想定します。

1. **`chat_threads` テーブル**
   - チャットのセッション（スレッド）を管理します。
2. **`chat_messages` テーブル**
   - スレッドに紐づく個々の発言を管理します。
   - **重要**: メッセージ本文を単なるStringカラムではなく、`message`カラム（JSON型/TEXT型）として保持し、その中に `parts` 配列を格納します。

### 3.2. メッセージとPartsの型定義 (TypeScript Schema)
メッセージ内のすべての要素（通常のテキスト、画像、ツール実行履歴、そして**思考過程**）は、順序を保持したまま `parts` 配列に格納されます。

```typescript
// 1つのメッセージを表すルートスキーマ (chat_messages テーブルに保存される内容)
export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];  // テキストや思考過程が混在する配列
  metadata?: MessageMetadata;
  createdAt: number;
}

// メッセージメタデータ
export interface MessageMetadata {
  reasoningDurationMs?: number; // 思考時間（APIからの実測値が取れる場合用）
  [key: string]: any;
}

// 各PartのUnion型
export type MessagePart = TextPart | ReasoningPart | FilePart | ToolCallPart;

// 思考プロセス用の専用スキーマ
export interface ReasoningPart {
  type: 'reasoning';
  text: string;               // 思考内容（ストリーミング中はここに随時文字が追記される）
  state: 'streaming' | 'done';// 現在のステータス
}

// 通常のテキスト用のスキーマ
export interface TextPart {
  type: 'text';
  text: string;
  state?: 'streaming' | 'done';
}
```

**ストリーミング時の挙動**: 
LLMから思考プロセスのチャンク（差分）が送られてきた場合、UI側または状態管理（Zustand / Redux等）において、`parts` 配列の末尾にある `type: 'reasoning'` の `text` フィールドに文字を連結（Append）していきます。思考が終わり、通常の回答テキストが始まったら、新しく `type: 'text'` のPartを配列に追加してそちらに文字を連結します。


## 4. UIコンポーネント実装詳細 (UI Components)
以下のコンポーネントを `components/ui/reasoning.tsx` に実装してください。

### 4.1 Context (状態の共有)
Reasoning内の各コンポーネントで状態を共有するためのContextを作成します。

```tsx
import { createContext, useContext, useEffect, useState, useRef } from 'react';

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration?: number;
}
const ReasoningContext = createContext<ReasoningContextValue | null>(null);
const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) throw new Error("Reasoning components must be used within Reasoning");
  return context;
};
```

### 4.2 `<Reasoning>` (Root Wrapper & 状態管理)
*   **役割**: 開閉状態の管理、思考時間のローカル計算、ストリーミング完了時の自動クローズ制御を行います。
*   **ロジック**:
    1.  `isStreaming` が `true` の時、`startTime` を記録しタイマーを開始。
    2.  `isStreaming` が `true` になったら、**強制的に `isOpen` を `true` に** して中身を見せる。
    3.  `isStreaming` が `false` に切り替わった瞬間（完了時）、`startTime` と現在時刻の差分から `duration`（秒数）を計算。
    4.  完了後、`setTimeout` (例: `1000ms`) を使って**自動的にアコーディオンを閉じる** (`isOpen` を `false` に)。

```tsx
// 擬似コード
export const Reasoning = ({ isStreaming, duration: initialDuration, children, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [duration, setDuration] = useState(initialDuration);
  const [startTime, setStartTime] = useState<number | null>(null);
  const wasStreamingRef = useRef(isStreaming);

  useEffect(() => {
    if (isStreaming && !startTime) setStartTime(Date.now());
    else if (!isStreaming && startTime) {
      setDuration(Math.round((Date.now() - startTime) / 1000));
      setStartTime(null);
    }
  }, [isStreaming, startTime]);

  useEffect(() => { if (isStreaming && !isOpen) setIsOpen(true); }, [isStreaming]);

  useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = isStreaming;
    if (!isStreaming && wasStreaming && isOpen) {
      const timer = setTimeout(() => setIsOpen(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isOpen]);

  return (
    <ReasoningContext.Provider value={{ isStreaming, isOpen, setIsOpen, duration }}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  );
};
```

### 4.3 `<ReasoningTrigger>` (開閉ボタン)
*   **役割**: ヘッダーのボタン。「思考中」アニメーションや完了後の時間を表示します。
*   **スタイル構成**:
    *   `lucide-react` の `Brain` または `ChevronDown` アイコン。
    *   ボタン要素全体に `hover:bg-muted` のようなホバー効果と丸みを持たせる。

```tsx
import { CollapsibleTrigger } from '@radix-ui/react-collapsible';
import { Brain } from 'lucide-react';

export const ReasoningTrigger = () => {
  const { isStreaming, isOpen, duration } = useReasoning();
  
  return (
    <CollapsibleTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted/80 text-muted-foreground transition-colors text-xs font-medium">
      {isStreaming ? (
        <>
          <Brain className="w-3.5 h-3.5 animate-pulse text-blue-500" />
          <span className="animate-pulse">思考中...</span>
        </>
      ) : (
        <>
          <Brain className="w-3.5 h-3.5" />
          <span>思考プロセス {duration ? `(${duration}秒)` : ''}</span>
        </>
      )}
    </CollapsibleTrigger>
  );
};
```

### 4.4 `<ReasoningContent>` (思考内容の本文)
*   **役割**: 思考プロセスのテキスト本体を描画。
*   **スタイル構成**:
    *   左側にボーダーを引く: `border-l-2 border-gray-300/60` (ダークモード対応なら `border-border/60` 等)
    *   インデントと文字サイズ調整: `pl-3 mt-4 text-sm leading-6 text-muted-foreground`
    *   Radix の開閉アニメーション: `data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-2`

```tsx
import { CollapsibleContent } from '@radix-ui/react-collapsible';

export const ReasoningContent = ({ children, rawContent = false }) => {
  return (
    <CollapsibleContent className="mt-3 text-sm text-muted-foreground border-l-2 border-muted pl-4 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
      {rawContent ? children : <Markdown>{children}</Markdown>}
    </CollapsibleContent>
  );
};
```

## 5. チャットメッセージへの統合手順 (Integration)

TOMUのメッセージレンダリング部分（例: `ChatMessage.tsx`）で、`parts` 配列をループして描画するロジックに以下の分岐を追加してください。

```tsx
{message.parts.map((part, index) => {
  if (part.type === 'reasoning') {
    return (
      <Reasoning 
        key={`reasoning-${index}`}
        isStreaming={part.state === 'streaming'} 
        duration={message.metadata?.reasoningDurationMs}
      >
        <ReasoningTrigger />
        <ReasoningContent>
          {part.text}
        </ReasoningContent>
      </Reasoning>
    );
  }
  
  if (part.type === 'text') {
    return <Markdown key={`text-${index}`}>{part.text}</Markdown>;
  }
  
  // ... その他のParts
})}
```

### 重要な振る舞いのポイント
1.  **AIが思考を開始**すると、UIに自動的に「思考中... (Pulseアニメーション)」のボタンが表示され、アコーディオンが**自動で開いて**中身がストリーミング描画されます。
2.  **思考が完了**すると、思考秒数が計算されてラベルが「思考プロセス (12秒)」等に変わり、1秒後に**自動的にアコーディオンが閉じます**。
3.  ユーザーは、閉じた後でもボタンをクリックすれば過去の思考プロセスを再度閲覧できます。
