import { useState, useEffect, useRef } from "react";
import api from "api/api";
import { fetchFieldBoardAccountList } from "utils/fieldBoardAccountFilter";

export default function useRecordsheetData(account_id, year, month, suspendAccountListFetch = false) {
  const [memberRows, setMemberRows] = useState([]);
  const [dispatchRows, setDispatchRows] = useState([]);
  const [sheetRows, setSheetRows] = useState([]);
  const [timesRows, setTimesRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetchReqSeqRef = useRef(0);
  const safeStr = (v, fallback = "") => (v == null ? fallback : String(v));
  const safeTrim = (v, fallback = "") => safeStr(v, fallback).trim();

  // ✅ 전체 데이터 조회
  const fetchAllData = async () => {
    const mySeq = ++fetchReqSeqRef.current;
    if (!account_id) {
      if (mySeq === fetchReqSeqRef.current) setLoading(false);
      return;
    }
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
      if (mySeq !== fetchReqSeqRef.current) return;

      // ✅ 직원정보
      setMemberRows(
        (memberRes.data || []).map((item) => ({
          member_id: safeTrim(item.member_id ?? item.memberId ?? "", ""),
          name: item.name,
          position: item.position,
          cor_type: safeTrim(item.cor_type ?? item.corType ?? "", ""),
          del_yn: item.del_yn ?? "",
          del_dt: safeTrim(item.del_dt ?? "", ""),
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

      // ✅ 출근현황: member_id 기준 그룹핑
      const data = sheetRes.data || [];
      const grouped = {};

      data.forEach((item, idx) => {
        const mid = safeTrim(item.member_id, `tmp_${idx}`);
        if (!grouped[mid]) {
          grouped[mid] = {
            member_id: mid,
            name: item.name || `member_${mid}`,
            account_id: item.account_id || "",
            position: item.position || "",
            del_yn: item.del_yn ?? "",
            del_dt: safeTrim(item.del_dt ?? "", ""),
            act_join_dt: safeTrim(item.act_join_dt, ""),
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
          act_join_dt: safeTrim(item.act_join_dt, ""),
          member_id: mid,
          account_id: item.account_id || "",
          position_type: safeTrim(item.position_type, ""),
          gubun: safeTrim(item.gubun, ""),
          del_dt: safeTrim(item.del_dt ?? "", ""),
        };
      });

      const rows = Object.values(grouped).map((g) => {
        const dayValues = g.days || {};

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

        const rowActJoinDt =
          safeTrim(g.act_join_dt, "") ||
          safeTrim(dayValues.day_default?.act_join_dt, "") ||
          safeTrim(anyDay.act_join_dt, "") ||
          "";
        const rowDelDt =
          safeTrim(g.del_dt, "") ||
          safeTrim(dayValues.day_default?.del_dt, "") ||
          safeTrim(anyDay.del_dt, "") ||
          "";

        const flatDays = Object.fromEntries(
          Object.entries(dayValues)
            .filter(([k]) => k.startsWith("day_") && k !== "day_default")
            .map(([key, val]) => [
              key,
              {
                ...val,
                gubun: safeTrim(val?.gubun, rowGubun),
                position_type: safeTrim(val?.position_type, rowPt),
                start: val.start_time || "",
                end: val.end_time || "",
                defaultStart: val.start_time || "",
                defaultEnd: val.end_time || "",
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
          del_dt: rowDelDt,
          act_join_dt: rowActJoinDt,
          gubun: rowGubun,
          position_type: rowPt,
          days: dayValues,
          ...flatDays,
          day_default: dayDefault,
        };
      });

      setSheetRows(rows);
    } catch (error) {
      if (mySeq !== fetchReqSeqRef.current) return;
      console.error("데이터 조회 실패:", error);
    } finally {
      if (mySeq === fetchReqSeqRef.current) setLoading(false);
    }
  };

  // ✅ 계정 목록 조회
  // ✅ 보강 분기: 상위(RecordSheetTab) account_id 복구 중 목록 조회 일시 중단
  useEffect(() => {
    if (suspendAccountListFetch) {
      setAccountList([]);
      return;
    }

    fetchFieldBoardAccountList({ endpoint: "/Account/AccountList", accountType: "0" })
      .then((list) => {
        const rows = (list || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(rows);
      })
      .catch((err) => {
        console.error("데이터 조회 실패 (AccountList):", err);
        setAccountList([]);
      });
  }, [suspendAccountListFetch]);

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
