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

  // ✅ 거래처별 마감 파일 조회
  const fetchAccountIssueList = async () => {
    setLoading(true);
    const startTime = Date.now();
    try {
      const res = await api.get("/Account/AccountIssueList", {
        params: { year, month, type : 2 },
      });
      
      const grouped = {};

      (res.data || []).forEach((item) => {
        const { account_id, account_name, month, note } = item;

        if (!grouped[account_id]) {
          grouped[account_id] = {
            account_id,
            account_name,
          };
          // 미리 12개월 초기화
          for (let i = 1; i <= 12; i++) grouped[account_id][`month_${i}`] = null;
        }

        // 해당 월에 파일 이름 세팅
        grouped[account_id][`month_${month}`] = note;
      });

      setAccountIssueRows(Object.values(grouped));
    } catch (err) {
      console.error("DeadlineFilesList 조회 실패:", err);
      setAccountIssueRows([]);
    } finally {
      const elapsed = Date.now() - startTime;
      const delay = Math.max(1000 - elapsed, 0); // 최소 1초 로딩 유지
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
