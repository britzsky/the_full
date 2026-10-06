/* eslint-disable react/function-component-definition */
import { useCallback, useState } from "react";
import dayjs from "dayjs";
import api from "api/api";

export const formatNumber = (value) => {
  if (value == null || value === "") return "";
  const n = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return "";
  return n.toLocaleString();
};

const pad2 = (m) => String(m).padStart(2, "0");

const getPrevYearMonth = (year, monthNumber) => {
  const d = dayjs(`${year}-${pad2(monthNumber)}-01`).subtract(1, "month");
  return { year: d.year(), month: d.month() + 1 };
};

// ✅ rows: [{type,name,total}] 를 거래처(name) 기준으로 합산
const groupByName = (rows = []) => {
  const map = new Map(); // key: name, value: { type, name, total }
  rows.forEach((r) => {
    const name = String(r.name ?? "").trim();
    if (!name) return;

    const v = Number(String(r.total ?? 0).replace(/,/g, "")) || 0;

    if (!map.has(name)) {
      map.set(name, {
        type: r.type ?? "",
        name,
        total: 0,
      });
    }
    map.get(name).total += v;
  });

  // total 내림차순 정렬(보기 좋게)
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

export default function usePeopleCountingData(year, month) {
  const [loading, setLoading] = useState(false);

  const [currentTotal, setCurrentTotal] = useState(0);
  const [prevTotal, setPrevTotal] = useState(0);

  const [chartData, setChartData] = useState([]);

  const [currentRows, setCurrentRows] = useState([]);
  const [prevRows, setPrevRows] = useState([]);

  // ⚠️ 네 실제 엔드포인트 그대로 사용
  const ENDPOINT = "/HeadOffice/AccountMappingPurchaseList";

  const fetchMonth = async (y, mNumber) => {
    const m = pad2(mNumber); // ✅ 2자리로
    const res = await api.get(ENDPOINT, { params: { year: y, month: m } });
    return res.data || [];
  };

  const fetchPeopleCountingList = useCallback(async () => {
    setLoading(true);
    try {
      const prev = getPrevYearMonth(year, month);

      const [curRowsRaw, preRowsRaw] = await Promise.all([
        fetchMonth(year, month),
        fetchMonth(prev.year, prev.month),
      ]);

      setCurrentRows(curRowsRaw);
      setPrevRows(preRowsRaw);

      // ✅ 거래처별 합산
      const curGrouped = groupByName(curRowsRaw); // [{name,total,type}]
      const preGrouped = groupByName(preRowsRaw);

      // ✅ 총합
      const curSum = curGrouped.reduce((acc, r) => acc + (r.total || 0), 0);
      const preSum = preGrouped.reduce((acc, r) => acc + (r.total || 0), 0);
      setCurrentTotal(curSum);
      setPrevTotal(preSum);

      // ✅ 전월/당월 거래처 목록 합치기 (유니온)
      const preMap = new Map(preGrouped.map((r) => [r.name, r]));
      const curMap = new Map(curGrouped.map((r) => [r.name, r]));

      const names = Array.from(new Set([...preMap.keys(), ...curMap.keys()]));

      // ✅ 차트용 데이터: 거래처(name) 기준으로 prev/current 매핑
      const merged = names.map((name) => ({
        name,
        prev: preMap.get(name)?.total ?? 0,
        current: curMap.get(name)?.total ?? 0,
        type: curMap.get(name)?.type ?? preMap.get(name)?.type ?? "",
      }));

      // 보기 좋게: 당월(current) 기준 내림차순 정렬
      merged.sort((a, b) => b.current - a.current);

      setChartData(merged);
    } catch (err) {
      console.error("매출 조회 실패:", err);
      setCurrentRows([]);
      setPrevRows([]);
      setCurrentTotal(0);
      setPrevTotal(0);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  return {
    loading,
    fetchPeopleCountingList,
    currentTotal,
    prevTotal,
    chartData,
    currentRows,
    prevRows,
  };
}
