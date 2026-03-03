/* eslint-disable react/function-component-definition */
// src/layouts/account/accountPurchaseTallyData.js
import { useState } from "react";
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
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);

  const [partnerList, setPartnerList] = useState([]);
  const [mappingRows, setMappingRows] = useState([]);

  const [loading, setLoading] = useState(false);

  /**
   * 매입 집계 조회
   * @param {Object} filters - { type, saleDate(YYYY-MM), account_id, payType, ... }
   */
  const fetchPurchaseList = async (filters) => {
    setLoading(true);
    try {
      const res = await api.get("/Account/AccountPurchaseTallyV2List", {
        params: filters,
      });

      let list = [];

      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (res.data && res.data.code === 200) {
        list = res.data.rows || [];
        setPartnerList(res.data.partners || []);
      }

      // ✅ 여기서 type은 "구매처 select value"로 쓰일 값(요청사항)
      const mapped = (list || []).map((item) => ({
        account_id: item.account_id,
        sale_id: item.sale_id,
        type: item.type, // ✅ 구매처 매핑 키
        saleDate: item.saleDate || "",
        expen_tax: formatNumber(item.expen_tax),
        expen_vat: formatNumber(item.expen_vat),
        expen_taxFree: formatNumber(item.expen_taxFree),
        expen_total: formatNumber(item.expen_total),
        food_tax: formatNumber(item.food_tax),
        food_vat: formatNumber(item.food_vat),
        food_taxFree: formatNumber(item.food_taxFree),
        food_total: formatNumber(item.food_total),
        note: item.note,
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

  /**
   * ✅ 구매처 매핑 리스트
   * - 이 값이 구매처 select 구성값이 됨
   * - [{type, name}, ...]
   */
  const fetchMappingList = async (filters) => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/AccountMappingV2List", {
        params: filters,
      });

      // ✅ 여기 원본 코드에 list 변수가 없어서 res.data를 list로 잡아야 함
      const list = Array.isArray(res.data) ? res.data : res.data?.rows || res.data?.data || [];

      const mapped = (list || []).map((item) => ({
        type: item.type,
        name: item.name,
      }));

      setMappingRows(mapped.map((r) => ({ ...r })));
    } catch (err) {
      console.error("AccountMappingList 조회 실패:", err);
      setMappingRows([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    rows,
    setRows,
    originalRows,
    mappingRows,
    partnerList,
    loading,
    fetchPurchaseList,
    fetchMappingList,
  };
}

export { parseNumber, formatNumber };
