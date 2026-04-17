/* eslint-disable react/function-component-definition */
import { useState } from "react";
import dayjs from "dayjs";
import api from "api/api";

export default function useEventsheetData(currentYear, currentMonth) {
  const [eventListRows, setEventListRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accountList, setAccountList] = useState([]);

  // ✅ 식단 조회 함수
  const eventList = async () => {
    setLoading(true);
    try {
      const formattedMonth = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;

      const res = await api.get("/HeadOffice/EventList", {
        params: { year: currentYear, month: formattedMonth },
      });

      const rows = (res.data || []).map((item) => ({
        idx: item.idx,
        menu_date: item.menu_date,
        end_date: item.end_date,
        content: item.content || "",
        type: item.type,
        update_dt: item.update_dt,
        reg_dt: item.reg_dt,
        del_yn: item.del_yn,
        user_id: item.user_id,
        account_id: item.account_id,
      }));

      setEventListRows(rows);
    } catch (err) {
      console.error("📛 주간 식단 조회 실패:", err);
      setEventListRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 거래처 목록 조회
  const fetchAccountList = async (currentList) => {
    try {
      if ((currentList || accountList).length > 0) return currentList || accountList;
      const res = await api.get("/Account/AccountList", { params: { account_type: "0" } });
      const rows = res.data || [];
      setAccountList(rows);
      return rows;
    } catch (error) {
      console.error("AccountList 조회 실패:", error);
      return [];
    }
  };

  // ✅ 저장 (등록/수정)
  const saveEvent = async ({ inputValue, selectedDate, selectedEndDate, selectedType, selectedAccount, selectedEvent }) => {
    const savedAccountId = selectedType === "3" ? (selectedAccount?.account_id ?? null) : null;

    const payload = {
      idx: selectedEvent?.extendedProps?.idx || null,
      content: inputValue,
      menu_date: selectedDate,
      end_date: selectedEndDate || selectedDate,
      type: selectedType,
      account_id: savedAccountId,
      user_id: localStorage.getItem("user_id"),
      reg_dt: dayjs(selectedEvent?.extendedProps?.reg_dt).isValid()
        ? dayjs(selectedEvent.extendedProps.reg_dt).format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD"),
      del_yn: "N",
      reg_user_id: localStorage.getItem("user_id"),
    };

    const response = await api.post("/HeadOffice/EventSave", payload, {
      headers: { "Content-Type": "application/json" },
    });

    return response.data;
  };

  // ✅ 삭제 (del_yn='Y')
  const deleteEvent = async ({ inputValue, selectedDate, selectedEndDate, selectedType, selectedAccount, selectedEvent }) => {
    const payload = {
      idx: selectedEvent?.extendedProps?.idx || null,
      content: inputValue,
      menu_date: selectedDate,
      end_date: selectedEndDate || selectedDate,
      type: selectedType,
      account_id: selectedType === "3" ? (selectedAccount?.account_id ?? null) : null,
      user_id: localStorage.getItem("user_id"),
      reg_dt: dayjs(selectedEvent?.extendedProps?.reg_dt).isValid()
        ? dayjs(selectedEvent.extendedProps.reg_dt).format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD"),
      del_yn: "Y",
      reg_user_id: localStorage.getItem("user_id"),
    };

    const response = await api.post("/HeadOffice/EventSave", payload, {
      headers: { "Content-Type": "application/json" },
    });

    return response.data;
  };

  return { eventListRows, setEventListRows, loading, eventList, accountList, setAccountList, fetchAccountList, saveEvent, deleteEvent };
}
