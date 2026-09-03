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
      const rows = (res.data || []).map((item) => ({
        account_id: item.account_id,
        account_name: item.account_name,
      }));
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
    accountList,
    loading,
    fetchAccountList,
    fetchRecordList,
  };
}
