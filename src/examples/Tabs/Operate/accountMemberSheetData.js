/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

// 인사 -> 현장관리 -> 현장 직원관리
const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

// ✅ "06:00" -> "6:00" 처럼 옵션 포맷과 맞추기
const normalizeTime = (t) => {
  if (!t) return "";
  const s = String(t).trim();
  // 06:00, 06:30 같은 형태면 앞의 0 제거
  return s.replace(/^0(\d):/, "$1:");
};

// ✅ "YYYY-MM-DD" -> { record_year, record_month, record_date(day) }
const splitDispatchRecordDate = (dateStr) => {
  const raw = String(dateStr || "").trim();
  if (!raw) return { record_year: null, record_month: null, record_date: null };

  const matched = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return { record_year: null, record_month: null, record_date: null };

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { record_year: null, record_month: null, record_date: null };
  }

  return {
    record_year: year,
    record_month: month,
    record_date: day,
  };
};

export default function useAccountMembersheetData(account_id, activeStatus, memberName) {
  const [activeRows, setActiveRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [accountList, setAccountList] = useState([]);

  // ✅ 근무형태 리스트 + 스냅샷
  const [workSystemList, setWorkSystemList] = useState([]);
  const [originalWorkSystemList, setOriginalWorkSystemList] = useState([]);

  const [loading, setLoading] = useState(false);

  // ✅ work_system(조회값)이 idx인지, 문자열인지 둘 다 지원해서 idx로 정규화
  const toWorkSystemIdx = (ws) => {
    if (ws === null || ws === undefined || ws === "") return "";
    const n = Number(ws);
    if (!Number.isNaN(n) && String(ws).trim() !== "") return String(n); // 숫자/숫자문자열
    const found = workSystemList.find((x) => String(x.work_system) === String(ws));
    return found ? String(found.idx) : "";
  };

  const fetchAccountMembersAllList = async (opts = { snapshot: true }) => {
    const params = {};
    const name = String(memberName ?? "").trim();
    if (name) params.name = name;
    else if (account_id) params.account_id = account_id;
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
        join_dt: item.join_dt,
        act_join_dt: item.act_join_dt,
        ret_set_dt: item.ret_set_dt,
        loss_major_insurances: item.loss_major_insurances,
        del_yn: item.del_yn,
        display_yn: item.display_yn ?? "Y",
        del_dt: item.del_dt,
        del_note: item.del_note,
        salary: parseNumber(item.salary),

        // ✅ 여기서 일단 원본 값을 넣고 (아래에서 workSystemList 있으면 idx로 매핑)
        idx: item.idx,

        // ✅ 시간 포맷 통일
        start_time: normalizeTime(item.start_time),
        end_time: normalizeTime(item.end_time),

        national_pension: item.national_pension,
        health_insurance: item.health_insurance,
        industrial_insurance: item.industrial_insurance,
        employment_insurance: item.employment_insurance,
        employment_contract: item.employment_contract,
        headoffice_note: item.headoffice_note,
        subsidy: item.subsidy,
        note: item.note,
        id: item.id,
        bankbook: item.bankbook,
        cor_type: item.cor_type,
      }));

      // ✅ workSystemList가 이미 있으면 work_system을 idx로 매핑해서 저장
      const mappedRows =
        workSystemList.length > 0
          ? rows.map((r) => ({
            ...r,
            work_system: toWorkSystemIdx(r.work_system),
          }))
          : rows;

      setActiveRows(mappedRows);
      if (opts.snapshot) setOriginalRows(mappedRows);

      return mappedRows;
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

  // =========================
  // 5) 직원파출 매핑 삭제(우클릭 메뉴용)
  // =========================
  const deleteDispatchMappingRow = async (row) => {
    if (!row) throw new Error("삭제할 매핑 정보가 없습니다.");

    // 신규 행은 서버 반영 없이 화면에서만 제거
    if (row.idx == null) {
      return { localOnly: true };
    }

    const userId =
      localStorage.getItem("user_id") ||
      sessionStorage.getItem("login_user_id") ||
      sessionStorage.getItem("user_id") ||
      "";

    const { record_year, record_month, record_date } = splitDispatchRecordDate(row.record_date);

    const payload = [
      {
        idx: row.idx ?? null,
        member_id: row.member_id ?? null,
        account_id: row.account_id ?? null,
        dispatch_account_id: row.dispatch_account_id ?? null,
        name: row.name ?? "",
        position_type: row.position_type ?? null,
        start_time: normalizeTime(row.start_time ?? ""),
        end_time: normalizeTime(row.end_time ?? ""),
        record_year,
        record_month,
        record_date,
        type: row.type ?? 6,
        user_id: userId || null,
        del_yn: "Y",
      },
    ];

    const res = await api.post("/Account/AccountMemberDispatchMappingSave", payload);
    const ok = res?.status === 200 || Number(res?.data?.code) === 200;

    if (!ok) {
      throw new Error(res?.data?.message || "직원파출 매핑 삭제에 실패했습니다.");
    }

    return { localOnly: false };
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
    deleteDispatchMappingRow,

    fetchAccountMembersAllList,
    loading,
  };
}

export { parseNumber, formatNumber };
