import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { resolveListedKrx } from "./krxListedMatch.js";
import { repairEmptyTickers } from "./tickerRepair.js";

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
  /** 상장 법인 정식명 (예: BGF리테일) */
  stock_name: string;
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
const YEOUIDO_STATION = STATIONS[1];

/** 네이버 지역 검색으로 여의도 상장사 후보를 넓게 수집하기 위한 질의 */
const NAVER_LISTED_QUERIES = [
  "여의도 삼성",
  "여의도 SK",
  "여의도 LG",
  "여의도 현대",
  "여의도 신한",
  "여의도 KB",
  "여의도 하나은행",
  "여의도 우리은행",
  "여의도 NH투자증권",
  "여의도 키움증권",
  "여의도 미래에셋증권",
  "여의도 삼성증권",
  "여의도 카카오",
  "여의도 네이버",
  "여의도 GS25",
  "여의도 CU",
  "여의도 세븐일레븐",
  "여의도 이마트24",
  "여의도 올리브영",
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
  /** ticker 복구(repair) 시 resolveListedKrx 가 브랜드명을 찾을 수 있게 문자열에 포함 */
  const brandOp = [tags.brand, tags.operator].map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  const brandHint = brandOp.length ? ` · ${brandOp.join(" ")}` : "";
  return `${stationName} 반경 1km 기업 정보 (${detail}) · ${sourceHint}${brandHint}`;
}

function stripHtmlTags(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const p =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
}

function toCompany(stationName: "서울숲역" | "여의도역", el: OverpassElement): CrawledCompany | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  const brand = tags.brand?.trim();
  const nameKo = tags["name:ko"]?.trim();
  /** OSM에서 편의점·프랜차이즈는 name 없이 brand만 있는 경우가 많음 */
  const label = name || nameKo || brand;
  if (!label) return null;

  /** OSM 다국어·공식명을 매칭 문자열에 포함 (상호만으로는 규칙에 안 걸리는 경우 감소) */
  const searchExtra = [
    tags["name:en"],
    tags["name:ko"],
    tags["official_name"],
    tags["alt_name"],
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0 && s !== label)
    .join(" ");

  const listed = resolveListedKrx(label, {
    brand,
    operator: tags.operator?.trim(),
    searchExtra: searchExtra || undefined,
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
    stock_name: listed.stockName,
    map_display_name: listed.mapDisplayName,
  };
}

async function crawlCompaniesAroundStations(): Promise<{
  companies: CrawledCompany[];
  overpassElementsTotal: number;
  matchedListedBeforeDedup: number;
}> {
  const perStation = await Promise.all(
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
        const companies = elements
          .map((el) => toCompany(station.name, el))
          .filter((v): v is CrawledCompany => v != null);
        return { elementCount: elements.length, companies };
      } catch (e) {
        // 외부 크롤링 API가 일부 역에서 실패해도 전체 동기화는 계속 진행
        console.warn("[sync] station crawl failed:", station.name, e);
        return { elementCount: 0, companies: [] as CrawledCompany[] };
      }
    }),
  );

  let overpassElementsTotal = 0;
  let matchedListedBeforeDedup = 0;
  const flat: CrawledCompany[] = [];
  for (const p of perStation) {
    overpassElementsTotal += p.elementCount;
    matchedListedBeforeDedup += p.companies.length;
    flat.push(...p.companies);
  }

  const dedup = new Map<string, CrawledCompany>();
  for (const row of flat) dedup.set(row.source_place_id, row);
  return {
    companies: Array.from(dedup.values()),
    overpassElementsTotal,
    matchedListedBeforeDedup,
  };
}

type NaverLocalItem = {
  title?: string;
  category?: string;
  description?: string;
  telephone?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string; // 경도 * 1e7
  mapy?: string; // 위도 * 1e7
};

/**
 * 네이버 로컬 검색 API로 여의도역 주변 상장사 후보를 보강합니다.
 * - NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 없으면 건너뜀
 * - 여의도역 1km 반경 필터 적용
 */
async function crawlNaverListedAroundYeouido(): Promise<{
  companies: CrawledCompany[];
  searchedQueries: number;
  rawItems: number;
}> {
  const clientId = (process.env.NAVER_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.NAVER_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) {
    return { companies: [], searchedQueries: 0, rawItems: 0 };
  }

  const rows: CrawledCompany[] = [];
  let rawItems = 0;
  let searchedQueries = 0;

  for (const query of NAVER_LISTED_QUERIES) {
    searchedQueries += 1;
    try {
      const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=random`;
      const r = await fetch(url, {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { items?: NaverLocalItem[] };
      const items = Array.isArray(j.items) ? j.items : [];
      rawItems += items.length;

      for (const item of items) {
        const title = stripHtmlTags(item.title);
        if (!title) continue;

        const lng = Number(item.mapx) / 1e7;
        const lat = Number(item.mapy) / 1e7;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const d = distanceMeters(YEOUIDO_STATION.lat, YEOUIDO_STATION.lng, lat, lng);
        if (d > 1000) continue;

        const searchExtra = [
          stripHtmlTags(item.category),
          stripHtmlTags(item.roadAddress),
          stripHtmlTags(item.address),
          stripHtmlTags(item.description),
        ]
          .filter(Boolean)
          .join(" ");

        const listed = resolveListedKrx(title, { searchExtra });
        if (!listed) continue;

        const keyBase = `${title}:${lat.toFixed(6)}:${lng.toFixed(6)}`;
        rows.push({
          source_place_id: `여의도역:naver:${encodeURIComponent(keyBase)}`,
          name: title,
          lat,
          lng,
          sector: listed.sector ?? "기타",
          description: `여의도역 반경 1km 기업 정보 (naver-local-search)`,
          source_station: "여의도역",
          ticker: listed.ticker,
          stock_name: listed.stockName,
          map_display_name: listed.mapDisplayName,
        });
      }
    } catch (e) {
      console.warn("[sync] naver query failed:", query, e);
    }
  }

  const dedup = new Map<string, CrawledCompany>();
  for (const r of rows) dedup.set(r.source_place_id, r);
  return {
    companies: Array.from(dedup.values()),
    searchedQueries,
    rawItems,
  };
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
    const [osm, naver] = await Promise.all([
      crawlCompaniesAroundStations(),
      crawlNaverListedAroundYeouido(),
    ]);

    const merged = new Map<string, CrawledCompany>();
    for (const c of osm.companies) merged.set(c.source_place_id, c);
    for (const c of naver.companies) merged.set(c.source_place_id, c);

    const companies = Array.from(merged.values());
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
      stock_name: c.stock_name,
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

    /** 예전에 ticker 없이 쌓인 행·이번 크롤에서 놓친 행 보정 */
    let tickerRepair = { scanned: 0, updated: 0, skipped: 0, updateErrors: 0 };
    try {
      tickerRepair = await repairEmptyTickers(supabase);
    } catch (repairErr) {
      console.warn("[sync] tickerRepair:", repairErr);
    }

    const crawlStats = {
      /** Overpass가 돌려준 원시 요소 수(두 역 합) — 0이면 Overpass 실패·차단 가능 */
      overpassElementsTotal: osm.overpassElementsTotal,
      /** KRX 규칙에 걸린 POI 수(중복 제거 전) */
      matchedListedBeforeDedup: osm.matchedListedBeforeDedup,
      /** 네이버 API 검색 보강 */
      naverQueries: naver.searchedQueries,
      naverRawItems: naver.rawItems,
      naverMatchedAfterDedup: naver.companies.length,
      /** upsert 행 수(중복 제거 후, 곧 ticker 있는 행) */
      upsertedAfterDedup: payload.length,
    };

    res.status(200).json({
      ok: true,
      upsertedCount: payload.length,
      stations: ["서울숲역", "여의도역"],
      radiusM: 1000,
      crawlStats,
      tickerRepair,
      hint:
        osm.overpassElementsTotal === 0
          ? "Overpass에서 요소가 0입니다. 네트워크·API 제한을 확인하세요."
          : osm.matchedListedBeforeDedup === 0 && naver.companies.length === 0
            ? "OSM 이름이 krxListedMatch 규칙과 맞는 POI가 없습니다. RULES 확장 또는 다른 역 반경을 검토하세요."
            : payload.length === 0
              ? "매칭은 됐으나 중복 제거 후 0건입니다(비정상)."
              : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message, stage: "sync_handler" });
  }
}
