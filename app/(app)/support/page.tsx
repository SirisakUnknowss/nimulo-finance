import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Coffee, Download, Landmark, ScanLine, Wallet } from "lucide-react";
import { assetPath } from "@/lib/utils";

const STEPS = [
  { icon: Landmark, label: "เปิดแอปธนาคาร" },
  { icon: ScanLine, label: "สแกน QR" },
  { icon: Wallet, label: "ใส่จำนวนเงินตามสะดวก" },
];

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Coffee className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">เลี้ยงกาแฟ dev สักแก้ว</h2>
        <p className="text-sm text-muted-foreground">
          nimulo ใช้ฟรีทุกฟีเจอร์ ไม่มีโฆษณา ถ้าแอปช่วยคุณได้ ร่วมสนับสนุนให้ผมพัฒนาต่อได้นะครับ
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no next/image optimization */}
        <img
          src={assetPath("/support/coffee-qr.webp")}
          alt="QR Code PromptPay สำหรับเลี้ยงกาแฟผู้พัฒนา nimulo"
          width={1122}
          height={1402}
          className="block h-auto w-full"
        />
      </Card>

      <a
        href={assetPath("/support/coffee-qr.png")}
        download="nimulo-coffee-qr.png"
        className={buttonVariants({ size: "lg", className: "w-full rounded-full" })}
      >
        <Download className="h-4 w-4" />
        บันทึกรูป QR
      </a>
      <p className="-mt-3 text-center text-xs text-muted-foreground">
        สแกนจากมือถือเครื่องเดียวกันไม่ได้? บันทึกรูปแล้วเลือก &quot;สแกนจากรูปภาพ&quot; ในแอปธนาคาร
      </p>

      <div className="grid grid-cols-3 gap-2">
        {STEPS.map(({ icon: Icon, label }, i) => (
          <div key={label} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/60 p-3 text-center">
            <Icon className="h-5 w-5 text-accent" />
            <p className="text-xs">
              <span className="text-muted-foreground">{i + 1}. </span>
              {label}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 text-center text-sm">
          ทุกแก้วคือกำลังใจ 💚 ขอบคุณที่ช่วยให้ nimulo ฟรีต่อไปครับ
        </CardContent>
      </Card>

      <p className="pb-4 text-center text-xs text-muted-foreground">
        การสนับสนุนเป็นไปตามความสมัครใจ ทุกฟีเจอร์ยังใช้ฟรีเหมือนเดิม
      </p>
    </div>
  );
}
