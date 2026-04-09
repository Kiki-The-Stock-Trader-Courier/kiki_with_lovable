/**
 * OpenStreetMap 등에서 수집한 상호명 → KRX 6자리 종목코드 매칭.
 * 부분 문자열(정규화 후)로 매칭하며, 더 긴 키워드가 우선합니다.
 */

export type ListedResolve = {
  ticker: string;
  /** 지도 마커·팝업에 표시할 이름 */
  mapDisplayName: string;
  /** 업종 힌트 (없으면 OSM 추론 유지) */
  sector?: string;
};

type Rule = {
  ticker: string;
  /** 기본 표시명 (mapLabel 없을 때) */
  defaultLabel: string;
  /** 길이가 긴 순으로 정렬해서 넣을 것 (삼성전자 > 삼성) */
  terms: string[];
  sector?: string;
  /** OSM 원문을 보고 브랜드+법인명 등으로 바꿀 때 */
  mapLabel?: (rawOsmName: string) => string;
};

function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\(주\)|주식회사|㈜|유한회사|코퍼레이션/g, "")
    .replace(/[·•·]/g, "");
}

function sortTermsLongFirst(terms: string[]): string[] {
  return [...terms].sort((a, b) => normalize(b).length - normalize(a).length);
}

/**
 * 규칙 배열: 앞에 둔 항목이 동일 길이 매칭일 때 우선(더 구체적인 종목을 위에 배치).
 */
const RULES: Rule[] = [
  {
    ticker: "282330",
    defaultLabel: "BGF리테일",
    terms: sortTermsLongFirst(["BGF리테일", "BGF 리테일", "씨유", "CU"]),
    sector: "유통",
    mapLabel: (raw) => {
      const r = raw.trim();
      const n = normalize(r);
      // 편의점 브랜드가 드러나면 "CU BGF리테일" 형식
      if (n.includes("씨유") || /\bcu\b/i.test(r)) return "CU BGF리테일";
      return "BGF리테일";
    },
  },
  {
    ticker: "007070",
    defaultLabel: "GS리테일",
    terms: sortTermsLongFirst(["GS리테일", "GS25", "지에스25", "GS슈퍼"]),
    sector: "유통",
    mapLabel: (raw) => {
      const n = normalize(raw);
      if (n.includes("gs25") || n.includes("지에스25")) return "GS25 GS리테일";
      return "GS리테일";
    },
  },
  {
    ticker: "139480",
    defaultLabel: "이마트",
    terms: sortTermsLongFirst(["이마트", "e-mart", "emart"]),
    sector: "유통",
  },
  {
    ticker: "004170",
    defaultLabel: "신세계",
    terms: sortTermsLongFirst(["신세계백화점", "신세계", "SSG", "ssg닷컴"]),
    sector: "유통",
  },
  {
    ticker: "023530",
    defaultLabel: "롯데지주",
    terms: sortTermsLongFirst(["롯데백화점", "롯데마트", "롯데", "LOTTE"]),
    sector: "유통",
  },
  {
    ticker: "005930",
    defaultLabel: "삼성전자",
    terms: sortTermsLongFirst(["삼성전자", "Samsung Electronics", "Samsung"]),
    sector: "반도체",
  },
  {
    ticker: "000660",
    defaultLabel: "SK하이닉스",
    terms: sortTermsLongFirst(["SK하이닉스", "하이닉스", "SK Hynix"]),
    sector: "반도체",
  },
  {
    ticker: "035420",
    defaultLabel: "NAVER",
    terms: sortTermsLongFirst(["네이버", "NAVER", "Naver"]),
    sector: "IT",
  },
  {
    ticker: "035720",
    defaultLabel: "카카오",
    terms: sortTermsLongFirst(["카카오", "Kakao"]),
    sector: "IT",
  },
  {
    ticker: "068270",
    defaultLabel: "셀트리온",
    terms: sortTermsLongFirst(["셀트리온", "Celltrion"]),
    sector: "바이오",
  },
  {
    ticker: "207940",
    defaultLabel: "삼성바이오로직스",
    terms: sortTermsLongFirst(["삼성바이오로직스", "삼성바이오"]),
    sector: "바이오",
  },
  {
    ticker: "051910",
    defaultLabel: "LG화학",
    terms: sortTermsLongFirst(["LG화학", "LG Chem"]),
    sector: "화학",
  },
  {
    ticker: "006400",
    defaultLabel: "삼성SDI",
    terms: sortTermsLongFirst(["삼성SDI", "삼성에스디아이"]),
    sector: "2차전지",
  },
  {
    ticker: "373220",
    defaultLabel: "LG에너지솔루션",
    terms: sortTermsLongFirst(["LG에너지솔루션", "LG엔솔", "LG Energy"]),
    sector: "2차전지",
  },
  {
    ticker: "028260",
    defaultLabel: "삼성물산",
    terms: sortTermsLongFirst(["삼성물산"]),
    sector: "건설",
  },
  {
    ticker: "003550",
    defaultLabel: "LG",
    terms: sortTermsLongFirst(["LG지주", "LG그룹", "LG트윈타워"]),
    sector: "지주",
  },
  {
    ticker: "055550",
    defaultLabel: "신한지주",
    terms: sortTermsLongFirst(["신한금융지주", "신한은행", "신한카드", "신한투자증권", "Shinhan"]),
    sector: "금융",
  },
  {
    ticker: "105560",
    defaultLabel: "KB금융",
    terms: sortTermsLongFirst(["KB금융", "KB국민은행", "국민은행", "KB증권", "KB손해보험"]),
    sector: "금융",
  },
  {
    ticker: "086790",
    defaultLabel: "하나금융지주",
    terms: sortTermsLongFirst(["하나금융지주", "하나은행", "하나증권", "KEB하나은행"]),
    sector: "금융",
  },
  {
    ticker: "316140",
    defaultLabel: "우리금융지주",
    terms: sortTermsLongFirst(["우리금융지주", "우리은행", "우리카드"]),
    sector: "금융",
  },
  {
    ticker: "005940",
    defaultLabel: "NH투자증권",
    terms: sortTermsLongFirst(["NH투자증권", "NH선물", "NH투자"]),
    sector: "금융",
  },
  {
    ticker: "039490",
    defaultLabel: "키움증권",
    terms: sortTermsLongFirst(["키움증권", "키움", "Kiwoom"]),
    sector: "금융",
  },
  {
    ticker: "006800",
    defaultLabel: "미래에셋증권",
    terms: sortTermsLongFirst(["미래에셋증권", "미래에셋", "Mirae Asset"]),
    sector: "금융",
  },
  {
    ticker: "016360",
    defaultLabel: "삼성증권",
    terms: sortTermsLongFirst(["삼성증권", "Samsung Securities"]),
    sector: "금융",
  },
  {
    ticker: "033780",
    defaultLabel: "KT&G",
    terms: sortTermsLongFirst(["KT&G", "케이티엔지", "KTG"]),
    sector: "제조",
  },
  {
    ticker: "030200",
    defaultLabel: "KT",
    terms: sortTermsLongFirst(["KT", "케이티"]),
    sector: "IT",
  },
  {
    ticker: "017670",
    defaultLabel: "SK텔레콤",
    terms: sortTermsLongFirst(["SK텔레콤", "SK telecom", "SKT"]),
    sector: "IT",
  },
  {
    ticker: "032830",
    defaultLabel: "삼성생명",
    terms: sortTermsLongFirst(["삼성생명"]),
    sector: "금융",
  },
  {
    ticker: "000810",
    defaultLabel: "삼성화재",
    terms: sortTermsLongFirst(["삼성화재"]),
    sector: "금융",
  },
  {
    ticker: "012330",
    defaultLabel: "현대모비스",
    terms: sortTermsLongFirst(["현대모비스", "Hyundai Mobis"]),
    sector: "제조",
  },
  {
    ticker: "005380",
    defaultLabel: "현대차",
    terms: sortTermsLongFirst(["현대자동차", "현대차"]),
    sector: "제조",
  },
  {
    ticker: "000270",
    defaultLabel: "기아",
    terms: sortTermsLongFirst(["기아", "Kia"]),
    sector: "제조",
  },
  {
    ticker: "066570",
    defaultLabel: "LG전자",
    terms: sortTermsLongFirst(["LG전자", "LG Electronics"]),
    sector: "제조",
  },
  {
    ticker: "096770",
    defaultLabel: "SK이노베이션",
    terms: sortTermsLongFirst(["SK이노베이션", "SK에너지", "SK가스"]),
    sector: "화학",
  },
  {
    ticker: "015760",
    defaultLabel: "한국전력",
    terms: sortTermsLongFirst(["한국전력공사", "한국전력", "KEPCO"]),
    sector: "에너지",
  },
  {
    ticker: "034020",
    defaultLabel: "두산에너빌리티",
    terms: sortTermsLongFirst(["두산에너빌리티", "두산중공업"]),
    sector: "제조",
  },
  {
    ticker: "009150",
    defaultLabel: "삼성전기",
    terms: sortTermsLongFirst(["삼성전기"]),
    sector: "제조",
  },
  {
    ticker: "010130",
    defaultLabel: "고려아연",
    terms: sortTermsLongFirst(["고려아연"]),
    sector: "화학",
  },
  {
    ticker: "035250",
    defaultLabel: "강원랜드",
    terms: sortTermsLongFirst(["강원랜드"]),
    sector: "기타",
  },
  {
    ticker: "018260",
    defaultLabel: "삼성에스디에스",
    terms: sortTermsLongFirst(["삼성에스디에스", "삼성SDS"]),
    sector: "IT",
  },
  {
    ticker: "011200",
    defaultLabel: "HMM",
    terms: sortTermsLongFirst(["HMM", "에이치엠엠", "현대상선"]),
    sector: "운송",
  },
  {
    ticker: "024110",
    defaultLabel: "기업은행",
    terms: sortTermsLongFirst(["기업은행", "IBK", "IBK기업은행"]),
    sector: "금융",
  },
  {
    ticker: "071050",
    defaultLabel: "한국금융지주",
    terms: sortTermsLongFirst(["한국금융지주", "한국투자증권"]),
    sector: "금융",
  },
  {
    ticker: "078930",
    defaultLabel: "GS",
    terms: sortTermsLongFirst(["GS건설", "GS칼텍스", "GS EPS"]),
    sector: "지주",
    mapLabel: () => "GS",
  },
];

export function resolveListedKrx(osmName: string): ListedResolve | null {
  const raw = osmName.trim();
  const n = normalize(raw);
  if (!n) return null;

  let best: { len: number; ruleIndex: number; termIndex: number; rule: Rule } | null = null;

  for (let ri = 0; ri < RULES.length; ri++) {
    const rule = RULES[ri];
    for (let ti = 0; ti < rule.terms.length; ti++) {
      const term = rule.terms[ti];
      const nt = normalize(term);
      if (nt.length < 2) continue;
      if (!n.includes(nt)) continue;

      if (
        !best ||
        nt.length > best.len ||
        (nt.length === best.len && (ri < best.ruleIndex || (ri === best.ruleIndex && ti < best.termIndex)))
      ) {
        best = { len: nt.length, ruleIndex: ri, termIndex: ti, rule };
      }
    }
  }

  if (!best) return null;

  const mapDisplayName = best.rule.mapLabel ? best.rule.mapLabel(raw) : best.rule.defaultLabel;

  return {
    ticker: best.rule.ticker,
    mapDisplayName,
    sector: best.rule.sector,
  };
}
