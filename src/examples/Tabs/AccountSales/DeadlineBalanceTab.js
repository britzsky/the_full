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
} from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import api from "api/api";

// 🔹 데이터 훅 import
import useDeadlineBalanceData, { parseNumber, formatNumber } from "./deadlineBalanceData";

export default function DeadlineBalanceTab() {

  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editableRows, setEditableRows] = useState([]);

  // ✅ 마지막 선택 고객 기억용 ref
  const lastSelectedAccountId = useRef(null);
  const [refetchTrigger, setRefetchTrigger] = useState(false);

  const {
    balanceRows,
    depositRows,
    fetchDeadlineBalanceList,
    fetchDepositHistoryList,
    fetchAccountDeadlineDifferencePriceSearch, // ✅ 추가
  } = useDeadlineBalanceData(year, month);

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
    before_price: ""
  });

  // ✅ balanceRows가 갱신된 뒤 자동으로 다시 선택
  useEffect(() => {
    if (refetchTrigger && balanceRows.length > 0) {
      const refreshed = balanceRows.find(
        (r) => r.account_id === lastSelectedAccountId.current
      );
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
        balance_price: parseNumber(r.balance_price),
        input_exp: r.input_exp ?? "",
      }))
    );
  }, [balanceRows]);

  const handleSelectCustomer = (row) => {
    setSelectedCustomer(row);
    fetchDepositHistoryList(row.account_id, year);
  };

  const handleChange = (accountName, key, rawValue) => {
    setEditableRows((prevRows) =>
      prevRows.map((r) => {
        if (r.account_name !== accountName) return r;

        const updated = { ...r };
        const original = balanceRows.find((o) => o.account_name === accountName);

        if (["living_cost", "basic_cost", "employ_cost"].includes(key)) {
          const numericValue = parseNumber(rawValue);
          updated[key] = numericValue;

          const livingDiff = parseNumber(updated.living_cost) - parseNumber(original.living_cost);
          const basicDiff = parseNumber(updated.basic_cost) - parseNumber(original.basic_cost);
          const employDiff = parseNumber(updated.employ_cost) - parseNumber(original.employ_cost);

          updated.balance_price =
            parseNumber(original.balance_price) + livingDiff + basicDiff + employDiff;
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

    if (["living_cost", "basic_cost", "employ_cost"].includes(key)) {
      const originalValue = Number(parseNumber(originalRow[key]));
      const currentValue = Number(parseNumber(currentRow[key]));
      return originalValue === currentValue
        ? { color: "black" }
        : { color: "red", fontWeight: "bold" };
    }

    return { color: "black" };
  };

  // 🔹 입금 모달
  const handleDepositModalOpen = () => {
    if (!selectedCustomer) {
      Swal.fire("거래처를 선택하세요", "", "warning");
      return;
    }

    const latestCustomer = balanceRows.find(
      (r) => r.account_id === selectedCustomer.account_id
    );

    if (!latestCustomer) {
      Swal.fire("데이터가 존재하지 않습니다.", "", "error");
      return;
    }

    if (parseNumber(latestCustomer.balance_price) === 0) {
      Swal.fire("잔액이 0원 입니다.", "", "warning");
      return;
    }

    console.log("📊 최신 balance_price:", latestCustomer.balance_price);

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
      customer_name: selectedCustomer.account_name,
      account_id: selectedCustomer.account_id,
      input_dt: dayjs().format("YYYY-MM-DD"),
      balance_dt: "",
      type: 0,
      deposit_amount: "",
      input_price: "",
      difference_price: "",
      note: "",
      balance_price: "",
      before_price: ""
    });
    setModalOpen(false);
  } 

  // 🔹 입금 폼 변경
  const handleDepositChange = async (e) => {
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

      if (selectedCustomer && ["1", "2", "3"].includes(value)) {
        const diff = await fetchAccountDeadlineDifferencePriceSearch(
          selectedCustomer.account_id,
          year,
          month,
          value
        );

        // 응답값 있으면 API 값 사용, 없으면 기존 balanceRows 값 사용
        if (diff !== null) {
          console.log(diff);
          updated.deposit_amount = formatNumber(diff);
        } else {
          if (value === "1")
            updated.deposit_amount = formatNumber(selectedCustomer.living_cost) || "";
          else if (value === "2")
            updated.deposit_amount = formatNumber(selectedCustomer.basic_cost) || "";
          else if (value === "3")
            updated.deposit_amount = formatNumber(selectedCustomer.employ_cost) || "";
        }
      } else if (value === "4") {
        // 미수잔액은 기존 잔액 전체
        updated.deposit_amount = formatNumber(selectedCustomer.balance_price) || "";
      } else {
        updated.deposit_amount = "";
      }
    }

    setDepositForm(updated);
  };

  const handleSaveDeposit = async () => {

    if (depositForm.type == 1) {
      if (parseNumber(depositForm.deposit_amount) == 0) {
        Swal.fire("생계비 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (depositForm.type == 2) {
      if (parseNumber(depositForm.deposit_amount) == 0) {
        Swal.fire("일반식대 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (depositForm.type == 3) {
      if (parseNumber(depositForm.deposit_amount) == 0) {
        Swal.fire("직원식대 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (parseNumber(depositForm.balance_price) == 0) {
      Swal.fire("잔액이 0원 입니다.", "", "success");
      return;
    }

    try {
      const payload = {
        ...depositForm,
        deposit_amount: parseNumber(depositForm.deposit_amount),
        input_price: parseNumber(depositForm.input_price),
        difference_price: parseNumber(depositForm.difference_price),
        balance_price: parseNumber(depositForm.balance_price) - parseNumber(depositForm.input_price),
        year,
        month,
      };
      await api.post("/Account/AccountDepositHistorySave", payload);
      Swal.fire("입금 내역이 저장되었습니다.", "", "success");
      await fetchDeadlineBalanceList();
      await fetchDepositHistoryList(selectedCustomer.account_id, year);
      // ✅ balanceRows 갱신 후 자동 재선택 트리거
      setRefetchTrigger(true);
      handleDepositModalClose();
      setModalOpen(false);
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // 🔹 변경사항 저장
  const handleSaveChanges = async () => {
    const modifiedRows = editableRows
      .map((r) => {
        const originalRow = balanceRows.find((o) => o.account_name === r.account_name);
        if (!originalRow) return null;
        const changed =
          parseNumber(originalRow.living_cost) !== parseNumber(r.living_cost) ||
          parseNumber(originalRow.basic_cost) !== parseNumber(r.basic_cost) ||
          parseNumber(originalRow.employ_cost) !== parseNumber(r.employ_cost) ||
          originalRow.input_exp !== r.input_exp;
        if (!changed) return null;

        return {
          ...r,
          living_cost: parseNumber(r.living_cost),
          basic_cost: parseNumber(r.basic_cost),
          employ_cost: parseNumber(r.employ_cost),
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

  const tableSx = {
    flex: 1,
    maxHeight: "80vh", 
    overflowY: "auto",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "4px",
      whiteSpace: "pre-wrap",
      fontSize: "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& input[type='date'], & input[type='text']": {
      fontSize: "12px",
      padding: "4px",
      minWidth: "80px",
      border: "none",
      background: "transparent",
    },
  };

  return (
    <>
      {/* 상단 필터 영역 */}
      <MDBox pt={1} pb={1} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} size="small">
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>{y}년</MenuItem>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} size="small">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <MenuItem key={m} value={m}>{m}월</MenuItem>
          ))}
        </Select>
        <MDButton variant="gradient" color="info" onClick={handleDepositModalOpen}>입금</MDButton>
        <MDButton variant="gradient" color="success" onClick={handleSaveChanges}>저장</MDButton>
      </MDBox>

      {/* 메인 테이블 */}
      <Grid container spacing={2}>
        {/* 좌측 테이블 */}
        <Grid item xs={6}>
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
            <MDTypography variant="h6" color="white">
              거래처별 미수잔액
            </MDTypography>
          </MDBox>

          <Box sx={tableSx}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#f0f0f0", zIndex: 2 }}>
                <tr>
                  {columns.map((col) => <th key={col.accessorKey}>{col.header}</th>)}
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => {
                      const key = col.accessorKey;
                      const value = row[key];

                      if (key === "account_name") {
                        return (
                          <td
                            key={key}
                            style={{
                              cursor: "pointer",
                              backgroundColor:
                                selectedCustomer?.account_name === row.account_name
                                  ? "#ffe4e1"
                                  : "transparent",
                              fontWeight:
                                selectedCustomer?.account_name === row.account_name
                                  ? "bold"
                                  : "normal",
                            }}
                            onClick={() => handleSelectCustomer(row)}
                          >
                            {value}
                          </td>
                        );
                      }

                      if (["living_cost", "basic_cost", "employ_cost", "input_exp", "balance_price"].includes(key)) {
                        return (
                          <td key={key} align="right">
                            <input
                              type="text"
                              value={formatNumber(value ?? "")}
                              onChange={(e) => handleChange(row.account_name, key, e.target.value)}
                              onBlur={(e) => {
                                const formatted = formatNumber(parseNumber(e.target.value));
                                setEditableRows((prev) =>
                                  prev.map((r) =>
                                    r.account_name === row.account_name
                                      ? { ...r, [key]: parseNumber(formatted) }
                                      : r
                                  )
                                );
                              }}
                              style={{
                                width: key === "input_exp" ? "100px" : "80px",
                                border: "none",
                                textAlign: key === "input_exp" ? "left" : "right",
                                background: "transparent",
                                ...getCellStyle(row.account_name, key),
                              }}
                            />
                          </td>
                        );
                      }

                      return <td key={key} align="right" style={{ fontWeight:"bold", backgroundColor: key === "before_price2" ? "#FDE7B3" : "", }} >{formatNumber(value)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Grid>

        {/* 우측 테이블 */}
        <Grid item xs={6}>
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
            <MDTypography variant="h6" color="white">
              입금내역
            </MDTypography>
          </MDBox>

          <Box sx={tableSx}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "#f0f0f0", zIndex: 2 }}>
                <tr>
                  {columns2.map((col) => <th key={col.accessorKey}>{col.header}</th>)}
                </tr>
              </thead>
              <tbody>
                {selectedCustomer && depositRows.map((row, i) => (
                  <tr key={i}>
                    {columns2.map((col) => {
                      const key = col.accessorKey;
                      const value = row[key];
                      if (["deposit_amount", "input_price", "difference_price"].includes(key)) {
                        return <td key={key} align="right">{formatNumber(value)}</td>;
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
            width: 500,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 5,
          }}
        >
          <MDTypography variant="h6" mb={2}>
            입금 등록
          </MDTypography>
          <TextField
            label="거래처"
            value={depositForm.customer_name}
            fullWidth
            margin="dense"
            disabled
          />
          <Box display="flex" gap={1} mb={2}>
            <TextField
              margin="normal"
              label="입금일자"
              type="date"
              name="input_dt"
              value={depositForm.input_dt}
              onChange={handleDepositChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              fullWidth
              margin="normal"
              name="type"
              value={depositForm.type}
              SelectProps={{ native: true }}
              onChange={handleDepositChange}
            >
              <option value="">선택</option>
              <option value="1">생계비</option>
              <option value="2">일반식대</option>
              <option value="3">직원식대</option>
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
          />
          <Box display="flex" justifyContent="flex-end" gap={1}>
            <Button variant="contained" onClick={handleDepositModalClose}>
              취소
            </Button>
            <Button variant="contained" color="primary" onClick={handleSaveDeposit}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}
