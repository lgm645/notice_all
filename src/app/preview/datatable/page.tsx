import { loadFeed } from "../_lib/loadFeed";
import RefreshButton from "../../components/RefreshButton";
import NewSinceController from "../../components/NewSinceController";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = "/preview/datatable";

// 출처 ID → 색상 인덱스(0..7). 안정적 해시로 같은 출처는 항상 같은 컬러.
function srcHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 8;
}
// 카테고리 → 색상 클래스 인덱스(0..5).
function catHue(c: string): number {
  let h = 0;
  for (let i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) >>> 0;
  return h % 6;
}

function fmtViews(v: number | null): string {
  if (v == null) return "—";
  if (v >= 10000) return (v / 1000).toFixed(1) + "K";
  return String(v);
}

// 출처명 압축 티커(영문 약어 느낌). 한글 출처는 앞 4자.
function ticker(name: string): string {
  const t = name.replace(/\s+/g, "");
  return t.slice(0, 4);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const d = await loadFeed(sp, BASE);

  const rangeFrom = d.total === 0 ? 0 : (d.pageNum - 1) * d.pageSize + 1;
  const rangeTo = Math.min(d.pageNum * d.pageSize, d.total);

  return (
    <main data-design="datatable" className="dt">
      {/* ===== 터미널 상단 타이틀 바 ===== */}
      <div className="dt-topbar">
        <div className="dt-brand">
          <span className="dt-led" aria-hidden="true" />
          <span className="dt-brand-name">KNU·TERM</span>
          <span className="dt-brand-sub">공지 통합 터미널</span>
        </div>
        <div className="dt-clock">
          <span className="dt-clock-mkt">KST</span>
          <span className="dt-clock-live">LIVE</span>
        </div>
      </div>

      {/* ===== 상태 바: 총건수 / 출처수 / 페이지 / 배너 / 새로고침 ===== */}
      <div className="dt-statusbar">
        <div className="dt-stats">
          <span className="dt-stat">
            <i className="dt-k">총건수</i>
            <b className="dt-v">{d.total.toLocaleString()}</b>
          </span>
          <span className="dt-stat">
            <i className="dt-k">출처</i>
            <b className="dt-v">{d.facets.sources.length}</b>
          </span>
          <span className="dt-stat">
            <i className="dt-k">카테고리</i>
            <b className="dt-v">{d.facets.categories.length}</b>
          </span>
          <span className="dt-stat">
            <i className="dt-k">PAGE</i>
            <b className="dt-v">
              {d.pageNum}<span className="dt-slash">/</span>{d.totalPages}
            </b>
          </span>
          <span className="dt-stat dt-stat-range">
            <i className="dt-k">ROWS</i>
            <b className="dt-v">
              {rangeFrom}–{rangeTo}
            </b>
          </span>
        </div>
        <div id="new-banner" className="dt-banner" aria-live="polite" />
        <RefreshButton />
      </div>

      {/* ===== 필터 명령행 ===== */}
      <form className="dt-cmd" method="get">
        <span className="dt-prompt" aria-hidden="true">
          &gt;_
        </span>
        <input
          className="dt-search"
          type="search"
          name="q"
          placeholder="제목 검색…  (예: 장학)"
          defaultValue={d.q ?? ""}
          aria-label="검색"
        />
        <select className="dt-sel" name="source" defaultValue={d.source ?? ""} aria-label="출처">
          <option value="">SRC · 전체 출처</option>
          {d.facets.sources.map((s) => (
            <option key={s.source_id} value={s.source_id}>
              {s.source_name} ({s.count})
            </option>
          ))}
        </select>
        <select className="dt-sel" name="category" defaultValue={d.category ?? ""} aria-label="카테고리">
          <option value="">CAT · 전체 분류</option>
          {d.facets.categories.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category} ({c.count})
            </option>
          ))}
        </select>
        <button className="dt-run" type="submit">
          실행 ▸
        </button>
        <a className="dt-reset" href={BASE}>
          초기화
        </a>
      </form>

      {/* ===== 데이터 그리드 ===== */}
      {d.dbError ? (
        <div className="dt-empty dt-err">
          <span className="dt-err-tag">ERR</span>
          데이터 피드 연결 실패 — <code>{d.dbError}</code>
        </div>
      ) : d.notices.length === 0 ? (
        <div className="dt-empty">
          <span className="dt-noop">NO DATA</span>
          조건에 맞는 공지가 없습니다. 필터를 초기화하세요.
        </div>
      ) : (
        <div className="dt-scroll">
          <table className="dt-table">
            <thead>
              <tr className="dt-headrow">
                <th className="dt-c-flag" scope="col">
                  ST
                </th>
                <th className="dt-c-date" scope="col">
                  날짜
                </th>
                <th className="dt-c-src" scope="col">
                  출처
                </th>
                <th className="dt-c-cat" scope="col">
                  분류
                </th>
                <th className="dt-c-title" scope="col">
                  제목
                </th>
                <th className="dt-c-views" scope="col">
                  조회수
                </th>
                <th className="dt-c-att" scope="col">
                  첨부
                </th>
              </tr>
            </thead>
            <tbody>
              {d.notices.map((n) => {
                const sh = srcHue(String(n.source_id));
                const ch = catHue(String(n.category ?? ""));
                return (
                  <tr
                    key={n.id}
                    className={"dt-row" + (n.is_fixed ? " dt-row-fixed" : "")}
                    data-firstseen={Math.round(n.first_seen_ms)}
                    data-sh={sh}
                  >
                    {/* 상태: NEW(점멸) / 공지(고정) / · */}
                    <td className="dt-c-flag">
                      <span className="dt-new" aria-label="새 글">
                        <span className="dt-dot-blink" aria-hidden="true">
                          ●
                        </span>
                        NEW
                      </span>
                      {n.is_fixed ? (
                        <span className="dt-fixed" title="상단 고정 공지">
                          공지
                        </span>
                      ) : (
                        <span className="dt-rest" aria-hidden="true">
                          ·
                        </span>
                      )}
                    </td>

                    {/* 날짜 */}
                    <td className="dt-c-date">
                      <time className="dt-date" dateTime={n.display_date}>
                        {n.display_date}
                      </time>
                    </td>

                    {/* 출처: 색상 점 + 티커 */}
                    <td className="dt-c-src">
                      <span className={"dt-src dt-src-" + sh} title={n.source_name}>
                        <span className="dt-src-dot" aria-hidden="true" />
                        <span className="dt-src-tick">{ticker(n.source_name)}</span>
                      </span>
                    </td>

                    {/* 카테고리: 색상칩 */}
                    <td className="dt-c-cat">
                      <span className={"dt-cat dt-cat-" + ch}>{n.category}</span>
                    </td>

                    {/* 제목 (링크) */}
                    <td className="dt-c-title">
                      <a
                        className="dt-title"
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {n.title}
                      </a>
                      {n.author ? <span className="dt-author">{n.author}</span> : null}
                    </td>

                    {/* 조회수 (우측정렬 모노) */}
                    <td className="dt-c-views">
                      <span
                        className={
                          "dt-views" +
                          (n.views != null && n.views >= 1000 ? " dt-views-hot" : "")
                        }
                      >
                        {fmtViews(n.views)}
                      </span>
                    </td>

                    {/* 첨부 */}
                    <td className="dt-c-att">
                      {n.has_attachment ? (
                        <span className="dt-clip" title="첨부 있음">
                          ▣
                        </span>
                      ) : (
                        <span className="dt-clip-off" aria-hidden="true">
                          ·
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== 하단 상태/페이지 바 ===== */}
      <div className="dt-footbar">
        <nav className="dt-pager" aria-label="페이지 이동">
          {d.pageNum > 1 ? (
            <a className="dt-pg" href={d.pageHref(d.pageNum - 1)}>
              ◂ PREV
            </a>
          ) : (
            <span className="dt-pg dt-pg-off">◂ PREV</span>
          )}
          <span className="dt-pageno">
            {String(d.pageNum).padStart(2, "0")}
            <span className="dt-slash"> / </span>
            {String(d.totalPages).padStart(2, "0")}
          </span>
          {d.pageNum < d.totalPages ? (
            <a className="dt-pg" href={d.pageHref(d.pageNum + 1)}>
              NEXT ▸
            </a>
          ) : (
            <span className="dt-pg dt-pg-off">NEXT ▸</span>
          )}
        </nav>
        <div className="dt-foot-meta">
          <span className="dt-foot-stat">
            {rangeFrom}–{rangeTo} <i>of</i> {d.total.toLocaleString()}
          </span>
          <a className="dt-rss" href={d.feedHref}>
            <span className="dt-rss-ic" aria-hidden="true">
              ⦿
            </span>
            RSS FEED
          </a>
        </div>
      </div>

      <NewSinceController />
    </main>
  );
}
