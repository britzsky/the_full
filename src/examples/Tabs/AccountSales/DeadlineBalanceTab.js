// src/layouts/deposit/DepositBalanceTab.js
/* eslint-disable react/function-component-definition */
import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  Grid,
  Button,
  Modal,
  Box,
  TextField,
  MenuItem,
  Select,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import api from "api/api";

// 🔹 데이터 훅 import
import useDeadlineBalanceData, { parseNumber, formatNumber } from "./deadlineBalanceData";
import LoadingScreen from "layouts/loading/loadingscreen";

export default function DeadlineBalanceTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editableRows, setEditableRows] = useState([]);

  // ✅ 반응형용 훅
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md")); // md 이하를 모바일로

  // ✅ 마지막 선택 고객 기억용 ref
  const lastSelectedAccountId = useRef(null);
  const [refetchTrigger, setRefetchTrigger] = useState(false);

  // ✅ 왼쪽 테이블 스크롤 유지용 ref
  const leftTableScrollRef = useRef(null);
  const leftScrollTopRef = useRef(0);

  const {
    balanceRows,
    depositRows,
    loading,
    fetchDeadlineBalanceList,
    fetchDepositHistoryList,
    fetchAccountDeadlineDifferencePriceSearch, // ✅ 추가
  } = useDeadlineBalanceData(year, month);

  // =========================================================
  // ✅ 권한(특정 user_id만 편집/저장/입금 가능)
  // =========================================================
  const allowedEditors = useMemo(() => new Set(["yh2", "sy9", "britzsky", "ww1"]), []);
  const userId = useMemo(() => {
    const v = localStorage.getItem("user_id");
    return (v ?? "").trim();
  }, []);
  const canEdit = useMemo(() => allowedEditors.has(userId), [allowedEditors, userId]);

  // 🔹 입금 모달 관련
  const [modalOpen, setModalOpen] = useState(false);
  const [depositForm, setDepositForm] = useState({
    customer_name: "",
    account_id: "",
    input_dt: dayjs().format("YYYY-MM-DD"),
    balance_dt: dayjs().format("YYYY-MM"),
    type: 0,
    deposit_amount: "",
    input_price: "",
    difference_price: "",
    note: "",
    balance_price: "",
    before_price: "",
  });

  // ✅ balanceRows가 갱신된 뒤 자동으로 다시 선택
  useEffect(() => {
    if (refetchTrigger && balanceRows.length > 0) {
      const refreshed = balanceRows.find((r) => r.account_id === lastSelectedAccountId.current);
      if (refreshed) {
        handleSelectCustomer(refreshed);
      }
      setRefetchTrigger(false);
    }
  }, [balanceRows, refetchTrigger]);

  // 🔹 초기 조회
  useEffect(() => {
    fetchDeadlineBalanceList();
  }, [year, month]);

  useEffect(() => {
    setEditableRows(
      balanceRows.map((r) => ({
        ...r,
        living_cost: parseNumber(r.living_cost),
        basic_cost: parseNumber(r.basic_cost),
        employ_cost: parseNumber(r.employ_cost),
        integrity_cost: parseNumber(r.integrity_cost),
        balance_price: parseNumber(r.balance_price),
        input_exp: r.input_exp ?? "",
      }))
    );
  }, [balanceRows]);

  // ✅ 거래처 선택(행 클릭): 스크롤 위치 저장/복원 + 우측 입금내역 조회
  const handleSelectCustomer = async (row) => {
    // ✅ 현재 스크롤 위치 저장
    if (leftTableScrollRef.current) {
      leftScrollTopRef.current = leftTableScrollRef.current.scrollTop || 0;
    }

    setSelectedCustomer(row);
    lastSelectedAccountId.current = row.account_id;

    // ✅ 우측 입금내역 조회
    await fetchDepositHistoryList(row.account_id, year);

    // ✅ 렌더 후 스크롤 위치 복원
    requestAnimationFrame(() => {
      if (leftTableScrollRef.current) {
        leftTableScrollRef.current.scrollTop = leftScrollTopRef.current;
      }
    });
  };

  const handleChange = (accountName, key, rawValue) => {
    // ✅ 권한 없으면 입력 차단(이중 안전장치)
    if (!canEdit) return;

    setEditableRows((prevRows) =>
      prevRows.map((r) => {
        if (r.account_name !== accountName) return r;

        const updated = { ...r };
        const original = balanceRows.find((o) => o.account_name === accountName);

        if (["living_cost", "basic_cost", "employ_cost", "integrity_cost"].includes(key)) {
          const numericValue = parseNumber(rawValue);
          updated[key] = numericValue;

          const livingDiff = parseNumber(updated.living_cost) - parseNumber(original.living_cost);
          const basicDiff = parseNumber(updated.basic_cost) - parseNumber(original.basic_cost);
          const employDiff = parseNumber(updated.employ_cost) - parseNumber(original.employ_cost);
          const integrityDiff =
            parseNumber(updated.integrity_cost) - parseNumber(original.integrity_cost);

          updated.balance_price =
            parseNumber(original.balance_price) +
            livingDiff +
            basicDiff +
            employDiff +
            integrityDiff;
        } else {
          updated[key] = rawValue;
        }
        return updated;
      })
    );
  };

  // 🔹 셀 스타일
  const getCellStyle = (accountName, key) => {
    const originalRow = balanceRows.find((r) => r.account_name === accountName);
    const currentRow = editableRows.find((r) => r.account_name === accountName);
    if (!originalRow || !currentRow) return { color: "black" };

    if (key === "balance_price") {
      const originalValue = Number(parseNumber(originalRow.balance_price));
      const currentValue = Number(parseNumber(currentRow.balance_price));

      return originalValue === currentValue
        ? { color: "black" }
        : { color: "red", fontWeight: "bold" };
    }

    if (key === "input_exp") {
      return originalRow.input_exp !== currentRow.input_exp
        ? { color: "red", fontWeight: "bold" }
        : { color: "black" };
    }

    if (["living_cost", "basic_cost", "employ_cost", "integrity_cost"].includes(key)) {
      const originalValue = Number(parseNumber(originalRow[key]));
      const currentValue = Number(parseNumber(currentRow[key]));
      return originalValue === currentValue
        ? { color: "black" }
        : { color: "red", fontWeight: "bold" };
    }

    return { color: "black" };
  };

  const makeDepositForm = (overrides = {}) => ({
    customer_name: "",
    account_id: "",
    input_dt: dayjs().format("YYYY-MM-DD"),
    balance_dt: dayjs().format("YYYY-MM"),
    type: 0,
    deposit_amount: "",
    input_price: "",
    difference_price: "",
    note: "",
    balance_price: "", // 참고용(화면/계산)
    before_price: "", // ✅ 저장 시점에만 넣을 거라 평소엔 비워둠
    ...overrides,
  });

  // 🔹 입금 모달
  const handleDepositModalOpen = () => {
    // ✅ 권한 없으면 차단
    if (!canEdit) {
      Swal.fire("권한 없음", "입금 등록 권한이 없습니다.", "warning");
      return;
    }

    if (!selectedCustomer) {
      Swal.fire("거래처를 선택하세요", "", "warning");
      return;
    }

    const latestCustomer = balanceRows.find((r) => r.account_id === selectedCustomer.account_id);

    if (!latestCustomer) {
      Swal.fire("데이터가 존재하지 않습니다.", "", "error");
      return;
    }

    if (parseNumber(latestCustomer.balance_price) === 0) {
      Swal.fire("잔액이 0원 입니다.", "", "warning");
      return;
    }

    setDepositForm({
      ...depositForm,
      customer_name: latestCustomer.account_name,
      account_id: latestCustomer.account_id,
      balance_price: latestCustomer.balance_price,
      before_price: parseNumber(latestCustomer.balance_price),
    });

    setModalOpen(true);
  };

  const handleDepositModalClose = () => {
    setDepositForm({
      customer_name: selectedCustomer?.account_name || "",
      account_id: selectedCustomer?.account_id || "",
      input_dt: dayjs().format("YYYY-MM-DD"),
      balance_dt: "",
      type: 0,
      deposit_amount: "",
      input_price: "",
      difference_price: "",
      note: "",
      balance_price: "",
      before_price: "",
    });
    setModalOpen(false);
  };

  // 🔹 입금 폼 변경
  const handleDepositChange = async (e) => {
    // ✅ 권한 없으면 변경 차단
    if (!canEdit) return;

    const { name, value } = e.target;
    let updated = { ...depositForm };

    if (["input_price", "deposit_amount"].includes(name)) {
      updated[name] = formatNumber(parseNumber(value));
    } else {
      updated[name] = value;
    }

    // ✅ 차액 자동 계산
    if (["deposit_amount", "input_price"].includes(name)) {
      const dep = parseNumber(updated.deposit_amount);
      const act = parseNumber(updated.input_price);
      updated.difference_price = formatNumber(dep - act);
    }

    // ✅ 입금 항목 선택 시 API 기반 금액 자동 세팅
    if (name === "type") {
      updated.type = value;
      updated.deposit_amount = "";
      updated.balance_dt = dayjs().format("YYYY-MM-DD");

      if (selectedCustomer && ["1", "2", "3", "5"].includes(value)) {
        const diff = await fetchAccountDeadlineDifferencePriceSearch(
          selectedCustomer.account_id,
          year,
          month,
          value
        );

        if (diff !== null) {
          updated.deposit_amount = formatNumber(diff);
        } else {
          if (value === "1")
            updated.deposit_amount = formatNumber(selectedCustomer.living_cost) || "";
          else if (value === "2")
            updated.deposit_amount = formatNumber(selectedCustomer.basic_cost) || "";
          else if (value === "3")
            updated.deposit_amount = formatNumber(selectedCustomer.employ_cost) || "";
          else if (value === "5")
            updated.deposit_amount = formatNumber(selectedCustomer.integrity_cost) || "";
        }
      } else if (value === "4") {
        updated.deposit_amount = formatNumber(selectedCustomer.balance_price) || "";
      } else {
        updated.deposit_amount = "";
      }
    }

    setDepositForm(updated);
  };

  const handleSaveDeposit = async () => {
    // ✅ 권한 없으면 저장 차단
    if (!canEdit) {
      Swal.fire("권한 없음", "입금 저장 권한이 없습니다.", "warning");
      return;
    }

    if (depositForm.type == 1) {
      if (parseNumber(depositForm.deposit_amount) === 0) {
        Swal.fire("생계비 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (depositForm.type == 2) {
      if (parseNumber(depositForm.deposit_amount) === 0) {
        Swal.fire("일반식대 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (depositForm.type == 3) {
      if (parseNumber(depositForm.deposit_amount) === 0) {
        Swal.fire("직원식대 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (depositForm.type == 5) {
      if (parseNumber(depositForm.deposit_amount) === 0) {
        Swal.fire("보전 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (parseNumber(depositForm.balance_price) === 0) {
      Swal.fire("잔액이 0원 입니다.", "", "success");
      return;
    }

    try {
      const payload = {
        ...depositForm,
        // ✅ 숫자형 정리
        deposit_amount: parseNumber(depositForm.deposit_amount),
        input_price: parseNumber(depositForm.input_price),
        difference_price: parseNumber(depositForm.difference_price),

        // ✅ 저장 시점 balance_price 계산
        balance_price:
          parseNumber(depositForm.balance_price) - parseNumber(depositForm.input_price),

        year,
        month,
      };

      await api.post("/Account/AccountDepositHistorySave", payload);
      Swal.fire("입금 내역이 저장되었습니다.", "", "success");
      await fetchDeadlineBalanceList();
      await fetchDepositHistoryList(selectedCustomer.account_id, year);
      setRefetchTrigger(true);
      handleDepositModalClose();
      setModalOpen(false);
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // 🔹 변경사항 저장
  const handleSaveChanges = async () => {
    // ✅ 권한 없으면 저장 차단
    if (!canEdit) {
      Swal.fire("권한 없음", "저장 권한이 없습니다.", "warning");
      return;
    }

    const modifiedRows = editableRows
      .map((r) => {
        const originalRow = balanceRows.find((o) => o.account_name === r.account_name);
        if (!originalRow) return null;

        const changed =
          parseNumber(originalRow.living_cost) !== parseNumber(r.living_cost) ||
          parseNumber(originalRow.basic_cost) !== parseNumber(r.basic_cost) ||
          parseNumber(originalRow.employ_cost) !== parseNumber(r.employ_cost) ||
          parseNumber(originalRow.integrity_cost) !== parseNumber(r.integrity_cost) ||
          originalRow.input_exp !== r.input_exp;

        if (!changed) return null;

        return {
          ...r,
          living_cost: parseNumber(r.living_cost),
          basic_cost: parseNumber(r.basic_cost),
          employ_cost: parseNumber(r.employ_cost),
          integrity_cost: parseNumber(r.integrity_cost),
          balance_price: parseNumber(r.balance_price),
          before_price: parseNumber(r.before_price),
          year,
          month,
        };
      })
      .filter(Boolean);

    if (modifiedRows.length === 0) {
      Swal.fire("변경된 내용이 없습니다.", "", "info");
      return;
    }

    try {
      await api.post("/Account/AccountDeadlineBalanceSave", { rows: modifiedRows });
      Swal.fire("변경 사항이 저장되었습니다.", "", "success");
      fetchDeadlineBalanceList();
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // 🔹 컬럼 정의
  const columns = useMemo(
    () => [
      { header: "거래처", accessorKey: "account_name" },
      { header: "생계비", accessorKey: "living_cost" },
      { header: "일반식대", accessorKey: "basic_cost" },
      { header: "직원식대", accessorKey: "employ_cost" },
      { header: "보전", accessorKey: "integrity_cost" },
      { header: "이전 미수잔액", accessorKey: "before_price2" },
      { header: "총 미수잔액", accessorKey: "balance_price" },
      { header: "입금예정일", accessorKey: "input_exp" },
    ],
    []
  );

  const columns2 = useMemo(
    () => [
      { header: "입금일자", accessorKey: "input_dt" },
      { header: "입금항목", accessorKey: "type" },
      { header: "입금금액", accessorKey: "deposit_amount" },
      { header: "실 입금액", accessorKey: "input_price" },
      { header: "차액", accessorKey: "difference_price" },
      { header: "비고", accessorKey: "note" },
    ],
    []
  );

  // ✅ 반응형 테이블 스타일
  const tableSx = useMemo(
    () => ({
      flex: 1,
      maxHeight: isMobile ? "55vh" : "70vh",
      overflowY: "auto",
      overflowX: "auto", // 모바일에서 가로 스크롤 허용
      "& table": {
        borderCollapse: "separate",
        width: "max-content",
        minWidth: "100%",
        borderSpacing: 0,
      },
      "& th, & td": {
        border: "1px solid #686D76",
        textAlign: "center",
        padding: isMobile ? "3px" : "4px",
        whiteSpace: "pre-wrap",
        fontSize: isMobile ? "11px" : "12px",
        verticalAlign: "middle",
      },
      "& th": {
        backgroundColor: "#f0f0f0",
        position: "sticky",
        top: 0,
        zIndex: 2,
      },
      "& input[type='date'], & input[type='text']": {
        fontSize: isMobile ? "11px" : "12px",
        padding: isMobile ? "3px" : "4px",
        minWidth: isMobile ? "70px" : "80px",
        border: "none",
        background: "transparent",
      },
    }),
    [isMobile]
  );

  // ✅ 초기 로딩만 전체 로딩 화면 표시 (행 클릭 시 스크롤 튐 방지)
  const isInitialLoading = loading && balanceRows.length === 0;
  if (isInitialLoading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터 영역 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: 1,
        }}
      >
        <MDBox
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          {/* ✅ 읽기전용 사용자 안내(선택사항) */}
          {!canEdit && (
            <MDTypography variant="button" color="error" fontWeight="bold">
              🚫 현재 계정({userId || "unknown"})은 조회만 가능합니다. (입력/저장/입금 불가)
            </MDTypography>
          )}

          <TextField
            select
            size="small"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            sx={{ minWidth: isMobile ? 140 : 150 }} // ← 거래처와 동일
            SelectProps={{ native: true }}
          >
            {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            sx={{ minWidth: isMobile ? 140 : 150 }} // ← 거래처와 동일
            SelectProps={{ native: true }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </TextField>
        </MDBox>

        <MDBox
          sx={{
            display: "flex",
            gap: 1,
            mt: isMobile ? 1 : 0,
          }}
        >
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleDepositModalOpen}
            disabled={!canEdit}
          >
            입금
          </MDButton>
          <MDButton
            variant="gradient"
            color="success"
            onClick={handleSaveChanges}
            disabled={!canEdit}
          >
            저장
          </MDButton>
        </MDBox>
      </MDBox>

      {/* 메인 테이블 */}
      <Grid container spacing={2}>
        {/* 좌측 테이블 */}
        <Grid item xs={12} md={6}>
          <MDBox
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            position="sticky"
            top={0}
            zIndex={3}
          >
            <MDTypography variant="h6" color="white" sx={{ fontSize: isMobile ? "14px" : "16px" }}>
              거래처별 미수잔액
            </MDTypography>
          </MDBox>

          <Box sx={tableSx} ref={leftTableScrollRef}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#f0f0f0", zIndex: 2 }}>
                <tr>
                  {columns.map((col) => (
                    <th key={col.accessorKey}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row, i) => {
                  const isSelected = selectedCustomer?.account_id === row.account_id;

                  return (
                    <tr key={i}>
                      {columns.map((col) => {
                        const key = col.accessorKey;
                        const value = row[key];

                        const baseTdStyle = {
                          cursor: key === "account_name" ? "pointer" : "default",
                          backgroundColor: isSelected ? "#ffe4e1" : "transparent",
                          fontWeight: isSelected ? "bold" : "normal",
                        };

                        if (key === "account_name") {
                          return (
                            <td
                              key={key}
                              style={baseTdStyle}
                              onClick={() => handleSelectCustomer(row)}
                            >
                              {value}
                            </td>
                          );
                        }

                        if (
                          [
                            "living_cost",
                            "basic_cost",
                            "employ_cost",
                            "integrity_cost",
                            "input_exp",
                            "balance_price",
                          ].includes(key)
                        ) {
                          return (
                            <td key={key} align="right" style={baseTdStyle}>
                              <input
                                type="text"
                                disabled={!canEdit} // ✅ 입력 막기
                                value={
                                  key === "input_exp" ? value ?? "" : formatNumber(value ?? "")
                                }
                                onChange={(e) =>
                                  handleChange(row.account_name, key, e.target.value)
                                }
                                onBlur={(e) => {
                                  if (!canEdit) return;
                                  if (key !== "input_exp") {
                                    const formatted = formatNumber(parseNumber(e.target.value));
                                    setEditableRows((prev) =>
                                      prev.map((r) =>
                                        r.account_name === row.account_name
                                          ? { ...r, [key]: parseNumber(formatted) }
                                          : r
                                      )
                                    );
                                  }
                                }}
                                style={{
                                  width: key === "input_exp" ? "100px" : "80px",
                                  border: "none",
                                  textAlign: key === "input_exp" ? "left" : "right",
                                  background: "transparent",
                                  ...(canEdit
                                    ? getCellStyle(row.account_name, key)
                                    : { color: "black" }),
                                  // ✅ 읽기전용 느낌(선택사항)
                                  opacity: canEdit ? 1 : 0.75,
                                  cursor: canEdit ? "text" : "not-allowed",
                                }}
                              />
                            </td>
                          );
                        }

                        // 일반 표시 셀(예: before_price2)
                        return (
                          <td
                            key={key}
                            align="right"
                            style={{
                              ...baseTdStyle,
                              // ✅ 선택 행이면 무조건 분홍색이 우선
                              backgroundColor: isSelected
                                ? "#ffe4e1"
                                : key === "before_price2"
                                ? "#FDE7B3"
                                : "transparent",
                              fontWeight: "bold",
                            }}
                          >
                            {formatNumber(value)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </Grid>

        {/* 우측 테이블 */}
        <Grid item xs={12} md={6}>
          <MDBox
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            position="sticky"
            top={0}
            zIndex={3}
          >
            <MDTypography variant="h6" color="white" sx={{ fontSize: isMobile ? "14px" : "16px" }}>
              입금내역
            </MDTypography>
          </MDBox>

          <Box sx={tableSx}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#f0f0f0", zIndex: 2 }}>
                <tr>
                  {columns2.map((col) => (
                    <th key={col.accessorKey}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedCustomer &&
                  depositRows.map((row, i) => (
                    <tr key={i}>
                      {columns2.map((col) => {
                        const key = col.accessorKey;
                        const value = row[key];
                        if (["deposit_amount", "input_price", "difference_price"].includes(key)) {
                          return (
                            <td key={key} align="right">
                              {formatNumber(value)}
                            </td>
                          );
                        }
                        return <td key={key}>{value}</td>;
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </Box>
        </Grid>
      </Grid>

      {/* 입금 모달 */}
      <Modal open={modalOpen} onClose={handleDepositModalClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? "90vw" : 500, // ✅ 모바일에서 넓이 줄이기
            maxHeight: "90vh",
            overflowY: "auto",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: isMobile ? 3 : 5,
          }}
        >
          <MDTypography variant="h6" mb={2} sx={{ fontSize: isMobile ? "15px" : "18px" }}>
            입금 등록
          </MDTypography>
          <TextField
            label="거래처"
            value={depositForm.customer_name}
            fullWidth
            margin="dense"
            disabled
          />

          <Box display="flex" gap={1} mb={2} flexDirection={isMobile ? "column" : "row"}>
            <TextField
              margin="normal"
              label="입금일자"
              type="date"
              name="input_dt"
              value={depositForm.input_dt}
              onChange={handleDepositChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              disabled={!canEdit}
            />
            <TextField
              select
              fullWidth
              margin="normal"
              name="type"
              value={depositForm.type}
              SelectProps={{ native: true }}
              onChange={handleDepositChange}
              disabled={!canEdit}
            >
              <option value="">선택</option>
              <option value="1">생계비</option>
              <option value="2">일반식대</option>
              <option value="3">직원식대</option>
              <option value="5">보전</option>
              <option value="4">미수잔액</option>
            </TextField>
          </Box>

          <TextField
            label="입금금액"
            name="deposit_amount"
            value={depositForm.deposit_amount}
            fullWidth
            margin="dense"
            disabled
          />
          <TextField
            label="실입금액"
            name="input_price"
            value={depositForm.input_price}
            onChange={handleDepositChange}
            fullWidth
            margin="dense"
            disabled={!canEdit}
          />
          <TextField
            label="차액"
            name="difference_price"
            value={depositForm.difference_price}
            fullWidth
            margin="dense"
            disabled
          />
          <TextField
            label="비고"
            name="note"
            value={depositForm.note}
            onChange={handleDepositChange}
            fullWidth
            margin="dense"
            disabled={!canEdit}
          />

          <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
            <Button variant="contained" onClick={handleDepositModalClose}>
              취소
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveDeposit}
              disabled={!canEdit}
            >
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}
