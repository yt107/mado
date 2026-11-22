// 退会の手続きの途中であることを、Google の再ログインのあいだだけ覚えておく。
// 戻ってきたときに、同じアカウントで再ログインしたかを確かめてから削除する（別のアカウントを消さないため）

const KEY = "mado:withdraw-intent";
// 手続きを始めてから、この時間をすぎたら無効にする（API 側の10分の制限より少し長め）
export const WITHDRAW_INTENT_TTL_MS = 15 * 60 * 1000;

type Intent = { userId: string; startedAt: number };

export function saveWithdrawIntent(userId: string, now = Date.now()) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ userId, startedAt: now } satisfies Intent),
    );
    return true;
  } catch {
    // ブラウザの設定などで保存できない
    return false;
  }
}

// 保存した手続きを読み、消す（1回だけ使う）。ない、壊れている、古いときは null
export function takeWithdrawIntent(now = Date.now()): Intent | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "userId" in value &&
      "startedAt" in value &&
      typeof value.userId === "string" &&
      typeof value.startedAt === "number" &&
      now - value.startedAt <= WITHDRAW_INTENT_TTL_MS
    ) {
      return { userId: value.userId, startedAt: value.startedAt };
    }
  } catch {
    // 壊れた値は無視する
  }
  return null;
}
