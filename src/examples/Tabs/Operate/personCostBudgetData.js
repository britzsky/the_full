/* eslint-disable */
import { useState, useCallback } from "react";
import api from "api/api";

export const formatNumber = (val) => {
  if (val === "" || val == null) return "";
  return Number(val).toLocaleString();
};

// 🔹 인건비 예산관리: 매출 대비 인건비 45% 이상인 업장만 조회
//    (당월 실적이 없으면 2개월 전 실적으로 대체 - 백엔드에서 처리)
export default function usePersonCostBudgetData(year, month) {
  const [personCostRows, setPersonCostRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPersonCostBudgetList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/PersonCostBudgetList", {
        params: {
          year,
          month,
        },
      });

      if (res.data && Array.isArray(res.data)) {
        setPersonCostRows(res.data);
      } else {
        setPersonCostRows([]);
      }
    } catch (err) {
      console.error("데이터 조회 실패 (PersonCostBudgetList):", err);
      setPersonCostRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  return {
    personCostRows,
    loading,
    fetchPersonCostBudgetList,
  };
}
