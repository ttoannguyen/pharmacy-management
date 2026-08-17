"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCreateStoreProduct } from "@/modules/catalog/client/catalog-query";

type Unit = { id: string; code: string; name: string };

export function QuickCreateProductForm({ units }: { units: Unit[] }) {
  const router = useRouter();
  const createProduct = useCreateStoreProduct();
  const [displayName, setDisplayName] = useState("");
  const [baseUnitId, setBaseUnitId] = useState(units[0]?.id ?? "");
  const [shelfLocation, setShelfLocation] = useState("");
  const [minimumStockBase, setMinimumStockBase] = useState("0");
  const [skuCode, setSkuCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [quantityInBaseUnit, setQuantityInBaseUnit] = useState("1");
  const [sellingPriceMinor, setSellingPriceMinor] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await createProduct.mutateAsync({
        displayName,
        baseUnitId,
        shelfLocation: shelfLocation || undefined,
        minimumStockBase: Number(minimumStockBase),
        sku: {
          code: skuCode,
          barcode: barcode || undefined,
          unitId,
          quantityInBaseUnit: Number(quantityInBaseUnit),
          sellingPriceMinor: Number(sellingPriceMinor),
        },
      });
      router.push("/dashboard/catalog");
      router.refresh();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Không thể tạo sản phẩm.");
    }
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <section className="form-section">
        <div className="form-section-heading"><span>1</span><div><h2>Thông tin sản phẩm</h2><p>Tên và vị trí dùng riêng tại nhà thuốc.</p></div></div>
        <div className="form-grid">
          <label className="field field-wide"><span>Tên hiển thị <i>*</i></span><input autoFocus maxLength={240} placeholder="Ví dụ: Paracetamol 500 mg" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="field"><span>Đơn vị tồn kho cơ sở <i>*</i></span><select value={baseUnitId} onChange={(event) => setBaseUnitId(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><small>Đơn vị nhỏ nhất dùng để ghi nhận tồn.</small></label>
          <label className="field"><span>Vị trí kệ</span><input maxLength={120} placeholder="Ví dụ: A-03" value={shelfLocation} onChange={(event) => setShelfLocation(event.target.value)} /></label>
          <label className="field"><span>Tồn tối thiểu</span><input inputMode="decimal" min="0" step="any" type="number" value={minimumStockBase} onChange={(event) => setMinimumStockBase(event.target.value)} /><small>Dùng cho cảnh báo tồn thấp sau khi có inventory ledger.</small></label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading"><span>2</span><div><h2>Quy cách bán đầu tiên</h2><p>SKU, đơn vị quy đổi và giá bán hiện tại.</p></div></div>
        <div className="form-grid">
          <label className="field"><span>Mã SKU <i>*</i></span><input autoCapitalize="characters" maxLength={80} placeholder="VD: PARA500-HOP" required value={skuCode} onChange={(event) => setSkuCode(event.target.value)} /></label>
          <label className="field"><span>Mã nhận diện</span><input maxLength={80} placeholder="Không bắt buộc" value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label>
          <label className="field"><span>Đơn vị bán <i>*</i></span><select value={unitId} onChange={(event) => setUnitId(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
          <label className="field"><span>Số đơn vị cơ sở / đơn vị bán <i>*</i></span><input inputMode="decimal" min="0.000001" step="any" required type="number" value={quantityInBaseUnit} onChange={(event) => setQuantityInBaseUnit(event.target.value)} /></label>
          <label className="field"><span>Giá bán (₫) <i>*</i></span><div className="money-input"><input inputMode="numeric" min="0" placeholder="50.000" required step="1" type="number" value={sellingPriceMinor} onChange={(event) => setSellingPriceMinor(event.target.value)} /><span>VND</span></div><small>Giá được lưu chính xác theo đồng Việt Nam, không dùng số thực.</small></label>
        </div>
      </section>

      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
      <div className="form-actions"><Link className="button" href="/dashboard/catalog">Hủy</Link><button className="button button-primary" disabled={createProduct.isPending || units.length === 0} type="submit">{createProduct.isPending ? "Đang lưu…" : "Lưu sản phẩm"}</button></div>
    </form>
  );
}
