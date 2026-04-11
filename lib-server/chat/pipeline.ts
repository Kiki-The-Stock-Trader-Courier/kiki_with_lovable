import type OpenAI from "openai";
import { awaitLangSmithPendingTraces, getOpenAIClient } from "../openaiClient.js";
import { mergeStockAssistWithDdg } from "../stockChatAssist.js";
import { CHAT_UNSAFE_FIXED_REPLY, getChatPolicy } from "./policy.js";
import { inferComplexity, lastUserContent, routeChatIntent } from "./router.js";
import type { ChatComplexity, ChatIntent } from "./types.js";

export type ChatRequestBody = {
  messages?: { role: string; content: string }[];
  model?: string;
  max_tokens?: number;
  stockAssist?: { name: string; ticker: string; sector?: string };
};

export type PipelineMeta = {
  intent: ChatIntent | "legacy";
  complexity: ChatComplexity;
  model: string;
  needsRetrieval: boolean;
  routerEnabled: boolean;
};

export type PipelineResult =
  | { kind: "completion"; completion: OpenAI.Chat.ChatCompletion; meta: PipelineMeta }
  | { kind: "fixed"; content: string; meta: PipelineMeta };

function isIntentRouterEnabled(): boolean {
  const v = process.env.CHAT_INTENT_ROUTER?.trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "off";
}

async function runLegacyPipeline(body: ChatRequestBody): Promise<PipelineResult> {
  const messages = body.messages ?? [];
  const stockAssist = body.stockAssist;
  let outbound = messages;
  if (stockAssist?.name && stockAssist?.ticker) {
    try {
      outbound = await mergeStockAssistWithDdg(messages, stockAssist);
    } catch (e) {
      console.warn("[chat/pipeline] legacy merge failed:", e);
    }
  }
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create(
    {
      model: body.model ?? "gpt-4o-mini",
      messages: outbound as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: body.max_tokens ?? 1100,
    },
    {
      langsmithExtra: {
        name: "chat-completions",
        metadata: {
          route: "api/chat",
          stockAssist: stockAssist ? "yes" : "no",
          intent: "legacy",
        },
        tags: [stockAssist ? "stock-sheet-chat" : "global-chat", "intent-legacy"],
      },
    } as Record<string, unknown>,
  );
  return {
    kind: "completion",
    completion,
    meta: {
      intent: "legacy",
      complexity: "medium",
      model: body.model ?? "gpt-4o-mini",
      needsRetrieval: !!(stockAssist?.name && stockAssist?.ticker),
      routerEnabled: false,
    },
  };
}

/**
 * 라우터 → 정책 → (조건부) RAG 병합 → OpenAI 생성
 */
export async function runChatPipeline(body: ChatRequestBody): Promise<PipelineResult> {
  if (!isIntentRouterEnabled()) {
    return runLegacyPipeline(body);
  }

  const messages = body.messages ?? [];
  const stockAssist = body.stockAssist;
  const hasStockAssist = !!(stockAssist?.name && stockAssist?.ticker);

  const lastUser = lastUserContent(messages);
  const intent = routeChatIntent(lastUser, hasStockAssist);
  const complexity = inferComplexity(lastUser);

  if (intent === "unsafe") {
    return {
      kind: "fixed",
      content: CHAT_UNSAFE_FIXED_REPLY,
      meta: {
        intent: "unsafe",
        complexity,
        model: "none",
        needsRetrieval: false,
        routerEnabled: true,
      },
    };
  }

  const policy = getChatPolicy(intent, complexity, hasStockAssist);

  let outbound = messages;
  if (hasStockAssist && stockAssist && policy.needsRetrieval) {
    try {
      outbound = await mergeStockAssistWithDdg(messages, stockAssist);
    } catch (e) {
      console.warn("[chat/pipeline] mergeStockAssistWithDdg failed:", e);
    }
  }

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create(
    {
      model: policy.model,
      messages: outbound as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: policy.maxTokens,
      temperature: policy.temperature,
    },
    {
      langsmithExtra: {
        name: "chat-completions",
        metadata: {
          route: "api/chat",
          stockAssist: hasStockAssist ? "yes" : "no",
          intent,
          complexity,
        },
        tags: [hasStockAssist ? "stock-sheet-chat" : "global-chat", `intent-${intent}`],
      },
    } as Record<string, unknown>,
  );

  return {
    kind: "completion",
    completion,
    meta: {
      intent,
      complexity,
      model: policy.model,
      needsRetrieval: policy.needsRetrieval,
      routerEnabled: true,
    },
  };
}
