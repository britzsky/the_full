import { useState, useCallback } from "react";
import api from "api/api";

// ✅ 출퇴근 기록(업장별 달력) 탭에서 사용하는 API 호출 모음.
//    recordcommutedata.js(기기 관리 탭 전용)와는 별도로, 이 탭에서 실제로 쓰는 것만 둔다.
export default function useRecordCommuteHistoryData() {
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 근무지(거래처) 검색용 목록 - "거래처 검색" 화면(recordsheet)과 동일한 API
  const fetchAccountList = useCallback(async () => {
    try {
      const res = await api.get("/Account/AccountList", { params: { account_type: "0" } });
      const rows = (res.data || [])
        .map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }))
        // ✅ 가나다순 정렬 - API가 정렬해서 안 주므로 프론트에서 처리
        .sort((a, b) => String(a.account_name || "").localeCompare(String(b.account_name || ""), "ko"));
      setAccountList(rows);
      return rows;
    } catch (e) {
      console.error("거래처 목록 조회 실패:", e);
      setAccountList([]);
      return [];
    }
  }, []);

  // ✅ 출퇴근 기록 목록 조회 - account_id만 넘기고 user_name을 생략하면 그 업장 전체 인원의
  //    기록을 한 번에 받아온다(업장별 출퇴근 기록 탭에서 사용). account_id까지 생략하면 전체 업장.
  //    silent=true면 화면 로딩 상태를 바꾸지 않는다(엑셀 다운로드용 일괄 조회).
  const fetchRecordList = useCallback(async (params, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/Account/CommuteRecordList", { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error("출퇴근 기록 조회 실패:", e);
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // 출근부 인원(직원/파출)의 휴대폰 뒷자리 4자리 목록 조회 - 출퇴근 기록과 이름+뒷자리 매칭용
  const fetchMemberPhoneList = useCallback(async (params) => {
    try {
      const res = await api.get("/Account/CommuteMemberPhoneList", { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error("휴대폰 뒷자리 조회 실패:", e);
      return [];
    }
  }, []);

  // 출근부(recordsheet)에 입력된 업장 인원별 일자 근무타입/시간을 조회하는 함수
  //    응답은 직원 × 일자 1행(long 형태)이며 record_date는 일(day) 숫자다.
  const fetchRecordSheetList = useCallback(async (params) => {
    try {
      const res = await api.get("/Account/AccountRecordSheetList", { params });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error("출근부 조회 실패:", e);
      return [];
    }
  }, []);

  return {
    accountList,
    loading,
    fetchAccountList,
    fetchRecordList,
    fetchRecordSheetList,
    fetchMemberPhoneList,
  };
}
