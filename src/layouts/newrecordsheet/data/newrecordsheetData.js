/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "api/api";

// 숫자 파싱
const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// 숫자 포맷
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useNewRecordsheetData() {
  const [memberRows, setMemberRows] = useState([]);
  const [dispatchRows, setDispatchRows] = useState([]);
  const [sheetRows, setSheetRows] = useState([]); // 출근현황
  const { account_id } = useParams();

  useEffect(() => {
    // 직원정보
    api
      .get("/User/UserMemberList", {
        params: { account_id },
      })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          user_id: item.user_id,
          user_name: item.user_name,
          join_dt: item.join_dt || "",
          position: item.position || "",
          total_leave: item.total_leave || "",
          leave_remain: item.leave_remain || "",
          leave_use: item.leave_use,
        }));
        setMemberRows(rows);
      })
      .catch((err) => console.error("직원정보 조회 실패:", err));

    // 출근현황
    api
      .get("/User/UserRecordSheetList", {
        params: { account_id },
      })
      .then((res) => {
        const data = res.data || [];
        // 직원별로 날짜를 키로 매핑
        const grouped = {};
        data.forEach((item) => {
          if (!grouped[item.user_name]) grouped[item.user_name] = {};
          grouped[item.user_name][`day_${item.record_date}`] = {
            start_time: item.start_time,
            end_time: item.end_time,
            leave_use: item.leave_use,
            leave_type: item.leave_type.toLocaleString(), // 1: 정상, 5: 결근 등
          };
        });

        // 직원별 row 생성
        const rows = Object.keys(grouped).map((user_name) => ({
          user_name,
          days: grouped[user_name],
        }));

        setSheetRows(rows);
      })
      .catch((err) => console.error("출근현황 조회 실패:", err));
  }, [account_id]);

  return { memberRows, setMemberRows, dispatchRows, setDispatchRows, sheetRows, setSheetRows };
}

export { parseNumber, formatNumber };
