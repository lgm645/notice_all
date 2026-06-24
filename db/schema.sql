-- 통합 공지 테이블 (수집기 write / 웹 read)
-- id 는 `${source_id}:${external_id}` 자연키 → 같은 글의 중복 upsert 를 멱등 보장.
create table if not exists notices (
  id             text primary key,
  source_id      text        not null,
  source_name    text        not null,
  category       text        not null,
  title          text        not null,
  url            text        not null,
  author         text,
  published_at   timestamptz,            -- KST 로 정규화된 게시일시 (날짜만 있으면 00:00+09)
  published_date date,                   -- 날짜만 필요한 화면용 편의 컬럼
  has_attachment boolean     not null default false,
  is_fixed       boolean     not null default false,  -- 상단 고정/공지
  views          integer,
  summary        text,                   -- (선택) 본문 일부 — Phase 1 에서는 미사용
  external_id    text        not null,   -- 출처별 안정 ID (wr_id, seqNo, idx, doc_no...)
  scraped_at     timestamptz not null default now(),  -- 마지막으로 본 시각
  first_seen_at  timestamptz not null default now()   -- 우리 시스템에 처음 들어온 시각 ("새 글" 판정용)
);

create index if not exists notices_published_idx on notices (published_at desc nulls last);
create index if not exists notices_first_seen_idx on notices (first_seen_at desc);
create index if not exists notices_source_idx    on notices (source_id);
create index if not exists notices_category_idx  on notices (category);

-- 간단 키워드 검색용 (Phase 1 은 ILIKE 사용, 추후 tsvector 로 확장 가능)
create index if not exists notices_title_trgm_idx on notices (lower(title));
