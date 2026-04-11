/**
 * 배포된 앱에서 POST /api/companies/sync 를 호출해 Supabase 를 채웁니다.
 *
 * 사용 전 PowerShell 예:
 *   $env:SYNC_BASE_URL="https://your-app.vercel.app"
 *   $env:COMPANY_SYNC_TOKEN="배포환경과_동일한_토큰"
 *   node scripts/run-companies-sync.mjs
 *
 * Node 20+: `node --env-file=.env scripts/run-companies-sync.mjs` 로 .env 로드 가능
 */

const base = (process.env.SYNC_BASE_URL ?? "").replace(/\/$/, "");
const token = process.env.COMPANY_SYNC_TOKEN ?? "";

if (!base) {
  console.error("SYNC_BASE_URL 이 없습니다. 예: https://xxx.vercel.app");
  process.exit(1);
}

const url = `${base}/api/companies/sync`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { "x-sync-token": token } : {}),
  },
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = text;
}

console.log(res.status, typeof json === "string" ? json : JSON.stringify(json, null, 2));

if (!res.ok) process.exit(1);
