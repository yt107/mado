// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isIpLiteral, isPublicIpv4, isPublicIpv6 } from "@/server/net/ip";
import {
  parsePublicUrl,
  safeFetch,
  SafeFetchError,
} from "@/server/net/safe-fetch";

// DNS の答えを、テストごとに決める（名前 → アドレス）
const dnsAnswers = vi.hoisted(() => ({
  v4: new Map<string, string[]>(),
  v6: new Map<string, string[]>(),
}));

vi.mock("node:dns", () => {
  const lookup = (table: Map<string, string[]>) => async (host: string) => {
    const found = table.get(host);
    if (!found)
      throw Object.assign(new Error("not found"), { code: "ENODATA" });
    return found;
  };
  return {
    promises: {
      resolve4: lookup(dnsAnswers.v4),
      resolve6: lookup(dnsAnswers.v6),
    },
  };
});

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  dnsAnswers.v4.clear();
  dnsAnswers.v6.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function reasonOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof SafeFetchError ? error.reason : "other";
  }
  return "ok";
}

describe("IP アドレスの判定", () => {
  test.each([
    ["8.8.8.8", true],
    ["133.242.0.1", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.16.0.1", false],
    ["172.31.255.255", false],
    ["172.32.0.1", true],
    ["192.168.1.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["255.255.255.255", false],
    ["224.0.0.1", false],
  ])("IPv4 %s は公開されている：%s", (address, expected) => {
    expect(isPublicIpv4(address)).toBe(expected);
  });

  test.each([
    ["2404:6800:4004:80c::200e", true],
    ["2001:4860:4860::8888", true],
    ["::1", false],
    ["::", false],
    ["::ffff:127.0.0.1", false],
    ["::ffff:8.8.8.8", false],
    ["64:ff9b::a9fe:a9fe", false],
    ["fe80::1", false],
    ["fd00::1", false],
    ["ff02::1", false],
    ["2001:db8::1", false],
    ["2001::1", false],
    ["2002:7f00:1::1", false],
    ["[::1]", false],
  ])("IPv6 %s は公開されている：%s", (address, expected) => {
    expect(isPublicIpv6(address)).toBe(expected);
  });

  test("IP をそのまま書いた名前を見分ける", () => {
    expect(isIpLiteral("127.0.0.1")).toBe(true);
    expect(isIpLiteral("[::1]")).toBe(true);
    expect(isIpLiteral("example.com")).toBe(false);
  });
});

describe("URL の確認", () => {
  test("webcal:// は https:// として読む", () => {
    expect(parsePublicUrl("webcal://example.com/a.ics").href).toBe(
      "https://example.com/a.ics",
    );
  });

  test.each([
    ["http://example.com/feed", "invalid_url"],
    ["ftp://example.com/feed", "invalid_url"],
    ["not a url", "invalid_url"],
    ["https://user:pass@example.com/", "invalid_url"],
    ["https://example.com:8443/feed", "blocked"],
    ["https://127.0.0.1/feed", "blocked"],
    ["https://0x7f.1/feed", "blocked"],
    ["https://2130706433/feed", "blocked"],
    ["https://[::1]/feed", "blocked"],
    ["https://localhost/feed", "blocked"],
    ["https://metadata.google.internal/computeMetadata/v1/", "blocked"],
    ["https://printer.local/", "blocked"],
    ["https://intranet/", "blocked"],
  ])("%s は断る（%s）", (url, reason) => {
    expect(() => parsePublicUrl(url)).toThrowError(
      expect.objectContaining({ reason }),
    );
  });
});

describe("safeFetch", () => {
  const options = { maxBytes: 1000, accept: "*/*" };

  test("公開されたアドレスなら読む", async () => {
    dnsAnswers.v4.set("example.com", ["93.184.215.14"]);
    fetchMock.mockResolvedValueOnce(
      new Response("hello", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );
    const res = await safeFetch("https://example.com/a", options);
    expect(res.text).toBe("hello");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://example.com/a"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  test("DNS の答えに内側のアドレスが1つでもあれば、つながずに断る", async () => {
    dnsAnswers.v4.set("evil.example", ["93.184.215.14", "169.254.169.254"]);
    expect(await reasonOf(safeFetch("https://evil.example/", options))).toBe(
      "blocked",
    );
    dnsAnswers.v6.set("evil6.example", ["::1"]);
    expect(await reasonOf(safeFetch("https://evil6.example/", options))).toBe(
      "blocked",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("名前が見つからなければ not_found", async () => {
    expect(await reasonOf(safeFetch("https://nowhere.example/", options))).toBe(
      "not_found",
    );
  });

  test("転送先も同じように確かめる", async () => {
    dnsAnswers.v4.set("example.com", ["93.184.215.14"]);
    dnsAnswers.v4.set("inside.example", ["10.0.0.5"]);
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://inside.example/secret" },
      }),
    );
    expect(await reasonOf(safeFetch("https://example.com/", options))).toBe(
      "blocked",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // http への転送も断る
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 301,
        headers: { location: "http://example.com/plain" },
      }),
    );
    expect(await reasonOf(safeFetch("https://example.com/", options))).toBe(
      "invalid_url",
    );
  });

  test("転送は3回まで追う", async () => {
    dnsAnswers.v4.set("example.com", ["93.184.215.14"]);
    fetchMock.mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/again" },
        }),
    );
    expect(await reasonOf(safeFetch("https://example.com/", options))).toBe(
      "blocked",
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("大きすぎるものは途中でやめる", async () => {
    dnsAnswers.v4.set("example.com", ["93.184.215.14"]);
    fetchMock.mockResolvedValueOnce(
      new Response("x".repeat(10), { headers: { "content-length": "5000" } }),
    );
    expect(await reasonOf(safeFetch("https://example.com/", options))).toBe(
      "too_large",
    );
    // Content-Length がなくても、読んだ量で止める
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(2000)));
    expect(await reasonOf(safeFetch("https://example.com/", options))).toBe(
      "too_large",
    );
  });

  test("エラーの状態コードは http_error", async () => {
    dnsAnswers.v4.set("example.com", ["93.184.215.14"]);
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 404 }));
    expect(await reasonOf(safeFetch("https://example.com/", options))).toBe(
      "http_error",
    );
  });

  test("XML の宣言の文字コード（Shift_JIS）で読む", async () => {
    dnsAnswers.v4.set("example.com", ["93.184.215.14"]);
    // 「天気」を Shift_JIS にしたもの
    const body = new Uint8Array([
      ...new TextEncoder().encode(
        '<?xml version="1.0" encoding="Shift_JIS"?><t>',
      ),
      0x93,
      0x56,
      0x8b,
      0x43,
      ...new TextEncoder().encode("</t>"),
    ]);
    fetchMock.mockResolvedValueOnce(
      new Response(body, { headers: { "content-type": "application/xml" } }),
    );
    const res = await safeFetch("https://example.com/", options);
    expect(res.text).toContain("<t>天気</t>");
  });
});
