import { useState, useCallback } from "react";
import api from "api/api";

// ✅ haversine 거리(m) - 모바일앱(thefull-m) attendance.tsx 와 동일한 계산식
const getDistanceInMeters = (latitudeA, longitudeA, latitudeB, longitudeB) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);

  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  const angle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadius * angle;
};

// ✅ 출퇴근(모바일 GPS 체크인) 화면에서 사용하는 API 호출 모음
//    - 엔드포인트는 /Account/* 로 통일 (기존 /User/*, /Commute/*)
//    - ⚠️ 모바일앱(thefull-m)도 동일 엔드포인트(/Account/AccountCoordinateInfo, /Account/CommuteSave)를 쓰므로
//      모바일 쪽 호출 경로도 함께 변경해야 한다 (이 저장소에는 없어 별도 반영 필요)
//    - 식별 기준은 user_id(로그인 계정)가 아니라 account_id + user_name(이름)
export default function useRecordCommuteData() {
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [deviceRequestList, setDeviceRequestList] = useState([]);
  const [deviceList, setDeviceList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 내 등록기기(승인/요청) 상태 조회 (account_id + user_name + phone_last4 기준 - 동명이인 구분용)
  const fetchDeviceInfo = useCallback(async (account_id, user_name, phone_last4) => {
    if (!account_id || !user_name || !phone_last4) return null;
    try {
      const res = await api.get("/Account/CommuteDeviceInfo", {
        params: { account_id, user_name, phone_last4 },
      });
      const data = res.data && res.data.user_name ? res.data : null;
      setDeviceInfo(data);
      return data;
    } catch (e) {
      console.error("등록기기 조회 실패:", e);
      setDeviceInfo(null);
      return null;
    }
  }, []);

  // ✅ 오늘 출퇴근 진행상태 조회 (account_id + user_name + phone_last4 기준 - 동명이인 구분용)
  const fetchTodayStatus = useCallback(async (user_name, account_id, phone_last4) => {
    if (!user_name || !account_id || !phone_last4) return null;
    try {
      const res = await api.get("/Account/CommuteTodayStatus", {
        params: { user_name, account_id, phone_last4 },
      });
      const data = res.data && res.data.t_date ? res.data : null;
      setTodayStatus(data);
      return data;
    } catch (e) {
      console.error("출퇴근 상태 조회 실패:", e);
      setTodayStatus(null);
      return null;
    }
  }, []);

  // ✅ 사업장 기준 좌표 조회 (모바일과 동일 엔드포인트)
  const fetchAccountCoordinate = useCallback(async (account_id) => {
    const res = await api.post("/Account/AccountCoordinateInfo", { account_id });
    const data = res.data || {};
    const x = Number(data.x_coordinate);
    const y = Number(data.y_coordinate);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { xCoordinate: x, yCoordinate: y };
  }, []);

  // ✅ 등록기기 등록/변경 요청
  const requestDevice = useCallback(
    async ({ user_name, account_id, phone_last4, device_token, device_name }) => {
      const res = await api.post("/Account/CommuteDeviceRequest", {
        user_name,
        account_id,
        phone_last4,
        device_token,
        device_name,
      });
      return res.data;
    },
    []
  );

  // ✅ (관리자) 승인 대기 등록기기 요청 목록
  const fetchDeviceRequestList = useCallback(async () => {
    try {
      const res = await api.get("/Account/CommuteDeviceRequestList");
      const list = Array.isArray(res.data) ? res.data : [];
      setDeviceRequestList(list);
      return list;
    } catch (e) {
      console.error("등록기기 요청 목록 조회 실패:", e);
      setDeviceRequestList([]);
      return [];
    }
  }, []);

  // ✅ (관리자) 승인 완료된 등록기기(사람+기기) 전체 목록
  const fetchDeviceList = useCallback(async () => {
    try {
      const res = await api.get("/Account/CommuteDeviceList");
      const list = Array.isArray(res.data) ? res.data : [];
      setDeviceList(list);
      return list;
    } catch (e) {
      console.error("등록기기 목록 조회 실패:", e);
      setDeviceList([]);
      return [];
    }
  }, []);

  // ✅ (관리자) 등록기기 승인/반려 - phone_last4까지 같이 보내야 동명이인 중 정확한 대상 행을 찾는다
  const approveDevice = useCallback(
    async ({ account_id, user_name, phone_last4, approve, approve_user_id }) => {
      const res = await api.post("/Account/CommuteDeviceApprove", {
        account_id,
        user_name,
        phone_last4,
        approve,
        approve_user_id,
      });
      return res.data;
    },
    []
  );

  // ✅ 출근/퇴근 저장 (모바일과 동일 페이로드 + device_token/device_name/phone_last4 추가)
  //    거리 오차(error_margin)는 클라이언트에서 계산해서 함께 보낸다(모바일과 동일 방식).
  //    - 출퇴근 기록(tb_commute_record)은 user_id가 아니라 account_id + user_name + phone_last4로 식별한다
  //      (phone_last4: 동명이인 구분용 휴대폰 뒷자리 4자리).
  const submitCommute = useCallback(
    async ({ account_id, user_name, phone_last4, action, target, location, device_token, device_name }) => {
      const errorMargin = target
        ? Math.round(
            getDistanceInMeters(target.yCoordinate, target.xCoordinate, location.latitude, location.longitude)
          )
        : null;

      // ✅ toISOString()은 UTC 기준이라 서버(KST)가 판단하는 "오늘"과 날짜가 어긋날 수 있음 -> 로컬(KST) 기준으로 계산
      //    (모바일앱 attendance.tsx의 getCurrentDateString/getCurrentTimeString과 동일한 방식)
      const now = new Date();
      const t_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(
        2,
        "0"
      )}:${String(now.getSeconds()).padStart(2, "0")}`;

      const payload =
        action === "clockIn"
          ? {
              t_date,
              start_time: timeStr,
              st_x_coordinate: location.longitude,
              st_y_coordinate: location.latitude,
              st_error_margin: errorMargin,
              account_id,
              user_name,
              phone_last4,
              device_token,
              device_name,
            }
          : {
              t_date,
              end_time: timeStr,
              ed_x_coordinate: location.longitude,
              ed_y_coordinate: location.latitude,
              ed_error_margin: errorMargin,
              account_id,
              user_name,
              phone_last4,
              device_token,
              device_name,
            };

      // ✅ 서버가 4xx 를 내려도(등록기기 미승인 등) 응답 메시지/사유(reason)를 그대로 쓸 수 있도록 axios 에러를 흡수
      try {
        const res = await api.post("/Account/CommuteSave", payload);
        return { ok: true, errorMargin, msg: res.data?.msg, reason: res.data?.reason };
      } catch (e) {
        const msg = e?.response?.data?.msg || e?.message || "출퇴근 저장 중 오류가 발생했습니다.";
        const reason = e?.response?.data?.reason;
        return { ok: false, errorMargin, msg, reason };
      }
    },
    []
  );

  // ✅ 출퇴근 기록 목록 조회 - account_id만 넘기고 user_name을 생략하면 그 업장 전체 인원의
  //    기록을 한 번에 받아온다(업장별 출퇴근 기록 탭에서 사용). account_id까지 생략하면 전체 업장.
  const fetchRecordList = useCallback(async (params) => {
    setLoading(true);
    try {
      const res = await api.get("/Account/CommuteRecordList", { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error("출퇴근 기록 조회 실패:", e);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    deviceInfo,
    todayStatus,
    deviceRequestList,
    deviceList,
    loading,
    fetchDeviceInfo,
    fetchTodayStatus,
    fetchAccountCoordinate,
    requestDevice,
    fetchDeviceRequestList,
    fetchDeviceList,
    approveDevice,
    submitCommute,
    fetchRecordList,
    // ✅ 지도 화면에서 "근무지까지 거리" 표시용으로 submitCommute와 동일한 계산식을 그대로 재사용
    getDistanceInMeters,
  };
}
