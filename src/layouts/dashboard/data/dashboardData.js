/* eslint-disable react/function-component-definition */
import { useState, useEffect, useCallback } from "react";
import api from "api/api";

// 일정 목록에서 동일 일정이 중복 응답될 경우 1건만 유지
const dedupeSchedulesByIdx = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();

  return list.filter((item) => {
    const idx = item?.idx;
    const key =
      idx !== undefined && idx !== null && idx !== ""
        ? `idx:${String(idx)}`
        : `row:${[
          item?.content ?? "",
          item?.user_name ?? "",
          item?.type ?? "",
          item?.position_name ?? "",
          item?.account_id ?? "",
          item?.account_name ?? "",
          item?.department ?? "",
        ].join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// 일정 목록을 거래처명 순으로 묶고, 같은 거래처 안에서는 일정 종류 순으로 정렬
const sortSchedulesByAccountAndType = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

  return [...list].sort((a, b) => {
    const accountCompare = collator.compare(
      String(a?.account_name || ""),
      String(b?.account_name || "")
    );
    if (accountCompare !== 0) return accountCompare;

    const typeA = Number(a?.type);
    const typeB = Number(b?.type);
    if (Number.isFinite(typeA) && Number.isFinite(typeB) && typeA !== typeB) {
      return typeA - typeB;
    }

    return collator.compare(String(a?.type || ""), String(b?.type || ""));
  });
};

// DB 문자셋에서 저장 가능한 북마크 제목으로 정리하는 함수
const normalizeBookmarkTitle = (title) =>
  String(title || "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/[\u2600-\u27BF]\uFE0F?/g, "")
    .replace(/\uFE0F/g, "")
    .replace(/\s+/g, " ")
    .trim();

// 달력에 표시할 해당 연/월 본사행사(type=2, 미삭제) 목록을 조회하는 함수
export const fetchHeadOfficeEvents = (year, month) =>
  api
    .get("/HeadOffice/EventList", { params: { year, month: String(month).padStart(2, "0") } })
    .then((res) =>
      (res.data || []).filter((x) => String(x.type) === "2" && String(x.del_yn || "N") !== "Y")
    );

// 달력에 표시할 해당 연/월 공휴일을 "YYYY-MM-DD" → 공휴일명 Map으로 조회하는 함수
export const fetchHolidayMap = (year, month) =>
  api.get("/Operate/HolidayList", { params: { year, month } }).then((res) => {
    const list = Array.isArray(res.data) ? res.data : [];
    const map = new Map();
    list.forEach((h) => map.set(String(h.holiday_date), String(h.holiday_name || "공휴일")));
    return map;
  });

export default function useDashBoardData() {
  const [accountList, setAccountList] = useState([]);
  // 첫 진입 시 빈 화면이 먼저 보이지 않도록 조회 완료 전까지 로딩 상태로 시작
  const [loading, setLoading] = useState(true);

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

  // 달력 첫 화면(이번 달)의 본사행사·공휴일
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarHolidays, setCalendarHolidays] = useState(new Map());

  // 대시보드 개인 데이터를 조회하고 저장할 때 사용하는 로그인 사용자 ID
  const getLoginUserId = () => String(localStorage.getItem("user_id") || "").trim();

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
        // 조회할 거래처가 없으면 fetchAll이 호출되지 않으므로 로딩 해제
        if (!rows.length && !localStorage.getItem("account_id")) setLoading(false);
      })
      .catch((err) => {
        console.error("AccountList 조회 실패:", err);
        setAccountList([]);
        if (!localStorage.getItem("account_id")) setLoading(false);
      });
  }, []);

  // ✅ 임의 조회 함수들(엔드포인트는 너희 백엔드에 맞게 변경)
  const fetchNotices = () =>
    api.get("/HeadOffice/NoticeList").then((res) =>
      (res.data || []).slice(0, 5).map((x) => ({
        idx: x.idx ?? null,
        content: x.title || "",
        date: (x.reg_dt || "").slice(0, 10),
      }))
    );

  // ✅ 여기: 오늘 날짜를 params로 함께 전달
  const fetchMeals = (account_id) => {
    const today = getTodayYmd();
    return api
      .get("HeadOffice/WeekMenuTodayList", { params: { type: 1, today: today } })
      .then((res) =>
        (res.data || []).map((x) => ({
          content: x.content || x.content || "",
        }))
      );
  };

  const fetchEducations = () =>
    api.get("/HeadOffice/EducationList").then((res) =>
      (res.data || []).slice(0, 5).map((x) => ({
        idx: x.idx ?? null,
        content: x.title || "",
        date: (x.reg_dt || "").slice(0, 10),
      }))
    );

  const fetchWelfares = (account_id) =>
    api.get("/Dashboard/WelfareList", { params: { account_id } }).then((res) =>
      (res.data || []).slice(0, 5).map((x) => ({
        idx: x.idx ?? null,
        content: x.title || "",
        date: (x.date || x.reg_dt || "").slice(0, 10),
      }))
    );

  // 당일 전체 팀 일정에 급식사업부 일정관리의 동행자 정보(user_ids, user_names)를 idx 기준으로 합쳐 조회하는 함수
  const fetchTodaySchedules = async () => {
    const today = getTodayYmd();
    const [todayRes, monthRes] = await Promise.all([
      api.get("/Business/BusinessScheduleTodayList", { params: { today } }),
      api
        .get("/HeadOffice/HeadOfficeScheduleList", {
          params: { year: today.slice(0, 4), month: today.slice(5, 7) },
        })
        .catch(() => ({ data: [] })),
    ]);

    // idx → 동행자 정보 매핑 (조회 실패 시 동행자 없이 표시)
    const companionByIdx = new Map();
    (monthRes.data || []).forEach((x) => {
      companionByIdx.set(String(x.idx), { user_ids: x.user_ids || "", user_names: x.user_names || "" });
    });

    return (todayRes.data || [])
      .filter((x) => String(x?.del_yn || "N") !== "Y")
      .map((x) => ({
        idx: x.idx ?? null,
        team_code: Number(x.team_code),
        content: x.content || "",
        user_id: x.user_id || "",
        user_name: x.user_name || "",
        user_ids: companionByIdx.get(String(x.idx))?.user_ids || "",
        user_names: companionByIdx.get(String(x.idx))?.user_names || "",
        type: x.type || "",
        position_name: x.position_name || "",
        account_id: x.account_id || "",
        account_name: x.account_name || "",
        // 구분 라벨·색상은 등록자 부서가 아니라 일정의 팀 기준 (영업팀=4, 운영팀=5)
        department: Number(x.team_code) === 1 ? "4" : "5",
      }));
  };

  // 당일 일정 중 지정한 팀(team_code)만 골라 중복 제거·정렬
  const pickTeamSchedules = (rows, teamCode) =>
    sortSchedulesByAccountAndType(dedupeSchedulesByIdx(rows.filter((x) => x.team_code === teamCode)));

  // 운영팀(team_code=2) 당일 일정
  const fetchOpsSchedules = (todayPromise) => todayPromise.then((rows) => pickTeamSchedules(rows, 2));

  // 영업팀(team_code=1) 당일 일정
  const fetchSalesSchedules = (todayPromise) => todayPromise.then((rows) => pickTeamSchedules(rows, 1));

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

  const fetchBookmarks = () =>
    api.get("/User/Bookmarklist", { params: { user_id: getLoginUserId() } }).then((res) =>
      (res.data || []).map((x) => ({
        idx: x.idx ?? null,
        type: x.type ?? 1,
        title: x.title || x.name || "",
        content: x.title || x.name || "",
        route: x.route || "",
        date: x.date || "",
      }))
    );

  const fetchTodos = () =>
    api.get("/User/Todoslist", { params: { user_id: getLoginUserId() } }).then((res) =>
      (res.data || []).map((x) => ({
        idx: x.idx ?? null,
        title: x.title || x.todo || "",
        content: x.title || x.todo || "",
        start_date: x.start_date || "",
        end_date: x.end_date || "",
        complete_yn: x.complete_yn || "N",
        date: x.date || "",
      }))
    );

  // 북마크 저장 후 목록 새로고침 (route: ERP 내부 경로)
  const addBookmark = async (account_id, { idx, type, title, route }) => {
    await api.post("/User/BookmarkAdd", { idx, user_id: getLoginUserId(), type: type || 1, title: normalizeBookmarkTitle(title), route: route || "" });
    await fetchAll(account_id);
  };

  const deleteBookmark = async (account_id, { idx }) => {
    await api.post("/User/BookmarkDelete", { idx, user_id: getLoginUserId() });
    await fetchAll(account_id);
  };

  // 투두 저장 후 목록 새로고침
  const addTodo = async (account_id, { idx, title, start_date, end_date, complete_yn }) => {
    await api.post("/User/TodoAdd", {
      idx,
      user_id: getLoginUserId(),
      title,
      start_date: start_date || "",
      end_date: end_date || "",
      complete_yn: complete_yn || "N",
    });
    await fetchAll(account_id);
  };

  const deleteTodo = async (account_id, { idx }) => {
    await api.post("/User/TodoDelete", { idx, user_id: getLoginUserId() });
    await fetchAll(account_id);
  };

  // ✅ Dashboard 진입 시 한 번에 다 조회
  const fetchAll = useCallback(async (account_id) => {
    setLoading(true);

    // 운영팀·영업팀 카드가 함께 쓰는 당일 일정 조회 (1회만 호출)
    const todayPromise = fetchTodaySchedules();

    const results = await Promise.allSettled([
      fetchNotices(),
      fetchMeals(account_id),
      fetchEducations(account_id),
      fetchWelfares(account_id),
      fetchOpsSchedules(todayPromise),
      fetchSalesSchedules(todayPromise),
      fetchContracts(account_id),
      fetchBookmarks(account_id),
      fetchTodos(account_id),
      fetchHeadOfficeEvents(new Date().getFullYear(), new Date().getMonth() + 1),
      fetchHolidayMap(new Date().getFullYear(), new Date().getMonth() + 1),
    ]);

    const pick = (idx, fallback) => (results[idx].status === "fulfilled" ? results[idx].value : fallback);

    setNotices(pick(0, []));

    setMeals(
      pick(1, [
        { title: "미역국" },
        { title: "김치볶음밥" },
        { title: "계란말이" },
        { title: "불고기" },
        { title: "이모님 픽 반찬" },
      ])
    );

    setEducations(pick(2, []));
    setWelfares(pick(3, []));

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
    setCalendarEvents(pick(9, []));
    setCalendarHolidays(pick(10, new Map()));

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
    calendarEvents,
    calendarHolidays,
    fetchAll,
    addBookmark,
    deleteBookmark,
    addTodo,
    deleteTodo,
  };
}
