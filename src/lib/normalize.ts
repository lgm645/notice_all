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

// 'YYYY-MM-DD' / 'YYYY.MM.DD' / 'YYYY/MM/DD' (+ 선택적 HH:MM)
const DATE_RE = /(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})(?:[^\d]+(\d{1,2}):(\d{2}))?/;
// 연도 없는 'MM-DD' / 'MM.DD' / 'MM/DD' (gnuboard 가 올해 글에 이렇게 표시)
const MD_RE = /^(\d{1,2})[.\-/](\d{1,2})$/;

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
  const m = DATE_RE.exec(t);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  const md = MD_RE.exec(t);
  if (md) {
    const { y, m: mo, d } = resolveMonthDay(+md[1], +md[2]);
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

// 모든 날짜는 KST(Asia/Seoul) 기준 ISO 로 정규화. 서버 TZ 에 의존하지 않음.
export function toKstIso(s?: string | null): string | null {
  const t = cleanText(s);
  const m = DATE_RE.exec(t);
  if (m) {
    const H = pad(m[4] ?? "0");
    const M = pad(m[5] ?? "0");
    return `${m[1]}-${pad(m[2])}-${pad(m[3])}T${H}:${M}:00+09:00`;
  }
  const md = MD_RE.exec(t);
  if (md) {
    const { y, m: mo, d } = resolveMonthDay(+md[1], +md[2]);
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
