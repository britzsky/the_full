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

export default function useDeadlineFilesData(year, month) {
  const [deadlineFilesRows, setDeadlineFilesRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 거래처별 마감 파일 조회
  const fetchDeadlineFilesList = async () => {
    setLoading(true);
    try {
      const res = await api.get("/Account/AccountDeadlineFilesList", {
        params: { year, month },
      });
      
      const grouped = {};

      (res.data || []).forEach((item) => {
        const { account_id, account_name, month, deadline_file } = item;

        if (!grouped[account_id]) {
          grouped[account_id] = {
            account_id,
            account_name,
          };
          // 미리 12개월 초기화
          for (let i = 1; i <= 12; i++) grouped[account_id][`month_${i}`] = null;
        }

        // 해당 월에 파일 이름 세팅
        grouped[account_id][`month_${month}`] = deadline_file;
      });

      setDeadlineFilesRows(Object.values(grouped));
    } catch (err) {
      console.error("DeadlineFilesList 조회 실패:", err);
      setDeadlineFilesRows([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    deadlineFilesRows,
    loading,
    fetchDeadlineFilesList,
    setDeadlineFilesRows,
  };
}

export { parseNumber, formatNumber };
