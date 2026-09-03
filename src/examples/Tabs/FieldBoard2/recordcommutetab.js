/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import {
  useTheme,
  useMediaQuery,
  Divider,
  Modal,
  Box,
  InputAdornment,
} from "@mui/material";
import { Search, Smartphone, ShieldCheck, CalendarDays } from "lucide-react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import LoadingScreen from "layouts/loading/loadingscreen";
import useRecordCommuteData from "./recordcommutedata";

const COMMUTE_PURPLE = "#6C5DD3";

// ✅ "HH:mm:ss" -> "HH:mm" (초 단위는 화면에서 생략)
const formatHM = (timeStr) => (timeStr ? String(timeStr).slice(0, 5) : "--:--");

// ✅ 달력 요일 헤더 - dayjs 전역 locale을 건드리지 않기 위해 직접 매핑
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function RecordCommuteTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const positionCode = (window.localStorage.getItem("position") || "").trim();
  const departmentCode = (window.localStorage.getItem("department") || "").trim();
  const userId = (window.localStorage.getItem("user_id") || "").trim();

  // ✅ 기기등록 승인 권한: 대표님(0)/팀장(1), 또는 운영팀(5)/개발팀(6)
  const canApproveDevice = ["0", "1"].includes(positionCode) || ["5", "6"].includes(departmentCode);

  const {
    deviceList,
    deviceRequestList,
    fetchDeviceList,
    fetchDeviceRequestList,
    approveDevice,
    fetchRecordList,
  } = useRecordCommuteData();

  const [initialLoading, setInitialLoading] = useState(true);
  const [registeredQuery, setRegisteredQuery] = useState("");

  // ✅ 등록된 사람·기기 목록 + 승인대기 목록을 함께 재조회
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchDeviceList(), fetchDeviceRequestList()]);
  }, [fetchDeviceList, fetchDeviceRequestList]);

  useEffect(() => {
    refreshAll().finally(() => setInitialLoading(false));
  }, []);

  const handleApprove = async (row, approve, staleDecision) => {
    try {
      const res = await approveDevice({
        account_id: row.account_id,
        user_name: row.user_name,
        phone_last4: row.phone_last4,
        approve,
        approve_user_id: userId,
        stale_decision: staleDecision,
      });

      // ✅ 이름이 같은 다른 phone_last4 행이 이미 승인되어 있어, 관리자 확인이 필요한 경우.
      if (res?.code === "428") {
        if (res?.same_device) {
          // 같은 기기까지 같으면 본인(번호 오타/변경)일 가능성이 높다. "다른 사람"이라는
          // 선택지는 주지 않는다 - 그러면 같은 기기가 두 사람에게 동시에 승인되어버리기 때문에,
          // 서버도 그 조합은 어차피 거부한다.
          const confirmResult = await Swal.fire({
            title: "확인 필요",
            text: res?.msg || "",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "같은 사람 맞음 - 계속 진행",
            cancelButtonText: "취소",
          });

          if (confirmResult.isConfirmed) {
            await handleApprove(row, approve, "SAME_PERSON");
          }
        } else {
          // 기기가 다르면 동명이인(진짜 다른 사람)일 가능성이 높다 - 어느 쪽이든 안전하게
          // 처리 가능하므로 세 가지 선택지를 모두 준다.
          const confirmResult = await Swal.fire({
            title: "확인 필요",
            text: res?.msg || "",
            icon: "question",
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: "같은 사람 - 기기변경(예전 기기 해제)",
            denyButtonText: "다른 사람 - 이번 요청만 승인",
            cancelButtonText: "취소",
          });

          if (confirmResult.isConfirmed) {
            await handleApprove(row, approve, "SAME_PERSON");
          } else if (confirmResult.isDenied) {
            await handleApprove(row, approve, "DIFFERENT_PERSON");
          }
        }
        return;
      }

      await Swal.fire({
        title: res?.code === "200" ? "처리 완료" : "처리 실패",
        text: res?.msg || "",
        icon: res?.code === "200" ? "success" : "error",
      });
      refreshAll();
    } catch (e) {
      Swal.fire("오류", e?.message || "처리 중 오류가 발생했습니다.", "error");
    }
  };

  // ✅ 검색어(이름/근무지)로 등록된 사람·기기 목록 필터링
  const filteredDeviceList = useMemo(() => {
    const q = registeredQuery.trim().toLowerCase();
    if (!q) return deviceList;
    return deviceList.filter(
      (row) =>
        String(row.user_name || "").toLowerCase().includes(q) ||
        String(row.account_name || row.account_id || "").toLowerCase().includes(q)
    );
  }, [deviceList, registeredQuery]);

  // ✅ 근태 기록 조회용 - 클릭한 사람(계정 기준) 선택 상태
  const [selectedPerson, setSelectedPerson] = useState(null); // {account_id, account_name, user_name, phone_last4}
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordList, setRecordList] = useState([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => dayjs());

  // ✅ 선택한 사람 기준으로 해당 월(month, dayjs) 근태 기록 재조회
  const loadMonthRecords = useCallback(
    async (person, month) => {
      if (!person) return;
      setRecordLoading(true);
      try {
        const list = await fetchRecordList({
          user_name: person.user_name,
          account_id: person.account_id,
          phone_last4: person.phone_last4,
          start_date: month.startOf("month").format("YYYY-MM-DD"),
          end_date: month.endOf("month").format("YYYY-MM-DD"),
        });
        setRecordList(list);
      } finally {
        setRecordLoading(false);
      }
    },
    [fetchRecordList]
  );

  const openRecordModal = (person) => {
    const thisMonth = dayjs();
    setSelectedPerson(person);
    setCalendarMonth(thisMonth);
    setRecordModalOpen(true);
    loadMonthRecords(person, thisMonth);
  };

  const handleChangeMonth = (diff) => {
    const nextMonth = calendarMonth.add(diff, "month");
    setCalendarMonth(nextMonth);
    loadMonthRecords(selectedPerson, nextMonth);
  };

  // ✅ "YYYY-MM-DD" -> {start_time, end_time} 맵으로 변환 (달력 셀에서 바로 찾아쓰기 위함)
  const recordsByDate = useMemo(() => {
    const map = {};
    recordList.forEach((row) => {
      if (row.t_date) map[row.t_date] = row;
    });
    return map;
  }, [recordList]);

  // ✅ 왼쪽 - 등록된 사람·기기 목록 카드
  const RegisteredListCard = (
    <Card
      sx={{
        borderRadius: 4,
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <MDBox display="flex" alignItems="center" gap={1} mb={2}>
        <ShieldCheck size={18} color={COMMUTE_PURPLE} />
        <MDTypography variant="h6">등록된 사람 · 기기</MDTypography>
      </MDBox>

      <TextField
        fullWidth
        size="small"
        value={registeredQuery}
        onChange={(e) => setRegisteredQuery(e.target.value)}
        placeholder="이름 또는 근무지 검색..."
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={15} color="#9AA0AC" />
            </InputAdornment>
          ),
        }}
      />

      <Divider sx={{ mb: 1.5 }} />

      {filteredDeviceList.length === 0 ? (
        <MDTypography variant="button" color="text">
          등록된 기기가 없습니다.
        </MDTypography>
      ) : (
        <MDBox display="flex" flexDirection="column" gap={1.5} sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {filteredDeviceList.map((row) => (
            <MDBox
              key={`${row.account_id}_${row.user_name}_${row.phone_last4}`}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              onClick={() =>
                openRecordModal({
                  account_id: row.account_id,
                  account_name: row.account_name,
                  user_name: row.user_name,
                  phone_last4: row.phone_last4,
                })
              }
              sx={{
                border: "1px solid #eee",
                borderRadius: 1,
                p: 1.5,
                cursor: "pointer",
                "&:hover": { borderColor: COMMUTE_PURPLE, bgcolor: "#F8F7FE" },
              }}
            >
              <MDBox>
                <MDTypography variant="button" fontWeight="bold" display="block">
                  {row.user_name}
                  {row.phone_last4 ? ` (${row.phone_last4})` : ""} · {row.account_name || row.account_id}
                </MDTypography>
                <MDBox display="flex" alignItems="center" gap={0.5} mt={0.3}>
                  <Smartphone size={12} color="#9AA0AC" />
                  <MDTypography variant="caption" color="text">
                    {row.device_name || "-"}
                  </MDTypography>
                </MDBox>
                <MDTypography variant="caption" color="text" display="block">
                  승인일시: {row.approve_dt ? dayjs(row.approve_dt).format("YYYY-MM-DD HH:mm") : "-"}
                </MDTypography>
              </MDBox>
              <MDBox display="flex" alignItems="center" gap={0.5} flexShrink={0}>
                <CalendarDays size={14} color={COMMUTE_PURPLE} />
                <MDTypography variant="caption" fontWeight="bold" sx={{ color: COMMUTE_PURPLE }}>
                  기록보기
                </MDTypography>
              </MDBox>
            </MDBox>
          ))}
        </MDBox>
      )}
    </Card>
  );

  // ✅ 오른쪽 - 등록기기 승인대기 목록 카드
  const ApprovalCard = (
    <Card
      sx={{
        borderRadius: 4,
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <MDBox display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <MDTypography variant="h6">등록기기 승인 대기 목록</MDTypography>
        <MDButton
          size="small"
          variant="gradient"
          color="warning"
          onClick={refreshAll}
          sx={{
            fontSize: "0.75rem",
            minWidth: "unset !important",
            padding: "4px 14px !important",
            whiteSpace: "nowrap",
          }}
        >
          새로고침
        </MDButton>
      </MDBox>
      <Divider sx={{ mb: 2 }} />
      {deviceRequestList.length === 0 ? (
        <MDTypography variant="button" color="text">
          승인 대기중인 요청이 없습니다.
        </MDTypography>
      ) : (
        <MDBox display="flex" flexDirection="column" gap={1.5} sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {deviceRequestList.map((row) => (
            <MDBox
              key={`${row.account_id}_${row.user_name}_${row.phone_last4}`}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              sx={{ border: "1px solid #eee", borderRadius: 1, p: 1.5 }}
            >
              <MDBox>
                {/* ✅ 뒷자리를 같이 보여줘서 동명이인이 섞여 있어도 승인자가 구분할 수 있게 함 */}
                <MDTypography variant="button" fontWeight="bold" display="block">
                  {row.user_name}
                  {row.phone_last4 ? ` (${row.phone_last4})` : ""} · {row.account_name || row.account_id}
                </MDTypography>
                <MDTypography variant="caption" color="text" display="block">
                  요청기기: {row.pending_device_name || "-"}
                </MDTypography>
                <MDTypography variant="caption" color="text" display="block">
                  요청일시: {row.request_dt ? dayjs(row.request_dt).format("YYYY-MM-DD HH:mm") : "-"}
                </MDTypography>
              </MDBox>
              <MDBox display="flex" gap={1} flexShrink={0}>
                <MDButton size="small" variant="gradient" color="success" onClick={() => handleApprove(row, "Y")}>
                  승인
                </MDButton>
                <MDButton size="small" variant="outlined" color="error" onClick={() => handleApprove(row, "N")}>
                  반려
                </MDButton>
              </MDBox>
            </MDBox>
          ))}
        </MDBox>
      )}
    </Card>
  );

  // ✅ 근태 기록 모달 - 월별 달력, 좌우로 월 이동
  const monthStart = calendarMonth.startOf("month");
  const daysInMonth = calendarMonth.daysInMonth();
  const leadingBlanks = monthStart.day(); // 0(일)~6(토)
  const todayStr = dayjs().format("YYYY-MM-DD");
  const calendarCells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const RecordModal = (
    <Modal open={recordModalOpen} onClose={() => setRecordModalOpen(false)}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: isMobile ? "translate(-50%, -200px)" : "translate(-50%, -240px)",
          width: isMobile ? "94%" : 480,
          maxHeight: "80vh",
          overflowY: "auto",
          bgcolor: "background.paper",
          borderRadius: 3,
          boxShadow: 24,
          p: isMobile ? 2 : 3,
        }}
      >
        <MDBox display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <MDButton
            variant="text"
            size="small"
            onClick={() => handleChangeMonth(-1)}
            sx={{
              minWidth: 36,
              color: `${COMMUTE_PURPLE} !important`,
              fontSize: "1.2rem",
              "&:hover, &:focus": { color: `${COMMUTE_PURPLE} !important` },
            }}
          >
            ‹
          </MDButton>
          <MDBox textAlign="center">
            <MDTypography variant="h6">🗓️ {calendarMonth.format("YYYY년 M월")} 근태 기록</MDTypography>
            {selectedPerson && (
              <MDTypography variant="caption" color="text">
                {selectedPerson.user_name}
                {selectedPerson.phone_last4 ? ` (${selectedPerson.phone_last4})` : ""} ·{" "}
                {selectedPerson.account_name || selectedPerson.account_id}
              </MDTypography>
            )}
          </MDBox>
          <MDButton
            variant="text"
            size="small"
            onClick={() => handleChangeMonth(1)}
            sx={{
              minWidth: 36,
              color: `${COMMUTE_PURPLE} !important`,
              fontSize: "1.2rem",
              "&:hover, &:focus": { color: `${COMMUTE_PURPLE} !important` },
            }}
          >
            ›
          </MDButton>
        </MDBox>
        <Divider sx={{ mb: 1.5 }} />

        {recordLoading ? (
          <MDTypography variant="button" color="text">
            불러오는 중...
          </MDTypography>
        ) : (
          <MDBox sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {KOREAN_WEEKDAYS.map((w) => (
              <MDTypography key={w} variant="caption" fontWeight="bold" textAlign="center" color="text">
                {w}
              </MDTypography>
            ))}

            {calendarCells.map((day, idx) => {
              if (day == null) return <MDBox key={`blank_${idx}`} />;

              const dateStr = monthStart.date(day).format("YYYY-MM-DD");
              const record = recordsByDate[dateStr];
              const isToday = dateStr === todayStr;

              return (
                <MDBox
                  key={dateStr}
                  sx={{
                    minHeight: isMobile ? 56 : 64,
                    border: isToday ? `1px solid ${COMMUTE_PURPLE}` : "1px solid #f0f0f0",
                    borderRadius: 1,
                    p: "3px",
                    textAlign: "center",
                  }}
                >
                  <MDTypography variant="caption" fontWeight={isToday ? "bold" : "regular"} color="text">
                    {day}
                  </MDTypography>
                  {record?.start_time && (
                    <MDTypography variant="caption" display="block" sx={{ color: "#1FA45C", fontSize: "0.62rem" }}>
                      출 {formatHM(record.start_time)}
                    </MDTypography>
                  )}
                  {record?.end_time && (
                    <MDTypography variant="caption" display="block" sx={{ color: "#E5566B", fontSize: "0.62rem" }}>
                      퇴 {formatHM(record.end_time)}
                    </MDTypography>
                  )}
                </MDBox>
              );
            })}
          </MDBox>
        )}
      </Box>
    </Modal>
  );

  if (initialLoading) return <LoadingScreen />;

  if (!canApproveDevice) {
    return (
      <MDBox display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <MDTypography variant="button" color="text">
          이 화면에 접근할 권한이 없습니다.
        </MDTypography>
      </MDBox>
    );
  }

  return (
    <MDBox sx={{ height: "100%" }}>
      <Grid container spacing={3} sx={{ height: "100%" }}>
        <Grid item xs={12} md={6} sx={{ height: { md: "100%" } }}>
          {RegisteredListCard}
        </Grid>
        <Grid item xs={12} md={6} sx={{ height: { md: "100%" } }}>
          {ApprovalCard}
        </Grid>
      </Grid>

      {RecordModal}
    </MDBox>
  );
}

export default RecordCommuteTab;
