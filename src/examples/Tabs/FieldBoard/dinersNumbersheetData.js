/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "api/api";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useDinersNumbersheetData(account_id, year, month) {
  const [activeRows, setActiveRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 조회 함수
  const fetchAllData = useCallback(async () => {
    if (!account_id) return; // 파라미터 아직 없으면 중단

    setLoading(true);
    const startTime = Date.now();

    try {
      const params = { account_id, year, month };
      const res = await api.get("/Operate/AccountDinnersNumberList", { params });

      const rows = (res.data || []).map((item) => {
        const { diner_year, diner_month, diner_date } = item;
        const formattedDate = `${diner_year}-${String(diner_month).padStart(2, "0")}-${String(diner_date).padStart(2, "0")}`;

        return {
          diner_date: formattedDate,
          breakfast: parseNumber(item.breakfast),
          lunch: parseNumber(item.lunch),
          dinner: parseNumber(item.dinner),
          ceremony: parseNumber(item.ceremony),
          daycare_lunch: parseNumber(item.daycare_lunch),
          daycare_diner: parseNumber(item.daycare_diner),
          employ: parseNumber(item.employ),
          total: parseNumber(item.total),
          note: item.note,
          breakcancel: item.breakcancel,
          lunchcancel: item.lunchcancel,
          dinnercancel: item.dinnercancel,
        };
      });

      setActiveRows(rows);
    } catch (err) {
      console.error("데이터 조회 실패:", err);
    } finally {
      const elapsed = Date.now() - startTime;
      const delay = Math.max(1000 - elapsed, 0); // 최소 1초 로딩 유지
      setTimeout(() => setLoading(false), delay);
    }
  }, [account_id, year, month]);

  // ✅ account_id, year, month가 변경될 때만 조회
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { activeRows, setActiveRows, loading, fetchAllData, account_id };
}

export { parseNumber, formatNumber };
