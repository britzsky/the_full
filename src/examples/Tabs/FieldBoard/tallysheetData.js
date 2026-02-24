/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import api from "api/api";
import { fetchFieldBoardAccountList } from "./fieldBoardAccountFilter";

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

  return {
    prevYear: prev.year(),
    prevMonth: prev.month() + 1, // 0~11 -> 1~12
  };
};

// ✅ 예산 리스트에서 budget_grant 안전 추출
const pickBudgetGrant = (resData) => {
  const list = Array.isArray(resData) ? resData : resData?.data || [];
  if (!Array.isArray(list) || list.length === 0) return 0;

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
  const [pointList, setPointList] = useState([]);
  const [useList, setUseList] = useState([]);

  // ✅ 예산(현재월/전월)
  const [budgetGrant, setBudgetGrant] = useState(0);
  const [budget2Grant, setBudget2Grant] = useState(0);

  const [loading, setLoading] = useState(false);

  const MIN_LOADING_TIME = 1000; // 최소 로딩 시간 1초
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

  // ✅ 이번 달 데이터 조회
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

  // ✅ 지난 달 데이터 조회
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

  // ✅ 예산(현재월) 조회
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

  // ✅ 포인트(현재월 + 전월) 조회: /Operate/TallySheetPointList?account_id&year&month
  const fetchPointList = useCallback(
    async (overrideAccountId, overrideYear, overrideMonth) => {
      return runWithMinLoading(async () => {
        const a = overrideAccountId ?? account_id;
        const y = overrideYear ?? year;
        const m = overrideMonth ?? month;

        // year/month는 필수
        if (!y || !m) {
          setPointList([]);
          return [];
        }

        const { prevYear, prevMonth } = getPrevYearMonth(y, m);

        // 공통 row 매핑
        const mapRows = (resData) =>
          (resData || []).map((item) => ({
            idx: item.idx,
            count_year: item.count_year,
            count_month: item.count_month,
            count_date: item.count_date,
            account_id: item.account_id,
            type: item.type,
            gubun: item.gubun,
          }));

        // 단일 월 조회 함수
        const fetchOne = async (yy, mm) => {
          const params = { year: yy, month: mm };
          if (a) params.account_id = a;
          const res = await api.get("/Operate/TallySheetPointList", { params });
          return mapRows(res.data);
        };

        try {
          // ✅ 현재월 + 전월 동시 조회
          const [currentRows, prevRows] = await Promise.all([
            fetchOne(y, m),
            fetchOne(prevYear, prevMonth),
          ]);

          // ✅ 합치고 중복 제거(안전)
          const merged = [...currentRows, ...prevRows];
          const uniq = Array.from(
            new Map(
              merged.map((r) => {
                // idx가 항상 유니크면 idx만 써도 되지만, 혹시 몰라 복합키로 안전하게
                const key = `${r.idx ?? ""}|${r.count_year}-${r.count_month}-${r.count_date}|${
                  r.account_id
                }|${r.type}|${r.gubun}`;
                return [key, r];
              })
            ).values()
          );

          // ✅ 정렬(원하면 제거 가능): 최신년/월/일 먼저
          uniq.sort((a1, a2) => {
            const d1 = `${a1.count_year}-${String(a1.count_month).padStart(2, "0")}-${String(
              a1.count_date
            ).padStart(2, "0")}`;
            const d2 = `${a2.count_year}-${String(a2.count_month).padStart(2, "0")}-${String(
              a2.count_date
            ).padStart(2, "0")}`;
            return d2.localeCompare(d1);
          });

          setPointList(uniq);
          return uniq;
        } catch (err) {
          console.error("데이터 조회 실패 (TallySheetPointList):", err);
          setPointList([]);
          return [];
        }
      });
    },
    [account_id, year, month, runWithMinLoading]
  );

  // ✅ 포인트(현재월 + 전월) 조회: /Operate/TallySheetPointList?account_id&year&month
  const fetchUseList = useCallback(
    async (overrideAccountId, overrideYear, overrideMonth) => {
      return runWithMinLoading(async () => {
        const a = overrideAccountId ?? account_id;
        const y = overrideYear ?? year;
        const m = overrideMonth ?? month;

        // year/month는 필수
        if (!y || !m) {
          setUseList([]);
          return [];
        }

        const { prevYear, prevMonth } = getPrevYearMonth(y, m);

        // 공통 row 매핑
        const mapRows = (resData) =>
          (resData || []).map((item) => ({
            count_year: item.count_year,
            count_month: item.count_month,
            account_id: item.account_id,
            type: item.type,
            input_yn: item.input_yn,
          }));

        // 단일 월 조회 함수
        const fetchOne = async (yy, mm) => {
          const params = { year: yy, month: mm };
          if (a) params.account_id = a;
          const res = await api.get("/Operate/TallySheetUseList", { params });
          return mapRows(res.data);
        };

        try {
          // ✅ 현재월 + 전월 동시 조회
          const [currentRows, prevRows] = await Promise.all([
            fetchOne(y, m),
            fetchOne(prevYear, prevMonth),
          ]);

          // ✅ 합치고 중복 제거(안전)
          const merged = [...currentRows, ...prevRows];
          const uniq = Array.from(
            new Map(
              merged.map((r) => {
                // idx가 항상 유니크면 idx만 써도 되지만, 혹시 몰라 복합키로 안전하게
                const key = `${r.idx ?? ""}|${r.count_year}-${r.count_month}-${r.count_date}|${
                  r.account_id
                }|${r.type}|${r.gubun}`;
                return [key, r];
              })
            ).values()
          );

          // ✅ 정렬(원하면 제거 가능): 최신년/월/일 먼저
          uniq.sort((a1, a2) => {
            const d1 = `${a1.count_year}-${String(a1.count_month).padStart(2, "0")}-${String(
              a1.count_date
            ).padStart(2, "0")}`;
            const d2 = `${a2.count_year}-${String(a2.count_month).padStart(2, "0")}-${String(
              a2.count_date
            ).padStart(2, "0")}`;
            return d2.localeCompare(d1);
          });

          setUseList(uniq);
          return uniq;
        } catch (err) {
          console.error("데이터 조회 실패 (TallySheetPointList):", err);
          setUseList([]);
          return [];
        }
      });
    },
    [account_id, year, month, runWithMinLoading]
  );

  // ✅ 두 달 데이터 + 두 달 예산 + 포인트(전월) 동시 조회
  useEffect(() => {
    const fetchAll = async () => {
      // 거래처가 선택되지 않으면 전체 조회를 막고 화면 데이터만 초기화
      if (!account_id || String(account_id).trim() === "") {
        setDataRows([]);
        setData2Rows([]);
        setOriginalRows([]);
        setOriginal2Rows([]);
        setPointList([]);
        setUseList([]);
        setBudgetGrant(0);
        setBudget2Grant(0);
        setCountMonth("");
        setCount2Month("");
        return;
      }

      await Promise.all([
        fetchDataRows(),
        fetchData2Rows(),
        fetchBudgetGrant(),
        fetchBudget2Grant(),
        fetchPointList(), // ✅ 추가
        fetchUseList(), // ✅ 추가
      ]);
    };
    fetchAll();
  }, [
    account_id,
    fetchDataRows,
    fetchData2Rows,
    fetchBudgetGrant,
    fetchBudget2Grant,
    fetchPointList,
    fetchUseList,
  ]);

  // ✅ 계정 목록 조회 (최초 1회)
  useEffect(() => {
    fetchFieldBoardAccountList({ endpoint: "/Account/AccountListV2", accountType: "0" })
      .then((list) => {
        const rows = (list || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(rows);
      })
      .catch((err) => {
        console.error("데이터 조회 실패 (AccountListV2):", err);
        setAccountList([]);
      });
  }, []);

  return {
    dataRows,
    setDataRows,
    data2Rows,
    setData2Rows,
    originalRows,
    original2Rows,
    accountList,
    pointList,
    fetchPointList, // ✅ 반환에 포함
    useList,
    fetchUseList, // ✅ 반환에 포함
    countMonth,
    count2Month,
    loading,

    // ✅ 예산
    budgetGrant,
    budget2Grant,

    // ✅ 재조회(저장 후 등)
    fetchDataRows,
    fetchData2Rows,
    fetchBudgetGrant,
    fetchBudget2Grant,
    fetchPointList, // ✅ 외부에서 필요하면 재조회 가능
  };
}

export { parseNumber, formatNumber };
