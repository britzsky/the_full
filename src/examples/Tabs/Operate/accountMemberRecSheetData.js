/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import api from "api/api";

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

export default function useAccountMemberRecSheetData(account_id, activeStatus) {
  const [activeRows, setActiveRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [accountList, setAccountList] = useState([]);

  // ✅ 근무형태 목록은 별도 상태로 분리
  const [workSystemList, setWorkSystemList] = useState([]);

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
    if (account_id) params.account_id = account_id;
    if (activeStatus) params.use_yn = activeStatus;

    setLoading(true);
    const start = Date.now();

    try {
      const res = await api.get("/Operate/AccountRecMemberList", { params });

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
        // ✅ 여기서 일단 원본 값을 넣고 (아래에서 workSystemList 있으면 idx로 매핑)
        idx: item.idx,
        // ✅ 시간 포맷 통일
        start_time: normalizeTime(item.start_time),
        end_time: normalizeTime(item.end_time),
        employment_contract: item.employment_contract,
        id: item.id,
        bankbook: item.bankbook,
        use_yn: item.use_yn,
        note: item.note,
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
      console.error("AccountRecMemberList 조회 실패:", err);
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

  // ✅ 근무형태 목록
  useEffect(() => {
    api
      .get("/Operate/AccountMemberWorkSystemList", {
        params: { account_type: "0" },
      })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          idx: item.idx,
          work_system: item.work_system,
          start_time: normalizeTime(item.start_time),
          end_time: normalizeTime(item.end_time),
        }));
        setWorkSystemList(rows);
      })
      .catch((err) => console.error("WorkSystemList 조회 실패:", err));
  }, []);

  // ✅ workSystemList가 늦게 로드되는 경우: 이미 조회된 activeRows의 work_system을 idx로 재매핑(변경표시 안 나게 둘 다 갱신)
  useEffect(() => {
    if (!workSystemList.length) return;
    if (!activeRows.length) return;

    const needRemap = activeRows.some((r) => {
      const v = r.work_system;
      const n = Number(v);
      const isNumeric = !(v === "" || v === null || v === undefined) && !Number.isNaN(n);
      if (isNumeric) return false;
      // 문자열이면 remap 필요
      return true;
    });

    if (!needRemap) return;

    const remapped = activeRows.map((r) => ({
      ...r,
      work_system: toWorkSystemIdx(r.work_system),
    }));

    setActiveRows(remapped);
    setOriginalRows(remapped);
  }, [workSystemList.length]);

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
    accountList,

    // ✅ 추가로 export
    workSystemList,

    saveData,
    fetchAccountMembersAllList,
    loading,
  };
}

export { parseNumber, formatNumber };
