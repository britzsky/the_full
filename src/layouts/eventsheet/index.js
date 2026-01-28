import React, { useState, useEffect } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import Swal from "sweetalert2";
import api from "api/api";
import { Modal, Box, Button, TextField, Typography, Select, MenuItem } from "@mui/material";

// ✅ 커스텀 훅 import
import useEventsheetData from "./data/EventSheetData";
import "./fullcalendar-custom.css";
import LoadingScreen from "../loading/loadingscreen";

function EventSheetTab() {
  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);
  const { eventListRows, eventList, loading } = useEventsheetData(currentYear, currentMonth);

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

  // ✅ 날짜 클릭 (빈칸 클릭 시 등록)
  const handleDateClick = (arg) => {
    // eventClick 후 dateClick 같이 들어오는 것 방지
    if (isEventClicked) {
      setIsEventClicked(false);
      return;
    }

    setSelectedDate(arg.dateStr);
    setSelectedEndDate(arg.dateStr); // 1일짜리 기본
    setSelectedEvent(null);

    setInputValue("");
    setSelectedType("2");
    setIsDeleteMode(false);

    setOpen(true);
  };

  // ✅ 여러 날짜 드래그로 기간 선택
  const handleSelectRange = (info) => {
    const start = dayjs(info.start).format("YYYY-MM-DD");
    const end = dayjs(info.end).subtract(1, "day").format("YYYY-MM-DD"); // end는 exclusive

    setSelectedDate(start);
    setSelectedEndDate(end);

    setSelectedEvent(null);
    setInputValue("");
    setSelectedType("2");
    setIsDeleteMode(false);

    setOpen(true);
  };

  // ✅ 이벤트 클릭 (일정 보기/수정)
  const handleEventClick = (info) => {
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

    const payload = {
      idx: selectedEvent?.extendedProps?.idx || null,
      content: inputValue,
      menu_date: selectedDate,
      end_date: selectedEndDate || selectedDate,
      type: selectedType,
      del_yn: "N",
      reg_user_id: localStorage.getItem("user_id"),
    };

    try {
      const response = await api.post("/HeadOffice/EventSave", payload, {
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

  // ✅ 삭제(confirm + del_yn='Y')
  const handleDelete = async () => {
    if (!selectedEvent) return;

    const payload = {
      idx: selectedEvent?.extendedProps?.idx || null,
      content: inputValue,
      menu_date: selectedDate,
      end_date: selectedEndDate || selectedDate,
      type: selectedType,
      del_yn: "Y",
      reg_user_id: localStorage.getItem("user_id"),
    };

    try {
      const response = await api.post("/HeadOffice/EventSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.code === 200) {
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
        dateClick={handleDateClick}
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
              {arg.event.title}
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
            width: 520,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 5,
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
          <Select
            size="small"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            sx={{ minWidth: 170, mb: 2 }}
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

          {/* 일정 내용 입력 */}
          <TextField
            fullWidth
            label="내용 입력"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            multiline
            minRows={7}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          {/* 버튼 영역 */}
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
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
