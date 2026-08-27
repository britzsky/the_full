/* eslint-disable */
import { useState, useCallback, useEffect } from "react";
import api from "api/api";

export const parseNumber = (val) => {
  if (val === "" || val == null) return 0;
  const num = Number(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

export const formatNumber = (val) => {
  if (val === "" || val == null) return "";
  return Number(val).toLocaleString();
};

export default function useBudgetTableData(year, month) {
  const [budgetTableRows, setBudgetTableRows] = useState([]);
  const [accountList, setAccountList] = useState([]); // 지금은 안 쓰지만 남겨둠
  const [loading, setLoading] = useState(false);

  // ✅ 새로 추가: 예산 기준 리스트
  const [budgetStandardList, setBudgetStandardList] = useState([]);
  // ✅ 새로 추가: 식수 기준 리스트
  const [mealsNumberList, setMealsNumberList] = useState([]);

  const fetchBudgetTableList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/BudgetManageMentList", {
        params: {
          year,
          month,
        },
      });

      if (res.data && Array.isArray(res.data)) {
        setBudgetTableRows(res.data);
      } else {
        setBudgetTableRows([]);
      }
    } catch (err) {
      console.error("데이터 조회 실패 (BudgetManageMentList):", err);
      setBudgetTableRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // ✅ 예산 기준 리스트
  const fetchBudgetStandardList = useCallback(async () => {
    try {
      const res = await api.get("/Operate/BudgetStandardList");
      const rows = Array.isArray(res.data) ? res.data : [];
      setBudgetStandardList(rows);
    } catch (err) {
      console.error("데이터 조회 실패 (BudgetStandardList):", err);
      setBudgetStandardList([]);
    }
  }, []);

  // ✅ 식수 기준 리스트
  const fetchMealsNumberList = useCallback(async () => {
    try {
      const res = await api.get("/Operate/MealsNumberList");
      const rows = Array.isArray(res.data) ? res.data : [];
      setMealsNumberList(rows);
    } catch (err) {
      console.error("데이터 조회 실패 (MealsNumberList):", err);
      setMealsNumberList([]);
    }
  }, []);

  // ✅ 계정 목록 조회 (지금 화면에서는 안 쓰이지만, 다른 데서 쓸 수도 있으니 유지)
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

  // ✅ 기준 정보들은 화면 마운트 시 한 번만 조회
  useEffect(() => {
    fetchBudgetStandardList();
    fetchMealsNumberList();
  }, [fetchBudgetStandardList, fetchMealsNumberList]);

  return {
    budgetTableRows,
    setBudgetTableRows,
    accountList,
    loading,
    fetchBudgetTableList,
    // ✅ 추가로 리턴
    budgetStandardList,
    mealsNumberList,
  };
}
