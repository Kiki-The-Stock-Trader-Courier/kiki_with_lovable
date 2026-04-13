import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/types/stock";
import { askGlobalAssistant, askStockAssistant } from "@/lib/openaiChat";
import {
  GLOBAL_CHAT_STORAGE_KEY,
  STOCK_SHEET_CHAT_STORAGE_KEY,
  createConversation,
  loadMergedFabConversations,
  parseStockWelcomeFromMessages,
  readStockSheetConversationsFromStorage,
  stockSheetConversationToStockPin,
  subscribeGlobalChatStorageSync,
  summarizeConversationTitle,
  summarizeStockSheetConversationTitle,
  type StoredGlobalConversation,
} from "@/lib/globalChatSheetHistory";
import {
  averageLastNDaysStepsRounded,
  buildAssistantWalkStepsContext,
  buildWalkGoalIntentHint,
} from "@/lib/walkWeeklyStats";
import { useUserData } from "@/hooks/useUserData";
import { useMapQuizSnapshot } from "@/contexts/MapQuizContext";
import { requestHybridQuiz, type HybridQuizQuestion } from "@/lib/quizHybridApi";
import {
  buildQuizHintsFromQuizContext,
  fetchQuizContextForSystemPrompt,
  persistQuizContextExchange,
} from "@/lib/quizContextMemory";
import { useAuth } from "@/contexts/AuthContext";
import { ChatAssistantMarkdown } from "@/components/ChatAssistantMarkdown";
import { resolveStockPinFromMapMessage } from "@/lib/globalChatStockResolve";
import { buildGlobalChatMarketContext } from "@/lib/chatMarketContext";

const QUICK_ACTIONS = [
  "삼성전자에 대해 알려줘",
  "오늘의 주식 퀴즈!",
  "걸음 목표 업데이트해줘",
];

const WELCOME_TEXT =
  "안녕하세요! 워키 포인트의 든든한 정보통, 키키입니다! 제가 주가 예측부터 기업 정보까지 싹~ 다 알려드릴 테니까, 여러분은 즐겁게 걷기만 하세요! 참, 주식 퀴즈도 준비되어 있는데... 혹시 요즘 뉴스 안 보고 오신 건 아니겠죠?";

interface GlobalChatSheetProps {
  onClose: () => void;
}

function buildInitialMessage(): ChatMessage {
  return {
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content: WELCOME_TEXT,
    timestamp: new Date(),
  };
}

function sortQuizChoices(q: HybridQuizQuestion["choices"]) {
  return [...q].sort((a, b) => a.key.localeCompare(b.key));
}

/** 하이브리드 퀴즈: 한 문제씩 표시용 블록 */
function formatQuizBlock(intro: string | null, q: HybridQuizQuestion, idx: number, total: number): string {
  const oc = sortQuizChoices(q.choices);
  const lines = oc.map((c, i) => `${i + 1}) ${c.text}`);
  const head = intro ? `${intro}\n\n` : "";
  return `${head}【문제 ${idx + 1}/${total}】\n${q.prompt}\n\n${lines.join("\n")}\n\n답은 1~4 숫자로 보내 주세요.`;
}

export default function GlobalChatSheet({ onClose }: GlobalChatSheetProps) {
  const [conversations, setConversations] = useState<StoredGlobalConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingGoalChoice, setAwaitingGoalChoice] = useState(false);
  const [animatedWelcomeId, setAnimatedWelcomeId] = useState<string | null>(null);
  const { walk, setGoalSteps, addQuizCash, weeklySteps } = useUserData();
  const { session } = useAuth();
  const ragUserId = session?.user?.id;
  const avg3Recent = useMemo(() => averageLastNDaysStepsRounded(weeklySteps, 3), [weeklySteps]);
  const { snapshot: mapQuizSnapshot } = useMapQuizSnapshot();
  const [quizSession, setQuizSession] = useState<{ intro: string; questions: HybridQuizQuestion[] } | null>(
    null,
  );
  const [quizIndex, setQuizIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );
  const activeMessages = activeConversation?.messages ?? [];

  const appendAssistantMessage = (content: string) => {
    if (!activeConversationId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              messages: [
                ...c.messages,
                { id: (Date.now() + 1).toString(), role: "assistant", content, timestamp: new Date() },
              ],
              updatedAt: Date.now(),
            }
          : c,
      ),
    );
  };

  const syncConversationsFromStorage = useCallback(() => {
    try {
      const next = loadMergedFabConversations();
      setConversations(next);
      setActiveConversationId((id) => (next.some((c) => c.id === id) ? id : next[0].id));
    } catch {
      const initial = createConversation();
      setConversations([initial]);
      setActiveConversationId(initial.id);
    }
  }, []);

  useEffect(() => {
    try {
      const next = loadMergedFabConversations();
      setConversations(next);
      setActiveConversationId(next[0]?.id ?? "");
    } catch {
      const initial = createConversation();
      setConversations([initial]);
      setActiveConversationId(initial.id);
    }
  }, []);

  useEffect(() => {
    return subscribeGlobalChatStorageSync(() => {
      syncConversationsFromStorage();
    });
  }, [syncConversationsFromStorage]);

  useEffect(() => {
    if (conversations.length === 0) return;
    const globalOnly = conversations.filter((c) => !String(c.id).startsWith("stock-sheet-"));
    if (globalOnly.length > 0) {
      window.localStorage.setItem(GLOBAL_CHAT_STORAGE_KEY, JSON.stringify(globalOnly));
    }
    const fromState = conversations.filter((c) => String(c.id).startsWith("stock-sheet-"));
    const map = new Map(readStockSheetConversationsFromStorage().map((c) => [c.id, c]));
    for (const c of fromState) map.set(c.id, c);
    const stockValues = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    window.localStorage.setItem(STOCK_SHEET_CHAT_STORAGE_KEY, JSON.stringify(stockValues));
  }, [conversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeMessages]);

  useEffect(() => {
    if (!activeConversation || activeConversation.messages.length > 0) return;
    const timer = window.setTimeout(() => {
      const welcomeMessage = buildInitialMessage();
      setAnimatedWelcomeId(welcomeMessage.id);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                messages: [...c.messages, welcomeMessage],
                updatedAt: Date.now(),
              }
            : c,
        ),
      );
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [activeConversationId, activeConversation?.messages.length]);

  const startNewChat = () => {
    const next = createConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveConversationId(next.id);
    setAwaitingGoalChoice(false);
    setQuizSession(null);
    setQuizIndex(0);
    setShowHistory(false);
  };

  const switchConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setAwaitingGoalChoice(false);
    setQuizSession(null);
    setQuizIndex(0);
    setShowHistory(false);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !activeConversationId) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    const historyAfterUser = [...activeMessages, userMsg];
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversationId) return c;
        const nextMsgs = [...c.messages, userMsg];
        const meta = parseStockWelcomeFromMessages(c.messages);
        const isStockSheet = String(c.id).startsWith("stock-sheet-");
        const title =
          isStockSheet && meta
            ? summarizeStockSheetConversationTitle(meta.name, nextMsgs)
            : summarizeConversationTitle(nextMsgs);
        return { ...c, messages: nextMsgs, title, updatedAt: Date.now() };
      }),
    );
    setInput("");

    const normalized = text.replace(/,/g, "").trim();
    const lower = normalized.toLowerCase();
    const numberMatch = normalized.match(/(\d{3,6})/);
    const requested = numberMatch ? Number(numberMatch[1]) : Number.NaN;

    if (awaitingGoalChoice) {
      let goalReply: string;
      if (lower === "1" || /평균|최근 3일|자동/.test(lower)) {
        setGoalSteps(avg3Recent);
        setAwaitingGoalChoice(false);
        goalReply = `최근 3일 걸음 평균(${avg3Recent.toLocaleString()}보)으로 목표를 변경했어요.\n현재 목표: ${avg3Recent.toLocaleString()}보`;
      } else if (lower === "2") {
        goalReply = "좋아요. 원하는 목표 걸음 수를 숫자로 입력해 주세요.\n예: 7000";
      } else if (Number.isFinite(requested) && requested >= 1000 && requested <= 50000) {
        const nextGoal = Math.round(requested);
        setGoalSteps(nextGoal);
        setAwaitingGoalChoice(false);
        goalReply = `요청하신 대로 걸음 목표를 ${nextGoal.toLocaleString()}보로 변경했어요.`;
      } else {
        goalReply = `입력을 이해하지 못했어요.\n\n다시 선택해 주세요:\n1) 평균으로 변경 (${avg3Recent.toLocaleString()}보)\n2) 직접 입력 (예: 7000보)`;
      }
      appendAssistantMessage(goalReply);
      return;
    }

    /** 하이브리드 주식 퀴즈 (진행 중: 1~4 답 / 종료) */
    if (quizSession) {
      const stopQuiz = /^(그만|종료|중지|스톱|stop)$/i.test(normalized.trim());
      if (stopQuiz) {
        setQuizSession(null);
        setQuizIndex(0);
        appendAssistantMessage("퀴즈를 종료했어요. 다음에 또 도전해 보세요!");
        return;
      }
      const digit = normalized.match(/^[1-4]$/);
      if (digit) {
        const q = quizSession.questions[quizIndex];
        if (!q) {
          setQuizSession(null);
          setQuizIndex(0);
          appendAssistantMessage("퀴즈 상태가 어긋났어요. 다시 시작해 주세요.");
          return;
        }
        const oc = sortQuizChoices(q.choices);
        const pick = oc[parseInt(digit[0], 10) - 1];
        const correct = pick?.key === q.correctKey;
        let reply = correct ? "정답이에요! 👏" : (q.feedbackWrong?.trim() || "아쉽어요!");
        if (correct) {
          const level = Math.min(6, Math.max(3, Math.round(Number(q.difficulty) || 4)));
          addQuizCash(level);
          reply += `\n\n+${level.toLocaleString()}원 캐시 적립! (문제 난이도 ${level}/6)`;
        }
        if (!correct) {
          const right = oc.find((c) => c.key === q.correctKey);
          if (right) reply += `\n정답은「${right.text}」이에요.`;
        }
        const nextIdx = quizIndex + 1;
        if (nextIdx < quizSession.questions.length) {
          setQuizIndex(nextIdx);
          reply += `\n\n${formatQuizBlock(null, quizSession.questions[nextIdx], nextIdx, quizSession.questions.length)}`;
        } else {
          setQuizSession(null);
          setQuizIndex(0);
          reply += "\n\n모든 문제를 마쳤어요! 수고했어요 🎉";
        }
        appendAssistantMessage(reply);
        return;
      }
      appendAssistantMessage(
        "퀴즈 중이에요. 답은 1~4 숫자만 보내 주세요. 끝내려면「그만」이라고 입력해 주세요.",
      );
      return;
    }

    const wantsQuiz = /오늘의 주식 퀴즈|주식\s*퀴즈|퀴즈\s*시작|퀴즈\s*해줘|^퀴즈!$/i.test(normalized.trim());
    if (wantsQuiz) {
      if (!mapQuizSnapshot || mapQuizSnapshot.stocks.length < 2) {
        appendAssistantMessage(
          "지도 원(반경 300m) 안에 상장 종목이 2곳 이상일 때 퀴즈를 만들 수 있어요.\n지도 탭에서 핀이 보이도록 잠시 기다렸다가 다시 눌러 주세요.",
        );
        return;
      }
      setIsLoading(true);
      setAwaitingGoalChoice(false);
      try {
        const hints = await buildQuizHintsFromQuizContext(ragUserId);
        const data = await requestHybridQuiz(
          mapQuizSnapshot,
          hints.length > 0 ? { memoryHints: hints } : undefined,
        );
        setQuizSession({ intro: data.intro, questions: data.questions });
        setQuizIndex(0);
        appendAssistantMessage(
          formatQuizBlock(data.intro, data.questions[0], 0, data.questions.length),
        );
      } catch (e) {
        appendAssistantMessage(
          e instanceof Error ? e.message : "퀴즈를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const asksGoal = /목표|업데이트|변경|바꿔|설정/.test(lower);
    if (asksGoal) {
      let goalReply: string;
      if (/평균|최근 3일|자동/.test(lower)) {
        setGoalSteps(avg3Recent);
        setAwaitingGoalChoice(false);
        goalReply = `최근 3일 걸음 평균(${avg3Recent.toLocaleString()}보)으로 목표를 변경했어요.\n현재 목표: ${avg3Recent.toLocaleString()}보`;
      } else if (Number.isFinite(requested) && requested >= 1000 && requested <= 50000) {
        const nextGoal = Math.round(requested);
        setGoalSteps(nextGoal);
        setAwaitingGoalChoice(false);
        goalReply = `요청하신 대로 걸음 목표를 ${nextGoal.toLocaleString()}보로 변경했어요.`;
      } else {
        setAwaitingGoalChoice(true);
        goalReply = `현재 목표: ${walk.goalSteps.toLocaleString()}보\n최근 3일 평균: ${avg3Recent.toLocaleString()}보\n\n원하는 방식으로 답장해 주세요:\n1) 평균으로 바꿔줘\n2) 7000보로 변경`;
      }
      appendAssistantMessage(goalReply);
      return;
    }

    const stockPin =
      activeConversationId.startsWith("stock-sheet-") && activeConversation
        ? stockSheetConversationToStockPin(activeConversation)
        : null;
    if (stockPin) {
      setIsLoading(true);
      try {
        const { content: reply, intent } = await askStockAssistant(stockPin, historyAfterUser);
        void persistQuizContextExchange({
          userId: ragUserId,
          intent,
          userQuestion: `[${stockPin.name}] ${userMsg.content}`,
          assistantAnswer: reply,
          stock: { name: stockPin.name, ticker: stockPin.ticker },
        });
        const replyId = (Date.now() + 1).toString();
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeConversationId) return c;
            const newMsgs = [
              ...c.messages,
              { id: replyId, role: "assistant" as const, content: reply, timestamp: new Date() },
            ];
            const meta = parseStockWelcomeFromMessages(c.messages);
            return {
              ...c,
              messages: newMsgs,
              title: meta ? summarizeStockSheetConversationTitle(meta.name, newMsgs) : c.title,
              updatedAt: Date.now(),
            };
          }),
        );
      } catch (err) {
        const detail = err instanceof Error && err.message ? err.message : "";
        appendAssistantMessage(
          detail
            ? `응답에 실패했어요: ${detail}\n배포 환경에 OPENAI_API_KEY 가 있는지 확인해 주세요.`
            : "일시적으로 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        setIsLoading(false);
      }
      return;
    }

    /** 글로벌 대화창: 지도 반경 종목명·코드가 보이면 종목 시트와 동일하게 검색·시세 보강 API 사용 */
    const nearbyStockPin = resolveStockPinFromMapMessage(userMsg.content, mapQuizSnapshot?.stocks);
    if (nearbyStockPin) {
      setIsLoading(true);
      try {
        const { content: reply, intent } = await askStockAssistant(nearbyStockPin, historyAfterUser);
        void persistQuizContextExchange({
          userId: ragUserId,
          intent,
          userQuestion: `[${nearbyStockPin.name}] ${userMsg.content}`,
          assistantAnswer: reply,
          stock: { name: nearbyStockPin.name, ticker: nearbyStockPin.ticker },
        });
        appendAssistantMessage(reply);
      } catch (err) {
        const detail = err instanceof Error && err.message ? err.message : "";
        appendAssistantMessage(
          detail
            ? `응답에 실패했어요: ${detail}\n배포 환경에 OPENAI_API_KEY 가 있는지 확인해 주세요.`
            : "일시적으로 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      const walkCtx = buildAssistantWalkStepsContext(weeklySteps);
      const walkGoalHint = buildWalkGoalIntentHint(userMsg.content);
      const ragCtx = await fetchQuizContextForSystemPrompt(ragUserId);
      const marketCtx = await buildGlobalChatMarketContext(userMsg.content, mapQuizSnapshot?.stocks);
      const { content: reply, intent } = await askGlobalAssistant(historyAfterUser, {
        extraSystemContext: [walkCtx, walkGoalHint, ragCtx, marketCtx].filter(Boolean).join("\n\n"),
      });
      void persistQuizContextExchange({
        userId: ragUserId,
        intent,
        userQuestion: userMsg.content,
        assistantAnswer: reply,
      });
      appendAssistantMessage(reply);
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : "";
      appendAssistantMessage(
        detail
          ? `응답에 실패했어요: ${detail}\n배포 환경에 OPENAI_API_KEY 가 있는지 확인해 주세요. (COMPANY_SYNC_TOKEN 은 챗봇과 무관합니다.)`
          : "일시적으로 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-slide-up relative flex h-full flex-col rounded-t-3xl bg-background shadow-2xl">
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
      <header className="flex items-center justify-between border-b border-border/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              syncConversationsFromStorage();
              setShowHistory(true);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60"
            aria-label="대화 기록 열기"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
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

      <div ref={scrollRef} className="chat-scroll-area min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pr-3">
        {activeMessages.map((msg, index) => {
          const isWelcomeBubble = msg.role === "assistant" && msg.content === WELCOME_TEXT && index === 0;
          const shouldAnimateWelcome =
            isWelcomeBubble &&
            msg.id === animatedWelcomeId &&
            activeMessages.length === 1 &&
            !activeMessages.some((m) => m.role === "user");
          return (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                msg.role === "user"
                  ? "whitespace-pre-wrap rounded-br-md bg-primary text-primary-foreground"
                  : `rounded-bl-md border border-border/50 bg-card text-card-foreground ${
                      shouldAnimateWelcome ? "animate-fade-in" : ""
                    }`
              }`}
            >
              {msg.role === "user" ? (
                msg.content
              ) : (
                <ChatAssistantMarkdown content={msg.content} className="leading-relaxed" />
              )}
            </div>
          </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border/50 bg-card px-3 py-2 text-xs text-muted-foreground">
              생각하는 중...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/80 p-3">
        <div className="no-scrollbar mb-2 w-full overflow-x-auto overflow-y-hidden [touch-action:pan-x]">
          <div className="inline-flex min-w-max items-center gap-1.5 whitespace-nowrap pr-1">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => sendMessage(action)}
                className="flex-none whitespace-nowrap rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground"
              >
                {action}
              </button>
            ))}
          </div>
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

      {showHistory && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-30 bg-[#593d63]/12"
            onClick={() => setShowHistory(false)}
            aria-label="대화 기록 닫기"
          />
          <aside className="absolute left-0 top-0 z-40 flex h-full w-[240px] flex-col border-r border-border/60 bg-muted shadow-xl">
            <div className="px-3 pb-2 pt-3">
              <button
                type="button"
                onClick={startNewChat}
                className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                <Plus className="h-4 w-4" />
                New chat
              </button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-3">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => switchConversation(conv.id)}
                  className={`mb-1.5 w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    conv.id === activeConversationId
                      ? "border border-border/70 bg-muted font-medium text-foreground"
                      : "border border-border/60 bg-background/60 text-foreground hover:bg-muted/60"
                  }`}
                >
                  {conv.title}
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
