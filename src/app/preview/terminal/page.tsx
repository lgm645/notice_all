import { loadFeed } from "../_lib/loadFeed";
import RefreshButton from "../../components/RefreshButton";
import NewSinceController from "../../components/NewSinceController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = "/preview/terminal";

// source_id 를 안정적인 색 토큰(0~7)으로 매핑 → 출처별 색상 코딩
function srcToken(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % 8;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const d = await loadFeed(sp, BASE);

  const shown = d.notices.length;
  const rangeFrom = shown === 0 ? 0 : (d.pageNum - 1) * d.pageSize + 1;
  const rangeTo = (d.pageNum - 1) * d.pageSize + shown;

  return (
    <main data-design="terminal" className="tm">
      <div className="tm-frame">
        {/* ── 터미널 헤더(프롬프트) ───────────────────────── */}
        <header className="tm-head">
          <div className="tm-titlebar">
            <span className="tm-dots" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            <span className="tm-tbtitle">knu-feed — tail -f notices — 80×24</span>
            <a className="tm-rss" href={d.feedHref} title="RSS 구독">
              [ rss ]
            </a>
          </div>

          <pre className="tm-ascii" aria-label="경북대 공지 통합 알리미">
            {[
              "  _  ___ _  _ _   _   ___ ___ ___ ___",
              " | |/ / \\| || | | | | | __| __|   \\   ",
              " | ' <|  ' || |_| | |  _|| _|| |) |  ",
              " |_|\\_\\_|\\_| \\___/  |_| |___|___/  ::feed",
            ].join("\n")}
          </pre>

          <div className="tm-prompt">
            <span className="tm-user">knu@feed</span>
            <span className="tm-colon">:</span>
            <span className="tm-path">~</span>
            <span className="tm-dollar">$</span>
            <span className="tm-cmd">tail -f notices</span>
            <span className="tm-cursor" aria-hidden="true" />
          </div>

          {/* 기능 계약: #new-banner — 컨트롤러가 텍스트/클래스 주입 */}
          <div id="new-banner" className="tm-banner" aria-live="polite">
            <span className="tm-comment">{"// "}</span>
            <span className="tm-banner-txt">대기 중…</span>
          </div>

          <div className="tm-statusline">
            <span className="tm-stat">
              <b>STREAM</b> 총 {d.total}건
            </span>
            <span className="tm-stat">
              src <b>{d.facets.sources.length}</b>
            </span>
            <span className="tm-stat">
              cat <b>{d.facets.categories.length}</b>
            </span>
            <span className="tm-stat tm-stat-pg">
              page {String(d.pageNum).padStart(2, "0")}/
              {String(d.totalPages).padStart(2, "0")}
            </span>
            <RefreshButton />
          </div>
        </header>

        {/* ── 필터: 커맨드 입력 행 ───────────────────────── */}
        <form className="tm-filter" method="get">
          <label className="tm-field tm-field-q">
            <span className="tm-flag">q&gt;</span>
            <input
              type="search"
              name="q"
              placeholder="grep 제목…"
              defaultValue={d.q ?? ""}
              aria-label="검색"
              autoComplete="off"
            />
          </label>
          <label className="tm-field">
            <span className="tm-flag">src&gt;</span>
            <select name="source" defaultValue={d.source ?? ""} aria-label="출처">
              <option value="">*</option>
              {d.facets.sources.map((s) => (
                <option key={s.source_id} value={s.source_id}>
                  {s.source_name} ({s.count})
                </option>
              ))}
            </select>
          </label>
          <label className="tm-field">
            <span className="tm-flag">cat&gt;</span>
            <select
              name="category"
              defaultValue={d.category ?? ""}
              aria-label="분류"
            >
              <option value="">*</option>
              {d.facets.categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.count})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="tm-run">
            ⏎ exec
          </button>
          <a className="tm-clear" href={BASE}>
            ^C clear
          </a>
        </form>

        {/* ── 로그 본문 ──────────────────────────────────── */}
        {d.dbError ? (
          <div className="tm-empty tm-err">
            <span className="tm-comment">{"# "}</span>
            stderr: 데이터베이스 연결 실패
            <pre className="tm-errbody">{d.dbError}</pre>
          </div>
        ) : d.notices.length === 0 ? (
          <div className="tm-empty">
            <pre>{String.raw`  ┌──────────────────────────────┐
  │   0 results — 빈 스트림        │
  └──────────────────────────────┘`}</pre>
            <p className="tm-comment">
              {"// "}조건에 맞는 로그가 없습니다. ^C clear 로 초기화하세요.
            </p>
          </div>
        ) : (
          <ol className="tm-log" start={rangeFrom}>
            <li className="tm-colhdr" aria-hidden="true">
              <span className="tm-c-ln">#</span>
              <span className="tm-c-flag">stat</span>
              <span className="tm-c-date">date</span>
              <span className="tm-c-src">source</span>
              <span className="tm-c-title">message</span>
              <span className="tm-c-views">views</span>
            </li>
            {d.notices.map((n, i) => (
              <li
                key={n.id}
                className={`tm-row tm-tok-${srcToken(String(n.source_id))}`}
                data-firstseen={Math.round(n.first_seen_ms)}
              >
                <span className="tm-ln">
                  {String(rangeFrom + i).padStart(4, "0")}
                </span>

                <span className="tm-flagcell">
                  {/* 기능 계약: NEW 마커(기본 숨김) — .is-new 시 노출 */}
                  <span className="tm-new">[NEW]</span>
                  {n.is_fixed ? (
                    <span className="tm-fixed">[PIN]</span>
                  ) : (
                    <span className="tm-log-lvl">[LOG]</span>
                  )}
                </span>

                <span className="tm-bar" aria-hidden="true">
                  │
                </span>

                <time className="tm-date" dateTime={n.display_date}>
                  {n.display_date}
                </time>

                <span className="tm-bar" aria-hidden="true">
                  │
                </span>

                <span className="tm-src" title={n.source_name}>
                  <span className="tm-src-dot" aria-hidden="true">
                    ●
                  </span>
                  {n.source_name}
                </span>

                <span className="tm-bar" aria-hidden="true">
                  │
                </span>

                <a
                  className="tm-title"
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="tm-cat">[{n.category}]</span>
                  <span className="tm-titletxt">{n.title}</span>
                  {n.has_attachment ? (
                    <span className="tm-clip" title="첨부파일">
                      ⬇
                    </span>
                  ) : null}
                  {n.author ? (
                    <span className="tm-author">@{n.author}</span>
                  ) : null}
                </a>

                <span className="tm-views" title="조회수">
                  {n.views != null ? n.views.toLocaleString("en-US") : "—"}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* ── 페이지네이션 ──────────────────────────────── */}
        {d.totalPages > 1 ? (
          <nav className="tm-pager" aria-label="페이지">
            {d.pageNum > 1 ? (
              <a href={d.pageHref(d.pageNum - 1)} className="tm-pg">
                ◀ prev
              </a>
            ) : (
              <span className="tm-pg off">◀ prev</span>
            )}
            <span className="tm-pgind">
              <span className="tm-comment">// </span>
              page {String(d.pageNum).padStart(2, "0")} /{" "}
              {String(d.totalPages).padStart(2, "0")}
              <span className="tm-pgrange">
                {" "}
                · rows {rangeFrom}–{rangeTo}
              </span>
            </span>
            {d.pageNum < d.totalPages ? (
              <a href={d.pageHref(d.pageNum + 1)} className="tm-pg">
                next ▶
              </a>
            ) : (
              <span className="tm-pg off">next ▶</span>
            )}
          </nav>
        ) : null}

        {/* ── 푸터 ──────────────────────────────────────── */}
        <footer className="tm-foot">
          <span className="tm-comment">
            {"# "}knu@feed:~$ — 경북대 11개 게시판 통합 수집 · 최신순
          </span>
          <a className="tm-footrss" href={d.feedHref}>
            $ curl feed.xml
          </a>
        </footer>
      </div>

      <NewSinceController />
    </main>
  );
}