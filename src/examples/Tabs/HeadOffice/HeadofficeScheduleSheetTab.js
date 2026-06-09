import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import api from "api/api";
import {
  Modal,
  Box,
  Button,
  TextField,
  Typography,
  Select,
  MenuItem,
  Autocomplete,
  Checkbox,
  useTheme,
  useMediaQuery,
} from "@mui/material";

import useHeadofficeSchedulesheetData, {
  deptTypeToDepartmentCode,
  deptTypeToTeamCode,
} from "./HeadofficeScheduleSheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import "layouts/headoffice/headoffice-schedule-sheet.css";

const CTRL_HEIGHT = 38;

// 운영팀 일정 구분 옵션
const TYPE_OPTIONS_OPERATE = [
  { value: "1", label: "행사" },
  { value: "2", label: "위생" },
  { value: "3", label: "관리" },
  { value: "4", label: "이슈" },
  { value: "5", label: "미팅" },
  { value: "6", label: "오픈" },
  { value: "7", label: "오픈준비" },
  { value: "8", label: "외근" },
  { value: "9", label: "출장" },
  { value: "10", label: "체크" },
  { value: "11", label: "연차" },
  { value: "12", label: "오전반차" },
  { value: "13", label: "오후반차" },
];

// 급식사업부 일정 구분 옵션
const TYPE_OPTIONS_CATERING = [
  { value: "1", label: "행사" },
  { value: "2", label: "위생" },
  { value: "3", label: "관리" },
  { value: "4", label: "이슈" },
  { value: "5", label: "미팅" },
  { value: "6", label: "오픈" },
  { value: "7", label: "오픈준비" },
  { value: "8", label: "외근" },
  { value: "9", label: "출장" },
  { value: "10", label: "체크" },
  { value: "11", label: "연차" },
  { value: "12", label: "오전반차" },
  { value: "13", label: "오후반차" },
];

// 영업팀 일정 구분 옵션
const TYPE_OPTIONS_BUSINESS = [
  { value: "1", label: "행사" },
  { value: "2", label: "미팅" },
  { value: "3", label: "오픈" },
  { value: "4", label: "오픈준비" },
  { value: "5", label: "외근" },
  { value: "6", label: "출장" },
  { value: "7", label: "체크" },
  { value: "8", label: "연차" },
  { value: "9", label: "오전반차" },
  { value: "10", label: "오후반차" },
];

// 개발팀 일정 구분 옵션
const TYPE_OPTIONS_DEVELOPMENT = [
  { value: "1", label: "행사" },
  { value: "2", label: "위생" },
  { value: "3", label: "관리" },
  { value: "4", label: "이슈" },
  { value: "5", label: "미팅" },
  { value: "6", label: "오픈" },
  { value: "7", label: "오픈준비" },
  { value: "8", label: "외근" },
  { value: "9", label: "출장" },
  { value: "10", label: "체크" },
  { value: "11", label: "연차" },
  { value: "12", label: "오전반차" },
  { value: "13", label: "오후반차" },
];

// 기획팀 일정 구분 옵션
const TYPE_OPTIONS_PLANNING = [
  { value: "1", label: "행사" },
  { value: "2", label: "위생" },
  { value: "3", label: "관리" },
  { value: "4", label: "이슈" },
  { value: "5", label: "미팅" },
  { value: "6", label: "오픈" },
  { value: "7", label: "오픈준비" },
  { value: "8", label: "외근" },
  { value: "9", label: "출장" },
  { value: "10", label: "체크" },
  { value: "11", label: "연차" },
  { value: "12", label: "오전반차" },
  { value: "13", label: "오후반차" },
];

// 팀 구분 옵션 (operate / business / catering / development / planning)
const DEPARTMENT_OPTIONS = [
  { value: "business", label: "영업팀" },
  { value: "operate", label: "운영팀" },
  { value: "catering", label: "급식사업부" },
  { value: "development", label: "개발팀" },
  { value: "planning", label: "기획팀" },
];

// dept_type에 따른 구분 옵션 반환
const getTypeOptions = (deptType) => {
  if (deptType === "business") return TYPE_OPTIONS_BUSINESS;
  if (deptType === "catering") return TYPE_OPTIONS_CATERING;
  if (deptType === "development") return TYPE_OPTIONS_DEVELOPMENT;
  if (deptType === "planning") return TYPE_OPTIONS_PLANNING;
  return TYPE_OPTIONS_OPERATE;
};

// dept_type / type 값에 따른 캘린더 이벤트 색상 반환
const getTypeColor = (type, deptType) => {
  const t = String(type);

  // 영업팀 — 하늘색 계열
  if (deptType === "business") {
    switch (t) {
      case "1": return "#0288D1";   // 행사
      case "2": return "#0277BD";   // 미팅
      case "3": return "#0288D1";   // 오픈
      case "4": return "#3431df";   // 오픈준비
      case "5": return "#4478e9";   // 외근
      case "6": return "#2253da";   // 출장
      case "7": return "#6390d3";   // 체크
      case "8": return "#1A0841";   // 연차
      case "9": return "#1A0841";   // 오전반차
      case "10": return "#1A0841";  // 오후반차
      default: return "#0288D1";
    }
  }

  // 운영팀 — 초록 계열
  if (deptType === "operate") {
    switch (t) {
      case "1": return "#20af27";   // 행사
      case "2": return "#32ac38";   // 위생
      case "3": return "#207c24";   // 관리
      case "4": return "#2E7D32";   // 이슈
      case "5": return "#207c30";   // 미팅
      case "6": return "#038820";   // 오픈
      case "7": return "#4CAF50";   // 오픈준비
      case "8": return "#39b13f";   // 외근
      case "9": return "#4a9e0e";   // 출장
      case "10": return "#689F38";  // 체크
      case "11": return "#1A0841";  // 연차
      case "12": return "#1A0841";  // 오전반차
      case "13": return "#1A0841";  // 오후반차
      default: return "#388E3C";
    }
  }

  // 개발팀 — 노란색 계열
  if (deptType === "development") {
    switch (t) {
      case "1": return "#F9A825";   // 행사
      case "2": return "#FBC02D";   // 위생
      case "3": return "#c4aa3a";   // 관리
      case "4": return "#F57F17";   // 이슈
      case "5": return "#FFB300";   // 미팅
      case "6": return "#FBC02D";   // 오픈
      case "7": return "#e4bf47";   // 오픈준비
      case "8": return "#F9A825";   // 외근
      case "9": return "#FFA000";   // 출장
      case "10": return "#FFCA28";  // 체크
      case "11": return "#1A0841";  // 연차
      case "12": return "#1A0841";  // 오전반차
      case "13": return "#1A0841";  // 오후반차
      default: return "#F9A825";
    }
  }

  // 기획팀 — 보라색 계열
  if (deptType === "planning") {
    switch (t) {
      case "1": return "#6A1B9A";   // 행사
      case "2": return "#7B1FA2";   // 위생
      case "3": return "#8E24AA";   // 관리
      case "4": return "#9C27B0";   // 이슈
      case "5": return "#AB47BC";   // 미팅
      case "6": return "#BA68C8";   // 오픈
      case "7": return "#CE93D8";   // 오픈준비
      case "8": return "#7E57C2";   // 외근
      case "9": return "#5E35B1";   // 출장
      case "10": return "#512DA8";  // 체크
      case "11": return "#1A0841";  // 연차
      case "12": return "#1A0841";  // 오전반차
      case "13": return "#1A0841";  // 오후반차
      default: return "#7B1FA2";
    }
  }

  // 급식사업부 — 분홍 계열
  switch (t) {
    case "1": return "#C2185B";   // 행사
    case "2": return "#D81B60";   // 위생
    case "3": return "#f395b5";   // 관리
    case "4": return "#c25b88";   // 이슈
    case "5": return "#f079a0";   // 미팅
    case "6": return "#F06292";   // 오픈
    case "7": return "#F48FB1";   // 오픈준비
    case "8": return "#880E4F";   // 외근
    case "9": return "#c55a85";   // 출장
    case "10": return "#e0336d";  // 체크
    case "11": return "#1A0841";  // 연차
    case "12": return "#1A0841";  // 오전반차
    case "13": return "#1A0841";  // 오후반차
    default: return "#E91E63";
  }
};

// type 값을 라벨 문자열로 변환
const getTypeLabel = (typeValue, deptType) => {
  const v = String(typeValue ?? "");
  const options = getTypeOptions(deptType);
  const found = options.find((t) => t.value === v);
  return found ? found.label : "";
};

// 캘린더 이벤트 제목에서 "[구분 - 거래처] " 접두사 제거
const stripSchedulePrefix = (text) => String(text || "").replace(/^\[[^\]]*\]\s*/, "").trim();

// 저장할 content 문자열 조립: "[구분 - 거래처] 내용"
const buildScheduleContent = (typeValue, accountName, rawContent, deptType) => {
  const typeLabel = getTypeLabel(typeValue, deptType);
  const cleanContent = stripSchedulePrefix(rawContent);
  const cleanAccountName = String(accountName || "").trim();
  const badge = typeLabel
    ? `[${typeLabel}${cleanAccountName ? ` - ${cleanAccountName}` : ""}]`
    : cleanAccountName ? `[${cleanAccountName}]` : "";
  return `${badge}${badge && cleanContent ? " " : ""}${cleanContent}`.trim();
};

// 행의 account_name이 없으면 accountList에서 account_id로 조회
const resolveAccountName = (item, accounts) => {
  const fromRow = String(item?.account_name || "").trim();
  if (fromRow) return fromRow;
  const accountId = String(item?.account_id || "").trim();
  if (!accountId) return "";
  const found = (accounts || []).find((a) => String(a?.account_id || "") === accountId);
  return String(found?.account_name || "").trim();
};

// 직책 코드 → 라벨
const POSITION_LABEL = { 0: "대표", 1: "팀장", 2: "파트장", 3: "매니저" };
const getPositionLabel = (pos) => POSITION_LABEL[Number(pos)] ?? "직급없음";

// 날짜 값을 YYYY-MM-DD 문자열로 정규화
const normalizeYmd = (value) => {
  const d = dayjs(value);
  return d.isValid() ? d.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
};

// 저장 API: 모든 팀 단일 엔드포인트 (team_code로 구분)
const SAVE_URL = "/Business/BusinessScheduleSave";
// 담당자 조회 API: 모든 팀 단일 엔드포인트 (team_code로 구분)
const MEMBER_LIST_URL = "/Business/BusinessMemberList";

function HeadofficeScheduleSheetTab({ year, month, onYearChange, onMonthChange }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const currentYear = year ?? dayjs().year();
  const currentMonth = month ?? (dayjs().month() + 1);
  const { eventListRows, eventList, loading } = useHeadofficeSchedulesheetData(currentYear, currentMonth);

  const displayDate = dayjs(new Date(currentYear, currentMonth - 1, 1));
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventClicked, setIsEventClicked] = useState(false);

  const loginUserId = localStorage.getItem("user_id");

  const [selectedType, setSelectedType] = useState("1");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedDeptType, setSelectedDeptType] = useState(""); // "operate" | "business" | "catering"
  const [memberList, setMemberList] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  const [accountList, setAccountList] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);

  // team_code로 담당자 목록 조회 (단일 API)
  const fetchMemberList = async (deptType) => {
    if (!deptType) return [];
    try {
      const teamCode = deptTypeToTeamCode(deptType);
      const departmentCode = deptTypeToDepartmentCode(deptType);
      const res = await api.get(MEMBER_LIST_URL, {
        params: { team_code: teamCode, department: departmentCode },
        headers: { "Content-Type": "application/json" },
      });
      const rows = res.data || [];
      const hasDepartmentField = rows.some((member) =>
        member?.department !== undefined || member?.dept_code !== undefined || member?.dept_id !== undefined
      );
      if (!departmentCode || !hasDepartmentField) return rows;

      // 선택한 팀에 속한 사용자만 담당자 목록에 표시
      return rows.filter((member) => {
        const memberDepartment = member?.department ?? member?.dept_code ?? member?.dept_id ?? "";
        return String(memberDepartment) === String(departmentCode);
      });
    } catch (error) {
      console.error("담당자 목록 조회 실패:", error);
      Swal.fire("실패", "담당자 목록을 가져오지 못했습니다.", "error");
      return [];
    }
  };

  // 팀구분 변경 시 담당자 목록 갱신, 구분/담당자 초기화
  const handleDeptTypeChange = async (deptType) => {
    setSelectedDeptType(deptType);
    setSelectedMemberIds(loginUserId ? [loginUserId] : []);
    setSelectedType("1");
    setSelectedTypes([]);
    setMemberList([]);
    if (!deptType) return;
    const rows = await fetchMemberList(deptType);
    setMemberList(rows);
  };

  // 거래처 목록 조회 (최초 1회만 fetch, 이후 캐시 사용)
  const fetchAccountList = async () => {
    try {
      if (accountList.length > 0) return accountList;
      const res = await api.get("/Account/AccountList", { params: { account_type: "0" } });
      const rows = res.data || [];
      setAccountList(rows);
      return rows;
    } catch (error) {
      console.error("AccountList 조회 실패:", error);
      return [];
    }
  };

  // 연/월 변경 시 일정 재조회
  useEffect(() => { eventList(); }, []);
  useEffect(() => { if (currentYear && currentMonth) eventList(); }, [currentYear, currentMonth]);
  useEffect(() => { fetchAccountList(); }, []);

  // eventListRows → FullCalendar events 배열로 변환 (취소된 일정 제외, team_code 오름차순 정렬)
  useEffect(() => {
    const mapped = eventListRows
      .filter((item) => {
        if (item.del_yn === "Y") return false;
        const date = dayjs(item.start_date);
        return date.year() === currentYear && date.month() + 1 === currentMonth;
      })
      .sort((a, b) => Number(a.team_code) - Number(b.team_code))
      .map((item) => {
        const bgColor = getTypeColor(item.type, item.dept_type);
        const isCanceled = item.del_yn === "Y";
        const accountName = resolveAccountName(item, accountList);
        const deptLabel = DEPARTMENT_OPTIONS.find((d) => d.value === item.dept_type)?.label || "";
        return {
          title: item.content || "내용 없음",
          start: dayjs(item.start_date).format("YYYY-MM-DD"),
          end: dayjs(item.end_date || item.start_date).add(1, "day").format("YYYY-MM-DD"),
          backgroundColor: bgColor,
          textColor: "#fff",
          extendedProps: { ...item, account_name: accountName, isCanceled, dept_label: deptLabel },
        };
      });
    setEvents(mapped);
  }, [eventListRows, currentYear, currentMonth, accountList]);

  // 모달 초기화
  const resetModal = () => {
    setInputValue("");
    setSelectedType("1");
    setSelectedTypes([]);
    setSelectedDeptType("");
    setMemberList([]);
    setSelectedMemberIds(loginUserId ? [loginUserId] : []);
    setSelectedAccounts([]);
    setSelectedEvent(null);
  };

  // 신규 일정 모달 열기
  const openNew = async (start, end) => {
    resetModal();
    setSelectedDate(start);
    setSelectedEndDate(end);
    await fetchAccountList();
    setOpen(true);
  };

  // 날짜 클릭 → 신규 등록
  const handleDateClick = async (arg) => {
    if (isEventClicked) { setIsEventClicked(false); return; }
    await openNew(arg.dateStr, arg.dateStr);
  };

  // 범위 드래그 → 신규 등록
  const handleSelectRange = async (info) => {
    const start = dayjs(info.start).format("YYYY-MM-DD");
    const end = dayjs(info.end).subtract(1, "day").format("YYYY-MM-DD");
    await openNew(start, end);
  };

  // 이벤트 클릭 → 수정 모달 열기
  const handleEventClick = async (info) => {
    setIsEventClicked(true);
    const clickedEvent = info.event;
    let start = clickedEvent.extendedProps?.start_date;
    let end = clickedEvent.extendedProps?.end_date;
    if (!start) start = dayjs(clickedEvent.start).format("YYYY-MM-DD");
    if (!end) {
      end = clickedEvent.end
        ? dayjs(clickedEvent.end).subtract(1, "day").format("YYYY-MM-DD")
        : start;
    }
    setSelectedDate(start);
    setSelectedEndDate(end);
    setSelectedEvent(clickedEvent);
    setInputValue(stripSchedulePrefix(clickedEvent.title));
    const typeStr = clickedEvent.extendedProps?.type?.toString() || "1";
    setSelectedType(typeStr);
    setSelectedTypes([typeStr]);

    // user_ids가 있으면 복원, 없으면 user_id 단건으로 초기화
    const userIdsStr = clickedEvent.extendedProps?.user_ids;
    if (userIdsStr && userIdsStr.trim()) {
      setSelectedMemberIds(userIdsStr.split(",").map((id) => id.trim()).filter(Boolean));
    } else {
      const uId = clickedEvent.extendedProps?.user_id?.toString() || "";
      setSelectedMemberIds(uId ? [uId] : (loginUserId ? [loginUserId] : []));
    }

    const deptType = clickedEvent.extendedProps?.dept_type || "";
    setSelectedDeptType(deptType);

    const [fetchedAccounts, fetchedMembers] = await Promise.all([
      fetchAccountList(),
      fetchMemberList(deptType),
    ]);
    setMemberList(fetchedMembers);

    const accId = clickedEvent.extendedProps?.account_id;
    if (accId) {
      const sourceAccounts = Array.isArray(fetchedAccounts) ? fetchedAccounts : accountList;
      const found = sourceAccounts.find((a) => String(a.account_id) === String(accId));
      setSelectedAccounts(found ? [found] : []);
    } else {
      setSelectedAccounts([]);
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setSelectedEvent(null); };

  // 저장/취소용 공통 payload 생성 (accountId, typeValue 개별 전달)
  const buildPayload = (del_yn, accountId, typeValue) => {
    const cleanInputValue = stripSchedulePrefix(inputValue);
    const savedAccountId = accountId ?? null;
    const savedAccountName = String(
      (accountList || []).find((a) => String(a?.account_id) === String(savedAccountId))?.account_name || ""
    ).trim();
    const resolvedType = typeValue ?? selectedType;
    return {
      idx: selectedEvent?.extendedProps?.idx || null,
      content: buildScheduleContent(resolvedType, savedAccountName, cleanInputValue, selectedDeptType),
      start_date: normalizeYmd(selectedDate),
      end_date: normalizeYmd(selectedEndDate || selectedDate),
      type: resolvedType,
      user_id: loginUserId,
      user_ids: selectedMemberIds.join(","),
      account_id: savedAccountId,
      department: deptTypeToDepartmentCode(selectedDeptType),
      reg_dt: normalizeYmd(selectedEvent?.extendedProps?.reg_dt || dayjs().format("YYYY-MM-DD")),
      del_yn,
      reg_user_id: loginUserId,
    };
  };

  // 일정 저장 (신규: 거래처 × 이슈 조합 수만큼 insert, 수정: 1건 update)
  const handleSave = async () => {
    const cleanInputValue = stripSchedulePrefix(inputValue);
    if (!cleanInputValue) { Swal.fire("경고", "내용을 입력하세요.", "warning"); return; }
    if (!selectedDeptType) { Swal.fire("경고", "팀구분을 선택하세요.", "warning"); return; }
    try {
      const teamCode = deptTypeToTeamCode(selectedDeptType);
      if (selectedEvent) {
        // 수정: 기존 row 1건 업데이트 (첫 번째 거래처, 첫 번째 이슈 사용)
        const accId = selectedAccounts[0]?.account_id ?? selectedEvent?.extendedProps?.account_id ?? null;
        const typeVal = selectedTypes[0] ?? selectedType;
        const response = await api.post(SAVE_URL, { ...buildPayload("N", accId, typeVal), team_code: teamCode }, { headers: { "Content-Type": "application/json" } });
        if (response.data.code === 200) { Swal.fire("저장 완료", "일정이 저장되었습니다.", "success"); eventList(); }
        else Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
      } else {
        // 신규: 거래처 × 이슈 조합 수만큼 insert
        const accountsToSave = selectedAccounts.length > 0 ? selectedAccounts : [{ account_id: null }];
        const typesToSave = selectedTypes.length > 0 ? selectedTypes : ["1"];
        const combinations = typesToSave.flatMap((typeVal) =>
          accountsToSave.map((acc) => ({ accountId: acc.account_id ?? null, typeVal }))
        );
        const responses = await Promise.all(
          combinations.map(({ accountId, typeVal }) =>
            api.post(SAVE_URL, { ...buildPayload("N", accountId, typeVal), team_code: teamCode }, { headers: { "Content-Type": "application/json" } })
          )
        );
        const allSuccess = responses.every((r) => r.data.code === 200);
        if (allSuccess) { Swal.fire("저장 완료", "일정이 저장되었습니다.", "success"); eventList(); }
        else Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("실패", "서버 연결에 실패했습니다.", "error");
    }
    setOpen(false);
  };

  // 일정 취소 (del_yn = "Y")
  const handleCancelEvent = () => {
    if (!selectedEvent) return;
    Swal.fire({
      title: "일정 취소", text: "해당 일정을 취소하시겠습니까?", icon: "warning",
      showCancelButton: true, confirmButtonColor: "#d33", cancelButtonColor: "#3085d6",
      confirmButtonText: "네, 취소할게요", cancelButtonText: "아니요",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        const existingAccId = selectedEvent?.extendedProps?.account_id ?? null;
        const typeVal = selectedTypes[0] ?? selectedType;
        const response = await api.post(SAVE_URL, { ...buildPayload("Y", existingAccId, typeVal), team_code: deptTypeToTeamCode(selectedDeptType) }, { headers: { "Content-Type": "application/json" } });
        if (response.data.code === 200) { Swal.fire("취소 완료", "일정이 취소되었습니다.", "success"); eventList(); }
        else Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
      } catch (error) { console.error(error); Swal.fire("실패", "서버 연결에 실패했습니다.", "error"); }
      setOpen(false);
    });
  };

  if (loading) return <LoadingScreen />;

  const currentTypeOptions = getTypeOptions(selectedDeptType);

  // MUI 입력 높이 고정용 공통 sx
  const ctrlSx = {
    "& .MuiOutlinedInput-root": {
      height: CTRL_HEIGHT,
      minHeight: CTRL_HEIGHT,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(0,0,0,0.42)",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(0,0,0,0.62)",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#1976d2",
    },
    "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(0,0,0,0.12)",
    },
    "& .MuiSelect-select": {
      lineHeight: `${CTRL_HEIGHT}px`,
      paddingTop: "0 !important",
      paddingBottom: "0 !important",
    },
  };

  const autocompleteBorderSx = {
    "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(0,0,0,0.42)",
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(0,0,0,0.62)",
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#1976d2",
    },
    "& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(0,0,0,0.12)",
    },
  };

  return (
    <>
      {/* 월 이동 버튼 */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2, mb: 1 }}>
        <Button
          variant="contained"
          sx={{ bgcolor: "#e8a500", color: "#ffffff", "&:hover": { bgcolor: "#e8a500", color: "#ffffff" } }}
          onClick={() => {
            const newDate = displayDate.subtract(1, "month");
            onYearChange(newDate.year());
            onMonthChange(newDate.month() + 1);
          }}
        >
          ◀ 이전달
        </Button>
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          {displayDate.format("YYYY년 M월")}
        </Typography>
        <Button
          variant="contained"
          sx={{ color: "#ffffff" }}
          onClick={() => {
            const newDate = displayDate.add(1, "month");
            onYearChange(newDate.year());
            onMonthChange(newDate.month() + 1);
          }}
        >
          다음달 ▶
        </Button>
      </Box>

      {/* 캘린더 */}
      <FullCalendar
        key={`${currentYear}-${currentMonth}`}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="ko"
        headerToolbar={false}
        initialDate={displayDate.toDate()}
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        selectable={true}
        selectMirror={true}
        select={handleSelectRange}
        eventColor="#F2921D"
        eventTextColor="#fff"
        height="80vh"
        dayMaxEventRows={5}
        fixedWeeks={false}
        datesSet={() => {
          // 다른 달 행(모두 fc-day-other)은 숨김 처리
          document.querySelectorAll(".fc-daygrid-body tbody tr").forEach((row) => {
            const cells = row.querySelectorAll("td.fc-daygrid-day");
            const allOther = cells.length === 7 && [...cells].every((td) => td.classList.contains("fc-day-other"));
            row.style.display = allOther ? "none" : "";
          });
        }}
        eventContent={(arg) => {
          const isCanceled = arg.event.extendedProps?.isCanceled;
          const mainUserName = String(arg.event.extendedProps?.user_name || "").trim();
          const userNamesStr = String(arg.event.extendedProps?.user_names || "").trim();
          const companionNames = userNamesStr
            ? userNamesStr.split(",").map((n) => n.trim()).filter((n) => n && n !== mainUserName)
            : [];
          const deptType = arg.event.extendedProps?.dept_type;
          const typeLabel = getTypeLabel(arg.event.extendedProps?.type, deptType);
          const accountName = resolveAccountName(arg.event.extendedProps || {}, accountList);
          const deptLabel = arg.event.extendedProps?.dept_label || "";
          const badgeLabel = typeLabel
            ? `[${typeLabel}${accountName ? ` - ${accountName}` : ""}]`
            : accountName ? `[${accountName}]` : "";
          const baseTitle = stripSchedulePrefix(arg.event.title);
          return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "0 2px", color: "#fff", opacity: isCanceled ? 0.7 : 1 }}>
              <div style={{ fontSize: "10px", textAlign: "center", width: "100%", overflow: "visible", textOverflow: "clip", whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere", textDecoration: isCanceled ? "line-through" : "none", lineHeight: 1.2 }}>
                {deptLabel && <span style={{ marginRight: 2, opacity: 0.85 }}>[{deptLabel}]</span>}
                {badgeLabel && <span style={{ marginRight: 2 }}>{badgeLabel} </span>}
                {baseTitle}
                {companionNames.length > 0 && (
                  <span style={{ marginLeft: 2 }}>(동행+{companionNames.join(", ")})</span>
                )}
                {mainUserName && <span style={{ marginLeft: 2 }}>({mainUserName})</span>}
              </div>
            </div>
          );
        }}
      />

      {/* 일정 등록/수정 모달 */}
      <Modal open={open} onClose={handleClose}>
        <Box sx={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: isMobile ? "92vw" : 740, maxWidth: "92vw",
          maxHeight: isMobile ? "90vh" : "auto",
          bgcolor: "background.paper", borderRadius: 2, boxShadow: 24,
          p: isMobile ? 2 : 4, overflowY: isMobile ? "auto" : "visible",
        }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1.5 }}>
            {selectedDate && (selectedEndDate && selectedEndDate !== selectedDate
              ? `${dayjs(selectedDate).format("YYYY년 MM월 DD일")} ~ ${dayjs(selectedEndDate).format("YYYY년 MM월 DD일")}`
              : dayjs(selectedDate).format("YYYY년 MM월 DD일"))}
          </Typography>

          {/* 1행: 팀구분 / 담당자 / 구분 / 거래처 */}
          <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 1, mb: 1 }}>

            {/* 팀구분 */}
            <Select
              size="small"
              value={selectedDeptType}
              onChange={(e) => handleDeptTypeChange(e.target.value)}
              displayEmpty
              disabled={!!selectedEvent}
              sx={{
                width: isMobile ? "100%" : 140, flexShrink: 0, ...ctrlSx,
                ...(selectedEvent ? {
                  "&.Mui-disabled .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(0,0,0,0.12)" },
                  "& .MuiSelect-select.Mui-disabled": { WebkitTextFillColor: "rgba(0,0,0,0.87)" },
                  "& .MuiSvgIcon-root.Mui-disabled": { display: "none" },
                } : {}),
              }}
            >
              <MenuItem value=""><em>팀 구분</em></MenuItem>
              {DEPARTMENT_OPTIONS.map((dept) => (
                <MenuItem key={dept.value} value={dept.value}>{dept.label}</MenuItem>
              ))}
            </Select>

            {/* 담당자 (다중 선택, 최대 5명) */}
            <Select
              multiple
              size="small"
              value={selectedMemberIds}
              onChange={(e) => {
                const newIds = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                const withLogin = loginUserId && !newIds.includes(loginUserId)
                  ? [loginUserId, ...newIds]
                  : newIds;
                if (withLogin.length <= 5) setSelectedMemberIds(withLogin);
              }}
              displayEmpty
              disabled={memberList.length === 0}
              renderValue={() => {
                if (memberList.length === 0) return <span style={{ color: "rgba(0,0,0,0.4)" }}>담당자 선택</span>;
                const firstId = selectedMemberIds[0];
                if (!firstId) return <span style={{ color: "rgba(0,0,0,0.4)" }}>담당자 선택</span>;
                const found = memberList.find((m) => String(m.user_id) === String(firstId));
                return found ? found.user_name : <span style={{ color: "rgba(0,0,0,0.4)" }}>담당자 선택</span>;
              }}
              sx={{ width: isMobile ? "100%" : 150, flexShrink: 0, ...ctrlSx }}
            >
              {memberList.map((member) => {
                const isLoginUser = member.user_id === loginUserId;
                const isChecked = selectedMemberIds.includes(member.user_id);
                const isDisabled = isLoginUser || (!isChecked && selectedMemberIds.length >= 5);
                return (
                  <MenuItem
                    key={member.user_id}
                    value={member.user_id}
                    disabled={isDisabled}
                    sx={{ bgcolor: isLoginUser ? "#e0e0e0 !important" : "transparent", "&.Mui-disabled": { opacity: 1 } }}
                  >
                    <Checkbox checked={isChecked} size="small" sx={{ p: 0.5, mr: 0.5 }} />
                    {member.user_name} [{getPositionLabel(member.position)}]
                  </MenuItem>
                );
              })}
            </Select>

            {/* 이슈(구분) - 수정: 단일 Select / 신규: 다중 Autocomplete (최대 3개) */}
            {selectedEvent ? (
              <Select
                size="small"
                value={selectedTypes[0] || selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setSelectedTypes([e.target.value]); }}
                disabled={!selectedDeptType}
                sx={{ width: isMobile ? "100%" : 120, flexShrink: 0, ...ctrlSx }}
              >
                {currentTypeOptions.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, bgcolor: getTypeColor(type.value, selectedDeptType) }} />
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            ) : (
              <Autocomplete
                multiple
                size="small"
                disabled={!selectedDeptType}
                options={currentTypeOptions}
                value={currentTypeOptions.filter((opt) => selectedTypes.includes(opt.value))}
                onChange={(_, newValue) => {
                  if (newValue.length <= 3) setSelectedTypes(newValue.map((v) => v.value));
                }}
                getOptionLabel={(option) => option?.label || ""}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                disableCloseOnSelect
                renderOption={(props, option, { selected }) => (
                  <li {...props}>
                    <Checkbox size="small" checked={selected} sx={{ mr: 1, p: 0 }} />
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, bgcolor: getTypeColor(option.value, selectedDeptType), mr: 0.5 }} />
                    {option.label}
                  </li>
                )}
                sx={{
                  width: isMobile ? "100%" : 160,
                  flexShrink: 0,
                  ...autocompleteBorderSx,
                  "& .MuiOutlinedInput-root": { minHeight: CTRL_HEIGHT, paddingTop: "2px !important", paddingBottom: "2px !important" },
                  "& .MuiAutocomplete-input": { height: "0 !important", minWidth: "0 !important", padding: "0 !important", flex: "0 0 0px", overflow: "hidden" },
                  "& .MuiChip-root": { bgcolor: "#e3f2fd", color: "#1565c0", height: 22, fontSize: "0.72rem" },
                  "& .MuiChip-deleteIcon": { color: "#1565c0", fontSize: "14px" },
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder={selectedTypes.length === 0 ? "이슈 선택" : ""} size="small" />
                )}
              />
            )}

            {/* 거래처 - 수정: 단일 선택 / 신규: 다중 선택 */}
            {selectedEvent ? (
              /* 수정 모달: 단일 Autocomplete */
              <Autocomplete
                size="small"
                options={accountList}
                value={selectedAccounts[0] ?? null}
                onChange={(_, newValue) => setSelectedAccounts(newValue ? [newValue] : [])}
                getOptionLabel={(option) => option?.account_name || ""}
                isOptionEqualToValue={(option, value) =>
                  String(option?.account_id ?? "") === String(value?.account_id ?? "")
                }
                filterOptions={(options, { inputValue: kw }) => {
                  const k = String(kw || "").trim().toLowerCase();
                  if (!k) return options;
                  return options.filter((o) => String(o?.account_name || "").toLowerCase().includes(k));
                }}
                sx={{
                  flex: 1,
                  minWidth: isMobile ? "100%" : 160,
                  ...autocompleteBorderSx,
                  "& .MuiOutlinedInput-root": { height: CTRL_HEIGHT, minHeight: CTRL_HEIGHT, paddingTop: "0 !important", paddingBottom: "0 !important" },
                  "& .MuiOutlinedInput-input": { height: `${CTRL_HEIGHT}px`, boxSizing: "border-box", caretColor: "transparent" },
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder="거래처 (선택사항)" size="small" />
                )}
              />
            ) : (
              /* 신규 모달: 다중 Autocomplete (최대 5개) */
              <Autocomplete
                multiple
                size="small"
                options={accountList}
                value={selectedAccounts}
                onChange={(_, newValue) => { if (newValue.length <= 5) setSelectedAccounts(newValue); }}
                getOptionLabel={(option) => option?.account_name || ""}
                isOptionEqualToValue={(option, value) =>
                  String(option?.account_id ?? "") === String(value?.account_id ?? "")
                }
                disableCloseOnSelect
                filterOptions={(options, { inputValue: kw }) => {
                  const k = String(kw || "").trim().toLowerCase();
                  if (!k) return options;
                  return options.filter((o) => String(o?.account_name || "").toLowerCase().includes(k));
                }}
                renderOption={(props, option, { selected }) => (
                  <li {...props}>
                    <Checkbox size="small" checked={selected} sx={{ mr: 1, p: 0 }} />
                    {option.account_name}
                  </li>
                )}
                sx={{
                  flex: 1,
                  minWidth: isMobile ? "100%" : 160,
                  ...autocompleteBorderSx,
                  "& .MuiOutlinedInput-root": { minHeight: CTRL_HEIGHT, paddingTop: "2px !important", paddingBottom: "2px !important" },
                  "& .MuiAutocomplete-input": { height: "0 !important", minWidth: "0 !important", padding: "0 !important", flex: "0 0 0px", overflow: "hidden" },
                  "& .MuiChip-root": { bgcolor: "#e3f2fd", color: "#1565c0", height: 22, fontSize: "0.72rem" },
                  "& .MuiChip-deleteIcon": { color: "#1565c0", fontSize: "14px" },
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder={selectedAccounts.length === 0 ? "거래처 선택 (최대 5개)" : ""} size="small" />
                )}
              />
            )}
          </Box>

          {/* 내용 입력 */}
          <textarea
            placeholder="내용 입력"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            rows={isMobile ? 5 : 7}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "10px 14px",
              fontSize: "0.875rem",
              fontFamily: "inherit",
              border: "1px solid rgba(0,0,0,0.23)",
              borderRadius: "4px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />

          {/* 버튼 행 */}
          <Box sx={{
            mt: 2.5, display: "flex",
            justifyContent: isMobile ? "stretch" : "flex-end",
            flexWrap: isMobile ? "wrap" : "nowrap", gap: 1.5,
            "& .MuiButton-root": isMobile ? { flex: "1 1 calc(50% - 6px)", minWidth: 0 } : {},
          }}>
            {selectedEvent && (
              <Button variant="contained" sx={{ bgcolor: "#FF0066", color: "#ffffff" }} onClick={handleCancelEvent}>취소</Button>
            )}
            <Button variant="contained" sx={{ bgcolor: "#e8a500", color: "#ffffff", "&:hover": { bgcolor: "#e8a500", color: "#ffffff" } }} onClick={handleClose}>닫기</Button>
            <Button variant="contained" sx={{ color: "#ffffff" }} onClick={handleSave}>저장</Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

HeadofficeScheduleSheetTab.propTypes = {
  year: PropTypes.number,
  month: PropTypes.number,
  onYearChange: PropTypes.func,
  onMonthChange: PropTypes.func,
};

export default HeadofficeScheduleSheetTab;
