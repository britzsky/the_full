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
  useTheme,
  useMediaQuery,
} from "@mui/material";

import useOperateSchedulesheetData from "./data/OperateScheduleSheetData";
import "./fullcalendar-custom.css";
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import LoadingScreen from "../loading/loadingscreen";

function OperateScheduleSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month() + 1);
  const { eventListRows, eventList, loading } = useOperateSchedulesheetData(
    currentYear,
    currentMonth
  );

  const [displayDate, setDisplayDate] = useState(dayjs());
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // 시작일
  const [selectedEndDate, setSelectedEndDate] = useState(null); // 종료일
  const [inputValue, setInputValue] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventClicked, setIsEventClicked] = useState(false);

  // 🔹 행사 종류
  const [selectedType, setSelectedType] = useState("1"); // 1: 행사 기본값

  // 🔹 담당자(BusinessMember) 리스트 + 선택값
  const [operateMemberList, setoperateMemberList] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  // ✅ 행사 종류별 색상 매핑
  const getTypeColor = (type) => {
    const t = String(type);
    switch (t) {
      case "1": // 행사
        return "#FF5F00";
      case "2": // 위생관리
        return "#F2921D";
      case "3": // 미팅
        return "#0046FF";
      case "4": // 오픈
        return "#527853";
      case "5": // 오픈준비
        return "#F266AB";
      case "6": // 외근
        return "#A459D1";
      case "7": // 출장
        return "#D71313";
      case "8": // 체크
        return "#364F6B";
      case "9": // 연차
        return "#1A0841";
      case "10": // 오전반차
        return "#1A0841";
      case "11": // 오후반차
        return "#1A0841";
      default:
        return "#F2921D";
    }
  };

  // ✅ 행사 종류 정의 (getTypeColor 주석과 동일하게)
  const TYPE_OPTIONS = [
    { value: "1", label: "행사" },
    { value: "2", label: "위생관리" },
    { value: "3", label: "미팅" },
    { value: "4", label: "오픈" },
    { value: "5", label: "오픈준비" },
    { value: "6", label: "외근" },
    { value: "7", label: "출장" },
    { value: "8", label: "체크" },
    { value: "9", label: "연차" },
    { value: "10", label: "오전반차" },
    { value: "11", label: "오후반차" },
  ];

  // 🔽 TYPE_OPTIONS 아래 즈음에 추가
  const getTypeLabel = (typeValue) => {
    const v = String(typeValue ?? "");
    const found = TYPE_OPTIONS.find((t) => t.value === v);
    return found ? found.label : "";
  };

  // ✅ operateMemberList 조회 함수
  const fetchOperateMemberList = async () => {
    try {
      if (operateMemberList.length > 0) return;

      const res = await api.get("/Operate/OperateMemberList", {
        headers: { "Content-Type": "application/json" },
      });

      setoperateMemberList(res.data || []);
    } catch (error) {
      console.error("OperateMemberList 조회 실패:", error);
      Swal.fire("실패", "담당자 목록을 가져오지 못했습니다.", "error");
    }
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
    const mapped = eventListRows
      .filter((item) => {
        // start_date 기준으로 월 필터 (원하면 기간으로 더 정교하게도 가능)
        const date = dayjs(item.start_date);
        return date.year() === currentYear && date.month() + 1 === currentMonth;
      })
      .map((item) => {
        const bgColor = getTypeColor(item.type);
        const isCanceled = item.del_yn === "Y";

        return {
          idx: item.idx,
          user_id: item.user_id,
          title: item.content || "내용 없음",
          start: dayjs(item.start_date).format("YYYY-MM-DD"),
          // 🔥 FullCalendar allDay 이벤트는 end가 '다음날 0시'라 +1일 해주는 게 보통
          end: dayjs(item.end_date || item.start_date)
            .add(1, "day")
            .format("YYYY-MM-DD"),
          backgroundColor: bgColor,
          textColor: "#fff",
          extendedProps: { ...item, isCanceled },
        };
      });

    setEvents(mapped);
  }, [eventListRows, currentYear, currentMonth]);

  // ✅ 날짜 클릭 (빈칸 클릭 시 등록)
  const handleDateClick = async (arg) => {
    if (isEventClicked) {
      setIsEventClicked(false);
      return;
    }

    setSelectedDate(arg.dateStr); // 시작일
    setSelectedEndDate(arg.dateStr); // 종료일 = 시작일 (1일짜리)

    setSelectedEvent(null);
    setInputValue("");
    setSelectedType("1");
    setSelectedMemberId("");

    await fetchOperateMemberList();
    setOpen(true);
  };

  // ✅ 여러 날짜 드래그로 기간 선택
  const handleSelectRange = async (info) => {
    // FullCalendar의 end는 'exclusive'라서 -1일 해야 실제 마지막 날짜
    const start = dayjs(info.start).format("YYYY-MM-DD");
    const end = dayjs(info.end).subtract(1, "day").format("YYYY-MM-DD");

    setSelectedDate(start);
    setSelectedEndDate(end);
    setSelectedEvent(null);
    setInputValue("");
    setSelectedType("1");
    setSelectedMemberId("");

    await fetchOperateMemberList();
    setOpen(true);
  };

  // ✅ 이벤트 클릭 (일정 보기/수정/취소/복원)
  const handleEventClick = async (info) => {
    setIsEventClicked(true);
    const clickedEvent = info.event;

    // ⬇ 우선 extendedProps에 있는 값 우선 사용
    let start = clickedEvent.extendedProps?.start_date;
    let end = clickedEvent.extendedProps?.end_date;

    // 만약 과거 데이터 등으로 start_date/end_date가 없다면 fallback
    if (!start) {
      start = dayjs(clickedEvent.start).format("YYYY-MM-DD");
    }
    if (!end) {
      if (clickedEvent.end) {
        // FullCalendar allDay는 end가 '다음날 0시'라 -1일
        end = dayjs(clickedEvent.end).subtract(1, "day").format("YYYY-MM-DD");
      } else {
        end = start;
      }
    }

    setSelectedDate(start);
    setSelectedEndDate(end);
    setSelectedEvent(clickedEvent);
    setInputValue(clickedEvent.title);
    setSelectedType(clickedEvent.extendedProps?.type?.toString() || "1");
    setSelectedMemberId(clickedEvent.extendedProps?.user_id?.toString() || "");

    await fetchOperateMemberList();
    setOpen(true);
  };

  // ✅ 모달 닫기
  const handleClose = () => {
    setOpen(false);
    setSelectedEvent(null);
  };

  // ✅ 저장 (등록/수정)
  const handleSave = async () => {
    if (!inputValue.trim()) {
      Swal.fire("경고", "내용을 입력하세요.", "warning");
      return;
    }

    if (!selectedMemberId) {
      Swal.fire("경고", "담당자를 선택하세요.", "warning");
      return;
    }

    const newEvent = {
      idx: selectedEvent?.extendedProps?.idx || null,
      content: inputValue,
      // 🔥 기간 정보
      start_date: selectedDate,
      end_date: selectedEndDate || selectedDate,
      type: selectedType,
      user_id: selectedMemberId,
      del_yn: "N",
      reg_user_id: localStorage.getItem("user_id"),
    };

    try {
      const response = await api.post("/Operate/OperateScheduleSave", newEvent, {
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

  // ✅ 일정 취소(confirm + del_yn='Y')
  const handleCancelEvent = () => {
    if (!selectedEvent) return;

    Swal.fire({
      title: "일정 취소",
      text: "해당 일정을 취소하시겠습니까?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "네, 취소할게요",
      cancelButtonText: "아니요",
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      const cancelEvent = {
        idx: selectedEvent?.extendedProps?.idx || null,
        content: inputValue,
        // ✅ 기간 정보 유지
        start_date: selectedDate,
        end_date: selectedEndDate || selectedDate,
        type: selectedType,
        user_id: selectedMemberId,
        del_yn: "Y",
        reg_user_id: localStorage.getItem("user_id"),
      };

      try {
        const response = await api.post("/Operate/OperateScheduleSave", cancelEvent, {
          headers: { "Content-Type": "application/json" },
        });

        if (response.data.code === 200) {
          Swal.fire("취소 완료", "일정이 취소되었습니다.", "success");
          eventList();
        } else {
          Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
        }
      } catch (error) {
        console.error(error);
        Swal.fire("실패", "서버 연결에 실패했습니다.", "error");
      }

      setOpen(false);
    });
  };

  // ✅ 일정 복원(confirm + del_yn='N')
  const handleRestoreEvent = () => {
    if (!selectedEvent) return;

    Swal.fire({
      title: "일정 복원",
      text: "취소된 일정을 복원하시겠습니까?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#999",
      confirmButtonText: "네, 복원할게요",
      cancelButtonText: "아니요",
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      const restoreEvent = {
        idx: selectedEvent?.extendedProps?.idx || null,
        content: inputValue,
        // ✅ 기간 정보 유지
        start_date: selectedDate,
        end_date: selectedEndDate || selectedDate,
        type: selectedType,
        user_id: selectedMemberId,
        del_yn: "N", // 🔥 복원 → 다시 활성화
        reg_user_id: localStorage.getItem("user_id"),
      };

      try {
        const response = await api.post("/Operate/OperateScheduleSave", restoreEvent, {
          headers: { "Content-Type": "application/json" },
        });

        if (response.data.code === 200) {
          Swal.fire("복원 완료", "일정이 복원되었습니다.", "success");
          eventList();
        } else {
          Swal.fire("실패", "서버에서 오류가 발생했습니다.", "error");
        }
      } catch (error) {
        console.error(error);
        Swal.fire("실패", "서버 연결에 실패했습니다.", "error");
      }

      setOpen(false);
    });
  };

  const POSITION_LABEL = {
    0: "대표",
    1: "팀장",
    2: "파트장",
    3: "매니저",
    8: "영양사",
  };

  const getPositionLabel = (pos) => {
    const key = Number(pos);
    return POSITION_LABEL[key] ?? "직급없음"; // 없는 값 들어오면 fallback
  };

  if (loading) return <LoadingScreen />;

  // 🔹 선택된 일정이 취소 상태인지 여부
  const isSelectedCanceled = !!selectedEvent?.extendedProps?.isCanceled;

  return (
    <DashboardLayout>
      {/* <HeaderWithLogout showMenuButton title="📅 운영 일정관리 (내부 관리용)" /> */}
      <DashboardNavbar title="📅 운영 일정관리 (내부 관리용)" />
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
        dateClick={handleDateClick} // 하루 클릭
        eventClick={handleEventClick}
        selectable={true} // 🔥 기간 선택 가능
        selectMirror={true}
        select={handleSelectRange} // 🔥 드래그로 선택 시 호출
        eventColor="#F2921D"
        eventTextColor="#fff"
        height="80vh"
        dayMaxEventRows={5}
        eventContent={(arg) => {
          const isCanceled = arg.event.extendedProps?.isCanceled;
          const userName = arg.event.extendedProps?.user_name; // ✅ 담당자 이름
          const typeLabel = getTypeLabel(arg.event.extendedProps?.type); // ⬅️ 추가
          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0 2px",
                color: "#fff",
                opacity: isCanceled ? 0.7 : 1,
              }}
            >
              {/* 일정 내용 (한 줄, 길면 ... 처리) */}
              <div
                style={{
                  fontSize: "10px",
                  textAlign: "center",
                  width: "100%",
                  // ✅ 말줄임 제거
                  overflow: "visible",
                  textOverflow: "clip",
                  // ✅ 줄바꿈 허용
                  whiteSpace: "normal",
                  wordBreak: "break-word", // 단어가 길어도 줄바꿈
                  overflowWrap: "anywhere", // 긴 문자열(공백없어도) 줄바꿈
                  textDecoration: isCanceled ? "line-through" : "none",
                  lineHeight: 1.2,
                }}
              >
                {typeLabel && <span style={{ marginRight: 2 }}>[{typeLabel}] </span>}
                {arg.event.title}
                {userName && <span style={{ marginLeft: 2 }}>({userName})</span>}
              </div>
            </div>
          );
        }}
      />

      {/* ✅ 일정 입력/수정/취소/복원 모달 */}
      <Modal open={open} onClose={handleClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? "92vw" : 500,
            maxWidth: "92vw",
            maxHeight: isMobile ? "90vh" : "auto",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: isMobile ? 2 : 5,
            overflowY: isMobile ? "auto" : "visible",
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

          {/* 행사 종류 + 담당자 선택 (한 줄 정렬) */}
          <Box
            sx={{
              display: "flex",
              alignItems: isMobile ? "stretch" : "center",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 1 : 2,
              mb: 2,
            }}
          >
            {/* 행사 종류 선택 */}
            <Select
              size="small"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              sx={{
                minWidth: isMobile ? "100%" : 170,
                width: isMobile ? "100%" : "auto",
                "& .MuiOutlinedInput-root": {
                  height: isMobile ? 48 : 72,
                },
                "& .MuiSelect-select": {
                  display: "flex",
                  alignItems: "center",
                },
              }}
            >
              {TYPE_OPTIONS.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: getTypeColor(type.value), // ✅ 위에서 정의한 색상 그대로 사용
                      }}
                    />
                    {type.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>

            {/* 담당자 선택 */}
            <Select
              size="small"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              displayEmpty
              sx={{
                flex: isMobile ? "none" : 1,
                width: isMobile ? "100%" : "auto",
                "& .MuiOutlinedInput-root": {
                  height: isMobile ? 48 : 75,
                },
              }}
            >
              <MenuItem value="">
                <em>담당자 선택</em>
              </MenuItem>
              {operateMemberList.map((member) => (
                <MenuItem key={member.user_id} value={member.user_id}>
                  {member.user_name} [{getPositionLabel(member.position)}]
                </MenuItem>
              ))}
            </Select>
          </Box>

          {/* 일정 내용 입력 */}
          <TextField
            fullWidth
            label="내용 입력"
            InputLabelProps={{
              style: { fontSize: "0.7rem" },
            }}
            multiline
            minRows={isMobile ? 5 : 7}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          {/* 버튼 영역 */}
          <Box
            sx={{
              mt: 3,
              display: "flex",
              justifyContent: isMobile ? "stretch" : "flex-end",
              flexWrap: isMobile ? "wrap" : "nowrap",
              gap: 1.5,
              "& .MuiButton-root": isMobile
                ? {
                  flex: "1 1 calc(50% - 6px)",
                  minWidth: 0,
                }
                : {},
            }}
          >
            {/* 취소 or 복원 버튼 */}
            {selectedEvent && !isSelectedCanceled && (
              <Button
                variant="contained"
                sx={{
                  bgcolor: "#FF0066",
                  color: "#ffffff",
                }}
                onClick={handleCancelEvent}
              >
                취소
              </Button>
            )}

            {selectedEvent && isSelectedCanceled && (
              <Button variant="contained" color="success" onClick={handleRestoreEvent}>
                복원
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

export default OperateScheduleSheet;
