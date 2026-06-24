import { loadFeed } from "../_lib/loadFeed";
import RefreshButton from "../../components/RefreshButton";
import NewSinceController from "../../components/NewSinceController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = "/preview/broadsheet";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const d = await loadFeed(sp, BASE);

  return (
    <main data-design="broadsheet" className="bs">
      <header className="bs-masthead">
        <div className="bs-rule-top">
          <span>제1호</span>
          <span>慶北大學校 公告新聞</span>
          <span>KST · 최신순</span>
        </div>
        <h1 className="bs-title">
          공지<span>신문</span>
        </h1>
        <div className="bs-rule-sub">
          <span className="bs-strap">경북대학교 · 한국장학재단 11개 게시판 통합 자동 수집</span>
          <RefreshButton />
        </div>
        <div id="new-banner" className="bs-banner" aria-live="polite" />
      </header>

      <form className="bs-search" method="get">
        <input
          type="search"
          name="q"
          placeholder="기사 검색…"
          defaultValue={d.q ?? ""}
          aria-label="검색"
        />
        <select name="source" defaultValue={d.source ?? ""} aria-label="지면">
          <option value="">전체 지면</option>
          {d.facets.sources.map((s) => (
            <option key={s.source_id} value={s.source_id}>
              {s.source_name} ({s.count})
            </option>
          ))}
        </select>
        <select name="category" defaultValue={d.category ?? ""} aria-label="섹션">
          <option value="">전체 섹션</option>
          {d.facets.categories.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category} ({c.count})
            </option>
          ))}
        </select>
        <button type="submit">검색</button>
        <a className="bs-reset" href={BASE}>
          초기화
        </a>
      </form>

      {d.dbError ? (
        <div className="bs-empty">신문을 인쇄하지 못했습니다 — {d.dbError}</div>
      ) : d.notices.length === 0 ? (
        <div className="bs-empty">오늘 지면에 실린 기사가 없습니다.</div>
      ) : (
        <section className="bs-paper">
          {d.notices.map((n) => (
            <article
              key={n.id}
              className="bs-art"
              data-firstseen={Math.round(n.first_seen_ms)}
            >
              <div className="bs-kicker">
                <span className="bs-section">{n.category}</span>
                {n.is_fixed ? <span className="bs-fixed">긴급</span> : null}
                <span className="bs-new">NEW</span>
              </div>
              <a
                className="bs-head"
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {n.title}
                {n.has_attachment ? <span className="bs-clip">▣</span> : null}
              </a>
              <div className="bs-byline">
                <span className="bs-source">{n.source_name}</span>
                <span>{n.display_date}</span>
                {n.author ? <span>{n.author} 기자</span> : null}
                {n.views != null ? <span>열독 {n.views}</span> : null}
              </div>
            </article>
          ))}
        </section>
      )}

      {d.totalPages > 1 ? (
        <nav className="bs-pager">
          {d.pageNum > 1 ? (
            <a href={d.pageHref(d.pageNum - 1)}>◀ 이전 면</a>
          ) : (
            <span className="off">◀ 이전 면</span>
          )}
          <span className="bs-pageno">
            제 {d.pageNum} 면 · 총 {d.totalPages} 면
          </span>
          {d.pageNum < d.totalPages ? (
            <a href={d.pageHref(d.pageNum + 1)}>다음 면 ▶</a>
          ) : (
            <span className="off">다음 면 ▶</span>
          )}
        </nav>
      ) : null}

      <footer className="bs-foot">
        <span>
          총 {d.total}건 · 출처 {d.facets.sources.length}곳 · 제{d.pageNum}면
        </span>
        <a href={d.feedHref}>RSS 정기구독</a>
      </footer>

      <NewSinceController />
    </main>
  );
}
