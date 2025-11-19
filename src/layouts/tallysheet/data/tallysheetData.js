/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useTallysheetData(account_id, year, month) {
  const [dataRows, setDataRows] = useState([]);
  const [data2Rows, setData2Rows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [original2Rows, setOriginal2Rows] = useState([]);
  const [countMonth, setCountMonth] = useState("");
  const [count2Month, setCount2Month] = useState("");
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  const MIN_LOADING_TIME = 1000; // 최소 로딩 시간 1초

  // ✅ 이번 달 데이터 조회
  const fetchDataRows = useCallback(async () => {
    const startTime = Date.now();
    setLoading(true);

    // ✅ 조회 시작 시 기존 비교 기준 초기화
    setOriginalRows([]);

    try {
      const params = {};
      if (account_id) params.account_id = account_id;
      if (year) params.year = year;
      if (month) params.month = month;

      const res = await api.get("/Operate/TallySheetList", { params });
      const list = res.data || [];

      if (list.length > 0 && list[0].count_month) {
        setCountMonth(`${list[0].count_year}-${list[0].count_month}`);
      } else {
        setCountMonth("");
      }

      const initialRows = list.map((item) => {
        const row = {
          account_id: item.account_id,
          name: item.name,
          type: item.type,
          count_year: item.count_year,
          count_month: item.count_month,
        };
        for (let i = 1; i <= 31; i++) {
          row[`day_${i}`] = parseNumber(item[`day_${i}`]);
        }
        return row;
      });

      // ✅ 조회된 데이터 세팅
      setDataRows(initialRows);

      // ✅ 비교 기준(원본) 데이터 세팅
      setOriginalRows(initialRows.map((r) => ({ ...r })));
    } catch (err) {
      console.error("데이터 조회 실패 (이번 달):", err);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = MIN_LOADING_TIME - elapsed;
      if (remaining > 0) {
        setTimeout(() => setLoading(false), remaining);
      } else {
        setLoading(false);
      }
    }
  }, [account_id, year, month]);

  // ✅ 지난 달 데이터 조회
  const fetchData2Rows = useCallback(async () => {
    const startTime = Date.now();
    setLoading(true);

    // ✅ 조회 시작 시 기존 비교 기준 초기화
    setOriginal2Rows([]);

    try {
      const params = {};
      if (account_id) params.account_id = account_id;
      if (year) params.year = year;
      if (month) params.month = month - 1;

      const res = await api.get("/Operate/TallySheetList", { params });
      const list = res.data || [];

      if (list.length > 0 && list[0].count_month) {
        setCount2Month(`${list[0].count_year}-${list[0].count_month}`);
      } else {
        setCount2Month("");
      }

      const initialRows = list.map((item) => {
        const row = {
          account_id: item.account_id,
          name: item.name,
          type: item.type,
          count_year: item.count_year,
          count_month: item.count_month,
        };
        for (let i = 1; i <= 31; i++) {
          row[`day_${i}`] = parseNumber(item[`day_${i}`]);
        }
        return row;
      });

      // ✅ 조회된 데이터 세팅
      setData2Rows(initialRows);

      // ✅ 비교 기준(원본) 데이터 세팅
      setOriginal2Rows(initialRows.map((r) => ({ ...r })));
    } catch (err) {
      console.error("데이터 조회 실패 (지난 달):", err);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = MIN_LOADING_TIME - elapsed;
      if (remaining > 0) {
        setTimeout(() => setLoading(false), remaining);
      } else {
        setLoading(false);
      }
    }
  }, [account_id, year, month]);

  // ✅ 두 달 데이터 동시 조회
  useEffect(() => {
    const fetchAll = async () => {
      await Promise.all([fetchDataRows(), fetchData2Rows()]);
    };
    fetchAll();
  }, [fetchDataRows, fetchData2Rows]);

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    api
      .get("/Account/AccountList", {
        params: { account_type: "0" },
      })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(rows);
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  return {
    dataRows,
    setDataRows,
    data2Rows,
    setData2Rows,
    originalRows,
    original2Rows,
    accountList,
    countMonth,
    count2Month,
    loading,
    fetchDataRows,  // ✅ 저장 후 재조회용
    fetchData2Rows, // ✅ 저장 후 재조회용
  };
}

export { parseNumber, formatNumber };
