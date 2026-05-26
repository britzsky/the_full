/* eslint-disable react/function-component-definition */
import { useState } from "react";
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

// ✅ 시간 포맷 통일(06:00 -> 6:00)
const normalizeTime = (t) => {
  if (!t) return "";
  return String(t).trim().replace(/^0(\d):/, "$1:");
};

export default function useAccountAnnualLeaveData() {
  const [accountMemberRows, setAccountMemberRows] = useState([]);
  const [annualLeaveRows, setAnnualLeaveRows] = useState([]);
  const [overTimeRows, setOverTimeRows] = useState([]);
  const [accountList, setAccountList] = useState([]);

  // ✅ 근무형태 목록
  const [accountWorkSystemList, setAccountWorkSystemList] = useState([]);

  const [loading, setLoading] = useState(false);

  // ✅ 근무형태 목록 조회
  const fetchAccountMemberWorkSystemList = async () => {
    try {
      const res = await api.get("/Operate/AccountMemberWorkSystemList", {
        params: { account_type: 0 },
      });

      // ✅ idx, work_system, start_time, end_time 로 정규화해서 저장
      const rows = (res.data || []).map((item) => ({
        idx: item.idx,
        work_system: item.work_system,
        start_time: normalizeTime(item.start_time),
        end_time: normalizeTime(item.end_time),
      }));

      setAccountWorkSystemList(rows);
      return rows;
    } catch (err) {
      console.error("AccountMemberWorkSystemList 조회 실패:", err);
      setAccountWorkSystemList([]);
      return [];
    }
  };

  // ✅ 직원 목록 조회
  const fetchAccountMemberList = async (account_id) => {
    const params = {};
    if (account_id) params.account_id = account_id;
    params.del_yn = "N";

    setLoading(true);
    try {
      const res = await api.get("/Operate/AccountMemberAllList", { params });

      const wsMap = new Map(
        (accountWorkSystemList || []).map((w) => [String(w.idx), w])
      );

      const rows = (res.data || []).map((item) => {
        const ws = wsMap.get(String(item.idx));
        const account = (accountList || []).find(
          (acc) => String(acc.account_id) === String(item.account_id)
        );

        return {
          account_id: item.account_id,
          account_name: item.account_name || account?.account_name || "",
          member_id: item.member_id,
          name: item.name,
          position_type: item.position_type,
          contract_type: item.contract_type,
          join_dt: item.join_dt,

          // ✅ 근무형태 idx
          idx: item.idx,

          // ✅ start/end가 서버에서 비어있거나, 표준화가 필요하면 workSystemList 기준으로 보정
          start_time: normalizeTime(item.start_time) || ws?.start_time || "",
          end_time: normalizeTime(item.end_time) || ws?.end_time || "",
        };
      });

      setAccountMemberRows(rows);
      return rows;
    } catch (err) {
      console.error("AccountMemberAllList 조회 실패:", err);
      setAccountMemberRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnualLeaveList = async (member_id) => {
    const params = {};
    if (member_id) params.member_id = member_id;

    setLoading(true);
    try {
      const res = await api.get("/Operate/AnnualLeaveList", { params });
      const rows = (res.data || []).map((item) => ({
        ledger_id: item.ledger_id,
        member_id: item.member_id || "",
        ledger_dt: item.ledger_dt,
        type: item.type,
        days: item.days,
        reason: item.reason,
      }));
      setAnnualLeaveRows(rows);
      return rows;
    } catch (err) {
      console.error("AnnualLeaveList 조회 실패:", err);
      setAnnualLeaveRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchOverTimeList = async (member_id) => {
    const params = {};
    if (member_id) params.member_id = member_id;

    setLoading(true);
    try {
      const res = await api.get("/Operate/OverTimeList", { params });
      const rows = (res.data || []).map((item) => ({
        over_id: item.over_id,
        member_id: item.member_id || "",
        over_dt: item.over_dt,
        type: item.type,
        times: item.times,
        reason: item.reason,
      }));
      setOverTimeRows(rows);
      return rows;
    } catch (err) {
      console.error("OverTimeList 조회 실패:", err);
      setOverTimeRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountList = async () => {
    try {
      const res = await api.get("/Account/AccountList", {
        params: { account_type: 0 },
      });
      setAccountList(res.data || []);
      return res.data || [];
    } catch (err) {
      console.error("AccountList 조회 실패:", err);
      setAccountList([]);
      return [];
    }
  };

  return {
    accountMemberRows,
    annualLeaveRows,
    overTimeRows,
    accountList,

    // ✅ 추가
    accountWorkSystemList,
    fetchAccountMemberWorkSystemList,

    loading,
    fetchAccountMemberList,
    fetchAnnualLeaveList,
    fetchOverTimeList,
    fetchAccountList,
    setAccountMemberRows,
    setAnnualLeaveRows,
    setOverTimeRows,
  };
}

export { parseNumber, formatNumber };
