import { Map, Footprints, BriefcaseBusiness, User, MessageCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface NavItem {
  path: string;
  label: string;
  icon: typeof Map;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "지도", icon: Map },
  { path: "/walk", label: "걷기", icon: Footprints },
  { path: "/holdings", label: "보유 종목", icon: BriefcaseBusiness },
  { path: "/profile", label: "내 정보", icon: User },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const showCenterChatFab =
    location.pathname === "/" ||
    location.pathname === "/walk" ||
    location.pathname === "/holdings" ||
    location.pathname === "/profile";

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-[1300] w-full max-w-lg -translate-x-1/2 border-t border-border bg-card/95 shadow-sheet backdrop-blur-md supports-[backdrop-filter]:bg-card/80"
      data-testid="bottom-nav"
      aria-label="메인 내비게이션"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {showCenterChatFab && (
        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="map-chat-fab pointer-events-auto absolute left-1/2 top-0 z-[1400] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform active:scale-95"
          aria-label="챗봇 열기"
        >
          <MessageCircle className="h-6 w-6 text-white" aria-hidden />
        </button>
      )}

      <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-4 py-2">
        {NAV_ITEMS.map(({ path, label, icon: Icon }, idx) => {
          const isActive = location.pathname === path;
          const colClass = idx === 2 ? "col-start-4" : idx === 3 ? "col-start-5" : "";
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              } ${colClass}`}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
