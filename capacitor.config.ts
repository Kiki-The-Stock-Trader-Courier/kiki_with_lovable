import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Vite 빌드 출력(dist)을 네이티브 WebView에 싣습니다.
 * 배포 URL을 쓰려면 server.url 을 설정하고 개발 시에만 사용하세요.
 */
const config: CapacitorConfig = {
  appId: "kr.cashwalk.stockmap",
  appName: "워키포인트",
  webDir: "dist",
  server: {
    // Android WebView에서 https 타일·API와 동일한 스킴 권장
    androidScheme: "https",
  },
};

export default config;
