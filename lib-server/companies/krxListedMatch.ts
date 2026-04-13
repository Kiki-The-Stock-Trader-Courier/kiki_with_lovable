/**
 * OpenStreetMap 등에서 수집한 상호명 → KRX 6자리 종목코드 매칭.
 * 부분 문자열(정규화 후)로 매칭하며, 더 긴 키워드가 우선합니다.
 */

export type ListedResolve = {
  ticker: string;
  /** KRX 상장 법인 정식명 (예: BGF리테일) — 시트·시세 매칭용 */
  stockName: string;
  /** 지도 마커·간판 느낌 표시 (예: CU BGF리테일) */
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
    terms: sortTermsLongFirst(["이마트24", "이마트 에브리데이", "이마트", "e-mart", "emart"]),
    sector: "유통",
  },
  {
    ticker: "004170",
    defaultLabel: "신세계",
    terms: sortTermsLongFirst([
      "코스트코",
      "Costco",
      "스타필드",
      "Starfield",
      "신세계백화점",
      "신세계",
      "SSG",
      "ssg닷컴",
    ]),
    sector: "유통",
    mapLabel: (raw) => {
      const n = normalize(raw);
      if (n.includes("코스트코") || /costco/i.test(raw)) return "코스트코 신세계";
      if (n.includes("스타필드") || /starfield/i.test(raw)) return "스타필드 신세계";
      return "신세계";
    },
  },
  {
    ticker: "023530",
    defaultLabel: "롯데지주",
    terms: sortTermsLongFirst([
      "세븐일레븐",
      "7-Eleven",
      "7 eleven",
      "7eleven",
      "코리아세븐",
      "롯데리아",
      "롯데백화점",
      "롯데마트",
      "롯데",
      "LOTTE",
    ]),
    sector: "유통",
    mapLabel: (raw) => {
      const n = normalize(raw);
      if (n.includes("세븐") || /7[\s-]?eleven/i.test(raw)) return "세븐일레븐 롯데";
      if (n.includes("롯데리아")) return "롯데리아 롯데";
      return "롯데";
    },
  },
  /** SPC그룹 — 베이커리·외식 브랜드 */
  {
    ticker: "005610",
    defaultLabel: "SPC삼립",
    terms: sortTermsLongFirst([
      "파리바게뜨",
      "Paris Baguette",
      "파스쿠찌",
      "던킨도너츠",
      "던킨",
      "Dunkin",
      "배스킨라빈스",
      "Baskin",
      "베스킨",
      "SPC",
      "삼립",
    ]),
    sector: "유통",
    mapLabel: (raw) => {
      const n = normalize(raw);
      if (n.includes("파리") || /paris/i.test(raw)) return "파리바게뜨 SPC삼립";
      if (n.includes("던킨") || /dunkin/i.test(raw)) return "던킨 SPC삼립";
      if (n.includes("배스킨") || n.includes("베스킨") || /baskin/i.test(raw)) return "배스킨라빈스 SPC삼립";
      return "SPC삼립";
    },
  },
  /** 더본코리아 — 빽다방 등 */
  {
    ticker: "475560",
    defaultLabel: "더본코리아",
    terms: sortTermsLongFirst(["빽다방", "Paik's", "Paik", "더본", "The Born"]),
    sector: "유통",
    mapLabel: () => "빽다방 더본코리아",
  },
  /** CJ프레시웨이 — 뚜레쥬르 등 */
  {
    ticker: "035760",
    defaultLabel: "CJ프레시웨이",
    terms: sortTermsLongFirst(["뚜레쥬르", "Tous les Jours", "빕스", "VIPS"]),
    sector: "유통",
    mapLabel: (raw) => (normalize(raw).includes("뚜레") ? "뚜레쥬르 CJ프레시웨이" : "CJ프레시웨이"),
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

  // ── 아래는 매장·지점·간판에서 자주 노출되는 상장사 (키워드 보강) ──
  {
    ticker: "323410",
    defaultLabel: "카카오뱅크",
    terms: sortTermsLongFirst(["카카오뱅크", "KakaoBank", "Kakao Bank", "카뱅"]),
    sector: "금융",
  },
  {
    ticker: "024030",
    defaultLabel: "한국산업은행",
    terms: sortTermsLongFirst(["한국산업은행", "산업은행", "KDB"]),
    sector: "금융",
  },
  {
    ticker: "138930",
    defaultLabel: "BNK금융지주",
    terms: sortTermsLongFirst(["BNK금융", "부산은행", "경남은행", "대구은행", "iM뱅크"]),
    sector: "금융",
  },
  {
    ticker: "086320",
    defaultLabel: "쿠팡",
    terms: sortTermsLongFirst(["쿠팡", "Coupang", "로켓배송"]),
    sector: "유통",
  },
  {
    ticker: "352820",
    defaultLabel: "하이브",
    terms: sortTermsLongFirst(["하이브", "HYBE", "빅히트", "Big Hit"]),
    sector: "IT",
  },
  {
    ticker: "251270",
    defaultLabel: "넷마블",
    terms: sortTermsLongFirst(["넷마블", "Netmarble"]),
    sector: "IT",
  },
  {
    ticker: "036570",
    defaultLabel: "엔씨소프트",
    terms: sortTermsLongFirst(["엔씨소프트", "NC소프트", "NC Soft", "리니지"]),
    sector: "IT",
  },
  {
    ticker: "263750",
    defaultLabel: "펄어비스",
    terms: sortTermsLongFirst(["펄어비스", "Pearl Abyss", "검은사막"]),
    sector: "IT",
  },
  {
    ticker: "041510",
    defaultLabel: "에스엠",
    terms: sortTermsLongFirst(["SM엔터", "SM Entertainment", "에스엠"]),
    sector: "엔터",
  },
  {
    ticker: "035900",
    defaultLabel: "JYP Ent.",
    terms: sortTermsLongFirst(["JYP", "JYP엔터"]),
    sector: "유통",
  },
  {
    ticker: "122870",
    defaultLabel: "와이지엔터",
    terms: sortTermsLongFirst(["YG엔터", "YG Entertainment", "와이지"]),
    sector: "유통",
  },
  {
    ticker: "034220",
    defaultLabel: "LG디스플레이",
    terms: sortTermsLongFirst(["LG디스플레이", "LG Display"]),
    sector: "제조",
  },
  {
    ticker: "029780",
    defaultLabel: "삼성카드",
    terms: sortTermsLongFirst(["삼성카드", "Samsung Card"]),
    sector: "금융",
  },
  {
    ticker: "097950",
    defaultLabel: "CJ제일제당",
    terms: sortTermsLongFirst([
      "CJ제일제당",
      "CJ푸드빌",
      "빕스",
      "제일제당",
      "CJ제당",
    ]),
    sector: "유통",
    mapLabel: (raw) => (normalize(raw).includes("빕스") ? "빕스 CJ제일제당" : "CJ제일제당"),
  },
  {
    ticker: "271560",
    defaultLabel: "오리온",
    terms: sortTermsLongFirst(["오리온", "Orion", "초코파이"]),
    sector: "유통",
  },
  {
    ticker: "000080",
    defaultLabel: "하이트진로",
    terms: sortTermsLongFirst(["하이트진로", "하이트", "진로", "테라"]),
    sector: "유통",
  },
  {
    ticker: "017810",
    defaultLabel: "풀무원",
    terms: sortTermsLongFirst(["풀무원", "Pulmuone"]),
    sector: "유통",
  },
  {
    ticker: "051900",
    defaultLabel: "LG생활건강",
    terms: sortTermsLongFirst(["LG생활건강", "엘지생활건강", "THE FACE SHOP", "후", "Whoo"]),
    sector: "유통",
  },
  /** 올리브영 등 CJ 계열 유통 — 비상장 자회사가 많아 지주(001040)로 매핑 */
  {
    ticker: "001040",
    defaultLabel: "CJ",
    terms: sortTermsLongFirst(["올리브영", "Olive Young", "CJ올리브영"]),
    sector: "지주",
    mapLabel: () => "올리브영·CJ",
  },
  {
    ticker: "090430",
    defaultLabel: "아모레퍼시픽",
    terms: sortTermsLongFirst([
      "아모레퍼시픽",
      "아모레",
      "에뛰드",
      "Etude",
      "라네즈",
      "Laneige",
      "설화수",
    ]),
    sector: "유통",
  },
  {
    ticker: "004370",
    defaultLabel: "농심",
    terms: sortTermsLongFirst(["농심", "Nongshim", "신라면"]),
    sector: "유통",
  },
  {
    ticker: "097520",
    defaultLabel: "CJ ENM",
    terms: sortTermsLongFirst(["CJ ENM", "씨제이이엔엠", "tvN", "Mnet"]),
    sector: "유통",
  },
];

/** OSM name·brand·operator·추가 텍스트를 합쳐 매칭 (mapLabel에는 osmName 우선 사용) */
export function resolveListedKrx(
  osmName: string,
  ctx?: { brand?: string; operator?: string; /** DB description·다국어 상호 등 매칭만 보강 */ searchExtra?: string },
): ListedResolve | null {
  const raw = osmName.trim();
  const blob = [raw, ctx?.brand, ctx?.operator, ctx?.searchExtra].filter(Boolean).join(" ");
  const n = normalize(blob);
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

  const mapDisplayName = best.rule.mapLabel ? best.rule.mapLabel(raw || ctx?.brand || "") : best.rule.defaultLabel;

  return {
    ticker: best.rule.ticker,
    stockName: best.rule.defaultLabel,
    mapDisplayName,
    sector: best.rule.sector,
  };
}
