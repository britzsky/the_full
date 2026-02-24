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
  const allowedEditors = useMemo(
    () => new Set(["yh2", "sy9", "britzsky", "ww1", "dh2", "hh2"]),
    []
  );
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
    // ✅ 입금 모달에서 직접 선택한 미수 기준 연/월
    base_year: year,
    base_month: month,
    type: "",
    refund_target: "1",
    deposit_amount: "",
    input_price: "",
    difference_price: "",
    note: "",
    balance_price: "",
    before_price: "",
  });
  const AUTO_DEPOSIT_TYPES = new Set(["1", "2", "3", "4", "5", "6"]);
  const API_BASED_TYPES = new Set(["1", "2", "3", "4", "5"]);
  const REFUND_TARGET_LABEL_BY_CODE = {
    1: "생계비",
    2: "일반식대",
    3: "직원식대",
    5: "보전",
  };

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
    // ✅ 기본값은 현재 조회 연/월로 세팅
    base_year: year,
    base_month: month,
    type: "",
    refund_target: "1",
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

    setDepositForm({
      ...depositForm,
      customer_name: latestCustomer.account_name,
      account_id: latestCustomer.account_id,
      // ✅ 미수 기준은 항상 현재 조회 연/월 기준으로 시작
      base_year: year,
      base_month: month,
      refund_target: "1",
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
      // ✅ 모달 재오픈 시에도 현재 조회 연/월을 기본값으로 유지
      base_year: year,
      base_month: month,
      type: "",
      refund_target: "1",
      deposit_amount: "",
      input_price: "",
      difference_price: "",
      note: "",
      balance_price: "",
      before_price: "",
    });
    setModalOpen(false);
  };

  // ✅ 현재 폼 값으로 차액(입금금액 - 실입금액) 계산
  const applyDifferencePrice = (form) => {
    const dep = parseNumber(form.deposit_amount);
    const act = parseNumber(form.input_price);
    return {
      ...form,
      difference_price: formatNumber(dep - act),
    };
  };

  const isDepositTypeSelected = (formState) => {
    const selectedType = String(formState?.type || "").trim();
    return AUTO_DEPOSIT_TYPES.has(selectedType);
  };

  const isInputPriceLockedByMissingType = (formState) => !isDepositTypeSelected(formState);

  const isInputPriceLockedByZeroBalance = (formState) => {
    const selectedType = String(formState?.type || "");
    if (!AUTO_DEPOSIT_TYPES.has(selectedType) || selectedType === "6") return false;
    return parseNumber(formState.deposit_amount) === 0;
  };

  const isInputPriceLockedInModal = (formState) =>
    isInputPriceLockedByMissingType(formState) || isInputPriceLockedByZeroBalance(formState);

  const handleInputPriceMouseDown = (e) => {
    if (!canEdit) return;
    if (isInputPriceLockedByMissingType(depositForm)) {
      e.preventDefault();
      Swal.fire("입금항목 확인", "입금항목을 선택하세요.", "warning");
      return;
    }
    if (!isInputPriceLockedByZeroBalance(depositForm)) return;
    e.preventDefault();
    Swal.fire({
      title: "잔액이 0원 입니다.",
      icon: "warning",
      confirmButtonText: "확인",
    });
  };

  // ✅ 미수기준 연/월 + 타입 기준 차액 조회(월값 2자리/1자리 모두 시도)
  const fetchDifferenceByBaseYm = async (accountId, targetYear, targetMonth, targetType) => {
    const monthCandidates = Array.from(
      new Set([String(targetMonth), String(targetMonth).padStart(2, "0")])
    );
    for (const monthKey of monthCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const found = await fetchAccountDeadlineDifferencePriceSearch(
        accountId,
        targetYear,
        monthKey,
        targetType
      );
      if (found !== null) return found;
    }
    return null;
  };

  // ✅ 타입 + 미수기준 연/월 기준으로 입금금액 재계산
  const resolveDepositAmountByType = async (formState, typeValue) => {
    if (!selectedCustomer) return "";

    const normalizedType = String(typeValue || "");
    if (!AUTO_DEPOSIT_TYPES.has(normalizedType)) return "";
    if (normalizedType === "6") return formatNumber(0);
    // ✅ 미수잔액(4)은 항상 좌측 총 미수잔액을 표시
    if (normalizedType === "4") return formatNumber(parseNumber(selectedCustomer?.balance_price));

    if (!API_BASED_TYPES.has(normalizedType)) return "";

    const targetYear = Number(formState.base_year || year);
    const targetMonth = Number(formState.base_month || month);
    const isCurrentBaseYm = targetYear === Number(year) && targetMonth === Number(month);

    // ✅ 1/2/3/4/5 모두 선택한 미수기준 연/월의 차액조회 API를 우선 사용
    const found = await fetchDifferenceByBaseYm(
      selectedCustomer.account_id,
      targetYear,
      targetMonth,
      normalizedType
    );
    if (found !== null) return formatNumber(Math.max(0, found));

    // ✅ 해당 기준 연/월 이력이 아직 없을 때 현재 조회 연/월이면 화면 값으로 보정
    if (isCurrentBaseYm) {
      const fallbackByType = {
        1: parseNumber(selectedCustomer?.living_cost),
        2: parseNumber(selectedCustomer?.basic_cost),
        3: parseNumber(selectedCustomer?.employ_cost),
        5: parseNumber(selectedCustomer?.integrity_cost),
        4: parseNumber(selectedCustomer?.balance_price),
      };
      return formatNumber(Number(fallbackByType[normalizedType] || 0));
    }

    return formatNumber(0);
  };

  const buildRefundBaseNote = (targetCode) => {
    const label = REFUND_TARGET_LABEL_BY_CODE[String(targetCode || "1")] || "생계비";
    return `${label} 환불`;
  };

  const normalizeRefundNote = (noteValue, targetCode) => {
    const refundBaseNote = buildRefundBaseNote(targetCode);
    const cleanedNote = String(noteValue || "")
      .replace(/^\[환불\]\s*/u, "")
      .trim();

    if (!cleanedNote) return refundBaseNote;

    const oldPrefixMatch = cleanedNote.match(/^(생계비|일반식대|직원식대|보전)\s+환불(?:\s+(.*))?$/u);
    if (oldPrefixMatch) {
      const suffix = String(oldPrefixMatch[2] || "").trim();
      return suffix ? `${refundBaseNote} ${suffix}` : refundBaseNote;
    }

    return `${refundBaseNote} ${cleanedNote}`;
  };

  const normalizeDepositTypeCode = (rawType) => {
    const typeValue = String(rawType || "").trim();
    if (!typeValue) return "";
    if (["1", "2", "3", "4", "5", "6"].includes(typeValue)) return typeValue;

    const codeByLabel = {
      생계비: "1",
      일반식대: "2",
      직원식대: "3",
      미수잔액: "4",
      보전: "5",
      환불: "6",
    };
    return codeByLabel[typeValue] || "";
  };

  const hasRefundBaseDepositHistory = (formState) => {
    const targetYear = Number(formState?.base_year || 0);
    const targetMonth = Number(formState?.base_month || 0);
    const targetTypeCode = String(formState?.refund_target || "1");

    return depositRows.some((row) => {
      if (Number(row?.year || 0) !== targetYear || Number(row?.month || 0) !== targetMonth) {
        return false;
      }

      const rowTypeCode = normalizeDepositTypeCode(row?.type);
      if (rowTypeCode === "6") return false;
      if (rowTypeCode && rowTypeCode !== targetTypeCode) return false;

      return parseNumber(row?.input_price) > 0;
    });
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

    if (name === "input_price" && isInputPriceLockedInModal(updated)) {
      return;
    }

    // ✅ 타입 변경 시 기본값 정리
    if (name === "type") {
      updated.type = value;
      updated.balance_dt = dayjs().format("YYYY-MM-DD");
      if (String(value) === "6") {
        updated.deposit_amount = formatNumber(0);
        if (!updated.refund_target) updated.refund_target = "1";
        // ✅ 환불 선택 시 비고 기본값 즉시 표시
        updated.note = normalizeRefundNote(updated.note, updated.refund_target);
      } else {
        // ✅ 환불 -> 일반 항목 전환 시 환불 전용 비고 자동 제거
        const removedTag = String(updated.note || "").replace(/^\[환불\]\s*/u, "").trim();
        updated.note = removedTag
          .replace(/^(생계비|일반식대|직원식대|보전)\s+환불(?:\s+)?/u, "")
          .trim();
      }
    }

    if (name === "refund_target" && String(updated.type || "") === "6") {
      // ✅ 환불대상 변경 시 비고의 항목명도 동기화
      updated.note = normalizeRefundNote(updated.note, updated.refund_target);
    }

    // ✅ 타입/미수기준 연/월 변경 시 입금금액 재계산
    if (["type", "base_year", "base_month"].includes(name)) {
      const currentType = String(updated.type || "");
      updated.deposit_amount = await resolveDepositAmountByType(updated, currentType);
      if (isInputPriceLockedInModal(updated)) {
        updated.input_price = "";
      }
    }

    // ✅ 어떤 항목이 바뀌든 최종 차액은 항상 최신 입금금액/실입금액 기준으로 계산
    setDepositForm(applyDifferencePrice(updated));
  };

  // ✅ 환불 저장 시 좌측 항목 금액만 감액, 총 미수잔액은 유지
  const applyRefundAdjustmentToDeadline = async (refundAmount) => {
    const targetByCode = {
      1: { key: "living_cost", label: "생계비" },
      2: { key: "basic_cost", label: "일반식대" },
      3: { key: "employ_cost", label: "직원식대" },
      5: { key: "integrity_cost", label: "보전" },
    };
    const targetInfo = targetByCode[String(depositForm.refund_target || "1")] || targetByCode[1];

    const currentRow =
      editableRows.find((row) => String(row.account_id) === String(selectedCustomer?.account_id || "")) ||
      balanceRows.find((row) => String(row.account_id) === String(selectedCustomer?.account_id || ""));

    if (!currentRow) {
      throw new Error("환불 대상 거래처 데이터를 찾을 수 없습니다.");
    }

    const currentTarget = parseNumber(currentRow[targetInfo.key]);
    const appliedAmount = Math.min(Math.max(refundAmount, 0), Math.max(currentTarget, 0));

    const nextRow = {
      ...currentRow,
      [targetInfo.key]: currentTarget - appliedAmount,
      balance_price: parseNumber(currentRow.balance_price),
    };

    const rowPayload = {
      account_id: nextRow.account_id,
      account_name: nextRow.account_name,
      living_cost: parseNumber(nextRow.living_cost),
      basic_cost: parseNumber(nextRow.basic_cost),
      employ_cost: parseNumber(nextRow.employ_cost),
      integrity_cost: parseNumber(nextRow.integrity_cost),
      balance_price: parseNumber(nextRow.balance_price),
      before_price: parseNumber(nextRow.before_price),
      input_exp: nextRow.input_exp ?? "",
      year: Number(year),
      month: Number(month),
    };

    await api.post("/Account/AccountDeadlineBalanceSave", { rows: [rowPayload] });
    setEditableRows((prev) =>
      prev.map((row) =>
        String(row.account_id) === String(nextRow.account_id)
          ? {
            ...row,
            [targetInfo.key]: parseNumber(nextRow[targetInfo.key]),
            balance_price: parseNumber(nextRow.balance_price),
          }
          : row
      )
    );

    return { targetLabel: targetInfo.label, appliedAmount };
  };

  const handleSaveDeposit = async () => {
    // ✅ 권한 없으면 저장 차단
    if (!canEdit) {
      Swal.fire("권한 없음", "입금 저장 권한이 없습니다.", "warning");
      return;
    }

    const selectedType = String(depositForm.type || "").trim();
    if (!AUTO_DEPOSIT_TYPES.has(selectedType)) {
      Swal.fire("입금항목 확인", "입금항목을 선택하세요.", "warning");
      return;
    }

    const isRefundType = selectedType === "6";

    if (isRefundType) {
      if (Number(depositForm.base_year) !== Number(year) || Number(depositForm.base_month) !== Number(month)) {
        Swal.fire("환불 기준 확인", "환불은 현재 조회 중인 연/월 기준에서만 처리할 수 있습니다.", "warning");
        return;
      }
      if (!hasRefundBaseDepositHistory(depositForm)) {
        Swal.fire("미수기준일 입금이 없습니다.", "", "warning");
        return;
      }
      if (parseNumber(depositForm.input_price) <= 0) {
        Swal.fire("환불금액 확인", "환불금액(실입금액)을 0보다 크게 입력하세요.", "warning");
        return;
      }
    }

    // ✅ 일반 입금은 실입금액 입력이 없으면 저장 차단
    if (!isRefundType && parseNumber(depositForm.input_price) <= 0) {
      Swal.fire("실입금액 확인", "실입금액을 입력하세요.", "warning");
      return;
    }

    if (!isRefundType && selectedType === "1") {
      if (parseNumber(depositForm.deposit_amount) === 0) {
        Swal.fire("생계비 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (!isRefundType && selectedType === "2") {
      if (parseNumber(depositForm.deposit_amount) === 0) {
        Swal.fire("일반식대 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (!isRefundType && selectedType === "3") {
      if (parseNumber(depositForm.deposit_amount) === 0) {
        Swal.fire("직원식대 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (!isRefundType && selectedType === "5") {
      if (parseNumber(depositForm.deposit_amount) === 0) {
        Swal.fire("보전 잔액이 0원 입니다.", "", "success");
        return;
      }
    }

    if (!isRefundType && parseNumber(depositForm.balance_price) === 0) {
      Swal.fire("잔액이 0원 입니다.", "", "success");
      return;
    }

    try {
      const normalizedNote = String(depositForm.note || "").trim();
      const refundHumanNote = normalizeRefundNote(normalizedNote, depositForm.refund_target);
      const noteWithRefundTag =
        isRefundType ? `[환불] ${refundHumanNote}` : normalizedNote;

      const payload = {
        ...depositForm,
        note: noteWithRefundTag,
        // ✅ 숫자형 정리
        deposit_amount: isRefundType ? 0 : parseNumber(depositForm.deposit_amount),
        input_price: parseNumber(depositForm.input_price),
        difference_price: parseNumber(depositForm.difference_price),

        // ✅ 저장 시점 balance_price 계산
        balance_price:
          isRefundType
            ? parseNumber(depositForm.balance_price)
            : parseNumber(depositForm.balance_price) - parseNumber(depositForm.input_price),

        // ✅ tb_account_deposit_history의 year/month는 모달 미수 기준값으로 저장
        year: Number(depositForm.base_year || 0),
        month: Number(depositForm.base_month || 0),
      };

      await api.post("/Account/AccountDepositHistorySave", payload);
      let refundMessage = "";
      if (isRefundType) {
        const result = await applyRefundAdjustmentToDeadline(parseNumber(depositForm.input_price));
        refundMessage = `\n(${result.targetLabel} ${formatNumber(result.appliedAmount)}원 감액, 총 미수잔액 유지)`;
      }

      Swal.fire("입금 내역이 저장되었습니다.", refundMessage, "success");
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
      const targetAccountId = modifiedRows[0]?.account_id;
      if (targetAccountId) {
        lastSelectedAccountId.current = targetAccountId;
      }
      await fetchDeadlineBalanceList();
      if (targetAccountId) {
        setRefetchTrigger(true);
      }
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
      // ✅ history year-month(0000-00 형식) 표시용 컬럼
      { header: "미수기준일", accessorKey: "base_ym" },
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

  const isInputPriceLocked = isInputPriceLockedInModal(depositForm);

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

                        if (key === "base_ym") {
                          // ✅ 미수기준일은 history(year/month) 기준으로만 표시
                          const y = Number(row?.year || 0);
                          const m = Number(row?.month || 0);
                          return (
                            <td key={key}>
                              {y > 0 && m > 0
                                ? `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`
                                : "0000-00"}
                            </td>
                          );
                        }

                        if (["deposit_amount", "input_price", "difference_price"].includes(key)) {
                          return (
                            <td key={key} align="right">
                              {formatNumber(value)}
                            </td>
                          );
                        }
                        if (key === "note") {
                          const viewNote = String(value || "").replace(/^\[환불\]\s*/u, "");
                          return <td key={key}>{viewNote}</td>;
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
            // ✅ 모달 내 입력/드롭박스 폰트 크기 통일(비고 입력 기준)
            "& .MuiInputBase-input, & .MuiSelect-select, & .MuiNativeSelect-select": {
              fontSize: "0.85rem",
            },
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
              margin="dense"
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
              margin="dense"
              label="입금항목"
              name="type"
              value={depositForm.type}
              SelectProps={{ native: true }}
              onChange={handleDepositChange}
              InputLabelProps={{ shrink: true }}
              disabled={!canEdit}
            >
              <option value="">선택</option>
              <option value="1">생계비</option>
              <option value="2">일반식대</option>
              <option value="3">직원식대</option>
              <option value="5">보전</option>
              <option value="4">미수잔액</option>
              <option value="6">환불</option>
            </TextField>
          </Box>

          {String(depositForm.type || "") === "6" && (
            <Box display="flex" gap={1} mb={2} flexDirection={isMobile ? "column" : "row"}>
              <TextField
                select
                margin="dense"
                label="환불대상"
                name="refund_target"
                value={depositForm.refund_target || "1"}
                onChange={handleDepositChange}
                fullWidth
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                disabled={!canEdit}
              >
                <option value="1">생계비</option>
                <option value="2">일반식대</option>
                <option value="3">직원식대</option>
                <option value="5">보전</option>
              </TextField>
            </Box>
          )}

          <Box display="flex" gap={1} mb={2} flexDirection={isMobile ? "column" : "row"}>
            {/* 입금일자 입력 박스와 동일한 형태/크기로 미수 기준 필드를 표시 */}
            <TextField
              select
              margin="dense"
              label="미수기준연도"
              name="base_year"
              value={depositForm.base_year}
              onChange={handleDepositChange}
              fullWidth
              SelectProps={{ native: true }}
              InputLabelProps={{
                shrink: true,
                sx: {
                  color: "#d32f2f",
                  "&.Mui-focused": { color: "#d32f2f" },
                },
              }}
              disabled={!canEdit}
            >
              {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </TextField>

            <TextField
              select
              margin="dense"
              label="미수기준달"
              name="base_month"
              value={depositForm.base_month}
              onChange={handleDepositChange}
              fullWidth
              SelectProps={{ native: true }}
              InputLabelProps={{
                shrink: true,
                sx: {
                  color: "#d32f2f",
                  "&.Mui-focused": { color: "#d32f2f" },
                },
              }}
              disabled={!canEdit}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </TextField>
          </Box>

          <TextField
            label="입금금액"
            name="deposit_amount"
            value={depositForm.deposit_amount}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            disabled
          />
          <TextField
            label={String(depositForm.type || "") === "6" ? "환불금액" : "실입금액"}
            name="input_price"
            value={depositForm.input_price}
            onChange={handleDepositChange}
            onMouseDown={handleInputPriceMouseDown}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            disabled={!canEdit}
            InputProps={{ readOnly: isInputPriceLocked }}
            sx={
              isInputPriceLocked
                ? {
                  "& .MuiInputBase-input.MuiInputBase-readOnly": {
                    cursor: "not-allowed",
                  },
                }
                : undefined
            }
          />
          <TextField
            label="차액"
            name="difference_price"
            value={depositForm.difference_price}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            disabled
          />
          <TextField
            label="비고"
            name="note"
            value={depositForm.note}
            onChange={handleDepositChange}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            disabled={!canEdit}
          />

          <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
            <Button variant="contained" onClick={handleDepositModalClose} sx={{ color: "#fff" }}>
              취소
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveDeposit}
              disabled={!canEdit}
              sx={{ color: "#fff" }}
            >
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}
