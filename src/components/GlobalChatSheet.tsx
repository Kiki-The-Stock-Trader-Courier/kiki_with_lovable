import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface GlobalChatSheetProps {
  onClose: () => void;
}

export default function GlobalChatSheet({ onClose }: GlobalChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingGoalChoice, setAwaitingGoalChoice] = useState(false);
  const { walk, setGoalSteps } = useUserData();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMessages([INITIAL_MESSAGE]);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, []);

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
    const requested = numberMatch ? Number(numberMatch[1]) : Number.NaN;

    if (awaitingGoalChoice) {
      let goalReply: string;
      if (lower === "1" || /평균|최근 3일|자동/.test(lower)) {
        setGoalSteps(avg3);
        setAwaitingGoalChoice(false);
        goalReply = `최근 3일 걸음 평균(${avg3.toLocaleString()}보)으로 목표를 변경했어요.\n현재 목표: ${avg3.toLocaleString()}보`;
      } else if (lower === "2") {
        goalReply = "좋아요. 원하는 목표 걸음 수를 숫자로 입력해 주세요.\n예: 7000";
      } else if (Number.isFinite(requested) && requested >= 1000 && requested <= 50000) {
        const nextGoal = Math.round(requested);
        setGoalSteps(nextGoal);
        setAwaitingGoalChoice(false);
        goalReply = `요청하신 대로 걸음 목표를 ${nextGoal.toLocaleString()}보로 변경했어요.`;
      } else {
        goalReply = `입력을 이해하지 못했어요.\n\n다시 선택해 주세요:\n1) 평균으로 변경 (${avg3.toLocaleString()}보)\n2) 직접 입력 (예: 7000보)`;
      }
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: goalReply, timestamp: new Date() },
      ]);
      return;
    }

    const asksGoal = /목표|업데이트|변경|바꿔|설정/.test(lower);
    if (asksGoal) {
      let goalReply: string;
      if (/평균|최근 3일|자동/.test(lower)) {
        setGoalSteps(avg3);
        setAwaitingGoalChoice(false);
        goalReply = `최근 3일 걸음 평균(${avg3.toLocaleString()}보)으로 목표를 변경했어요.\n현재 목표: ${avg3.toLocaleString()}보`;
      } else if (Number.isFinite(requested) && requested >= 1000 && requested <= 50000) {
        const nextGoal = Math.round(requested);
        setGoalSteps(nextGoal);
        setAwaitingGoalChoice(false);
        goalReply = `요청하신 대로 걸음 목표를 ${nextGoal.toLocaleString()}보로 변경했어요.`;
      } else {
        setAwaitingGoalChoice(true);
        goalReply = `현재 목표: ${walk.goalSteps.toLocaleString()}보\n최근 3일 평균: ${avg3.toLocaleString()}보\n\n원하는 방식으로 답장해 주세요:\n1) 평균으로 바꿔줘\n2) 7000보로 변경`;
      }
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: goalReply, timestamp: new Date() },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const reply = await askGlobalAssistant(historyAfterUser);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: reply, timestamp: new Date() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "일시적으로 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-slide-up flex h-full flex-col rounded-t-3xl bg-card shadow-2xl">
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
      <header className="flex items-center justify-between border-b border-border/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">키키</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60"
          aria-label="챗봇 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 no-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs ${
                msg.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md border border-border/50 bg-background text-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && <p className="text-xs text-muted-foreground">생각하는 중...</p>}
      </div>

      <div className="border-t border-border/80 p-3">
        <div className="no-scrollbar mb-2 flex flex-nowrap gap-1.5 overflow-x-auto whitespace-nowrap snap-x snap-mandatory">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => sendMessage(action)}
              className="shrink-0 snap-start rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {action}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요"
            className="min-h-[40px] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs"
            aria-label="메시지 입력"
          />
          <Button type="submit" size="icon" className="h-10 w-10 rounded-xl" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
