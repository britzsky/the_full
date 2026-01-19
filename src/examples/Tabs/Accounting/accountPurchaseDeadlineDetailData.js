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

      const mapped = (list || []).map((item) => ({
        account_id: item.account_id,
        sale_id: item.sale_id,
        item_id: item.item_id,

        account_name: item.account_name || "",
        saleDate: item.saleDate || "",
        name: item.name || "",

        qty: formatNumber(item.qty),
        unitPrice: formatNumber(item.unitPrice),
        amount: formatNumber(item.amount),

        taxType: item.taxType ?? "",
        itemType: item.itemType ?? "",
        receipt_image: item.receipt_image || "",
        note: item.note || "",
      }));

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
    fetchPurchaseDetailList,
  };
}

export { parseNumber, formatNumber };
