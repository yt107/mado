// IP アドレスが、インターネットの公開された相手かどうか（SSRF 対策）。
// 内側のネットワーク（自分自身、社内、クラウドのメタデータサーバーなど）や、
// 特別な用途のアドレスは、すべて「公開されていない」として断る

// IPv4 の、公開されていない範囲（IANA の特別な用途のアドレス）
const PRIVATE_V4: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], // この端末
  ["10.0.0.0", 8], // 社内などのネットワーク
  ["100.64.0.0", 10], // 通信事業者の中のネットワーク
  ["127.0.0.0", 8], // 自分自身
  ["169.254.0.0", 16], // リンクローカル（クラウドのメタデータサーバーもここ）
  ["172.16.0.0", 12], // 社内などのネットワーク
  ["192.0.0.0", 24], // IETF の予約
  ["192.0.2.0", 24], // 説明用
  ["192.88.99.0", 24], // 6to4 の中継（廃止）
  ["192.168.0.0", 16], // 家庭などのネットワーク
  ["198.18.0.0", 15], // 性能テスト用
  ["198.51.100.0", 24], // 説明用
  ["203.0.113.0", 24], // 説明用
  ["224.0.0.0", 4], // マルチキャスト
  ["240.0.0.0", 4], // 予約（ブロードキャストを含む）
];

function parseV4(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function inV4Range(value: number, [base, bits]: readonly [string, number]) {
  const start = parseV4(base) ?? 0;
  const size = 2 ** (32 - bits);
  return value >= start && value < start + size;
}

// IPv6 を、16ビットずつ8つの数にする（"::" の省略と、末尾の IPv4 の形にも対応する）
function parseV6(address: string): number[] | null {
  let text = address.toLowerCase();
  if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1, -1);
  // ゾーン ID（fe80::1%eth0 の %eth0）は外す
  text = text.split("%")[0] ?? "";

  // 末尾が IPv4 の形（::ffff:127.0.0.1 など）なら、16ビット2つに直す
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseV4(tail);
    if (v4 === null) return null;
    text = `${text.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part === "" ? [] : part.split(":"));
  const head = toGroups(halves[0] ?? "");
  const rest = halves.length === 2 ? toGroups(halves[1] ?? "") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;

  const groups = [...head, ...Array<string>(missing).fill("0"), ...rest];
  const values: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    values.push(parseInt(group, 16));
  }
  return values;
}

export function isPublicIpv4(address: string): boolean {
  const value = parseV4(address);
  if (value === null) return false;
  return !PRIVATE_V4.some((range) => inV4Range(value, range));
}

export function isPublicIpv6(address: string): boolean {
  const groups = parseV6(address);
  if (!groups) return false;
  const [first = 0, second = 0] = groups;
  // 公開されているのは 2000::/3 だけ。IPv4 を埋め込んだ形（::ffff:…、64:ff9b::…）や、
  // リンクローカル（fe80::）、社内向け（fc00::）、マルチキャスト（ff00::）は、ここで断られる
  if (first < 0x2000 || first > 0x3fff) return false;
  // 2001::/23（Teredo などの IETF の予約）、2001:db8::/32（説明用）、2002::/16（6to4）
  if (first === 0x2001 && second < 0x0200) return false;
  if (first === 0x2001 && second === 0x0db8) return false;
  if (first === 0x2002) return false;
  return true;
}

// IPv4 か IPv6 の形で書かれた名前かどうか（URL に IP を直接書いたものは断るため）
export function isIpLiteral(hostname: string): boolean {
  return parseV4(hostname) !== null || parseV6(hostname) !== null;
}
