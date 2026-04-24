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
  Typography,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import dayjs from "dayjs";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import api from "api/api";
import { sortAccountRows } from "utils/accountSort";
import ExcelJS from "exceljs";
import DownloadIcon from "@mui/icons-material/Download";

// 🔹 데이터 훅 import
import useDeadlineBalanceData, { parseNumber, formatNumber } from "./deadlineBalanceData";
import LoadingScreen from "layouts/loading/loadingscreen";

export default function DeadlineBalanceTab() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editableRows, setEditableRows] = useState([]);
  // ✅ 거래처 선택 전에도 전체 거래처 색상 계산을 위해 사용하는 입금 이력
  const [allDepositColorRows, setAllDepositColorRows] = useState([]);
  // ✅ 미납 품목 전용 비교 기준으로 사용하는 월별 미수 스냅샷 목록
  const [allUnpaidBaseRows, setAllUnpaidBaseRows] = useState([]);
  // ✅ 초기 진입 시 미납 품목 보조 집계가 끝난 뒤 화면을 표시하기 위한 상태
  const [isUnpaidSummaryInitialized, setIsUnpaidSummaryInitialized] = useState(false);
  // ✅ 거래처 검색 없는 표 화면용 정렬 기준(기본: 거래처명)
  const [accountSortKey, setAccountSortKey] = useState("account_name");

  // ✅ 반응형용 훅
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md")); // md 이하를 모바일로

  // ✅ 마지막 선택 고객 기억용 ref
  const lastSelectedAccountId = useRef(null);
  const [refetchTrigger, setRefetchTrigger] = useState(false);

  // 입금 저장 중 이중 저장 방지 플래그
  const [isSaving, setIsSaving] = useState(false);

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
  // ✅ 장기미수 상세 모달
  const [longTermModalOpen, setLongTermModalOpen] = useState(false);
  const [longTermDetail, setLongTermDetail] = useState(null);
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
  const UNPAID_LOOKBACK_YEARS = 2;
  const REFUND_TARGET_LABEL_BY_CODE = {
    1: "생계비",
    2: "일반식대",
    3: "직원식대",
    5: "보전",
  };
  const DEPOSIT_STATUS_COLORS = {
    complete: "#D2DCB6",
    partial: "#FFF2C6",
    required: "#FFFFFF",
  };
  const DEPOSIT_STATUS_LEGEND = [
    { color: DEPOSIT_STATUS_COLORS.complete, label: "입금완료" },
    { color: DEPOSIT_STATUS_COLORS.partial, label: "부분입금" },
    { color: DEPOSIT_STATUS_COLORS.required, label: "입금필요" },
  ];

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

  // ✅ 미납 품목 전용 집계 범위(조회 연월과 무관하게 최근 기준으로 고정)
  const getUnpaidSummaryYearCandidates = () =>
    Array.from({ length: UNPAID_LOOKBACK_YEARS + 1 }, (_, idx) => today.year() - idx).sort(
      (a, b) => a - b
    );

  // ✅ 올해는 현재 월까지만, 이전 연도는 12월까지 미납 품목 비교 범위로 사용
  const getUnpaidSummaryMonthsByYear = (targetYear) => {
    const maxMonth = Number(targetYear) === Number(today.year()) ? today.month() + 1 : 12;
    return Array.from({ length: maxMonth }, (_, idx) => idx + 1);
  };

  // ✅ 미납 품목 전용 원본 목록을 조회 연월과 분리해서 다시 가져온다
  const fetchAllUnpaidSummarySourceList = async () => {
    const summaryYears = getUnpaidSummaryYearCandidates();

    try {
      const deadlineResponses = await Promise.all(
        summaryYears.flatMap((targetYear) =>
          getUnpaidSummaryMonthsByYear(targetYear).map((targetMonth) =>
            api
              .get("/Account/AccountDeadlineBalanceList", {
                params: { year: targetYear, month: targetMonth },
              })
              .then((res) => ({ year: targetYear, month: targetMonth, rows: res.data || [] }))
              .catch(() => ({ year: targetYear, month: targetMonth, rows: [] }))
          )
        )
      );

      const unpaidBaseRows = deadlineResponses
        .flatMap(({ year: targetYear, month: targetMonth, rows }) =>
          (rows || []).map((item) => ({
            account_id: normalizeAccountId(item.account_id),
            account_name: item.account_name,
            year: Number(item.year || targetYear),
            month: Number(item.month || targetMonth),
            living_cost: parseNumber(item.living_cost),
            basic_cost: parseNumber(item.basic_cost),
            employ_cost: parseNumber(item.employ_cost),
            integrity_cost: parseNumber(item.integrity_cost),
            balance_price: parseNumber(item.balance_price),
            before_price2: parseNumber(item.before_price2),
          }))
        )
        .filter((item) => item.account_id);

      const unpaidBaseMap = new Map();
      unpaidBaseRows.forEach((item) => {
        const ymKey = `${String(item.year).padStart(4, "0")}-${String(item.month).padStart(2, "0")}`;
        unpaidBaseMap.set(`${item.account_id}_${ymKey}`, item);
      });
      const finalizedUnpaidBaseRows = Array.from(unpaidBaseMap.values());

      const accountIds = Array.from(
        new Set(finalizedUnpaidBaseRows.map((item) => normalizeAccountId(item.account_id)).filter(Boolean))
      );

      let finalizedDepositColorRows = [];

      if (accountIds.length > 0) {
        const depositResponses = await Promise.all(
          accountIds.flatMap((accountId) =>
            summaryYears.map((targetYear) =>
              api
                .get("/Account/AccountDepositHistoryList", {
                  params: {
                    account_id: accountId,
                    year: targetYear,
                    month: Number(targetYear) === Number(today.year()) ? today.month() + 1 : 12,
                  },
                })
                .then((res) => res.data || [])
                .catch(() => [])
            )
          )
        );

        const depositMap = new Map();
        depositResponses.flat().forEach((item) => {
          const note = item.note || "";
          const rawType = String(item.type || "").trim();
          const isRefund = rawType === "6" || rawType === "환불" || note.includes("[환불]");
          const row = {
            account_id: normalizeAccountId(item.account_id),
            year: Number(item.year || 0),
            month: Number(item.month || 0),
            type: isRefund ? "환불" : rawType,
            input_dt: item.input_dt,
            deposit_amount: parseNumber(item.deposit_amount),
            input_price: parseNumber(item.input_price),
          };

          const depositKey = [
            row.account_id,
            row.year,
            row.month,
            row.type,
            row.input_dt,
            row.deposit_amount,
            row.input_price,
          ].join("_");
          depositMap.set(depositKey, row);
        });

        finalizedDepositColorRows = Array.from(depositMap.values());
      }

      setAllUnpaidBaseRows(finalizedUnpaidBaseRows);
      setAllDepositColorRows(finalizedDepositColorRows);
    } catch (err) {
      // ✅ 미납 품목 보조 조회 실패 시 기본 표시로 되돌린다
      console.error("미납 품목 전용 원본 목록 조회 실패:", err);
      setAllUnpaidBaseRows([]);
      setAllDepositColorRows([]);
    } finally {
      setIsUnpaidSummaryInitialized(true);
    }
  };

  useEffect(() => {
    fetchAllUnpaidSummarySourceList();
  }, []);

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

  // ✅ 화면 표시 순서만 정렬(조회/저장 로직은 기존 유지)
  const sortedEditableRows = useMemo(
    () => sortAccountRows(editableRows, { sortKey: accountSortKey, keepAllOnTop: true }),
    [editableRows, accountSortKey]
  );

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

  const normalizeAccountId = (rawAccountId) => String(rawAccountId || "").trim();

  const TYPE_CODE_BY_ACCESSOR = {
    living_cost: "1",
    basic_cost: "2",
    employ_cost: "3",
    integrity_cost: "5",
    balance_price: "4",
  };
  const TRACKED_UNPAID_TYPE_CODES = ["1", "2", "3", "5"];
  const TYPE_LABEL_BY_CODE = {
    1: "생계비",
    2: "일반식대",
    3: "직원식대",
    5: "보전",
  };
  const TYPE_ACCESSOR_BY_CODE = {
    1: "living_cost",
    2: "basic_cost",
    3: "employ_cost",
    5: "integrity_cost",
  };
  const BALANCE_TYPE_CODE = "4";

  // ✅ 최신 총 미수잔액보다 월별 누계 합이 작을 때 오래된 대상월에 차액을 보정한다
  const applyOutstandingGapToTypeRows = (typeRows, gapAmount) => {
    const normalizedGap = Math.max(0, parseNumber(gapAmount));
    const nextTypeRows = (typeRows || []).map((item) => ({ ...item }));
    if (normalizedGap === 0 || nextTypeRows.length === 0) return nextTypeRows;

    const targetIndexes = nextTypeRows.reduce((acc, item, index) => {
      if (Math.max(0, parseNumber(item.expected)) > 0) {
        acc.push(index);
      }
      return acc;
    }, []);
    const distributedIndexes = targetIndexes.length > 0 ? targetIndexes : [0];
    const expectedTotal = distributedIndexes.reduce(
      (acc, index) => acc + Math.max(0, parseNumber(nextTypeRows[index]?.expected)),
      0
    );

    let remainGap = normalizedGap;
    distributedIndexes.forEach((targetIndex, index) => {
      const isLast = index === distributedIndexes.length - 1;
      const baseExpected = Math.max(0, parseNumber(nextTypeRows[targetIndex]?.expected));
      const appliedGap = isLast
        ? remainGap
        : expectedTotal > 0
          ? Math.floor((normalizedGap * baseExpected) / expectedTotal)
          : 0;

      nextTypeRows[targetIndex].expected = baseExpected + appliedGap;
      nextTypeRows[targetIndex].outstanding =
        Math.max(0, parseNumber(nextTypeRows[targetIndex]?.outstanding)) + appliedGap;
      remainGap -= appliedGap;
    });

    if (remainGap > 0) {
      const fallbackIndex = distributedIndexes[distributedIndexes.length - 1] ?? 0;
      nextTypeRows[fallbackIndex].expected =
        Math.max(0, parseNumber(nextTypeRows[fallbackIndex]?.expected)) + remainGap;
      nextTypeRows[fallbackIndex].outstanding =
        Math.max(0, parseNumber(nextTypeRows[fallbackIndex]?.outstanding)) + remainGap;
    }

    return nextTypeRows;
  };

  // ✅ 장기미수 상세 모달에서 항목별 금액 설명을 괄호 형태로 만든다
  const buildTypeBreakdownText = (items) => {
    const breakdownText = (items || [])
      .map((item) => {
        const amount = parseNumber(item?.amount);
        if (!item?.label || amount === 0) return "";
        return `${item.label}: ${formatNumber(amount)}`;
      })
      .filter(Boolean)
      .join(", ");

    return breakdownText ? `(${breakdownText})` : "";
  };

  // ✅ 월별 입금액/누계액에 표시할 두 줄 데이터를 만든다
  const getLongTermMonthDisplayAmounts = (monthInfo) => {
    const totalPaid = Math.max(0, parseNumber(monthInfo?.totalPaid));
    const totalOutstanding = Math.max(0, parseNumber(monthInfo?.totalOutstanding));
    const appliedBalancePaid = Math.max(0, parseNumber(monthInfo?.appliedBalancePaid));

    const paidBreakdownText = buildTypeBreakdownText([
      ...(monthInfo?.typeRows || []).map((item) => ({
        label: item.typeLabel,
        amount: item.paid,
      })),
      ...(appliedBalancePaid > 0 ? [{ label: "미수잔액", amount: appliedBalancePaid }] : []),
    ]);
    const outstandingBreakdownText = buildTypeBreakdownText(
      [
        ...((monthInfo?.typeRows || []).map((item) => ({
          label: item.typeLabel,
          amount: item.outstanding,
        })) || []),
        ...(appliedBalancePaid > 0 ? [{ label: "미수잔액차감", amount: -appliedBalancePaid }] : []),
      ]
    );

    return {
      paidBreakdownText,
      paidAmountText: totalPaid > 0 ? formatNumber(totalPaid) : "-",
      outstandingBreakdownText,
      outstandingAmountText: totalOutstanding > 0 ? formatNumber(totalOutstanding) : "-",
    };
  };

  // ✅ 미납 월을 연도 기준으로 묶어서 표시
  const formatGroupedMonthText = (monthInfos) => {
    const groupedMonthMap = new Map();

    (monthInfos || []).forEach((item) => {
      const targetYear = Number(item?.year || 0);
      const targetMonth = Number(item?.month || 0);
      if (targetYear <= 0 || targetMonth <= 0) return;

      const yearLabel = `${String(targetYear).slice(2)}년`;
      const prevMonths = groupedMonthMap.get(yearLabel) || [];
      const monthLabel = `${targetMonth}월`;
      if (!prevMonths.includes(monthLabel)) {
        prevMonths.push(monthLabel);
      }
      groupedMonthMap.set(yearLabel, prevMonths);
    });

    return Array.from(groupedMonthMap.entries())
      .map(([yearLabel, monthLabels]) => `${yearLabel}(${monthLabels.join(", ")})`)
      .join(", ");
  };

  // ✅ 기대금액/실입금 합계 기준 상태색 계산
  const getStatusColorByExpectedAndPaid = (expectedAmount, paidAmount) => {
    const expected = Math.max(0, parseNumber(expectedAmount));
    const paid = Math.max(0, parseNumber(paidAmount));

    // ✅ 미수잔액 0원 + 실입금 0원도 입금완료(초록) 처리
    if (expected === 0 && paid === 0) return DEPOSIT_STATUS_COLORS.complete;
    if (expected > 0 && paid >= expected) return DEPOSIT_STATUS_COLORS.complete;
    if (expected > 0 && paid > 0 && paid < expected) return DEPOSIT_STATUS_COLORS.partial;
    return DEPOSIT_STATUS_COLORS.required;
  };

  // ✅ 연도 선택 왼쪽에 표시할 입금상태 범례
  const DepositStatusLegend = () => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        flexWrap: "wrap",
        mr: 1,
        userSelect: "none",
      }}
    >
      {DEPOSIT_STATUS_LEGEND.map((item) => (
        (() => {
          const normalizedColor = String(item.color || "").toLowerCase();
          const markerBorderColor =
            normalizedColor === "#ffffff" || normalizedColor === "#fff"
              ? "rgba(0,0,0,0.25)"
              : item.color;

          return (
            <Box
              key={item.label}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.6,
                px: 0.8,
                py: 0.3,
                borderRadius: 999,
                bgcolor: "rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: item.color,
                  border: `1px solid ${markerBorderColor}`,
                  boxShadow: "0 0 0 2px rgba(255,255,255,0.9) inset",
                }}
              />
              <Typography
                sx={{ fontSize: 12, fontWeight: 700, color: "#333", position: "relative", top: "1px" }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })()
      ))}
    </Box>
  );

  // ✅ 우측 표 계산용: 미수기준 연월+항목별로 기대금액/실입금 합계 집계
  const rightStatusMapByBaseYmType = useMemo(() => {
    const sumMap = new Map();
    const sourceRows = allDepositColorRows || [];

    (sourceRows || []).forEach((row) => {
      const typeCode = normalizeDepositTypeCode(row?.type);
      if (!typeCode || typeCode === "6") return;

      const y = Number(row?.year || 0);
      const m = Number(row?.month || 0);
      if (y <= 0 || m <= 0) return;

      const accountId = normalizeAccountId(row?.account_id);
      if (!accountId) return;
      const ymKey = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
      const key = `${accountId}_${ymKey}_${typeCode}`;
      const prev = sumMap.get(key) || { expected: 0, actual: 0 };
      // ✅ 분할 입금 대응: 실입금은 합산, 기대금액은 최대값으로 기준 유지
      prev.expected = Math.max(prev.expected, parseNumber(row?.deposit_amount));
      prev.actual += parseNumber(row?.input_price);
      sumMap.set(key, prev);
    });

    return sumMap;
  }, [allDepositColorRows]);

  // ✅ 좌측 표 항목 셀 색상
  const getLeftAmountCellColor = (row, accessorKey) => {
    const isSelectedRow =
      selectedCustomer
      && normalizeAccountId(row?.account_id) === normalizeAccountId(selectedCustomer?.account_id);

    // ✅ 총 미수잔액은 선택 거래처일 때만 분홍색 강조
    if (accessorKey === "balance_price") {
      return isSelectedRow ? "#FFE4E1" : "transparent";
    }

    const typeCode = TYPE_CODE_BY_ACCESSOR[accessorKey];
    if (!typeCode) return "transparent";

    // ✅ 좌측도 우측과 동일하게 "미수기준일(year/month)+항목" 기준 합산값으로 비교
    const y = Number(year);
    const m = Number(month);
    const accountId = normalizeAccountId(row?.account_id);
    if (!accountId) return "#FFFFFF";
    const ymKey = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
    const key = `${accountId}_${ymKey}_${typeCode}`;
    const sum = rightStatusMapByBaseYmType.get(key) || { expected: 0, actual: 0 };

    const expectedAmount = parseNumber(row?.[accessorKey]);
    const paidAmount = sum.actual;
    return getStatusColorByExpectedAndPaid(expectedAmount, paidAmount);
  };

  // ✅ 우측 표 입금항목 셀 색상(입금내역의 미수기준일 기준)
  const getRightTypeCellColor = (depositRow) => {
    const typeCode = normalizeDepositTypeCode(depositRow?.type);
    if (!typeCode || typeCode === "6") return "#FFFFFF";

    const accountId = normalizeAccountId(depositRow?.account_id);
    if (!accountId) return "#FFFFFF";
    const y = Number(depositRow?.year || 0);
    const m = Number(depositRow?.month || 0);
    if (y <= 0 || m <= 0) return "#FFFFFF";

    const ymKey = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
    const key = `${accountId}_${ymKey}_${typeCode}`;
    const sum = rightStatusMapByBaseYmType.get(key) || { expected: 0, actual: 0 };
    return getStatusColorByExpectedAndPaid(sum.expected, sum.actual);
  };

  // ✅ 거래처별 미납월/장기미수 요약 계산
  const accountUnpaidSummaryMap = useMemo(() => {
    const accountMonthMap = new Map();
    const thresholdMonth = dayjs().startOf("month").subtract(3, "month");
    const finalized = new Map();

    (allUnpaidBaseRows || []).forEach((row) => {
      const accountId = normalizeAccountId(row?.account_id);
      const targetYear = Number(row?.year || 0);
      const targetMonth = Number(row?.month || 0);
      if (!accountId || targetYear <= 0 || targetMonth <= 0) return;

      const ymKey = `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}`;

      let monthMap = accountMonthMap.get(accountId);
      if (!monthMap) {
        monthMap = new Map();
        accountMonthMap.set(accountId, monthMap);
      }

      let monthInfo = monthMap.get(ymKey);
      if (!monthInfo) {
        monthInfo = {
          year: targetYear,
          month: targetMonth,
          ymKey,
          typeMap: new Map(),
          balancePaid: 0,
          balancePrice: 0,
        };
        monthMap.set(ymKey, monthInfo);
      }

      monthInfo.balancePrice = Math.max(0, parseNumber(row?.balance_price));

      TRACKED_UNPAID_TYPE_CODES.forEach((typeCode) => {
        const accessorKey = TYPE_ACCESSOR_BY_CODE[typeCode];
        const expected = Math.max(0, parseNumber(row?.[accessorKey]));
        monthInfo.typeMap.set(typeCode, {
          expected,
          paid: 0,
          outstanding: expected,
        });
      });
    });

    rightStatusMapByBaseYmType.forEach((sum, rawKey) => {
      const keyParts = String(rawKey || "").split("_");
      if (keyParts.length < 3) return;

      const typeCode = String(keyParts.pop() || "");
      const ymKey = String(keyParts.pop() || "");
      const accountId = normalizeAccountId(keyParts.join("_"));
      if (!accountId || (!TRACKED_UNPAID_TYPE_CODES.includes(typeCode) && typeCode !== BALANCE_TYPE_CODE)) {
        return;
      }

      const [yStr, mStr] = ymKey.split("-");
      const y = Number(yStr || 0);
      const m = Number(mStr || 0);
      if (y <= 0 || m <= 0) return;

      let monthMap = accountMonthMap.get(accountId);
      if (!monthMap) {
        monthMap = new Map();
        accountMonthMap.set(accountId, monthMap);
      }

      let monthInfo = monthMap.get(ymKey);
      if (!monthInfo) {
        monthInfo = {
          year: y,
          month: m,
          ymKey,
          typeMap: new Map(),
          balancePaid: 0,
          balancePrice: 0,
        };
        monthMap.set(ymKey, monthInfo);
      }

      if (typeCode === BALANCE_TYPE_CODE) {
        monthInfo.balancePaid = Math.max(0, parseNumber(sum?.actual));
        return;
      }

      const base = monthInfo.typeMap.get(typeCode) || { expected: 0, paid: 0, outstanding: 0 };
      const expected = Math.max(base.expected, parseNumber(sum?.expected));
      const paid = Math.max(0, parseNumber(sum?.actual));
      const outstanding = Math.max(0, expected - paid);
      monthInfo.typeMap.set(typeCode, { expected, paid, outstanding });
    });

    Array.from(accountMonthMap.entries()).forEach(([accountId, monthMap]) => {
      const monthDetails = Array.from(monthMap.values())
        .map((monthInfo) => {
          const typeRows = TRACKED_UNPAID_TYPE_CODES.map((typeCode) => {
            const base = monthInfo.typeMap.get(typeCode) || { expected: 0, paid: 0, outstanding: 0 };
            return {
              typeCode,
              typeLabel: TYPE_LABEL_BY_CODE[typeCode] || typeCode,
              expected: base.expected,
              paid: base.paid,
              outstanding: base.outstanding,
            };
          });

          const totalExpected = typeRows.reduce((acc, item) => acc + item.expected, 0);
          const typeOnlyPaid = typeRows.reduce((acc, item) => acc + item.paid, 0);
          const totalOutstandingBeforeBalance = Math.max(0, totalExpected - typeOnlyPaid);
          const monthDate = dayjs(`${monthInfo.ymKey}-01`);

          return {
            ...monthInfo,
            typeRows,
            totalExpected,
            typeOnlyPaid,
            totalOutstandingBeforeBalance,
            balancePaid: Math.max(0, parseNumber(monthInfo.balancePaid)),
            balancePrice: Math.max(0, parseNumber(monthInfo.balancePrice)),
          };
        })
        .filter((item) => item.totalExpected > 0 || item.typeOnlyPaid > 0 || item.totalOutstandingBeforeBalance > 0);

      monthDetails.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

      // 미수잔액(type=4) 입금 총합을 오래된 월부터 FIFO로 차감
      const totalBalancePaid = monthDetails.reduce((acc, item) => acc + item.balancePaid, 0);
      let remainingBalance = totalBalancePaid;
      monthDetails.forEach((item) => {
        const deducted = Math.min(remainingBalance, item.totalOutstandingBeforeBalance);
        item.appliedBalancePaid = deducted;
        remainingBalance -= deducted;
        const totalPaid = item.typeOnlyPaid + deducted;
        const totalOutstanding = Math.max(0, item.totalExpected - totalPaid);
        const isLongTerm =
          totalOutstanding > 0
          && (dayjs(`${item.ymKey}-01`).isBefore(thresholdMonth, "month")
            || dayjs(`${item.ymKey}-01`).isSame(thresholdMonth, "month"));
        item.totalPaid = totalPaid;
        item.totalOutstanding = totalOutstanding;
        item.isLongTerm = isLongTerm;
      });

      // ✅ 조회 연월과 무관하게 실제 미수기준일에 미납이 남아 있는 월만 표시
      const unpaidMonthsAll = monthDetails.filter((item) => item.totalOutstanding > 0);
      const currentSummaryYmKey = `${String(dayjs().year()).padStart(4, "0")}-${String(
        dayjs().month() + 1
      ).padStart(2, "0")}`;
      const currentMonthDetail = monthDetails.find((item) => item.ymKey === currentSummaryYmKey);
      const hasUnpaidBalance = unpaidMonthsAll.length > 0;
      const longTermMonths = hasUnpaidBalance
        ? unpaidMonthsAll.filter((item) => item.isLongTerm)
        : [];
      let detailMonths = hasUnpaidBalance && longTermMonths.length > 0
        ? [...unpaidMonthsAll]
        : [];
      if (
        detailMonths.length > 0
        && currentMonthDetail
        && !detailMonths.some((item) => item.ymKey === currentSummaryYmKey)
      ) {
        detailMonths.push(currentMonthDetail);
        detailMonths.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
      }
      const unpaidMonthText = hasUnpaidBalance ? formatGroupedMonthText(unpaidMonthsAll) : "-";
      const unpaidDetailMonths = unpaidMonthsAll.map((item) => ({
        ...item,
        typeRows: (item.typeRows || []).map((typeRow) => ({ ...typeRow })),
      }));

      const longTermSummaryMonths = (detailMonths.length > 0 ? detailMonths : longTermMonths).map(
        (item) => ({
          ...item,
          typeRows: (item.typeRows || []).map((typeRow) => ({ ...typeRow })),
        })
      );
      const latestBalancePrice = monthDetails.length > 0
        ? Math.max(
          0,
          parseNumber(
            monthDetails[monthDetails.length - 1]?.balancePrice
            || monthDetails[monthDetails.length - 1]?.totalOutstanding
          )
        )
        : 0;
      const calculatedLongTermTotal = longTermSummaryMonths.reduce(
        (acc, item) => acc + Math.max(0, parseNumber(item.totalOutstanding)),
        0
      );
      const outstandingGap = Math.max(0, latestBalancePrice - calculatedLongTermTotal);

      if (outstandingGap > 0 && longTermSummaryMonths.length > 0) {
        const oldestMonthInfo = longTermSummaryMonths[0];
        oldestMonthInfo.typeRows = applyOutstandingGapToTypeRows(
          oldestMonthInfo.typeRows,
          outstandingGap
        );
        oldestMonthInfo.totalExpected =
          Math.max(0, parseNumber(oldestMonthInfo.totalExpected)) + outstandingGap;
        oldestMonthInfo.totalOutstanding =
          Math.max(0, parseNumber(oldestMonthInfo.totalOutstanding)) + outstandingGap;
      }

      const longTermExpectedTotal = longTermSummaryMonths.reduce(
        (acc, item) => acc + Math.max(0, parseNumber(item.totalExpected)),
        0
      );
      const longTermTypeTotals = TRACKED_UNPAID_TYPE_CODES.reduce((acc, typeCode) => {
        acc[typeCode] = longTermSummaryMonths.reduce((sumAcc, monthInfo) => {
          const found = monthInfo.typeRows.find((item) => item.typeCode === typeCode);
          return sumAcc + Math.max(0, parseNumber(found?.outstanding));
        }, 0);
        return acc;
      }, {});
      const longTermTotal = longTermSummaryMonths.reduce(
        (acc, item) => acc + Math.max(0, parseNumber(item.totalOutstanding)),
        0
      );
      const longTermPaidTotal = longTermSummaryMonths.reduce(
        (acc, item) => acc + Math.max(0, parseNumber(item.totalPaid)),
        0
      );
      const longTermMonthText = longTermMonths.length > 0
        ? formatGroupedMonthText(longTermMonths)
        : "-";
      const noteHasPartialPayment = hasUnpaidBalance && longTermSummaryMonths.some(
        (item) => item.totalPaid > 0 && item.totalOutstanding > 0
      );

      finalized.set(accountId, {
        unpaidMonthText,
        hasUnpaidBalance,
        hasLongTerm: longTermMonths.length > 0,
        longTermMonths,
        unpaidDetailMonths,
        detailMonths: longTermSummaryMonths,
        longTermTypeTotals,
        longTermExpectedTotal: hasUnpaidBalance ? longTermExpectedTotal : 0,
        longTermPaidTotal: hasUnpaidBalance ? longTermPaidTotal : 0,
        longTermTotal: hasUnpaidBalance ? Math.max(longTermTotal, latestBalancePrice) : 0,
        totalUnpaidAmount: hasUnpaidBalance ? Math.max(longTermTotal, latestBalancePrice) : 0,
        longTermMonthText,
        noteHasPartialPayment,
      });
    });

    return finalized;
  }, [allUnpaidBaseRows, rightStatusMapByBaseYmType]);

  const getAccountUnpaidSummary = (row) => {
    const accountId = normalizeAccountId(row?.account_id);
    return accountUnpaidSummaryMap.get(accountId) || null;
  };

  const handleOpenLongTermDetail = (row) => {
    const summary = getAccountUnpaidSummary(row);
    const targetDetailMonths = summary?.hasLongTerm
      ? summary?.detailMonths || []
      : summary?.unpaidDetailMonths || [];
    if (targetDetailMonths.length === 0) return;
    setLongTermDetail({
      account_id: row?.account_id,
      account_name: row?.account_name,
      ...summary,
      detailMonths: targetDetailMonths,
      detailTitle: summary?.hasLongTerm ? "장기미수 세부내역" : "미납 품목 세부내역",
    });
    setLongTermModalOpen(true);
  };

  const handleCloseLongTermDetail = () => {
    setLongTermModalOpen(false);
    setLongTermDetail(null);
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

    // 이중 저장 방지
    if (isSaving) return;

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
      setIsSaving(true);
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

      await Swal.fire("입금 내역이 저장되었습니다.", refundMessage, "success");

      // OK 클릭 직후: 조회 중 swal을 먼저 띄워 화면 전체를 덮음 (MUI Modal z-index 1300보다 높게)
      const accountId = selectedCustomer.account_id;
      Swal.fire({
        title: "조회 중...",
        text: "잠시만 기다려 주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
          // MUI Modal 백드롭(z-index 1300)보다 높은 값으로 덮어 모달이 닫히는 동안 가려줌
          const container = Swal.getContainer();
          if (container) container.style.zIndex = "9999";
        },
      });

      // 모달 닫기 (조회 중 swal이 화면을 덮고 있으므로 애니메이션과 무관하게 진행)
      handleDepositModalClose();

      // 재조회
      await fetchDeadlineBalanceList();
      if (accountId) await fetchDepositHistoryList(accountId, year);
      setRefetchTrigger(true);
      Swal.close();
      fetchAllUnpaidSummarySourceList();

    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    } finally {
      setIsSaving(false);
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
      await fetchAllUnpaidSummarySourceList();
      if (targetAccountId) {
        setRefetchTrigger(true);
      }
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // ✅ 조회 연월 기준으로 전체 거래처 미수잔액 목록을 엑셀로 다운로드
  const handleExcelDownload = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("전체 미수잔액");

      const reportYm = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
      const borderThin = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      // ✅ A1 제목 행: 조회 연월 기준 문구
      ws.mergeCells("A1:F1");
      ws.getCell("A1").value = `■ 전체 거래처별 미수잔액 / ${reportYm}`;
      ws.getCell("A1").font = { bold: true, size: 12 };
      ws.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(1).height = 24;

      // ✅ A2부터 헤더 구성
      const excelHeaders = ["거래처", "생계비", "일반식대", "직원식대", "보전", "총 미수잔액"];
      excelHeaders.forEach((header, idx) => {
        const cell = ws.getCell(2, idx + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.border = borderThin;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      // ✅ 거래처명 기준 조회 순서와 동일하게 정렬해서 데이터 작성
      const excelRows = sortAccountRows(editableRows, {
        sortKey: "account_name",
        keepAllOnTop: true,
      });
      excelRows.forEach((row, rowIdx) => {
        const excelRowNo = rowIdx + 3;
        const rowValues = [
          row?.account_name || "",
          parseNumber(row?.living_cost),
          parseNumber(row?.basic_cost),
          parseNumber(row?.employ_cost),
          parseNumber(row?.integrity_cost),
          parseNumber(row?.balance_price),
        ];

        rowValues.forEach((value, colIdx) => {
          const cell = ws.getCell(excelRowNo, colIdx + 1);
          cell.value = value;
          cell.border = borderThin;
          cell.alignment = {
            vertical: "middle",
            horizontal: colIdx === 0 ? "left" : "right",
          };

          if (colIdx > 0) {
            cell.numFmt = "#,##0";
          }
        });
      });

      ws.getColumn(1).width = 30;
      ws.getColumn(2).width = 14;
      ws.getColumn(3).width = 14;
      ws.getColumn(4).width = 14;
      ws.getColumn(5).width = 14;
      ws.getColumn(6).width = 18;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `전체_거래처별_미수잔액_${reportYm}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      Swal.fire("엑셀 다운로드 실패", err?.message || "오류가 발생했습니다.", "error");
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
      { header: "총 미수잔액", accessorKey: "balance_price" },
      { header: "미납 품목", accessorKey: "unpaid_items" },
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
  const actionButtonSx = useMemo(
    () => ({
      fontSize: isMobile ? "11px" : "13px",
      minWidth: isMobile ? 82 : 100,
      px: isMobile ? 1 : 2,
    }),
    [isMobile]
  );
  const compactActionButtonSx = useMemo(
    () => ({
      fontSize: isMobile ? "11px" : "13px",
      minWidth: isMobile ? 64 : 74,
      px: isMobile ? 1 : 1.5,
    }),
    [isMobile]
  );
  const detailTableCellStyle = useMemo(
    () => ({
      border: "1px solid #686D76",
      padding: isMobile ? "3px" : "4px",
      fontSize: "12px",
      color: "#344767",
    }),
    []
  );
  const detailTableHeaderStyle = useMemo(
    () => ({
      ...detailTableCellStyle,
      backgroundColor: "#f0f0f0",
      fontWeight: "bold",
      textAlign: "center",
    }),
    [detailTableCellStyle]
  );

  const isInputPriceLocked = isInputPriceLockedInModal(depositForm);

  // ✅ 초기 로딩만 전체 로딩 화면 표시 (행 클릭 시 스크롤 튐 방지)
  const isInitialLoading = (loading && balanceRows.length === 0) || !isUnpaidSummaryInitialized;
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

          <DepositStatusLegend />

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

          <TextField
            select
            size="small"
            value={accountSortKey}
            onChange={(e) => setAccountSortKey(String(e.target.value))}
            sx={{ minWidth: isMobile ? 140 : 150 }}
            SelectProps={{ native: true }}
          >
            <option value="account_name">거래처명 정렬</option>
            <option value="account_id">거래처ID 정렬</option>
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
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            onClick={handleExcelDownload}
            sx={actionButtonSx}
          >
            엑셀다운로드
          </MDButton>
          <MDButton
            variant="gradient"
            color="warning"
            onClick={handleDepositModalOpen}
            disabled={!canEdit}
            sx={compactActionButtonSx}
          >
            입금
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSaveChanges}
            disabled={!canEdit}
            sx={compactActionButtonSx}
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
                {sortedEditableRows.map((row, i) => {
                  const isSelected = selectedCustomer?.account_id === row.account_id;

                  return (
                    <tr key={row.account_id || i}>
                      {columns.map((col) => {
                        const key = col.accessorKey;
                        const value = row[key];

                        const baseTdStyle = {
                          cursor: key === "account_name" ? "pointer" : "default",
                          fontWeight: isSelected ? "bold" : "normal",
                        };

                        if (key === "account_name") {
                          return (
                            <td
                              key={key}
                              style={{
                                ...baseTdStyle,
                                backgroundColor: isSelected ? "#FFE4E1" : "transparent",
                              }}
                              onClick={() => handleSelectCustomer(row)}
                            >
                              {value}
                            </td>
                          );
                        }

                        if (key === "unpaid_items") {
                          const unpaidSummary = getAccountUnpaidSummary(row);
                          const unpaidText = unpaidSummary?.unpaidMonthText || "-";
                          const hasLongTerm = Boolean(unpaidSummary?.hasLongTerm);
                          const hasUnpaidDetail = Boolean(
                            unpaidSummary?.hasLongTerm || (unpaidSummary?.unpaidDetailMonths || []).length > 0
                          );

                          return (
                            <td
                              key={key}
                              style={{
                                ...baseTdStyle,
                                // ✅ 행 선택 시 미납 품목 셀도 분홍색으로 함께 강조
                                backgroundColor: isSelected ? "#FFE4E1" : "transparent",
                                minWidth: isMobile ? "130px" : "180px",
                                textAlign: hasLongTerm ? "center" : "left",
                                padding: isMobile ? "3px" : "4px",
                              }}
                            >
                              {!hasLongTerm && (
                                <MDTypography
                                  component={hasUnpaidDetail ? "span" : "p"}
                                  onClick={hasUnpaidDetail ? () => handleOpenLongTermDetail(row) : undefined}
                                  sx={{
                                    fontSize: isMobile ? "11px" : "12px",
                                    lineHeight: 1.2,
                                    cursor: hasUnpaidDetail ? "pointer" : "default",
                                    "&:hover": hasUnpaidDetail
                                      ? {
                                        fontWeight: "bold",
                                        textDecoration: "underline",
                                      }
                                      : undefined,
                                  }}
                                >
                                  {unpaidText}
                                </MDTypography>
                              )}
                              {hasLongTerm && (
                                <MDTypography
                                  component="span"
                                  onClick={() => handleOpenLongTermDetail(row)}
                                  sx={{
                                    cursor: "pointer",
                                    color: "#d32f2f",
                                    fontSize: isMobile ? "11px" : "12px",
                                    lineHeight: 1.2,
                                    textDecoration: "underline",
                                  }}
                                >
                                  장기미수 세부내역
                                </MDTypography>
                              )}
                            </td>
                          );
                        }

                        if (
                          [
                            "living_cost",
                            "basic_cost",
                            "employ_cost",
                            "integrity_cost",
                            "balance_price",
                          ].includes(key)
                        ) {
                          return (
                            <td
                              key={key}
                              align="right"
                              style={{
                                ...baseTdStyle,
                                backgroundColor: getLeftAmountCellColor(row, key),
                              }}
                            >
                              <input
                                type="text"
                                disabled={!canEdit} // ✅ 입력 막기
                                value={formatNumber(value ?? "")}
                                onChange={(e) =>
                                  handleChange(row.account_name, key, e.target.value)
                                }
                                onBlur={(e) => {
                                  if (!canEdit) return;
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
                                  width: "80px",
                                  border: "none",
                                  textAlign: "right",
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

                        // 일반 표시 셀
                        return (
                          <td
                            key={key}
                            align="right"
                            style={{
                              ...baseTdStyle,
                              backgroundColor: "transparent",
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

                        if (key === "type") {
                          return (
                            <td
                              key={key}
                              style={{
                                backgroundColor: getRightTypeCellColor(row),
                              }}
                            >
                              {value}
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

      {/* 장기미수 상세 모달 */}
      <Modal open={longTermModalOpen} onClose={handleCloseLongTermDetail}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile
              ? (longTermDetail?.hasLongTerm ? "94vw" : "90vw")
              : (longTermDetail?.hasLongTerm ? "88vw" : "64vw"),
            maxWidth: longTermDetail?.hasLongTerm ? 1220 : 700,
            maxHeight: "92vh",
            overflowY: "auto",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            pt: isMobile ? 1.5 : 2,
            px: isMobile ? 1.5 : 2,
            pb: isMobile ? 0.5 : 0.5,
          }}
        >
          <MDBox display="flex" alignItems="center" gap={1} mb={1.25}>
            <MDTypography variant="h6" sx={{ fontSize: isMobile ? "14px" : "16px" }}>
              {longTermDetail?.detailTitle || "장기미수 세부내역"}
            </MDTypography>
            <MDTypography
              variant="button"
              color="dark"
              sx={{ fontSize: isMobile ? "11px" : "12px" }}
            >
              {longTermDetail?.account_name || "-"}
            </MDTypography>
          </MDBox>

          <Grid container spacing={isMobile ? 1 : 1.5}>
            <Grid item xs={12} md={longTermDetail?.hasLongTerm ? 8 : 12}>
              <Box
                sx={{
                  maxHeight: isMobile ? "none" : "70vh",
                  overflowY: isMobile ? "visible" : "auto",
                  pr: isMobile ? 0 : 1,
                }}
              >
                {(longTermDetail?.detailMonths || []).length > 0 ? (() => {
                  let cumulativeAmount = 0;
                  return longTermDetail.detailMonths.map((monthInfo, monthIndex, detailMonths) => {
                    const monthDisplayAmounts = getLongTermMonthDisplayAmounts(monthInfo);
                    const isLastMonth = monthIndex === detailMonths.length - 1;

                    // 차액 = 해당월 합계(생계비+일반식대+직원식대+보전) - 입금액
                    const totalExpected = Math.max(0, parseNumber(monthInfo.totalExpected));
                    const totalPaid = Math.max(0, parseNumber(monthInfo.totalPaid));
                    const diffAmount = totalExpected - totalPaid;
                    // 누계액 = 이전 누계 + 이번 차액
                    cumulativeAmount += diffAmount;

                    return (
                      <Box key={monthInfo.ymKey} sx={{ border: "1px solid #cfcfcf", mb: isLastMonth ? 0 : 1 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                          <thead>
                            <tr>
                              <th
                                colSpan={TRACKED_UNPAID_TYPE_CODES.length + 1}
                                style={detailTableHeaderStyle}
                              >
                                {`${monthInfo.year}년 ${monthInfo.month}월`}
                              </th>
                            </tr>
                            <tr>
                              <th
                                style={{ ...detailTableHeaderStyle, width: isMobile ? "72px" : "90px" }}
                              >
                                내역
                              </th>
                              {TRACKED_UNPAID_TYPE_CODES.map((typeCode) => (
                                <th
                                  key={`${monthInfo.ymKey}_${typeCode}_header`}
                                  style={{ ...detailTableHeaderStyle, width: isMobile ? "72px" : "96px" }}
                                >
                                  {TYPE_LABEL_BY_CODE[typeCode]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  ...detailTableCellStyle,
                                  textAlign: "center",
                                  width: isMobile ? "72px" : "90px",
                                }}
                              >
                                금액
                              </td>
                              {TRACKED_UNPAID_TYPE_CODES.map((typeCode) => {
                                const rawValue = Math.max(
                                  0,
                                  parseNumber(
                                    monthInfo.typeRows.find((item) => item.typeCode === typeCode)?.expected
                                  )
                                );
                                return (
                                  <td
                                    key={`${monthInfo.ymKey}_expected_${typeCode}`}
                                    style={{
                                      ...detailTableCellStyle,
                                      textAlign: "right",
                                      width: isMobile ? "72px" : "96px",
                                    }}
                                  >
                                    {rawValue > 0 ? formatNumber(rawValue) : "-"}
                                  </td>
                                );
                              })}
                            </tr>
                            {[
                              {
                                label: "입금액",
                                value: Math.max(0, parseNumber(monthInfo.totalPaid)),
                                displayBreakdownText: monthDisplayAmounts.paidBreakdownText,
                                displayAmountText: monthDisplayAmounts.paidAmountText,
                              },
                              { label: "차액", value: diffAmount },
                              {
                                label: "누계액",
                                value: cumulativeAmount,
                                highlight: true,
                              },
                            ].map((rowInfo) => (
                              <tr key={`${monthInfo.ymKey}_${rowInfo.label}`}>
                                <td
                                  style={{
                                    ...detailTableCellStyle,
                                    textAlign: "center",
                                    fontWeight: rowInfo.highlight ? "bold" : "normal",
                                    background: rowInfo.highlight ? "#e7e4e4" : "transparent",
                                    width: isMobile ? "72px" : "90px",
                                  }}
                                >
                                  {rowInfo.label}
                                </td>
                                <td
                                  colSpan={TRACKED_UNPAID_TYPE_CODES.length}
                                  style={{
                                    ...detailTableCellStyle,
                                    textAlign: "right",
                                    fontWeight: rowInfo.highlight ? "bold" : "normal",
                                    background: rowInfo.highlight ? "#e7e4e4" : "transparent",
                                  }}
                                >
                                  {rowInfo.displayBreakdownText ? (
                                    <Box
                                      sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-end",
                                        gap: 0,
                                        py: 0,
                                      }}
                                    >
                                      <Typography
                                        component="div"
                                        sx={{
                                          fontSize: "12px",
                                          lineHeight: 1.35,
                                          wordBreak: "keep-all",
                                          textAlign: "right",
                                          color: "#344767",
                                        }}
                                      >
                                        {rowInfo.displayBreakdownText}
                                      </Typography>
                                      <Typography
                                        component="div"
                                        sx={{
                                          fontSize: "12px",
                                          lineHeight: 1.35,
                                          fontWeight: rowInfo.highlight ? "bold" : "normal",
                                          textAlign: "right",
                                          color: "#344767",
                                        }}
                                      >
                                        {rowInfo.displayAmountText}
                                      </Typography>
                                    </Box>
                                  ) : (
                                    rowInfo.displayAmountText || (
                                      parseNumber(rowInfo.value) !== 0 ? formatNumber(rowInfo.value) : "-"
                                    )
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Box>
                    );
                  });
                })() : (
                  <MDTypography variant="button" color="text">
                    장기미수 대상이 없습니다.
                  </MDTypography>
                )}
              </Box>
            </Grid>

            {longTermDetail?.hasLongTerm && (
              <Grid item xs={12} md={4}>
                <Box sx={{ border: "1px solid #cfcfcf" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th colSpan={2} style={detailTableHeaderStyle}>
                          결론
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const detailMonths = longTermDetail?.detailMonths || [];
                        const longTermExpectedTotal = detailMonths.reduce(
                          (totalAcc, monthInfo) => totalAcc + TRACKED_UNPAID_TYPE_CODES.reduce(
                            (monthAcc, typeCode) => monthAcc + Math.max(
                              0,
                              parseNumber(
                                monthInfo?.typeRows?.find((item) => item.typeCode === typeCode)?.expected
                              )
                            ),
                            0
                          ),
                          0
                        );
                        const longTermPaidTotal = detailMonths.reduce(
                          (totalAcc, monthInfo) => totalAcc + Math.max(0, parseNumber(monthInfo?.totalPaid)),
                          0
                        );
                        const totalUnpaidAmount = longTermExpectedTotal - longTermPaidTotal;

                        return [
                          {
                            label: "총 장기미납",
                            value: formatNumber(longTermExpectedTotal) || "-",
                          },
                          {
                            label: "입금한 금액",
                            value: formatNumber(longTermPaidTotal) || "-",
                          },
                          {
                            label: "총 미납금",
                            value: formatNumber(totalUnpaidAmount) || "-",
                          },
                        ];
                      })().map((rowInfo) => (
                        <tr key={`summary_${rowInfo.label}`}>
                          <td
                            style={{
                              ...detailTableCellStyle,
                              textAlign: "center",
                              fontWeight: "bold",
                              background: rowInfo.label === "총 미납금" ? "#e7e4e4" : "#f0f0f0",
                            }}
                          >
                            {rowInfo.label}
                          </td>
                          <td
                            style={{
                              ...detailTableCellStyle,
                              textAlign: "right",
                              fontWeight: rowInfo.label === "총 미납금" ? "bold" : "normal",
                              background: rowInfo.label === "총 미납금" ? "#e7e4e4" : "transparent",
                            }}
                          >
                            {rowInfo.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Grid>
            )}
          </Grid>

          <Box display="flex" justifyContent="flex-end" mt={0.5}>
            <Button variant="contained" onClick={handleCloseLongTermDetail} sx={{ color: "#fff" }}>
              닫기
            </Button>
          </Box>
        </Box>
      </Modal>

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
              disabled={!canEdit || isSaving}
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
