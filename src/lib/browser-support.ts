// Google のログインが使えないブラウザかどうか。
// Google は、アプリの中に組み込まれたブラウザ（WebView）からのログインを断る
// （LINE や Instagram の中で開いたページ、キオスク用のアプリなど）。
// そこでは「Google で続行」を押せないようにして、Chrome や Safari で開くよう案内する
const EMBEDDED_BROWSER_PATTERNS = [
  /\bLine\//i, // LINE
  /Instagram/i,
  /FBAN|FBAV|FB_IAB|FBIOS/, // Facebook、Messenger
  /MicroMessenger/i, // WeChat
  /\bTwitter/i, // X（旧 Twitter）の Android アプリ
  /BytedanceWebview|musical_ly|TikTok/i, // TikTok
  /KAKAOTALK/i,
  /; wv\)/, // Android の WebView（キオスク用のアプリも、多くはこれ）
];

export function isEmbeddedBrowser(userAgent: string): boolean {
  return EMBEDDED_BROWSER_PATTERNS.some((pattern) => pattern.test(userAgent));
}
