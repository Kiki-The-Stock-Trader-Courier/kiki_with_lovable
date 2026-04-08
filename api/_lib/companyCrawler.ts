export interface CrawledCompany {
  source_place_id: string;
  name: string;
  lat: number;
  lng: number;
  sector: string;
  description: string;
  source_station: "서울숲역" | "여의도역";
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

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function inferSector(tags: Record<string, string> | undefined): string {
  if (!tags) return "기타";
  if (tags.amenity === "bank" || tags.office === "financial") return "금융";
  if (tags.office === "it" || tags.technology) return "IT";
  if (tags.shop === "mall" || tags.shop === "supermarket") return "유통";
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
  if (tags.industrial) parts.push(`industrial=${tags.industrial}`);
  const detail = parts.length > 0 ? parts.join(", ") : "업종 정보 없음";
  return `${stationName} 반경 1km 기업 정보 (${detail}) · ${sourceHint}`;
}

function toCompany(stationName: "서울숲역" | "여의도역", el: OverpassElement): CrawledCompany | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  return {
    source_place_id: `${stationName}:${el.type}:${el.id}`,
    name,
    lat,
    lng,
    sector: inferSector(tags),
    description: toDescription(tags, stationName),
    source_station: stationName,
  };
}

async function fetchStationCompanies(station: (typeof STATIONS)[number]): Promise<CrawledCompany[]> {
  const query = `
[out:json][timeout:30];
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
);
out center;
`;

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: query,
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed (${station.name}): ${response.status}`);
  }

  const json = (await response.json()) as { elements?: OverpassElement[] };
  const elements = Array.isArray(json.elements) ? json.elements : [];
  return elements
    .map((el) => toCompany(station.name, el))
    .filter((v): v is CrawledCompany => v != null);
}

export async function crawlCompaniesAroundStations(): Promise<CrawledCompany[]> {
  const all = await Promise.all(STATIONS.map(fetchStationCompanies));
  const dedup = new Map<string, CrawledCompany>();
  for (const row of all.flat()) {
    dedup.set(row.source_place_id, row);
  }
  return Array.from(dedup.values());
}
