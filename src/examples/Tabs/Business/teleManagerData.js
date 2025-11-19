/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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

export default function useTeleManagerData(year) {
  const [teleAccountRows, setTeleAccountRows] = useState([]);
  const { account_id } = useParams();

  useEffect(() => {
    
    console.log(year)

    // 직원정보
    api
      .get("/Business/BusinessTeleAccountList", {
        params: { account_id, year },
      })
      .then((res) => {
        const rows = (res.data || []).map((item) => ({
          idx: item.idx,
          account_name: item.account_name || "",
          sales_root: item.sales_root || "",
          manager: item.manager || "",
          region: item.region || "",
          now_consignor: item.now_consignor,
          end_dt: item.end_dt,
          contract_type: item.contract_type,
          act_idx: item.act_idx,
          act_dt: item.act_dt,
          memo: item.memo,
          act_type: item.act_type
        }));
        setTeleAccountRows(rows);
      })
      .catch((err) => console.error("직원정보 조회 실패:", err));
  }, [account_id, year]);

  return { teleAccountRows, setTeleAccountRows };
}

export { parseNumber, formatNumber };
