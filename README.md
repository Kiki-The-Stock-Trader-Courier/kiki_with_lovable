# Stock Map App

## 주변 기업 데이터 파이프라인 (서울숲역/여의도역 1km)

이 프로젝트는 다음 순서로 주변 기업 데이터를 지도에 표시합니다.

1. `/api/companies/sync` 에서 OpenStreetMap Overpass를 통해
   - 서울숲역 반경 1km
   - 여의도역 반경 1km
   기업/오피스/상업 POI를 수집합니다.
2. 수집 결과를 Supabase `nearby_companies` 테이블에 upsert 저장합니다.
3. 앱의 지도 화면은 `/api/companies/nearby`로 현재 위치 반경 데이터를 조회해 표시합니다.
4. DB 응답이 비어있거나 실패하면 기존 목업 데이터로 fallback 합니다.

## Supabase 테이블 생성

`supabase/nearby_companies.sql`을 실행해 테이블을 먼저 생성하세요.

## 환경 변수

`.env.example`를 `.env`로 복사하고 값을 입력하세요.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 API upsert용, 절대 클라이언트 노출 금지)
- `COMPANY_SYNC_TOKEN` (수집 API 보호용)

## 데이터 수집 실행

서버 배포 후 아래처럼 동기화 API를 호출하면 DB가 채워집니다.

```bash
curl -X POST "https://<your-domain>/api/companies/sync" \
  -H "x-sync-token: <COMPANY_SYNC_TOKEN>"
```
