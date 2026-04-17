import React, { useState, useEffect } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import { Modal, Box, Button, TextField, Typography, Select, MenuItem, Autocomplete, useMediaQuery } from "@mui/material";

// ✅ 커스텀 훅 import
import useEventsheetData from "./data/EventSheetData";
import "./fullcalendar-custom.css";
import LoadingScreen from "../loading/loadingscreen";

function EventSheetTab() {
  const isMobileTablet = useMediaQuery("(max-width:1279.95px)");
  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);
  const { eventListRows, eventList, loading, accountList, fetchAccountList, saveEvent, deleteEvent } = useEventsheetData(currentYear, currentMonth);

  const [displayDate, setDisplayDate] = useState(dayjs());
  const [events, setEvents] = useState([]);

  const [open, setOpen] = useState(false);

  // ✅ 기간 선택
  const [selectedDate, setSelectedDate] = useState(null); // 시작일
  const [selectedEndDate, setSelectedEndDate] = useState(null); // 종료일

  const [inputValue, setInputValue] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null); // 기존 일정 추적
  const [isDeleteMode, setIsDeleteMode] = useState(false); // 삭제모드 구분
  const [selectedType, setSelectedType] = useState("2"); // 기본값: 본사행사
  const [isEventClicked, setIsEventClicked] = useState(false);

  // 거래처
  const [selectedAccount, setSelectedAccount] = useState(null);

  // ✅ type별 색상
  const getTypeColor = (type) => {
    const t = String(type);
    if (t === "2") return "#007BFF"; // 본사행사
    if (t === "3") return "#2ECC71"; // 외부행사
    return "#F2921D"; // 기타
  };


  // ✅ 1. 초기 조회
  useEffect(() => {
    eventList();
    fetchAccountList(accountList);
  }, []);

  // ✅ 2. 월 변경 시 자동 조회
  useEffect(() => {
    if (currentYear && currentMonth) {
      eventList();
    }
  }, [currentYear, currentMonth]);

  // ✅ 3. 서버 데이터 → FullCalendar 이벤트 변환
  useEffect(() => {
    const mapped = (eventListRows || [])
      .filter((item) => {
        // ✅ menu_date 기준 월 필터 (기간 이벤트라도 start가 속한 달에서 보이게)
        const date = dayjs(item.menu_date || item.menu_date);
        return date.year() === currentYear && date.month() + 1 === currentMonth;
      })
      .map((item) => {
        const bgColor = getTypeColor(item.type);

        const start = dayjs(item.menu_date || item.menu_date).format("YYYY-MM-DD");
        const realEnd = item.end_date || item.menu_date || item.menu_date || start;

        return {
          idx: item.idx,
          user_id: item.user_id,
          title: item.content || "내용 없음",
          start,
          // 🔥 FullCalendar allDay 이벤트는 end가 exclusive라서 +1일 처리
          end: dayjs(realEnd).add(1, "day").format("YYYY-MM-DD"),
          backgroundColor: bgColor,
          textColor: "#fff",
          extendedProps: { ...item },
        };
      });

    setEvents(mapped);
  }, [eventListRows, currentYear, currentMonth]);

  // 날짜 클릭/드래그 (단일 클릭도 select로 처리 - end_date 일관성 보장)
  const handleSelectRange = async (info) => {
    if (isEventClicked) { setIsEventClicked(false); return; }
    const start = dayjs(info.start).format("YYYY-MM-DD");
    const end = dayjs(info.end).subtract(1, "day").format("YYYY-MM-DD"); // end는 exclusive

    setSelectedDate(start);
    setSelectedEndDate(end); // 단일 클릭 시 start==end, 드래그 시 범위

    setSelectedEvent(null);
    setInputValue("");
    setSelectedType("2");
    setIsDeleteMode(false);
    setSelectedAccount(null);
    await fetchAccountList(accountList);

    setOpen(true);
  };

  // ✅ 이벤트 클릭 (일정 보기/수정)
  const handleEventClick = async (info) => {
    setIsEventClicked(true);

    const clickedEvent = info.event;

    // ✅ 서버 원본값 우선
    let start = clickedEvent.extendedProps?.menu_date;
    let end = clickedEvent.extendedProps?.end_date;

    // fallback
    if (!start) start = dayjs(clickedEvent.start).format("YYYY-MM-DD");
    if (!end) {
      if (clickedEvent.end) {
        end = dayjs(clickedEvent.end).subtract(1, "day").format("YYYY-MM-DD");
      } else {
        end = start;
      }
    }

    setSelectedDate(start);
    setSelectedEndDate(end);

    setSelectedEvent(clickedEvent);
    setInputValue(clickedEvent.title);

    setSelectedType(clickedEvent.extendedProps?.type?.toString() || "2");
    setIsDeleteMode(false);

    const fetchedAccounts = await fetchAccountList(accountList);
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

  // ✅ 모달 닫기
  const handleClose = () => {
    setOpen(false);
    setSelectedEvent(null);
    setIsDeleteMode(false);
  };

  // ✅ 저장 (등록/수정)
  const handleSave = async () => {
    if (!inputValue.trim() && !isDeleteMode) {
      Swal.fire("경고", "내용을 입력하세요.", "warning");
      return;
    }

    if (!selectedDate) {
      Swal.fire("경고", "날짜를 선택하세요.", "warning");
      return;
    }

    try {
      const result = await saveEvent({ inputValue, selectedDate, selectedEndDate, selectedType, selectedAccount, selectedEvent });
      if (result.code === 200) {
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

  // ✅ 삭제(confirm + del_yn='Y')
  const handleDelete = async () => {
    if (!selectedEvent) return;

    try {
      const result = await deleteEvent({ inputValue, selectedDate, selectedEndDate, selectedType, selectedAccount, selectedEvent });
      if (result.code === 200) {
        Swal.fire("삭제 완료", "일정이 삭제되었습니다.", "success");
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

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <DashboardNavbar title="🎉 행사 달력 (내부 관리용)" />
      {loading && <Typography sx={{ mt: 2 }}>⏳ 데이터 불러오는 중...</Typography>}

      {/* ✅ 커스텀 헤더 */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mt: 2,
          mb: 1,
        }}
      >
        <Button
          variant="contained"
          sx={{
            bgcolor: "#e8a500",
            color: "#ffffff",
            "&:hover": { bgcolor: "#e8a500", color: "#ffffff" },
          }}
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
        eventClick={handleEventClick}
        selectable={true}
        selectMirror={true}
        select={handleSelectRange}
        eventColor="#F2921D"
        eventTextColor="#fff"
        height="80vh"
        dayMaxEventRows={5}
        eventContent={(arg) => (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "0 2px",
              color: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                textAlign: "center",
                width: "100%",
                overflow: "visible",
                textOverflow: "clip",
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                lineHeight: 1.2,
              }}
            >
              {(() => {
                const accId = arg.event.extendedProps?.account_id;
                const accName = accId
                  ? String((accountList.find((a) => String(a.account_id) === String(accId))?.account_name) || "").trim()
                  : "";
                return accName ? `[${accName}] ${arg.event.title}` : arg.event.title;
              })()}
            </div>
          </div>
        )}
      />

      {/* ✅ 일정 입력/수정/삭제 모달 */}
      <Modal open={open} onClose={handleClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobileTablet ? "calc(100vw - 24px)" : 520,
            maxWidth: 520,
            maxHeight: isMobileTablet ? "calc(100dvh - 24px)" : "none",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: isMobileTablet ? 2 : 5,
            overflowY: isMobileTablet ? "auto" : "visible",
          }}
        >
          {/* 상단 날짜 */}
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
            {selectedDate &&
              (selectedEndDate && selectedEndDate !== selectedDate
                ? `${dayjs(selectedDate).format("YYYY년 MM월 DD일")} ~ ${dayjs(
                    selectedEndDate
                  ).format("YYYY년 MM월 DD일")}`
                : dayjs(selectedDate).format("YYYY년 MM월 DD일"))}
          </Typography>

          {/* 행사 유형 선택 */}
          <Box sx={{ display: "flex", flexDirection: isMobileTablet ? "column" : "row", gap: 1, mb: 2 }}>
            <Select
              size="small"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              sx={{ minWidth: 170, width: isMobileTablet ? "100%" : "auto", height: 38, "& .MuiOutlinedInput-root": { height: 38 } }}
            >
              <MenuItem value="2">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#007BFF" }} />
                  본사행사
                </Box>
              </MenuItem>
              <MenuItem value="3">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#2ECC71" }} />
                  외부행사
                </Box>
              </MenuItem>
            </Select>

            {/* 외부행사일 때만 거래처 입력 */}
            {selectedType === "3" && (
              <Autocomplete
                size="small"
                options={accountList}
                value={selectedAccount}
                onChange={(_, newValue) => setSelectedAccount(newValue)}
                autoHighlight
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
                  width: isMobileTablet ? "100%" : undefined,
                  "& .MuiOutlinedInput-root": { height: 38, paddingTop: "0 !important", paddingBottom: "0 !important" },
                  "& .MuiOutlinedInput-input": { height: "38px", boxSizing: "border-box" },
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder="거래처 선택 (선택사항)" size="small" />
                )}
              />
            )}
          </Box>

          {/* 일정 내용 입력 */}
          <TextField
            fullWidth
            label="내용 입력"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            multiline
            minRows={isMobileTablet ? 5 : 7}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          {/* 버튼 영역 */}
          <Box
            sx={{
              mt: 3,
              display: "flex",
              justifyContent: isMobileTablet ? "stretch" : "flex-end",
              gap: 1.5,
              flexWrap: isMobileTablet ? "wrap" : "nowrap",
              "& .MuiButton-root": isMobileTablet ? { flex: "1 1 30%" } : {},
            }}
          >
            {selectedEvent && (
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  setIsDeleteMode(true);
                  handleDelete();
                }}
              >
                삭제
              </Button>
            )}

            <Button
              variant="contained"
              sx={{
                bgcolor: "#e8a500",
                color: "#ffffff",
                "&:hover": { bgcolor: "#e8a500", color: "#ffffff" },
              }}
              onClick={handleClose}
            >
              닫기
            </Button>

            <Button variant="contained" sx={{ color: "#ffffff" }} onClick={handleSave}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </DashboardLayout>
  );
}

export default EventSheetTab;
