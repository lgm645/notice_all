import { revalidateTag } from "next/cache";
import { getCollectionHealth, getLastRefreshMs } from "../../../lib/db";
import { runScrape, ScrapeBusyError } from "../../../sources/run";
import { SOURCES } from "../../../sources/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 동시 수집은 보통 ~10초지만 여유 있게

// 상태 조회 — 마지막 갱신 시각과 지연된 출처 표시에 사용.
export async function GET() {
  let lastRefreshMs: number | null = null;
  try {
    lastRefreshMs = await getLastRefreshMs();
  } catch {
    lastRefreshMs = null;
  }
  const now = Date.now();
  const valid = lastRefreshMs && lastRefreshMs > 0 ? lastRefreshMs : null;
  const health = await getCollectionHealth(SOURCES.filter(s=>s.enabled).map(s=>s.id)).catch(()=>null);
  return Response.json({
    lastRefreshMs: valid,
    // 배포 전에 열린 탭의 클라이언트도 쿨다운 없이 사용할 수 있게 한다.
    cooldownMin: 0,
    remainingSec: 0,
    canRefresh: true,
    serverNowMs: now,
    staleSources: health?.sources.filter(s=>s.stale).map(s=>s.id) ?? [],
  });
}

// 수동 새로고침 — 진행 중인 수집이 없으면 바로 수집하고 캐시를 무효화.
export async function POST() {
  try {
    const { results, totalNew, rejectedFutureDates, repairedDates } = await runScrape({ concurrent: true, quick:true, maxPages:2, budgetMs:44_000 });
    revalidateTag("notices", { expire: 0 }); // Route Handler에서 즉시 만료 → 새 데이터 바로 반영
    const ok = results.filter((r) => !r.error).length;
    return Response.json({
      ok: ok > 0,
      partial: results.some(r=>r.error || r.pending),
      pendingSources: results.filter(r=>r.error || r.pending).map(r=>r.source),
      sources: `${ok}/${results.length}`,
      inserted: totalNew,
      rejectedFutureDates,
      repairedDates,
    }, { status: ok > 0 ? 200 : 503 });
  } catch (e) {
    if (e instanceof ScrapeBusyError) return Response.json({ ok:false, reason:'busy' }, {status:409});
    return Response.json(
      { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
