/** 라우터가 분류하는 사용자 의도 */
export type ChatIntent =
  | "price_fact"
  | "news_issue"
  | "company_profile"
  | "how_to_use_app"
  | "smalltalk"
  | "deep_analysis"
  | "general"
  | "unsafe";

export type ChatComplexity = "low" | "medium" | "high";
