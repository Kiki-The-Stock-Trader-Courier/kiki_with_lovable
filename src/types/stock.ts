/** 지도에 표시되는 상장 기업 */
export interface StockPin {
  id: string;
  /** 종목 코드 */
  ticker: string;
  /** 회사명 */
  name: string;
  /** 지도 위 위도 */
  lat: number;
  /** 지도 위 경도 */
  lng: number;
  /** 현재 주가 (원) */
  price: number;
  /** 전일 대비 변동률 (%) */
  changePercent: number;
  /** 업종 */
  sector: string;
  /** 기업 로고 URL (optional) */
  logoUrl?: string;
  /** 한줄 설명 */
  description: string;
  /** 광고주 여부 */
  isSponsored: boolean;
}

/** 사용자 걸음 / 캐시 정보 */
export interface UserWalk {
  /** 오늘 걸음수 */
  todaySteps: number;
  /** 목표 걸음수 */
  goalSteps: number;
  /** 현재 캐시 잔고 (원) */
  cashBalance: number;
  /** 캐시워크 적립 비율: 1보당 원 */
  cashPerStep: number;
}

/** 사용자 보유 주식 */
export interface HoldingStock {
  ticker: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
}

/** 사용자가 관심 저장(스크랩)한 종목 */
export interface ScrappedStock {
  ticker: string;
  name: string;
  sector: string;
  /** ISO 문자열 */
  savedAt: string;
}

/** 채팅 메시지 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/** 사이드바·저장용 대화 세션 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

/** 주변 인기 종목 (다른 동네) */
export interface TrendingStock {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  district: string;
  distance: number;
}
