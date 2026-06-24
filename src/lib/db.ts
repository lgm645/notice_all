import type { NoticeItem } from "./types";
import { makeNoticeId } from "./normalize";

// ── DB 드라이버 추상화 ────────────────────────────────────────────
// 로컬:  PGlite (임베디드 Postgres, WASM) — 외부 서비스 불필요
// 배포:  postgres.js + 실제 Postgres/Supabase
// 둘 다 진짜 Postgres 라 동일 SQL 이 그대로 동작한다. DB_DRIVER 로 선택.
type Row = Record<string, any>;

interface Driver {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  exec(text: string): Promise<void>;
  end(): Promise<void>;
}

let _driver: Promise<Driver> | null = null;

function driver(): Promise<Driver> {
  if (!_driver) _driver = init();
  return _driver;
}

async function init(): Promise<Driver> {
  const kind = process.env.DB_DRIVER ?? "pglite";

  if (kind === "postgres") {
    const { default: postgres } = await import("postgres");
    const url = process.env.DATABASE_URL ?? "";
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    const sql = postgres(url, {
      // 서버리스(Vercel)에서 Supabase 트랜잭션 풀러(PgBouncer, 6543)를 쓰려면 필수:
      prepare: false,
      max: Number(process.env.PG_POOL_MAX ?? 3),
      ssl: isLocal ? undefined : "require",
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    });
    return {
      query: (t, p = []) => sql.unsafe(t, p as never[]) as unknown as Promise<Row[]>,
      exec: async (t) => {
        await sql.unsafe(t);
      },
      end: () => sql.end(),
    };
  }

  // 기본: PGlite (파일 백업, 단일 프로세스)
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(process.env.PGLITE_DATA ?? "./.pgdata");
  await pg.waitReady;
  return {
    query: async (t, p = []) => (await pg.query(t, p)).rows as Row[],
    exec: async (t) => {
      await pg.exec(t);
    },
    end: () => pg.close(),
  };
}

export async function initSchema(schemaSql: string): Promise<void> {
  await (await driver()).exec(schemaSql);
}

export async function endDb(): Promise<void> {
  if (_driver) {
    const d = await _driver;
    await d.end();
    _driver = null;
  }
}

// ── 쓰기: 멱등 upsert ─────────────────────────────────────────────
const COLS = [
  "id", "source_id", "source_name", "category", "title", "url", "author",
  "published_at", "published_date", "has_attachment", "is_fixed", "views", "external_id",
] as const;

export async function upsertNotices(items: NoticeItem[]) {
  if (items.length === 0) return { total: 0, inserted: 0, updated: 0 };
  const d = await driver();

  // 한 번의 수집 안에서 같은 글이 두 번(상단 고정 + 일반 목록) 잡히면 id 가 겹친다.
  // 한 INSERT 문이 동일 conflict 행을 두 번 건드리면 에러나므로 배치 내 중복 제거.
  const byId = new Map<string, NoticeItem>();
  for (const n of items) byId.set(makeNoticeId(n.sourceId, n.externalId), n);
  const deduped = [...byId.values()];

  const params: unknown[] = [];
  const tuples = deduped
    .map((n) => {
      const row: Record<string, unknown> = {
        id: makeNoticeId(n.sourceId, n.externalId),
        source_id: n.sourceId,
        source_name: n.sourceName,
        category: n.category,
        title: n.title,
        url: n.url,
        author: n.author ?? null,
        published_at: n.publishedAt ?? null,
        published_date: n.publishedDate ?? null,
        has_attachment: n.hasAttachment ?? false,
        is_fixed: n.isFixed ?? false,
        views: n.views ?? null,
        external_id: n.externalId,
      };
      const base = params.length;
      params.push(...COLS.map((c) => row[c]));
      return `(${COLS.map((_, j) => `$${base + j + 1}`).join(",")})`;
    })
    .join(",");

  // xmax = 0 → 이번에 새로 insert 된 행 (갱신과 구분).
  const text = `
    insert into notices (${COLS.join(",")}) values ${tuples}
    on conflict (id) do update set
      source_name    = excluded.source_name,
      category       = excluded.category,
      title          = excluded.title,
      url            = excluded.url,
      author         = excluded.author,
      published_at   = excluded.published_at,
      published_date = excluded.published_date,
      has_attachment = excluded.has_attachment,
      is_fixed       = excluded.is_fixed,
      views          = excluded.views,
      scraped_at     = now()
    returning (xmax = 0) as inserted`;

  const res = await d.query(text, params);
  const inserted = res.filter((r) => r.inserted).length;
  return { total: deduped.length, inserted, updated: deduped.length - inserted };
}

// ── 읽기: 통합 피드 + 필터 + 검색 ────────────────────────────────
export interface NoticeFilter {
  source?: string;
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function getNotices(f: NoticeFilter = {}): Promise<Row[]> {
  const d = await driver();
  const limit = Math.min(f.limit ?? 50, 200);
  const offset = Math.max(f.offset ?? 0, 0);
  const source = f.source ?? null;
  const category = f.category ?? null;
  const q = f.q ? `%${f.q}%` : null;

  return d.query(
    `select
       id, source_id, source_name, category, title, url, author,
       to_char((coalesce(published_at, first_seen_at) at time zone 'Asia/Seoul'), 'YYYY-MM-DD') as display_date,
       has_attachment, is_fixed, views,
       (extract(epoch from first_seen_at) * 1000)::float8 as first_seen_ms,
       (extract(epoch from coalesce(published_at, first_seen_at)) * 1000)::float8 as pub_ms
     from notices
     where ($1::text is null or source_id = $1)
       and ($2::text is null or category = $2)
       and ($3::text is null or title ilike $3)
     order by coalesce(published_at, first_seen_at) desc, id desc
     limit $4 offset $5`,
    [source, category, q, limit, offset],
  );
}

export async function countNotices(f: NoticeFilter = {}): Promise<number> {
  const d = await driver();
  const source = f.source ?? null;
  const category = f.category ?? null;
  const q = f.q ? `%${f.q}%` : null;
  const rows = await d.query(
    `select count(*)::int as n from notices
     where ($1::text is null or source_id = $1)
       and ($2::text is null or category = $2)
       and ($3::text is null or title ilike $3)`,
    [source, category, q],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function getFacets(): Promise<{ sources: Row[]; categories: Row[] }> {
  const d = await driver();
  const [sources, categories] = await Promise.all([
    d.query(
      `select source_id, source_name, count(*)::int as count
       from notices group by 1, 2 order by source_name`,
    ),
    d.query(
      `select category, count(*)::int as count
       from notices group by 1 order by category`,
    ),
  ]);
  return { sources, categories };
}
