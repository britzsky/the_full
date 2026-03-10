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

export default function useProfitLossTableData(year, month, account_id) {
  const [profitLossTableRows, setProfitLossTableRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 전달받은 인자를 우선 사용하고, 없으면 현재 state 값 사용
  const fetchProfitLossTableList = useCallback(
    async (accountIdParam = account_id, monthParam = month, yearParam = year) => {
      setLoading(true);
      try {
        const normalizedMonth =
          String(monthParam ?? "").trim() === "ALL" ? "" : String(monthParam ?? "").trim();

        const res = await api.get("/HeadOffice/ProfitLossTableList", {
          params: {
            year: yearParam,
            account_id: account_id,
            month: normalizedMonth,
          },
        });

        if (res.data && Array.isArray(res.data)) {
          setProfitLossTableRows(res.data);
        } else {
          setProfitLossTableRows([]);
        }
      } catch (err) {
        console.error(err);
        setProfitLossTableRows([]);
      } finally {
        setLoading(false);
      }
    },
    [year, month, account_id]
  );

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    api
      .get("/Account/AccountListV2", {
        params: { account_type: "0" },
      })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
          account_type: item.account_type,
        }));
        setAccountList(rows);
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  return {
    profitLossTableRows,
    setProfitLossTableRows,
    accountList,
    loading,
    fetchProfitLossTableList,
  };
}
