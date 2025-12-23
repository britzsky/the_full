/* eslint-disable react/function-component-definition */
import { useState, useMemo } from "react";
import api from "api/api";

// 숫자 파싱
const parseNumber = (value) => {
  if (!value && value !== 0) return 0;
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

  // ✅ 로딩을 boolean이 아니라 "요청 카운터"로 관리 (중간에 false 깜빡임 방지)
  const [loadingCount, setLoadingCount] = useState(0);
  const loading = useMemo(() => loadingCount > 0, [loadingCount]);

  // ✅ 각 리스트가 "한번이라도 로드 완료" 되었는지 플래그
  const [stockLoaded, setStockLoaded] = useState(false);
  const [outLoaded, setOutLoaded] = useState(false);
  const [newLoaded, setNewLoaded] = useState(false);

  const startLoading = () => setLoadingCount((c) => c + 1);
  const endLoading = () => setLoadingCount((c) => Math.max(0, c - 1));

  // CookWear 리스트 조회 (왼쪽 테이블)
  const fetchCookWearList = async () => {
    startLoading();
    try {
      const res = await api.get("/Business/CookWearList");
      const rows = (res.data || []).map((item) => ({
        type: item.type,
        type_name: item.type_name,
        current_qty: formatNumber(item.current_qty),
        new_qty: formatNumber(item.new_qty),
        out_qty: formatNumber(item.out_qty),
        remain_qty: formatNumber(item.remain_qty),
        before_qty: formatNumber(item.before_qty),
        // ✅ 여기 modified 같은 UI 플래그를 쓰면 조회 때 제거해주는 게 안전
        modified: "",
      }));
      setCookWearRows(rows);
      setStockLoaded(true);
    } catch (err) {
      console.error("CookWearList 조회 실패:", err);
      setCookWearRows([]);
      setStockLoaded(true);
    } finally {
      endLoading();
    }
  };

  // CookWearOut 리스트 조회 (가운데 테이블)
  const fetchCookWearOutList = async () => {
    startLoading();
    try {
      const res = await api.get("/Business/CookWearOutList");
      const rows = (res.data || []).map((item) => ({
        type: item.type,
        type_name: item.type_name,
        account_id: item.account_id || (accountList[0]?.account_id ?? ""),
        out_qty: formatNumber(item.out_qty),
        out_dt: item.out_dt || "",
        note: item.note || "",
      }));
      setCookWearOutRows(rows);
      setOutLoaded(true);
    } catch (err) {
      console.error("CookWearOutList 조회 실패:", err);
      setCookWearOutRows([]);
      setOutLoaded(true);
    } finally {
      endLoading();
    }
  };

  // CookWearNew 리스트 조회 (오른쪽 테이블)
  const fetchCookWearNewList = async () => {
    startLoading();
    try {
      const res = await api.get("/Business/CookWearNewList");
      const rows = (res.data || []).map((item) => ({
        type: item.type,
        type_name: item.type_name,
        account_id: item.account_id || (accountList[0]?.account_id ?? ""),
        new_qty: formatNumber(item.new_qty),
        new_dt: item.new_dt || "",
        note: item.note || "",
      }));
      setCookWearNewRows(rows);
      setNewLoaded(true);
    } catch (err) {
      console.error("CookWearNewList 조회 실패:", err);
      setCookWearNewRows([]);
      setNewLoaded(true);
    } finally {
      endLoading();
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

    // ✅ loaded flags
    stockLoaded,
    outLoaded,
    newLoaded,

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
