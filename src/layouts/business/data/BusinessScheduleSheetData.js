/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

// team_code: 1=영업팀, 2=운영팀, 3=급식사업부
const BUSINESS_TEAM_CODE = 1;

export default function useBusinessSchedulesheetData(currentYear, currentMonth) {
  const [eventListRows, setEventListRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // 영업팀(team_code=1) 월별 일정 조회
  const eventList = async () => {
    setLoading(true);
    try {
      const formattedMonth = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
      const res = await api.get("/Business/BusinessScheduleList", {
        params: { year: currentYear, month: formattedMonth, team_code: BUSINESS_TEAM_CODE },
      });
      setEventListRows(res.data || []);
    } catch (err) {
      console.error("영업팀 일정 조회 실패:", err);
      setEventListRows([]);
    } finally {
      setLoading(false);
    }
  };

  return { eventListRows, setEventListRows, loading, eventList, BUSINESS_TEAM_CODE };
}
