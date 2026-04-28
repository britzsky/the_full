import React, { useState, useEffect } from "react";
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
  useTheme,
  useMediaQuery,
} from "@mui/material";

import useHeadofficeSchedulesheetData, { deptTypeToTeamCode } from "./HeadofficeScheduleSheetData";
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

// 팀 구분 옵션 (operate / business / catering)
const DEPARTMENT_OPTIONS = [
  { value: "operate", label: "운영팀" },
  { value: "business", label: "영업팀" },
  { value: "catering", label: "급식사업부" },
];

// dept_type에 따른 구분 옵션 반환
const getTypeOptions = (deptType) => {
  if (deptType === "business") return TYPE_OPTIONS_BUSINESS;
  if (deptType === "catering") return TYPE_OPTIONS_CATERING;
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

  // 급식사업부 — 분홍 계열
  switch (t) {
    case "1": return "#C2185B";
    case "2": return "#D81B60";
    case "3": return "#f395b5";
    case "4": return "#c25b88";
    case "5": return "#f079a0";
    case "6": return "#F06292";
    case "7": return "#F48FB1";
    case "8": return "#880E4F";
    case "9": return "#c55a85";
    case "10": return "#e0336d";
    case "11": return "#1A0841";
    case "12": return "#1A0841";
    case "13": return "#1A0841";
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

function HeadofficeScheduleSheetTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);
  const { eventListRows, eventList, loading } = useHeadofficeSchedulesheetData(currentYear, currentMonth);

  const [displayDate, setDisplayDate] = useState(dayjs());
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventClicked, setIsEventClicked] = useState(false);

  const [selectedType, setSelectedType] = useState("1");
  const [selectedDeptType, setSelectedDeptType] = useState(""); // "operate" | "business" | "catering"
  const [memberList, setMemberList] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const [accountList, setAccountList] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // team_code로 담당자 목록 조회 (단일 API)
  const fetchMemberList = async (deptType) => {
    if (!deptType) return [];
    try {
      const teamCode = deptTypeToTeamCode(deptType);
      const res = await api.get(MEMBER_LIST_URL, {
        params: { team_code: teamCode },
        headers: { "Content-Type": "application/json" },
      });
      return res.data || [];
    } catch (error) {
      console.error("담당자 목록 조회 실패:", error);
      Swal.fire("실패", "담당자 목록을 가져오지 못했습니다.", "error");
      return [];
    }
  };

  // 팀구분 변경 시 담당자 목록 갱신, 구분/담당자 초기화
  const handleDeptTypeChange = async (deptType) => {
    setSelectedDeptType(deptType);
    setSelectedMemberId("");
    setSelectedType("1");
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
    setSelectedDeptType("");
    setMemberList([]);
    setSelectedMemberId("");
    setSelectedAccount(null);
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
    setSelectedType(clickedEvent.extendedProps?.type?.toString() || "1");
    setSelectedMemberId(clickedEvent.extendedProps?.user_id?.toString() || "");

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
      setSelectedAccount(found || null);
    } else {
      setSelectedAccount(null);
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setSelectedEvent(null); };

  // 저장/취소/복원용 공통 payload 생성
  const buildPayload = (del_yn) => {
    const cleanInputValue = stripSchedulePrefix(inputValue);
    const savedAccountId = selectedAccount?.account_id ?? selectedEvent?.extendedProps?.account_id ?? null;
    const savedAccountName =
      String(selectedAccount?.account_name || "").trim()
      || String(selectedEvent?.extendedProps?.account_name || "").trim()
      || String((accountList || []).find((a) => String(a?.account_id) === String(savedAccountId))?.account_name || "").trim();
    return {
      idx: selectedEvent?.extendedProps?.idx || null,
      content: buildScheduleContent(selectedType, savedAccountName, cleanInputValue, selectedDeptType),
      start_date: normalizeYmd(selectedDate),
      end_date: normalizeYmd(selectedEndDate || selectedDate),
      type: selectedType,
      user_id: selectedMemberId,
      account_id: savedAccountId,
      reg_dt: normalizeYmd(selectedEvent?.extendedProps?.reg_dt || dayjs().format("YYYY-MM-DD")),
      del_yn,
      reg_user_id: localStorage.getItem("user_id"),
    };
  };

  // 일정 저장
  const handleSave = async () => {
    const cleanInputValue = stripSchedulePrefix(inputValue);
    if (!cleanInputValue) { Swal.fire("경고", "내용을 입력하세요.", "warning"); return; }
    if (!selectedDeptType) { Swal.fire("경고", "팀구분을 선택하세요.", "warning"); return; }
    if (!selectedMemberId) { Swal.fire("경고", "담당자를 선택하세요.", "warning"); return; }
    try {
      const response = await api.post(SAVE_URL, { ...buildPayload("N"), team_code: deptTypeToTeamCode(selectedDeptType) }, {
        headers: { "Content-Type": "application/json" },
      });
      if (response.data.code === 200) {
        Swal.fire("저장 완료", "일정이 저장되었습니다.", "success");
        eventList();
      } else {
        Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
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
        const response = await api.post(SAVE_URL, { ...buildPayload("Y"), team_code: deptTypeToTeamCode(selectedDeptType) }, { headers: { "Content-Type": "application/json" } });
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
    "& .MuiSelect-select": {
      lineHeight: `${CTRL_HEIGHT}px`,
      paddingTop: "0 !important",
      paddingBottom: "0 !important",
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
            setDisplayDate(newDate);
            setCurrentYear(newDate.year());
            setCurrentMonth(newDate.month() + 1);
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
            setDisplayDate(newDate);
            setCurrentYear(newDate.year());
            setCurrentMonth(newDate.month() + 1);
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
          const userName = arg.event.extendedProps?.user_name;
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
                {userName && <span style={{ marginLeft: 2 }}>({userName})</span>}
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
              sx={{ width: isMobile ? "100%" : 140, flexShrink: 0, ...ctrlSx }}
            >
              <MenuItem value=""><em>팀 구분</em></MenuItem>
              {DEPARTMENT_OPTIONS.map((dept) => (
                <MenuItem key={dept.value} value={dept.value}>{dept.label}</MenuItem>
              ))}
            </Select>

            {/* 담당자 */}
            <Select
              size="small"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              displayEmpty
              disabled={!selectedDeptType}
              sx={{ width: isMobile ? "100%" : 150, flexShrink: 0, ...ctrlSx }}
            >
              <MenuItem value=""><em>{selectedDeptType ? "담당자 선택" : "팀을 선택해주세요."}</em></MenuItem>
              {memberList.map((member) => (
                <MenuItem key={member.user_id} value={member.user_id}>
                  {member.user_name} [{getPositionLabel(member.position)}]
                </MenuItem>
              ))}
            </Select>

            {/* 구분 */}
            <Select
              size="small"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
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

            {/* 거래처 */}
            <Autocomplete
              size="small"
              options={accountList}
              value={selectedAccount}
              onChange={(_, newValue) => setSelectedAccount(newValue)}
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
                "& .MuiOutlinedInput-root": {
                  height: CTRL_HEIGHT, minHeight: CTRL_HEIGHT,
                  paddingTop: "0 !important", paddingBottom: "0 !important",
                },
                "& .MuiOutlinedInput-input": { height: `${CTRL_HEIGHT}px`, boxSizing: "border-box" },
              }}
              renderInput={(params) => (
                <TextField {...params} placeholder="거래처 (선택사항)" size="small" />
              )}
            />
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

export default HeadofficeScheduleSheetTab;
