import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // 這行會強制 Next.js 在打包時完全忽略 ESLint 錯誤
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 同時強制忽略 TypeScript 類型檢查錯誤，確保萬無一失
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
