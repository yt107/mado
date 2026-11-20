// 秘密の値（iCal の非公開 URL）を、DB に入れる前に暗号化する。
// Web Crypto の AES-256-GCM を使う（パッケージ不要。Node.js でも Cloudflare Workers でも動く）。
// 鍵は環境変数 ENCRYPTION_KEY（32バイトを Base64 にしたもの）。ログインの鍵とは分けて持つ
//
// 保存する形：[バージョン 1バイト][IV 12バイト][暗号文と認証タグ]

const VERSION = 1;
const IV_LENGTH = 12;
// 何に使う暗号文かを、暗号化に混ぜておく（ほかの用途の暗号文と取り違えないため）
const PURPOSE = new TextEncoder().encode("mado:calendar-url");

let cachedKey: { raw: string; key: Promise<CryptoKey> } | null = null;

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getKey(): Promise<CryptoKey> {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY が設定されていません");
  }
  if (cachedKey?.raw !== raw) {
    const bytes = base64ToBytes(raw.trim());
    if (bytes.length !== 32) {
      throw new Error(
        "ENCRYPTION_KEY は32バイトを Base64 にした値にしてください",
      );
    }
    cachedKey = {
      raw,
      key: crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
        "encrypt",
        "decrypt",
      ]),
    };
  }
  return cachedKey.key;
}

export async function encryptText(text: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: PURPOSE },
    await getKey(),
    new TextEncoder().encode(text),
  );
  const out = new Uint8Array(1 + IV_LENGTH + cipher.byteLength);
  out[0] = VERSION;
  out.set(iv, 1);
  out.set(new Uint8Array(cipher), 1 + IV_LENGTH);
  return out;
}

export async function decryptText(data: Uint8Array): Promise<string> {
  if (data[0] !== VERSION || data.length <= 1 + IV_LENGTH) {
    throw new Error("暗号文の形が正しくありません");
  }
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: data.slice(1, 1 + IV_LENGTH),
      additionalData: PURPOSE,
    },
    await getKey(),
    data.slice(1 + IV_LENGTH),
  );
  return new TextDecoder().decode(plain);
}
