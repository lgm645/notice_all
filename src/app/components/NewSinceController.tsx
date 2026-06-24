"use client";

import { useEffect } from "react";

// "지난 방문 이후 새 글" 표시 (점진적 향상).
// 서버가 각 카드에 data-firstseen(ms) 을 박아두면, 클라이언트가 마지막 방문 시각과
// 비교해 새 글에 .is-new 클래스를 붙이고 상단 배너에 개수를 표시한다.
const KEY = "knu_last_visit";

export default function NewSinceController() {
  useEffect(() => {
    const last = Number(localStorage.getItem(KEY) ?? "0");
    let count = 0;

    document.querySelectorAll<HTMLElement>("[data-firstseen]").forEach((el) => {
      const ms = Number(el.dataset.firstseen ?? "0");
      if (last > 0 && ms > last) {
        el.classList.add("is-new");
        count += 1;
      }
    });

    const banner = document.getElementById("new-banner");
    if (banner) {
      banner.textContent =
        last === 0
          ? "환영합니다 — 다음 방문부터 새 글을 표시합니다"
          : count > 0
            ? `지난 방문 이후 새 글 ${count}개`
            : "지난 방문 이후 새 글 없음";
      banner.classList.toggle("has-new", count > 0);
    }

    // 이번 방문 시각 저장
    localStorage.setItem(KEY, String(Date.now()));
  }, []);

  return null;
}
