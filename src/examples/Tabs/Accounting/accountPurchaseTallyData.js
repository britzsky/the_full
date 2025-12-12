/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import api from "api/api";

// 숫자 파싱
const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// 숫자 포맷
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useAccountPurchaseTallyData() {
  // 🔹 매입 집계 테이블 데이터
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);

  // 🔹 조회 조건에서 쓸 거래처 리스트 (필요시 사용)
  const [partnerList, setPartnerList] = useState([]);

  const [loading, setLoading] = useState(false);

  /**
   * 매입 집계 조회
   * @param {Object} filters - { bizType, type, fromDate, toDate, account_id, payType, ... }
   */
  const fetchPurchaseList = async (filters) => {
    setLoading(true);
    try {
      // ✅ GET 파라미터는 반드시 params 로 감싸기
      const res = await api.get("/Account/AccountPurchaseDetailList", {
        params: filters,
      });

      let list = [];

      // ✅ 1) 백엔드가 배열로 바로 주는 경우 (지금 너가 보여준 형태)
      if (Array.isArray(res.data)) {
        list = res.data;
      }
      // ✅ 2) 혹시 나중에 { code: 200, rows: [...] } 구조로 바꾸더라도 대응
      else if (res.data && res.data.code === 200) {
        list = res.data.rows || [];
        setPartnerList(res.data.partners || []);
      }

      // 숫자 포맷 등 프론트에서 가공하고 싶다면 여기서 처리
      const mapped = (list || []).map((item) => ({
        account_id: item.account_id,
        sale_id: item.sale_id,
        account_name: item.account_name || "",
        saleDate: item.saleDate || "",
        name: item.name || "",
        qty: formatNumber(item.qty),
        unitPrice: formatNumber(item.unitPrice),
        amount: formatNumber(item.amount),
        taxType: item.taxType,
        itemType: item.itemType,
        receipt_image: item.receipt_image,
        note: item.note
      }));

      setRows(mapped);
      setOriginalRows(mapped.map((r) => ({ ...r })));
    } catch (err) {
      console.error("매입 집계 조회 실패:", err);
      setRows([]);
      setOriginalRows([]);
      setPartnerList([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    rows,
    setRows,
    originalRows,
    partnerList,
    loading,
    fetchPurchaseList,
  };
}

export { parseNumber, formatNumber };
