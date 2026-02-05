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

export default function useAccountIssueData(year, month) {
  const [accountIssueRows, setAccountIssueRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 거래처별 이슈 조회
  const fetchAccountIssueList = async () => {
    setLoading(true);
    const startTime = Date.now();

    try {
      const res = await api.get("/Account/AccountIssueList", {
        params: { year, month, type: 2 },
      });

      const grouped = {};

      (res.data || []).forEach((item) => {
        const { account_id, account_name, month: itemMonth, note, solution, event_note } = item;

        if (!grouped[account_id]) {
          grouped[account_id] = { account_id, account_name };
          // ✅ 12개월 초기화: 객체 형태로
          for (let i = 1; i <= 12; i++) {
            grouped[account_id][`month_${i}`] = {
              note: "",
              solution: "",
              event_note: "",
            };
          }
        }

        // ✅ month가 1~12 범위일 때만 반영
        const m = Number(itemMonth);
        if (m >= 1 && m <= 12) {
          grouped[account_id][`month_${m}`] = {
            note: note || "",
            solution: solution || "",
            event_note: event_note || "",
          };
        }
      });

      setAccountIssueRows(Object.values(grouped));
    } catch (err) {
      console.error("AccountIssueList 조회 실패:", err);
      setAccountIssueRows([]);
    } finally {
      const elapsed = Date.now() - startTime;
      const delay = Math.max(500 - elapsed, 0); // 최소 1초 로딩 유지
      setTimeout(() => setLoading(false), delay);
    }
  };

  return {
    accountIssueRows,
    loading,
    fetchAccountIssueList,
    setAccountIssueRows,
  };
}

export { parseNumber, formatNumber };
