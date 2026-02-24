import { useState, useEffect } from "react";
import api from "api/api";
import { fetchFieldBoardAccountList } from "./fieldBoardAccountFilter";

export default function useRecordsheetData(account_id, year, month) {
  const [memberRows, setMemberRows] = useState([]);
  const [dispatchRows, setDispatchRows] = useState([]);
  const [sheetRows, setSheetRows] = useState([]);
  const [timesRows, setTimesRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

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
          phone: item.phone,
          rrn: item.rrn,
          account_number: item.account_number,
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
          // ✅ 실입사일 잠금 판단을 위해 day 데이터에도 보관
          act_join_dt: item.act_join_dt || "",

          member_id: item.member_id || "",
          account_id: item.account_id || "",

          // ✅ 핵심: 조회 데이터에서 넘어온 값 보존
          gubun: item.gubun ?? "nor",
          position_type: item.position_type ?? "",
          position: item.position ?? "",
          del_yn: item.del_yn ?? "",
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

        // ✅ row 레벨 기본값도 같이 세팅해두면 프론트에서 상속하기 편함
        const baseGubun = String(dayValues.day_default?.gubun ?? firstItem.gubun ?? "nor")
          .trim()
          .toLowerCase();

        const basePosType = String(
          dayValues.day_default?.position_type ?? firstItem.position_type ?? ""
        ).trim();

        return {
          name,
          account_id: firstItem.account_id || "",
          member_id: firstItem.member_id || "",
          position: firstItem.position || "",
          del_yn: firstItem.del_yn ?? "",
          // ✅ row 단위로 실입사일을 올려서 탭에서 잠금/안내 모달에 사용
          act_join_dt: String(dayValues.day_default?.act_join_dt ?? firstItem.act_join_dt ?? "").trim(),

          // ✅ row 기본값
          gubun: baseGubun,
          position_type: basePosType,

          days: dayValues,
          ...flatDays,
          day_default: dayValues.day_default || null,
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
