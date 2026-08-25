/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import {
  useTheme,
  useMediaQuery,
  Chip,
  Divider,
  Modal,
  Box,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import { Search, Building2, User, CheckCircle2, AlertCircle, MapPin } from "lucide-react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
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

// ✅ 위치 조회를 Promise 로 감싼 헬퍼 (출퇴근 저장 시점의 "단발성" 정확한 위치 조회용)
const getCurrentPosition = (options) =>
  new Promise((resolve, reject) => {
    if (!window.navigator?.geolocation) {
      reject(new Error("이 기기에서는 위치 정보를 사용할 수 없습니다."));
      return;
    }
    window.navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 0, // ✅ 캐시된 옛날 위치를 재사용하지 않고 항상 새로 측정
      ...options,
    });
  });

// ✅ 근무지와 100m 이내에 있을 때만 출퇴근 버튼이 활성화된다 (클라이언트 표시/버튼 제어용 - 서버는 감사용으로만 기록)
const GEOFENCE_M = 100;
const COMMUTE_PURPLE = "#6C5DD3";

// ✅ 카카오맵 JavaScript 키 - 브라우저에서 쓰는 용도라 프론트 .env에 노출되는 게 정상(도메인 화이트리스트로 보호됨)
const KAKAO_MAP_KEY = process.env.REACT_APP_KAKAO_MAP_KEY;

// ✅ 현재 내 위치 마커용 SVG(파란 점) - 카카오맵 커스텀 마커 이미지로 사용
const USER_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <circle cx="11" cy="11" r="9" fill="#3b82f6" stroke="white" stroke-width="3"/>
  <circle cx="11" cy="11" r="3.5" fill="white"/>
</svg>`;

// ✅ 카카오맵 SDK는 <script> 동적 로드 방식이라, 이 화면에 들어왔을 때만 1회 로드(autoload=false로 받아 수동 초기화)
let kakaoSdkPromise = null;
function loadKakaoMapSdk() {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (kakaoSdkPromise) return kakaoSdkPromise;

  kakaoSdkPromise = new Promise((resolve, reject) => {
    if (!KAKAO_MAP_KEY) {
      reject(new Error("카카오맵 키(REACT_APP_KAKAO_MAP_KEY)가 설정되지 않았습니다."));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => {
      // eslint-disable-next-line no-console
      console.log("[KakaoMap] sdk.js 로드 성공, window.kakao.maps.load 호출");
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = (ev) => {
      // ✅ 브라우저 보안 정책상 script onerror 이벤트 자체에는 상세 사유(404/네트워크차단 등)가 안 담겨온다.
      //    Network 탭에서 sdk.js 요청 상태를 직접 확인해야 정확한 원인을 알 수 있다.
      // eslint-disable-next-line no-console
      console.error("[KakaoMap] sdk.js 로드 실패 - Network 탭에서 이 요청의 상태를 확인하세요:", script.src, ev);
      kakaoSdkPromise = null; // 실패하면 다음에 다시 시도할 수 있게 초기화
      reject(new Error("카카오맵 SDK 로드에 실패했습니다."));
    };
    document.head.appendChild(script);
  });
  return kakaoSdkPromise;
}

// ✅ 근무지 핀 + 반경 원 + 내 위치 마커를 그리는 카카오맵 컴포넌트
function KakaoMapView({ accountCoordinate, userPos }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const workMarkerRef = useRef(null);
  const workCircleRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // ✅ 지도 최초 1회 생성
  useEffect(() => {
    let cancelled = false;
    loadKakaoMapSdk()
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(36.5, 127.8),
          level: 13,
          draggable: true,
          scrollwheel: true,
        });
        // ✅ 화면 우측에 +/- 확대축소 컨트롤 추가
        mapRef.current.addControl(
          new kakao.maps.ZoomControl(),
          kakao.maps.ControlPosition.RIGHT
        );
        setReady(true);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[KakaoMap] 초기화 실패:", e);
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ 근무지 핀 + 반경(geofence) 원
  useEffect(() => {
    if (!ready) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    if (workMarkerRef.current) workMarkerRef.current.setMap(null);
    if (workCircleRef.current) workCircleRef.current.setMap(null);

    if (accountCoordinate) {
      const pos = new kakao.maps.LatLng(accountCoordinate.lat, accountCoordinate.lng);
      workMarkerRef.current = new kakao.maps.Marker({ position: pos, map });
      workCircleRef.current = new kakao.maps.Circle({
        center: pos,
        radius: GEOFENCE_M,
        strokeWeight: 2,
        strokeColor: COMMUTE_PURPLE,
        strokeOpacity: 0.8,
        strokeStyle: "shortdash",
        fillColor: COMMUTE_PURPLE,
        fillOpacity: 0.1,
        map,
      });
    }
  }, [ready, accountCoordinate]);

  // ✅ 내 현재 위치 마커
  useEffect(() => {
    if (!ready) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    if (userMarkerRef.current) userMarkerRef.current.setMap(null);

    if (userPos) {
      const pos = new kakao.maps.LatLng(userPos.lat, userPos.lng);
      const image = new kakao.maps.MarkerImage(
        `data:image/svg+xml;base64,${window.btoa(USER_MARKER_SVG)}`,
        new kakao.maps.Size(22, 22),
        { offset: new kakao.maps.Point(11, 11) }
      );
      userMarkerRef.current = new kakao.maps.Marker({ position: pos, map, image, zIndex: 5 });
    }
  }, [ready, userPos]);

  // ✅ 지도 시야 조정 - 내 위치가 아직 없으면 근무지 핀 기준(100m 반경이 잘 보이는 확대), 내 위치까지 있으면
  //    두 지점이 100m 기준을 벗어나더라도 한 화면에 같이 보이도록 bounds로 맞춘다.
  useEffect(() => {
    if (!ready || !accountCoordinate) return;
    const kakao = window.kakao;
    const map = mapRef.current;
    const workPos = new kakao.maps.LatLng(accountCoordinate.lat, accountCoordinate.lng);

    if (userPos) {
      const bounds = new kakao.maps.LatLngBounds();
      bounds.extend(workPos);
      bounds.extend(new kakao.maps.LatLng(userPos.lat, userPos.lng));
      map.setBounds(bounds, 60, 60, 60, 60);
    } else {
      map.setCenter(workPos);
      map.setLevel(3); // 100m 반경 원이 화면에 잘 들어오는 확대 수준
    }
  }, [ready, accountCoordinate, userPos]);

  if (loadError) {
    return (
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="center"
        sx={{ height: "100%", bgcolor: "#f5f5f5" }}
      >
        <MDTypography variant="caption" color="error">
          지도를 불러오지 못했습니다. ({loadError})
        </MDTypography>
      </MDBox>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

function RecordCommuteSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ account_id가 없는 계정(본사 등 특정 사업장에 소속되지 않은 계정)은 "HQ"로 취급
  const HEAD_OFFICE_ACCOUNT_ID = "HQ";

  const userId = (window.localStorage.getItem("user_id") || "").trim();
  const storedUserName = (window.localStorage.getItem("user_name") || "").trim();
  const storedAccountId = (window.localStorage.getItem("account_id") || "").trim();
  const positionCode = (window.localStorage.getItem("position") || "").trim();
  const departmentCode = (window.localStorage.getItem("department") || "").trim();

  // ✅ 기기등록 승인 권한: 대표님(0)/팀장(1), 또는 운영팀(5)/개발팀(6)
  const canApproveDevice = ["0", "1"].includes(positionCode) || ["5", "6"].includes(departmentCode);

  const {
    deviceInfo,
    todayStatus,
    deviceRequestList,
    accountList,
    fetchAccountList,
    fetchDeviceInfo,
    fetchTodayStatus,
    fetchAccountCoordinate,
    requestDevice,
    fetchDeviceRequestList,
    approveDevice,
    submitCommute,
    fetchRecordList,
    getDistanceInMeters,
  } = useRecordCommuteSheetData();

  // ✅ 이름 - 자유 텍스트 입력 (기존 로그인 정보가 있으면 기본값으로 채워둠)
  const [name, setName] = useState(storedUserName);
  const effectiveName = name.trim();

  // ✅ 근무지 - 거래처 검색 자동완성으로 선택
  const [selectedAccount, setSelectedAccount] = useState(null); // {account_id, account_name}
  const [accountQuery, setAccountQuery] = useState("");
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountPreselectedRef = useRef(false);

  const effectiveAccountId = selectedAccount?.account_id || (effectiveName ? HEAD_OFFICE_ACCOUNT_ID : "");

  // ✅ 근무지 목록 최초 1회 조회 + 로그인 정보에 있는 account_id로 기본 선택
  useEffect(() => {
    fetchAccountList();
  }, [fetchAccountList]);

  useEffect(() => {
    if (accountPreselectedRef.current) return;
    if (!storedAccountId || accountList.length === 0) return;
    const matched = accountList.find((a) => a.account_id === storedAccountId);
    if (matched) {
      setSelectedAccount(matched);
      accountPreselectedRef.current = true;
    }
  }, [accountList, storedAccountId]);

  // ✅ 근무지 기준 좌표 (지도 핀 + 거리 계산용)
  const [accountCoordinate, setAccountCoordinate] = useState(null); // {lat, lng}

  useEffect(() => {
    let cancelled = false;
    if (!selectedAccount?.account_id) {
      setAccountCoordinate(null);
      return undefined;
    }
    fetchAccountCoordinate(selectedAccount.account_id).then((target) => {
      if (cancelled || !target) return;
      setAccountCoordinate({ lat: target.yCoordinate, lng: target.xCoordinate });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedAccount, fetchAccountCoordinate]);

  // ✅ 현재 위치 - 지도/거리 표시를 위해 계속 추적
  const [userPos, setUserPos] = useState(null); // {lat, lng}
  const [locStatus, setLocStatus] = useState("idle"); // idle | requesting | granted | denied

  useEffect(() => {
    // ✅ 페이지 새로 들어올 때마다 이전에 남아있을 수 있는 값을 지우고 시작 - 브라우저/OS가
    //    들고 있던 캐시된 위치가 그대로 보이지 않도록 함
    setUserPos(null);

    if (!("geolocation" in window.navigator)) {
      setLocStatus("denied");
      return undefined;
    }
    setLocStatus("requesting");
    const watchId = window.navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("granted");
      },
      () => setLocStatus("denied"),
      // ✅ maximumAge: 0 - watchPosition의 첫 콜백조차 캐시된 옛날 위치를 재사용하지 않고
      //    반드시 새로 측정한 값만 받도록 함
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => window.navigator.geolocation.clearWatch(watchId);
  }, []);

  // ✅ 근무지까지 거리 - 멀면 출퇴근 버튼이 활성화되지 않음(클라이언트 표시/제어용, 서버는 감사기록으로만 사용)
  const distance =
    userPos && accountCoordinate
      ? getDistanceInMeters(accountCoordinate.lat, accountCoordinate.lng, userPos.lat, userPos.lng)
      : null;
  const inRange = distance !== null && distance <= GEOFENCE_M;
  const geofenceOk = locStatus === "granted" && !!accountCoordinate && inRange;

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
    if (!effectiveAccountId || !effectiveName) return;
    await Promise.all([
      fetchDeviceInfo(effectiveAccountId, effectiveName),
      fetchTodayStatus(effectiveName, effectiveAccountId),
    ]);
  }, [effectiveName, effectiveAccountId, fetchDeviceInfo, fetchTodayStatus]);

  // ✅ 등록/승인/반려/출근/퇴근 등 뭔가 하나라도 하면 화면 전체(내 상태 + 승인대기 목록)를 다시 조회
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshMyStatus(), canApproveDevice ? fetchDeviceRequestList() : Promise.resolve()]);
  }, [refreshMyStatus, canApproveDevice, fetchDeviceRequestList]);

  // ✅ 최초 진입 시 1회 조회 (로그인 정보로 이름/근무지가 이미 채워져 있는 경우)
  useEffect(() => {
    if (!effectiveAccountId || !effectiveName) {
      setInitialLoading(false);
      return;
    }
    refreshAll().finally(() => setInitialLoading(false));
  }, []);

  // ✅ 이후 이름/근무지를 직접 바꾸면(최초 조회 이후) 다시 조회
  useEffect(() => {
    if (initialLoading) return;
    if (!effectiveAccountId || !effectiveName) return;
    refreshAll();
  }, [effectiveAccountId, effectiveName]);

  const isApproved = String(deviceInfo?.approve_yn ?? "N").toUpperCase() === "Y";
  const hasPendingRequest = !!deviceInfo?.pending_device_token;

  // ✅ 승인 대기중이면 몇 초마다 자동으로 재조회해서, 관리자가 승인하는 순간 화면이 알아서 바뀌게 함
  useEffect(() => {
    if (!hasPendingRequest) return undefined;
    const timer = setInterval(() => {
      fetchDeviceInfo(effectiveAccountId, effectiveName);
    }, 5000);
    return () => clearInterval(timer);
  }, [hasPendingRequest, effectiveAccountId, effectiveName, fetchDeviceInfo]);

  const checkedIn = !!todayStatus?.start_time;
  const checkedOut = !!todayStatus?.end_time;
  const inTime = todayStatus?.start_time;
  const outTime = todayStatus?.end_time;

  const nextType = !checkedIn ? "clockIn" : !checkedOut ? "clockOut" : null;

  const handleDeviceRequest = async () => {
    setRequesting(true);
    try {
      const deviceToken = getOrCreateDeviceToken();
      const deviceName = getDeviceLabel();
      const res = await requestDevice({
        user_name: effectiveName,
        account_id: effectiveAccountId,
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
    // ✅ 승인은 "계정(이름)" 기준이라, 폰에서 이미 승인된 계정으로 PC 등 다른 기기에서 접속하면
    //    화면엔 "승인됨"으로 보이지만 실제로는 이 기기가 아니라서 그대로 시도하면 서버가 조용히
    //    새 기기 등록 요청을 만들어버림 -> 시도 전에 먼저 물어보고 동의해야 진행
    const deviceTokenForCheck = getOrCreateDeviceToken();
    if (isApproved && deviceInfo?.device_token && deviceInfo.device_token !== deviceTokenForCheck) {
      const confirmResult = await Swal.fire({
        title: "다른 기기입니다",
        html: `이 계정은 다른 기기(${deviceInfo?.device_name || "등록된 기기"})로 승인되어 있습니다.<br/>이 기기를 새로 등록 요청하시겠습니까?<br/>관리자 승인 전까지는 출퇴근이 안 됩니다.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "등록 요청",
        cancelButtonText: "취소",
      });
      if (!confirmResult.isConfirmed) return;

      // ✅ 등록 요청만 넣고 끝 - 이 시점엔 아직 관리자 승인 전이라 그대로 출근/퇴근 시도로 넘어가면 안 됨
      await handleDeviceRequest();
      return;
    }

    setChecking(true);
    setCheckingAction(action);
    try {
      const target = selectedAccount?.account_id
        ? await fetchAccountCoordinate(selectedAccount.account_id)
        : null;
      const effectiveTarget = target || FALLBACK_TARGET;

      // ✅ 지도에서 이미 계속 위치를 추적(watchPosition)하고 있으므로, 그 값이 있으면 그대로 쓴다
      //    (매번 새로 GPS 픽스를 기다리면 "Timeout expired"가 잘 나서 느리고 잘 실패했음).
      //    아직 위치를 못 잡았을 때만 새로 한 번 요청한다.
      let latitude;
      let longitude;
      if (userPos) {
        ({ lat: latitude, lng: longitude } = userPos);
      } else {
        const position = await getCurrentPosition();
        ({ latitude, longitude } = position.coords);
      }

      const deviceToken = getOrCreateDeviceToken();

      const result = await submitCommute({
        account_id: effectiveAccountId,
        user_name: effectiveName,
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

  // ✅ 해당 월(month, dayjs) 기준으로 근태 기록 재조회
  const loadMonthRecords = useCallback(
    async (month) => {
      setRecordLoading(true);
      try {
        const list = await fetchRecordList({
          user_name: effectiveName,
          account_id: effectiveAccountId,
          start_date: month.startOf("month").format("YYYY-MM-DD"),
          end_date: month.endOf("month").format("YYYY-MM-DD"),
        });
        setRecordList(list);
      } finally {
        setRecordLoading(false);
      }
    },
    [effectiveName, effectiveAccountId, fetchRecordList]
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
      return <Chip label="등록기기 승인됨" color="success" size="small" />;
    }
    if (hasPendingRequest) {
      return <Chip label="기기 등록 승인 대기중" color="warning" size="small" />;
    }
    return <Chip label="등록기기 없음" color="error" size="small" />;
  }, [isApproved, hasPendingRequest, deviceInfo]);

  // ✅ 근무지 자동완성 검색 옵션
  const filteredAccounts = useMemo(() => {
    if (!accountQuery.trim()) return accountList;
    const q = accountQuery.trim().toLowerCase();
    return accountList.filter(
      (a) => a.account_name?.toLowerCase().includes(q) || a.account_id?.toLowerCase().includes(q)
    );
  }, [accountList, accountQuery]);

  // ✅ "거래처 검색" 화면(recordsheet)의 엔터 선택 로직과 동일: 완전일치 우선, 없으면 부분일치가 1개일 때만 선택
  const selectAccountByInput = useCallback(
    (rawInput) => {
      const q = String(rawInput ?? accountQuery ?? "").trim();
      if (!q) return;
      const list = accountList || [];
      const qLower = q.toLowerCase();
      const exact = list.find((a) => String(a?.account_name || "").toLowerCase() === qLower);
      let matched = exact;
      if (!matched) {
        const candidates = list.filter((a) =>
          String(a?.account_name || "")
            .toLowerCase()
            .includes(qLower)
        );
        // 부분일치 후보가 여럿이면(동명/유사 거래처) 잘못 선택되지 않도록 매칭하지 않음
        if (candidates.length === 1) matched = candidates[0];
      }
      if (matched) {
        setSelectedAccount(matched);
        setAccountQuery(matched.account_name || q);
      }
    },
    [accountList, accountQuery]
  );

  // ✅ 이름/근무지 입력 카드
  const InputCard = (
    <Card sx={{ borderRadius: 4, p: 2.5 }}>
      <MDBox display="flex" flexDirection="column" gap={2}>
        <MDBox>
          <MDTypography
            variant="button"
            fontWeight="bold"
            color="text"
            sx={{ fontSize: "0.95rem" }}
          >
            이름
          </MDTypography>
          <TextField
            fullWidth
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            sx={{ mt: 0.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <User size={15} color="#9AA0AC" />
                </InputAdornment>
              ),
            }}
          />
        </MDBox>

        <MDBox>
          <MDTypography
            variant="button"
            fontWeight="bold"
            color="text"
            sx={{ fontSize: "0.95rem" }}
          >
            근무지
          </MDTypography>
          <Autocomplete
            size="small"
            open={accountDropdownOpen}
            onOpen={() => setAccountDropdownOpen(true)}
            onClose={() => setAccountDropdownOpen(false)}
            options={filteredAccounts}
            value={selectedAccount}
            onChange={(_, newVal) => setSelectedAccount(newVal)}
            onInputChange={(_, newValue) => setAccountQuery(newValue)}
            getOptionLabel={(opt) => opt?.account_name || ""}
            isOptionEqualToValue={(opt, val) => opt?.account_id === val?.account_id}
            noOptionsText="검색 결과가 없습니다"
            sx={{ mt: 0.5 }}
            renderOption={(props, option) => (
              <li {...props} key={option.account_id}>
                <MDBox display="flex" alignItems="center" gap={1}>
                  <Building2 size={15} color={COMMUTE_PURPLE} />
                  <MDTypography variant="button" fontWeight="medium">
                    {option.account_name}
                  </MDTypography>
                </MDBox>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="거래처 검색..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.nativeEvent?.isComposing) return;
                    e.preventDefault();
                    selectAccountByInput(e.currentTarget.value);
                    setAccountDropdownOpen(false);
                  }
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={15} color="#9AA0AC" style={{ marginLeft: 8 }} />
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
        </MDBox>
      </MDBox>
    </Card>
  );

  // ✅ 지도 카드 - 근무지 핀 + 반경 + 내 현재위치, 하단에 거리/상태 표시 (카카오맵)
  const MapCard = (
    <Card sx={{ borderRadius: 4, overflow: "hidden" }}>
      <MDBox sx={{ position: "relative", height: 220 }}>
        <KakaoMapView accountCoordinate={accountCoordinate} userPos={userPos} />

        {!accountCoordinate && (
          <MDBox
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(255,255,255,0.65)",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <MapPin size={28} color="#c9c9c9" />
            <MDTypography variant="caption" color="text" mt={1}>
              근무지를 선택하면 지도에 표시됩니다
            </MDTypography>
          </MDBox>
        )}
      </MDBox>

      <MDBox sx={{ px: 2, py: 1.2, borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 1, minHeight: 36 }}>
        {locStatus === "requesting" && (
          <>
            <CircularProgress size={13} sx={{ color: "#9AA0AC" }} />
            <MDTypography variant="caption" color="text">
              위치 정보 수신 중…
            </MDTypography>
          </>
        )}
        {locStatus === "granted" && distance !== null && (
          <>
            {inRange ? <CheckCircle2 size={13} color="#1FA45C" /> : <AlertCircle size={13} color="#E5566B" />}
            <MDTypography variant="caption" fontWeight="medium" sx={{ color: inRange ? "#1FA45C" : "#E5566B" }}>
              근무지까지 {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`}
              {inRange ? " — 출퇴근 가능" : ` — ${GEOFENCE_M}m 이내만 출퇴근 가능`}
            </MDTypography>
          </>
        )}
        {locStatus === "granted" && distance === null && (
          <MDTypography variant="caption" color="text">
            근무지를 선택하면 거리가 표시됩니다
          </MDTypography>
        )}
        {locStatus === "denied" && (
          <>
            <AlertCircle size={13} color="#f0ad4e" />
            <MDTypography variant="caption" sx={{ color: "#f0ad4e" }}>
              위치 권한 없음 — 출퇴근 버튼이 비활성화됩니다
            </MDTypography>
          </>
        )}
        {locStatus === "idle" && (
          <MDTypography variant="caption" color="text">
            위치 확인 중…
          </MDTypography>
        )}
      </MDBox>
    </Card>
  );

  // ✅ 출퇴근 버튼 카드
  const canClockIn = isApproved && !checking && nextType === "clockIn" && geofenceOk;
  const canClockOut = isApproved && !checking && nextType === "clockOut" && geofenceOk;

  const CommuteCard = (
    <Card sx={{ borderRadius: 4, p: isMobile ? 2.5 : 3 }}>
      <MDBox display="flex" flexDirection="column" alignItems="center" gap={2}>
        {/* ✅ 한 줄: 근태 기록(왼쪽) - 이름(가운데) - 등록기기 상태(오른쪽) */}
        <MDBox width="100%" display="flex" alignItems="center" justifyContent="space-between" gap={1}>
          <MDBox flexShrink={0}>
            <Chip
              icon={<span style={{ marginLeft: 6 }}>🗓️</span>}
              label="근태 기록"
              onClick={openRecordModal}
              clickable
              sx={{ bgcolor: "#F1EFFD", color: COMMUTE_PURPLE, fontWeight: "bold" }}
            />
          </MDBox>

          <MDBox flexGrow={1} textAlign="center" sx={{ minWidth: 0 }}>
            {name && (
              <MDTypography
                variant="h6"
                fontWeight="bold"
                noWrap
                sx={{ color: COMMUTE_PURPLE }}
              >
                {name}
              </MDTypography>
            )}
          </MDBox>

          <MDBox flexShrink={0}>{deviceStatusChip}</MDBox>
        </MDBox>

        {!isApproved && effectiveAccountId && effectiveName && (
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

        {/* ✅ 출근/퇴근 버튼 - 나란히, 위 시각 박스와 같은 색으로 구분(출근=초록/퇴근=빨강)
              근무지에서 너무 멀면(geofenceOk === false) 활성화되지 않는다 */}
        <MDBox width="100%" display="flex" gap={1.5} mt={1}>
          <MDButton
            fullWidth
            disabled={!canClockIn}
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
            disabled={!canClockOut}
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
          // ✅ 달력 주(週) 수가 4~6줄로 매달 달라져서 모달 전체 높이가 바뀌는데,
          //    top:50% + translateY(-50%)(실제 높이 기준)로 매번 다시 세로 중앙정렬하면 그때마다
          //    상단(화살표/제목)이 위아래로 움직여 보임 -> 화면 세로 50% 지점에서 "고정된 픽셀 값"만큼만
          //    올려서 앉히면(실제 렌더 높이와 무관한 상수), 화면상 대략 가운데면서도 상단은 흔들리지 않음
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
          <MDTypography variant="h6">🗓️ {calendarMonth.format("YYYY년 M월")} 근태 기록</MDTypography>
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

  // ✅ 최초 조회 끝나기 전에는 "등록기기 없음" 같은 잘못된 중간 상태가 안 보이게 로딩화면으로 가림
  if (initialLoading) return <LoadingScreen />;

  // ✅ 관리자용 등록기기 승인 대기 목록 (권한자에게만 표시)
  const ApprovalCard = canApproveDevice && (
    <Card sx={{ borderRadius: 4, p: 3, width: "100%" }}>
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
                  요청일시: {row.request_dt ? dayjs(row.request_dt).format("YYYY-MM-DD HH:mm") : "-"}
                </MDTypography>
              </MDBox>
              <MDBox display="flex" gap={1}>
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

  // ✅ ERP 화면(사이드바/헤더) 위를 완전히 덮는 독립 화면 - 네비바 없이 이 화면만 보이게 함
  return (
    <MDBox
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        overflowY: "auto",
        bgcolor: "#F0F2F5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 4,
        px: 2,
      }}
    >
      <MDBox width="100%" maxWidth={420} display="flex" flexDirection="column" gap={1.5}>
        {/* 타이틀 - 좌우로 꽉 채움 */}
        <MDBox
          width="100%"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={1}
          sx={{
            bgcolor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 999,
            px: 2.5,
            py: 1,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <MDBox
            component="img"
            src="/thefull_logo.webp"
            alt="더채움"
            sx={{ height: 28, width: "auto" }}
          />
          <MDTypography variant="button" fontWeight="bold" sx={{ fontSize: "0.95rem", color: "#4B5563" }}>
            더채움 근태 기록
          </MDTypography>
        </MDBox>

        <MDTypography variant="button" fontWeight="bold" textAlign="center" color="text" sx={{ fontSize: "0.95rem" }}>
          {dayjs().format("YYYY년 M월 D일")} {KOREAN_WEEKDAYS[dayjs().day()]}요일
        </MDTypography>

        {InputCard}
        {MapCard}
        {CommuteCard}

        {canApproveDevice && !isMobile && ApprovalCard}
      </MDBox>

      {canApproveDevice && isMobile && (
        <MDBox width="100%" maxWidth={420} mt={1.5}>
          {ApprovalCard}
        </MDBox>
      )}

      {RecordModal}
      {ProcessingModal}
    </MDBox>
  );
}

export default RecordCommuteSheet;
