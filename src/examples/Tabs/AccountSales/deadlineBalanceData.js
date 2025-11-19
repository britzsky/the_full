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

export default function useDeadlineBalanceData(year, month) {
  const [balanceRows, setBalanceRows] = useState([]);
  const [depositRows, setDepositRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 왼쪽 테이블 조회
  const fetchDeadlineBalanceList = async () => {
    setLoading(true);
    try {
      const res = await api.get("/Account/AccountDeadlineBalanceList", {
        params: { year, month },
      });

      const rows = (res.data || []).map((item) => ({
        account_id: item.account_id,
        account_name: item.account_name,
        year: item.year,
        month: item.month,
        balance_file: item.balance_file,
        living_cost: formatNumber(item.living_cost),
        basic_cost: formatNumber(item.basic_cost),
        employ_cost: formatNumber(item.employ_cost),
        input_exp: item.input_exp,
        balance_price: formatNumber(item.balance_price),
        before_price: formatNumber(item.before_price),
        before_price2: parseNumber(item.before_price2),
      }));

      setBalanceRows(rows);
    } catch (err) {
      console.error("DeadlineBalanceList 조회 실패:", err);
      setBalanceRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 가운데 테이블 조회
  const fetchDepositHistoryList = async (account_id) => {
    setLoading(true);
    try {
      const res = await api.get("/Account/AccountDepositHistoryList", {
        params: { account_id, year },
      });

      const rows = (res.data || []).map((item) => ({
        account_id: item.account_id,
        type: item.type,
        input_dt: item.input_dt,
        balance_dt: item.balance_dt,
        difference_price: parseNumber(item.difference_price),
        input_price: parseNumber(item.input_price),
        deposit_amount: parseNumber(item.deposit_amount),
        note: item.note || "",
      }));
      setDepositRows(rows);
    } catch (err) {
      console.error("DepositHistoryList 조회 실패:", err);
      setDepositRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 계정 목록 조회
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

  // ✅ 차액 조회 함수 (selectbox 변경 시 호출)
  const fetchAccountDeadlineDifferencePriceSearch = async (account_id, year, month, type) => {
    try {
      const res = await api.get("/Account/AccountDeadlineDifferencePriceSearch", {
        params: { account_id, year, month, type },
      });

      // 예: [{difference_price: 120000}] 형태 가정
      if (res.data && res.data.length > 0) {
        return parseNumber(res.data[0].difference_price);
      }
      return null;
    } catch (err) {
      console.error("DeadlineDifferencePriceSearch 실패:", err);
      return null;
    }
  };

  return {
    balanceRows,
    depositRows,
    accountList,
    loading,
    fetchDeadlineBalanceList,
    fetchDepositHistoryList,
    fetchAccountList,
    fetchAccountDeadlineDifferencePriceSearch, // ✅ export 추가
    setBalanceRows,
    setDepositRows,
  };
}

export { parseNumber, formatNumber };
