import type { Metadata } from "next";
import Link from "next/link";

import {
  ContactSection,
  DocList,
  DocPage,
  DocSection,
} from "@/components/doc-page";

export const metadata: Metadata = {
  title: "利用規約",
};

// 利用規約
export default function TermsPage() {
  return (
    <DocPage
      title="利用規約"
      lead={
        <p>
          この利用規約は、Mado（以下「本サービス」）の利用条件を定めるものです。本サービスは、個人が開発・運営している無料サービスです。本サービスを利用する方（以下「利用者」）は、この利用規約に同意したうえでご利用ください。
        </p>
      }
    >
      <DocSection title="第1条（アカウント）">
        <p>
          利用者は、Google
          アカウントでログインすることで、本サービスを利用できます。アカウントの管理は、利用者の責任で行ってください。
        </p>
      </DocSection>

      <DocSection title="第2条（禁止事項）">
        <p>利用者は、本サービスの利用にあたり、次の行為をしてはいけません。</p>
        <DocList
          items={[
            "法令または公序良俗に反する行為",
            "第三者になりすます行為",
            "短時間に大量のリクエストを送るなど、本サービスのサーバーに過度な負担をかける行為",
            "本サービスへの不正アクセスや、本サービスを利用してほかのサイトを攻撃する行為",
            "第三者の権利（著作権やプライバシーなど）を侵害する行為（侵害するおそれのあるカレンダーやニュースの URL の登録を含む）",
            "その他、本サービスの運営を妨げる行為",
          ]}
        />
      </DocSection>

      <DocSection title="第3条（外部から取得する情報）">
        <p>
          天気、カレンダー、ニュースなどの情報は、外部のサービスやサイトから取得して表示します。これらの情報の正確性や、継続的に取得できることは保証しません。外部のサービスやサイトを利用する際は、それぞれの利用規約や条件にも従ってください。
        </p>
      </DocSection>

      <DocSection title="第4条（サービスの変更・停止）">
        <p>
          本サービスは、予告なく内容の変更、提供の一時停止、または終了を行うことがあります。
        </p>
      </DocSection>

      <DocSection title="第5条（退会）">
        <p>
          利用者は、
          <Link
            href="/mypage"
            className="text-ink underline underline-offset-4"
          >
            マイページ
          </Link>
          からいつでも退会できます。退会すると、アカウントおよび登録されたデータはすべて削除され、元に戻すことはできません。
        </p>
      </DocSection>

      <DocSection title="第6条（利用の停止）">
        <p>
          利用者が第2条の禁止事項に該当する行為を行った場合、事前の通知なく利用を停止し、またはアカウントを削除することがあります。
        </p>
      </DocSection>

      <DocSection title="第7条（保証と責任）">
        <p>
          本サービスは、現状のまま提供します。特定の目的に適合することや、不具合がないことは保証しません。
        </p>
        <p>
          本サービスの利用（または利用できないこと）によって利用者に損害が生じても、運営者に故意または重大な過失がある場合を除き、責任を負いません。
        </p>
      </DocSection>

      <DocSection title="第8条（利用規約の変更）">
        <p>
          この利用規約は、必要に応じて変更することがあります。変更したときはこのページに掲載し、必要に応じて本サービスの画面上でもお知らせします。
        </p>
      </DocSection>

      <DocSection title="第9条（準拠法）">
        <p>この利用規約の解釈にあたっては、日本法を準拠法とします。</p>
      </DocSection>

      <ContactSection />
    </DocPage>
  );
}
