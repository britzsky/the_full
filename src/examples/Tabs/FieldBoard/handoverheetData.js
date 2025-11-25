/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

export default function useHandOversheetData() {
  const [handOverListRows, setHandOverListRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 핸드오버 리스트 조회
  const fetcHandOverList = useCallback(async (account_id) => {
    if (!account_id) return;
    setLoading(true);
    try {
      const res = await api.get("/Operate/HandOverSearch", {
        params: { account_id },
      });

      const data = Array.isArray(res.data) ? res.data : [res.data];
      const rows = data.map((item) => ({
        account_id: item.account_id,
        handover_company: item.handover_company,
        handover_name: item.handover_name,
        handover_dt: item.handover_dt,
        acquisition_company: item.acquisition_company,
        acquisition_name: item.acquisition_name,
        acquisition_dt: item.acquisition_dt,
        check_team: item.check_team,
        check_name: item.check_name,
        handover_location: item.handover_location,
        meal_number: item.meal_number,
        catering_ration: item.catering_ration,
        normal_diet: item.normal_diet,
        kitchen_member: item.kitchen_member,
        work_type: item.work_type,
        order_program_info: item.order_program_info,
        ingredients_order_type: item.ingredients_order_type,
        inspection_store_type: item.inspection_store_type,
        stock_manage_type: item.stock_manage_type,
        diet_submit_cycle: item.diet_submit_cycle,
        hygiene_note: item.hygiene_note,
        hot_issue: item.hot_issue,
        program_use_whether: item.program_use_whether,
        rounding_satis_whether: item.rounding_satis_whether,
        complain_note: item.complain_note,
        manager_phone: item.manager_phone,
        trash_treatment_type: item.trash_treatment_type,
        regular_schedule: item.regular_schedule,
        special_note: item.special_note,
        reg_dt: item.reg_dt,
        mod_dt: item.mod_dt,
        user_id: item.user_id,
      }));

      setHandOverListRows(rows);
    } catch (err) {
      console.error("핸드오버 데이터 조회 실패:", err);
      setHandOverListRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ 계정 목록 조회
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
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  return { handOverListRows, setHandOverListRows, accountList, loading, fetcHandOverList };
}
