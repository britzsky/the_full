/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

export default function useWeekMenusheetData(currentYear, currentMonth) {
  const [weekMenuListRows, setWeekMenuListRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 식단 조회 함수
  const weekMenuList = async () => {
    setLoading(true);
    try {

      // ✅ 월이 한 자리일 경우 앞에 0 붙이기
      const formattedMonth = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;

      const res = await api.get("/HeadOffice/WeekMenuList", {
        params: { year: currentYear, month: formattedMonth, type: 1 },
      });

      const rows = (res.data || []).map((item) => ({
        idx: item.idx,
        menu_date: item.menu_date,
        content: item.content || "",
        type: item.type,
        update_dt: item.update_dt,
        reg_dt: item.reg_dt,
        del_yn: item.del_yn,
        user_id: item.user_id,
      }));

      setWeekMenuListRows(rows);
    } catch (err) {
      console.error("📛 주간 식단 조회 실패:", err);
      setWeekMenuListRows([]);
    } finally {
      setLoading(false);
    }
  };

  return { weekMenuListRows, setWeekMenuListRows, loading, weekMenuList };
}
