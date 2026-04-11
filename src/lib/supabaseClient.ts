import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 대시보드(본인 계정) → Project Settings → API 에서
 * Project URL / anon public key 를 .env 에 넣으면 연결됩니다.
 * 키가 없으면 null (앱은 기존처럼 동작).
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export function isSupabaseConfigured(): boolean {
  return supabase != null;
}
