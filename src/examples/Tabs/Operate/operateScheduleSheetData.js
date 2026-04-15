/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

export default function useOperateSchedulesheetData(currentYear, currentMonth) {
  const [eventListRows, setEventListRows] = useState([]);
  const [operateMemberList, setOperateMemberList] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 운영 일정 월별 조회
  const eventList = async () => {
    setLoading(true);
    try {

      // ✅ 월이 한 자리일 경우 앞에 0 붙이기
      const formattedMonth = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;

      const res = await api.get("/Operate/OperateScheduleList", {
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
        account_id: item.account_id,
        account_name: item.account_name,
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

  // 운영팀 담당자 목록 조회
  const fetchOperateMemberList = async (force = false) => {
    if (!force && operateMemberList.length > 0) return operateMemberList;
    const res = await api.get("/Operate/OperateMemberList", {
      headers: { "Content-Type": "application/json" },
    });
    const rows = res.data || [];
    setOperateMemberList(rows);
    return rows;
  };

  // 거래처 목록 조회
  const fetchAccountList = async (force = false) => {
    if (!force && accountList.length > 0) return accountList;
    const res = await api.get("/Account/AccountList", { params: { account_type: "0" } });
    const rows = res.data || [];
    setAccountList(rows);
    return rows;
  };

  // 운영 일정 저장(신규/수정/취소/복원 공용)
  const saveOperateSchedule = async (payload) => {
    return api.post("/Operate/OperateScheduleSave", payload, {
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    eventListRows,
    setEventListRows,
    operateMemberList,
    accountList,
    loading,
    eventList,
    fetchOperateMemberList,
    fetchAccountList,
    saveOperateSchedule,
  };
}
