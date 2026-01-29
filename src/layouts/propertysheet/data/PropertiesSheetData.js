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

export default function usePropertiessheetData() {
  const [activeRows, setActiveRows] = useState([]);
  const { account_id } = useParams();

  useEffect(() => {
    api
      .get("/Account/AccountPropertiesList", {
        params: { account_id },
      })
      .then((res) => {
        console.log(res)
        const rows = (res.data || []).map((item) => ({
          purchase_dt: item.purchase_dt,
          purchase_name: item.purchase_name,
          item:item.item,
          spec: item.spec,
          qty: item.qty,
          type: item.type,
          purchase_price: parseNumber(item.purchase_price),
          item_img: item.item_img,
          receipt_img: item.receipt_img,
          note: item.note,
        }));

        // 재직자만 필터링
        setActiveRows(rows);
      })
      .catch((err) => console.error("데이터 조회 실패:", err));
  }, [account_id]);

  const saveData = (activeData) => {
    api
      .post("/account/membersheetSave", {
        account_id,
        data: activeData,
      })
      .then(() => alert("저장 성공!"))
      .catch((err) => console.error("저장 실패:", err));
  };

  return { activeRows, setActiveRows, saveData };
}

export { parseNumber, formatNumber };
