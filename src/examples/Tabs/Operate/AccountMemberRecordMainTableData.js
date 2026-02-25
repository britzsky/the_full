/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

const normalizeTime = (t) => {
  if (!t) return "";
  const s = String(t).trim();
  return s.replace(/^0(\d):/, "$1:");
};

export default function useAccountMembersheetData(account_id, activeStatus, memberName) {
  const [activeRows, setActiveRows] = useState([]);
  const [simulationRows, setSimulationRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [accountList, setAccountList] = useState([]);

  const [workSystemList, setWorkSystemList] = useState([]);
  const [originalWorkSystemList, setOriginalWorkSystemList] = useState([]);

  const [loading, setLoading] = useState(false);

  const toWorkSystemIdx = useCallback(
    (ws) => {
      if (ws === null || ws === undefined || ws === "") return "";
      const n = Number(ws);
      if (!Number.isNaN(n) && String(ws).trim() !== "") return String(n);

      const found = (workSystemList || []).find((x) => String(x.work_system) === String(ws));
      return found ? String(found.idx) : "";
    },
    [workSystemList]
  );

  // ✅ 표준(편집) 테이블 조회
  const fetchAccountStandardList = useCallback(
    async (opts = { snapshot: true }) => {
      const params = {};
      const name = String(memberName ?? "").trim();

      if (name) params.name = name;
      else if (account_id) params.account_id = account_id;

      if (activeStatus) params.del_yn = activeStatus;

      setLoading(true);
      const start = Date.now();

      try {
        const res = await api.get("/Operate/AccountRecordStandardList", { params });

        const rows = (res.data || []).map((item) => ({
          master_idx: item.master_idx,
          account_id: item.account_id,
          work_system: item.work_system,
          position_type: item.position_type,
          start_time: item.start_time,
          end_time: item.end_time,
          mon: item.mon,
          tue: item.tue,
          wed: item.wed,
          thu: item.thu,
          fri: item.fri,
          sat: item.sat,
          sun: item.sun,
          sido_code: item.sido_code,
          sigungu_code: item.sigungu_code,
        }));

        const mappedRows =
          (workSystemList || []).length > 0
            ? rows.map((r) => ({ ...r, work_system: toWorkSystemIdx(r.work_system) }))
            : rows;

        setActiveRows(mappedRows);
        if (opts?.snapshot) setOriginalRows(mappedRows);

        return mappedRows;
      } catch (err) {
        console.error("AccountRecordStandardList 조회 실패:", err);
        setActiveRows([]);
        if (opts?.snapshot) setOriginalRows([]);
        return [];
      } finally {
        const elapsed = Date.now() - start;
        const remain = Math.max(0, 200 - elapsed); // 굳이 1초 딜레이 필요 없으면 줄임
        setTimeout(() => setLoading(false), remain);
      }
    },
    [account_id, activeStatus, memberName, workSystemList, toWorkSystemIdx]
  );

  // ✅ RecordSituationList(조회전용) 테이블 조회
  // ✅ 여기서 year/month를 "opts"로 반드시 받아서 params에 넣어야 함
  const fetchAccountRecordSituationList = useCallback(
    async (opts = {}) => {
      // opts 우선, 없으면 훅의 account_id 사용
      const aid = opts.account_id ?? account_id;
      const y = opts.year;
      const m = opts.month;

      // 필수 조건 체크 (원하면 완화 가능)
      if (!aid || !y || !m) {
        // 조건이 없으면 비우고 종료
        setSimulationRows([]);
        return [];
      }

      setLoading(true);
      const start = Date.now();

      try {
        const res = await api.get("/Operate/RecordSituationList", {
          params: {
            account_id: aid,
            year: y,
            month: m,
            // 서버에서 del_yn을 받는다면 같이 보낼 수 있음 (필요 없으면 제거)
            // del_yn: activeStatus,
          },
        });

        const rows = (res.data || []).map((item) => ({
          week_number: item.week_number,
          position_type: item.position_type,
          mon: item.mon,
          tue: item.tue,
          wed: item.wed,
          thu: item.thu,
          fri: item.fri,
          sat: item.sat,
          sun: item.sun,
        }));

        const mappedRows =
          (workSystemList || []).length > 0
            ? rows.map((r) => ({ ...r, work_system: toWorkSystemIdx(r.work_system) }))
            : rows;

        setSimulationRows(mappedRows);
        return mappedRows;
      } catch (err) {
        console.error("RecordSituationList 조회 실패:", err);
        setSimulationRows([]);
        return [];
      } finally {
        const elapsed = Date.now() - start;
        const remain = Math.max(0, 200 - elapsed);
        setTimeout(() => setLoading(false), remain);
      }
    },
    [account_id, workSystemList, toWorkSystemIdx]
  );

  // ✅ 업장 목록
  useEffect(() => {
    api
      .get("/Account/AccountList", { params: { account_type: "0" } })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(rows);
      })
      .catch((err) => console.error("AccountList 조회 실패:", err));
  }, []);

  // ✅ 근무형태 리스트
  const fetchWorkSystemList = useCallback(async (opts = { snapshot: true }) => {
    try {
      const res = await api.get("/Operate/AccountMemberWorkSystemList", {
        params: { account_type: "0" },
      });

      const rows = (res.data || []).map((item) => ({
        idx: item.idx,
        work_system: item.work_system,
        start_time: normalizeTime(item.start_time),
        end_time: normalizeTime(item.end_time),
      }));

      setWorkSystemList(rows);
      if (opts?.snapshot) setOriginalWorkSystemList(rows);
      return rows;
    } catch (err) {
      console.error("WorkSystemList 조회 실패:", err);
      setWorkSystemList([]);
      if (opts?.snapshot) setOriginalWorkSystemList([]);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchWorkSystemList({ snapshot: true });
  }, [fetchWorkSystemList]);

  const saveWorkSystemList = async (rowsToSave) => {
    const userId = localStorage.getItem("user_id");

    const cleanRow = (row) => {
      const r = { ...row };
      Object.keys(r).forEach((k) => {
        if (r[k] === "" || r[k] === undefined) r[k] = null;
      });
      return r;
    };

    const payload = (rowsToSave || []).map((r) => ({
      ...cleanRow(r),
      user_id: userId,
    }));

    return api.post("/Operate/AccountMemberWorkSystemSave", payload);
  };

  const saveData = (activeData) => {
    api
      .post("/account/membersheetSave", {
        account_id,
        data: activeData,
      })
      .then(() => alert("저장 성공!"))
      .catch((err) => console.error("저장 실패:", err));
  };

  return {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,

    simulationRows,
    setSimulationRows,

    accountList,

    workSystemList,
    setWorkSystemList,
    originalWorkSystemList,
    setOriginalWorkSystemList,

    fetchWorkSystemList,
    saveWorkSystemList,

    saveData,
    fetchAccountStandardList,
    fetchAccountRecordSituationList,
    loading,
  };
}

export { parseNumber, formatNumber };
