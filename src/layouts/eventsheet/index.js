import React, { useState, useEffect } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
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
  MenuItem
} from "@mui/material";

// ✅ 커스텀 훅 import
import useEventsheetData from "./data/eventsheetData";
import "./fullcalendar-custom.css";
import LoadingScreen from "../loading/loadingscreen";

function EventSheetTab() {
  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);
  const { eventListRows, eventList, loading } =
    useEventsheetData(currentYear, currentMonth);

  const [displayDate, setDisplayDate] = useState(dayjs());
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null); // ✅ 기존 일정 추적
  const [isDeleteMode, setIsDeleteMode] = useState(false); // ✅ 삭제모드 구분
  const [selectedType, setSelectedType] = useState("2"); // 기본값: 본사행사
  const [isEventClicked, setIsEventClicked] = useState(false);

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
    const mapped = eventListRows
      .filter((item) => {
        const date = dayjs(item.menu_date);
        return date.year() === currentYear && date.month() + 1 === currentMonth;
      })
      .map((item) => {
        // 🔹 행사 유형(type)에 따른 색상 지정
        let bgColor = "#F2921D"; // 기본 (기타)
        if (item.type === "2" || item.type === 2) bgColor = "#007BFF"; // 본사행사 → 파랑
        if (item.type === "3" || item.type === 3) bgColor = "#2ECC71"; // 외부행사 → 초록

        return {
          idx: item.idx,
          user_id: item.user_id,
          title: item.content || "내용 없음",
          start: dayjs(item.menu_date).format("YYYY-MM-DD"),
          end: dayjs(item.menu_date).format("YYYY-MM-DD"),
          backgroundColor: bgColor,
          textColor: "#fff",
          extendedProps: { ...item },
        };
      });
    setEvents(mapped);
  }, [eventListRows, currentYear, currentMonth]);

  // ✅ 날짜 클릭 (빈칸 클릭 시 등록)
  const handleDateClick = (arg) => {
    // 🔸 eventClick 과 dateClick이 동시에 불리는 경우가 있어서 방지
    if (isEventClicked) {
      setIsEventClicked(false); // 다음 클릭 대비 초기화
      return;
    }

    // 📌 새 일정 등록용
    setSelectedDate(arg.dateStr);
    setSelectedEvent(null);
    setInputValue("");
    setSelectedType("2");
    setIsDeleteMode(false);
    setOpen(true);
  };

  // ✅ 이벤트 클릭 (일정 보기)
  const handleEventClick = (info) => {
    setIsEventClicked(true); // ← 이벤트 클릭됨 표시
    const clickedEvent = info.event;

    setSelectedDate(dayjs(clickedEvent.start).format("YYYY-MM-DD"));
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

  // ✅ 일정 저장 또는 삭제
  const handleSave = async () => {
    if (!inputValue.trim() && !isDeleteMode) {
      Swal.fire("경고", "내용을 입력하세요.", "warning");
      return;
    }

    const newEvent = {
      idx: selectedEvent?.extendedProps?.idx || null, // ✅ 기존 일정이면 idx 전달
      content: inputValue,
      menu_date: selectedDate,
      type: selectedType,
      del_yn: "N", // ✅ 삭제 버튼 눌렀을 때만 Y
    };

    try {
      const response = await api.post(
        "/HeadOffice/EventSave",
        newEvent,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.code === 200) {
        Swal.fire(
          isDeleteMode ? "삭제 완료" : "저장 완료",
          isDeleteMode ? "일정이 삭제되었습니다." : "일정이 저장되었습니다.",
          "success"
        );
        eventList(); // ✅ 저장/삭제 후 다시 조회
      } else {
        Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("실패", "서버 연결에 실패했습니다.", "error");
    }

    setOpen(false);
  };

  // ✅ 삭제 전용 함수
  const handleDelete = async () => {
    const newEvent = {
      idx: selectedEvent?.extendedProps?.idx || null, // ✅ 기존 일정이면 idx 전달
      content: inputValue,
      menu_date: selectedDate,
      type: selectedType,
      del_yn: "Y", // ✅ 강제 지정
    };

    try {
      const response = await api.post(
        "/HeadOffice/EventSave",
        newEvent,
        { headers: { "Content-Type": "application/json" } }
      );

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
      <Typography variant="h5" sx={{ mb: -1, fontWeight: "bold" }}>
        🏠 행사 달력 (내부 관리용)
      </Typography>

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
        eventClick={handleEventClick} // ✅ 이벤트 클릭시 내용 보기
        eventColor="#F2921D"
        eventTextColor="#fff"
        height="85vh"
        dayMaxEventRows={5}
        eventContent={(arg) => (
          <div
            style={{
              whiteSpace: "pre-line",
              fontSize: "13px",
              lineHeight: "1.4",
              textAlign: "center",
              color: "#fff",
            }}
          >
            {arg.event.title}
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
            width: 500,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 5,
          }}
        >
          {/* ✅ 상단 날짜 + 행사 선택 */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              {dayjs(selectedDate).format("YYYY년 MM월 DD일")}
            </Typography>

            {/* 행사 유형 선택 */}
            <Select
              size="small"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="2">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: "blue",
                    }}
                  />
                  본사행사
                </Box>
              </MenuItem>

              <MenuItem value="3">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: "green",
                    }}
                  />
                  외부행사
                </Box>
              </MenuItem>
            </Select>
          </Box>

          {/* ✅ 일정 내용 입력 */}
          <TextField
            fullWidth
            label="내용 입력"
            InputLabelProps={{
              style: { fontSize: "0.7rem" },
            }}
            multiline
            minRows={7}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          {/* ✅ 버튼 영역 */}
          <Box
            sx={{
              mt: 3,
              display: "flex",
              justifyContent: "flex-end",
              gap: 1.5,
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

            <Button
              variant="contained"
              sx={{ color: "#ffffff" }}
              onClick={handleSave}
            >
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </DashboardLayout>
  );
}

export default EventSheetTab;
