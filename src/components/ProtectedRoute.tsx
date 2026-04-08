import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg items-center justify-center bg-background text-sm text-muted-foreground">
        로그인 상태 확인 중...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
