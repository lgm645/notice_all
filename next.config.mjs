/** @type {import('next').NextConfig} */
const nextConfig = {
  // DB 클라이언트를 서버 번들에 넣지 않고 Node 런타임에서 그대로 사용
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
};

export default nextConfig;
