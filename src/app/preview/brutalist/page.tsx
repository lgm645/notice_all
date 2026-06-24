import { loadFeed } from "../_lib/loadFeed";
import RefreshButton from "../../components/RefreshButton";
import NewSinceController from "../../components/NewSinceController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = "/preview/brutalist";

// 출처 id 를 안정적으로 0..7 색상 슬롯에 매핑 (색상-코딩용).
function hueSlot(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 8;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const d = await loadFeed(sp, BASE);

  const startIndex = (d.pageNum - 1) * d.pageSize;

  return (
    <main data-design="brutalist" className="br">
      {/* ===== MASTHEAD ===== */}
      <header className="br-mast">
        <div className="br-mast-top">
          <span className="br-tag">慶北大 / KNU</span>
          <span className="br-tag br-tag--mono">NOTICE_AGGREGATOR</span>
          <span className="br-tag br-tag--mono">v.2026</span>
        </div>

        <div className="br-mast-grid">
          <h1 className="br-logo">
            <span className="br-logo-a">공지</span>
            <span className="br-logo-b">모아</span>
          </h1>
          <p className="br-strap">
            경북대학교 · 한국장학재단 게시판을
            <br />
            <strong>한 화면</strong>에 모아 봅니다.
          </p>
          <div className="br-mast-stat">
            <span className="br-stat-num">{d.total}</span>
            <span className="br-stat-lbl">건 수집됨</span>
          </div>
        </div>

        <div className="br-mast-bar">
          <RefreshButton />
          <div id="new-banner" className="br-newbanner" aria-live="polite" />
        </div>
      </header>

      {/* ===== FILTER ===== */}
      <form className="br-filter" method="get">
        <div className="br-field br-field--q">
          <label className="br-field-lbl">검색</label>
          <input
            type="search"
            name="q"
            placeholder="제목으로 찾기…"
            defaultValue={d.q ?? ""}
            aria-label="검색어"
          />
        </div>
        <div className="br-field">
          <label className="br-field-lbl">출처</label>
          <select name="source" defaultValue={d.source ?? ""} aria-label="출처">
            <option value="">전체 출처</option>
            {d.facets.sources.map((s) => (
              <option key={s.source_id} value={s.source_id}>
                {s.source_name} ({s.count})
              </option>
            ))}
          </select>
        </div>
        <div className="br-field">
          <label className="br-field-lbl">분류</label>
          <select name="category" defaultValue={d.category ?? ""} aria-label="분류">
            <option value="">전체 분류</option>
            {d.facets.categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} ({c.count})
              </option>
            ))}
          </select>
        </div>
        <button className="br-submit" type="submit">
          적용 →
        </button>
        <a className="br-reset" href={BASE}>
          초기화
        </a>
      </form>

      {/* ===== ACTIVE FILTER STRIP ===== */}
      {d.q || d.source || d.category ? (
        <div className="br-active">
          <span className="br-active-lbl">필터</span>
          {d.q ? <span className="br-chip">검색: {d.q}</span> : null}
          {d.source ? (
            <span className="br-chip">
              출처: {d.facets.sources.find((s) => s.source_id === d.source)?.source_name ?? d.source}
            </span>
          ) : null}
          {d.category ? <span className="br-chip">분류: {d.category}</span> : null}
        </div>
      ) : null}

      {/* ===== FEED ===== */}
      {d.dbError ? (
        <div className="br-state br-state--err">
          <span className="br-state-big">ERROR</span>
          <p>데이터를 불러오지 못했습니다.</p>
          <code className="br-state-code">{d.dbError}</code>
        </div>
      ) : d.notices.length === 0 ? (
        <div className="br-state">
          <span className="br-state-big">없음</span>
          <p>조건에 맞는 공지가 없습니다.</p>
          <a className="br-reset" href={BASE}>
            전체 보기
          </a>
        </div>
      ) : (
        <section className="br-grid">
          {d.notices.map((n, i) => {
            const slot = hueSlot(String(n.source_id ?? n.source_name ?? ""));
            const idx = startIndex + i + 1;
            // 인텐셔널 미스얼라인: 일부 카드가 더 넓게/세로로 길게.
            const wide = n.is_fixed || idx % 7 === 0;
            return (
              <article
                key={n.id}
                className={`br-card${wide ? " br-card--wide" : ""}${
                  n.is_fixed ? " br-card--fixed" : ""
                }`}
                data-firstseen={Math.round(n.first_seen_ms)}
                data-slot={slot}
              >
                <div className="br-card-top">
                  <span className="br-idx">{String(idx).padStart(2, "0")}</span>
                  <span className="br-cat">{n.category || "공지"}</span>
                  <span className="br-new" aria-label="새 글">
                    NEW
                  </span>
                </div>

                {n.is_fixed ? <span className="br-pin">고정</span> : null}

                <a
                  className="br-card-title"
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {n.title}
                </a>

                <div className="br-card-meta">
                  <span className="br-src" data-slot={slot}>
                    {n.source_name}
                  </span>
                  <span className="br-date">{n.display_date}</span>
                  {n.author ? <span className="br-author">{n.author}</span> : null}
                  {n.has_attachment ? <span className="br-attach">첨부 ▣</span> : null}
                  {n.views != null ? (
                    <span className="br-views">
                      <b>{n.views.toLocaleString()}</b> 조회
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ===== PAGINATION ===== */}
      {d.totalPages > 1 ? (
        <nav className="br-pager">
          {d.pageNum > 1 ? (
            <a className="br-pg br-pg--prev" href={d.pageHref(d.pageNum - 1)}>
              ← 이전
            </a>
          ) : (
            <span className="br-pg br-pg--off">← 이전</span>
          )}
          <span className="br-pageno">
            <b>{d.pageNum}</b> / {d.totalPages}
          </span>
          {d.pageNum < d.totalPages ? (
            <a className="br-pg br-pg--next" href={d.pageHref(d.pageNum + 1)}>
              다음 →
            </a>
          ) : (
            <span className="br-pg br-pg--off">다음 →</span>
          )}
        </nav>
      ) : null}

      {/* ===== FOOTER ===== */}
      <footer className="br-foot">
        <div className="br-foot-l">
          <span className="br-foot-big">공지모아</span>
          <span className="br-foot-meta">
            총 {d.total}건 · 출처 {d.facets.sources.length}곳 · {d.pageNum}/{d.totalPages}면
          </span>
        </div>
        <a className="br-rss" href={d.feedHref}>
          RSS 구독 ▣
        </a>
      </footer>

      <NewSinceController />
    </main>
  );
}
