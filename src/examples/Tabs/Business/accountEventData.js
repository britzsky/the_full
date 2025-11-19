/* eslint-disable react/function-component-definition */
import { useState } from "react";
import api from "api/api";

// 숫자 포맷이 필요하면 그대로 사용 가능
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useAccountEventData() {
  const [accountList, setAccountList] = useState([]);
  const [eventRows, setEventRows] = useState([]);
  const [originalEventRows, setOriginalEventRows] = useState([]);  // ⭐ 추가됨
  const [loading, setLoading] = useState(false);

  // ✅ 거래처 목록 조회
  const fetchAccountList = async () => {
    try {
      const res = await api.get("/Account/AccountList", {
        params: { account_type: 0 },
      });
      setAccountList(res.data || []);
    } catch (err) {
      console.error("AccountList 조회 실패:", err);
      setAccountList([]);
    }
  };

  // ✅ 행사 목록 조회 (account_id 기준)
  const fetchEventList = async (account_id) => {
    if (!account_id) {
      setEventRows([]);
      setOriginalEventRows([]);  // ⭐ 원본도 초기화
      return [];
    }

    setLoading(true);
    try {
      const res = await api.get(
        "/Business/AccountEventList",
        { params: { account_id } }
      );

      const rows = (res.data || []).map((item) => ({
        account_id: item.account_id,
        event_id: item.event_id,
        event_name: item.event_name,
        event_dt: item.event_dt,
        images: Array.isArray(item.images) ? item.images : [],
      }));

      // 화면에 표시되는 값 저장
      setEventRows(rows);

      // ⭐ 원본 Deep Copy 저장 (변경 여부 비교용)
      const originalCopy = JSON.parse(JSON.stringify(rows));
      setOriginalEventRows(originalCopy);

      return rows;
    } catch (err) {
      console.error("EventList 조회 실패:", err);
      setEventRows([]);
      setOriginalEventRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    accountList,
    eventRows,
    originalEventRows,        // ⭐ 반환
    setEventRows,
    setOriginalEventRows,      // ⭐ 반환
    loading,
    setLoading,
    fetchAccountList,
    fetchEventList,
  };
}

export { formatNumber };
