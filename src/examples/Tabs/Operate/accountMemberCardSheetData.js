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

// ✅ 시간 normalize (08:00 -> 8:00 같은 형태 정리)
const normalizeTime = (t) => {
  if (!t) return "";
  return String(t)
    .trim()
    .replace(/^0(\d):/, "$1:");
};

export default function useAccountMemberCardSheetData(account_id, activeStatus) {
  const [activeRows, setActiveRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);

  const [accountList, setAccountList] = useState([]);

  // ✅ 근무형태 리스트 + 스냅샷
  const [workSystemList, setWorkSystemList] = useState([]);
  const [originalWorkSystemList, setOriginalWorkSystemList] = useState([]);

  const [loading, setLoading] = useState(false);

  // =========================
  // 1) 직원 조회
  // =========================
  const fetchAccountMembersAllList = async (opts = { snapshot: true }) => {
    const params = {};
    if (account_id) params.account_id = account_id;
    if (activeStatus) params.del_yn = activeStatus;

    setLoading(true);
    const start = Date.now();

    try {
      const res = await api.get("/Operate/AccountMemberAllList", { params });

      const rows = (res.data || []).map((item) => ({
        account_id: item.account_id,
        member_id: item.member_id,
        name: item.name,
        rrn: item.rrn,
        position_type: item.position_type,
        account_number: item.account_number,
        phone: item.phone,
        address: item.address,
        contract_type: item.contract_type,
        act_join_dt: item.act_join_dt,
        salary: parseNumber(item.salary),
        idx: item.idx,
        start_time: normalizeTime(item.start_time),
        end_time: normalizeTime(item.end_time),
        employment_contract: item.employment_contract,
        id: item.id,
        bankbook: item.bankbook,
        use_yn: item.use_yn,
        note: item.note,

        join_dt: item.join_dt,
        del_yn: item.del_yn,
        del_dt: item.del_dt,
        del_note: item.del_note,
        loss_major_insurances: item.loss_major_insurances,
        national_pension: item.national_pension,
        health_insurance: item.health_insurance,
        industrial_insurance: item.industrial_insurance,
        employment_insurance: item.employment_insurance,
        employment_contract: item.employment_contract,
        headoffice_note: item.headoffice_note,
        subsidy: item.subsidy,
        cor_type: item.cor_type,
      }));

      setActiveRows(rows);
      if (opts.snapshot) setOriginalRows(rows);
      return rows;
    } catch (err) {
      console.error("AccountMemberAllList 조회 실패:", err);
      setActiveRows([]);
      if (opts.snapshot) setOriginalRows([]);
      return [];
    } finally {
      const elapsed = Date.now() - start;
      const remain = Math.max(0, 1000 - elapsed);
      setTimeout(() => setLoading(false), remain);
    }
  };

  // =========================
  // 2) 업장 리스트
  // =========================
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

  // =========================
  // 3) 근무형태 리스트 (재조회 가능하도록 함수화)
  // =========================
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
      if (opts.snapshot) setOriginalWorkSystemList(rows);
      return rows;
    } catch (err) {
      console.error("WorkSystemList 조회 실패:", err);
      setWorkSystemList([]);
      if (opts.snapshot) setOriginalWorkSystemList([]);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchWorkSystemList({ snapshot: true });
  }, [fetchWorkSystemList]);

  // =========================
  // 4) 근무형태 저장 (user_id 포함)
  // =========================
  const saveWorkSystemList = async (rowsToSave) => {
    // ✅ 여기 URL은 실제 서버에 맞게 바꾸면 됨
    // ex) "/Operate/AccountMemberWorkSystemSave"
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
      .post("/account/membersheetSave", { account_id, data: activeData })
      .then(() => alert("저장 성공!"))
      .catch((err) => console.error("저장 실패:", err));
  };

  return {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,

    accountList,

    workSystemList,
    setWorkSystemList,
    originalWorkSystemList,
    setOriginalWorkSystemList,

    fetchWorkSystemList,
    saveWorkSystemList,

    saveData,
    fetchAccountMembersAllList,
    loading,
  };
}

export { parseNumber, formatNumber };
