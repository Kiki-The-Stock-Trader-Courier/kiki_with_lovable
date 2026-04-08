import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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
    const crawler = await import("../_lib/companyCrawler");
    const crawlCompaniesAroundStations = crawler.crawlCompaniesAroundStations;
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
