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

export default function useAccountMembersheetData(account_id, activeStatus) {
  const [activeRows, setActiveRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAccountMembersAllList = async () => {
    const params = {};
    if (account_id) params.account_id = account_id;
    if (activeStatus) params.del_yn = activeStatus;
    setLoading(true);
    try {
      const res = await api.get(
        "/Operate/AccountMemberAllList",
        { params }     // ✅ 핵심 수정: params를 감싸지 않음
      );

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
        ret_set_dt: item.ret_set_dt,
        loss_major_insurances: item.loss_major_insurances,
        del_yn: item.del_yn,
        del_dt: item.del_dt,
        del_note: item.del_note,
        salary: parseNumber(item.salary),
        work_system: item.work_system,
        start_time: item.start_time,
        end_time: item.end_time,
        national_pension: item.national_pension,
        health_insurance: item.health_insurance,
        industrial_insurance: item.industrial_insurance,
        employment_insurance: item.employment_insurance,
        employment_contract: item.employment_contract,
        headoffice_note: item.headoffice_note,
        subsidy: item.subsidy,
        note: item.note,
      }));

      setActiveRows(rows);

    } catch (err) {
      console.error("AccountMemberAllList 조회 실패:", err);
      setActiveRows([]);
    } finally {
      setLoading(false);
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
      .catch((err) => console.error("데이터 조회 실패:", err));
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

  return { activeRows, setActiveRows, accountList, saveData, fetchAccountMembersAllList };
}

export { parseNumber, formatNumber };
