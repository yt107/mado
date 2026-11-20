import { promises as dns } from "node:dns";

import { isIpLiteral, isPublicIpv4, isPublicIpv6 } from "./ip";

// 利用者が入力した URL（iCal、RSS）を、サーバーから安全に読む（SSRF 対策）。
// - https で、ポートが 443 のものだけ。URL にユーザー名・パスワードや IP アドレスを書いたものは断る
// - 名前を DNS で引き、内側のアドレス（自分自身、社内、メタデータサーバーなど）なら断る
// - 転送（リダイレクト）は自動で追わず、1回ごとに同じ確認をする
// - 時間と大きさに上限を設ける
// DNS は node:dns の resolve4 / resolve6 を使う（Cloudflare Workers でも動く）。
// 確かめたあとに DNS の答えを変えられても、https なので、相手が正しい証明書を出せずにつながらない

export type SafeFetchErrorReason =
  | "invalid_url"
  | "blocked"
  | "not_found"
  | "timeout"
  | "too_large"
  | "http_error"
  | "network";

export class SafeFetchError extends Error {
  constructor(
    readonly reason: SafeFetchErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 2048;
const DEFAULT_TIMEOUT_MS = 10_000;
const DNS_TIMEOUT_MS = 3_000;

// 社内や端末の中だけで使う名前
const LOCAL_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".lan",
  ".intranet",
];

// 入力された URL を確かめて、読みに行ってよい形にする。webcal:// は https:// として読む
export function parsePublicUrl(raw: string): URL {
  const text = raw.trim().replace(/^webcals?:\/\//i, "https://");
  if (text.length === 0 || text.length > MAX_URL_LENGTH) {
    throw new SafeFetchError("invalid_url", "URL が正しくありません");
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new SafeFetchError("invalid_url", "URL が正しくありません");
  }
  if (url.protocol !== "https:") {
    throw new SafeFetchError(
      "invalid_url",
      "https:// で始まる URL を入力してください",
    );
  }
  if (url.username || url.password) {
    throw new SafeFetchError(
      "invalid_url",
      "ユーザー名やパスワードを含む URL は使えません",
    );
  }
  if (url.port !== "") {
    throw new SafeFetchError("blocked", "この URL は読み込めません");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    isIpLiteral(host) ||
    !host.includes(".") ||
    host === "localhost" ||
    LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    throw new SafeFetchError("blocked", "この URL は読み込めません");
  }
  url.hash = "";
  return url;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new SafeFetchError("timeout", "時間内に応答がありません")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// 名前を DNS で引き、すべてのアドレスが公開されたものかを確かめる
export async function assertPublicHost(hostname: string): Promise<void> {
  const [v4, v6] = await Promise.allSettled([
    withTimeout(dns.resolve4(hostname), DNS_TIMEOUT_MS),
    withTimeout(dns.resolve6(hostname), DNS_TIMEOUT_MS),
  ]);
  const v4List = v4.status === "fulfilled" ? v4.value : [];
  const v6List = v6.status === "fulfilled" ? v6.value : [];
  if (v4List.length === 0 && v6List.length === 0) {
    const timedOut = [v4, v6].some(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof SafeFetchError &&
        result.reason.reason === "timeout",
    );
    throw timedOut
      ? new SafeFetchError("timeout", "時間内に応答がありません")
      : new SafeFetchError("not_found", "サイトが見つかりません");
  }
  if (!v4List.every(isPublicIpv4) || !v6List.every(isPublicIpv6)) {
    throw new SafeFetchError("blocked", "この URL は読み込めません");
  }
}

// 本文の文字コード。Content-Type、XML の宣言、HTML の meta の順に探し、なければ UTF-8
function detectCharset(contentType: string, head: Uint8Array): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader;
  // 先頭は ASCII として読めば足りる（宣言は ASCII で書かれる）
  const ascii = String.fromCharCode(...head.subarray(0, 1024));
  return (
    /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(ascii)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(ascii)?.[1] ??
    "utf-8"
  );
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    // 知らない文字コードなら、UTF-8 として読む
    return new TextDecoder().decode(bytes);
  }
}

// 本文を、上限の大きさまで読む
async function readLimited(res: Response, maxBytes: number) {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel();
    throw new SafeFetchError("too_large", "データが大きすぎます");
  }
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError("too_large", "データが大きすぎます");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export type SafeFetchResult = {
  // 転送のあとの、最後の URL
  url: string;
  contentType: string;
  text: string;
};

export async function safeFetch(
  rawUrl: string,
  {
    maxBytes,
    accept,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: { maxBytes: number; accept: string; timeoutMs?: number },
): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = rawUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = parsePublicUrl(current);
      await assertPublicHost(url.hostname);
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { accept, "user-agent": "Mado/1.0" },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        current = new URL(location, url).href;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        throw new SafeFetchError(
          "http_error",
          res.status === 404
            ? "ページが見つかりません（404）"
            : `読み込めませんでした（${res.status}）`,
        );
      }
      const bytes = await readLimited(res, maxBytes);
      const contentType = res.headers.get("content-type") ?? "";
      return {
        url: url.href,
        contentType,
        text: decode(bytes, detectCharset(contentType, bytes)),
      };
    }
    throw new SafeFetchError("blocked", "転送が多すぎます");
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    if (signal.aborted) {
      throw new SafeFetchError("timeout", "時間内に応答がありません");
    }
    throw new SafeFetchError("network", "読み込めませんでした");
  }
}
