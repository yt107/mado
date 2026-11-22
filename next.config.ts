import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // 応答に「Next.js で作っている」ことを書かない（X-Powered-By ヘッダー）
  poweredByHeader: false,
  // 安全のためのヘッダーを、すべてのページと API に付ける（Next.js の headers の資料の例をもとにする）
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HTTPS でだけ開くよう、ブラウザに覚えてもらう（2年）。
          // preload（ブラウザに最初から登録してもらう指定）は、自分のドメインを持つまで付けない
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // ほかのサイトの iframe の中に表示させない（クリックジャッキング対策）
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // ファイルの種類を、ブラウザに推測させない
          { key: "X-Content-Type-Options", value: "nosniff" },
          // ほかのサイトへ移るときは、URL のパスを送らない（ブラウザの標準と同じ値を明示する）
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // カメラとマイクは使わない。位置情報は、天気の「現在地」のために自分のサイトだけ許す
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(self), browsing-topics=()",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
