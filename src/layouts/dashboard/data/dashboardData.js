/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

export default function useDashBoardData() {
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 상단 4개
  const [notices, setNotices] = useState([]);
  const [meals, setMeals] = useState([]);
  const [educations, setEducations] = useState([]);
  const [welfares, setWelfares] = useState([]);

  // 일정 2개
  const [opsSchedules, setOpsSchedules] = useState([]);
  const [salesSchedules, setSalesSchedules] = useState([]);

  // 하단 테이블
  const [contracts, setContracts] = useState([]);

  // 우측
  const [bookmarks, setBookmarks] = useState([]);
  const [todos, setTodos] = useState([]);

  // ✅ 오늘 날짜 YYYY-MM-DD (로컬 기준)
  const getTodayYmd = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // ✅ 계정 목록(최초 1회)
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
      .catch((err) => {
        console.error("AccountList 조회 실패:", err);
        setAccountList([]);
      });
  }, []);

  // ✅ 임의 조회 함수들(엔드포인트는 너희 백엔드에 맞게 변경)
  const fetchNotices = (account_id) =>
    api.get("/Dashboard/NoticeList", { params: { account_id } }).then((res) =>
      (res.data || []).map((x) => ({
        title: x.title || x.notice_title || "",
        date: x.reg_dt || x.date || "",
      }))
    );

  const fetchMeals = (account_id) =>
    api.get("/Dashboard/MealList", { params: { account_id } }).then((res) =>
      (res.data || []).map((x) => ({
        title: x.menu || x.title || "",
        date: x.date || "",
      }))
    );

  const fetchEducations = (account_id) =>
    api.get("/Dashboard/EducationList", { params: { account_id } }).then((res) =>
      (res.data || []).map((x) => ({
        title: x.title || x.edu_title || "",
        date: x.date || x.reg_dt || "",
      }))
    );

  const fetchWelfares = (account_id) =>
    api.get("/Dashboard/WelfareList", { params: { account_id } }).then((res) =>
      (res.data || []).map((x) => ({
        title: x.title || "",
        date: x.date || x.reg_dt || "",
      }))
    );

  // ✅ 여기: 오늘 날짜를 params로 함께 전달
  const fetchOpsSchedules = (account_id) => {
    const today = getTodayYmd();
    return api
      .get("/Operate/OperateScheduleTodayList", { params: { today: today } })
      .then((res) =>
        (res.data || []).map((x) => ({
          content: x.content || x.content || "",
          user_name: x.user_name || x.user_name || "",
          type: x.type || x.type || "",
          position_name: x.position_name || x.position_name || "",
        }))
      );
  };

  const fetchSalesSchedules = (account_id) => {
    const today = getTodayYmd();
    return api
      .get("/Business/BusinessScheduleTodayList", { params: { today: today } })
      .then((res) =>
        (res.data || []).map((x) => ({
          content: x.content || x.content || "",
          user_name: x.user_name || x.user_name || "",
          type: x.type || x.type || "",
          position_name: x.position_name || x.position_name || "",
        }))
      );
  };

  const fetchContracts = (account_id) =>
    api.get("/User/ContractEndAccountList", { params: { account_id } }).then((res) =>
      (res.data || []).map((x) => ({
        customer_name: x.customer_name || x.account_name || "",
        contract_start: x.contract_start || "",
        contract_end: x.contract_end || "",
        account_type: x.account_type || "",
        account_address: x.account_address || "",
        manager_name: x.manager_name || "",
      }))
    );

  const fetchBookmarks = (account_id) =>
    api.get("/Dashboard/Bookmarks", { params: { account_id } }).then((res) =>
      (res.data || []).map((x) => ({
        title: x.title || x.name || "",
        date: x.date || "",
      }))
    );

  const fetchTodos = (account_id) =>
    api.get("/Dashboard/Todos", { params: { account_id } }).then((res) =>
      (res.data || []).map((x) => ({
        title: x.title || x.todo || "",
        date: x.date || "",
      }))
    );

  // ✅ Dashboard 진입 시 한 번에 다 조회
  const fetchAll = useCallback(async (account_id) => {
    setLoading(true);

    const results = await Promise.allSettled([
      fetchNotices(account_id),
      fetchMeals(account_id),
      fetchEducations(account_id),
      fetchWelfares(account_id),
      fetchOpsSchedules(account_id),     // ✅ 내부에서 오늘 날짜 포함
      fetchSalesSchedules(account_id),   // ✅ 내부에서 오늘 날짜 포함
      fetchContracts(account_id),
      fetchBookmarks(account_id),
      fetchTodos(account_id),
    ]);

    const pick = (idx, fallback) => (results[idx].status === "fulfilled" ? results[idx].value : fallback);

    setNotices(
      pick(0, [
        { title: "지출결의서 작성요령", date: "2026-01-01" },
        { title: "워크샵 관련 공지", date: "2025-12-30" },
      ])
    );

    setMeals(
      pick(1, [
        { title: "미역국" },
        { title: "김치볶음밥" },
        { title: "계란말이" },
        { title: "불고기" },
        { title: "이모님 픽 반찬" },
      ])
    );

    setEducations(pick(2, [{ title: "지출결의서 교육", date: "2026-01-01" }]));
    setWelfares(pick(3, [{ title: "워크샵", date: "2026-01-01" }]));

    setOpsSchedules(pick(4, [{ time: "09:30~16:30", title: "교육용 현장 인수인계(이수연 파트장)" }]));
    setSalesSchedules(pick(5, [{ time: "11:00~12:00", title: "로나운영팀 인력 승계 미팅(김경임 매니저+김주광 파트장)" }]));

    setContracts(
      pick(6, [
        {
          customer_name: "그레이스",
          start_date: "2024-12-31",
          end_date: "2025-12-30",
          type: "요양원",
          region: "파주",
          manager: "김아무개",
        },
      ])
    );

    setBookmarks(pick(7, []));
    setTodos(pick(8, []));

    results.forEach((r, i) => {
      if (r.status === "rejected") console.error("Dashboard fetch fail idx:", i, r.reason);
    });

    setLoading(false);
  }, []);

  return {
    accountList,
    loading,
    notices,
    meals,
    educations,
    welfares,
    opsSchedules,
    salesSchedules,
    contracts,
    bookmarks,
    todos,
    fetchAll,
  };
}
