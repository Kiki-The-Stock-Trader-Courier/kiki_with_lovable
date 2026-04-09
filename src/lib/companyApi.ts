import type { StockPin } from "@/types/stock";
import { fetchNearbyCompaniesFromSupabase } from "@/lib/nearbyCompanies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Capacitor } from "@capacitor/core";
import { getPublicApiOrigin } from "@/lib/quoteApi";

interface NearbyApiCompany extends StockPin {
  distanceM?: number;
  sourceStation?: string | null;
}

interface NearbyApiResponse {
  companies: NearbyApiCompany[];
}

function nearbyUrls(query: string): string[] {
  const path = `/api/companies/nearby?${query}`;
  const origin = getPublicApiOrigin();
  const dev = import.meta.env.VITE_DEV_API_PROXY?.replace(/\/$/, "");
  const urls: string[] = [];
  if (Capacitor.isNativePlatform() && origin) urls.push(`${origin}${path}`);
  if (origin) urls.push(`${origin}${path}`);
  urls.push(path);
  if (dev && dev !== origin) urls.push(`${dev}${path}`);
  return Array.from(new Set(urls));
}

/**
 * 주변 상장 매칭 POI. Vercel `/api/companies/nearby` → 실패 시 Supabase 직접.
 * 배포 도메인은 `getPublicApiOrigin()` 으로 상대·절대 모두 시도.
 */
export async function fetchNearbyCompanies(
  center: { lat: number; lng: number },
  radius = 1000,
): Promise<StockPin[]> {
  const params = new URLSearchParams({
    lat: String(center.lat),
    lng: String(center.lng),
    radius: String(radius),
  });
  const q = params.toString();

  for (const url of nearbyUrls(q)) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const json = (await response.json()) as NearbyApiResponse;
      const list = Array.isArray(json.companies) ? json.companies : [];
      if (list.length > 0) return list;
    } catch {
      /* 다음 URL */
    }
  }

  if (isSupabaseConfigured()) {
    return fetchNearbyCompaniesFromSupabase(center, radius);
  }

  return [];
}
