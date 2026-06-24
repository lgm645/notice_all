"use client";

import { useEffect, useState } from "react";

// 수동 테마 토글(자동 ↔ 라이트 ↔ 다크). <html data-theme="..."> 설정 + localStorage 저장.
// CSS 는 html[data-theme="dark"] [data-design="..."] 형태로 override 한다(자동 prefers 보다 우선).
type Theme = "auto" | "light" | "dark";

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export default function DarkToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    const saved = (localStorage.getItem("knu_theme") as Theme) || "auto";
    setTheme(saved);
    apply(saved);
  }, []);

  const cycle = () => {
    const next: Theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
    setTheme(next);
    localStorage.setItem("knu_theme", next);
    apply(next);
  };

  const label = theme === "auto" ? "🌗 자동" : theme === "light" ? "☀ 라이트" : "🌙 다크";
  return (
    <button className="dark-toggle" onClick={cycle} aria-label="테마 전환" type="button">
      {label}
    </button>
  );
}
