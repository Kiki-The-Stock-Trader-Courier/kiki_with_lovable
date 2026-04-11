import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Map } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 pb-24 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-sm text-center">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">404</p>
        <h1 className="mb-2 font-display text-2xl font-bold text-foreground">페이지를 찾을 수 없어요</h1>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          주소가 바뀌었거나 잘못 입력된 것 같아요.
          <br />
          지도 홈으로 돌아가 주세요.
        </p>
        <Button asChild className="h-12 w-full rounded-xl font-semibold shadow-md" size="lg">
          <Link to="/" className="inline-flex items-center justify-center gap-2">
            <Map className="h-5 w-5" aria-hidden />
            지도로 돌아가기
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
