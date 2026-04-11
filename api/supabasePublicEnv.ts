/**
 * Vercel 서버리스(api/*)에서 Supabase anon 클라이언트용.
 * 대시보드 기본 이름(SUPABASE_URL)만 넣고 VITE_* 는 프론트용으로만 둔 경우가 많아 둘 다 지원합니다.
 */
export function getSupabaseUrlAndAnonKey(): { url: string; anonKey: string } | null {
  const url = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();
  const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
