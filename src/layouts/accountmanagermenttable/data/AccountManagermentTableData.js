/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

// ✅ 숫자 변환 유틸
const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// ✅ 숫자 포맷 유틸
const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString();
};

// ✅ Hook 본체
export default function useAccountManagermentTableData(account_id, year, month) {
  const [dataRows, setDataRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  const MIN_LOADING_TIME = 800; // 최소 로딩 시간 0.8초 (UX 개선)

  // ✅ 이번 달 데이터 조회
  const fetchDataRows = useCallback(async () => {
    const startTime = Date.now();
    setLoading(true);
    setOriginalRows([]); // 조회 시점에 원본 초기화

    try {
      const params = {};
      if (account_id) params.account_id = account_id;
      if (year) params.year = year;
      if (month) params.month = month;

      const res = await api.get("/HeadOffice/AccountManagermentTableList", { params });

      // 응답 형태에 따른 방어 코드
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      // 변환된 행 구성
      const initialRows = list.map((item) => {
        const row = {
          account_id: item.account_id ?? "",
          name: item.name ?? "",
          type: item.type ?? "",
          count_year: item.count_year ?? year,
          count_month: item.count_month ?? month,
        };
        for (let i = 1; i <= 31; i++) {
          row[`day_${i}`] = parseNumber(item[`day_${i}`]);
        }
        return row;
      });

      // ✅ 조회된 데이터 세팅
      setDataRows(initialRows);

      // ✅ 비교 기준(원본) 세팅
      setOriginalRows(initialRows.map((r) => ({ ...r })));
    } catch (err) {
      console.error("데이터 조회 실패 (이번 달):", err);
    } finally {
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, MIN_LOADING_TIME - elapsed);
      setTimeout(() => setLoading(false), delay);
    }
  }, [account_id, year, month]);

  // ✅ 조회 자동 트리거
  useEffect(() => {
    if (account_id && year && month) {
      fetchDataRows();
    }
  }, [account_id, year, month, fetchDataRows]);

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    const fetchAccountList = async () => {
      try {
        const res = await api.get("/Account/AccountList", {
          params: { account_type: "0" },
        });

        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];

        const rows = list.map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));

        setAccountList(rows);
      } catch (err) {
        console.error("데이터 조회 실패 (AccountList):", err);
      }
    };

    fetchAccountList();
  }, []);

  // ✅ export
  return {
    dataRows,
    setDataRows,
    originalRows,
    accountList,
    loading,
    fetchDataRows, // 저장 후 재조회용
  };
}

// ✅ 유틸 export
export { parseNumber, formatNumber };
