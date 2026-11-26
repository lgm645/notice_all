"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = { lastRefreshMs: number | null; staleSources: string[] };

export default function RefreshButton() {
  const router = useRouter();
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/refresh", { cache: "no-store" });
      const j = await r.json();
      setSt({ lastRefreshMs: j.lastRefreshMs ?? null, staleSources: j.staleSources ?? [] });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // 20초마다 마지막 갱신으로부터 경과한 시간 표시 갱신
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (busy || !msg) return;
    const id = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(id);
  }, [busy, msg]);

  const now = Date.now();
  const last = st?.lastRefreshMs ?? null;
  const elapsedMin = last ? Math.max(0, Math.floor((now - last) / 60_000)) : null;

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setMsg(j.partial ? `일부 갱신 · 신규 ${j.inserted ?? 0}건 · 미완료 ${j.pendingSources?.length ?? 0}곳` : `갱신 완료 · 신규 ${j.inserted ?? 0}건`);
        await loadStatus();
        router.refresh();
      } else if (r.status === 409) {
        setMsg("이미 수집 중입니다. 끝나면 다시 눌러 주세요.");
      } else {
        setMsg("새로고침 실패");
      }
    } catch {
      setMsg("새로고침 실패");
    } finally {
      setBusy(false);
    }
  };

  const lastLabel =
    elapsedMin == null ? "" : elapsedMin === 0 ? "방금 전 갱신됨" : `${elapsedMin}분 전 갱신됨`;
  const staleCount = st?.staleSources.length ?? 0;
  const statusLabel = [lastLabel, staleCount ? `${staleCount}개 출처 갱신 지연` : ""].filter(Boolean).join(" · ");

  return (
    <div className="refresh">
      <button type="button" className="refresh-btn" onClick={onClick} disabled={busy}>
        {busy ? "⏳ 수집 중…" : "🔄 지금 새로고침"}
      </button>
      <span className="refresh-meta" role="status">{busy ? "수집 중…" : msg ?? statusLabel}</span>
    </div>
  );
}
