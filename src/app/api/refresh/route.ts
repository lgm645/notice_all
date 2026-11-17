import { revalidateTag } from "next/cache";
import { claimRefresh, getCollectionHealth, getLastRefreshMs } from "../../../lib/db";
import { runScrape, ScrapeBusyError } from "../../../sources/run";
import { SOURCES } from "../../../sources/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 동시 수집은 보통 ~10초지만 여유 있게

// 마지막 새로고침으로부터 최소 이 시간이 지나야 수동 새로고침 허용(무료 티어·예의 보호).
const COOLDOWN_MIN = Number(process.env.REFRESH_COOLDOWN_MIN ?? 10);

// 상태 조회 — 버튼이 "마지막 갱신 N분 전" / 남은 시간 표시에 사용.
export async function GET() {
  let lastRefreshMs: number | null = null;
  try {
    lastRefreshMs = await getLastRefreshMs();
  } catch {
    lastRefreshMs = null;
  }
  const now = Date.now();
  const valid = lastRefreshMs && lastRefreshMs > 0 ? lastRefreshMs : null;
  const remainingSec = valid
    ? Math.max(0, COOLDOWN_MIN * 60 - Math.floor((now - valid) / 1000))
    : 0;
  const health = await getCollectionHealth(SOURCES.filter(s=>s.enabled).map(s=>s.id)).catch(()=>null);
  return Response.json({
    lastRefreshMs: valid,
    cooldownMin: COOLDOWN_MIN,
    remainingSec,
    canRefresh: remainingSec === 0,
    serverNowMs: now,
    staleSources: health?.sources.filter(s=>s.stale).map(s=>s.id) ?? [],
  });
}

// 수동 새로고침 — 쿨다운 통과 시에만 전체 소스를 동시 수집하고 캐시를 무효화.
export async function POST() {
  let claim;
  try {
    claim = await claimRefresh(COOLDOWN_MIN);
  } catch (e) {
    return Response.json(
      { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  if (!claim.ok) {
    return Response.json(
      { ok: false, reason: "cooldown", remainingSec: claim.remainingSec, cooldownMin: COOLDOWN_MIN },
      { status: 429 },
    );
  }

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
      cooldownMin: COOLDOWN_MIN,
    }, { status: ok > 0 ? 200 : 503 });
  } catch (e) {
    if (e instanceof ScrapeBusyError) return Response.json({ ok:false, reason:'busy' }, {status:409});
    return Response.json(
      { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
