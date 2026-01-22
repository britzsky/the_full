/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import api from "api/api";

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString();
};

// ✅ 이전월 안전 계산 (1월 -> 전년도 12월)
const getPrevYearMonth = (year, month) => {
  const safeYear = Number(year) || dayjs().year();
  const safeMonth = Number(month) || dayjs().month() + 1; // 1~12

  const base = dayjs(`${safeYear}-${String(safeMonth).padStart(2, "0")}-01`);
  const prev = base.subtract(1, "month");

  return { prevYear: prev.year(), prevMonth: prev.month() + 1 };
};

// ✅ 예산 리스트에서 budget_grant 안전 추출
const pickBudgetGrant = (resData) => {
  const list = Array.isArray(resData) ? resData : resData?.data || [];
  if (!Array.isArray(list) || list.length === 0) return 0;

  // budget_grant 필드가 있는 첫 항목 사용(필요시 조건 추가 가능)
  const first = list.find((x) => x && x.budget_grant != null) || list[0];
  return parseNumber(first?.budget_grant);
};

export default function useTallysheetData(account_id, year, month) {
  const [dataRows, setDataRows] = useState([]);
  const [data2Rows, setData2Rows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [original2Rows, setOriginal2Rows] = useState([]);
  const [countMonth, setCountMonth] = useState("");
  const [count2Month, setCount2Month] = useState("");
  const [accountList, setAccountList] = useState([]);

  // ✅ 예산(현재월/전월)
  const [budgetGrant, setBudgetGrant] = useState(0);
  const [budget2Grant, setBudget2Grant] = useState(0);

  const [loading, setLoading] = useState(false);

  const MIN_LOADING_TIME = 1000;

  // ✅ 동시 조회(Promise.all) 로딩 꼬임 방지
  const loadingCountRef = useRef(0);

  const runWithMinLoading = useCallback(async (fn) => {
    const startTime = Date.now();

    loadingCountRef.current += 1;
    setLoading(true);

    try {
      return await fn();
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = MIN_LOADING_TIME - elapsed;

      setTimeout(
        () => {
          loadingCountRef.current -= 1;
          if (loadingCountRef.current <= 0) {
            loadingCountRef.current = 0;
            setLoading(false);
          }
        },
        remaining > 0 ? remaining : 0
      );
    }
  }, []);

  // ✅ 이번 달 데이터 조회 (필요하면 override 파라미터도 가능)
  const fetchDataRows = useCallback(
    async (overrideAccountId, overrideYear, overrideMonth) => {
      return runWithMinLoading(async () => {
        setOriginalRows([]);

        const a = overrideAccountId ?? account_id;
        const y = overrideYear ?? year;
        const m = overrideMonth ?? month;

        try {
          const params = {};
          if (a) params.account_id = a;
          if (y) params.year = y;
          if (m) params.month = m;

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

          setDataRows(initialRows);
          setOriginalRows(initialRows.map((r) => ({ ...r })));

          return initialRows;
        } catch (err) {
          console.error("데이터 조회 실패 (이번 달):", err);
          setDataRows([]);
          setCountMonth("");
          return [];
        }
      });
    },
    [account_id, year, month, runWithMinLoading]
  );

  // ✅ 지난 달 데이터 조회 (🔥 month-1 제거, year/month 같이 보정)
  const fetchData2Rows = useCallback(
    async (overrideAccountId, overrideYear, overrideMonth) => {
      return runWithMinLoading(async () => {
        setOriginal2Rows([]);

        const a = overrideAccountId ?? account_id;
        const y = overrideYear ?? year;
        const m = overrideMonth ?? month;

        const { prevYear, prevMonth } = getPrevYearMonth(y, m);

        try {
          const params = {};
          if (a) params.account_id = a;

          // ✅ 이전월의 year/month를 정확히 넣는다
          params.year = prevYear;
          params.month = prevMonth;

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

          setData2Rows(initialRows);
          setOriginal2Rows(initialRows.map((r) => ({ ...r })));

          return initialRows;
        } catch (err) {
          console.error("데이터 조회 실패 (지난 달):", err);
          setData2Rows([]);
          setCount2Month("");
          return [];
        }
      });
    },
    [account_id, year, month, runWithMinLoading]
  );

  // ✅ 예산(현재월) 조회: /Operate/BudgetManageMentList?account_id&year&month
  const fetchBudgetGrant = useCallback(
    async (overrideAccountId, overrideYear, overrideMonth) => {
      return runWithMinLoading(async () => {
        const a = overrideAccountId ?? account_id;
        const y = overrideYear ?? year;
        const m = overrideMonth ?? month;

        if (!a || !y || !m) {
          setBudgetGrant(0);
          return 0;
        }

        try {
          const res = await api.get("/Operate/BudgetManageMentList", {
            params: { account_id: a, year: y, month: m },
          });

          const grant = pickBudgetGrant(res.data);
          setBudgetGrant(grant);
          return grant;
        } catch (err) {
          console.error("예산 조회 실패 (현재월):", err);
          setBudgetGrant(0);
          return 0;
        }
      });
    },
    [account_id, year, month, runWithMinLoading]
  );

  // ✅ 예산(전월) 조회
  const fetchBudget2Grant = useCallback(
    async (overrideAccountId, overrideYear, overrideMonth) => {
      return runWithMinLoading(async () => {
        const a = overrideAccountId ?? account_id;
        const y = overrideYear ?? year;
        const m = overrideMonth ?? month;

        if (!a || !y || !m) {
          setBudget2Grant(0);
          return 0;
        }

        const { prevYear, prevMonth } = getPrevYearMonth(y, m);

        try {
          const res = await api.get("/Operate/BudgetManageMentList", {
            params: { account_id: a, year: prevYear, month: prevMonth },
          });

          const grant = pickBudgetGrant(res.data);
          setBudget2Grant(grant);
          return grant;
        } catch (err) {
          console.error("예산 조회 실패 (전월):", err);
          setBudget2Grant(0);
          return 0;
        }
      });
    },
    [account_id, year, month, runWithMinLoading]
  );

  // ✅ 두 달 데이터 + 두 달 예산 동시 조회
  useEffect(() => {
    const fetchAll = async () => {
      await Promise.all([
        fetchDataRows(),
        fetchData2Rows(),
        fetchBudgetGrant(),
        fetchBudget2Grant(),
      ]);
    };
    fetchAll();
  }, [fetchDataRows, fetchData2Rows, fetchBudgetGrant, fetchBudget2Grant]);

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    api
      .get("/Account/AccountList", { params: { account_type: "0" } })
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

    // ✅ 예산
    budgetGrant,
    budget2Grant,

    // ✅ 재조회
    fetchDataRows,
    fetchData2Rows,
    fetchBudgetGrant,
    fetchBudget2Grant,
  };
}

export { parseNumber, formatNumber };
