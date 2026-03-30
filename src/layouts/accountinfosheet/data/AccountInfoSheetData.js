import { useState, useEffect } from "react";
import api from "api/api"; // ✅ axios 대신 공통 client import
import { sortAccountRows } from "utils/accountSort";

const normalizeDelYn = (value) =>
  String(value ?? "N")
    .trim()
    .toUpperCase() === "Y"
    ? "Y"
    : "N";

export default function useAccountInfosheetData(initialAccountId) {
  const [basicInfo, setBasicInfo] = useState({});
  const [priceRows, setPriceRows] = useState([]);
  const [etcRows, setEtcRows] = useState([]);
  const [managerRows, setManagerRows] = useState([]);
  const [eventRows, setEventRows] = useState([]);
  const [businessImgRows, setBusinessImgRows] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 전체 데이터 조회
  const fetchAllData = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const [
        basicRes,
        priceRes,
        etcRes,
        managerRes,
        eventRes,
        imgRes,
      ] = await Promise.all([
        api.get("/Account/AccountInfoList", { params: { account_id: id } }),
        api.get("/Account/AccountInfoList_2", { params: { account_id: id } }),
        api.get("/Account/AccountInfoList_3", { params: { account_id: id } }),
        api.get("/Account/AccountInfoList_4", { params: { account_id: id } }),
        api.get("/Account/AccountInfoList_5", { params: { account_id: id } }),
        api.get("/Account/AccountBusinessImgList", { params: { account_id: id } }),
      ]);

      setBasicInfo(basicRes.data?.[0] || {});
      setPriceRows(priceRes.data || []);
      setEtcRows(etcRes.data || []);
      setManagerRows(managerRes.data || []);
      setEventRows(eventRes.data || []);
      setBusinessImgRows(imgRes.data || []);
    } catch (err) {
      console.error("데이터 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 계정 목록 최초 1회 조회
  useEffect(() => {
    const toList = (payload) => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    };

    Promise.allSettled([
      api.get("/Account/AccountList", { params: { account_type: "0" } }),
      api.get("/Account/AccountList", { params: { account_type: "0", del_yn: "Y" } }),
    ])
      .then(([activeRes, deletedRes]) => {
        const activeRows =
          activeRes.status === "fulfilled" ? toList(activeRes.value?.data) : [];
        const deletedRows =
          deletedRes.status === "fulfilled" ? toList(deletedRes.value?.data) : [];

        if (activeRes.status === "rejected") {
          console.error("데이터 조회 실패 (AccountList active):", activeRes.reason);
        }
        if (deletedRes.status === "rejected") {
          console.warn("데이터 조회 실패 (AccountList del_yn=Y):", deletedRes.reason);
        }

        const mergedMap = new Map();

        const mergeRows = (rows, fallbackDelYn = "N") => {
          rows.forEach((item) => {
            const accountId = String(item?.account_id ?? "");
            if (!accountId) return;

            const nextRow = {
              account_id: item.account_id,
              account_name: item.account_name,
              del_yn: normalizeDelYn(item?.del_yn ?? fallbackDelYn),
            };

            const prev = mergedMap.get(accountId);
            if (!prev || prev.del_yn === "Y") {
              mergedMap.set(accountId, nextRow);
            }
          });
        };

        mergeRows(activeRows, "N");
        mergeRows(deletedRows, "Y");

        const rows = sortAccountRows(Array.from(mergedMap.values()), {
          sortKey: "account_name",
          keepAllOnTop: true,
        });
        setAccountList(rows);
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  const saveData = async () => {
    try {
      await api.post("/account/membersheetSave", {
        account_id: initialAccountId,
        basicInfo,
        priceRows,
        etcRows,
        managerRows,
        eventRows,
      });
      alert("저장 성공!");
      fetchAllData(initialAccountId);
    } catch (err) {
      console.error("저장 실패:", err);
    }
  };

  return {
    basicInfo,
    priceRows,
    etcRows,
    managerRows,
    eventRows,
    businessImgRows,
    accountList,
    loading,
    setPriceRows,
    setEtcRows,
    setManagerRows,
    setEventRows,
    setBusinessImgRows,
    saveData,
    fetchAllData,
  };
}
