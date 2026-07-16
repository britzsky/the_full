import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
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
  useMediaQuery,
} from "@mui/material";

// ✅ 커스텀 훅 import
import useWeekMenusheetData from "./data/WeekMenuSheetData";
import "./fullcalendar-custom.css";
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import LoadingScreen from "../loading/loadingscreen";

function WeekMenuSheetTab({ embedded = false }) {
  const isMobileTablet = useMediaQuery("(max-width:1279.95px)");
  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);
  const { weekMenuListRows, weekMenuList, loading } =
    useWeekMenusheetData(currentYear, currentMonth);

  const [displayDate, setDisplayDate] = useState(dayjs());
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null); // ✅ 기존 일정 추적
  const [isDeleteMode, setIsDeleteMode] = useState(false); // ✅ 삭제모드 구분

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

  // ✅ 1. 초기 조회
  useEffect(() => {
    weekMenuList();
  }, []);

  // ✅ 2. 월 변경 시 자동 조회
  useEffect(() => {
    if (currentYear && currentMonth) {
      weekMenuList();
    }
  }, [currentYear, currentMonth]);

  // ✅ 3. 서버 데이터 → FullCalendar 이벤트 변환
  useEffect(() => {
    const mapped = weekMenuListRows
      .filter((item) => {
        const date = dayjs(item.menu_date);
        return date.year() === currentYear && date.month() + 1 === currentMonth;
      })
      .map((item) => ({
        idx: item.idx,
        user_id: item.user_id,
        title: item.content || "내용 없음",
        start: dayjs(item.menu_date).format("YYYY-MM-DD"),
        end: dayjs(item.menu_date).format("YYYY-MM-DD"),
        backgroundColor: "#F2921D",
        textColor: "#fff",
        extendedProps: { ...item },
      }));
    setEvents(mapped);
  }, [weekMenuListRows, currentYear, currentMonth]);

  // ✅ 날짜 클릭 → 모달 열기
  const handleDateClick = (arg) => {
    const existingEvent = events.find(
      (e) => e.start === arg.dateStr
    );

    setSelectedDate(arg.dateStr);
    setSelectedEvent(existingEvent || null);
    setInputValue(existingEvent ? existingEvent.title : "");
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
      type: 1,
      del_yn: "N",
    };

    try {
      const response = await api.post(
        "/HeadOffice/WeekMenuSave",
        newEvent,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.code === 200) {
        Swal.fire(
          isDeleteMode ? "삭제 완료" : "저장 완료",
          isDeleteMode ? "일정이 삭제되었습니다." : "일정이 저장되었습니다.",
          "success"
        );
        weekMenuList(); // ✅ 저장/삭제 후 다시 조회
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
      type: 1,
      del_yn: "Y", // ✅ 강제 지정
    };

    try {
      const response = await api.post(
        "/HeadOffice/WeekMenuSave",
        newEvent,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.code === 200) {
        Swal.fire("삭제 완료", "일정이 삭제되었습니다.", "success");
        weekMenuList();
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

  const content = (
    <>
      {/* 🔹 공통 헤더 사용 */}
      {/* <HeaderWithLogout title="🍚 사내 식단 달력 (내부 관리용)" /> */}
      {!embedded && <DashboardNavbar title="🍚 사내 식단 달력 (내부 관리용)" />}
      {loading && <Typography sx={{ mt: 2 }}>⏳ 데이터 불러오는 중...</Typography>}

      {/* ✅ 커스텀 헤더 */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mt: embedded ? 0.5 : 2,
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
        eventClick={(info) => {
          // ✅ 이벤트 클릭 시에도 동일 모달 열기
          handleDateClick({ dateStr: dayjs(info.event.start).format("YYYY-MM-DD") });
        }}
        eventColor="#F2921D"
        eventTextColor="#fff"
        height={embedded ? "calc(100vh - 190px)" : "80vh"}
        dayMaxEventRows={5}
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
            width: isMobileTablet ? "calc(100vw - 24px)" : 500,
            maxWidth: 500,
            maxHeight: isMobileTablet ? "calc(100dvh - 24px)" : "none",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: isMobileTablet ? 2 : 5,
            overflowY: isMobileTablet ? "auto" : "visible",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
            {dayjs(selectedDate).format("YYYY년 MM월 DD일")}
          </Typography>

          <TextField
            fullWidth
            label="내용 입력"
            InputLabelProps={{
              style: { fontSize: "0.7rem" },
            }}
            multiline
            minRows={isMobileTablet ? 5 : 7}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

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
            {/* 기존 일정이 있을 때만 삭제 버튼 표시 */}
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
    </>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}

WeekMenuSheetTab.propTypes = {
  embedded: PropTypes.bool,
};

export default WeekMenuSheetTab;
