/**
 * 지도 핀에 쓸 외부 로고 URL.
 * - Clearbit: 도메인 기준 브랜드 마크 (무료 티어는 용도·트래픽 제한 있을 수 있음)
 * - 실서비스: KRX/증권사 API, 자사 CDN, 또는 public/logos/*.png 로 교체 권장
 */
export function logoUrlFromDomain(domain: string): string {
  const d = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return `https://logo.clearbit.com/${d}`;
}
