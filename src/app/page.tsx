import "./designs.css";
import { loadFeed } from "../lib/loadFeed";
import RefreshButton from "./components/RefreshButton";
import NewSinceController from "./components/NewSinceController";
import { SOURCES } from "../sources/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "icn1"; // 서울 리전(사용자·Supabase와 동일 지역 → 지연 최소화)

const BASE = "/";

// 출처 ID → 원본 게시판 사이트 주소(목록 페이지). 출처 팝오버 링크에 사용.
const SITE_URL: Record<string, string> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s.listUrl]),
);

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

// 날짜: "2026-07-01" → { yy: "26", md: "07/01" }  (데스크탑 26/07/01, 모바일 07/01)
function fmtDate(d: string): { yy: string; md: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  if (!m) return { yy: "", md: d ?? "" };
  return { yy: m[1].slice(2), md: `${m[2]}/${m[3]}` };
}

// 출처 표시명(커스텀). 매핑에 없으면 원래 이름 그대로.
const SRC_NAME: Record<string, string> = {
  cse: "경대컴학공지",
  seeai: "경대ai공지",
  "knu-haksa": "경대학사공지",
  "knu-main": "경대공지",
  see: "경대전자공지",
  kosaf: "장학재단공지",
  aic: "aicoss공지",
  knussw: "경대장학공지",
  startup: "경대창업공지",
  volunteer: "경대봉사공지",
  library: "경대도서관공지",
};
function srcName(id: string, full: string): string {
  return SRC_NAME[id] ?? full;
}

// 하단 페이지 번호 목록(현재 주변 window + 처음/끝, 사이는 …).
function pageWindow(cur: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const win = 2;
  const start = Math.max(1, cur - win);
  const end = Math.min(total, cur + win);
  if (start > 1) {
    out.push(1);
    if (start > 2) out.push("…");
  }
  for (let n = start; n <= end; n++) out.push(n);
  if (end < total) {
    if (end < total - 1) out.push("…");
    out.push(total);
  }
  return out;
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
          <span className="dt-stat dt-stat-src">
            <button
              className="dt-src-trigger"
              type="button"
              aria-haspopup="true"
              aria-label="수집 대상 게시판 목록 보기"
            >
              <i className="dt-k">출처 ▾</i>
              <b className="dt-v">{d.facets.sources.length}</b>
            </button>
            <div className="dt-src-pop" role="menu">
              <div className="dt-src-pop-head">
                수집 대상 게시판 · {d.facets.sources.length}곳 · 클릭 시 원본 사이트 ↗
              </div>
              <ul className="dt-src-pop-list">
                {d.facets.sources.map((s) => {
                  const url = SITE_URL[String(s.source_id)];
                  const sh = srcHue(String(s.source_id));
                  const inner = (
                    <>
                      <span className="dt-src-pop-dot" aria-hidden="true" />
                      <span className="dt-src-pop-nm">{srcName(String(s.source_id), s.source_name)}</span>
                      <span className="dt-src-pop-ct">{s.count}</span>
                      {url ? (
                        <span className="dt-src-pop-ext" aria-hidden="true">
                          ↗
                        </span>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={s.source_id}>
                      {url ? (
                        <a
                          className={"dt-src-pop-item dt-src-" + sh}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {inner}
                        </a>
                      ) : (
                        <span className={"dt-src-pop-item dt-src-" + sh}>{inner}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
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
              {srcName(String(s.source_id), s.source_name)} ({s.count})
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
                const fd = fmtDate(String(n.display_date ?? ""));
                return (
                  <tr
                    key={n.id}
                    className={"dt-row" + (n.is_fixed ? " dt-row-fixed" : "")}
                    data-firstseen={Math.round(n.first_seen_ms)}
                    data-sh={sh}
                  >
                    {/* 날짜: 26/07/01 (모바일은 연도 숨김 → 07/01) */}
                    <td className="dt-c-date">
                      <time className="dt-date" dateTime={n.display_date}>
                        {fd.yy ? <span className="dt-date-yy">{fd.yy}/</span> : null}
                        {fd.md}
                      </time>
                    </td>

                    {/* 출처: 색상 점 + 티커 */}
                    <td className="dt-c-src">
                      <span className={"dt-src dt-src-" + sh} title={n.source_name}>
                        <span className="dt-src-dot" aria-hidden="true" />
                        <span className="dt-src-tick">{srcName(String(n.source_id), n.source_name)}</span>
                      </span>
                    </td>

                    {/* 카테고리: 색상칩 */}
                    <td className="dt-c-cat">
                      <span className={"dt-cat dt-cat-" + ch}>{n.category}</span>
                    </td>

                    {/* 제목 (링크) — 한 줄 유지, 길면 … / 공지는 앞 배지 */}
                    <td className="dt-c-title">
                      <div className="dt-title-cell">
                        {n.is_fixed ? (
                          <span className="dt-fixed" title="상단 고정 공지">
                            공지
                          </span>
                        ) : null}
                        <div className="dt-title-wrap">
                          <a
                            className="dt-title"
                            href={n.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {n.title}
                          </a>
                          {n.author ? <span className="dt-author">{n.author}</span> : null}
                        </div>
                      </div>
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
          <span className="dt-pgnums">
            {pageWindow(d.pageNum, d.totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="dt-pg-ell">
                  …
                </span>
              ) : p === d.pageNum ? (
                <span key={p} className="dt-pg-num dt-pg-cur" aria-current="page">
                  {String(p).padStart(2, "0")}
                </span>
              ) : (
                <a key={p} className="dt-pg-num" href={d.pageHref(p as number)}>
                  {String(p).padStart(2, "0")}
                </a>
              ),
            )}
          </span>
          {d.pageNum < d.totalPages ? (
            <a className="dt-pg" href={d.pageHref(d.pageNum + 1)}>
              NEXT ▸
            </a>
          ) : (
            <span className="dt-pg dt-pg-off">NEXT ▸</span>
          )}
          <form className="dt-jump" method="get">
            {d.source ? <input type="hidden" name="source" value={d.source} /> : null}
            {d.category ? <input type="hidden" name="category" value={d.category} /> : null}
            {d.q ? <input type="hidden" name="q" value={d.q} /> : null}
            <span className="dt-jump-lb" aria-hidden="true">
              GOTO
            </span>
            <input
              className="dt-jump-in"
              type="number"
              name="page"
              min={1}
              max={d.totalPages}
              defaultValue={d.pageNum}
              aria-label="페이지 번호로 이동"
            />
            <span className="dt-jump-tot">/ {d.totalPages}</span>
            <button className="dt-jump-go" type="submit">
              이동 ▸
            </button>
          </form>
        </nav>
        <div className="dt-foot-meta">
          <span className="dt-foot-stat">
            {rangeFrom}–{rangeTo} <i>of</i> {d.total.toLocaleString()}
          </span>
        </div>
      </div>

      <NewSinceController />
    </main>
  );
}
