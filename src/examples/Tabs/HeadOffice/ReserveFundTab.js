/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useState } from "react";
import {
  Grid,
  Box,
  TextField,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
} from "@mui/material";
import dayjs from "dayjs";
import Swal from "sweetalert2";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import LoadingScreen from "layouts/loading/loadingscreen";
import { formatNumber } from "./accountMappingPurchaseData";
import useReserveFundData, { RESERVE_TYPES, START_YEAR, START_MONTH } from "./reserveFundData";

// 적립 비율(월 사용금액 대비)
const RESERVE_RATE = 0.04;

const BORDER = "1px solid #e0e0e0";

// 월 사용금액 기준 적립금 계산 (원 미만 반올림)
const calcReserve = (amount) => Math.round(amount * RESERVE_RATE);

// 사용일자 입력 가능 범위 (누계 시작일 ~ 이번 달 말일, 범위 밖은 누계·잔액에 반영되지 않음)
const MIN_USE_DATE = `${START_YEAR}-${String(START_MONTH).padStart(2, "0")}-01`;
const getMaxUseDate = () => dayjs().endOf("month").format("YYYY-MM-DD");

// 업장별 적립금 배분: 업장별 4%를 원 단위로 내리고, 남는 원은 소수점이 큰 업장부터 1원씩 더해
// 업장별 적립금 합계가 월 적립금(월 합계 × 4% 반올림)과 정확히 같게 맞춤
const allocateReserve = (rows) => {
  const total = calcReserve(rows.reduce((acc, r) => acc + r.total, 0));
  const list = rows.map((r, i) => {
    const exact = r.total * RESERVE_RATE;
    return { ...r, i, reserve: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let remain = total - list.reduce((acc, r) => acc + r.reserve, 0);
  [...list]
    .sort((a, b) => b.frac - a.frac)
    .forEach((r) => {
      if (remain > 0) {
        list[r.i].reserve += 1;
        remain -= 1;
      }
    });
  return list;
};

// 금액 표시용 포맷 (천 단위 콤마 + 원)
const formatWon = (value) => `${formatNumber(value || 0)}원`;

// 적립금 사용 등록/수정 팝업 입력값 초기값
const emptyForm = (type) => ({
  id: null,
  type,
  use_date: dayjs().format("YYYY-MM-DD"),
  use_amount: "",
  memo: "",
});

// 적립금 관리 탭: 좌측 거래처 선택, 우측 월별 적립금/사용/잔액과 사용 내역 표시
export default function ReserveFundTab() {
  const isMobileTablet = useMediaQuery("(max-width:1279.95px)");
  // 적립금 조회/저장 API와 원본 데이터 (reserveFundData.js)
  const {
    loading,
    rawRows,
    useRows,
    fetchReserveSource,
    saveReserveFundUse,
    fetchMonthAccountDetail,
  } = useReserveFundData();
  // 조회 연도 필터 (누계는 시작 연월부터 이어서 계산)
  const [year, setYear] = useState(dayjs().year());
  // 좌측에서 선택한 거래처 type
  const [selectedType, setSelectedType] = useState(RESERVE_TYPES[0]);
  // 사용 등록/수정 팝업 열림 여부와 입력값
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  // 월별 행 클릭 시 업장별 사용금액·적립금 팝업 상태 (대상 연월, 조회 중 여부, 업장 행)
  const [detailMonth, setDetailMonth] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRows, setDetailRows] = useState([]);

  useEffect(() => {
    fetchReserveSource();
  }, []);

  // 거래처별 월별 사용금액·적립금·적립금 사용·누계·잔액 (누계는 시작 연월부터, 표시는 선택 연도만)
  const vendorRows = useMemo(() => {
    const months = [];
    const end = dayjs().startOf("month");
    for (
      let d = dayjs(`${START_YEAR}-${String(START_MONTH).padStart(2, "0")}-01`);
      !d.isAfter(end);
      d = d.add(1, "month")
    ) {
      months.push({ year: d.year(), month: d.month() + 1 });
    }

    return RESERVE_TYPES.map((type) => {
      const rows = rawRows.filter((r) => Number(r.type) === type);
      const uses = useRows.filter((r) => Number(r.type) === type);
      const name = rows[0]?.name ?? String(type);
      let cumulative = 0;
      let usedReserve = 0;
      const list = months.map(({ year: y, month }) => {
        const purchase = rows
          .filter((r) => r.count_year === y && Number(r.count_month) === month)
          .reduce((acc, r) => acc + (Number(r.total) || 0), 0);
        const reserve = calcReserve(purchase);
        const spent = uses
          .filter((r) => dayjs(r.use_date).year() === y && dayjs(r.use_date).month() + 1 === month)
          .reduce((acc, r) => acc + (Number(r.use_amount) || 0), 0);
        cumulative += reserve;
        usedReserve += spent;
        return {
          year: y,
          month,
          purchase,
          reserve,
          spent,
          cumulative,
          usedCumulative: usedReserve,
          remain: cumulative - usedReserve,
        };
      });
      // 선택 연도 월만 표시, 연도 합계와 연말(또는 이번 달) 기준 누계·잔액
      const yearMonths = list.filter((m) => m.year === year);
      const last = yearMonths[yearMonths.length - 1];
      const sumOf = (key) => yearMonths.reduce((acc, m) => acc + m[key], 0);
      return {
        type,
        name,
        months: yearMonths,
        uses: uses.filter((r) => dayjs(r.use_date).year() === year),
        purchaseSum: sumOf("purchase"),
        reserveSum: sumOf("reserve"),
        spentSum: sumOf("spent"),
        cumulative: last?.cumulative ?? 0,
        usedCumulative: last?.usedCumulative ?? 0,
        remain: last?.remain ?? 0,
      };
    });
  }, [rawRows, useRows, year]);

  const selectedVendor = vendorRows.find((v) => v.type === selectedType);

  // 사용 등록 버튼: 빈 입력값으로 팝업 열기
  const openNewForm = () => {
    setForm(emptyForm(selectedType));
    setFormOpen(true);
  };

  // 사용 내역 수정 버튼: 선택 행 값으로 팝업 열기
  const openEditForm = (row) => {
    setForm({
      id: row.id,
      type: Number(row.type),
      use_date: row.use_date,
      use_amount: String(row.use_amount ?? ""),
      memo: row.memo ?? "",
    });
    setFormOpen(true);
  };

  // 월별 행 클릭: 해당 연월의 업장별 사용금액을 조회하고 적립금을 배분해 팝업 표시
  const openMonthDetail = async (m) => {
    setDetailMonth(m);
    setDetailRows([]);
    setDetailLoading(true);
    try {
      const rows = await fetchMonthAccountDetail(m.year, m.month, selectedType);
      setDetailRows(allocateReserve(rows).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error("업장별 사용금액 조회 실패:", err);
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  // 로그인 사용자 ID를 붙여 사용 내역을 저장하는 함수 (거래처 type은 payload에 포함)
  const saveUse = (payload) =>
    saveReserveFundUse({
      ...payload,
      user_id: localStorage.getItem("user_id"),
    });

  // 등록/수정 팝업에서 선택한 거래처 (남은 금액 안내용)
  const formVendor = vendorRows.find((v) => v.type === form.type);

  // 팝업 저장 버튼: 입력값 검증 후 저장
  const handleFormSave = async () => {
    const amount = Number(String(form.use_amount).replace(/,/g, ""));
    if (!RESERVE_TYPES.includes(form.type)) {
      return Swal.fire("확인", "거래처를 선택해 주세요.", "warning");
    }
    if (!form.use_date) return Swal.fire("확인", "사용일자를 입력해 주세요.", "warning");
    if (form.use_date < MIN_USE_DATE || form.use_date > getMaxUseDate()) {
      return Swal.fire(
        "확인",
        `사용일자는 ${MIN_USE_DATE} ~ ${getMaxUseDate()} 사이로 입력해 주세요.`,
        "warning"
      );
    }
    if (!amount || amount <= 0) return Swal.fire("확인", "사용금액을 입력해 주세요.", "warning");
    try {
      await saveUse({
        id: form.id,
        type: form.type,
        use_date: form.use_date,
        use_amount: amount,
        memo: form.memo,
        del_yn: "N",
      });
      setFormOpen(false);
      // 저장한 거래처의 내역이 바로 보이도록 좌측 선택 거래처를 맞춤
      setSelectedType(form.type);
      return Swal.fire("완료", "저장되었습니다.", "success");
    } catch (err) {
      console.error("적립금 사용 저장 실패:", err);
      return Swal.fire("오류", "저장 중 오류가 발생했습니다.", "error");
    }
  };

  // 사용 내역 삭제 버튼: 확인 후 del_yn='Y'로 저장
  const handleDelete = async (row) => {
    const confirm = await Swal.fire({
      title: "삭제",
      text: `${row.use_date} / ${formatNumber(row.use_amount)}원 내역을 삭제할까요?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;
    try {
      // 신규 INSERT 구문을 거치므로 NOT NULL 컬럼(use_date, use_amount) 값도 함께 전달
      await saveUse({
        id: row.id,
        type: Number(row.type),
        use_date: row.use_date,
        use_amount: Number(row.use_amount) || 0,
        memo: row.memo ?? "",
        del_yn: "Y",
      });
    } catch (err) {
      console.error("적립금 사용 삭제 실패:", err);
      Swal.fire("오류", "삭제 중 오류가 발생했습니다.", "error");
    }
  };

  if (loading) return <LoadingScreen />;

  // 표 셀 공통 스타일
  const th = {
    p: 1,
    fontWeight: 700,
    textAlign: "center",
    borderBottom: BORDER,
    borderRight: BORDER,
    background: "#f7f7f7",
    whiteSpace: "nowrap",
  };
  const td = {
    p: 1,
    borderBottom: "1px solid #f0f0f0",
    borderRight: "1px solid #f0f0f0",
    whiteSpace: "nowrap",
  };
  const num = { textAlign: "right" };
  // 사용 내역 행 높이를 줄이기 위한 셀 여백과 작은 버튼 스타일
  const rowTd = { py: 0.5 };
  const rowBtn = { minHeight: 24, height: 24, py: 0, px: 1, fontSize: 11 };
  const minusColor = (v) => (v < 0 ? { color: "#d32f2f" } : {});

  // 요약 카드 목록 (선택 거래처 기준)
  const summaryCards = selectedVendor
    ? [
        { label: `${year}년 사용금액(매입)`, value: selectedVendor.purchaseSum },
        { label: `적립금 누계 (${RESERVE_RATE * 100}%)`, value: selectedVendor.cumulative },
        { label: "적립금 사용 누계", value: selectedVendor.usedCumulative },
        { label: "남은 금액", value: selectedVendor.remain, highlight: true },
      ]
    : [];

  return (
    // 탭 전체 높이를 화면 높이에 맞춰 바깥 카드가 늘어나지 않게 고정 (좌·우 영역은 각각 내부 스크롤)
    <MDBox
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 135px)",
        mt: -1,
        overflow: "hidden",
      }}
    >
      {/* 상단 조회 조건 영역: 연도 선택 및 새로고침 */}
      <MDBox
        pb={1}
        sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1 }}
      >
        <Select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          size="small"
          sx={{ height: 32 }}
        >
          {Array.from({ length: dayjs().year() - START_YEAR + 1 }, (_, i) => START_YEAR + i).map(
            (y) => (
              <MenuItem key={y} value={y}>
                {y}년
              </MenuItem>
            )
          )}
        </Select>
        <MDButton
          variant="gradient"
          color="info"
          size="small"
          sx={{ height: 32, minHeight: 32 }}
          onClick={fetchReserveSource}
        >
          새로고침
        </MDButton>
      </MDBox>
      {/* 좌측 거래처 목록 + 우측 상세 영역 (세로 간격은 좁은 화면에서만 사용해 상단 겹침 방지) */}
      <Grid
        container
        columnSpacing={2}
        rowSpacing={isMobileTablet ? 2 : 0}
        sx={{ flex: 1, minHeight: 0, mt: 0, overflowY: isMobileTablet ? "auto" : "hidden" }}
      >
        {/* 좌측: 적립금 대상 거래처 목록 */}
        <Grid item xs={12} md={3} sx={isMobileTablet ? {} : { height: "100%", overflowY: "auto" }}>
          <Box sx={{ border: BORDER, borderRadius: 2, overflow: "hidden", background: "#fff" }}>
            <Box
              sx={{
                p: 1,
                fontSize: 13,
                fontWeight: 700,
                background: "#f7f7f7",
                borderBottom: BORDER,
              }}
            >
              거래처
            </Box>
            {vendorRows.map((v) => (
              <Box
                key={v.type}
                onClick={() => setSelectedType(v.type)}
                sx={{
                  p: 1.5,
                  cursor: "pointer",
                  borderBottom: BORDER,
                  background: v.type === selectedType ? "#fff3e6" : "#fff",
                  borderLeft:
                    v.type === selectedType ? "3px solid #FF5F00" : "3px solid transparent",
                }}
              >
                <MDTypography sx={{ fontSize: 13, fontWeight: 700 }}>{v.name}</MDTypography>
                <MDTypography sx={{ fontSize: 12, color: "#666", ...minusColor(v.remain) }}>
                  남은 금액 {formatWon(v.remain)}
                </MDTypography>
              </Box>
            ))}
          </Box>
        </Grid>

        {/* 우측: 선택 거래처의 적립금 요약, 월별 내역, 사용 내역 */}
        <Grid
          item
          xs={12}
          md={9}
          sx={
            isMobileTablet
              ? {}
              : { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }
          }
        >
          {selectedVendor && (
            <>
              {/* 요약 카드 영역 */}
              <MDBox
                sx={{
                  display: "grid",
                  gridTemplateColumns: isMobileTablet ? "1fr 1fr" : "repeat(4, 1fr)",
                  gap: 2,
                  mb: 2,
                  flexShrink: 0,
                }}
              >
                {summaryCards.map((c) => (
                  <Box
                    key={c.label}
                    sx={{
                      border: BORDER,
                      borderRadius: 2,
                      p: 2,
                      background: c.highlight ? "#fff8f1" : "#fff",
                    }}
                  >
                    <MDTypography variant="h6" color="text">
                      {c.label}
                    </MDTypography>
                    <MDTypography variant="h5" sx={minusColor(c.value)}>
                      {formatWon(c.value)}
                    </MDTypography>
                  </Box>
                ))}
              </MDBox>

              {/* 표 스크롤 영역: 요약 카드는 고정, 월별 표와 사용 내역만 스크롤 */}
              <Box sx={isMobileTablet ? {} : { flex: 1, minHeight: 0, overflowY: "auto" }}>
                {/* 월별 사용금액·적립금·적립금 사용·누계·잔액 표 */}
                <Box
                  sx={{
                    border: BORDER,
                    borderRadius: 2,
                    overflow: "auto",
                    background: "#fff",
                    mb: 2,
                  }}
                >
                  <Box
                    component="table"
                    sx={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
                  >
                    <Box component="thead">
                      <Box component="tr">
                        <Box component="th" sx={th}>
                          연월
                        </Box>
                        <Box component="th" sx={th}>
                          사용금액(매입)
                        </Box>
                        <Box component="th" sx={th}>
                          적립금
                        </Box>
                        <Box component="th" sx={th}>
                          적립금 누계
                        </Box>
                        <Box component="th" sx={th}>
                          적립금 사용
                        </Box>
                        <Box component="th" sx={{ ...th, borderRight: "none" }}>
                          남은 금액
                        </Box>
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {selectedVendor.months.map((m) => (
                        <Box
                          component="tr"
                          key={`${m.year}-${m.month}`}
                          onClick={() => openMonthDetail(m)}
                          title="클릭: 업장별 사용금액·적립금"
                          sx={{ cursor: "pointer", "&:hover": { background: "#fff8f1" } }}
                        >
                          <Box component="td" sx={{ ...td, textAlign: "center" }}>
                            {m.year}년 {m.month}월
                          </Box>
                          <Box component="td" sx={{ ...td, ...num }}>
                            {formatWon(m.purchase)}
                          </Box>
                          <Box component="td" sx={{ ...td, ...num }}>
                            {formatWon(m.reserve)}
                          </Box>
                          <Box component="td" sx={{ ...td, ...num, fontWeight: 700 }}>
                            {formatWon(m.cumulative)}
                          </Box>
                          <Box component="td" sx={{ ...td, ...num }}>
                            {m.spent ? formatWon(m.spent) : ""}
                          </Box>
                          <Box
                            component="td"
                            sx={{
                              ...td,
                              ...num,
                              fontWeight: 700,
                              borderRight: "none",
                              ...minusColor(m.remain),
                            }}
                          >
                            {formatWon(m.remain)}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                    {/* 전체 기간 합계 행 */}
                    <Box component="tfoot">
                      <Box component="tr" sx={{ background: "#fff8f1" }}>
                        <Box component="td" sx={{ ...td, textAlign: "center", fontWeight: 700 }}>
                          합계
                        </Box>
                        <Box component="td" sx={{ ...td, ...num, fontWeight: 700 }}>
                          {formatWon(selectedVendor.purchaseSum)}
                        </Box>
                        <Box component="td" sx={{ ...td, ...num, fontWeight: 700 }}>
                          {formatWon(selectedVendor.reserveSum)}
                        </Box>
                        <Box component="td" sx={{ ...td, ...num, fontWeight: 700 }}>
                          {formatWon(selectedVendor.cumulative)}
                        </Box>
                        <Box component="td" sx={{ ...td, ...num, fontWeight: 700 }}>
                          {formatWon(selectedVendor.spentSum)}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            ...td,
                            ...num,
                            fontWeight: 700,
                            borderRight: "none",
                            ...minusColor(selectedVendor.remain),
                          }}
                        >
                          {formatWon(selectedVendor.remain)}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* 적립금 사용 내역 영역 */}
                <Box
                  sx={{ border: BORDER, borderRadius: 2, overflow: "hidden", background: "#fff" }}
                >
                  {/* 사용 내역 제목 및 등록 버튼 영역 */}
                  <MDBox
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      p: 1,
                      borderBottom: BORDER,
                      background: "#f7f7f7",
                    }}
                  >
                    <MDTypography sx={{ fontSize: 13, fontWeight: 700 }}>
                      적립금 사용 내역
                    </MDTypography>
                    <MDButton variant="gradient" color="info" size="small" onClick={openNewForm}>
                      사용 등록
                    </MDButton>
                  </MDBox>
                  <Box sx={{ overflow: "auto" }}>
                    <Box
                      component="table"
                      sx={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
                    >
                      <Box component="thead">
                        <Box component="tr">
                          <Box component="th" sx={{ ...th, width: 140 }}>
                            거래처
                          </Box>
                          <Box component="th" sx={{ ...th, width: 110 }}>
                            사용일자
                          </Box>
                          <Box component="th" sx={{ ...th, width: 130 }}>
                            사용금액
                          </Box>
                          <Box component="th" sx={th}>
                            내용
                          </Box>
                          <Box component="th" sx={{ ...th, width: 180 }}>
                            등록자 / 등록일자
                          </Box>
                          <Box component="th" sx={{ ...th, width: 120, borderRight: "none" }}>
                            관리
                          </Box>
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {selectedVendor.uses.length === 0 ? (
                          <Box component="tr">
                            <Box
                              component="td"
                              colSpan={6}
                              sx={{
                                ...td,
                                textAlign: "center",
                                color: "#777",
                                borderRight: "none",
                              }}
                            >
                              등록된 사용 내역이 없습니다.
                            </Box>
                          </Box>
                        ) : (
                          selectedVendor.uses.map((r) => (
                            <Box component="tr" key={r.id}>
                              <Box component="td" sx={{ ...td, ...rowTd, textAlign: "center" }}>
                                {vendorRows.find((v) => v.type === Number(r.type))?.name ?? r.type}
                              </Box>
                              <Box component="td" sx={{ ...td, ...rowTd, textAlign: "center" }}>
                                {r.use_date}
                              </Box>
                              <Box component="td" sx={{ ...td, ...rowTd, ...num, fontWeight: 600 }}>
                                {formatWon(r.use_amount)}
                              </Box>
                              <Box component="td" sx={{ ...td, ...rowTd, whiteSpace: "normal" }}>
                                {r.memo}
                              </Box>
                              <Box component="td" sx={{ ...td, ...rowTd, textAlign: "center" }}>
                                {r.reg_user_name || r.reg_user_id || "-"} /{" "}
                                <span style={{ color: "#888" }}>
                                  {String(r.reg_dt ?? "").slice(0, 10)}
                                </span>
                              </Box>
                              <Box
                                component="td"
                                sx={{ ...td, ...rowTd, textAlign: "center", borderRight: "none" }}
                              >
                                <MDBox sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                                  <MDButton
                                    variant="outlined"
                                    color="info"
                                    size="small"
                                    sx={rowBtn}
                                    onClick={() => openEditForm(r)}
                                  >
                                    수정
                                  </MDButton>
                                  <MDButton
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    sx={rowBtn}
                                    onClick={() => handleDelete(r)}
                                  >
                                    삭제
                                  </MDButton>
                                </MDBox>
                              </Box>
                            </Box>
                          ))
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </Grid>

        {/* 월별 행 클릭 시 업장별 사용금액·적립금 팝업 */}
        <Dialog open={!!detailMonth} onClose={() => setDetailMonth(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {selectedVendor?.name} / {detailMonth?.year}년 {detailMonth?.month}월 업장별 적립금
          </DialogTitle>
          <DialogContent dividers>
            {detailLoading ? (
              <MDTypography variant="body2" color="text">
                업장별 사용금액을 조회 중입니다.
              </MDTypography>
            ) : detailRows.length === 0 ? (
              <MDTypography variant="body2" color="text">
                업장별 사용금액 데이터가 없습니다.
              </MDTypography>
            ) : (
              <Box sx={{ border: BORDER, borderRadius: 1, maxHeight: 520, overflowY: "auto" }}>
                <Box
                  component="table"
                  sx={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
                >
                  <Box component="thead">
                    <Box component="tr">
                      <Box component="th" sx={{ ...th, position: "sticky", top: 0 }}>
                        업장명
                      </Box>
                      <Box component="th" sx={{ ...th, position: "sticky", top: 0, width: 150 }}>
                        사용금액(매입)
                      </Box>
                      <Box
                        component="th"
                        sx={{ ...th, position: "sticky", top: 0, width: 130, borderRight: "none" }}
                      >
                        적립금
                      </Box>
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {detailRows.map((r) => (
                      <Box component="tr" key={r.account_id || r.account_name}>
                        <Box component="td" sx={{ ...td, whiteSpace: "normal" }}>
                          {r.account_name}
                        </Box>
                        <Box component="td" sx={{ ...td, ...num }}>
                          {formatWon(r.total)}
                        </Box>
                        <Box component="td" sx={{ ...td, ...num, borderRight: "none" }}>
                          {formatWon(r.reserve)}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  {/* 업장 합계 행 (월별 표의 사용금액·적립금과 같은 값) */}
                  <Box component="tfoot">
                    <Box component="tr" sx={{ background: "#fff8f1" }}>
                      <Box component="td" sx={{ ...td, textAlign: "center", fontWeight: 700 }}>
                        합계
                      </Box>
                      <Box component="td" sx={{ ...td, ...num, fontWeight: 700 }}>
                        {formatWon(detailRows.reduce((acc, r) => acc + r.total, 0))}
                      </Box>
                      <Box
                        component="td"
                        sx={{ ...td, ...num, fontWeight: 700, borderRight: "none" }}
                      >
                        {formatWon(detailRows.reduce((acc, r) => acc + r.reserve, 0))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <MDButton variant="outlined" color="secondary" onClick={() => setDetailMonth(null)}>
              닫기
            </MDButton>
          </DialogActions>
        </Dialog>

        {/* 적립금 사용 등록/수정 팝업 */}
        <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>
            적립금 사용 {form.id ? "수정" : "등록"}
          </DialogTitle>
          <DialogContent dividers>
            <MDBox sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              {/* 적립금 대상 거래처 선택 (RESERVE_TYPES 기준으로 목록 생성) */}
              <TextField
                select
                label="거래처"
                size="small"
                value={form.type ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, type: Number(e.target.value) }))}
                SelectProps={{ sx: { height: 40 } }}
              >
                {vendorRows.map((v) => (
                  <MenuItem key={v.type} value={v.type}>
                    {v.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="사용일자"
                type="date"
                size="small"
                value={form.use_date}
                onChange={(e) => setForm((p) => ({ ...p, use_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: MIN_USE_DATE, max: getMaxUseDate() }}
              />
              <TextField
                label="사용금액"
                size="small"
                value={formatNumber(form.use_amount)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, use_amount: e.target.value.replace(/[^0-9]/g, "") }))
                }
                inputProps={{ inputMode: "numeric", style: { textAlign: "right" } }}
                helperText={formVendor ? `현재 남은 금액 ${formatNumber(formVendor.remain)}원` : ""}
              />
              <TextField
                label="내용"
                size="small"
                multiline
                minRows={2}
                value={form.memo}
                onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                inputProps={{ maxLength: 500 }}
              />
            </MDBox>
          </DialogContent>
          <DialogActions>
            <MDButton variant="outlined" color="secondary" onClick={() => setFormOpen(false)}>
              취소
            </MDButton>
            <MDButton variant="gradient" color="info" onClick={handleFormSave}>
              저장
            </MDButton>
          </DialogActions>
        </Dialog>
      </Grid>
    </MDBox>
  );
}
