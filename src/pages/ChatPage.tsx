import { useState, useRef, useEffect } from "react";
import { Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import type { ChatMessage } from "@/types/stock";
import { askGlobalAssistant } from "@/lib/openaiChat";
import { useUserData } from "@/hooks/useUserData";

const QUICK_ACTIONS = [
  "500보로 살 수 있는 주식은?",
  "근처 삼성전자 정보 알려줘",
  "오늘의 주식 퀴즈!",
  "걸음 목표 업데이트해줘",
];

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요! 워키 포인트의 든든한 정보통, 키키입니다! 제가 주가 예측부터 기업 정보까지 싹~ 다 알려드릴 테니까, 여러분은 즐겁게 걷기만 하세요! 참, 주식 퀴즈도 준비되어 있는데... 혹시 요즘 뉴스 안 보고 오신 건 아니겠죠?",
  timestamp: new Date(),
};

const RECENT_3DAY_STEPS = [4880, 5720, 3247];

/** 채팅 진입 시 최초 인사는 1초 후 표시 (즉시 노출 방지) */
const GREETING_DELAY_MS = 1000;

const ChatPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingGoalChoice, setAwaitingGoalChoice] = useState(false);
  const { walk, setGoalSteps } = useUserData();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMessages((prev) => (prev.length === 0 ? [INITIAL_MESSAGE] : prev));
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

    const avg3 =
      Math.round(RECENT_3DAY_STEPS.reduce((sum, v) => sum + v, 0) / RECENT_3DAY_STEPS.length / 10) * 10;
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
    <div className="mx-auto flex h-[100dvh] max-w-lg flex-col bg-background" data-testid="chat-screen">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-card/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
            <Bot className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold tracking-tight text-foreground">키키</h1>
            <p className="text-xs text-muted-foreground">종목 정보 · 퀴즈 · 걸음 설정</p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 pb-4 no-scrollbar">
        <div className="mx-auto max-w-lg space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                  msg.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border/50 bg-card text-card-foreground"
                }`}
              >
                {msg.content}
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

      <div className="border-t border-border/80 bg-card/95 px-4 pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-card/85">
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-0.5 pl-0.5">
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

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 pb-[calc(env(safe-area-inset-bottom,0px)+72px)]"
        >
          <input
            id="chat-page-message"
            name="chatMessage"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="궁금한 종목이나 걸음 설정을 물어보세요"
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

      <BottomNav />
    </div>
  );
};

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

export default ChatPage;
