import type { StockPin } from "@/types/stock";

interface NearbyApiCompany extends StockPin {
  distanceM?: number;
  sourceStation?: string | null;
}

interface NearbyApiResponse {
  companies: NearbyApiCompany[];
}

export async function fetchNearbyCompanies(
  center: { lat: number; lng: number },
  radius = 1000,
): Promise<StockPin[]> {
  const params = new URLSearchParams({
    lat: String(center.lat),
    lng: String(center.lng),
    radius: String(radius),
  });

  const response = await fetch(`/api/companies/nearby?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load nearby companies (${response.status})`);
  }

  const json = (await response.json()) as NearbyApiResponse;
  if (!json || !Array.isArray(json.companies)) return [];
  return json.companies;
}
