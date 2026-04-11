/**
 * DB 행(name·description 등)만으로 KRX 매칭 — 브라우저·API 공통.
 * 구현은 api/companies/poiResolveListedRow (krxListedMatch 규칙 공유).
 */
export { resolveListedFromDbRow, type DbRowForTicker } from "../../api/companies/poiResolveListedRow.js";
