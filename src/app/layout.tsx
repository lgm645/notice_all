import type { Metadata, Viewport } from "next";
// 자체 호스팅 웹폰트(fontsource): woff2 를 번들에 포함해 내 도메인(Vercel)에서 서빙 →
// 외부 폰트 CDN(Google/jsdelivr) 왕복 제거. 필요한 서브셋·가중치만 import 해 용량 최소화.
// (Google Fonts 를 빌드 시 받아오는 next/font/google 과 달리 빌드에 외부 접속 불필요)
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/nanum-gothic-coding/korean-400.css";
import "@fontsource/nanum-gothic-coding/korean-700.css";
import "@fontsource/nanum-gothic-coding/latin-400.css";
import "@fontsource/nanum-gothic-coding/latin-700.css";
import "@fontsource/gothic-a1/korean-400.css";
import "@fontsource/gothic-a1/korean-700.css";
import "@fontsource/gothic-a1/latin-400.css";
import "@fontsource/gothic-a1/latin-700.css";
import "./globals.css";

// 서버 함수 실행 리전(서울/icn1)은 vercel.json 의 "regions" 로 지정한다.
// (preferredRegion 라우트 설정은 Edge 런타임 전용 — 여기 nodejs 함수엔 무효)

export const metadata: Metadata = {
  title: "경북대 공지 통합 알리미",
  description: "경북대학교·한국장학재단 여러 게시판의 공지를 한 곳에서 최신순으로.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
