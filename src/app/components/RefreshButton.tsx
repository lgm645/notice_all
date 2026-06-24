"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 사용자 수동 새로고침 버튼.
// - 마지막 새로고침으로부터 N분 경과 표시
// - 쿨다운(서버 강제) 동안은 "M분 후 가능"으로 비활성
// - 누르면 전체 소스 동시 수집 후 화면 갱신
type Status = { lastRefreshMs: number | null; cooldownMin: number };

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
      setSt({ lastRefreshMs: j.lastRefreshMs ?? null, cooldownMin: Number(j.cooldownMin ?? 10) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // 20초마다 경과/남은 시간 표시 갱신
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const last = st?.lastRefreshMs ?? null;
  const cooldownMin = st?.cooldownMin ?? 10;
  const elapsedMin = last ? Math.floor((now - last) / 60_000) : null;
  const remainingSec = last ? Math.max(0, cooldownMin * 60 - Math.floor((now - last) / 1000)) : 0;
  const remainingMin = Math.max(1, Math.ceil(remainingSec / 60));
  const canRefresh = remainingSec === 0;

  const onClick = async () => {
    if (busy || !canRefresh) return;
    setBusy(true);
    setMsg("수집 중…");
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setMsg(`갱신 완료 · 신규 ${j.inserted ?? 0}건`);
        await loadStatus();
        router.refresh();
        setTimeout(() => setMsg(null), 4000);
      } else if (r.status === 429) {
        setMsg(`아직 쿨다운 · 약 ${Math.max(1, Math.ceil((j.remainingSec ?? 0) / 60))}분 후`);
        await loadStatus();
        setTimeout(() => setMsg(null), 4000);
      } else {
        setMsg("새로고침 실패");
        setTimeout(() => setMsg(null), 4000);
      }
    } catch {
      setMsg("새로고침 실패");
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  const lastLabel =
    last == null ? "" : elapsedMin === 0 ? "방금 전 갱신됨" : `${elapsedMin}분 전 갱신됨`;

  return (
    <div className="refresh">
      <button className="refresh-btn" onClick={onClick} disabled={busy || !canRefresh}>
        {busy ? "⏳ 수집 중…" : canRefresh ? "🔄 지금 새로고침" : `🔄 ${remainingMin}분 후 가능`}
      </button>
      <span className="refresh-meta">{msg ?? lastLabel}</span>
    </div>
  );
}
