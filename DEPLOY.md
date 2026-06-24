# 배포 가이드 (무료 티어 공개 운영)

로컬은 PGlite, 운영은 **Supabase(DB) + Vercel(웹) + GitHub Actions(수집)** 조합이면
**무료 티어로 공개 운영**할 수 있다. 모두 코드 변경 없이 환경변수만 바꾸면 된다.

## 1. Supabase (DB)

1. <https://supabase.com> 에서 프로젝트 생성.
2. **Project Settings → Database → Connection string (URI)** 복사
   (예: `postgresql://postgres:[PW]@db.[ref].supabase.co:5432/postgres`).
3. 스키마 적용 — 로컬에서 한 번:
   ```bash
   DB_DRIVER=postgres DATABASE_URL="<위 URI>" npm run db:init
   ```
   (또는 Supabase SQL Editor 에 `db/schema.sql` 붙여넣기)

## 2. Vercel (웹앱)

1. GitHub 저장소를 Vercel 에 import (Next.js 자동 인식).
2. **Environment Variables** 에 추가:
   - `DB_DRIVER = postgres`
   - `DATABASE_URL = <Supabase URI>`
3. Deploy → `https://<프로젝트>.vercel.app` 공개.

> 웹앱은 DB 를 **읽기만** 하므로, 수집기가 멈춰도 사이트는 계속 동작한다.

## 3. GitHub Actions (주기 수집)

이미 `.github/workflows/scrape.yml` 가 있다 (6시간마다 + 수동 실행).

1. 저장소 **Settings → Secrets and variables → Actions** 에 추가:
   - `DATABASE_URL = <Supabase URI>`
   - `SCRAPER_CONTACT = <연락 이메일>` (선택, User-Agent 에 포함)
2. Actions 탭에서 `scrape` 워크플로를 한 번 수동 실행해 확인.
3. 이후 6시간마다 자동으로 수집 → Supabase 에 upsert → 웹에 반영.

수집 주기를 바꾸려면 `scrape.yml` 의 `cron` 을 수정한다
(예: 3시간마다 `0 */3 * * *`).

## 4. 비용 메모

| 구성요소 | 티어 | 한도(대략) |
|---|---|---|
| Vercel | Hobby(무료) | 개인 프로젝트 충분 |
| Supabase | Free | 500MB DB · 공지 텍스트라면 수십만 건 여유 |
| GitHub Actions | Free | 월 2,000분 · 6시간 주기면 미미 |

세 가지 모두 무료 범위에서 공개 운영 가능하다. 트래픽이 커지면 Vercel/Supabase 유료 티어로 확장.
