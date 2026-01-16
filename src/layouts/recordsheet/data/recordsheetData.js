import { useState, useEffect } from "react";
import api from "api/api";

export default function useRecordsheetData(account_id, year, month) {
  const [memberRows, setMemberRows] = useState([]);
  const [dispatchRows, setDispatchRows] = useState([]);
  const [sheetRows, setSheetRows] = useState([]);
  const [timesRows, setTimesRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 전체 데이터 조회 (async/await + Promise.all 전환)
  const fetchAllData = async () => {
    if (!account_id) return;
    setLoading(true);

    try {
      const memberReq = api.get("/Account/AccountRecordMemberList", {
        params: { account_id, year, month },
      });

      const dispatchReq = api.get("/Account/AccountRecordDispatchList", {
        params: { account_id, year, month, del_yn: "N" },
      });

      const timesReq = api.get("/Account/AccountMemberRecordTime", {
        params: { account_id },
      });

      const sheetReq = api.get("/Account/AccountRecordSheetList", {
        params: { account_id, year, month },
      });

      // ✅ 모든 요청이 완료될 때까지 기다린 후 결과 받음
      const [memberRes, dispatchRes, timesRes, sheetRes] = await Promise.all([
        memberReq,
        dispatchReq,
        timesReq,
        sheetReq,
      ]);

      // ✅ 직원정보
      setMemberRows(
        (memberRes.data || []).map((item) => ({
          member_id: item.member_id, // ✅ 추가
          name: item.name,
          position: item.position,
          employ_dispatch: item.employ_dispatch || "",
          over_work: item.over_work || "",
          non_work: item.non_work || "",
          note: item.note || "",
        }))
      );

      // ✅ 파출정보
      setDispatchRows(
        (dispatchRes.data || []).map((item) => ({
          account_id: item.account_id,
          member_id: item.member_id,
          name: item.name,
          rrn: item.rrn,
          account_number: item.account_number,
          phone: item.phone,
          total: item.total,
          del_yn: item.del_yn,
        }))
      );

      // ✅ 출퇴근 기본시간
      setTimesRows(
        (timesRes.data || []).map((item) => ({
          account_id: item.account_id,
          member_id: item.member_id,
          start_time: item.start_time,
          end_time: item.end_time,
        }))
      );

      // ✅ 출근현황 sheetRows로 변환
      const data = sheetRes.data || [];
      const grouped = {};
      data.forEach((item) => {
        const name = item.name || `member_${item.member_id || Math.random()}`;
        if (!grouped[name]) grouped[name] = {};

        const dayNum = Number(item.record_date);
        const key = !dayNum || dayNum <= 0 ? "day_default" : `day_${dayNum}`;

        grouped[name][key] = {
          start_time: item.start_time || "",
          end_time: item.end_time || "",
          type: item.type != null ? String(item.type) : "",
          salary: item.salary || "",
          note: item.note || "",
          member_id: item.member_id || "",
          account_id: item.account_id || "",
        };
      });

      const rows = Object.keys(grouped).map((name) => {
        const firstItem = data.find((d) => d.name === name) || {};
        const dayValues = grouped[name];

        const flatDays = Object.fromEntries(
          Object.entries(dayValues)
            .filter(([k]) => k.startsWith("day_") && k !== "day_default")
            .map(([key, val]) => [
              key,
              {
                ...val,
                start: val.start_time || "",
                end: val.end_time || "",
                defaultStart: val.start_time || "",
                defaultEnd: val.end_time || "",
              },
            ])
        );

        return {
          name,
          account_id: firstItem.account_id || "",
          member_id: firstItem.member_id || "",
          position: firstItem.position || "", // ✅ 여기 추가
          days: dayValues,
          ...flatDays,
          day_default: dayValues.day_default || null,
        };
      });

      setSheetRows(rows);
    } catch (error) {
      console.error("데이터 조회 실패:", error);
    } finally {
      // ✅ 모든 axios 요청이 끝난 후에 로딩 false
      setLoading(false);
    }
  };

  // ✅ 계정 목록 최초 1회 조회
  useEffect(() => {
    api
      .get("/Account/AccountList", {
        params: { account_type: "0" },
      })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(rows);
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  // ✅ account_id, year, month 변경 시 자동 조회
  useEffect(() => {
    fetchAllData();
  }, [account_id, year, month]);

  return {
    memberRows,
    setMemberRows,
    dispatchRows,
    setDispatchRows,
    sheetRows,
    setSheetRows,
    timesRows,
    setTimesRows,
    accountList,
    fetchAllData,
    loading,
  };
}
