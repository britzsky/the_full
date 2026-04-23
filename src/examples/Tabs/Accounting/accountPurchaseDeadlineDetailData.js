/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

// 숫자 파싱
const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

// 숫자 포맷
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

// 상세 행 수치값을 과세구분 기준으로 정규화한다.
// - qty/unitPrice가 있으면 amount를 즉시 재계산
// - taxType=1(과세): vat=floor(amount/11), tax=amount-vat
// - taxType=2(면세): vat=0, tax=0
const normalizeDetailAmounts = (item) => {
  const qtyNum = parseNumber(item?.qty);
  const unitPriceNum = parseNumber(item?.unitPrice);
  const amountFromRow = parseNumber(item?.amount);
  const taxType = String(item?.taxType ?? "").trim();

  const computedAmount =
    qtyNum > 0 && unitPriceNum > 0 ? qtyNum * unitPriceNum : amountFromRow;

  if (taxType === "1") {
    const vat = Math.floor(computedAmount / 11);
    const tax = computedAmount - vat;
    return { amount: computedAmount, tax, vat };
  }

  if (taxType === "2") {
    return { amount: computedAmount, tax: 0, vat: 0 };
  }

  return {
    amount: computedAmount,
    tax: parseNumber(item?.tax),
    vat: parseNumber(item?.vat),
  };
};

export default function useAccountPurchaseDeadlineDetailData() {
  const [detailRows, setDetailRows] = useState([]);
  const [originalDetailRows, setOriginalDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * ✅ 매입 상세 조회
   * @param {Object} filters - { sale_id, account_id, ... }
   */
  const fetchPurchaseDetailList = async (filters) => {
    if (!filters?.sale_id) {
      setDetailRows([]);
      setOriginalDetailRows([]);
      return [];
    }

    setDetailLoading(true);
    try {
      const res = await api.get("/Account/AccountPurchaseDetailList_tmp", {
        params: filters,
      });

      let list = [];
      if (Array.isArray(res.data)) list = res.data;
      else if (res.data && res.data.code === 200) list = res.data.rows || [];

      const mapped = (list || []).map((item) => {
        const normalized = normalizeDetailAmounts(item);
        return {
          account_id: item.account_id,
          sale_id: item.sale_id,
          item_id: item.item_id,

          account_name: item.account_name || "",
          saleDate: item.saleDate || "",
          name: item.name || "",

          qty: formatNumber(item.qty),
          unitPrice: formatNumber(item.unitPrice),
          vat: formatNumber(normalized.vat),
          tax: formatNumber(normalized.tax),
          amount: formatNumber(normalized.amount),

          taxType: item.taxType ?? "",
          itemType: item.itemType ?? "",
          receipt_image: item.receipt_image || "",
          note: item.note || "",
        };
      });

      setDetailRows(mapped);
      setOriginalDetailRows(mapped.map((r) => ({ ...r })));
      return mapped;
    } catch (err) {
      console.error("매입 상세 조회 실패:", err);
      setDetailRows([]);
      setOriginalDetailRows([]);
      return [];
    } finally {
      setDetailLoading(false);
    }
  };

  return {
    detailRows,
    setDetailRows,
    originalDetailRows,
    setOriginalDetailRows,
    detailLoading,
    setDetailLoading,
    fetchPurchaseDetailList,
  };
}

export { parseNumber, formatNumber };
