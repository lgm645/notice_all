# 경북대 공지 통합 알리미 (knu-notice-board)

경북대학교·한국장학재단의 여러 공지 게시판을 자동 수집해 **한 화면에서 최신순으로** 모아보는 웹 서비스.

- **수집기(scraper)** 가 각 게시판을 긁어 DB 에 `upsert` 하고,
- **웹앱(Next.js)** 은 DB 만 읽어 통합 피드를 보여준다.
- 둘은 DB 로 느슨하게 연결되어, **수집기가 죽어도 웹은 계속 동작**한다.

> 현재 상태: **MVP 동작 + 확장 일부 완료.** 5개 어댑터(`gnuboard`·`knu-wbbs`·`see`·`home-knu-cms`·`kosaf`)로
> **11개 게시판**을 수집 → 저장(멱등) → 통합 피드(필터·검색·새 글·모바일) 까지 동작.
> **RSS 피드**(`/feed.xml`)와 **GitHub Actions 주기 수집**도 포함. 크누큐브는 로그인 벽이라 보류.

---

## 1. 사전 준비

- **Node.js 20.9+** — GitHub Actions 운영 수집은 Node.js 24를 사용한다.
- 로컬 DB 는 **PGlite(임베디드 Postgres)** 라 Docker·외부 DB 가 **필요 없다**.
  데이터는 프로젝트 안 `.pgdata/` 디렉터리에 파일로 저장된다.

## 2. 빠른 시작

```bash
# 0) 의존성 (.env 는 이미 PGlite 로 설정돼 있음)
npm install

# 1) 테이블 생성
npm run db:init

# 2) 수집 (전체 11개 게시판). 한 곳만 하려면: npm run scrape:cse
npm run scrape
#    파싱만 확인하고 DB 저장은 건너뛰려면:
#    npm run scrape -- --dry          (전체)
#    npx tsx src/scraper/scrape.ts --source cse --dry   (한 곳)

# 3) 웹앱 실행 → http://localhost:3000
npm run dev
```

> ⚠️ **PGlite 는 단일 프로세스다.** 개발 서버(`npm run dev`)가 켜진 상태에서는
> `.pgdata` 를 점유하므로, **수집을 돌릴 땐 dev 서버를 잠시 끄거나** 아래의
> Docker/Supabase Postgres(다중 접속 가능)를 쓰면 된다. cron 으로 자동 수집하는
> 운영 환경에서는 어차피 실제 Postgres(Supabase)를 쓰므로 이 제약은 사라진다.

### (대안) 실제 Postgres 로 돌리기 — Docker 가 있다면

```bash
docker compose up -d                  # 로컬 Postgres 16
# .env 를 다음으로 교체:
#   DB_DRIVER=postgres
#   DATABASE_URL=postgresql://knu:knu@localhost:5432/knu_notices
npm run db:init && npm run scrape:cse && npm run dev
```

## 3. 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | Next.js 개발 서버 (통합 피드) |
| `npm run build` / `npm run start` | 프로덕션 빌드 / 실행 |
| `npm run db:init` | `db/schema.sql` 적용 (멱등) |
| `npm run scrape:cse` | 컴퓨터학부만 수집 |
| `npm run scrape` | `enabled` 인 모든 소스 수집 |
| `npx tsx src/scraper/scrape.ts --source <id> --dry` | DB 저장 없이 파싱 결과 확인 |

## 4. 아키텍처

```
src/
  lib/
    types.ts        # Notice / SourceConfig / SourceAdapter 인터페이스
    http.ts         # fetch + 일시 장애 자동 재시도 + 인코딩 감지(UTF-8/EUC-KR) + User-Agent
    normalize.ts    # 날짜 KST 정규화, 텍스트 정리, 중복키 생성
    db.ts           # postgres.js — upsert(쓰기) / getNotices·getFacets(읽기)
    logger.ts       # KST 타임스탬프 로거
  sources/
    config.ts       # ★ 수집 대상 게시판 레지스트리 (설정, 코드 아님)
    registry.ts     # platform → adapter 매핑
    adapters/
      gnuboard.ts     # cse, startup (bbs/board.php?wr_id)
      knu-wbbs.ts     # knu-main(doc_no), knu-haksa(doRead bltn_no)
      see.ts          # 전자공학부(fidx, 위치 기반 표)
      home-knu-cms.ts # seeai/volunteer/knussw/aic/library (base64 mv_data→idx)
      kosaf.ts        # 한국장학재단(seqNo)
  scraper/
    db-init.ts        # 스키마 적용
    scrape.ts         # 수집 CLI (소스별 에러 격리 · 0건 실패 감지 · Actions 실행 요약)
  app/
    page.tsx          # 통합 피드 (필터/검색/새 글/페이지네이션)
    feed.xml/route.ts # RSS 2.0 피드
    components/        # Filters, NewSinceController
db/schema.sql         # notices 테이블 + 인덱스
.github/workflows/scrape.yml  # 주기 수집 cron
docker-compose.yml    # (선택) 로컬 Postgres
```

**데이터 모델 (`notices`)** — 중복키 `id = "{source_id}:{external_id}"` 로 멱등 upsert.
출처마다 안정 ID 가 다르다: gnuboard=`wr_id`, knu-wbbs=`doc_no/bltn_no/fidx`,
home-knu-cms=`idx`(base64 디코드), kosaf=`seqNo`.

---

## 5. ★ 새 게시판(소스) 추가하기

목표: **"어댑터 1개 + 설정 1줄"**. 같은 플랫폼이면 어댑터 없이 설정만 추가하면 된다.

### A. 이미 어댑터가 있는 플랫폼이면 (예: 또 다른 gnuboard 게시판)

`src/sources/config.ts` 의 `SOURCES` 배열에 한 줄 추가:

```ts
{
  id: "startup",                 // 고유 식별자 (중복키 네임스페이스)
  name: "경북대 창업지원단",       // 표시명
  category: "혜택",               // 소식 | 행사 | 혜택 | 학사 ...
  platform: "gnuboard",          // 재사용할 어댑터 키
  listUrl: "https://startup.knu.ac.kr/bbs/board.php?bo_table=noti2",
  enabled: true,
  options: { pages: 1, delayMs: 1500 },
}
```

→ `npx tsx src/scraper/scrape.ts --source startup --dry` 로 파싱 확인 후 `enabled: true`.

### B. 새 플랫폼이면 (HTML 구조가 다른 게시판)

1. **실물 HTML 확인** — 목록 페이지를 받아 행 구조/셀렉터 파악
   ```bash
   curl -sL "<목록 URL>" -o sample.html
   ```
2. **어댑터 작성** — `src/sources/adapters/<platform>.ts` 에
   `SourceAdapter` 를 구현. `fetchList(source, ctx)` 가 `NoticeItem[]` 를 돌려주면 된다.
   - 네트워크는 직접 만지지 말고 `ctx.fetchHtml(url)` 사용 (UA·인코딩·지연 처리됨)
   - 날짜는 `toKstIso()` / `normDate()`, 숫자는 `parseIntSafe()`, 텍스트는 `cleanText()`
   - `externalId` 에 **출처 내 안정 ID** 를 꼭 넣을 것 (중복 제거 핵심)
3. **레지스트리 등록** — `src/sources/registry.ts` 의 `ADAPTERS` 에 한 줄:
   ```ts
   export const ADAPTERS = { gnuboard: gnuboardAdapter, "knu-wbbs": knuWbbsAdapter };
   ```
4. **설정 추가** — `config.ts` 에 위 A 처럼 소스 한 줄 추가.
5. **검증** — `--dry` 로 파싱 결과를 보고, 0건이면 셀렉터를 재확인.

---

## 6. 정중한 크롤링 / 운영 메모

- 모든 요청에 식별 가능한 **User-Agent** 와 **요청 간 지연**(`delayMs`, 기본 1.5s) 적용.
- **일시 장애 재시도**: 네트워크 오류와 408/429/5xx 응답은 지수 백오프로 2회 재시도한다(총 3회 요청).
- **소스별 에러 격리**: 한 사이트가 깨져도 나머지 소스는 끝까지 수집·저장한다.
- **0건 반환 실패 처리**: 폐기된 URL이나 HTML 변경을 조기에 발견하도록 0건도 해당 소스의 실패로 기록한다.
- **인코딩**: Content-Type/`<meta>` charset 자동 감지, EUC-KR 도 변환(`iconv-lite`). 현재 대상은 전부 UTF-8.
- **robots 주의**: `home.knu.ac.kr` 계열(AI전공·자원봉사·장학복지·AIC·도서관)은
  robots `Disallow: /H*` 대상이다. 저빈도·지연·명확 UA 로 정중히 수집하기로 결정했으며,
  `config.ts` 의 `enabled` 로 언제든 끌 수 있다. **크누큐브**는 로그인 벽 + 전체 disallow 라 보류.

### GitHub Actions 실패 메일 읽기

- `공지 자동 수집`은 매시간 실행된다. 어떤 출처가 **재시도 후에도 실패**하면 GitHub가 실패 메일을 보낸다.
- 이때 웹사이트가 중단되는 것은 아니다. 정상 출처의 새 글은 먼저 저장되고, 웹앱은 기존 DB를 계속 보여준다.
- 메일의 **View workflow run**을 누르면 실행 요약에서 출처별 성공/실패, 수집 건수, 신규 건수를 한국어 표로 확인할 수 있다. 실패 출처와 원인은 오류 주석에도 바로 표시된다.
- 다음 실행이 성공하면 일시적인 상대 사이트/네트워크 장애였던 것이다. 같은 출처가 반복 실패하면 URL 폐기나 게시판 구조 변경을 점검한다.

## 7. 로드맵

- [x] **Phase 0** 셋업 · **Phase 1** 수직 슬라이스(cse)
- [x] **Phase 2** 어댑터 일반화 → 5개 어댑터로 11개 게시판 수집
- [x] **Phase 3** 통합 피드 · 출처/카테고리 필터 · 키워드 검색 · "새 글" · 페이지네이션 · 모바일 반응형
- [x] **Phase 4** GitHub Actions 매시간 수집 + 자동 재시도 + 소스별 에러 격리/요약 + 0건 실패 감지
- [x] **RSS 피드** (`/feed.xml`, 출처/카테고리별 구독 가능)
- [ ] **Phase 5** 계정/구독/북마크 (Supabase Auth — 구조는 열려 있음, DB만 추가)
- [ ] **Phase 6** 이메일 다이제스트/웹푸시 + 공개 배포(가이드: `DEPLOY.md`)
- [ ] **보류** 크누큐브(로그인 벽·robots Disallow) — 헤드리스+인증 필요

## 8. 배포로 승격 (나중에)

로컬 Postgres → **Supabase**: `.env` 의 `DATABASE_URL` 만 Supabase connection string 으로 교체.
웹앱은 **Vercel**, 수집기는 **GitHub Actions cron** 으로 옮기면 무료 티어로 공개 운영 가능.
