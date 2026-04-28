/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

// team_code: 1=영업팀, 2=운영팀, 3=급식사업부
export const TEAM_CODE = { BUSINESS: 1, OPERATE: 2, CATERING: 3 };

// 일정 조회 커스텀 훅 (tb_business_calendar 단일 테이블, team_code로 구분)
export default function useHeadofficeSchedulesheetData(currentYear, currentMonth) {
  const [eventListRows, setEventListRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  const eventList = async () => {
    setLoading(true);
    try {
      const formattedMonth = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;

      // team_code 없이 전체 조회 → 서버에서 1/2/3 모두 반환
      const res = await api.get("/HeadOffice/HeadOfficeScheduleList", {
        params: { year: currentYear, month: formattedMonth },
      });

      // team_code(1/2/3)를 dept_type 문자열로 변환해 기존 화면 로직과 호환
      const rows = (res.data || []).map((item) => ({
        ...item,
        dept_type: teamCodeToDeptType(item.team_code),
      }));

      setEventListRows(rows);
    } catch (err) {
      console.error("일정 조회 실패:", err);
      setEventListRows([]);
    } finally {
      setLoading(false);
    }
  };

  // 거래처별 통계와 일정 등록 화면에서 사용하는 거래처 목록 조회
  const fetchAccountList = async (force = false) => {
    if (!force && accountList.length > 0) return accountList;
    const res = await api.get("/Account/AccountList", { params: { account_type: "0" } });
    const rows = res.data || [];
    setAccountList(rows);
    return rows;
  };

  return { eventListRows, setEventListRows, accountList, loading, eventList, fetchAccountList };
}

// team_code 숫자 → dept_type 문자열 변환 (화면 표시용)
export function teamCodeToDeptType(teamCode) {
  const n = Number(teamCode);
  if (n === TEAM_CODE.BUSINESS) return "business";
  if (n === TEAM_CODE.OPERATE)  return "operate";
  if (n === TEAM_CODE.CATERING) return "catering";
  return "";
}

// dept_type 문자열 → team_code 숫자 변환 (저장 요청용)
export function deptTypeToTeamCode(deptType) {
  if (deptType === "business") return TEAM_CODE.BUSINESS;
  if (deptType === "operate")  return TEAM_CODE.OPERATE;
  if (deptType === "catering") return TEAM_CODE.CATERING;
  return null;
}
