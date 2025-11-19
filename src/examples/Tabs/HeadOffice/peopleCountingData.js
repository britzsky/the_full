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

export default function usePeopleCountingData(year, month) {
  const [peopleCountingRows, setPeopleCountingRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 거래처별 일자별 인원 조회
  const fetchPeopleCountingList = async () => {
    setLoading(true);
    try {
      const res = await api.get("/HeadOffice/PeopleCountingList", {
        params: { year, month },
      });

      const grouped = {};
      const daysInMonth = new Date(year, month, 0).getDate(); // ✅ 해당 월의 마지막 일자

      (res.data || []).forEach((item) => {
        const { account_id, account_name, diner_date, total } = item;

        // ✅ 일자 추출 (이제 1,2,3 형태로 들어오므로 바로 숫자 변환)
        const day = Number(diner_date);

        // ✅ 계정별 그룹 초기화
        if (!grouped[account_id]) {
          grouped[account_id] = {
            account_id,
            account_name,
          };

          // ✅ day_1 ~ day_N 초기화
          for (let d = 1; d <= daysInMonth; d++) {
            grouped[account_id][`day_${d}`] = "";
          }
        }

        // ✅ 해당 일자에 total 값 넣기
        grouped[account_id][`day_${day}`] = total;
      });

      // ✅ 최종 행 배열 세팅
      setPeopleCountingRows(Object.values(grouped));
    } catch (err) {
      console.error("PeopleCountingList 조회 실패:", err);
      setPeopleCountingRows([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    peopleCountingRows,
    loading,
    fetchPeopleCountingList,
    setPeopleCountingRows,
  };
}

export { parseNumber, formatNumber };
