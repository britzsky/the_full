/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

// team_code: 1=영업팀, 2=운영팀, 3=급식사업부
const OPERATE_TEAM_CODE = 2;

export default function useOperateSchedulesheetData(currentYear, currentMonth) {
  const [eventListRows, setEventListRows] = useState([]);
  const [operateMemberList, setOperateMemberList] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 운영팀(team_code=2) 월별 일정 조회
  const eventList = async () => {
    setLoading(true);
    try {
      const formattedMonth = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
      const res = await api.get("/Business/BusinessScheduleList", {
        params: { year: currentYear, month: formattedMonth, team_code: OPERATE_TEAM_CODE },
      });
      setEventListRows(res.data || []);
    } catch (err) {
      console.error("운영팀 일정 조회 실패:", err);
      setEventListRows([]);
    } finally {
      setLoading(false);
    }
  };

  // 운영팀(team_code=2) 담당자 목록 조회
  const fetchOperateMemberList = async (force = false) => {
    if (!force && operateMemberList.length > 0) return operateMemberList;
    const res = await api.get("/Business/BusinessMemberList", {
      params: { team_code: OPERATE_TEAM_CODE },
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

  // 일정 저장 (team_code=2 고정)
  const saveOperateSchedule = async (payload) => {
    return api.post("/Business/BusinessScheduleSave", { ...payload, team_code: OPERATE_TEAM_CODE }, {
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
