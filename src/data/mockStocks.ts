import type { StockPin, UserWalk, TrendingStock, HoldingStock } from "@/types/stock";
import { logoUrlFromDomain } from "@/lib/companyLogos";

// 춘천 시내 중심 좌표 기준 mock 데이터 (logoUrl: 회사 공식 도메인 기준 Clearbit — 필요 시 public 자산으로 교체)
export const MOCK_STOCKS: StockPin[] = [
  { id: "1", ticker: "005930", name: "삼성전자", lat: 37.8813, lng: 127.7298, price: 72400, changePercent: 1.2, sector: "반도체", description: "글로벌 반도체·스마트폰 제조 기업", isSponsored: true, logoUrl: logoUrlFromDomain("samsung.com") },
  { id: "2", ticker: "000660", name: "SK하이닉스", lat: 37.8790, lng: 127.7270, price: 178000, changePercent: -0.8, sector: "반도체", description: "메모리 반도체 세계 2위 기업", isSponsored: true, logoUrl: logoUrlFromDomain("skhynix.com") },
  { id: "3", ticker: "035720", name: "카카오", lat: 37.8775, lng: 127.7320, price: 42850, changePercent: 2.3, sector: "IT", description: "카카오톡 기반 플랫폼 기업", isSponsored: false, logoUrl: logoUrlFromDomain("kakaocorp.com") },
  { id: "4", ticker: "035420", name: "NAVER", lat: 37.8800, lng: 127.7340, price: 195500, changePercent: 0.5, sector: "IT", description: "대한민국 1위 검색 포털", isSponsored: true, logoUrl: logoUrlFromDomain("navercorp.com") },
  { id: "5", ticker: "068270", name: "셀트리온", lat: 37.8825, lng: 127.7250, price: 198000, changePercent: -1.5, sector: "바이오", description: "바이오시밀러 전문 제약기업", isSponsored: false, logoUrl: logoUrlFromDomain("celltrion.com") },
  { id: "6", ticker: "051910", name: "LG화학", lat: 37.8760, lng: 127.7280, price: 315000, changePercent: 0.9, sector: "화학", description: "2차전지·석유화학 대기업", isSponsored: true, logoUrl: logoUrlFromDomain("lgchem.com") },
  { id: "7", ticker: "006400", name: "삼성SDI", lat: 37.8835, lng: 127.7310, price: 385000, changePercent: -0.3, sector: "2차전지", description: "전기차 배터리 제조 기업", isSponsored: false, logoUrl: logoUrlFromDomain("samsungsdi.com") },
  { id: "8", ticker: "055550", name: "신한지주", lat: 37.8770, lng: 127.7360, price: 51200, changePercent: 1.8, sector: "금융", description: "신한은행 지주회사", isSponsored: true, logoUrl: logoUrlFromDomain("shinhan.com") },
  { id: "9", ticker: "105560", name: "KB금융", lat: 37.8808, lng: 127.7230, price: 82500, changePercent: 0.7, sector: "금융", description: "KB국민은행 지주회사", isSponsored: false, logoUrl: logoUrlFromDomain("kbfg.com") },
  { id: "10", ticker: "028260", name: "삼성물산", lat: 37.8785, lng: 127.7380, price: 127500, changePercent: -0.6, sector: "건설", description: "삼성그룹 건설·패션 사업", isSponsored: true, logoUrl: logoUrlFromDomain("samsungcnt.com") },
  { id: "11", ticker: "207940", name: "삼성바이오", lat: 37.8840, lng: 127.7275, price: 790000, changePercent: 1.1, sector: "바이오", description: "바이오의약품 CMO 세계 1위", isSponsored: false, logoUrl: logoUrlFromDomain("samsungbiologics.com") },
  { id: "12", ticker: "003550", name: "LG", lat: 37.8755, lng: 127.7305, price: 78400, changePercent: 0.4, sector: "지주", description: "LG그룹 지주회사", isSponsored: true, logoUrl: logoUrlFromDomain("lg.com") },
];

export const MOCK_USER_WALK: UserWalk = {
  /** 데모: 7200보 → 미수령 시 코인 뱃지에 72포인트 */
  todaySteps: 7200,
  goalSteps: 10000,
  cashBalance: 12450,
  /** 100걸음 = 1포인트 → 1보당 0.01 (표시용) */
  cashPerStep: 0.01,
  stepsClaimedForCashToday: 0,
};

export const MOCK_HOLDINGS: HoldingStock[] = [
  { ticker: "005930", name: "삼성전자", shares: 2, avgPrice: 71000, currentPrice: 72400 },
  { ticker: "035720", name: "카카오", shares: 1, avgPrice: 41200, currentPrice: 42850 },
];

export const MOCK_TRENDING: TrendingStock[] = [
  { ticker: "066570", name: "LG전자", price: 98700, changePercent: 2.1, district: "명동", distance: 1200 },
  { ticker: "030200", name: "KT", price: 38150, changePercent: 0.8, district: "강남", distance: 2500 },
  { ticker: "032830", name: "삼성생명", price: 85200, changePercent: -0.4, district: "여의도", distance: 3200 },
];

/** 앱 초기 지도 중심 (GPS 전) — 서울 지하철 5·9호선 여의도역 (sync STATIONS와 동일) */
export const DEFAULT_CENTER = { lat: 37.521758, lng: 126.924139 };
/** 지도 보라색 강조 원·캐시 매수 허용 반경(미터). 주변 POI 조회는 Index에서 이 값의 3배로 넓게 가져옴 */
export const DEFAULT_RADIUS_M = 500;
