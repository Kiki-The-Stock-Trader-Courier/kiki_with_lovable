import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/types/stock";
import { ChatAssistantMarkdown } from "@/components/ChatAssistantMarkdown";
import { askGlobalAssistant } from "@/lib/openaiChat";
import { useUserData } from "@/hooks/useUserData";

const QUICK_ACTIONS = [
  "현재 목표 걸음 수는?",
  "100보당 몇 포인트 적립돼?",
  "최근 3일치 걸음 수 평균 내줘.",
];

const INITIAL_MESSAGE_WALK_GOAL: ChatMessage = {
  id: "welcome-walk-goal",
  role: "assistant",
  content:
    "안녕하세요! 워키 포인트의 페이스 메이커, 키키입니다! 내 페이스에 맞게 목표 걸음 수를 변경해 보세요. 제가 도와드릴게요!",
  timestamp: new Date(),
};

const RECENT_3DAY_STEPS = [4880, 5720, 3247];

const GREETING_DELAY_MS = 1000;

interface WalkGoalChatSheetProps {
  onClose: () => void;
}

export default function WalkGoalChatSheet({ onClose }: WalkGoalChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingGoalChoice, setAwaitingGoalChoice] = useState(false);
  const { walk, setGoalSteps } = useUserData();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMessages((prev) => (prev.length === 0 ? [INITIAL_MESSAGE_WALK_GOAL] : prev));
    }, GREETING_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    const historyAfterUser = [...messages, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const trimmed = text.trim();
    const avg3 =
      Math.round(RECENT_3DAY_STEPS.reduce((sum, v) => sum + v, 0) / RECENT_3DAY_STEPS.length / 10) * 10;

    if (trimmed === "현재 목표 걸음 수는?") {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `지금 설정된 목표는 **${walk.goalSteps.toLocaleString("ko-KR")}보**예요.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      return;
    }

    if (trimmed === "100보당 몇 포인트 적립돼?") {
      const per100 = walk.cashPerStep * 100;
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `걸음당 ${walk.cashPerStep}포인트이므로, 100보당 **${per100.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}포인트**가 적립돼요.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      return;
    }

    if (trimmed === "최근 3일치 걸음 수 평균 내줘.") {
      const list = RECENT_3DAY_STEPS.map((s) => `${s.toLocaleString("ko-KR")}보`).join(", ");
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `최근 3일 걸음은 ${list}이에요.\n\n평균은 **${avg3.toLocaleString("ko-KR")}보**예요.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      return;
    }

    const normalized = text.replace(/,/g, "").trim();
    const lower = normalized.toLowerCase();
    const numberMatch = normalized.match(/(\d{3,6})/);
    const requested = numberMatch ? Number(numberMatch[1]) : NaN;

    if (awaitingGoalChoice) {
      let goalReply: string;

      if (lower === "1" || /평균|최근 3일|자동/.test(lower)) {
        setGoalSteps(avg3);
        setAwaitingGoalChoice(false);
        goalReply = `최근 3일 걸음 평균(${avg3.toLocaleString()}보)으로 목표를 변경했어요.\n\n현재 목표: ${avg3.toLocaleString()}보`;
      } else if (lower === "2") {
        goalReply = "좋아요. 원하는 목표 걸음 수를 숫자로 입력해 주세요.\n예: 7000";
      } else if (Number.isFinite(requested) && requested >= 1000 && requested <= 50000) {
        const nextGoal = Math.round(requested);
        setGoalSteps(nextGoal);
        setAwaitingGoalChoice(false);
        goalReply = `요청하신 대로 걸음 목표를 ${nextGoal.toLocaleString()}보로 변경했어요.`;
      } else {
        goalReply = [
          "입력을 이해하지 못했어요.",
          "",
          "다시 선택해 주세요:",
          `1) 평균으로 변경 (${avg3.toLocaleString()}보)`,
          `2) 직접 입력 (예: 7000보)`,
        ].join("\n");
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: goalReply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      return;
    }

    const asksGoal = /목표|업데이트|변경|바꿔|설정/.test(lower);
    if (asksGoal) {
      let goalReply: string;
      if (/평균|최근 3일|자동/.test(lower)) {
        setGoalSteps(avg3);
        setAwaitingGoalChoice(false);
        goalReply = `최근 3일 걸음 평균(${avg3.toLocaleString()}보)으로 목표를 변경했어요.\n\n현재 목표: ${avg3.toLocaleString()}보`;
      } else if (Number.isFinite(requested) && requested >= 1000 && requested <= 50000) {
        const nextGoal = Math.round(requested);
        setGoalSteps(nextGoal);
        setAwaitingGoalChoice(false);
        goalReply = `요청하신 대로 걸음 목표를 ${nextGoal.toLocaleString()}보로 변경했어요.`;
      } else {
        setAwaitingGoalChoice(true);
        goalReply = [
          `현재 목표: ${walk.goalSteps.toLocaleString()}보`,
          `최근 3일 평균: ${avg3.toLocaleString()}보`,
          "",
          "원하는 방식으로 답장해 주세요:",
          `1) "평균으로 바꿔줘" (최근 3일 평균 적용)`,
          `2) "7000보로 변경" (원하는 수치 직접 입력)`,
        ].join("\n");
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: goalReply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      return;
    }

    setIsLoading(true);

    try {
      const reply = await askGlobalAssistant(historyAfterUser);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `${getMockResponse(text)}\n\n— OpenAI 연결 없이 데모 답변이에요. .env에 OPENAI_API_KEY를 설정해 보세요.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-t-3xl bg-background shadow-2xl">
      <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 pb-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-card ring-1 ring-border/60">
              <img
                src="/kiki-chat-avatar.png"
                alt="키키 아바타"
                width={32}
                height={32}
                decoding="async"
                draggable={false}
                className="block h-full w-full object-cover object-center"
              />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold tracking-tight text-foreground">키키</h2>
              <p className="text-xs text-muted-foreground">목표 걸음 설정</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60"
            onClick={onClose}
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 pb-4 [overflow-anchor:none]"
      >
        <div className="mx-auto max-w-lg space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "whitespace-pre-wrap rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border/50 bg-card text-card-foreground"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ChatAssistantMarkdown content={msg.content} className="text-sm leading-relaxed" />
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
                <span className="text-sm text-muted-foreground">생각하는 중...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/80 bg-background/95 px-4 pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="mb-3 w-full overflow-x-auto overflow-y-hidden pb-0.5 pl-0.5 [touch-action:pan-x]">
          <div className="inline-flex min-w-max items-center gap-2 pr-1">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => void sendMessage(action)}
                className="min-h-[36px] shrink-0 rounded-full border border-border/70 bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 active:scale-[0.98]"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom,0px)+72px)]"
        >
          <input
            id="walk-goal-chat-message"
            name="walkGoalChatMessage"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="목표 설정 관련해 궁금한 점을 물어보세요."
            className="min-h-[48px] flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="메시지 입력"
          />
          <Button
            type="submit"
            size="icon"
            className="h-12 w-12 shrink-0 rounded-xl"
            disabled={!input.trim() || isLoading}
            aria-label="메시지 전송"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function getMockResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("500보") || lower.includes("걸음")) {
    return "500보 = 약 250원이에요! 💰\n\n현재 반경 500m 내에서 250원 이하로 매수 가능한 종목은 없지만, 1,000보를 더 걸으면 삼성전자 1주(72,400원)에 한 발짝 더 가까워져요.\n\n목표를 5,000보로 올려볼까요?";
  }
  if (lower.includes("삼성")) {
    return "📊 삼성전자 (005930)\n\n• 현재가: 72,400원 (+1.2%)\n• 업종: 반도체\n• 시가총액: 431조원\n\n글로벌 메모리 반도체 1위, 스마트폰·디스플레이 사업도 영위하고 있어요. 최근 AI 반도체 수주 기대감으로 상승세입니다.";
  }
  if (lower.includes("퀴즈")) {
    return "🧠 주식 퀴즈!\n\nQ: 대한민국에서 시가총액이 가장 큰 기업은?\n\n1️⃣ SK하이닉스\n2️⃣ 삼성전자\n3️⃣ NAVER\n4️⃣ LG에너지솔루션\n\n번호로 답해보세요!";
  }
  if (lower.includes("업데이트") || lower.includes("목표")) {
    return "현재 목표: 5,000보\n오늘 걸음: 3,247보 (65% 달성)\n\n목표를 변경하시겠어요?\n• 3,000보 → 일일 약 1,500원\n• 5,000보 → 일일 약 2,500원\n• 10,000보 → 일일 약 5,000원\n\n원하는 걸음 수를 알려주세요!";
  }
  return "좋은 질문이에요! 🙌\n\n현재 반경 500m 내에 12개 종목이 있어요. 지도로 돌아가서 핀을 눌러보시면 기업 정보를 확인할 수 있어요.\n\n다른 궁금한 점이 있으시면 말씀해주세요!";
}
