/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 앱(Capacitor 등)에서 배포 도메인으로 `/api/chat`, `/api/quotes` 호출 시
   * (예: https://xxx.vercel.app — 끝 슬래시 없음)
   */
  readonly VITE_CHAT_API_ORIGIN?: string;
  /** Supabase 본인 프로젝트 URL */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon public key */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
