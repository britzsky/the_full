// ────────────────────────────────────────────────────────────────────────────
// ErpSurveyTab.js  —  ERP 만족도 조사 탭
//
// [접근 권한]
//   - 관리자(britzsky): 분기별 통계 조회 + 설문 문항 설정
//   - 일반 사용자: 만족도 조사 제출 (분기당 1회, 중복 제출 불가)
//
// [노출 기간]  각 분기 마지막 달 1일부터 월말까지
//   - Q1: 3월   Q2: 6월   Q3: 9월   Q4: 11월
//
// [주요 export]
//   - default  ErpSurveyTab    : 탭에 마운트되는 메인 컴포넌트
//   - named    getSurveyPeriod : 현재 날짜가 설문 기간인지 판단 (HeadOfficeTab_4에서 사용)
// ────────────────────────────────────────────────────────────────────────────
/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Chip, LinearProgress, TextField } from "@mui/material";
import Swal from "sweetalert2";
import PropTypes from "prop-types";
import ExcelJS from "exceljs";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import api from "api/api";

// 관리자 계정(팀장님)
const ADMIN_USER_ID = "britzsky";

// 만족도 선택지: label(화면표시) / value(DB 저장값) / color(색상)
// value는 12~20 짝수 5단계 (통계 평균 계산 기준)
const SCORE_OPTIONS = [
  { label: "매우나쁨", value: 12, color: "#d32f2f" },
  { label: "나쁨", value: 14, color: "#f57c00" },
  { label: "보통", value: 16, color: "#f9a825" },
  { label: "좋음", value: 18, color: "#388e3c" },
  { label: "매우좋음", value: 20, color: "#1565c0" },
];

const QUARTER_LABELS = { Q1: "1분기", Q2: "2분기", Q3: "3분기", Q4: "4분기" };

// 현재 날짜가 설문 기간인지 판단
// 반환: { quarter: "Q1"~"Q4", year: number } | null (기간 외이면 null)
// HeadOfficeTab_4에서 탭 노출 조건(condition)으로도 사용됨
export function getSurveyPeriod(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  if (month === 3 && day >= 1) return { quarter: "Q1", year };
  if (month === 6 && day >= 1) return { quarter: "Q2", year };
  if (month === 9 && day >= 1) return { quarter: "Q3", year };
  if (month === 11 && day >= 1) return { quarter: "Q4", year };
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트: 설문 기간 여부 + 관리자/일반 분기 후 하위 컴포넌트로 위임
// ────────────────────────────────────────────────────────────────────────────
export default function ErpSurveyTab() {
  const loginUserId = useMemo(() => String(localStorage.getItem("user_id") || "").trim(), []);
  const isAdmin = loginUserId === ADMIN_USER_ID;
  const surveyPeriod = useMemo(() => getSurveyPeriod(), []);

  if (!surveyPeriod) {
    return (
      <MDBox sx={{ p: 4, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#333", marginBottom: 8 }}>
          현재 설문 기간이 아닙니다
        </div>
        <div style={{ fontSize: 13, color: "#aaa" }}>
          설문은 3월 · 6월 · 9월 · 11월 1일부터 진행됩니다.
        </div>
      </MDBox>
    );
  }

  return isAdmin
    ? <AdminSurveyView surveyPeriod={surveyPeriod} />
    : <UserSurveyView surveyPeriod={surveyPeriod} loginUserId={loginUserId} />;
}

// ────────────────────────────────────────────────────────────────────────────
// 관리자 뷰 (britzsky 전용)
//   - 통계 탭: 연도/분기 선택 후 응답자 수 · 문항별 평균 · 점수 분포 조회
//   - 문항 설정 탭: 해당 분기 설문 문항 등록·수정 (5~10개)
// ────────────────────────────────────────────────────────────────────────────
function AdminSurveyView({ surveyPeriod }) {
  const [adminTab, setAdminTab] = useState(0);          // 0=통계, 1=문항설정
  const [questions, setQuestions] = useState([]);        // 문항 설정 탭: 현재 편집 중인 문항 목록
  const [numQuestions, setNumQuestions] = useState(5);   // 문항 개수 (5~10, select로 조절)
  const [stats, setStats] = useState(null);              // 통계 탭: API 응답 결과
  const [statsLoading, setStatsLoading] = useState(false); // 통계 로딩 중 여부 (LinearProgress 표시용)
  const [localQuarter, setLocalQuarter] = useState(surveyPeriod.quarter); // 통계 탭 분기 선택값
  const [localYear, setLocalYear] = useState(String(surveyPeriod.year));  // 통계 탭 연도 선택값

  // 현재 분기 문항 목록 조회 — 없으면 빈 문항 5개로 초기화
  const loadQuestions = useCallback(async () => {
    try {
      const res = await api.get("/HeadOffice/ErpSurveyQuestionList", {
        params: { quarter: surveyPeriod.quarter, year: surveyPeriod.year },
      });
      const list = res.data || [];
      if (list.length > 0) {
        setNumQuestions(list.length);
        setQuestions(list.map((q) => ({ idx: q.idx, text: q.question_text })));
      } else {
        resetQuestions(5);
      }
    } catch {
      resetQuestions(5);
    }
  }, [surveyPeriod]);

  const resetQuestions = (n) => {
    setNumQuestions(n);
    setQuestions(Array.from({ length: n }, (_, i) => ({ idx: i + 1, text: "" })));
  };

  // 선택한 연도/분기의 응답 통계 조회 (조회 버튼 클릭 또는 통계 탭 전환 시 호출)
  const loadStats = useCallback(async (quarter, year) => {
    setStatsLoading(true);
    try {
      const res = await api.get("/HeadOffice/ErpSurveyStats", {
        params: { quarter, year },
      });
      setStats(res.data || null);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  useEffect(() => {
    if (adminTab === 0) loadStats(localQuarter, localYear);
  }, [adminTab, loadStats, localQuarter, localYear]);

  const handleNumChange = (n) => {
    const count = Number(n);
    setNumQuestions(count);
    setQuestions((prev) => {
      if (count > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, (_, i) => ({
            idx: prev.length + i + 1,
            text: "",
          })),
        ];
      }
      return prev.slice(0, count);
    });
  };

  const handleSaveQuestions = async () => {
    const emptyIdx = questions.findIndex((q) => !String(q.text || "").trim());
    if (emptyIdx >= 0) {
      Swal.fire({ title: "확인", text: `${emptyIdx + 1}번 질문을 입력해주세요.`, icon: "warning" });
      return;
    }
    const confirm = await Swal.fire({
      title: "저장하시겠습니까?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "저장",
      cancelButtonText: "취소",
      confirmButtonColor: "#1f4e79",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await api.post("/HeadOffice/ErpSurveyQuestionSave", {
        quarter: surveyPeriod.quarter,
        year: surveyPeriod.year,
        questions: questions.map((q, i) => ({ order: i + 1, text: q.text })),
      });
      if (res.data?.code === 200) {
        Swal.fire({ title: "저장 완료", icon: "success", confirmButtonColor: "#1f4e79" });
        loadQuestions();
      } else {
        Swal.fire({ title: "저장 실패", icon: "error" });
      }
    } catch {
      Swal.fire({ title: "오류", text: "서버 연결을 확인해주세요.", icon: "error" });
    }
  };

  // hex("#d32f2f") + alpha("33") → ExcelJS ARGB("33D32F2F")
  const hexToArgb = (hex, alpha = "FF") => `${alpha}${String(hex).replace("#", "").toUpperCase()}`;

  // 조회된 통계(연도/분기/전체평균/총 응답자/문항별 결과)를 화면과 동일한 색감으로 엑셀 다운로드
  const handleExcelDownload = async () => {
    if (!stats) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("만족도 조사 결과");

      const NAVY = "1F4E79";
      const borderThin = {
        top: { style: "thin", color: { argb: hexToArgb("#dde3ec") } },
        left: { style: "thin", color: { argb: hexToArgb("#dde3ec") } },
        bottom: { style: "thin", color: { argb: hexToArgb("#dde3ec") } },
        right: { style: "thin", color: { argb: hexToArgb("#dde3ec") } },
      };

      const colCount = 3 + SCORE_OPTIONS.length; // 문항 + 평균 + 점수옵션들 + 응답자수

      // ✅ 1행: 제목 (웹 상단 "ERP 만족도 조사" 배너와 동일한 네이비 배경 + 흰 글씨)
      ws.mergeCells(1, 1, 1, colCount);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = `ERP 만족도 조사 결과   ·   ${localYear}년 ${QUARTER_LABELS[localQuarter]}`;
      titleCell.font = { bold: true, size: 14, color: { argb: hexToArgb("#ffffff") } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(`#${NAVY}`) } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(1).height = 30;

      // ✅ 2행: 총 응답자 / 전체 평균 (웹의 연한 하늘색 요약 박스와 동일한 톤)
      ws.mergeCells(2, 1, 2, colCount);
      const summaryCell = ws.getCell(2, 1);
      summaryCell.value = `총 응답자   ${stats.totalRespondents ?? 0}명        전체 평균   ${stats.overallAverage ?? "-"}점 / 20점`;
      summaryCell.font = { bold: true, size: 11, color: { argb: hexToArgb(`#${NAVY}`) } };
      summaryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb("#f3f6fb") } };
      summaryCell.alignment = { vertical: "middle", horizontal: "center" };
      ws.getRow(2).height = 22;

      // ✅ 3행: 헤더 (문항 컬럼은 좌측 정렬, 점수 옵션 컬럼은 각 옵션 색상으로 강조)
      const headers = ["문항", "평균", ...SCORE_OPTIONS.map((o) => o.label), "응답자수"];
      headers.forEach((header, idx) => {
        const cell = ws.getCell(3, idx + 1);
        cell.value = header;
        cell.font = { bold: true, size: 11, color: { argb: hexToArgb("#ffffff") } };
        cell.border = borderThin;
        const isScoreCol = idx >= 2 && idx < 2 + SCORE_OPTIONS.length;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isScoreCol ? hexToArgb(SCORE_OPTIONS[idx - 2].color) : hexToArgb(`#${NAVY}`) },
        };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      });
      ws.getRow(3).height = 22;

      // ✅ 4행~: 문항별 결과 — 점수 옵션 칸은 웹 Chip과 같은 옅은 색 배경 + 진한 글씨
      (stats.questionStats || []).forEach((q, qIdx) => {
        const rowNo = 4 + qIdx;
        const total = stats.totalRespondents || 0;
        const avg = Number(q.average || 0);

        const questionCell = ws.getCell(rowNo, 1);
        questionCell.value = `Q${qIdx + 1}. ${q.question_text || ""}`;
        questionCell.font = { bold: true, size: 10.5, color: { argb: hexToArgb("#333333") } };
        questionCell.border = borderThin;
        questionCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

        const avgCell = ws.getCell(rowNo, 2);
        avgCell.value = avg;
        avgCell.numFmt = "0.0";
        avgCell.font = { bold: true, size: 11, color: { argb: hexToArgb(`#${NAVY}`) } };
        avgCell.border = borderThin;
        avgCell.alignment = { vertical: "middle", horizontal: "center" };

        SCORE_OPTIONS.forEach((opt, optIdx) => {
          const count = q.scoreDistribution?.[String(opt.value)] ?? q.scoreDistribution?.[opt.value] ?? 0;
          const cell = ws.getCell(rowNo, 3 + optIdx);
          cell.value = count;
          cell.font = { bold: true, size: 10.5, color: { argb: hexToArgb(opt.color) } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(opt.color, "22") } };
          cell.border = borderThin;
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        const totalCell = ws.getCell(rowNo, colCount);
        totalCell.value = total;
        totalCell.font = { size: 10.5, color: { argb: hexToArgb("#888888") } };
        totalCell.border = borderThin;
        totalCell.alignment = { vertical: "middle", horizontal: "center" };

        ws.getRow(rowNo).height = 20;
      });

      // ✅ 문항 통계 아래: 추가 의견 (작성자 비노출, "추가의견 N" 형태로 순서대로 나열)
      const comments = stats.comments || [];
      if (comments.length > 0) {
        let rowNo = 4 + (stats.questionStats || []).length + 1; // 문항 표와 한 줄 띄우고 시작

        ws.mergeCells(rowNo, 1, rowNo, colCount);
        const commentTitleCell = ws.getCell(rowNo, 1);
        commentTitleCell.value = `💬 추가 의견 (${comments.length}건)`;
        commentTitleCell.font = { bold: true, size: 11, color: { argb: hexToArgb("#333333") } };
        ws.getRow(rowNo).height = 20;
        rowNo += 1;

        comments.forEach((c, i) => {
          ws.mergeCells(rowNo, 1, rowNo, colCount);
          const cell = ws.getCell(rowNo, 1);
          cell.value = `추가의견 ${i + 1}   ${c}`;
          cell.font = { size: 10.5, color: { argb: hexToArgb("#444444") } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb("#f3f6fb") } };
          cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
          cell.border = borderThin;
          ws.getRow(rowNo).height = 20;
          rowNo += 1;
        });
      }

      ws.getColumn(1).width = 42;
      ws.getColumn(2).width = 9;
      SCORE_OPTIONS.forEach((_, i) => { ws.getColumn(3 + i).width = 11; });
      ws.getColumn(colCount).width = 11;
      ws.views = [{ state: "frozen", ySplit: 3 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ERP만족도조사_${localYear}_${localQuarter}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      Swal.fire("엑셀 다운로드 실패", err?.message || "오류가 발생했습니다.", "error");
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)); // 연도 드롭다운: 올해 포함 최근 5년

  return (
    <MDBox>
      <MDBox sx={{ display: "flex", gap: 1, p: 2, borderBottom: "1px solid #e8ecf0" }}>
        {["📊 통계", "⚙️ 문항 설정"].map((label, i) => (
          <MDButton
            key={i}
            variant={adminTab === i ? "gradient" : "outlined"}
            color={adminTab === i ? "info" : "secondary"}
            size="small"
            onClick={() => setAdminTab(i)}
            sx={{ fontSize: 12 }}
          >
            {label}
          </MDButton>
        ))}
      </MDBox>

      {/* 통계 탭 */}
      {adminTab === 0 && (
        <MDBox sx={{ p: 2 }}>
          <MDBox sx={{ display: "flex", gap: 1, alignItems: "center", mb: 3, flexWrap: "wrap" }}>
            <TextField
              select size="small" value={localYear}
              onChange={(e) => setLocalYear(e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 100 }}
              label="연도"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}년</option>)}
            </TextField>
            <TextField
              select size="small" value={localQuarter}
              onChange={(e) => setLocalQuarter(e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 100 }}
              label="분기"
            >
              {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                <option key={q} value={q}>{QUARTER_LABELS[q]}</option>
              ))}
            </TextField>
            <MDButton
              variant="gradient" color="info" size="small"
              onClick={() => loadStats(localQuarter, localYear)}
              sx={{ fontSize: 12 }}
            >
              조회
            </MDButton>
            <MDButton
              variant="outlined" color="success" size="small"
              onClick={handleExcelDownload}
              disabled={!stats || statsLoading}
              sx={{ fontSize: 12 }}
            >
              📥 엑셀 다운로드
            </MDButton>
          </MDBox>

          {statsLoading && <LinearProgress sx={{ mb: 2 }} />}

          {!statsLoading && !stats && (
            <MDBox sx={{ p: 3, textAlign: "center", color: "#aaa", fontSize: 14 }}>
              조회된 데이터가 없습니다.
            </MDBox>
          )}

          {!statsLoading && stats && (
            <MDBox>
              <MDBox sx={{
                mb: 3, p: 2, background: "#f3f6fb", borderRadius: 2,
                display: "flex", gap: 3, flexWrap: "wrap", fontSize: 13,
              }}>
                <div>
                  <span style={{ fontWeight: 700 }}>기간: </span>
                  {localYear}년 {QUARTER_LABELS[localQuarter]}
                </div>
                <div>
                  <span style={{ fontWeight: 700 }}>총 응답자: </span>
                  {stats.totalRespondents ?? 0}명
                </div>
                <div>
                  <span style={{ fontWeight: 700 }}>전체 평균: </span>
                  <span style={{ color: "#1f4e79", fontWeight: 800 }}>
                    {stats.overallAverage ?? "-"}점
                  </span>
                  <span style={{ color: "#aaa" }}> / 20점</span>
                </div>
              </MDBox>

              {(stats.questionStats || []).map((q, idx) => {
                const avg = Number(q.average || 0);
                const pct = Math.round((avg / 20) * 100);
                return (
                  <MDBox key={idx} sx={{ mb: 2, p: 2, border: "1px solid #e8ecf0", borderRadius: 2 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#333" }}>
                      Q{idx + 1}. {q.question_text}
                    </div>
                    <MDBox sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                      {SCORE_OPTIONS.map((opt) => {
                        const count = q.scoreDistribution?.[String(opt.value)] ?? q.scoreDistribution?.[opt.value] ?? 0;
                        const total = stats.totalRespondents || 1;
                        const optPct = Math.round((count / total) * 100);
                        return (
                          <Chip
                            key={opt.value}
                            label={`${opt.label} ${count}명 (${optPct}%)`}
                            size="small"
                            sx={{
                              backgroundColor: opt.color + "22",
                              color: opt.color,
                              fontWeight: 700,
                              fontSize: 11,
                              border: `1px solid ${opt.color}44`,
                            }}
                          />
                        );
                      })}
                    </MDBox>
                    <MDBox sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          flex: 1, height: 10, borderRadius: 5,
                          backgroundColor: "#e8ecf0",
                          "& .MuiLinearProgress-bar": { backgroundColor: "#1f4e79", borderRadius: 5 },
                        }}
                      />
                      <span style={{ fontWeight: 800, minWidth: 80, textAlign: "right", fontSize: 13, color: "#1f4e79" }}>
                        평균 {avg}점 / 20점
                      </span>
                    </MDBox>
                  </MDBox>
                );
              })}

              {/* 추가 의견 — 작성자 구분 없이 등록 순서대로 "추가의견 N" 형태로 노출 */}
              {(stats.comments || []).length > 0 && (
                <MDBox sx={{ mt: 3, p: 2, border: "1px solid #e8ecf0", borderRadius: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#333" }}>
                    💬 추가 의견 ({stats.comments.length}건)
                  </div>
                  {stats.comments.map((c, i) => (
                    <MDBox
                      key={i}
                      sx={{
                        mb: 1, p: 1.5, background: "#f3f6fb", borderRadius: 1.5,
                        fontSize: 13, color: "#444",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#1f4e79", marginRight: 6 }}>
                        추가의견 {i + 1}
                      </span>
                      <span style={{ whiteSpace: "pre-wrap" }}>{c}</span>
                    </MDBox>
                  ))}
                </MDBox>
              )}
            </MDBox>
          )}
        </MDBox>
      )}

      {/* 문항 설정 탭 */}
      {adminTab === 1 && (
        <MDBox sx={{ p: 2 }}>
          <MDBox sx={{
            mb: 2, p: 2, background: "#e9f0fb", borderRadius: 2,
            fontSize: 13, color: "#1f4e79", fontWeight: 700,
          }}>
            {surveyPeriod.year}년 {QUARTER_LABELS[surveyPeriod.quarter]} 설문 문항 설정
          </MDBox>

          <MDBox sx={{ mb: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>항목 수</span>
            <TextField
              select size="small" value={String(numQuestions)}
              onChange={(e) => handleNumChange(e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 100 }}
            >
              {[5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n}개</option>
              ))}
            </TextField>
          </MDBox>

          {questions.map((q, idx) => (
            <MDBox key={idx} sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
              <span style={{ fontWeight: 700, minWidth: 28, fontSize: 13, color: "#1f4e79", flexShrink: 0 }}>
                Q{idx + 1}
              </span>
              <TextField
                fullWidth size="small"
                value={q.text || ""}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) => i === idx ? { ...item, text: e.target.value } : item)
                  )
                }
                placeholder={`${idx + 1}번 질문을 입력해주세요`}
              />
            </MDBox>
          ))}

          <MDBox sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
            <MDButton variant="gradient" color="info" onClick={handleSaveQuestions} sx={{ fontSize: 13 }}>
              저장
            </MDButton>
          </MDBox>
        </MDBox>
      )}
    </MDBox>
  );
}

AdminSurveyView.propTypes = {
  surveyPeriod: PropTypes.shape({ quarter: PropTypes.string, year: PropTypes.number }).isRequired,
};

// ────────────────────────────────────────────────────────────────────────────
// 일반 유저 뷰: 만족도 조사 제출
//   - 마운트 시 문항 목록 + 제출 여부를 동시에 API 조회
//   - 이미 제출했으면 완료 안내 화면으로 대체
//   - 미답변 문항이 있으면 제출 불가 (항목 번호 안내)
// ────────────────────────────────────────────────────────────────────────────
function UserSurveyView({ surveyPeriod, loginUserId }) {
  const [questions, setQuestions] = useState([]);          // 이번 분기 설문 문항 목록
  const [answers, setAnswers] = useState({});               // { [question_idx]: score } — 선택한 점수 누적
  const [comment, setComment] = useState("");                // 추가 의견 (선택 입력)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false); // 이미 제출했으면 완료 화면으로 대체
  const [loading, setLoading] = useState(true);             // 문항/제출여부 초기 로딩 여부
  const [submitting, setSubmitting] = useState(false);      // 제출 API 호출 중 (버튼 비활성화용)

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [qRes, checkRes] = await Promise.all([
          api.get("/HeadOffice/ErpSurveyQuestionList", {
            params: { quarter: surveyPeriod.quarter, year: surveyPeriod.year },
          }),
          api.get("/HeadOffice/ErpSurveyResponseCheck", {
            params: { quarter: surveyPeriod.quarter, year: surveyPeriod.year, user_id: loginUserId },
          }),
        ]);
        setQuestions(qRes.data || []);
        setAlreadySubmitted(!!(checkRes.data?.submitted));
      } catch {
        // API 오류 시 빈 상태 유지
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyPeriod, loginUserId]);

  const handleSubmit = async () => {
    const unanswered = questions
      .map((q, i) => ({ idx: q.idx, num: i + 1 }))
      .filter(({ idx }) => answers[idx] === undefined);

    if (unanswered.length > 0) {
      const nums = unanswered.map(({ num }) => `Q${num}`).join(", ");
      Swal.fire({
        title: "미답변 문항이 있습니다",
        text: `${nums} 에 답변해주세요.`,
        icon: "warning",
        confirmButtonColor: "#1f4e79",
      });
      return;
    }

    const confirm = await Swal.fire({
      title: "제출하시겠습니까?",
      text: "제출 후에는 수정이 불가능합니다.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "제출",
      cancelButtonText: "취소",
      confirmButtonColor: "#1f4e79",
    });
    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await api.post("/HeadOffice/ErpSurveyResponseSave", {
        user_id: loginUserId,
        quarter: surveyPeriod.quarter,
        year: surveyPeriod.year,
        answers: questions.map((q) => ({
          question_idx: q.idx,
          score: answers[q.idx],
        })),
        comment: comment.trim(),
      });
      if (res.data?.code === 200) {
        await Swal.fire({
          title: "제출 완료",
          text: "만족도 조사에 참여해주셔서 감사합니다.",
          icon: "success",
          confirmButtonColor: "#1f4e79",
        });
        setAlreadySubmitted(true);
      } else {
        Swal.fire({ title: "제출 실패", text: "서버 오류가 발생했습니다.", icon: "error" });
      }
    } catch {
      Swal.fire({ title: "오류", text: "서버 연결을 확인해주세요.", icon: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MDBox sx={{ p: 4 }}>
        <LinearProgress />
        <MDBox sx={{ textAlign: "center", mt: 2, color: "#aaa", fontSize: 13 }}>로딩 중...</MDBox>
      </MDBox>
    );
  }

  if (alreadySubmitted) {
    return (
      <MDBox sx={{ p: 4, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#333", marginBottom: 8 }}>
          이미 참여하셨습니다
        </div>
        <div style={{ fontSize: 13, color: "#888" }}>
          {surveyPeriod.year}년 {QUARTER_LABELS[surveyPeriod.quarter]} 만족도 조사에 참여해주셔서 감사합니다.
        </div>
      </MDBox>
    );
  }

  if (questions.length === 0) {
    return (
      <MDBox sx={{ p: 4, textAlign: "center", color: "#aaa", fontSize: 14 }}>
        설문 문항이 아직 설정되지 않았습니다. 관리자에게 문의해주세요.
      </MDBox>
    );
  }

  return (
    <MDBox sx={{ p: 2 }}>
      <MDBox sx={{
        mb: 2, p: 2, background: "#1f4e79", borderRadius: 2,
        color: "#fff", textAlign: "center",
      }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>ERP 만족도 조사</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
          {surveyPeriod.year}년 {QUARTER_LABELS[surveyPeriod.quarter]} · {questions.length}개 문항
        </div>
      </MDBox>

      <MDBox sx={{ mb: 2, p: 1.5, background: "#fff8e1", borderRadius: 2, fontSize: 12, color: "#666" }}>
        각 질문에 해당하는 만족도를 선택해주세요. 모든 문항에 답변해야 제출할 수 있습니다.
      </MDBox>

      {questions.map((q, idx) => {
        const selectedScore = answers[q.idx];
        const selectedOption = SCORE_OPTIONS.find((o) => o.value === selectedScore);
        return (
          <MDBox key={q.idx} sx={{ mb: 3, p: 2, border: "1px solid #e8ecf0", borderRadius: 2 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#333" }}>
              Q{idx + 1}. {q.question_text}
            </div>
            <ScaleSelector
              options={SCORE_OPTIONS}
              selected={selectedScore}
              onSelect={(val) => setAnswers((prev) => ({ ...prev, [q.idx]: val }))}
            />
          </MDBox>
        );
      })}

      {/* 추가 의견 — 선택 입력, 제출 시 그대로 저장됨 (관리자 화면엔 작성자 없이 노출) */}
      <MDBox sx={{ mb: 3, p: 2, border: "1px solid #e8ecf0", borderRadius: 2 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#333" }}>
          💬 추가 의견 <span style={{ fontWeight: 400, fontSize: 12, color: "#aaa" }}>(선택)</span>
        </div>
        <TextField
          fullWidth
          multiline
          minRows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="자유롭게 의견을 남겨주세요."
          size="small"
        />
      </MDBox>

      <MDBox sx={{ mb: 2, p: 1.5, background: "#f3f6fb", borderRadius: 2, fontSize: 12, color: "#555" }}>
        답변 현황: {Object.keys(answers).length} / {questions.length}문항 완료
      </MDBox>

      <MDBox sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <MDButton
          variant="gradient" color="info"
          onClick={handleSubmit}
          disabled={submitting}
          sx={{ fontSize: 14, px: 4 }}
        >
          {submitting ? "제출 중..." : "제출하기"}
        </MDButton>
      </MDBox>
    </MDBox>
  );
}

UserSurveyView.propTypes = {
  surveyPeriod: PropTypes.shape({ quarter: PropTypes.string, year: PropTypes.number }).isRequired,
  loginUserId: PropTypes.string.isRequired,
};

// ────────────────────────────────────────────────────────────────────────────
// 원형 척도 선택 컴포넌트 (o — o — o — o — o)
//   - options: SCORE_OPTIONS 배열 (label/value/color)
//   - selected: 현재 선택된 value (없으면 undefined)
//   - onSelect: 선택 시 호출, 해당 value를 answers 상태에 기록
// ────────────────────────────────────────────────────────────────────────────
function ScaleSelector({ options, selected, onSelect }) {
  return (
    <div style={{ width: "100%", paddingTop: 8, paddingBottom: 4 }}>
      {/* 원형 + 연결선 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        {options.map((opt, i) => {
          const isSelected = selected === opt.value;
          return (
            <React.Fragment key={opt.value}>
              {/* 연결선 (첫 번째 제외) */}
              {i > 0 && (
                <div style={{
                  flex: 1,
                  height: 2,
                  background: selected >= opt.value ? opt.color : "#dde3ec",
                  transition: "background 0.2s",
                }} />
              )}
              {/* 원형 버튼 */}
              <button
                type="button"
                onClick={() => onSelect(opt.value)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: `2.5px solid ${opt.color}`,
                  backgroundColor: isSelected ? opt.color : "#fff",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "background-color 0.18s ease, box-shadow 0.18s ease",
                  boxShadow: isSelected ? `0 0 0 4px ${opt.color}33` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                {isSelected && (
                  <div style={{
                    width: 10, height: 10,
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                  }} />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* 라벨 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {options.map((opt) => (
          <div
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              fontSize: 11,
              color: selected === opt.value ? opt.color : "#999",
              fontWeight: selected === opt.value ? 800 : 500,
              textAlign: "center",
              cursor: "pointer",
              minWidth: 44,
              transition: "color 0.18s",
              userSelect: "none",
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

ScaleSelector.propTypes = {
  options: PropTypes.array.isRequired,
  selected: PropTypes.number,
  onSelect: PropTypes.func.isRequired,
};
