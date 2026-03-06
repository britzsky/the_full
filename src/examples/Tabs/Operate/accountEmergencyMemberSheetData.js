/* eslint-disable react/function-component-definition */
import { useState, useCallback } from "react";
import api from "api/api";

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  return (
    Number(
      String(value)
        .replace(/,/g, "")
        .replace(/[^\d-]/g, "")
    ) || 0
  );
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString();
};

const normalizeYn = (value) => {
  const v = String(value ?? "").toUpperCase();
  return v === "Y" ? "Y" : "N";
};

const normalizeRow = (item, index = 0) => ({
  _rid: item?.idx ? `ROW_${item.idx}` : `ROW_NEW_${Date.now()}_${index}`,
  _isNew: false,
  idx: item?.idx ?? null,
  name: item?.name ?? "",
  position_type: String(item?.position_type ?? "4"),
  salary: parseNumber(item?.salary),
  car_yn: normalizeYn(item?.car_yn),
  note: item?.note ?? "",
  status: String(item?.status ?? "1"),
  manpower_type: String(item?.manpower_type ?? "1"),
});

export default function useAccountEmergencyMemberSheetData() {
  const [activeRows, setActiveRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAccountMembersAllList = useCallback(async ({ name = "" } = {}) => {
    setLoading(true);
    try {
      const res = await api.get("/Operate/FieldPersonMasterList", {
        params: {
          name: String(name ?? ""),
        },
      });

      const raw = res?.data?.list ?? res?.data?.data ?? res?.data ?? [];
      const rows = Array.isArray(raw) ? raw.map((item, index) => normalizeRow(item, index)) : [];

      setActiveRows(rows);
      setOriginalRows(rows.map((row) => ({ ...row })));
      return rows;
    } catch (err) {
      console.error("FieldPersonMasterList 조회 실패:", err);
      setActiveRows([]);
      setOriginalRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveData = useCallback(async (rows) => {
    const SAVE_ENDPOINT = "/Operate/FieldPersonSave";

    const payload = (rows || []).map((row) => ({
      idx: row?.idx ?? null,
      name: String(row?.name ?? "").trim(),
      position_type: String(row?.position_type ?? "4"),
      salary: parseNumber(row?.salary),
      car_yn: normalizeYn(row?.car_yn),
      note: String(row?.note ?? ""),
      status: String(row?.status ?? "1"),
      manpower_type: String(row?.manpower_type ?? "1"),
      user_id: localStorage.getItem("user_id") || "",
    }));

    const res = await api.post(SAVE_ENDPOINT, { data: payload });
    return res;
  }, []);

  return {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,
    loading,
    fetchAccountMembersAllList,
    saveData,
  };
}

export { parseNumber, formatNumber };
