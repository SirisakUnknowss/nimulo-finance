import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว · Privacy Policy — nimulo.",
  description: "nimulo. เก็บข้อมูลการเงินของคุณไว้ในอุปกรณ์ของคุณเท่านั้น",
};

const UPDATED = "3 ตุลาคม 2569 · October 3, 2026";
const CONTACT = "https://github.com/SirisakUnknowss/nimulo-finance/issues";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">นโยบายความเป็นส่วนตัว</h1>
        <p className="text-sm text-muted-foreground">Privacy Policy · อัปเดตล่าสุด / Last updated: {UPDATED}</p>
      </header>

      <div className="glass-card space-y-6 rounded-[20px] p-6">
        <h2 className="text-lg font-semibold">ภาษาไทย</h2>

        <Section title="สรุปสั้นๆ">
          <p>
            nimulo. เก็บข้อมูลการเงินที่คุณบันทึก (บัญชี รายการรายรับรายจ่าย และอื่นๆ) ไว้ในอุปกรณ์ของคุณเท่านั้น
            เราไม่มีเซิร์ฟเวอร์เก็บข้อมูลของคุณ ไม่มีระบบสมัครสมาชิก และไม่เชื่อมต่อกับธนาคารหรือสถาบันการเงินใดๆ
          </p>
        </Section>

        <Section title="ข้อมูลที่เราเก็บ">
          <p>
            ข้อมูลที่คุณกรอกเอง ได้แก่ ชื่อที่ใช้แสดง ชื่อและยอดบัญชี รายการรายรับรายจ่าย หมวดหมู่ และข้อมูลอื่นที่คุณบันทึกในแอป
            ข้อมูลเหล่านี้ถูกเก็บในที่เก็บข้อมูลของแอปบนอุปกรณ์ของคุณ (แอปมือถือ) หรือในเบราว์เซอร์ของคุณ (เว็บ) เท่านั้น
          </p>
        </Section>

        <Section title="สิ่งที่เราไม่ทำ">
          <ul className="list-disc space-y-1 pl-5">
            <li>ไม่ส่งข้อมูลการเงินของคุณออกจากอุปกรณ์ และไม่ขายหรือแบ่งปันข้อมูลให้บุคคลที่สาม</li>
            <li>ไม่ใช้เครื่องมือวิเคราะห์การใช้งาน โฆษณา หรือการติดตามข้ามแอป</li>
            <li>ไม่ขอหรือเก็บรหัสผ่านธนาคาร เลขบัตร หรือข้อมูลรับรองบัญชีการเงินจริง</li>
            <li>ไม่เข้าถึงกล้อง ไมโครโฟน รายชื่อติดต่อ หรือตำแหน่งที่ตั้งของคุณ</li>
          </ul>
        </Section>

        <Section title="เว็บไซต์">
          <p>
            เว็บไซต์ให้บริการผ่าน GitHub Pages ผู้ให้บริการโฮสต์อาจบันทึกข้อมูลการเข้าชมทั่วไป เช่น ที่อยู่ IP ตามนโยบายของ GitHub
            ซึ่งอยู่นอกเหนือการควบคุมของเรา ข้อมูลการเงินของคุณไม่ถูกส่งไปที่นั่น
          </p>
        </Section>

        <Section title="การลบข้อมูลและการควบคุมของคุณ">
          <p>
            คุณลบข้อมูลทั้งหมดได้เองที่ ตั้งค่า &gt; ลบข้อมูลทั้งหมด หรือโดยการลบแอป (มือถือ) หรือล้างข้อมูลเว็บไซต์ (เว็บ)
            เมื่อลบแล้วไม่สามารถกู้คืนได้ เพราะเราไม่มีสำเนาข้อมูลของคุณ
          </p>
        </Section>

        <Section title="เด็ก">
          <p>nimulo. ไม่ได้มุ่งเป้าไปที่เด็กอายุต่ำกว่า 13 ปี และเราไม่รวบรวมข้อมูลส่วนบุคคลจากผู้ใช้ใดๆ</p>
        </Section>

        <Section title="การเปลี่ยนแปลงนโยบาย">
          <p>หากมีการเปลี่ยนแปลง เราจะปรับวันที่อัปเดตล่าสุดในหน้านี้</p>
        </Section>

        <Section title="ติดต่อเรา">
          <p>
            หากมีคำถาม ติดต่อได้ที่{" "}
            <a className="text-accent underline underline-offset-2" href={CONTACT}>
              GitHub Issues
            </a>
          </p>
        </Section>
      </div>

      <div className="glass-card space-y-6 rounded-[20px] p-6">
        <h2 className="text-lg font-semibold">English</h2>

        <Section title="Summary">
          <p>
            nimulo. keeps the financial data you enter (accounts, income and expense transactions, and so on) only on your own
            device. We run no server that stores your data, have no sign-up, and do not connect to banks or financial
            institutions.
          </p>
        </Section>

        <Section title="Data we handle">
          <p>
            Only what you type in: display name, account names and balances, transactions, categories and similar entries. It is
            stored in the app&apos;s local storage on your device (mobile app) or in your browser (web).
          </p>
        </Section>

        <Section title="What we do not do">
          <ul className="list-disc space-y-1 pl-5">
            <li>We do not transmit your financial data off your device, and we never sell or share it with third parties.</li>
            <li>We use no analytics, advertising, or cross-app tracking.</li>
            <li>We never ask for or store bank passwords, card numbers, or real account credentials.</li>
            <li>We do not access your camera, microphone, contacts, or location.</li>
          </ul>
        </Section>

        <Section title="Website">
          <p>
            The website is hosted on GitHub Pages. The host may log standard visit data such as IP addresses under GitHub&apos;s
            own policies, which we do not control. Your financial data is not sent there.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            You can delete everything yourself at Settings &gt; Delete all data, by uninstalling the app (mobile), or by clearing
            site data (web). Deletion is permanent because we hold no copy.
          </p>
        </Section>

        <Section title="Children">
          <p>nimulo. is not directed at children under 13, and we do not collect personal information from any user.</p>
        </Section>

        <Section title="Changes">
          <p>If this policy changes, we will update the date at the top of this page.</p>
        </Section>

        <Section title="Contact">
          <p>
            Questions? Reach us via{" "}
            <a className="text-accent underline underline-offset-2" href={CONTACT}>
              GitHub Issues
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
