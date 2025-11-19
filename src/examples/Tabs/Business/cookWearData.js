/* eslint-disable react/function-component-definition */
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

export default function useCookWearManagerData() {
  const [cookWearRows, setCookWearRows] = useState([]);
  const [cookWearOutRows, setCookWearOutRows] = useState([]);
  const [cookWearNewRows, setCookWearNewRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // CookWear 리스트 조회 (왼쪽 테이블)
  const fetchCookWearList = async () => {
    setLoading(true);
    try {
      
      const res = await api.get("/Business/CookWearList");
      const rows = (res.data || []).map((item) => ({
        type: item.type,
        current_qty: formatNumber(item.current_qty),
        new_qty: formatNumber(item.new_qty),
        out_qty: formatNumber(item.out_qty),
        remain_qty: formatNumber(item.remain_qty),
        before_qty: formatNumber(item.before_qty),
      }));
      setCookWearRows(rows);
    } catch (err) {
      console.error("CookWearList 조회 실패:", err);
      setCookWearRows([]);
    } finally {
      setLoading(false);
    }
  };

  // CookWearOut 리스트 조회 (가운데 테이블)
  const fetchCookWearOutList = async () => {
    setLoading(true);
    try {
      const res = await api.get("/Business/CookWearOutList");
      const rows = (res.data || []).map((item) => ({
        type: item.type,
        account_id: item.account_id || (accountList[0]?.account_id ?? ""), // 기본값 세팅
        out_qty: formatNumber(item.out_qty),
        out_dt: item.out_dt || "",
        note: item.note || "",
      }));
      setCookWearOutRows(rows);
    } catch (err) {
      console.error("CookWearOutList 조회 실패:", err);
      setCookWearOutRows([]);
    } finally {
      setLoading(false);
    }
  };

  // CookWearNew 리스트 조회 (오른쪽 테이블)
  const fetchCookWearNewList = async () => {
    setLoading(true);
    try {
      const res = await api.get("/Business/CookWearNewList");
      const rows = (res.data || []).map((item) => ({
        type: item.type,
        account_id: item.account_id || (accountList[0]?.account_id ?? ""), // 기본값 세팅
        new_qty: formatNumber(item.new_qty),
        new_dt: item.new_dt || "",
        note: item.note || "",
      }));
      setCookWearNewRows(rows);
    } catch (err) {
      console.error("CookWearNewList 조회 실패:", err);
      setCookWearNewRows([]);
    } finally {
      setLoading(false);
    }
  };

  // AccountList 조회 (SelectBox용)
  const fetchAccountList = async () => {
    try {
      const res = await api.get("/Account/AccountList", {
        params: { account_type: 0 },
      });
      setAccountList(res.data || []);
    } catch (err) {
      console.error("AccountList 조회 실패:", err);
      setAccountList([]);
    }
  };

  return {
    cookWearRows,
    cookWearOutRows,
    cookWearNewRows,
    accountList,
    loading,
    fetchCookWearList,
    fetchCookWearOutList,
    fetchCookWearNewList,
    fetchAccountList,
    setCookWearRows,
    setCookWearOutRows,
    setCookWearNewRows,
  };
}

export { parseNumber, formatNumber };