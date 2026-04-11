import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage, StockPin } from "@/types/stock";
import { askStockAssistant } from "@/lib/openaiChat";
import { getStockSheetChatReply } from "@/lib/stockSheetChatMock";
import { ChatAssistantMarkdown } from "@/components/ChatAssistantMarkdown";

const QUICK_PROMPTS = [
  "이 회사는 뭐 하는 곳이야?",
  "지금 주가는 어떤 의미야?",
  "투자할 때 주의할 점은?",
];

function buildWelcomeMessage(stock: StockPin): ChatMessage {
  return {
    id: `welcome-${stock.id}`,
    role: "assistant",
    content: `${stock.name}(${stock.ticker})에 대해 물어보세요.`,
    timestamp: new Date(),
  };
}

interface StockSheetChatProps {
  stock: StockPin;
  isScrapped: boolean;
  onToggleScrap: () => void;
}

/**
 * 사용자의 자연어에서 "스크랩 추가/해제/상태 확인" 의도를 간단 규칙으로 먼저 처리합니다.
 * - 장점: OpenAI 호출 전 로컬에서 즉시 반응 가능
 * - 목적: "이 종목 스크랩 목록에 추가해줘" 같은 요청을 항상 동작시키기 위함
 */
function detectScrapIntent(text: string): "add" | "remove" | "status" | null {
  const t = text.toLowerCase().replace(/\s+/g, "");
  const asksScrap = /스크랩|북마크|찜|관심/.test(t);
  if (!asksScrap) return null;

  if (/추가|저장|담아|등록|해줘|넣어/.test(t)) return "add";
  if (/해제|삭제|빼|제거|취소/.test(t)) return "remove";
  return "status";
}

export default function StockSheetChat({ stock, isScrapped, onToggleScrap }: StockSheetChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage(stock)]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /**
     * 기록 초기화는 "다른 종목으로 바뀔 때"만 수행.
     * 시세 갱신(price/changePercent)으로 stock 객체가 새로 만들어져도
     * 동일 종목이면 대화 기록을 유지해야 함.
     */
    setMessages([buildWelcomeMessage(stock)]);
    setInput("");
    setIsLoading(false);
  }, [stock.id, stock.ticker]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    const historyAfterUser = [...messages, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    /** 스크랩 명령은 OpenAI 호출 없이 우선 처리 */
    const scrapIntent = detectScrapIntent(trimmed);
    if (scrapIntent) {
      let reply = "";
      if (scrapIntent === "add") {
        if (isScrapped) {
          reply = `이미 ${stock.name}(${stock.ticker})은(는) 스크랩 목록에 있어요.`;
        } else {
          onToggleScrap();
          reply = `${stock.name}(${stock.ticker})을(를) 스크랩 목록에 추가했어요.`;
        }
      } else if (scrapIntent === "remove") {
        if (isScrapped) {
          onToggleScrap();
          reply = `${stock.name}(${stock.ticker}) 스크랩을 해제했어요.`;
        } else {
          reply = `현재 ${stock.name}(${stock.ticker})은(는) 스크랩 목록에 없어요.`;
        }
      } else {
        reply = isScrapped
          ? `${stock.name}(${stock.ticker})은(는) 현재 스크랩되어 있어요.`
          : `${stock.name}(${stock.ticker})은(는) 아직 스크랩되지 않았어요.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setIsLoading(true);

    try {
      const reply = await askStockAssistant(stock, historyAfterUser);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : "알 수 없는 오류";
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: [
            getStockSheetChatReply(stock, trimmed),
            "",
            "— 위는 규칙 기반 보조 답변이에요.",
            `AI 연결 실패: ${detail}`,
            "· 운영: Vercel(또는 API를 호스팅하는 곳)에 OPENAI_API_KEY 를 설정하세요.",
            "· 로컬: 프로젝트 루트 .env 에 OPENAI_API_KEY=...",
            "· COMPANY_SYNC_TOKEN 은 기업 데이터 동기화 API 전용이며 챗봇과 무관합니다.",
          ].join("\n"),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="mt-2 border-t border-border/80 pt-4"
      data-testid="stock-sheet-chat"
      aria-label="기업 설명 챗봇"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">기업 알아보기</p>
          <p className="text-xs text-muted-foreground">
            이 종목에 대해 질문해 보세요. 답변에 DuckDuckGo 웹 검색 스니펫이 반영될 수 있어요.
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mb-3 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border/50 bg-primary/10 p-3 pr-2"
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "whitespace-pre-wrap bg-primary text-primary-foreground"
                  : "border border-border/50 bg-card text-card-foreground shadow-sm"
              }`}
            >
              {msg.role === "user" ? msg.content : <ChatAssistantMarkdown content={msg.content} />}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card px-3 py-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" aria-hidden />
              답변 중…
            </div>
          </div>
        )}
      </div>

      <div className="no-scrollbar mb-2 w-full overflow-x-auto overflow-y-hidden [touch-action:pan-x]">
        <div className="inline-flex min-w-max items-center gap-1.5 whitespace-nowrap pr-1">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={isLoading}
              className="flex-none whitespace-nowrap rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          id="stock-sheet-chat-message"
          name="stockSheetChatMessage"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 한줄 요약해줘"
          className="min-h-[40px] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="기업 관련 질문 입력"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          disabled={!input.trim() || isLoading}
          aria-label="질문 보내기"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
