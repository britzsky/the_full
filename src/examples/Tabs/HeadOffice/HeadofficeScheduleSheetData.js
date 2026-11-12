/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

// team_code: 0=대표, 1=영업팀, 2=운영팀, 3=급식사업부, 4=개발팀, 5=기획팀, 6=회계팀, 7=인사팀
export const TEAM_CODE = { CEO: 0, BUSINESS: 1, OPERATE: 2, CATERING: 3, DEVELOPMENT: 4, PLANNING: 5, ACCOUNTING: 6, HR: 7 };
// 사용자 department: 0=대표, 2=회계팀, 3=인사팀, 4=영업팀, 5=운영팀, 8=급식사업부, 6=개발팀, 9=기획팀
export const DEPARTMENT_CODE = { CEO: 0, ACCOUNTING: 2, HR: 3, BUSINESS: 4, OPERATE: 5, CATERING: 8, DEVELOPMENT: 6, PLANNING: 9 };

// 일정 화면 전용 동명이인 표시 이름 (user_id 기준, name: 실제 이름 / label: 화면 표시 이름)
export const SCHEDULE_NAME_OVERRIDE = {
  sy7: { name: "이수연", label: "큰수연" },
  sy8: { name: "이수연", label: "작수연" },
};
export const getScheduleUserName = (userId, userName) =>
  SCHEDULE_NAME_OVERRIDE[String(userId ?? "").trim()]?.label || userName;

// 일정 1건의 동행자 이름 목록 (user_names에서 등록자 1명 제외, 동명이인은 구분 이름으로 치환)
export function getCompanionNames(item) {
  const mainUserName = String(item?.user_name || "").trim();
  const mainUserId = String(item?.user_id ?? "").trim();
  const names = String(item?.user_names || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const mainIdx = names.indexOf(mainUserName);
  if (mainIdx >= 0) names.splice(mainIdx, 1);
  String(item?.user_ids || "")
    .split(",")
    .map((id) => id.trim())
    .forEach((id) => {
      const override = SCHEDULE_NAME_OVERRIDE[id];
      if (!override || id === mainUserId) return;
      const idx = names.indexOf(override.name);
      if (idx >= 0) names[idx] = override.label;
    });
  return names;
}

// 일정 조회 커스텀 훅 (tb_business_calendar 단일 테이블, team_code로 구분)
export default function useHeadofficeSchedulesheetData(currentYear, currentMonth) {
  const [eventListRows, setEventListRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  const eventList = async () => {
    setLoading(true);
    try {
      const formattedMonth = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;

      // team_code 없이 전체 조회 → 서버에서 등록된 본사 일정 전체 반환
      const res = await api.get("/HeadOffice/HeadOfficeScheduleList", {
        params: { year: currentYear, month: formattedMonth },
      });

      // team_code를 dept_type 문자열로 변환해 기존 화면 로직과 호환
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
  // null·빈 값이 Number()로 0이 되어 대표로 잡히지 않도록 먼저 제외
  if (teamCode === null || teamCode === undefined || String(teamCode).trim() === "") return "";
  const n = Number(teamCode);
  if (n === TEAM_CODE.CEO) return "ceo";
  if (n === TEAM_CODE.BUSINESS) return "business";
  if (n === TEAM_CODE.OPERATE)  return "operate";
  if (n === TEAM_CODE.CATERING) return "catering";
  if (n === TEAM_CODE.DEVELOPMENT) return "development";
  if (n === TEAM_CODE.PLANNING) return "planning";
  if (n === TEAM_CODE.ACCOUNTING) return "accounting";
  if (n === TEAM_CODE.HR) return "hr";
  return "";
}

// dept_type 문자열 → team_code 숫자 변환 (저장 요청용)
export function deptTypeToTeamCode(deptType) {
  if (deptType === "ceo") return TEAM_CODE.CEO;
  if (deptType === "business") return TEAM_CODE.BUSINESS;
  if (deptType === "operate")  return TEAM_CODE.OPERATE;
  if (deptType === "catering") return TEAM_CODE.CATERING;
  if (deptType === "development") return TEAM_CODE.DEVELOPMENT;
  if (deptType === "planning") return TEAM_CODE.PLANNING;
  if (deptType === "accounting") return TEAM_CODE.ACCOUNTING;
  if (deptType === "hr") return TEAM_CODE.HR;
  return null;
}

// dept_type 문자열 → 사용자 department 숫자 변환 (담당자 조회/저장 요청용)
export function deptTypeToDepartmentCode(deptType) {
  if (deptType === "ceo") return DEPARTMENT_CODE.CEO;
  if (deptType === "business") return DEPARTMENT_CODE.BUSINESS;
  if (deptType === "operate")  return DEPARTMENT_CODE.OPERATE;
  if (deptType === "catering") return DEPARTMENT_CODE.CATERING;
  if (deptType === "development") return DEPARTMENT_CODE.DEVELOPMENT;
  if (deptType === "planning") return DEPARTMENT_CODE.PLANNING;
  if (deptType === "accounting") return DEPARTMENT_CODE.ACCOUNTING;
  if (deptType === "hr") return DEPARTMENT_CODE.HR;
  return null;
}
