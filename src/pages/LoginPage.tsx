import { Chrome } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const LoginPage = () => {
  const { signInWithGoogle, isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  return (
    <div className="app-page-shell mx-auto flex min-h-[100dvh] w-full max-w-lg items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-foreground">로그인</h1>
        <p className="mb-5 text-sm text-muted-foreground">Google 계정으로 로그인하고 기능을 이용하세요.</p>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background font-semibold text-foreground transition-colors hover:bg-muted/60"
          aria-label="Google 계정으로 로그인"
        >
          <Chrome className="h-5 w-5" />
          Google로 로그인
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
