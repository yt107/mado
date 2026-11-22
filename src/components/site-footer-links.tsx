import Link from "next/link";

import { cx } from "@/lib/cx";
import { CONTACT_FORM_URL } from "@/lib/site";

// 画面の下に並べる、利用規約・プライバシーポリシー・お問い合わせのリンク
export function SiteFooterLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="サイトの情報" className={className}>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        <li>
          <Link href="/terms" className={LINK}>
            利用規約
          </Link>
        </li>
        <li>
          <Link href="/privacy" className={LINK}>
            プライバシーポリシー
          </Link>
        </li>
        {CONTACT_FORM_URL && (
          <li>
            {/* Google フォームは、Google へのログインが要るので、埋め込まず新しいタブで開く */}
            <a
              href={CONTACT_FORM_URL}
              target="_blank"
              rel="noopener"
              className={LINK}
            >
              お問い合わせ
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}

const LINK = cx("rounded text-ink-3 hover:text-ink hover:underline");
