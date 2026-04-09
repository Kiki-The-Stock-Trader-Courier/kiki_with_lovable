import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { resolveListedKrx } from "./krxListedMatch";

interface CrawledCompany {
  source_place_id: string;
  /** OSM 원문 상호 */
  name: string;
  lat: number;
  lng: number;
  sector: string;
  description: string;
  source_station: "서울숲역" | "여의도역";
  /** KRX 6자리 — 상장 종목으로 식별된 경우만 수집 */
  ticker: string;
  /** 지도 표시명 (예: CU BGF리테일) */
  map_display_name: string;
}

interface OverpassElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const STATIONS = [
  { name: "서울숲역" as const, lat: 37.543617, lng: 127.044707 },
  { name: "여의도역" as const, lat: 37.521758, lng: 126.924139 },
];

function inferSector(tags: Record<string, string> | undefined): string {
  if (!tags) return "기타";
  if (tags.amenity === "bank" || tags.office === "financial") return "금융";
  if (tags.office === "it" || tags.technology) return "IT";
  if (tags.shop === "mall" || tags.shop === "supermarket") return "유통";
  if (tags.shop === "convenience" || tags.amenity === "cafe" || tags.shop === "bakery") return "유통";
  if (tags.amenity === "fast_food") return "유통";
  if (tags.industrial) return "제조";
  if (tags.office) return "오피스";
  return "기타";
}

function toDescription(tags: Record<string, string> | undefined, stationName: string): string {
  const sourceHint = "OpenStreetMap(Overpass) 기반 수집";
  if (!tags) return `${stationName} 반경 1km 기업 정보 · ${sourceHint}`;

  const parts: string[] = [];
  if (tags.office) parts.push(`office=${tags.office}`);
  if (tags.shop) parts.push(`shop=${tags.shop}`);
  if (tags.amenity) parts.push(`amenity=${tags.amenity}`);
  if (tags.industrial) parts.push(`industrial=${tags.industrial}`);
  const detail = parts.length > 0 ? parts.join(", ") : "업종 정보 없음";
  return `${stationName} 반경 1km 기업 정보 (${detail}) · ${sourceHint}`;
}

function toCompany(stationName: "서울숲역" | "여의도역", el: OverpassElement): CrawledCompany | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  const brand = tags.brand?.trim();
  const nameKo = tags["name:ko"]?.trim();
  /** OSM에서 편의점·프랜차이즈는 name 없이 brand만 있는 경우가 많음 */
  const label = name || nameKo || brand;
  if (!label) return null;

  const listed = resolveListedKrx(label, {
    brand,
    operator: tags.operator?.trim(),
  });
  if (!listed) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  return {
    source_place_id: `${stationName}:${el.type}:${el.id}`,
    name: label,
    lat,
    lng,
    sector: listed.sector ?? inferSector(tags),
    description: toDescription(tags, stationName),
    source_station: stationName,
    ticker: listed.ticker,
    map_display_name: listed.mapDisplayName,
  };
}

async function crawlCompaniesAroundStations(): Promise<CrawledCompany[]> {
  const allResults = await Promise.all(
    STATIONS.map(async (station) => {
      try {
        const query = `
[out:json][timeout:60];
(
  node(around:1000,${station.lat},${station.lng})["office"]["name"];
  way(around:1000,${station.lat},${station.lng})["office"]["name"];
  relation(around:1000,${station.lat},${station.lng})["office"]["name"];
  node(around:1000,${station.lat},${station.lng})["shop"]["name"];
  way(around:1000,${station.lat},${station.lng})["shop"]["name"];
  relation(around:1000,${station.lat},${station.lng})["shop"]["name"];
  node(around:1000,${station.lat},${station.lng})["industrial"]["name"];
  way(around:1000,${station.lat},${station.lng})["industrial"]["name"];
  relation(around:1000,${station.lat},${station.lng})["industrial"]["name"];
  node(around:1000,${station.lat},${station.lng})["amenity"="cafe"];
  way(around:1000,${station.lat},${station.lng})["amenity"="cafe"];
  relation(around:1000,${station.lat},${station.lng})["amenity"="cafe"];
  node(around:1000,${station.lat},${station.lng})["shop"="convenience"];
  way(around:1000,${station.lat},${station.lng})["shop"="convenience"];
  relation(around:1000,${station.lat},${station.lng})["shop"="convenience"];
  node(around:1000,${station.lat},${station.lng})["amenity"="fast_food"];
  way(around:1000,${station.lat},${station.lng})["amenity"="fast_food"];
  relation(around:1000,${station.lat},${station.lng})["amenity"="fast_food"];
  node(around:1000,${station.lat},${station.lng})["shop"="bakery"];
  way(around:1000,${station.lat},${station.lng})["shop"="bakery"];
  relation(around:1000,${station.lat},${station.lng})["shop"="bakery"];
);
out center;
`;

        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: query,
        });
        if (!response.ok) throw new Error(`Overpass request failed (${station.name}): ${response.status}`);

        const json = (await response.json()) as { elements?: OverpassElement[] };
        const elements = Array.isArray(json.elements) ? json.elements : [];
        return elements
          .map((el) => toCompany(station.name, el))
          .filter((v): v is CrawledCompany => v != null);
      } catch (e) {
        // 외부 크롤링 API가 일부 역에서 실패해도 전체 동기화는 계속 진행
        console.warn("[sync] station crawl failed:", station.name, e);
        return [];
      }
    }),
  );

  const dedup = new Map<string, CrawledCompany>();
  for (const row of allResults.flat()) dedup.set(row.source_place_id, row);
  return Array.from(dedup.values());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-sync-token");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const syncToken = process.env.COMPANY_SYNC_TOKEN;
  if (syncToken) {
    const received = req.headers["x-sync-token"];
    if (received !== syncToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(503).json({ error: "Supabase server env is not configured" });
    return;
  }

  try {
    const companies = await crawlCompaniesAroundStations();
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = companies.map((c) => ({
      source_place_id: c.source_place_id,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      sector: c.sector,
      description: c.description,
      source_station: c.source_station,
      ticker: c.ticker,
      map_display_name: c.map_display_name,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("nearby_companies")
      .upsert(payload, { onConflict: "source_place_id" });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({
      ok: true,
      upsertedCount: payload.length,
      stations: ["서울숲역", "여의도역"],
      radiusM: 1000,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message, stage: "sync_handler" });
  }
}
