// 텍스트/날짜/ID/URL 정규화 유틸. 모든 어댑터가 공유한다.

export function cleanText(s?: string | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export function parseIntSafe(s?: string | null): number | null {
  const digits = cleanText(s).replace(/[^\d-]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

const pad = (n: number | string) => String(n).padStart(2, "0");

// 날짜 셀 전체가 날짜일 때만 인정한다.
// 예: 제목 "인재원(2026.9.1.~ 10.31.) ..." 안의 행사 시작일을 게시일로
// 오인하지 않도록 반드시 문자열 처음(^)부터 끝($)까지 일치시킨다.
const DATE_RE = /^(?:(?:등록일|작성일|게시일)\s*[:：]?\s*)?(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?(?:\s*\([월화수목금토일]\))?(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?\s*$/;
// 연도 없는 'MM-DD' / 'MM.DD' / 'MM/DD' (gnuboard 가 올해 글에 이렇게 표시)
const MD_RE = /^(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?$/;

interface DateParts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}

function validDateParts(y: number, m: number, d: number, h = 0, min = 0): boolean {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || h < 0 || h > 23 || min < 0 || min > 59) {
    return false;
  }
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function fullDateParts(s?: string | null): DateParts | null {
  const m = DATE_RE.exec(cleanText(s));
  if (!m) return null;
  const parts = { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] ?? 0), min: +(m[5] ?? 0) };
  return validDateParts(parts.y, parts.m, parts.d, parts.h, parts.min) ? parts : null;
}

// 표의 날짜 열을 찾을 때 사용. 문장 속 날짜가 아니라 독립된 날짜 값인지 판별한다.
export function isStandaloneDate(s?: string | null): boolean {
  return fullDateParts(s) !== null;
}

// 현재 KST 날짜 (연도 보정용). 스크래퍼(Node)에서만 호출된다.
function nowKstYmd(): { y: number; m: number; d: number } {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

// 'MM-DD' 를 올해로 해석하되, 미래 날짜면 작년으로 보정.
function resolveMonthDay(mo: number, da: number): { y: number; m: number; d: number } {
  const now = nowKstYmd();
  let y = now.y;
  if (mo * 100 + da > now.m * 100 + now.d + 2) y = now.y - 1;
  return { y, m: mo, d: da };
}

export function normDate(s?: string | null): string | null {
  const t = cleanText(s);
  const full = fullDateParts(t);
  if (full) return `${full.y}-${pad(full.m)}-${pad(full.d)}`;
  const md = MD_RE.exec(t);
  if (md) {
    const { y, m: mo, d } = resolveMonthDay(+md[1], +md[2]);
    if (!validDateParts(y, mo, d)) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

// 모든 날짜는 KST(Asia/Seoul) 기준 ISO 로 정규화. 서버 TZ 에 의존하지 않음.
export function toKstIso(s?: string | null): string | null {
  const t = cleanText(s);
  const full = fullDateParts(t);
  if (full) {
    return `${full.y}-${pad(full.m)}-${pad(full.d)}T${pad(full.h)}:${pad(full.min)}:00+09:00`;
  }
  const md = MD_RE.exec(t);
  if (md) {
    const { y, m: mo, d } = resolveMonthDay(+md[1], +md[2]);
    if (!validDateParts(y, mo, d)) return null;
    return `${y}-${pad(mo)}-${pad(d)}T00:00:00+09:00`;
  }
  return null;
}

// 상대/지저분한 href 를 절대 URL 로 안전 변환.
export function resolveUrl(href: string, base: string): string {
  if (!href) return base;
  try {
    return new URL(href, base).toString();
  } catch {
    try {
      return new URL(encodeURI(href), base).toString();
    } catch {
      return href.startsWith("http") ? href : base;
    }
  }
}

// 중복 판단 키: 출처 ID 로 네임스페이스해 게시판 간 충돌 방지.
export function makeNoticeId(sourceId: string, externalId: string): string {
  return `${sourceId}:${externalId}`;
}
