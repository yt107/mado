// サイト全体で使う情報（利用規約、プライバシーポリシー、画面の下のリンク）

// お問い合わせを受け付ける Google フォームの URL（null にすると、お問い合わせのリンクを出さない）。
// 迷惑メールを避けるため、メールアドレスはサイトにもリポジトリにも載せず、フォームで受け付ける。
// 短縮 URL（forms.gle）ではなく、転送先の元の URL を書く（短縮サービスの終了に左右されないように）
export const CONTACT_FORM_URL: string | null =
  "https://docs.google.com/forms/d/e/1FAIpQLSfPd10WD24tOYfV10lUrVrw0bhbsf1fBq0gK1_wMndz00N2TQ/viewform";

// 利用規約とプライバシーポリシーを定めた日
export const POLICY_EFFECTIVE_DATE = "2026年11月21日";
