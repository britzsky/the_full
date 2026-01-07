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

// ✅ year, month 파라미터 추가
export default function useHeadOfficeMembersheetData(account_id, activeStatus, year, month) {
  const [activeRows, setActiveRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAccountMembersAllList = async (opts = { snapshot: true }) => {
    const params = {};

    if (account_id) params.account_id = account_id;
    if (activeStatus) params.del_yn = activeStatus;

    // ✅ 년/월 조회조건 포함 (백엔드 파라미터명은 year/month 기준)
    if (year) params.year = year;
    if (month) params.month = month;

    setLoading(true);
    const start = Date.now();

    try {
      const res = await api.get("/Operate/AccountDispatchMemberAllList", { params });

      const rows = (res.data || []).map((item) => ({
        account_id: item.account_id,
        member_id: item.member_id,
        account_name: item.account_name,
        name: item.name,
        rrn: item.rrn,
        account_number: item.account_number,
        del_yn: item.del_yn,
        del_dt: item.del_dt,
        note: item.note,
        type: item.type,
        cnt: item.cnt,
        salary: item.salary
      }));

      setActiveRows(rows);
      if (opts.snapshot) setOriginalRows(rows);
      return rows;
    } catch (err) {
      console.error("AccountDispatchMemberAllList 조회 실패:", err);
      setActiveRows([]);
      if (opts.snapshot) setOriginalRows([]);
      return [];
    } finally {
      const elapsed = Date.now() - start;
      const remain = Math.max(0, 1000 - elapsed);
      setTimeout(() => setLoading(false), remain);
    }
  };

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
      .catch((err) => console.error("거래처(AccountList) 조회 실패:", err));
  }, []);

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
    saveData,
    fetchAccountMembersAllList,
    loading,
  };
}

export { parseNumber, formatNumber };
