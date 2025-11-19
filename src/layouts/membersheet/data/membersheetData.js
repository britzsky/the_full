/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "api/api";

const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useMembersheetData() {
  const [activeRows, setActiveRows] = useState([]);
  const [inactiveRows, setInactiveRows] = useState([]);
  const [activeOriginalRows, setActiveOriginalRows] = useState([]);
  const [inactiveOriginalRows, setInactiveOriginalRows] = useState([]);
  const { account_id } = useParams();

  // 데이터 불러오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resActive = await api.get(
          "/Operate/AccountMemberSheetList",
          { params: { account_id, del_yn: "N" } }
        );
        const resInactive = await api.get(
          "/Operate/AccountMemberSheetList",
          { params: { account_id, del_yn: "Y" } }
        );

        const mapRows = (data) =>
          (data || []).map((item) => ({
            account_address: item.account_address,
            account_name: item.account_name,
            name: item.name,
            join_dt: item.join_dt,
            del_dt: item.del_dt,
            salary: parseNumber(item.salary),
            position: item.position,
            work_system: item.work_system,
            start_time: item.start_time,
            end_time: item.end_time,
            relation: item.relation,
            del_note: item.del_note,
            rct_notice: item.rct_notice,
            note: item.note,
            del_yn: item.del_yn,
          }));

        const active = mapRows(resActive.data);
        const inactive = mapRows(resInactive.data);

        setActiveRows(active);
        setInactiveRows(inactive);
        setActiveOriginalRows(active.map((r) => ({ ...r })));
        setInactiveOriginalRows(inactive.map((r) => ({ ...r })));
      } catch (err) {
        console.error("데이터 조회 실패:", err);
      }
    };

    fetchData();
  }, [account_id]);

  // 저장 API
  const saveData = (newActiveRows, newInactiveRows) => {
    axios
      .post("/account/membersheetSave", {
        account_id,
        data: [...newActiveRows, ...newInactiveRows],
      })
      .then(() => {
        alert("저장 성공!");
        setActiveOriginalRows(newActiveRows.map((r) => ({ ...r })));
        setInactiveOriginalRows(newInactiveRows.map((r) => ({ ...r })));
      })
      .catch((err) => console.error("저장 실패:", err));
  };

  return {
    activeRows,
    setActiveRows,
    inactiveRows,
    setInactiveRows,
    activeOriginalRows,
    inactiveOriginalRows,
    saveData,
    parseNumber,
    formatNumber,
  };
}

export { parseNumber, formatNumber };
