import type { Metadata, Viewport } from "next";
import "./globals.css";

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
      <body>
        {/* Data Terminal 디자인용 웹폰트 (제목=Pretendard, 모노=JetBrains/나눔고딕코딩) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700;800&family=Nanum+Gothic+Coding:wght@400;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        {children}
      </body>
    </html>
  );
}
