/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

export default function useBusinessSchedulesheetData(currentYear, currentMonth) {
  const [eventListRows, setEventListRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 식단 조회 함수
  const eventList = async () => {
    setLoading(true);
    try {

      // ✅ 월이 한 자리일 경우 앞에 0 붙이기
      const formattedMonth = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;

      const res = await api.get("/Business/BusinessScheduleList", {
        params: { year: currentYear, month: formattedMonth },
      });

      const rows = (res.data || []).map((item) => ({
        idx: item.idx,
        start_date: item.start_date,
        end_date: item.end_date,
        content: item.content || "",
        type: item.type,
        update_dt: item.update_dt,
        reg_dt: item.reg_dt,
        del_yn: item.del_yn,
        user_id: item.user_id,
        reg_user_id: item.reg_user_id,
        user_name: item.user_name
      }));

      setEventListRows(rows);
    } catch (err) {
      console.error("📛 주간 식단 조회 실패:", err);
      setEventListRows([]);
    } finally {
      setLoading(false);
    }
  };

  return { eventListRows, setEventListRows, loading, eventList };
}
