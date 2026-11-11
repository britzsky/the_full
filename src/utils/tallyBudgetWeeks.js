import dayjs from "dayjs";
import api from "api/api";

// 콤마가 섞인 금액 문자열을 숫자로 바꾸는 함수
const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// 집계표 행(type) 노출/숨김 규칙 (집계표 화면과 예산 초과 판정이 같은 규칙을 사용)
// mode: "onlyMonth"       → 지정된 year/month 에만 노출, 그 외 월은 숨김
// mode: "hiddenFromMonth" → 지정된 year/month부터(이후 포함) 숨김, 그 이전은 계속 노출
// accountId를 지정하면 해당 거래처에만 규칙이 적용됨 (미지정 시 전체 거래처 공통 적용)
export const ROW_TYPE_VISIBILITY_RULES = [
  { mode: "onlyMonth", types: ["1030", "1031"], year: 2026, month: 7 },
  { mode: "onlyMonth", types: ["1010"], year: 2026, month: 1 },
  { mode: "hiddenFromMonth", types: ["3", "4"], year: 2026, month: 5, accountId: "20250819193630" }, // 강남(웰스토리)
];

// 노출 규칙에 따라 해당 거래처·연월에 보여야 하는 집계표 행만 남기는 함수
export const filterTallyRowsByVisibility = (rows, targetYear, targetMonth, targetAccountId) => {
  const y = Number(targetYear);
  const m = Number(targetMonth);
  const accountId = String(targetAccountId ?? "").trim();
  return (rows || []).filter((r) => {
    const t = String(r.type);
    return ROW_TYPE_VISIBILITY_RULES.every((rule) => {
      if (!rule.types.includes(t)) return true;
      if (rule.accountId && rule.accountId !== accountId) return true;
      if (rule.mode === "onlyMonth") return y === rule.year && m === rule.month;
      if (rule.mode === "hiddenFromMonth") {
        const isAfterCutoff = y > rule.year || (y === rule.year && m >= rule.month);
        return !isAfterCutoff;
      }
      return true;
    });
  });
};

// 일자별 식자재 사용금액 배열(소모품 type 1002 제외)을 만드는 함수
export const buildDailyFoodUsed = (rows, year, month, accountId) => {
  const days = dayjs(`${year}-${String(month).padStart(2, "0")}-01`).daysInMonth();
  const foodRows = filterTallyRowsByVisibility(rows, year, month, accountId).filter(
    (r) => String(r?.type) !== "1002"
  );
  return Array.from({ length: days }, (_, i) =>
    foodRows.reduce((sum, r) => sum + toNumber(r[`day_${i + 1}`]), 0)
  );
};

// 해당 월을 월~토 기준 주차로 나누는 함수 (일요일은 주차에서 빠지고 월 경계에서 주차가 잘림)
// deadline은 그 주 일요일(월말을 넘어도 실제 일요일)
// 반환: [{ weekNo, startDay, endDay, startDate, endDate, labelEndDate, deadline }]
export const getBudgetWeeks = (year, month) => {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const days = first.daysInMonth();
  const weeks = [];
  let current = null;

  for (let d = 1; d <= days; d++) {
    const dow = first.date(d).day(); // 0=일 ~ 6=토
    if (dow === 0) {
      current = null;
    } else {
      if (!current) {
        current = { weekNo: weeks.length + 1, startDay: d, endDay: d };
        weeks.push(current);
      } else {
        current.endDay = d;
      }
      if (dow === 6) current = null;
    }
  }

  return weeks.map((w) => {
    const start = first.date(w.startDay);
    const end = first.date(w.endDay);
    // 주차가 속한 달력 주의 월요일
    const monday = start.subtract((start.day() + 6) % 7, "day");
    // 팝업 표시용 끝 날짜: 그 주 일요일(월말을 넘으면 월말)
    const sunday = monday.add(6, "day");
    const labelEnd = sunday.isAfter(first.endOf("month"), "day") ? first.endOf("month") : sunday;
    return {
      ...w,
      startDate: start.format("YYYY-MM-DD"),
      endDate: end.format("YYYY-MM-DD"),
      labelEndDate: labelEnd.format("YYYY-MM-DD"),
      // 작성 기한: 해당 주 일요일
      deadline: sunday.format("YYYY-MM-DD"),
    };
  });
};

// 주차별 식자재 누적 사용금액과 누적 예산을 일자마다 비교해 초과 여부·작성 가능 여부를 판정하는 함수
// dayStatus: 주차 안 일자별 판정 [{ day, date, status }] (오늘까지 판정, 이후는 pending)
// status: "over"(하루라도 초과) | "ok"(주차 종료 후 초과 없음) | "pending"(진행 중·초과 없음)
export const evaluateBudgetWeeks = ({ year, month, budget, dailyUsed, today = dayjs().format("YYYY-MM-DD") }) => {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const days = dailyUsed?.length || first.daysInMonth();
  const monthBudget = toNumber(budget);
  // d일까지 누적 사용금액과 누적 예산
  const cumUsedAt = (d) => (dailyUsed || []).slice(0, d).reduce((a, b) => a + toNumber(b), 0);
  const baseBudgetAt = (d) => (monthBudget * d) / days;

  return getBudgetWeeks(year, month).map((w) => {
    const dayStatus = [];
    for (let d = w.startDay; d <= w.endDay; d++) {
      const date = first.date(d).format("YYYY-MM-DD");
      let st = "pending";
      if (date <= today) st = monthBudget > 0 && cumUsedAt(d) > baseBudgetAt(d) ? "over" : "ok";
      dayStatus.push({ day: d, date, status: st });
    }
    // 금액 표시 기준일: 진행 중인 주차는 오늘, 그 외는 주차 마지막 날
    const judgedDays = dayStatus.filter((x) => x.status !== "pending");
    const refDay = judgedDays.length && judgedDays.length < dayStatus.length ? judgedDays[judgedDays.length - 1].day : w.endDay;
    const cumUsed = cumUsedAt(refDay);
    const baseBudget = baseBudgetAt(refDay);
    const ratio = baseBudget > 0 ? (cumUsed / baseBudget) * 100 : 0;
    let status = "pending";
    if (dayStatus.some((x) => x.status === "over")) status = "over";
    else if (today > w.endDate) status = "ok";
    return {
      ...w,
      dayStatus,
      cumUsed,
      baseBudget,
      ratio,
      status,
      writable: status === "over" && today <= w.deadline,
    };
  });
};

// 주차별 예산 초과 사유·개선 계획 목록을 조회하는 함수
export const fetchWeekOverList = async (accountId, year, month) => {
  const res = await api.get("/Operate/TallySheetWeekOverList", {
    params: { account_id: accountId, year, month },
  });
  const raw = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  return Array.isArray(raw) ? raw : [];
};

// 초과사유·개선계획 저장 성공 시 발생시키는 브라우저 이벤트 이름 (알림 종 목록 재조회용)
export const WEEK_OVER_SAVED_EVENT = "tallyWeekOverSaved";

// 주차별 예산 초과 사유·개선 계획을 저장하는 함수
export const saveWeekOver = async (payload) => {
  const res = await api.post("/Operate/TallySheetWeekOverSave", payload);
  const raw = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  return raw || {};
};

// 현장 로그인 시 팝업으로 알릴 주차(초과·작성 기한 내·사유 또는 계획 미작성)를 당월·전월에서 찾는 함수
export const fetchPendingWeekOverAlerts = async (accountId) => {
  if (!accountId) return [];
  const now = dayjs();
  const targets = [now, now.subtract(1, "month")].map((d) => ({ year: d.year(), month: d.month() + 1 }));

  const results = await Promise.all(
    targets.map(async ({ year, month }) => {
      const [tallyRes, budgetRes, saved] = await Promise.all([
        api.get("/Operate/TallySheetList", { params: { account_id: accountId, year, month } }),
        api.get("/Operate/BudgetManageMentList", { params: { account_id: accountId, year, month } }),
        fetchWeekOverList(accountId, year, month),
      ]);
      const budgetList = Array.isArray(budgetRes.data) ? budgetRes.data : budgetRes.data?.data || [];
      const budgetRow = budgetList.find((x) => x && x.budget_grant != null) || budgetList[0];
      const dailyUsed = buildDailyFoodUsed(tallyRes.data || [], year, month, accountId);
      const weeks = evaluateBudgetWeeks({ year, month, budget: budgetRow?.budget_grant, dailyUsed });

      return weeks
        .filter((w) => w.writable)
        .filter((w) => {
          const row = saved.find((s) => Number(s.week_no) === w.weekNo);
          return !String(row?.over_reason || "").trim() || !String(row?.fix_plan || "").trim();
        })
        .map((w) => ({ ...w, year, month }));
    })
  );

  return results.flat();
};
