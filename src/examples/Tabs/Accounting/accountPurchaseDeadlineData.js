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

export default function useAccountPurchaseDeadlineData() {
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
      // "0" = 전체 선택 값 → 빈값("")으로 변환해서 SQL <if> 조건에서 제외되게 함
      const toParam = (v) => (!v || v === "0" ? "" : v);
      const params = {
        account_id: toParam(filters?.account_id),
        type:       toParam(filters?.type),
        year:       toParam(filters?.year),
        month:      toParam(filters?.month),
        payType:    toParam(filters?.payType),
      };
      const res = await api.get("/Account/AccountPurchaseTallyList", {
        params,
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

      const mapped = (list || []).map((item) => {
        // payType 보정: 1/2 아닌 경우 기본 1
        const pt = String(item.payType ?? "").trim();
        return {
          sale_id: item.sale_id,
          account_id: item.account_id,
          account_name: item.account_name || "",
          use_name: item.use_name || "",
          bizNo: item.bizNo || "",
          ceo_name: item.ceo_name || "",
          saleDate: item.saleDate || "",
          total:     formatNumber(item.total),
          vat:       formatNumber(item.vat),
          taxFree:   formatNumber(item.taxFree),
          tax:       formatNumber(item.tax),
          totalCash: formatNumber(item.totalCash),
          totalCard: formatNumber(item.totalCard),
          payType: pt === "1" || pt === "2" ? pt : "1",
          receipt_type: item.receipt_type || "",
          receipt_image: item.receipt_image || "",
          note: item.note || "",
          reg_dt: item.reg_dt || "",
          type: String(item.type ?? ""),
          type_name: item.type_name || "",
        };
      });

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
    setOriginalRows,
    partnerList,
    loading,
    fetchPurchaseList,
  };
}

export { parseNumber, formatNumber };
