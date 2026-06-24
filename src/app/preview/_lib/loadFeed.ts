import {
  countNoticesCached as countNotices,
  getFacetsCached as getFacets,
  getNoticesCached as getNotices,
} from "../../../lib/queries";

// 모든 프리뷰 디자인이 공유하는 데이터 로더 (메인 page.tsx 와 동일 로직).
// 디자인은 이 데이터만 받아서 마크업/스타일만 다르게 그린다.
export type Row = Record<string, any>;

export interface FeedData {
  notices: Row[];
  facets: { sources: Row[]; categories: Row[] };
  total: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
  source?: string;
  category?: string;
  q?: string;
  feedHref: string; // RSS (현재 필터 반영)
  pageHref: (n: number) => string; // 이 프리뷰 경로 기준 페이지 링크
  dbError: string | null;
}

const PAGE_SIZE = 50;

function pick(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export async function loadFeed(
  sp: Record<string, string | string[] | undefined>,
  basePath: string,
): Promise<FeedData> {
  const source = pick(sp.source);
  const category = pick(sp.category);
  const q = pick(sp.q);
  const pageNum = Math.max(1, Number(pick(sp.page) ?? "1") || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  const feedHref = "/feed.xml" + (params.toString() ? `?${params}` : "");

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (source) p.set("source", source);
    if (category) p.set("category", category);
    if (q) p.set("q", q);
    if (n > 1) p.set("page", String(n));
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
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
  return {
    notices,
    facets,
    total,
    pageNum,
    pageSize: PAGE_SIZE,
    totalPages,
    source,
    category,
    q,
    feedHref,
    pageHref,
    dbError,
  };
}
