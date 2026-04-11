import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrlAndAnonKey } from "../supabasePublicEnv.js";

function normalizeKrxTicker(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s) && s.length <= 6) return s.padStart(6, "0");
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 4 && digits.length <= 6) return digits.padStart(6, "0");
  if (digits.length > 6) return digits.slice(-6);
  return null;
}

interface DbCompanyRow {
  source_place_id: string;
  name: string;
  lat: number;
  lng: number;
  sector: string | null;
  description: string | null;
  source_station: string | null;
  ticker: string | null;
  stock_name: string | null;
  map_display_name: string | null;
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

type ListedLite = {
  ticker: string;
  stockName: string;
  mapDisplayName: string;
  sector?: string;
};

function mapRowsToCompanies(
  rows: DbCompanyRow[],
  lat: number,
  lng: number,
  maxDistanceM: number,
  resolveListedFromDbRow: ((row: DbCompanyRow) => ListedLite | null) | null,
) {
  return rows
    .map((row) => {
      try {
        let ticker = normalizeKrxTicker(row.ticker != null ? String(row.ticker) : null);
        let displayName = String(row.stock_name ?? row.map_display_name ?? row.name ?? "").trim();
        let sector = row.sector ?? "기타";
        if (!ticker && resolveListedFromDbRow) {
          const listed = resolveListedFromDbRow(row);
          if (listed) {
            ticker = normalizeKrxTicker(listed.ticker);
            displayName = String(listed.mapDisplayName ?? listed.stockName ?? displayName).trim();
            if (listed.sector) sector = listed.sector;
          }
        }
        if (!ticker) return null;
        const la = Number(row.lat);
        const ln = Number(row.lng);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
        const distanceM = distanceMeters(lat, lng, la, ln);
        return {
          id: row.source_place_id,
          ticker,
          name: displayName,
          lat: la,
          lng: ln,
          sector,
          description: row.description ?? "주변 기업 정보",
          isSponsored: false,
          logoUrl: undefined,
          price: 0,
          changePercent: 0,
          distanceM,
          sourceStation: row.source_station,
        };
      } catch (rowErr) {
        console.warn("[api/companies/nearby] row skip:", rowErr);
        return null;
      }
    })
    .filter((v): v is NonNullable<typeof v> => v != null)
    .filter((row) => row.distanceM <= maxDistanceM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/** Vercel query: 단일 값·배열 모두 대응 */
function firstQuery(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function sendJson(res: VercelResponse, status: number, body: unknown) {
  if (res.writableEnded) return;
  try {
    res.statusCode = status;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-API-Nearby", "resilient-v2");
    res.end(JSON.stringify(body));
  } catch (endErr) {
    console.error("[api/companies/nearby] sendJson failed", endErr);
  }
}

export async function handleCompaniesNearby(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const lat = Number(firstQuery(req.query.lat as string | string[] | undefined));
  const lng = Number(firstQuery(req.query.lng as string | string[] | undefined));
  let radius = Number(firstQuery(req.query.radius as string | string[] | undefined) ?? "1000");
  if (!Number.isFinite(radius) || radius <= 0) radius = 1000;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendJson(res, 400, { error: "lat/lng query required" });
    return;
  }

  /** api/ 내부 모듈만 동적 로드 — ../../src 동적 import 는 Vercel에서 모듈 해석 실패로 500 날 수 있음 */
  let resolveListedFromDbRow: ((row: DbCompanyRow) => ListedLite | null) | null = null;
  try {
    const poi = await import("./poiResolveListedRow.js");
    resolveListedFromDbRow = (row: DbCompanyRow) => poi.resolveListedFromDbRow(row);
  } catch (e) {
    console.warn("[api/companies/nearby] poiResolveListedRow import failed, DB ticker column only", e);
  }

  const cfg = getSupabaseUrlAndAnonKey();
  if (!cfg) {
    sendJson(res, 200, { companies: [], warning: "Supabase env missing on server" });
    return;
  }

  try {
    const supabase = createClient(cfg.url, cfg.anonKey);

    const fetchInBbox = async (bboxRadiusM: number) => {
      const latPad = bboxRadiusM / 111320;
      const cosLat = Math.cos((lat * Math.PI) / 180);
      const lngPad = bboxRadiusM / (111320 * Math.max(Math.abs(cosLat), 1e-5));
      return supabase
        .from("nearby_companies")
        .select(
          "source_place_id,name,lat,lng,sector,description,source_station,ticker,stock_name,map_display_name",
        )
        .gte("lat", lat - latPad)
        .lte("lat", lat + latPad)
        .gte("lng", lng - lngPad)
        .lte("lng", lng + lngPad)
        .limit(500);
    };

    const SEOUL_METRO_BBOX_M = 22000;
    const GLOBAL_MAX_KM = 200;

    const bboxRadius = Math.max(radius, 800);
    const { data, error } = await fetchInBbox(bboxRadius);

    if (error) {
      console.error("[api/companies/nearby] Supabase:", error.message, error.code ?? "");
      /** 브라우저에서 Supabase 직접 폴백 가능하도록 200 + 빈 배열 */
      sendJson(res, 200, {
        companies: [],
        supabaseError: error.message,
        code: error.code,
      });
      return;
    }

    let rows = (data ?? []) as DbCompanyRow[];
    let filtered = mapRowsToCompanies(rows, lat, lng, radius, resolveListedFromDbRow);

    if (filtered.length === 0) {
      const wide = Math.min(Math.max(radius * 3, SEOUL_METRO_BBOX_M), 28000);
      const second = await fetchInBbox(wide);
      if (!second.error && second.data?.length) {
        rows = second.data as DbCompanyRow[];
        filtered = mapRowsToCompanies(rows, lat, lng, wide, resolveListedFromDbRow);
      }
    }

    if (filtered.length === 0) {
      const { data: allRows, error: allErr } = await supabase
        .from("nearby_companies")
        .select(
          "source_place_id,name,lat,lng,sector,description,source_station,ticker,stock_name,map_display_name",
        )
        .limit(2000);

      if (!allErr && allRows?.length) {
        let capped = mapRowsToCompanies(allRows as DbCompanyRow[], lat, lng, GLOBAL_MAX_KM * 1000, resolveListedFromDbRow);
        if (capped.length === 0) {
          capped = mapRowsToCompanies(
            allRows as DbCompanyRow[],
            lat,
            lng,
            Number.POSITIVE_INFINITY,
            resolveListedFromDbRow,
          );
        }
        filtered = capped.slice(0, 80);
      }
    }

    const companies = filtered.map(({ distanceM, sourceStation: _s, ...rest }) => rest);

    sendJson(res, 200, { companies });
  } catch (e) {
    console.error("[api/companies/nearby] fatal", e);
    sendJson(res, 200, { companies: [], warning: e instanceof Error ? e.message : "nearby error" });
  }
}
