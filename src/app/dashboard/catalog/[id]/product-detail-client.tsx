"use client";

import Link from "next/link";
import { useState } from "react";

import {
  useAddStoreSku,
  useArchiveStoreProduct,
  useArchiveStoreSku,
  useStoreProductDetail,
  useUpdateStoreProduct,
  useUpdateStoreSku,
  type StoreProductDetail,
} from "@/modules/catalog/client/catalog-query";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const quantity = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 });

type StoreSkuDetail = StoreProductDetail["skus"][number];

function StoreSkuLifecycleRow({
  productId,
  sku,
  baseUnitName,
  canManage,
}: {
  productId: string;
  sku: StoreSkuDetail;
  baseUnitName: string;
  canManage: boolean;
}) {
  const updateSku = useUpdateStoreSku(productId, sku.id);
  const archiveSku = useArchiveStoreSku(productId, sku.id);
  const [mode, setMode] = useState<"edit" | "archive" | null>(null);
  const [conversion, setConversion] = useState(sku.quantityInBaseUnit);
  const [price, setPrice] = useState(sku.sellingPriceMinor);
  const [updateReason, setUpdateReason] = useState("");
  const [archiveReason, setArchiveReason] = useState("");

  function openEdit() {
    setConversion(sku.quantityInBaseUnit);
    setPrice(sku.sellingPriceMinor);
    setUpdateReason("");
    updateSku.reset();
    setMode("edit");
  }

  function openArchive() {
    setArchiveReason("");
    archiveSku.reset();
    setMode("archive");
  }

  async function submitUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updateSku.mutateAsync({
        quantityInBaseUnit: conversion,
        sellingPriceMinor: Number(price),
        expectedUpdatedAt: sku.updatedAt,
        reason: updateReason,
      });
      setMode(null);
    } catch {
      // Mutation error is rendered next to the form.
    }
  }

  async function submitArchive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await archiveSku.mutateAsync(archiveReason);
      setMode(null);
    } catch {
      // Mutation error is rendered next to the form.
    }
  }

  return (
    <article className="sku-detail-item">
      <div className="sku-detail-row">
        <div>
          <strong>{sku.code}</strong>
          <small>
            {sku.unit.name} · {quantity.format(Number(sku.quantityInBaseUnit))} {baseUnitName.toLowerCase()} · conversion v{sku.currentConversionVersion}
          </small>
        </div>
        <span>{sku.barcodes[0] ?? "Chưa có barcode"}</span>
        <strong>{money.format(Number(sku.sellingPriceMinor))}</strong>
        {canManage ? (
          <div className="sku-row-actions">
            <button className="text-link" type="button" onClick={openEdit}>
              Sửa SKU {sku.code}
            </button>
            <button className="text-link text-danger" type="button" onClick={openArchive}>
              Ngừng bán {sku.code}
            </button>
          </div>
        ) : null}
      </div>

      {mode === "edit" ? (
        <form className="sku-inline-form" onSubmit={submitUpdate}>
          <div className="form-grid">
            <label className="field">
              <span>Quy đổi mới của {sku.code} <i>*</i></span>
              <input
                inputMode="decimal"
                min="0.000001"
                required
                step="0.000001"
                type="number"
                value={conversion}
                onChange={(event) => setConversion(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Giá bán mới của {sku.code} <i>*</i></span>
              <input
                inputMode="numeric"
                min="0"
                required
                step="1"
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
            <label className="field field-wide">
              <span>Lý do sửa {sku.code} <i>*</i></span>
              <input
                maxLength={240}
                required
                value={updateReason}
                onChange={(event) => setUpdateReason(event.target.value)}
              />
            </label>
          </div>
          {updateSku.isError ? <div className="notice notice-error">{updateSku.error.message}</div> : null}
          <div className="form-actions">
            <button className="button" type="button" onClick={() => setMode(null)}>Hủy</button>
            <button className="button button-primary" disabled={updateSku.isPending} type="submit">
              {updateSku.isPending ? "Đang lưu…" : `Lưu thay đổi ${sku.code}`}
            </button>
          </div>
        </form>
      ) : null}

      {mode === "archive" ? (
        <form className="sku-inline-form" onSubmit={submitArchive}>
          <div className="notice notice-warning">
            SKU được archive, không hard-delete. Sản phẩm phải còn ít nhất một SKU hoạt động.
          </div>
          <label className="field">
            <span>Lý do ngừng bán {sku.code} <i>*</i></span>
            <input
              maxLength={240}
              required
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
            />
          </label>
          {archiveSku.isError ? <div className="notice notice-error">{archiveSku.error.message}</div> : null}
          <div className="form-actions">
            <button className="button" type="button" onClick={() => setMode(null)}>Hủy</button>
            <button className="button text-danger" disabled={archiveSku.isPending} type="submit">
              {archiveSku.isPending ? "Đang archive…" : `Xác nhận ngừng bán ${sku.code}`}
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

export function ProductDetailClient({
  productId,
  initialData,
  units,
}: {
  productId: string;
  initialData: StoreProductDetail;
  units: Array<{ id: string; code: string; name: string }>;
}) {
  const product = useStoreProductDetail(productId, initialData);
  const addSku = useAddStoreSku(productId);
  const updateProduct = useUpdateStoreProduct(productId);
  const archiveProduct = useArchiveStoreProduct(productId);
  const [open, setOpen] = useState(false);
  const [productMode, setProductMode] = useState<"edit" | "archive" | null>(null);
  const [productName, setProductName] = useState(initialData.displayName);
  const [shelfLocation, setShelfLocation] = useState(initialData.shelfLocation ?? "");
  const [minimumStockBase, setMinimumStockBase] = useState(initialData.minimumStockBase);
  const [productUpdateReason, setProductUpdateReason] = useState("");
  const [productArchiveReason, setProductArchiveReason] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unitId, setUnitId] = useState(initialData.baseUnit.id);
  const [conversion, setConversion] = useState("1");
  const [price, setPrice] = useState("");

  if (!product.data) return <div className="panel"><p>Đang tải chi tiết sản phẩm…</p></div>;
  const data = product.data;

  function openProductEdit() {
    setProductName(data.displayName);
    setShelfLocation(data.shelfLocation ?? "");
    setMinimumStockBase(data.minimumStockBase);
    setProductUpdateReason("");
    updateProduct.reset();
    setProductMode("edit");
  }

  function openProductArchive() {
    setProductArchiveReason("");
    archiveProduct.reset();
    setProductMode("archive");
  }

  async function submitProductUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updateProduct.mutateAsync({
        displayName: productName,
        shelfLocation: shelfLocation.trim() || null,
        minimumStockBase,
        expectedUpdatedAt: data.updatedAt,
        reason: productUpdateReason,
      });
      setProductMode(null);
    } catch {
      // Mutation error is rendered next to the form.
    }
  }

  async function submitProductArchive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await archiveProduct.mutateAsync({
        expectedUpdatedAt: data.updatedAt,
        reason: productArchiveReason,
      });
      setOpen(false);
      setProductMode(null);
    } catch {
      // Mutation error is rendered next to the form.
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await addSku.mutateAsync({
        code,
        barcode: barcode || undefined,
        unitId,
        quantityInBaseUnit: Number(conversion),
        sellingPriceMinor: Number(price),
      });
      setCode("");
      setBarcode("");
      setConversion("1");
      setPrice("");
      setOpen(false);
    } catch {
      // Mutation error is rendered below.
    }
  }

  return (
    <>
      <div className="product-detail-heading">
        <div>
          <p className="eyebrow">Chi tiết sản phẩm</p>
          <h1>{data.displayName}</h1>
          <p>Thông tin local và các quy cách bán của nhà thuốc.</p>
        </div>
        {data.isActive ? (
          <div className="product-detail-actions">
            <button className="button" type="button" onClick={openProductEdit}>Sửa thông tin</button>
            <button className="button text-danger" type="button" onClick={openProductArchive}>Ngừng kinh doanh</button>
            <button className="button button-primary" type="button" onClick={() => setOpen((value) => !value)}>
              ＋ Thêm SKU
            </button>
          </div>
        ) : <span className="status-chip status-inactive">Đã archive</span>}
      </div>

      {!data.isActive ? (
        <div className="notice notice-warning">
          Sản phẩm đã được archive. Các SKU và lịch sử được giữ lại nhưng không còn xuất hiện trong lookup mặc định.
        </div>
      ) : null}

      {productMode === "edit" ? (
        <form className="panel sku-form" onSubmit={submitProductUpdate}>
          <div className="panel-heading">
            <div><p className="eyebrow">Thông tin local</p><h2>Sửa sản phẩm</h2></div>
            <button className="icon-button" type="button" onClick={() => setProductMode(null)}>×</button>
          </div>
          <div className="form-grid">
            <label className="field"><span>Tên hiển thị <i>*</i></span><input autoFocus maxLength={240} required value={productName} onChange={(event) => setProductName(event.target.value)} /></label>
            <label className="field"><span>Vị trí kệ</span><input maxLength={120} value={shelfLocation} onChange={(event) => setShelfLocation(event.target.value)} /></label>
            <label className="field"><span>Tồn tối thiểu <i>*</i></span><input inputMode="decimal" min="0" required step="0.000001" type="number" value={minimumStockBase} onChange={(event) => setMinimumStockBase(event.target.value)} /></label>
            <label className="field field-wide"><span>Lý do sửa <i>*</i></span><input maxLength={240} required value={productUpdateReason} onChange={(event) => setProductUpdateReason(event.target.value)} /></label>
          </div>
          {updateProduct.isError ? <div className="notice notice-error">{updateProduct.error.message}</div> : null}
          <div className="form-actions">
            <button className="button" type="button" onClick={() => setProductMode(null)}>Hủy</button>
            <button className="button button-primary" disabled={updateProduct.isPending} type="submit">{updateProduct.isPending ? "Đang lưu…" : "Lưu thông tin"}</button>
          </div>
        </form>
      ) : null}

      {productMode === "archive" ? (
        <form className="panel sku-form" onSubmit={submitProductArchive}>
          <div className="notice notice-warning">
            Sản phẩm sẽ biến mất khỏi lookup mặc định. Dữ liệu và SKU được giữ lại, không hard-delete.
          </div>
          <label className="field"><span>Lý do ngừng kinh doanh <i>*</i></span><input autoFocus maxLength={240} required value={productArchiveReason} onChange={(event) => setProductArchiveReason(event.target.value)} /></label>
          {archiveProduct.isError ? <div className="notice notice-error">{archiveProduct.error.message}</div> : null}
          <div className="form-actions">
            <button className="button" type="button" onClick={() => setProductMode(null)}>Hủy</button>
            <button className="button text-danger" disabled={archiveProduct.isPending} type="submit">{archiveProduct.isPending ? "Đang archive…" : "Xác nhận ngừng kinh doanh"}</button>
          </div>
        </form>
      ) : null}

      <section className="detail-summary-grid">
        <article className="panel detail-summary">
          <p className="eyebrow">Thông tin local</p>
          <dl>
            <div><dt>Đơn vị tồn cơ sở</dt><dd>{data.baseUnit.name}</dd></div>
            <div><dt>Vị trí kệ</dt><dd>{data.shelfLocation ?? "Chưa cấu hình"}</dd></div>
            <div><dt>Tồn tối thiểu</dt><dd>{quantity.format(Number(data.minimumStockBase))} {data.baseUnit.name.toLowerCase()}</dd></div>
          </dl>
        </article>
        <article className="panel detail-summary">
          <p className="eyebrow">Global reference</p>
          {data.registeredProduct ? (
            <dl>
              <div><dt>Sản phẩm đăng ký</dt><dd>{data.registeredProduct.brandName}</dd></div>
              <div><dt>Nhà sản xuất</dt><dd>{data.registeredProduct.manufacturer.displayName}</dd></div>
              <div><dt>Version tham chiếu</dt><dd>v{data.basedOnGlobalVersion ?? data.registeredProduct.currentVersion} · {data.registeredProduct.verificationStatus}</dd></div>
            </dl>
          ) : <p className="muted-copy">Chưa liên kết dữ liệu global. Sản phẩm vẫn hoạt động độc lập trong nhà thuốc.</p>}
        </article>
      </section>

      {data.overrides ? (
        <section className="panel override-note">
          <strong>Local override</strong>
          <span>Dữ liệu hiển thị này thuộc riêng nhà thuốc và không sửa global catalog.</span>
        </section>
      ) : null}

      <section className="panel sku-detail-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">StoreSku</p><h2>Quy cách bán</h2></div>
          <span className="result-count">{data.skus.length} SKU</span>
        </div>
        {data.skus.length ? (
          <div className="sku-detail-list">
            {data.skus.map((sku) => (
              <StoreSkuLifecycleRow
                baseUnitName={data.baseUnit.name}
                canManage={data.isActive}
                key={sku.id}
                productId={productId}
                sku={sku}
              />
            ))}
          </div>
        ) : <div className="empty-inline"><p>Chưa có SKU bán nào.</p></div>}
      </section>

      {open && data.isActive ? (
        <form className="panel sku-form" onSubmit={submit}>
          <div className="panel-heading">
            <div><p className="eyebrow">Thêm quy cách</p><h2>SKU mới</h2></div>
            <button className="icon-button" type="button" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="form-grid">
            <label className="field"><span>Mã SKU <i>*</i></span><input autoFocus required value={code} onChange={(event) => setCode(event.target.value)} /></label>
            <label className="field"><span>Barcode</span><input value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label>
            <label className="field"><span>Đơn vị bán <i>*</i></span><select required value={unitId} onChange={(event) => setUnitId(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
            <label className="field"><span>Quy đổi về cơ sở <i>*</i></span><input min="0.000001" required step="any" type="number" value={conversion} onChange={(event) => setConversion(event.target.value)} /></label>
            <label className="field"><span>Giá bán (₫) <i>*</i></span><input min="0" required step="1" type="number" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
          </div>
          {addSku.isError ? <div className="notice notice-error">{addSku.error.message}<button className="text-link" type="button" onClick={() => addSku.reset()}>Đóng</button></div> : null}
          {addSku.isSuccess ? <div className="notice notice-success">Đã thêm SKU thành công.</div> : null}
          <div className="form-actions">
            <button className="button" type="button" onClick={() => setOpen(false)}>Hủy</button>
            <button className="button button-primary" disabled={addSku.isPending} type="submit">{addSku.isPending ? "Đang lưu…" : "Lưu SKU"}</button>
          </div>
        </form>
      ) : null}

      <Link className="text-link back-link" href="/dashboard/catalog">← Quay lại danh mục</Link>
    </>
  );
}
