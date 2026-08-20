/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import { useTheme, useMediaQuery, Chip, Divider, Modal, Box, CircularProgress } from "@mui/material";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import LoadingScreen from "layouts/loading/loadingscreen";
import useRecordCommuteSheetData from "./data/RecordCommuteSheetData";

// ✅ 이 기기를 식별하는 장기 토큰(로그아웃해도 유지) - 하드웨어 고유 ID를 브라우저에서 얻을 수 없으므로
//    "장기 토큰 + 로그인 세션 + 기기정보(UA)" 조합으로 기기를 식별한다.
const DEVICE_TOKEN_KEY = "commute_device_token";

const getOrCreateDeviceToken = () => {
  try {
    let token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (token) return token;

    token =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
    return token;
  } catch (e) {
    // localStorage 접근 불가 시 세션 동안만 사용
    return `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
};

// ✅ 기기 표시용 이름(브라우저/OS 요약) - 관리자가 승인 화면에서 구분하는 용도
const getDeviceLabel = () => {
  const ua = window.navigator?.userAgent || "";
  let os = "Unknown OS";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  else if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  return `${os} · ${browser}`;
};

// ✅ 위치 조회를 Promise 로 감싼 헬퍼
const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!window.navigator?.geolocation) {
      reject(new Error("이 기기에서는 위치 정보를 사용할 수 없습니다."));
      return;
    }
    window.navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });

function RecordCommuteSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ account_id가 없는 계정(본사 등 특정 사업장에 소속되지 않은 계정)은 "HQ"로 취급
  const HEAD_OFFICE_ACCOUNT_ID = "HQ";

  const userId = (window.localStorage.getItem("user_id") || "").trim();
  const userName = (window.localStorage.getItem("user_name") || "").trim();
  const rawAccountId = (window.localStorage.getItem("account_id") || "").trim();
  const accountId = rawAccountId || HEAD_OFFICE_ACCOUNT_ID;
  const positionCode = (window.localStorage.getItem("position") || "").trim();
  const departmentCode = (window.localStorage.getItem("department") || "").trim();

  // ✅ 기기등록 승인 권한: 대표님(0)/팀장(1), 또는 개발팀(6)
  const canApproveDevice = ["0", "1"].includes(positionCode) || departmentCode === "6";

  const {
    deviceInfo,
    todayStatus,
    deviceRequestList,
    fetchDeviceInfo,
    fetchTodayStatus,
    fetchAccountCoordinate,
    requestDevice,
    fetchDeviceRequestList,
    approveDevice,
    submitCommute,
    fetchRecordList,
  } = useRecordCommuteSheetData();

  const [checking, setChecking] = useState(false);
  const [checkingAction, setCheckingAction] = useState(null); // "clockIn" | "clockOut" | null
  const [requesting, setRequesting] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordList, setRecordList] = useState([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => dayjs());
  // ✅ 최초 조회가 끝나기 전까진 "등록기기 없음" 같은 중간 상태가 잠깐 보이지 않도록 로딩화면으로 가림
  const [initialLoading, setInitialLoading] = useState(true);

  const refreshMyStatus = useCallback(async () => {
    await Promise.all([fetchDeviceInfo(accountId, userName), fetchTodayStatus(userName, accountId)]);
  }, [userName, accountId, fetchDeviceInfo, fetchTodayStatus]);

  // ✅ 등록/승인/반려/출근/퇴근 등 뭔가 하나라도 하면 화면 전체(내 상태 + 승인대기 목록)를 다시 조회
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshMyStatus(), canApproveDevice ? fetchDeviceRequestList() : Promise.resolve()]);
  }, [refreshMyStatus, canApproveDevice, fetchDeviceRequestList]);

  useEffect(() => {
    refreshAll().finally(() => setInitialLoading(false));
  }, [refreshAll]);

  const isApproved = String(deviceInfo?.approve_yn ?? "N").toUpperCase() === "Y";
  const hasPendingRequest = !!(deviceInfo?.pending_device_token);

  // ✅ 승인 대기중이면 몇 초마다 자동으로 재조회해서, 관리자가 승인하는 순간 화면이 알아서 바뀌게 함
  useEffect(() => {
    if (!hasPendingRequest) return undefined;
    const timer = setInterval(() => {
      fetchDeviceInfo(accountId, userName);
    }, 5000);
    return () => clearInterval(timer);
  }, [hasPendingRequest, accountId, userName, fetchDeviceInfo]);

  const checkedIn = !!todayStatus?.start_time;
  const checkedOut = !!todayStatus?.end_time;
  const inTime = todayStatus?.start_time;
  const outTime = todayStatus?.end_time;

  const nextType = !checkedIn ? "clockIn" : !checkedOut ? "clockOut" : null;

  // TODO: account_id/user_name 없는 계정(본사 등) 처리는 나중에 - 지금은 테스트용으로 막지 않음
  const handleDeviceRequest = async () => {
    setRequesting(true);
    try {
      const deviceToken = getOrCreateDeviceToken();
      const deviceName = getDeviceLabel();
      const res = await requestDevice({
        user_name: userName,
        account_id: accountId,
        device_token: deviceToken,
        device_name: deviceName,
      });
      await Swal.fire({
        title: res?.code === "200" ? "요청 완료" : "요청 실패",
        text: res?.msg || "",
        icon: res?.code === "200" ? "success" : "error",
      });
      refreshAll();
    } catch (e) {
      Swal.fire("오류", e?.message || "기기 등록 요청 중 오류가 발생했습니다.", "error");
    } finally {
      setRequesting(false);
    }
  };

  // ✅ account_id가 없는 계정(본사 등) 테스트용 기준좌표 - 나중에 정식으로 처리 전까지 임시 fallback
  const FALLBACK_TARGET = { xCoordinate: 126.9729874683217, yCoordinate: 37.27480304451022 };

  // ✅ action: "clockIn" | "clockOut" - 모바일앱(thefull-m)과 동일하게
  //    1) 사업장 기준 좌표 조회 -> 2) 현재 위치 조회 -> 3) 거리오차 계산 후 저장 요청
  const handleCommute = async (action) => {
    setChecking(true);
    setCheckingAction(action);
    try {
      const target = rawAccountId ? await fetchAccountCoordinate(rawAccountId) : null;
      const effectiveTarget = target || FALLBACK_TARGET;

      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      const deviceToken = getOrCreateDeviceToken();

      const result = await submitCommute({
        account_id: accountId,
        user_name: userName,
        action,
        target: effectiveTarget,
        location: { latitude, longitude },
        device_token: deviceToken,
        device_name: getDeviceLabel(),
      });

      await Swal.fire({
        title: result.ok ? "완료" : "실패",
        html: (result.ok
          ? `${action === "clockIn" ? "출근" : "퇴근"} 정보가 저장되었습니다. (거리 약 ${result.errorMargin}m)`
          : result.msg || ""
        ).replace(/\n/g, "<br/>"),
        icon: result.ok ? "success" : "error",
      });

      refreshAll();
    } catch (e) {
      const msg =
        e?.code === 1
          ? "위치 정보 접근 권한을 허용해주세요."
          : e?.message || "출퇴근 등록 중 오류가 발생했습니다.";
      Swal.fire("오류", msg, "error");
    } finally {
      setChecking(false);
      setCheckingAction(null);
    }
  };

  // ✅ "HH:mm:ss" -> "HH:mm" (초 단위는 화면에서 생략)
  const formatHM = (timeStr) => (timeStr ? String(timeStr).slice(0, 5) : "--:--");

  // ✅ 달력 요일 헤더 - dayjs 전역 locale을 건드리지 않기 위해 직접 매핑
  const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  // ✅ 해당 월(month, dayjs) 기준으로 출근 기록 재조회
  const loadMonthRecords = useCallback(
    async (month) => {
      setRecordLoading(true);
      try {
        const list = await fetchRecordList({
          user_name: userName,
          account_id: accountId,
          start_date: month.startOf("month").format("YYYY-MM-DD"),
          end_date: month.endOf("month").format("YYYY-MM-DD"),
        });
        setRecordList(list);
      } finally {
        setRecordLoading(false);
      }
    },
    [userName, accountId, fetchRecordList]
  );

  const openRecordModal = () => {
    const thisMonth = dayjs();
    setCalendarMonth(thisMonth);
    setRecordModalOpen(true);
    loadMonthRecords(thisMonth);
  };

  const handleChangeMonth = (diff) => {
    const nextMonth = calendarMonth.add(diff, "month");
    setCalendarMonth(nextMonth);
    loadMonthRecords(nextMonth);
  };

  // ✅ "YYYY-MM-DD" -> {start_time, end_time} 맵으로 변환 (달력 셀에서 바로 찾아쓰기 위함)
  const recordsByDate = useMemo(() => {
    const map = {};
    recordList.forEach((row) => {
      if (row.t_date) map[row.t_date] = row;
    });
    return map;
  }, [recordList]);

  const handleApprove = async (row, approve) => {
    try {
      const res = await approveDevice({
        account_id: row.account_id,
        user_name: row.user_name,
        approve,
        approve_user_id: userId,
      });
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

  const deviceStatusChip = useMemo(() => {
    if (isApproved && !hasPendingRequest) {
      return <Chip label={`등록기기 승인됨 (${deviceInfo?.device_name || ""})`} color="success" size="small" />;
    }
    if (hasPendingRequest) {
      return <Chip label="기기 등록 승인 대기중" color="warning" size="small" />;
    }
    return <Chip label="등록기기 없음" color="error" size="small" />;
  }, [isApproved, hasPendingRequest, deviceInfo]);

  // ✅ 출퇴근 버튼 카드 (모바일/데스크톱 공통)
  const COMMUTE_PURPLE = "#6C5DD3";
  const CommuteCard = (
    <Card sx={{ p: isMobile ? 2.5 : 3 }}>
      <MDBox display="flex" flexDirection="column" alignItems="center" gap={2}>
        <MDBox width="100%" display="flex" justifyContent="center">
          <Chip
            icon={<span style={{ marginLeft: 6 }}>🗓️</span>}
            label="출근 기록"
            onClick={openRecordModal}
            clickable
            sx={{ bgcolor: "#F1EFFD", color: COMMUTE_PURPLE, fontWeight: "bold" }}
          />
        </MDBox>

        <MDTypography variant="button" fontWeight="bold" textAlign="center" sx={{ color: "#3A3A45" }}>
          {dayjs().format("YYYY년 M월 D일")}
        </MDTypography>

        <MDTypography variant="h6" fontWeight="bold" textAlign="center" sx={{ color: COMMUTE_PURPLE }}>
          {userName || userId}
        </MDTypography>

        {deviceStatusChip}

        {!isApproved && (
          <MDBox width="100%" textAlign="center">
            <MDTypography variant="caption" color="text" display="block" mb={1}>
              등록된 기기에서만 출퇴근이 가능합니다.
              {hasPendingRequest ? " 관리자 승인을 기다려주세요." : " 이 기기를 등록해주세요."}
            </MDTypography>
            {!hasPendingRequest && (
              <MDButton
                variant="outlined"
                color="info"
                size="small"
                onClick={handleDeviceRequest}
                disabled={requesting}
              >
                {requesting ? "요청 중..." : "이 기기 등록 요청"}
              </MDButton>
            )}
          </MDBox>
        )}

        {/* ✅ 출근/퇴근 시각 - 크고 잘 보이게, 서로 다른 색으로 구분 */}
        <MDBox width="100%" display="flex" gap={1.5}>
          <MDBox flex={1} textAlign="center" sx={{ bgcolor: "#E8F8EF", borderRadius: 3, py: 1.5 }}>
            <MDTypography variant="caption" color="text" display="block">
              출근
            </MDTypography>
            <MDTypography variant="h6" fontWeight="bold" sx={{ color: "#1FA45C" }}>
              {formatHM(inTime)}
            </MDTypography>
          </MDBox>
          <MDBox flex={1} textAlign="center" sx={{ bgcolor: "#FDEBEE", borderRadius: 3, py: 1.5 }}>
            <MDTypography variant="caption" color="text" display="block">
              퇴근
            </MDTypography>
            <MDTypography variant="h6" fontWeight="bold" sx={{ color: "#E5566B" }}>
              {formatHM(outTime)}
            </MDTypography>
          </MDBox>
        </MDBox>

        {/* ✅ 출근/퇴근 버튼 - 나란히, 위 시각 박스와 같은 색으로 구분(출근=초록/퇴근=빨강) */}
        <MDBox width="100%" display="flex" gap={1.5} mt={1}>
          <MDButton
            fullWidth
            disabled={!isApproved || checking || nextType !== "clockIn"}
            onClick={() => handleCommute("clockIn")}
            sx={{
              py: 1.5,
              borderRadius: 999,
              fontSize: isMobile ? "1.05rem" : "1rem",
              fontWeight: "bold",
              color: "#fff !important",
              backgroundColor: "#1FA45C !important",
              "&:disabled": { backgroundColor: "#B6E3C8 !important", color: "#fff !important" },
            }}
          >
            {checking && nextType === "clockIn" ? "처리 중..." : "출근"}
          </MDButton>
          <MDButton
            fullWidth
            disabled={!isApproved || checking || nextType !== "clockOut"}
            onClick={() => handleCommute("clockOut")}
            sx={{
              py: 1.5,
              borderRadius: 999,
              fontSize: isMobile ? "1.05rem" : "1rem",
              fontWeight: "bold",
              color: "#fff !important",
              backgroundColor: "#E5566B !important",
              "&:disabled": { backgroundColor: "#F5C3CB !important", color: "#fff !important" },
            }}
          >
            {checking && nextType === "clockOut" ? "처리 중..." : "퇴근"}
          </MDButton>
        </MDBox>
      </MDBox>
    </Card>
  );

  // ✅ 출근/퇴근 처리 중(위치 확인 -> 저장) 동안 띄우는 로딩 모달
  const ProcessingModal = (
    <Modal open={checking} disableEscapeKeyDown>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isMobile ? "80%" : 320,
          bgcolor: "background.paper",
          borderRadius: 3,
          boxShadow: 24,
          p: 4,
          textAlign: "center",
        }}
      >
        <CircularProgress sx={{ color: checkingAction === "clockOut" ? "#E5566B" : "#1FA45C" }} />
        <MDTypography variant="button" fontWeight="bold" display="block" mt={2}>
          {checkingAction === "clockOut" ? "퇴근" : "출근"} 처리 중...
        </MDTypography>
        <MDTypography variant="caption" color="text" display="block" mt={0.5}>
          위치를 확인하고 저장하는 중입니다.
        </MDTypography>
      </Box>
    </Modal>
  );

  // ✅ 출근 기록 모달 - 월별 달력, 좌우로 월 이동
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
          transform: "translate(-50%, -50%)",
          width: isMobile ? "94%" : 480,
          maxHeight: "85vh",
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
            sx={{ minWidth: 36, color: COMMUTE_PURPLE, fontSize: "1.2rem" }}
          >
            ‹
          </MDButton>
          <MDTypography variant="h6">🗓️ {calendarMonth.format("YYYY년 M월")} 출근 기록</MDTypography>
          <MDButton
            variant="text"
            size="small"
            onClick={() => handleChangeMonth(1)}
            sx={{ minWidth: 36, color: COMMUTE_PURPLE, fontSize: "1.2rem" }}
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

  // ✅ 최초 조회 끝나기 전에는 "등록기기 없음" 같은 잘못된 중간 상태가 안 보이게 로딩화면으로 가림
  if (initialLoading) return <LoadingScreen />;

  // ✅ 모바일: 출퇴근 버튼만 딱 보이게
  if (isMobile) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox py={3} display="flex" justifyContent="center">
          <MDBox width="100%" maxWidth={420}>
            {CommuteCard}
          </MDBox>
        </MDBox>
        {RecordModal}
        {ProcessingModal}
      </DashboardLayout>
    );
  }

  // ✅ 데스크톱: 출퇴근 카드 + (권한자만) 기기 등록 승인 목록
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={5}>
            {CommuteCard}
          </Grid>

          {canApproveDevice && (
            <Grid item xs={12} md={7}>
              <Card sx={{ p: 3 }}>
                <MDTypography variant="h6" mb={2}>
                  등록기기 승인 대기 목록
                </MDTypography>
                <Divider sx={{ mb: 2 }} />
                {deviceRequestList.length === 0 ? (
                  <MDTypography variant="button" color="text">
                    승인 대기중인 요청이 없습니다.
                  </MDTypography>
                ) : (
                  <MDBox display="flex" flexDirection="column" gap={1.5}>
                    {deviceRequestList.map((row) => (
                      <MDBox
                        key={`${row.account_id}_${row.user_name}`}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ border: "1px solid #eee", borderRadius: 1, p: 1.5 }}
                      >
                        <MDBox>
                          <MDTypography variant="button" fontWeight="bold" display="block">
                            {row.user_name} · {row.account_name || row.account_id}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            요청기기: {row.pending_device_name || "-"}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            요청일시:{" "}
                            {row.request_dt ? dayjs(row.request_dt).format("YYYY-MM-DD HH:mm") : "-"}
                          </MDTypography>
                        </MDBox>
                        <MDBox display="flex" gap={1}>
                          <MDButton
                            size="small"
                            variant="gradient"
                            color="success"
                            onClick={() => handleApprove(row, "Y")}
                          >
                            승인
                          </MDButton>
                          <MDButton
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleApprove(row, "N")}
                          >
                            반려
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    ))}
                  </MDBox>
                )}
              </Card>
            </Grid>
          )}
        </Grid>
      </MDBox>
      {RecordModal}
      {ProcessingModal}
    </DashboardLayout>
  );
}

export default RecordCommuteSheet;
