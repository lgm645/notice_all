import { loadFeed } from "../_lib/loadFeed";
import RefreshButton from "../../components/RefreshButton";
import NewSinceController from "../../components/NewSinceController";
import DarkToggle from "../../components/DarkToggle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = "/preview/bento";

// 소스별 고정 색조(hue). 알려진 소스는 손으로 맞추고, 모르는 소스는 id 해시로 분산.
const SOURCE_HUE: Record<string, number> = {
  cse: 252,
  startup: 28,
  "knu-main": 222,
  "knu-haksa": 200,
  see: 280,
  seeai: 300,
  volunteer: 150,
  knussw: 96,
  aic: 320,
  library: 8,
  kosaf: 48,
};

function hueFor(id: string): number {
  if (SOURCE_HUE[id] != null) return SOURCE_HUE[id];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

// views 를 0~1 인기 비율로. (페이지 내 최대값 기준)
function popRatio(v: number | null | undefined, max: number): number {
  if (!v || max <= 0) return 0;
  return Math.min(1, v / max);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const d = await loadFeed(sp, BASE);

  // 페이지 내 조회수 최대값(인기 막대 정규화용)
  const maxViews = d.notices.reduce(
    (m, n) => (typeof n.views === "number" && n.views > m ? n.views : m),
    0,
  );

  // 어떤 타일이 2칸을 차지할지: 고정공지 + 일정 주기로 리듬을 준다.
  const isWide = (n: Record<string, any>, i: number) =>
    Boolean(n.is_fixed) || i % 7 === 0;

  return (
    <main data-design="bento" className="bn">
      <header className="bn-top">
        <div className="bn-brand">
          <div className="bn-logo" aria-hidden="true">
            <span className="bn-logo-grid" />
          </div>
          <div className="bn-brand-txt">
            <h1 className="bn-title">경북대 공지 대시보드</h1>
            <p className="bn-sub">11개 게시판 통합 · 최신순 자동 수집</p>
          </div>
        </div>
        <div className="bn-top-actions">
          <RefreshButton />
          <DarkToggle />
        </div>
      </header>

      <div id="new-banner" className="bn-banner" aria-live="polite" />

      {/* ── 요약 스탯 타일 ── */}
      <section className="bn-stats" aria-label="요약 통계">
        <div className="bn-stat bn-stat--accent">
          <span className="bn-stat-k">총 공지</span>
          <span className="bn-stat-v">{d.total.toLocaleString("ko-KR")}</span>
          <span className="bn-stat-u">건 수집됨</span>
        </div>
        <div className="bn-stat">
          <span className="bn-stat-k">출처</span>
          <span className="bn-stat-v">{d.facets.sources.length}</span>
          <span className="bn-stat-u">개 게시판</span>
        </div>
        <div className="bn-stat">
          <span className="bn-stat-k">페이지</span>
          <span className="bn-stat-v">
            {d.pageNum}
            <span className="bn-stat-of"> / {d.totalPages}</span>
          </span>
          <span className="bn-stat-u">현재 보는 중</span>
        </div>
        <div className="bn-stat">
          <span className="bn-stat-k">표시</span>
          <span className="bn-stat-v">{d.notices.length}</span>
          <span className="bn-stat-u">건 이 화면</span>
        </div>
      </section>

      {/* ── 필터 ── */}
      <form className="bn-filters" method="get" role="search">
        <input
          className="bn-search"
          type="search"
          name="q"
          placeholder="공지 검색…"
          defaultValue={d.q ?? ""}
          aria-label="검색어"
        />
        <select
          className="bn-select"
          name="source"
          defaultValue={d.source ?? ""}
          aria-label="출처 필터"
        >
          <option value="">전체 출처</option>
          {d.facets.sources.map((s) => (
            <option key={s.source_id} value={s.source_id}>
              {s.source_name} ({s.count})
            </option>
          ))}
        </select>
        <select
          className="bn-select"
          name="category"
          defaultValue={d.category ?? ""}
          aria-label="분류 필터"
        >
          <option value="">전체 분류</option>
          {d.facets.categories.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category} ({c.count})
            </option>
          ))}
        </select>
        <button className="bn-go" type="submit">
          적용
        </button>
        <a className="bn-reset" href={BASE}>
          초기화
        </a>
      </form>

      {/* ── 상태 / 그리드 ── */}
      {d.dbError ? (
        <div className="bn-state bn-state--err">
          <span className="bn-state-ico" aria-hidden="true">
            ⚠
          </span>
          <p className="bn-state-t">데이터를 불러오지 못했어요</p>
          <p className="bn-state-d">{d.dbError}</p>
        </div>
      ) : d.notices.length === 0 ? (
        <div className="bn-state">
          <span className="bn-state-ico" aria-hidden="true">
            ◌
          </span>
          <p className="bn-state-t">조건에 맞는 공지가 없어요</p>
          <p className="bn-state-d">검색어나 필터를 바꿔 보세요.</p>
          <a className="bn-state-reset" href={BASE}>
            필터 초기화
          </a>
        </div>
      ) : (
        <section className="bn-grid" aria-label="공지 목록">
          {d.notices.map((n, i) => {
            const hue = hueFor(n.source_id);
            const ratio = popRatio(n.views, maxViews);
            const wide = isWide(n, i);
            return (
              <article
                key={n.id}
                className={`bn-tile${wide ? " bn-tile--wide" : ""}${
                  n.is_fixed ? " bn-tile--fixed" : ""
                }`}
                data-firstseen={Math.round(n.first_seen_ms)}
                style={{ ["--hue" as any]: String(hue) }}
              >
                <div className="bn-tile-head">
                  <span className="bn-pill">{n.source_name}</span>
                  {n.category ? <span className="bn-chip">{n.category}</span> : null}
                  <span className="bn-spacer" />
                  {n.is_fixed ? (
                    <span className="bn-badge bn-badge--fixed" title="고정 공지">
                      공지
                    </span>
                  ) : null}
                  {n.has_attachment ? (
                    <span className="bn-badge bn-badge--clip" title="첨부파일">
                      📎
                    </span>
                  ) : null}
                  <span className="bn-new" aria-label="새 글">
                    NEW
                  </span>
                </div>

                <a
                  className="bn-tile-title"
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {n.title}
                </a>

                <div className="bn-tile-foot">
                  <time className="bn-date">{n.display_date}</time>
                  {n.author ? <span className="bn-author">{n.author}</span> : null}
                  {typeof n.views === "number" ? (
                    <span className="bn-views" title={`조회수 ${n.views}`}>
                      <span className="bn-views-bar" aria-hidden="true">
                        <span
                          className="bn-views-fill"
                          style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                      </span>
                      <span className="bn-views-n">▲ {n.views.toLocaleString("ko-KR")}</span>
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ── 페이지네이션 ── */}
      {d.totalPages > 1 ? (
        <nav className="bn-pager" aria-label="페이지 이동">
          {d.pageNum > 1 ? (
            <a className="bn-pager-btn" href={d.pageHref(d.pageNum - 1)}>
              ← 이전
            </a>
          ) : (
            <span className="bn-pager-btn bn-off">← 이전</span>
          )}
          <span className="bn-pager-now">
            <strong>{d.pageNum}</strong>
            <span> / {d.totalPages}</span>
          </span>
          {d.pageNum < d.totalPages ? (
            <a className="bn-pager-btn" href={d.pageHref(d.pageNum + 1)}>
              다음 →
            </a>
          ) : (
            <span className="bn-pager-btn bn-off">다음 →</span>
          )}
        </nav>
      ) : null}

      <footer className="bn-foot">
        <span className="bn-foot-meta">
          총 {d.total.toLocaleString("ko-KR")}건 · 출처 {d.facets.sources.length}곳 · {d.pageNum}/
          {d.totalPages} 페이지
        </span>
        <a className="bn-rss" href={d.feedHref}>
          RSS 구독
        </a>
      </footer>

      <NewSinceController />
    </main>
  );
}
