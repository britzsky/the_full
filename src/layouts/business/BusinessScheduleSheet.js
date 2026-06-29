import React, { useState, useEffect } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
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

import useBusinessSchedulesheetData from "./data/BusinessScheduleSheetData";
import "./fullcalendar-custom.css";
import LoadingScreen from "../loading/loadingscreen";

const CTRL_HEIGHT = 38;

const getTypeColor = (type) => {
  const t = String(type);
  switch (t) {
    case "1": return "#FF5F00";
    case "2": return "#0046FF";
    case "3": return "#527853";
    case "4": return "#F266AB";
    case "5": return "#A459D1";
    case "6": return "#D71313";
    case "7": return "#364F6B";
    case "8": return "#1A0841";
    case "9": return "#1A0841";
    case "10": return "#1A0841";
    default: return "#F2921D";
  }
};

const TYPE_OPTIONS = [
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

const getTypeLabel = (typeValue) => {
  const v = String(typeValue ?? "");
  const found = TYPE_OPTIONS.find((t) => t.value === v);
  return found ? found.label : "";
};
const stripSchedulePrefix = (text) => String(text || "").replace(/^\[[^\]]*\]\s*/, "").trim();
const buildScheduleContent = (typeValue, accountName, rawContent) => {
  const typeLabel = getTypeLabel(typeValue);
  const cleanContent = stripSchedulePrefix(rawContent);
  const cleanAccountName = String(accountName || "").trim();
  const badge = typeLabel
    ? `[${typeLabel}${cleanAccountName ? ` - ${cleanAccountName}` : ""}]`
    : cleanAccountName
      ? `[${cleanAccountName}]`
      : "";
  return `${badge}${badge && cleanContent ? " " : ""}${cleanContent}`.trim();
};

const POSITION_LABEL = { 0: "대표", 1: "팀장", 2: "파트장", 3: "매니저", 8: "영양사" };
const getPositionLabel = (pos) => POSITION_LABEL[Number(pos)] ?? "직급없음";
const normalizeYmd = (value) => {
  const d = dayjs(value);
  return d.isValid() ? d.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
};
const resolveAccountName = (item, accounts) => {
  const fromRow = String(item?.account_name || "").trim();
  if (fromRow) return fromRow;
  const accountId = String(item?.account_id || "").trim();
  if (!accountId) return "";
  const found = (accounts || []).find((a) => String(a?.account_id || "") === accountId);
  return String(found?.account_name || "").trim();
};

function BusinessScheduleSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);
  const { eventListRows, eventList, loading } = useBusinessSchedulesheetData(currentYear, currentMonth);

  const [displayDate, setDisplayDate] = useState(dayjs());
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventClicked, setIsEventClicked] = useState(false);

  const [selectedType, setSelectedType] = useState("1");
  const [businessMemberList, setBusinessMemberList] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  // 거래처
  const [accountList, setAccountList] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const fetchBusinessMemberList = async () => {
    try {
      if (businessMemberList.length > 0) return businessMemberList;
      const res = await api.get("/Business/BusinessMemberList", {
        params: { team_code: 1 },
        headers: { "Content-Type": "application/json" },
      });
      const rows = res.data || [];
      setBusinessMemberList(rows);
      return rows;
    } catch (error) {
      console.error("BusinessMemberList 조회 실패:", error);
      Swal.fire("실패", "담당자 목록을 가져오지 못했습니다.", "error");
      return [];
    }
  };

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

  const [holidayMap, setHolidayMap] = useState(new Map());
  useEffect(() => {
    if (!currentYear || !currentMonth) return;
    api.get("/Operate/HolidayList", { params: { year: currentYear, month: currentMonth } })
      .then((res) => {
        const map = new Map();
        (Array.isArray(res.data) ? res.data : []).forEach((h) =>
          map.set(String(h.holiday_date), String(h.holiday_name || "공휴일"))
        );
        setHolidayMap(map);
      })
      .catch(() => setHolidayMap(new Map()));
  }, [currentYear, currentMonth]);

  useEffect(() => { eventList(); }, []);
  useEffect(() => { if (currentYear && currentMonth) eventList(); }, [currentYear, currentMonth]);
  // 달력 배지에 거래처명을 안정적으로 표시하기 위해 거래처 목록을 미리 로딩
  useEffect(() => { fetchAccountList(); }, []);

  useEffect(() => {
    const mapped = eventListRows
      .filter((item) => {
        const date = dayjs(item.start_date);
        return date.year() === currentYear && date.month() + 1 === currentMonth;
      })
      .map((item) => {
        const bgColor = getTypeColor(item.type);
        const isCanceled = item.del_yn === "Y";
        const accountName = resolveAccountName(item, accountList);
        return {
          idx: item.idx,
          user_id: item.user_id,
          title: item.content || "내용 없음",
          start: dayjs(item.start_date).format("YYYY-MM-DD"),
          end: dayjs(item.end_date || item.start_date).add(1, "day").format("YYYY-MM-DD"),
          backgroundColor: bgColor,
          textColor: "#fff",
          extendedProps: { ...item, account_name: accountName, isCanceled },
        };
      });
    setEvents(mapped);
  }, [eventListRows, currentYear, currentMonth, accountList]);

  const handleDateClick = async (arg) => {
    if (isEventClicked) { setIsEventClicked(false); return; }
    setSelectedDate(arg.dateStr);
    setSelectedEndDate(arg.dateStr);
    setSelectedEvent(null);
    setInputValue("");
    setSelectedType("1");
    setSelectedMemberId("");
    setSelectedAccount(null);
    await Promise.all([fetchBusinessMemberList(), fetchAccountList()]);
    setOpen(true);
  };

  const handleSelectRange = async (info) => {
    const start = dayjs(info.start).format("YYYY-MM-DD");
    const end = dayjs(info.end).subtract(1, "day").format("YYYY-MM-DD");
    setSelectedDate(start);
    setSelectedEndDate(end);
    setSelectedEvent(null);
    setInputValue("");
    setSelectedType("1");
    setSelectedMemberId("");
    setSelectedAccount(null);
    await Promise.all([fetchBusinessMemberList(), fetchAccountList()]);
    setOpen(true);
  };

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
    const [, fetchedAccounts] = await Promise.all([fetchBusinessMemberList(), fetchAccountList()]);
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

  const handleSave = async () => {
    const cleanInputValue = stripSchedulePrefix(inputValue);
    if (!cleanInputValue) { Swal.fire("경고", "내용을 입력하세요.", "warning"); return; }
    if (!selectedMemberId) { Swal.fire("경고", "담당자를 선택하세요.", "warning"); return; }
    const savedAccountId =
      selectedAccount?.account_id ?? selectedEvent?.extendedProps?.account_id ?? null;
    const savedAccountName =
      String(selectedAccount?.account_name || "").trim()
      || String(selectedEvent?.extendedProps?.account_name || "").trim()
      || String((accountList || []).find((a) => String(a?.account_id) === String(savedAccountId))?.account_name || "").trim();
    const savedContent = buildScheduleContent(selectedType, savedAccountName, cleanInputValue);
    const savedRegDt = normalizeYmd(
      selectedEvent?.extendedProps?.reg_dt || dayjs().format("YYYY-MM-DD")
    );
    const newEvent = {
      idx: selectedEvent?.extendedProps?.idx || null,
      content: savedContent,
      start_date: normalizeYmd(selectedDate),
      end_date: normalizeYmd(selectedEndDate || selectedDate),
      type: selectedType,
      user_id: selectedMemberId,
      account_id: savedAccountId,
      reg_dt: savedRegDt,
      del_yn: "N",
      team_code: 1,
      reg_user_id: localStorage.getItem("user_id"),
    };
    try {
      const response = await api.post("/Business/BusinessScheduleSave", newEvent, {
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

  const handleCancelEvent = () => {
    if (!selectedEvent) return;
    Swal.fire({
      title: "일정 취소", text: "해당 일정을 취소하시겠습니까?", icon: "warning",
      showCancelButton: true, confirmButtonColor: "#d33", cancelButtonColor: "#3085d6",
      confirmButtonText: "네, 취소할게요", cancelButtonText: "아니요",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const cancelAccountId =
        selectedAccount?.account_id ?? selectedEvent?.extendedProps?.account_id ?? null;
      const cancelAccountName =
        String(selectedAccount?.account_name || "").trim()
          || String(selectedEvent?.extendedProps?.account_name || "").trim()
          || String((accountList || []).find((a) => String(a?.account_id) === String(cancelAccountId))?.account_name || "").trim();
      const cancelEvent = {
        idx: selectedEvent?.extendedProps?.idx || null,
        content: buildScheduleContent(
          selectedType,
          cancelAccountName,
          inputValue
        ),
        start_date: normalizeYmd(selectedDate),
        end_date: normalizeYmd(selectedEndDate || selectedDate),
        type: selectedType, user_id: selectedMemberId,
        account_id: cancelAccountId,
        reg_dt: normalizeYmd(selectedEvent?.extendedProps?.reg_dt || dayjs().format("YYYY-MM-DD")),
        del_yn: "Y", team_code: 1, reg_user_id: localStorage.getItem("user_id"),
      };
      try {
        const response = await api.post("/Business/BusinessScheduleSave", cancelEvent, { headers: { "Content-Type": "application/json" } });
        if (response.data.code === 200) { Swal.fire("취소 완료", "일정이 취소되었습니다.", "success"); eventList(); }
        else Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
      } catch (error) { console.error(error); Swal.fire("실패", "서버 연결에 실패했습니다.", "error"); }
      setOpen(false);
    });
  };

  const handleRestoreEvent = () => {
    if (!selectedEvent) return;
    Swal.fire({
      title: "일정 복원", text: "취소된 일정을 복원하시겠습니까?", icon: "question",
      showCancelButton: true, confirmButtonColor: "#3085d6", cancelButtonColor: "#999",
      confirmButtonText: "네, 복원할게요", cancelButtonText: "아니요",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const restoreAccountId =
        selectedAccount?.account_id ?? selectedEvent?.extendedProps?.account_id ?? null;
      const restoreAccountName =
        String(selectedAccount?.account_name || "").trim()
          || String(selectedEvent?.extendedProps?.account_name || "").trim()
          || String((accountList || []).find((a) => String(a?.account_id) === String(restoreAccountId))?.account_name || "").trim();
      const restoreEvent = {
        idx: selectedEvent?.extendedProps?.idx || null,
        content: buildScheduleContent(
          selectedType,
          restoreAccountName,
          inputValue
        ),
        start_date: normalizeYmd(selectedDate),
        end_date: normalizeYmd(selectedEndDate || selectedDate),
        type: selectedType, user_id: selectedMemberId,
        account_id: restoreAccountId,
        reg_dt: normalizeYmd(selectedEvent?.extendedProps?.reg_dt || dayjs().format("YYYY-MM-DD")),
        del_yn: "N", team_code: 1, reg_user_id: localStorage.getItem("user_id"),
      };
      try {
        const response = await api.post("/Business/BusinessScheduleSave", restoreEvent, { headers: { "Content-Type": "application/json" } });
        if (response.data.code === 200) { Swal.fire("복원 완료", "일정이 복원되었습니다.", "success"); eventList(); }
        else Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
      } catch (error) { console.error(error); Swal.fire("실패", "서버 연결에 실패했습니다.", "error"); }
      setOpen(false);
    });
  };

  if (loading) return <LoadingScreen />;

  const isSelectedCanceled = !!selectedEvent?.extendedProps?.isCanceled;

  const ctrlSx = {
    "& .MuiOutlinedInput-root": { height: CTRL_HEIGHT, minHeight: CTRL_HEIGHT },
    "& .MuiSelect-select": { display: "flex", alignItems: "center" },
  };

  return (
    <DashboardLayout>
      <DashboardNavbar title="📅 영업 일정관리 (내부 관리용)" />

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
          document.querySelectorAll(".fc-daygrid-body tbody tr").forEach((row) => {
            const cells = row.querySelectorAll("td.fc-daygrid-day");
            const allOther = cells.length === 7 && [...cells].every((td) => td.classList.contains("fc-day-other"));
            row.style.display = allOther ? "none" : "";
          });
        }}
        dayHeaderContent={(arg) => {
          const dow = arg.date.getDay();
          const color = dow === 0 ? "#c62828" : dow === 6 ? "#1565c0" : undefined;
          return <span style={color ? { color, fontWeight: 700 } : {}}>{arg.text}</span>;
        }}
        dayCellContent={(arg) => {
          const d = dayjs(arg.date);
          const key = d.format("YYYY-MM-DD");
          const isSat = d.day() === 6;
          const isSun = d.day() === 0;
          const holidayName = holidayMap.get(key);
          const isHoliday = !!holidayName;
          const color = isSun || isHoliday ? "#c62828" : isSat ? "#1565c0" : undefined;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              {holidayName && (
                <span style={{ fontSize: "10px", color: "#c62828", fontWeight: 600 }}>{holidayName}</span>
              )}
              <span style={color ? { color, fontWeight: 700 } : {}}>{arg.dayNumberText}</span>
            </div>
          );
        }}
        eventContent={(arg) => {
          const isCanceled = arg.event.extendedProps?.isCanceled;
          const userName = arg.event.extendedProps?.user_name;
          const typeLabel = getTypeLabel(arg.event.extendedProps?.type);
          const accountName = resolveAccountName(arg.event.extendedProps || {}, accountList);
          const badgeLabel = typeLabel
            ? `[${typeLabel}${accountName ? ` - ${accountName}` : ""}]`
            : accountName
              ? `[${accountName}]`
              : "";
          const baseTitle = stripSchedulePrefix(arg.event.title);
          return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 2px", color: "#fff", opacity: isCanceled ? 0.7 : 1 }}>
              <div style={{ fontSize: "10px", textAlign: "center", width: "100%", overflow: "visible", textOverflow: "clip", whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere", textDecoration: isCanceled ? "line-through" : "none", lineHeight: 1.2 }}>
                {badgeLabel && <span style={{ marginRight: 2 }}>{badgeLabel} </span>}
                {baseTitle}
                {userName && <span style={{ marginLeft: 2 }}>({userName})</span>}
              </div>
            </div>
          );
        }}
      />

      {/* 일정 입력/수정/취소/복원 모달 */}
      <Modal open={open} onClose={handleClose}>
        <Box sx={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: isMobile ? "92vw" : 540, maxWidth: "92vw",
          maxHeight: isMobile ? "90vh" : "auto",
          bgcolor: "background.paper", borderRadius: 2, boxShadow: 24,
          p: isMobile ? 2 : 4, overflowY: isMobile ? "auto" : "visible",
        }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1.5 }}>
            {selectedDate && (selectedEndDate && selectedEndDate !== selectedDate
              ? `${dayjs(selectedDate).format("YYYY년 MM월 DD일")} ~ ${dayjs(selectedEndDate).format("YYYY년 MM월 DD일")}`
              : dayjs(selectedDate).format("YYYY년 MM월 DD일"))}
          </Typography>

          {/* 1행: 구분 + 거래처 + 담당자 */}
          <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 1, mb: 1 }}>
            {/* 구분 */}
            <Select
              size="small"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              sx={{ minWidth: 130, width: isMobile ? "100%" : 130, ...ctrlSx }}
            >
              {TYPE_OPTIONS.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, bgcolor: getTypeColor(type.value) }} />
                    {type.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>

            {/* 거래처 Autocomplete */}
            <Autocomplete
              size="small"
              options={accountList}
              value={selectedAccount}
              onChange={(_, newValue) => setSelectedAccount(newValue)}
              getOptionLabel={(option) => option?.account_name || ""}
              isOptionEqualToValue={(option, value) =>
                String(option?.account_id ?? "") === String(value?.account_id ?? "")
              }
              filterOptions={(options, { inputValue }) => {
                const kw = String(inputValue || "").trim().toLowerCase();
                if (!kw) return options;
                return options.filter((o) => String(o?.account_name || "").toLowerCase().includes(kw));
              }}
              sx={{
                flex: 1,
                width: isMobile ? "100%" : undefined,
                "& .MuiOutlinedInput-root": {
                  height: CTRL_HEIGHT, minHeight: CTRL_HEIGHT,
                  paddingTop: "0 !important", paddingBottom: "0 !important",
                },
                "& .MuiOutlinedInput-input": { height: `${CTRL_HEIGHT}px`, boxSizing: "border-box" },
              }}
              renderInput={(params) => (
                <TextField {...params} placeholder="거래처 선택 (선택사항)" size="small" />
              )}
            />

            {/* 담당자 */}
            <Select
              size="small"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              displayEmpty
              sx={{ minWidth: 140, width: isMobile ? "100%" : 140, ...ctrlSx }}
            >
              <MenuItem value=""><em>담당자 선택</em></MenuItem>
              {businessMemberList.map((member) => (
                <MenuItem key={member.user_id} value={member.user_id}>
                  {member.user_name} [{getPositionLabel(member.position)}]
                </MenuItem>
              ))}
            </Select>
          </Box>

          {/* 내용 */}
          <TextField
            fullWidth
            label="내용 입력"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            multiline
            minRows={isMobile ? 5 : 7}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          {/* 버튼 */}
          <Box sx={{
            mt: 2.5, display: "flex",
            justifyContent: isMobile ? "stretch" : "flex-end",
            flexWrap: isMobile ? "wrap" : "nowrap", gap: 1.5,
            "& .MuiButton-root": isMobile ? { flex: "1 1 calc(50% - 6px)", minWidth: 0 } : {},
          }}>
            {selectedEvent && !isSelectedCanceled && (
              <Button variant="contained" sx={{ bgcolor: "#FF0066", color: "#ffffff" }} onClick={handleCancelEvent}>취소</Button>
            )}
            {selectedEvent && isSelectedCanceled && (
              <Button variant="contained" color="success" onClick={handleRestoreEvent}>복원</Button>
            )}
            <Button variant="contained" sx={{ bgcolor: "#e8a500", color: "#ffffff", "&:hover": { bgcolor: "#e8a500", color: "#ffffff" } }} onClick={handleClose}>닫기</Button>
            <Button variant="contained" sx={{ color: "#ffffff" }} onClick={handleSave}>저장</Button>
          </Box>
        </Box>
      </Modal>
    </DashboardLayout>
  );
}

export default BusinessScheduleSheet;
