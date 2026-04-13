import { Chrome } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

const LoginPage = () => {
  const { signInWithGoogle, isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      const detail = e instanceof Error ? e.message : "로그인 연결에 실패했습니다.";
      window.alert(`Google 로그인에 실패했어요.\n${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-page-shell mx-auto flex min-h-[100dvh] w-full max-w-lg items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-foreground">로그인</h1>
        <p className="mb-5 text-sm text-muted-foreground">Google 계정으로 로그인하고 기능을 이용하세요.</p>
        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background font-semibold text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Google 계정으로 로그인"
        >
          <Chrome className="h-5 w-5" />
          {isSubmitting ? "로그인 연결 중..." : "Google로 로그인"}
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
