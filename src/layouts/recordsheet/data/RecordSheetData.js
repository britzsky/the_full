import { useState, useEffect } from "react";
import api from "api/api";

export default function useRecordsheetData(account_id, year, month) {
  const [memberRows, setMemberRows] = useState([]);
  const [dispatchRows, setDispatchRows] = useState([]);
  const [sheetRows, setSheetRows] = useState([]);
  const [timesRows, setTimesRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  const safeStr = (v, fallback = "") => (v == null ? fallback : String(v));
  const safeTrim = (v, fallback = "") => safeStr(v, fallback).trim();

  // ✅ 전체 데이터 조회
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

      const [memberRes, dispatchRes, timesRes, sheetRes] = await Promise.all([
        memberReq,
        dispatchReq,
        timesReq,
        sheetReq,
      ]);

      // ✅ 직원정보
      setMemberRows(
        (memberRes.data || []).map((item) => ({
          member_id: item.member_id,
          name: item.name,
          position: item.position,
          del_yn: item.del_yn ?? "",
          working_day: item.working_day,
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
          salary: item.salary,
          dispatch_account: item.dispatch_account,
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

      // ✅ 출근현황: member_id 기준으로 그룹핑 (중요!)
      const data = sheetRes.data || [];
      const grouped = {}; // key: member_id

      data.forEach((item, idx) => {
        const mid = safeTrim(item.member_id, `tmp_${idx}`);
        if (!grouped[mid]) {
          grouped[mid] = {
            member_id: mid,
            name: item.name || `member_${mid}`,
            account_id: item.account_id || "",
            position: item.position || "",
            del_yn: item.del_yn ?? "",
            // ✅ row-level 고정값(없으면 나중에 days에서 다시 추론)
            gubun: safeTrim(item.gubun, ""),
            position_type: safeTrim(item.position_type, ""),
            days: {},
          };
        }

        const dayNum = Number(item.record_date);
        const key = !dayNum || dayNum <= 0 ? "day_default" : `day_${dayNum}`;

        grouped[mid].days[key] = {
          start_time: item.start_time || "",
          end_time: item.end_time || "",
          type: item.type != null ? String(item.type) : "",
          salary: item.salary || "",
          note: item.note || "",
          pay_yn: item.pay_yn || "",
          member_id: mid,
          account_id: item.account_id || "",
          // ✅ 반드시 문자열로
          position_type: safeTrim(item.position_type, ""),
          gubun: safeTrim(item.gubun, ""),
        };
      });

      const rows = Object.values(grouped).map((g) => {
        const dayValues = g.days || {};

        // ✅ row-level gubun/position_type을 days에서 보정(없을 때)
        const anyDay =
          Object.values(dayValues).find((v) => v && (v.gubun || v.position_type)) || {};
        const rowGubun =
          safeTrim(g.gubun, "") ||
          safeTrim(dayValues.day_default?.gubun, "") ||
          safeTrim(anyDay.gubun, "nor") ||
          "nor";

        const rowPt =
          safeTrim(g.position_type, "") ||
          safeTrim(dayValues.day_default?.position_type, "") ||
          safeTrim(anyDay.position_type, "") ||
          "";

        // ✅ flatDays 생성: 각 day에 start/end를 추가 + gubun/position_type fallback 적용
        const flatDays = Object.fromEntries(
          Object.entries(dayValues)
            .filter(([k]) => k.startsWith("day_") && k !== "day_default")
            .map(([key, val]) => [
              key,
              {
                ...val,
                // ✅ 여기서도 보정
                gubun: safeTrim(val?.gubun, rowGubun),
                position_type: safeTrim(val?.position_type, rowPt),
                start: val?.start_time || "",
                end: val?.end_time || "",
                defaultStart: val?.start_time || "",
                defaultEnd: val?.end_time || "",
              },
            ])
        );

        const dayDefault = dayValues.day_default
          ? {
            ...dayValues.day_default,
            gubun: safeTrim(dayValues.day_default.gubun, rowGubun),
            position_type: safeTrim(dayValues.day_default.position_type, rowPt),
          }
          : null;

        return {
          name: g.name,
          account_id: g.account_id,
          member_id: g.member_id,
          position: g.position,
          del_yn: g.del_yn ?? "",
          // ✅ row-level 확정값 (저장 fallback용)
          gubun: rowGubun,
          position_type: rowPt,
          days: dayValues,
          ...flatDays,
          day_default: dayDefault,
        };
      });

      setSheetRows(rows);
    } catch (error) {
      console.error("데이터 조회 실패:", error);
    } finally {
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
