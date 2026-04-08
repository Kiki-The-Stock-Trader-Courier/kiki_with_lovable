import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

interface DbCompanyRow {
  source_place_id: string;
  name: string;
  lat: number;
  lng: number;
  sector: string | null;
  description: string | null;
  source_station: string | null;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius ?? 1000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat/lng query required" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(503).json({ error: "Supabase env is not configured" });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey);
    const latPad = radius / 111320;
    const lngPad = radius / (111320 * Math.cos((lat * Math.PI) / 180));

    const { data, error } = await supabase
      .from("nearby_companies")
      .select("source_place_id,name,lat,lng,sector,description,source_station")
      .gte("lat", lat - latPad)
      .lte("lat", lat + latPad)
      .gte("lng", lng - lngPad)
      .lte("lng", lng + lngPad)
      .limit(200);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const rows = (data ?? []) as DbCompanyRow[];
    const filtered = rows
      .map((row) => ({
        id: row.source_place_id,
        ticker: `OSM-${row.source_place_id.split(":").slice(-1)[0]}`,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        sector: row.sector ?? "기타",
        description: row.description ?? "주변 기업 정보",
        isSponsored: false,
        logoUrl: undefined,
        price: 0,
        changePercent: 0,
        distanceM: distanceMeters(lat, lng, row.lat, row.lng),
        sourceStation: row.source_station,
      }))
      .filter((row) => row.distanceM <= radius)
      .sort((a, b) => a.distanceM - b.distanceM);

    res.status(200).json({ companies: filtered });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
