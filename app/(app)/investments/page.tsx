"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Plus } from "lucide-react";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB, formatDateThai } from "@/lib/utils";
import { computeHoldingMarketValue } from "@/lib/finance/calculations";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import type { InvestmentAssetType, TradeType } from "@/lib/finance/types";

const ASSET_LABELS: Record<InvestmentAssetType, string> = { stock: "หุ้น", etf: "ETF", mutual_fund: "กองทุนรวม", other: "อื่นๆ" };
const PALETTE = ["#467A64", "#6FA88A", "#C97B4A", "#5A7FB0", "#A0699E", "#C9A24A"];
// Computed once at module load (not during render) - a price older than this is flagged stale.
const STALE_PRICE_THRESHOLD_MS = Date.now() - 30 * 24 * 60 * 60 * 1000;

export default function InvestmentsPage() {
  const { portfoliosWithMetrics, addHolding, addTrade, accountsWithBalances, data } = useFinanceData();
  const [tradeOpen, setTradeOpen] = useState<string | null>(null);
  const [holdingOpen, setHoldingOpen] = useState<string | null>(null);

  const [tradeType, setTradeType] = useState<TradeType>("buy");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeAmount, setTradeAmount] = useState("");

  const [symbol, setSymbol] = useState("");
  const [hName, setHName] = useState("");
  const [assetType, setAssetType] = useState<InvestmentAssetType>("stock");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [latestPrice, setLatestPrice] = useState("");

  const investCashAccounts = accountsWithBalances.filter((a) => a.account.type === "investment_cash");
  const staleThreshold = STALE_PRICE_THRESHOLD_MS;

  function handleAddHolding(e: React.FormEvent) {
    e.preventDefault();
    if (!holdingOpen || !symbol || !quantity || !avgCost || !latestPrice) return;
    addHolding({
      portfolioId: holdingOpen,
      symbol,
      name: hName || symbol,
      assetType,
      quantity: Number(quantity),
      avgCost: Number(avgCost),
      currency,
      latestPrice: Number(latestPrice),
      latestPriceDate: new Date().toISOString().slice(0, 10),
      fxRateToBase: currency !== "THB" ? 36 : null,
      fxRateDate: currency !== "THB" ? new Date().toISOString().slice(0, 10) : null,
    });
    setSymbol(""); setHName(""); setQuantity(""); setAvgCost(""); setLatestPrice("");
    setHoldingOpen(null);
  }

  function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!tradeOpen) return;
    const amt = tradeType === "dividend" ? Number(tradeAmount) : Number(tradeQty) * Number(tradePrice);
    addTrade({
      holdingId: tradeOpen,
      type: tradeType,
      quantity: tradeType === "dividend" ? 0 : Number(tradeQty),
      price: tradeType === "dividend" ? 0 : Number(tradePrice),
      amount: amt,
      date: new Date().toISOString().slice(0, 10),
    });
    setTradeQty(""); setTradePrice(""); setTradeAmount("");
    setTradeOpen(null);
  }

  if (portfoliosWithMetrics.length === 0) {
    return <EmptyState title="ยังไม่มีการลงทุนของฉัน" description="เพิ่มพอร์ตการลงทุนเพื่อเริ่มติดตามหุ้น กองทุน และสินทรัพย์อื่นๆ" />;
  }

  return (
    <div className="space-y-6">
      {portfoliosWithMetrics.map(({ portfolio, holdings, metrics, snapshots }) => {
        const allocationData = holdings.map((h, i) => ({
          name: h.symbol,
          value: computeHoldingMarketValue(h, data.profile.baseCurrency),
          color: PALETTE[i % PALETTE.length],
        }));
        const trendData = snapshots.map((s) => ({ label: s.date.slice(5), value: s.marketValue }));

        return (
          <div key={portfolio.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{portfolio.name}</h2>
              <Button size="sm" onClick={() => setHoldingOpen(portfolio.id)}><Plus className="h-4 w-4" />เพิ่มสินทรัพย์</Button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card><CardHeader><CardTitle>เงินลงทุนสะสม</CardTitle></CardHeader><CardContent className="pt-1"><CardValue className="text-lg">{formatTHB(metrics.investedCapital)}</CardValue></CardContent></Card>
              <Card><CardHeader><CardTitle>มูลค่าตลาด</CardTitle></CardHeader><CardContent className="pt-1"><CardValue className="text-lg">{formatTHB(metrics.marketValue)}</CardValue></CardContent></Card>
              <Card>
                <CardHeader><CardTitle>กำไร/ขาดทุน</CardTitle></CardHeader>
                <CardContent className="pt-1">
                  <CardValue className={`text-lg ${metrics.unrealizedGainLoss >= 0 ? "text-success" : "text-danger"}`}>{formatTHB(metrics.unrealizedGainLoss)}</CardValue>
                  {metrics.unrealizedGainLossPercent !== null && <p className="text-xs text-muted-foreground">{metrics.unrealizedGainLossPercent.toFixed(2)}%</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>เงินสดในพอร์ต</CardTitle></CardHeader>
                <CardContent className="pt-1">
                  <CardValue className="text-lg">{formatTHB(investCashAccounts.find((a) => a.account.id === portfolio.cashAccountId)?.balance ?? 0)}</CardValue>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>สัดส่วนการลงทุน</CardTitle></CardHeader>
                <CardContent>{allocationData.length ? <CategoryPieChart data={allocationData} /> : <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีสินทรัพย์</p>}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>มูลค่าพอร์ตย้อนหลัง (จากข้อมูลจริงเท่านั้น)</CardTitle></CardHeader>
                <CardContent>{trendData.length ? <TrendLineChart data={trendData} /> : <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลย้อนหลัง</p>}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>สินทรัพย์ในพอร์ต</CardTitle></CardHeader>
              <CardContent className="pt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2">สัญลักษณ์</th>
                      <th className="py-2 pr-2">ประเภท</th>
                      <th className="py-2 pr-2 text-right">จำนวน</th>
                      <th className="py-2 pr-2 text-right">ต้นทุนเฉลี่ย</th>
                      <th className="py-2 pr-2 text-right">ราคาล่าสุด</th>
                      <th className="py-2 pr-2 text-right">มูลค่าตลาด</th>
                      <th className="py-2 pr-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => {
                      const stale = new Date(h.latestPriceDate).getTime() < staleThreshold;
                      return (
                        <tr key={h.id} className="border-b border-border/60">
                          <td className="py-2 pr-2 font-medium">{h.symbol}<p className="text-xs text-muted-foreground font-normal">{h.name}</p></td>
                          <td className="py-2 pr-2">{ASSET_LABELS[h.assetType]}</td>
                          <td className="py-2 pr-2 text-right">{h.quantity}</td>
                          <td className="py-2 pr-2 text-right">{h.avgCost.toFixed(2)} {h.currency}</td>
                          <td className="py-2 pr-2 text-right">
                            {h.latestPrice.toFixed(2)} {h.currency}
                            {stale && <Badge variant="warning" className="ml-1">ราคาเก่า</Badge>}
                          </td>
                          <td className="py-2 pr-2 text-right">{formatTHB(computeHoldingMarketValue(h, data.profile.baseCurrency))}</td>
                          <td className="py-2 pr-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => setTradeOpen(h.id)}>ซื้อ/ขาย/ปันผล</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">ราคาล่าสุดกรอกด้วยตนเอง ({holdings[0] ? formatDateThai(holdings[0].latestPriceDate) : "-"}) ไม่ใช่ราคาตลาดสด</p>
              </CardContent>
            </Card>
          </div>
        );
      })}

      <Dialog open={!!holdingOpen} onOpenChange={(o) => !o && setHoldingOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่มสินทรัพย์ในพอร์ต</DialogTitle></DialogHeader>
          <form onSubmit={handleAddHolding} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>สัญลักษณ์</Label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} required /></div>
              <div><Label>ชื่อ</Label><Input value={hName} onChange={(e) => setHName(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ประเภทสินทรัพย์</Label>
                <Select value={assetType} onChange={(e) => setAssetType(e.target.value as InvestmentAssetType)}>
                  {Object.entries(ASSET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <div>
                <Label>สกุลเงิน</Label>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="THB">THB</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>จำนวน</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></div>
              <div><Label>ต้นทุนเฉลี่ย</Label><Input type="number" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} required /></div>
              <div><Label>ราคาล่าสุด</Label><Input type="number" value={latestPrice} onChange={(e) => setLatestPrice(e.target.value)} required /></div>
            </div>
            {currency !== "THB" && <p className="text-xs text-muted-foreground">ใช้อัตราแลกเปลี่ยนตัวอย่าง 36 บาท/USD กรุณาปรับในหน้าตั้งค่าหากต้องการความแม่นยำ</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHoldingOpen(null)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tradeOpen} onOpenChange={(o) => !o && setTradeOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>บันทึกธุรกรรมการลงทุน</DialogTitle></DialogHeader>
          <form onSubmit={handleTrade} className="space-y-3">
            <div>
              <Label>ประเภทธุรกรรม</Label>
              <Select value={tradeType} onChange={(e) => setTradeType(e.target.value as TradeType)}>
                <option value="buy">ซื้อ</option>
                <option value="sell">ขาย</option>
                <option value="dividend">เงินปันผล</option>
              </Select>
            </div>
            {tradeType === "dividend" ? (
              <div><Label>จำนวนเงินปันผล</Label><Input type="number" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} required /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>จำนวนหน่วย</Label><Input type="number" value={tradeQty} onChange={(e) => setTradeQty(e.target.value)} required /></div>
                <div><Label>ราคาต่อหน่วย</Label><Input type="number" value={tradePrice} onChange={(e) => setTradePrice(e.target.value)} required /></div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTradeOpen(null)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
