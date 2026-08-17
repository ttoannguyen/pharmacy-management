"use client";

import Link from "next/link";
import { useState } from "react";
import { useAddStoreSku, useStoreProductDetail, type StoreProductDetail } from "@/modules/catalog/client/catalog-query";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 });

export function ProductDetailClient({ productId, initialData, units }: { productId: string; initialData: StoreProductDetail; units: Array<{ id: string; code: string; name: string }> }) {
  const product = useStoreProductDetail(productId, initialData);
  const addSku = useAddStoreSku(productId);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unitId, setUnitId] = useState(initialData.baseUnit.id);
  const [conversion, setConversion] = useState("1");
  const [price, setPrice] = useState("");

  if (!product.data) return <div className="panel"><p>Đang tải chi tiết sản phẩm…</p></div>;
  const data = product.data;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await addSku.mutateAsync({ code, barcode: barcode || undefined, unitId, quantityInBaseUnit: Number(conversion), sellingPriceMinor: Number(price) });
      setCode(""); setBarcode(""); setConversion("1"); setPrice(""); setOpen(false);
    } catch { /* mutation error is rendered below */ }
  }

  return (
    <>
      <div className="product-detail-heading"><div><p className="eyebrow">Chi tiết sản phẩm</p><h1>{data.displayName}</h1><p>Thông tin local và các quy cách bán của nhà thuốc.</p></div><button className="button button-primary" onClick={() => setOpen((value) => !value)}>＋ Thêm SKU</button></div>
      <section className="detail-summary-grid"><article className="panel detail-summary"><p className="eyebrow">Thông tin local</p><dl><div><dt>Đơn vị tồn cơ sở</dt><dd>{data.baseUnit.name}</dd></div><div><dt>Vị trí kệ</dt><dd>{data.shelfLocation ?? "Chưa cấu hình"}</dd></div><div><dt>Tồn tối thiểu</dt><dd>{quantity.format(Number(data.minimumStockBase))} {data.baseUnit.name.toLowerCase()}</dd></div></dl></article><article className="panel detail-summary"><p className="eyebrow">Global reference</p>{data.registeredProduct ? <dl><div><dt>Sản phẩm đăng ký</dt><dd>{data.registeredProduct.brandName}</dd></div><div><dt>Nhà sản xuất</dt><dd>{data.registeredProduct.manufacturer.displayName}</dd></div><div><dt>Version tham chiếu</dt><dd>v{data.basedOnGlobalVersion ?? data.registeredProduct.currentVersion} · {data.registeredProduct.verificationStatus}</dd></div></dl> : <p className="muted-copy">Chưa liên kết dữ liệu global. Sản phẩm vẫn hoạt động độc lập trong nhà thuốc.</p>}</article></section>
      {data.overrides ? <section className="panel override-note"><strong>Local override</strong><span>Dữ liệu hiển thị này thuộc riêng nhà thuốc và không sửa global catalog.</span></section> : null}
      <section className="panel sku-detail-panel"><div className="panel-heading"><div><p className="eyebrow">StoreSku</p><h2>Quy cách bán</h2></div><span className="result-count">{data.skus.length} SKU</span></div>{data.skus.length ? <div className="sku-detail-list">{data.skus.map((sku) => <div className="sku-detail-row" key={sku.id}><div><strong>{sku.code}</strong><small>{sku.unit.name} · {quantity.format(Number(sku.quantityInBaseUnit))} {data.baseUnit.name.toLowerCase()}</small></div><span>{sku.barcodes[0] ?? "Chưa có barcode"}</span><strong>{money.format(Number(sku.sellingPriceMinor))}</strong></div>)}</div> : <div className="empty-inline"><p>Chưa có SKU bán nào.</p></div>}</section>
      {open ? <form className="panel sku-form" onSubmit={submit}><div className="panel-heading"><div><p className="eyebrow">Thêm quy cách</p><h2>SKU mới</h2></div><button className="icon-button" type="button" onClick={() => setOpen(false)}>×</button></div><div className="form-grid"><label className="field"><span>Mã SKU <i>*</i></span><input autoFocus required value={code} onChange={(event) => setCode(event.target.value)} /></label><label className="field"><span>Barcode</span><input value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label><label className="field"><span>Đơn vị bán <i>*</i></span><select required value={unitId} onChange={(event) => setUnitId(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="field"><span>Quy đổi về cơ sở <i>*</i></span><input min="0.000001" required step="any" type="number" value={conversion} onChange={(event) => setConversion(event.target.value)} /></label><label className="field"><span>Giá bán (₫) <i>*</i></span><input min="0" required step="1" type="number" value={price} onChange={(event) => setPrice(event.target.value)} /></label></div>{addSku.isError ? <div className="notice notice-error">{addSku.error.message}<button className="text-link" type="button" onClick={() => addSku.reset()}>Đóng</button></div> : null}{addSku.isSuccess ? <div className="notice notice-success">Đã thêm SKU thành công.</div> : null}<div className="form-actions"><button className="button" type="button" onClick={() => setOpen(false)}>Hủy</button><button className="button button-primary" disabled={addSku.isPending} type="submit">{addSku.isPending ? "Đang lưu…" : "Lưu SKU"}</button></div></form> : null}
      <Link className="text-link back-link" href="/dashboard/catalog">← Quay lại danh mục</Link>
    </>
  );
}
