import {
  countNoticesCached as countNotices,
  getFacetsCached as getFacets,
  getNoticesCached as getNotices,
} from "../lib/queries";
import Filters from "./components/Filters";
import NewSinceController from "./components/NewSinceController";
import RefreshButton from "./components/RefreshButton";

export const dynamic = "force-dynamic"; // 항상 DB 에서 최신 읽기
export const runtime = "nodejs";

type Row = Record<string, any>;

function pick(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const source = pick(sp.source);
  const category = pick(sp.category);
  const q = pick(sp.q);

  const feedQs = new URLSearchParams();
  if (source) feedQs.set("source", source);
  if (category) feedQs.set("category", category);
  if (q) feedQs.set("q", q);
  const feedHref = "/feed.xml" + (feedQs.toString() ? `?${feedQs}` : "");

  const PAGE_SIZE = 50;
  const pageNum = Math.max(1, Number(pick(sp.page) ?? "1") || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (source) p.set("source", source);
    if (category) p.set("category", category);
    if (q) p.set("q", q);
    if (n > 1) p.set("page", String(n));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  let notices: Row[] = [];
  let facets: { sources: Row[]; categories: Row[] } = { sources: [], categories: [] };
  let total = 0;
  let dbError: string | null = null;

  try {
    [notices, facets, total] = await Promise.all([
      getNotices({ source, category, q, limit: PAGE_SIZE, offset }),
      getFacets(),
      countNotices({ source, category, q }),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="wrap">
      <header className="site-head">
        <h1>
          경북대 공지 통합 <span className="beta">알리미</span>
        </h1>
        <p className="sub">여러 게시판의 공지를 한 곳에서 · 최신순</p>
        <RefreshButton />
        <div id="new-banner" className="new-banner" aria-live="polite" />
      </header>

      {dbError ? (
        <div className="empty error">
          <p>DB 에 연결하지 못했습니다.</p>
          <pre>{dbError}</pre>
          <p>
            <code>docker compose up -d</code> → <code>npm run db:init</code> →{" "}
            <code>npm run scrape:cse</code> 순서로 실행했는지 확인하세요.
          </p>
        </div>
      ) : (
        <>
          <Filters facets={facets} current={{ source, category, q }} />

          {notices.length === 0 ? (
            <div className="empty">
              <p>
                표시할 공지가 없습니다. <code>npm run scrape:cse</code> 를 먼저 실행하세요.
              </p>
            </div>
          ) : (
            <ul className="feed">
              {notices.map((n) => (
                <li key={n.id} className="card" data-firstseen={Math.round(n.first_seen_ms)}>
                  <div className="card-top">
                    <span className="src">{n.source_name}</span>
                    <span className="cat">{n.category}</span>
                    {n.is_fixed ? <span className="pin">공지</span> : null}
                    <span className="new-badge">NEW</span>
                  </div>
                  <a className="title" href={n.url} target="_blank" rel="noopener noreferrer">
                    {n.title}
                    {n.has_attachment ? (
                      <span className="clip" title="첨부파일">
                        📎
                      </span>
                    ) : null}
                  </a>
                  <div className="meta">
                    <time>{n.display_date}</time>
                    {n.author ? <span>· {n.author}</span> : null}
                    {n.views != null ? <span>· 조회 {n.views}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav className="pager">
              {pageNum > 1 ? (
                <a href={pageHref(pageNum - 1)}>← 이전</a>
              ) : (
                <span className="disabled">← 이전</span>
              )}
              <span className="pageinfo">
                {pageNum} / {totalPages}
              </span>
              {pageNum < totalPages ? (
                <a href={pageHref(pageNum + 1)}>다음 →</a>
              ) : (
                <span className="disabled">다음 →</span>
              )}
            </nav>
          ) : null}
        </>
      )}

      <footer className="site-foot">
        {!dbError ? (
          <p>
            총 {total}건 · {pageNum}/{totalPages} 페이지 · 출처 {facets.sources.length}곳 ·{" "}
            <a href={feedHref}>RSS 구독</a>
          </p>
        ) : null}
        <p className="muted">경북대 공지 통합 알리미</p>
      </footer>

      <NewSinceController />
    </main>
  );
}
