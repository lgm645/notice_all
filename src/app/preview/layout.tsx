import "./preview.css";

// 프리뷰 전용 레이아웃: 한글 웹폰트 로드 + 스코프 CSS.
// 각 디자인은 [data-design="..."] 래퍼 아래에서만 적용되므로 서로 간섭하지 않는다.
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700;900&family=Gothic+A1:wght@300;400;500;700;800;900&family=Black+Han+Sans&family=Nanum+Gothic+Coding:wght@400;700&family=JetBrains+Mono:wght@400;500;700&family=Bebas+Neue&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      {children}
    </>
  );
}
