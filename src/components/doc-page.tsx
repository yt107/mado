import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CONTACT_FORM_URL, POLICY_EFFECTIVE_DATE } from "@/lib/site";

import { Logo } from "./logo";
import { SiteFooterLinks } from "./site-footer-links";

// 利用規約やプライバシーポリシーなど、読むためのページの枠
export function DocPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-line px-6 py-5 sm:px-10">
        <Link href="/" className="inline-block rounded-lg">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-10">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-ink-3">{POLICY_EFFECTIVE_DATE} 制定</p>
        <div className="mt-6 leading-relaxed text-ink-2">{lead}</div>
        <div className="mt-10 flex flex-col gap-9">{children}</div>
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-6 text-xs sm:px-10">
        <span className="text-ink-3">© 2026 Mado</span>
        <SiteFooterLinks />
      </footer>
    </div>
  );
}

// 1つの条や項目
export function DocSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}

// 箇条書き
export function DocList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-6 marker:text-ink-3">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

// お問い合わせ先（Google フォーム）
export function ContactSection() {
  return (
    <DocSection title="お問い合わせ">
      {CONTACT_FORM_URL ? (
        <>
          <p>
            本サービスに関するご質問やご要望、不具合のご報告は、お問い合わせフォームからお寄せください。お問い合わせには
            Google フォームを利用しており、送信には Google
            アカウントでのログインが必要です。
          </p>
          <p>
            {/* Google へのログインが要るので、埋め込まず新しいタブで開く */}
            <a
              href={CONTACT_FORM_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 font-bold text-ink underline underline-offset-4"
            >
              お問い合わせフォームを開く
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </p>
        </>
      ) : (
        <p>お問い合わせ先は、準備ができ次第こちらに記載します。</p>
      )}
    </DocSection>
  );
}
