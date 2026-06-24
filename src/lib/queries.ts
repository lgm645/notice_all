import { unstable_cache } from "next/cache";
import { countNotices, getFacets, getNotices, type NoticeFilter } from "./db";

// 웹앱(읽기 전용)이 쓰는 캐시된 쿼리.
// 공지는 6시간마다 cron 으로만 바뀌므로 60초 캐시해도 충분히 신선하고,
// 동시 사용자가 많아도 DB 부하를 크게 줄인다(같은 필터 조합당 60초에 1번만 질의).
// 수집기(쓰기)는 캐시 없는 db.ts 를 직접 쓴다.
const REVALIDATE = Number(process.env.FEED_REVALIDATE ?? 60);

export function getNoticesCached(f: NoticeFilter) {
  return unstable_cache(() => getNotices(f), ["notices", JSON.stringify(f)], {
    revalidate: REVALIDATE,
    tags: ["notices"],
  })();
}

export function countNoticesCached(f: NoticeFilter) {
  return unstable_cache(() => countNotices(f), ["count", JSON.stringify(f)], {
    revalidate: REVALIDATE,
    tags: ["notices"],
  })();
}

export function getFacetsCached() {
  return unstable_cache(() => getFacets(), ["facets"], {
    revalidate: REVALIDATE,
    tags: ["notices"],
  })();
}
