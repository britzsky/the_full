import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import dayjs from "dayjs";
import { Box, Card, TextField, Typography } from "@mui/material";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import {
  evaluateBudgetWeeks,
  fetchWeekOverList,
  saveWeekOver,
  WEEK_OVER_SAVED_EVENT,
  WEEK_OVER_REASON_EXAMPLE,
  WEEK_OVER_PLAN_EXAMPLE,
} from "utils/tallyBudgetWeeks";

// 금액 천 단위 콤마 표시
const fmt = (v) => Math.round(Number(v) || 0).toLocaleString("ko-KR");
// M/D 형식 날짜 표시
const md = (d) => dayjs(d).format("M/D");

// 판정 상태별 주차 머리 색상과 표시 문구
const STATUS_STYLE = {
  over: { bg: "#d32f2f", label: "초과" },
  ok: { bg: "#2e7d32", label: "정상" },
  pending: { bg: "#9e9e9e", label: "" },
};

// 주차별(월~일) 식자재 예산 초과 여부와 초과 사유·개선 계획을 달력처럼 한 줄로 보여주는 영역
// 주차 안 하루라도 초과되면 초과 주차가 되어 작성 가능
// editable=true(현장)이면 초과 주차를 작성 기한(해당 주 일요일)까지 작성, false(본사)이면 읽기 전용
function TallyWeekOverPanel({ accountId, year, month, budget, dailyUsed, editable }) {
  // 서버에 저장된 주차별 사유·계획 원본
  const [savedRows, setSavedRows] = useState([]);
  // 화면에서 입력 중인 주차별 사유·계획 { [weekNo]: { over_reason, fix_plan } }
  const [drafts, setDrafts] = useState({});
  // 저장 중인 주차 번호
  const [savingWeek, setSavingWeek] = useState(null);

  const [today, setToday] = useState(() =>
    new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

  // 한국 시각 자정과 화면 복귀 시 예산 기준일을 갱신
  useEffect(() => {
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      const date = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setToday(date);
      const nextMidnight = Date.parse(`${date}T00:00:00+09:00`) + 24 * 60 * 60 * 1000;
      timer = setTimeout(refresh, Math.max(1, nextMidnight - Date.now()));
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // 주차별 판정 결과(누적 사용금액, 누적 예산, 상태, 작성 가능 여부)
  const weeks = useMemo(
    () => evaluateBudgetWeeks({ year, month, budget, dailyUsed, today }),
    [year, month, budget, dailyUsed, today]
  );

  // 선택한 거래처·연월의 저장된 사유·계획을 다시 조회하는 함수
  const loadSaved = useCallback(async () => {
    if (!accountId || !year || !month) {
      setSavedRows([]);
      setDrafts({});
      return;
    }
    try {
      const list = await fetchWeekOverList(accountId, year, month);
      setSavedRows(list);
      const next = {};
      list.forEach((r) => {
        next[Number(r.week_no)] = { over_reason: r.over_reason || "", fix_plan: r.fix_plan || "" };
      });
      setDrafts(next);
    } catch (e) {
      console.error("주차별 예산 초과 사유 조회 실패:", e);
      setSavedRows([]);
      setDrafts({});
    }
  }, [accountId, year, month]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  // 주차 입력값 변경 처리
  const handleDraftChange = (weekNo, key, value) => {
    setDrafts((prev) => ({ ...prev, [weekNo]: { ...(prev[weekNo] || {}), [key]: value } }));
  };

  // 해당 주차 사유·계획이 저장값과 다른지 확인
  const isDirty = (weekNo) => {
    const saved = savedRows.find((r) => Number(r.week_no) === weekNo);
    const d = drafts[weekNo] || {};
    return (
      (d.over_reason || "") !== (saved?.over_reason || "") || (d.fix_plan || "") !== (saved?.fix_plan || "")
    );
  };

  // 선택한 주차의 초과 사유·개선 계획을 저장하는 함수
  const handleSave = async (w) => {
    const d = drafts[w.weekNo] || {};
    if (!String(d.over_reason || "").trim() || !String(d.fix_plan || "").trim()) {
      Swal.fire("안내", "초과사유와 개선계획을 모두 입력해 주세요.", "warning");
      return;
    }
    setSavingWeek(w.weekNo);
    try {
      const res = await saveWeekOver({
        account_id: accountId,
        year,
        month,
        week_no: w.weekNo,
        start_dt: w.startDate,
        end_dt: w.endDate,
        over_reason: d.over_reason,
        fix_plan: d.fix_plan,
        user_id: localStorage.getItem("user_id") || "",
      });
      if (Number(res.code) === 200) {
        Swal.fire("저장 완료", `${w.weekNo}주차 초과사유·개선계획을 저장했습니다.`, "success");
        // 현장관리 상단 알림 종의 미작성 주차 목록을 다시 조회하도록 알림
        window.dispatchEvent(new Event(WEEK_OVER_SAVED_EVENT));
        await loadSaved();
      } else {
        Swal.fire("저장 실패", res.message || "저장에 실패했습니다.", "error");
      }
    } catch (e) {
      Swal.fire("저장 실패", "저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSavingWeek(null);
    }
  };

  return (
    <Card sx={{ p: 2 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1 }}>
        {`${String(month).padStart(2, "0")}월 식자재 예산 초과 사유 및 개선 계획`}
      </Typography>

      {/* 주차 칸 목록(월~일 기준 1주차~마지막 주차) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: `repeat(${weeks.length || 1}, minmax(0, 1fr))` },
          gap: 1,
        }}
      >
        {weeks.map((w) => {
          const st = STATUS_STYLE[w.status];
          // 2026년 11월 1주차에 작성 내용이 없는 업장만 작성 예시를 표시
          const saved = savedRows.find((r) => Number(r.week_no) === w.weekNo);
          const hasSavedContent =
            Boolean(String(saved?.over_reason || "").trim()) ||
            Boolean(String(saved?.fix_plan || "").trim());
          const isExample =
            Number(year) === 2026 && Number(month) === 11 && w.weekNo === 1 && !hasSavedContent;
          const d = isExample
            ? { over_reason: WEEK_OVER_REASON_EXAMPLE, fix_plan: WEEK_OVER_PLAN_EXAMPLE }
            : drafts[w.weekNo] || {};
          const canEdit = editable && w.writable && !isExample;
          // 토요일에는 일요일 몫까지 포함한 누적 예산 기준일을 표시
          const recommendedEndDate = w.budgetEndDate;
          return (
            <Box
              key={w.weekNo}
              sx={{
                border: "1px solid #ccc",
                borderRadius: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* 주차명·기간·판정 상태 머리 영역 */}
              <Box
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: st.bg,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 0.5,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                  {`${w.weekNo}주차 (${md(w.startDate)}~${md(w.endDate)})`}
                </Typography>
                {today >= w.startDate && (
                  <Typography
                    title={`${month}/1부터 ${md(recommendedEndDate)}까지의 누적 권장 사용예산`}
                    sx={{ fontSize: 11, fontWeight: 700, color: "#fff" }}
                  >
                    {`권장 사용예산 ${fmt(w.baseBudget)}원`}
                  </Typography>
                )}
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{st.label}</Typography>
              </Box>

              {/* 일자별 누적 예산 초과 여부 표시 줄(빨강 초과·초록 정상·회색 미판정) */}
              <Box sx={{ display: "flex", gap: 0.5, px: 1, pt: 0.75 }}>
                {w.dayStatus.map((x) => (
                  <Box
                    key={x.date}
                    title={`${md(x.date)}${x.endDay !== x.day ? `~${md(x.endDate)} (토·일 합산)` : ""} ${STATUS_STYLE[x.status].label || "미판정"}`}
                    sx={{
                      flex: x.endDay !== x.day ? 1.5 : 1,
                      minWidth: 0,
                      py: 0.25,
                      borderRadius: 0.5,
                      bgcolor: STATUS_STYLE[x.status].bg,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      lineHeight: 1.4,
                    }}
                  >
                    {x.endDay !== x.day
                      ? `토·일 ${x.day}~${x.endDay}`
                      : `${"일월화수목금토"[dayjs(x.date).day()]} ${dayjs(x.date).date()}`}
                  </Box>
                ))}
              </Box>

              {/* 판정일까지 누적 사용금액·누적 예산·비율 영역 */}
              <Box sx={{ px: 1, py: 0.5, borderBottom: "1px solid #eee" }}>
                <Typography
                  title={`누적 사용 ${fmt(w.cumUsed)} / 누적 예산 ${fmt(w.baseBudget)} / 예산대비 ${w.ratio.toFixed(2)}%`}
                  sx={{
                    fontSize: 11,
                    color: "#444",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {`누적 사용 ${fmt(w.cumUsed)} / 누적 예산 ${fmt(w.baseBudget)}`}
                </Typography>
                {/* 판정일 기준 예산대비 비율 및 작성기한(초과 주차만) 줄 */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography
                    sx={{ fontSize: 11, fontWeight: 700, color: w.status === "over" ? "#d32f2f" : "#444" }}
                  >
                    {`예산대비 ${w.ratio.toFixed(2)}%`}
                  </Typography>
                  {w.status === "over" && (
                    <Typography sx={{ fontSize: 11, color: w.writable ? "#d32f2f" : "#999", whiteSpace: "nowrap" }}>
                      {w.writable ? `작성기한 ${md(w.deadline)}` : `작성 마감 (${md(w.deadline)})`}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* 초과사유·개선계획 입력 영역 */}
              <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
                <TextField
                  label={isExample ? "초과사유(예시)" : "초과사유"}
                  multiline
                  minRows={2}
                  maxRows={6}
                  size="small"
                  value={d.over_reason || ""}
                  onChange={(e) => handleDraftChange(w.weekNo, "over_reason", e.target.value)}
                  InputProps={{ readOnly: !canEdit }}
                  disabled={!isExample && w.status !== "over"}
                  sx={{ "& textarea": { fontSize: 12 } }}
                />
                <TextField
                  label={isExample ? "개선계획(예시)" : "개선계획"}
                  multiline
                  minRows={2}
                  maxRows={6}
                  size="small"
                  value={d.fix_plan || ""}
                  onChange={(e) => handleDraftChange(w.weekNo, "fix_plan", e.target.value)}
                  InputProps={{ readOnly: !canEdit }}
                  disabled={!isExample && w.status !== "over"}
                  sx={{ "& textarea": { fontSize: 12 } }}
                />
              </Box>

              {/* 저장 버튼 영역(현장에서 작성 기한 내 초과 주차만 표시) */}
              {canEdit && (
                <Box sx={{ px: 1, pb: 1, display: "flex", justifyContent: "flex-end" }}>
                  <MDButton
                    variant="gradient"
                    color="info"
                    size="small"
                    disabled={savingWeek === w.weekNo || !isDirty(w.weekNo)}
                    onClick={() => handleSave(w)}
                  >
                    {savingWeek === w.weekNo ? "저장중..." : "저장"}
                  </MDButton>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}

TallyWeekOverPanel.propTypes = {
  accountId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  year: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  month: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  budget: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dailyUsed: PropTypes.arrayOf(PropTypes.number).isRequired,
  editable: PropTypes.bool,
};

TallyWeekOverPanel.defaultProps = {
  accountId: "",
  budget: 0,
  editable: false,
};

export default TallyWeekOverPanel;
