# 배포 가이드 — 무료 티어 공개 운영 (동시 사용자 < 1000)

구성: **Supabase(DB) + Vercel(웹) + GitHub Actions(수집)**.
코드는 그대로, **환경변수만** 바꾸면 로컬(PGlite) → 운영(Postgres)으로 전환된다.

## 왜 <1000 동접에도 무료로 버티나
- 웹은 **읽기 전용**이고, 피드는 **60초 캐시**(`unstable_cache`)된다. 공지는 6시간마다만 바뀌므로
  같은 화면을 1000명이 봐도 DB 질의는 필터 조합당 60초에 1번뿐 → DB 부하 거의 0.
- DB 연결은 **Supabase 트랜잭션 풀러(PgBouncer)** 를 쓴다(코드에 `prepare:false` 반영됨) →
  서버리스 함수가 많아도 연결 고갈 없음.
- 데이터는 공지 텍스트라 수만 건이어도 수 MB → Supabase Free(500MB) 여유.

---

## 1) Supabase — DB

1. <https://supabase.com> → 프로젝트 생성(리전: `Northeast Asia (Seoul)` 권장).
2. **Connect**(상단) 또는 **Project Settings → Database**에서 두 가지 연결 문자열을 확인:
   - **Transaction pooler** (포트 **6543**) — 웹앱(Vercel)용. 형태:
     `postgresql://postgres.[ref]:[PW]@aws-0-[region].pooler.supabase.com:6543/postgres`
   - **Direct** (포트 5432) 또는 Session pooler — 수집기(GitHub Actions)용.
3. 스키마 적용 — 로컬에서 한 번(아무 연결 문자열이나 가능):
   ```bash
   # PowerShell
   $env:DB_DRIVER="postgres"; $env:DATABASE_URL="<연결 문자열>"; npm run db:init
   ```
   또는 Supabase **SQL Editor**에 `db/schema.sql` 내용을 붙여넣고 실행.

## 2) GitHub — 코드 올리기

```bash
# 이미 git 저장소로 초기화 + 커밋되어 있음. 원격만 연결해 push:
git remote add origin https://github.com/<유저명>/knu-notice-board.git
git push -u origin main
```

## 3) Vercel — 웹앱

1. <https://vercel.com> → **Add New… → Project** → 위 GitHub 저장소 import (Next.js 자동 인식).
2. **Environment Variables**:
   | Key | Value |
   |---|---|
   | `DB_DRIVER` | `postgres` |
   | `DATABASE_URL` | **Transaction pooler URL (6543)** |
   | `PG_POOL_MAX` | `3` (선택, 기본 3) |
   | `FEED_REVALIDATE` | `60` (선택, 피드 캐시 초) |
3. **Deploy** → `https://<프로젝트>.vercel.app` 공개. (웹은 DB를 읽기만 하므로 수집기와 독립)

## 4) GitHub Actions — 주기 수집 (1시간마다)

`.github/workflows/scrape.yml` 가 이미 있다.
저장소 **Settings → Secrets and variables → Actions → New repository secret**:
| Secret | Value |
|---|---|
| `DATABASE_URL` | Direct(5432) 또는 Session pooler URL |
| `SCRAPER_CONTACT` | 연락 이메일 (선택, User-Agent에 포함) |

→ **Actions** 탭에서 `scrape` 워크플로를 **Run workflow**로 한 번 수동 실행해 적재 확인.
이후 6시간마다 자동 수집 → Supabase upsert → 60초 내 웹 반영.

## 5) 동작 확인
- `https://<프로젝트>.vercel.app` 에 공지 노출, 필터/검색/“새 글”/페이지네이션 동작.
- `https://<프로젝트>.vercel.app/feed.xml` RSS 정상.

---

## 비용 / 한도 (동접 < 1000 기준)

| 구성요소 | 티어 | 비고 |
|---|---|---|
| Vercel | Hobby(무료) | 개인·비상업 프로젝트. 60초 캐시로 함수 호출 적음 |
| Supabase | Free | 500MB DB·풀러 포함. 7일 무활동 시 일시정지 → 6h cron이 깨어 있게 함 |
| GitHub Actions | Free | 6h 주기면 월 수 분, 2,000분 한도 내 |

**확장 시**: 동접이 더 커지거나 비상업 제한이 걸리면 Vercel Pro / Supabase Pro로 올리면 된다.
수집 주기는 `scrape.yml`의 `cron`으로 조절(예: 3시간 `0 */3 * * *`).

## 환경변수 정리
| 변수 | 로컬 | 운영 |
|---|---|---|
| `DB_DRIVER` | `pglite` | `postgres` |
| `DATABASE_URL` | (불필요) | Supabase 연결 문자열 |
| `PGLITE_DATA` | `./.pgdata` | (불필요) |
| `PG_POOL_MAX` | — | `3` |
| `FEED_REVALIDATE` | `60` | `60` |
| `SCRAPER_CONTACT` | (선택) | (선택) |
