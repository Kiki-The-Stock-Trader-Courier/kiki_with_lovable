import {
  ChevronRight,
  Menu,
  Search,
  SquarePen,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatSidebarSessionItem {
  id: string;
  title: string;
  updatedAt: number;
}

interface ChatSidebarProps {
  sessions: ChatSidebarSessionItem[];
  activeSessionId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  /** "내 항목" 강조 (목업의 선택 배경) */
  myItemsActive: boolean;
  onMyItemsClick: () => void;
  onGemsClick?: () => void;
  /** 모바일 드로어 닫기 */
  onClose?: () => void;
  className?: string;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  searchQuery,
  onSearchChange,
  onNewChat,
  onSelectSession,
  myItemsActive,
  onMyItemsClick,
  onGemsClick,
  onClose,
  className,
}: ChatSidebarProps) {
  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-[min(100%,280px)] flex-col border-r border-slate-200/80 bg-[#f0f4f9] text-[#1e293b]",
        className,
      )}
    >
      {/* 상단: 햄버거(모바일 닫기) · 검색 — 데스크톱은 검색만 우측 정렬 */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+12px)]",
          onClose ? "justify-between" : "justify-end",
        )}
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#1e293b] transition-colors hover:bg-black/[0.06]"
            aria-label="메뉴 닫기"
          >
            <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <span className="hidden w-10 md:block" aria-hidden />
        )}
        <button
          type="button"
          className="rounded-lg p-2 text-[#1e293b] transition-colors hover:bg-black/[0.06]"
          aria-label="검색"
          onClick={() => document.getElementById("chat-sidebar-search")?.focus()}
        >
          <Search className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="px-3 pb-2">
        <label className="sr-only" htmlFor="chat-sidebar-search">
          채팅 검색
        </label>
        <input
          id="chat-sidebar-search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="검색..."
          className="w-full rounded-lg border border-slate-200/90 bg-white/80 px-3 py-2 text-sm text-[#1e293b] placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      </div>

      {/* 새 채팅 · 내 항목 */}
      <div className="space-y-0.5 px-2 pb-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose?.();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#1e293b] transition-colors hover:bg-white/60"
        >
          <SquarePen className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
          새 채팅
        </button>
        <button
          type="button"
          onClick={onMyItemsClick}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
            myItemsActive
              ? "bg-slate-200/80 text-[#1e293b]"
              : "text-[#1e293b] hover:bg-white/60",
          )}
        >
          <Star className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
          내 항목
        </button>
      </div>

      {/* Gems */}
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onGemsClick}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#1e293b] transition-colors hover:bg-white/50"
        >
          <span>Gems</span>
          <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden />
        </button>
      </div>

      {/* 채팅 기록 */}
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-3">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          채팅
        </p>
        <nav
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1"
          aria-label="채팅 기록"
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-xs text-slate-500">검색 결과가 없습니다.</p>
          ) : (
            filtered.map((s) => {
              const active = s.id === activeSessionId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSelectSession(s.id);
                    onClose?.();
                  }}
                  className={cn(
                    "flex w-full max-w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    active
                      ? "bg-sky-100/90 font-medium text-[#0c4a6e]"
                      : "text-[#334155] hover:bg-white/55",
                  )}
                  title={s.title}
                >
                  <span className="line-clamp-2 break-all">{s.title}</span>
                </button>
              );
            })
          )}
        </nav>
      </div>
    </div>
  );
}
