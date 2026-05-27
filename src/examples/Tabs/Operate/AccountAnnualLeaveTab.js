/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { Modal, Box, Typography, Button, TextField, useTheme, useMediaQuery } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";

import useAccountAnnualLeaveData from "./accountAnnualLeaveData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";

function AccountAnnualLeaveTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    accountMemberRows,
    annualLeaveRows,
    overTimeRows,
    accountList,
    accountWorkSystemList, // ✅ 추가
    loading,
    fetchAccountMemberList,
    fetchAnnualLeaveList,
    fetchOverTimeList,
    fetchAccountList,
    fetchAccountMemberWorkSystemList, // ✅ 추가
  } = useAccountAnnualLeaveData();

  // 왼쪽: 원본 스냅샷 (수정은 안 하지만 구조 맞춰 둠)
  const [originalMasterRows, setOriginalMasterRows] = useState([]);

  // 연차부여여부 체크박스 변경 추적 { member_id: 'Y'/'N' }
  const [ledgerYnChanges, setLedgerYnChanges] = useState({});

  // 오른쪽: 화면에서 수정할 상세 데이터 (연차)
  const [detailRows, setDetailRows] = useState([]);
  const [originalDetailRows, setOriginalDetailRows] = useState([]); // 조회 당시 스냅샷

  // 검색조건: 거래처
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");

  // 왼쪽 테이블에서 선택된 직원의 member_id
  const [selectedMemberId, setSelectedMemberId] = useState("");

  // 품목 등록 모달 (현재는 사용 X)
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    cook_id: "",
    cook_name: "",
  });

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchAccountList(), fetchAccountMemberWorkSystemList()]);
    };
    init();
  }, []);

  // accountList 로딩 후 기본 선택값
  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId]);

  // ✅ 거래처 변경 시: 해당 거래처의 직원 목록 조회 & 오른쪽 초기화
  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedAccountId) return;
      await fetchAccountMemberList(selectedAccountId);
      setSelectedMemberId("");
      setDetailRows([]);
      setOriginalDetailRows([]);
      setLedgerYnChanges({});
    };
    loadMembers();
  }, [selectedAccountId]); // ❗ fetchAccountMemberList 도 의존성에서 뺀다

  // 마스터(왼쪽) 원본 스냅샷
  useEffect(() => {
    setOriginalMasterRows(accountMemberRows.map((r) => ({ ...r })));
  }, [accountMemberRows]);

  // 상세(오른쪽) 데이터 & 원본 스냅샷 세팅 (연차 리스트 기준)
  useEffect(() => {
    const typeOrder = { U: 0, G: 1, N: 2, E: 3 };
    const sorted = annualLeaveRows
      .map((r) => ({ ...r }))
      .sort((a, b) => {
        const dateA = a.ledger_dt || "";
        const dateB = b.ledger_dt || "";
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
      });
    setDetailRows(sorted);
    setOriginalDetailRows(sorted);
  }, [annualLeaveRows]);

  // normalize 함수 (공백, 문자열 차이 최소화)
  const normalize = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

  // ✅ 숫자 변환 헬퍼 (days 합계용)
  const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    const n = parseFloat(String(value).replace(/,/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  // 선택된 직원의 연차 합계 계산
  // DB에서 사용(U), 소멸(E)은 이미 음수로 저장되므로 단순 SUM으로 남은연차 계산 가능
  const summary = useMemo(() => {
    if (!detailRows || detailRows.length === 0) {
      return {
        totalGrant: 0,
        totalUse: 0,
        totalExpire: 0,
        remaining: 0,
      };
    }

    // 선택된 member_id 기준으로 필터
    const filteredRows = detailRows.filter((row) => {
      if (!selectedMemberId) return false; // 직원 선택 안 했으면 0 처리
      if (!row.member_id) return false;
      return String(row.member_id) === String(selectedMemberId);
    });

    let totalGrant = 0; // G
    let totalUse = 0; // U
    let totalExpire = 0; // E

    filteredRows.forEach((row) => {
      const days = toNumber(row.days);
      if (row.type === "G") {
        totalGrant += days;
      } else if (row.type === "U") {
        totalUse += Math.abs(days);
      } else if (row.type === "E") {
        totalExpire += Math.abs(days);
      }
    });

    // 남은연차 = 부여 - 사용 - 소멸
    const remaining = totalGrant - totalUse - totalExpire;

    return {
      totalGrant,
      totalUse,
      totalExpire,
      remaining,
    };
  }, [detailRows, selectedMemberId]);

  // 파란 헤더 바 + 요약 바를 고정시키고 테이블만 스크롤되도록 분리한 구조
  // tableWrapperSx: 전체 높이 제한 (flex column)
  // tableScrollSx:  실제 스크롤되는 내부 영역
  const tableWrapperSx = {
    display: "flex",
    flexDirection: "column",
    maxHeight: isMobile ? "55vh" : "75vh",
  };

  // 내부 스크롤 영역 (테이블만)
  const tableScrollSx = {
    flex: 1,
    minHeight: 0,
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    "& table": {
      borderCollapse: "separate",
      width: "100%",
      tableLayout: "fixed",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "2px" : "4px",
      fontSize: isMobile ? "10px" : "12px",
      whiteSpace: "pre-wrap",
      verticalAlign: "middle",
      textOverflow: "ellipsis",
    },
    "& th": {
      overflow: "hidden",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& input[type='date'], & input[type='text'], & select": {
      fontSize: isMobile ? "10px" : "12px",
      padding: isMobile ? "1px" : "2px",
      minWidth: isMobile ? "60px" : "80px",
      border: "none",
      background: "transparent",
      outline: "none",
    },
    "& input[type='number']::-webkit-outer-spin-button, & input[type='number']::-webkit-inner-spin-button": {
      WebkitAppearance: "none",
      margin: 0,
    },
    "& input[type='number']": {
      MozAppearance: "textfield",
    },
  };

  // ✅ width 조절용: 가운데(연차) 테이블 컬럼 폭
  const middleColWidths = {
    type: isMobile ? "16%" : "14%", // 구분
    ledger_dt: isMobile ? "26%" : "25%", // 기준일자
    days: isMobile ? "12%" : "10%", // 일수
    reason: isMobile ? "46%" : "51%", // 사유
  };

  // ✅ 오른쪽(영양사) 테이블 컬럼 폭
  const nutritionColWidths = {
    over_dt: isMobile ? "26%" : "25%", // 기준일자
    type: isMobile ? "12%" : "10%", // 구분
    times: isMobile ? "12%" : "10%", // 시간
    reason: isMobile ? "50%" : "55%", // 사유
  };

  // ✅ 작은 칸용 스타일: 폰트는 그대로, padding만 살짝 조정
  const compactHeaderStyle = {
    padding: isMobile ? "2px" : "4px",
  };
  const compactCellStyle = {
    padding: isMobile ? "2px" : "4px",
  };

  // 오른쪽 type(연차 구분) 옵션
  const itemOptions = useMemo(
    () => [
      { value: "G", label: "부여" },
      { value: "U", label: "사용" },
      { value: "E", label: "소멸" },
      { value: "N", label: "미지급" },
    ],
    []
  );

  // 우클릭 컨텍스트 메뉴 상태 (행 삭제용)
  // open: 메뉴 표시 여부 / mouseX,mouseY: 표시 위치 / targetRow: 우클릭한 행 데이터
  // tableType: "annualLeave" = 연차 테이블, "overTime" = 시간외근무 테이블
  const [ctxMenu, setCtxMenu] = useState({ open: false, mouseX: 0, mouseY: 0, targetRow: null, tableType: null });

  // 우클릭 시 컨텍스트 메뉴 표시 (tableType으로 어느 테이블인지 구분)
  const handleRowContextMenu = (e, row, tableType) => {
    e.preventDefault();
    setCtxMenu({ open: true, mouseX: e.clientX, mouseY: e.clientY, targetRow: row, tableType });
  };

  // 컨텍스트 메뉴 닫기
  const closeCtxMenu = () => setCtxMenu({ open: false, mouseX: 0, mouseY: 0, targetRow: null, tableType: null });

  // 행 삭제: tableType에 따라 연차 또는 시간외근무 API를 선택해서 호출
  const handleDeleteRow = async () => {
    const { targetRow: row, tableType } = ctxMenu;
    closeCtxMenu();
    if (!row) return;

    if (tableType === "annualLeave") {
      // ledger_id 없는 행 = 아직 저장 안 된 신규 행 → 로컬에서 바로 제거
      if (!row.ledger_id) {
        setDetailRows((prev) => prev.filter((r) => r !== row));
        return;
      }
      try {
        const res = await api.post("/Operate/AnnualLeaveDelete", { ledger_id: row.ledger_id });
        if (res.data.code === 200) {
          Swal.fire({ title: "삭제", text: "삭제되었습니다.", icon: "success", confirmButtonText: "확인" });
          // 삭제 후 해당 직원의 연차 목록 재조회
          if (selectedMemberId) await fetchAnnualLeaveList(selectedMemberId);
        } else {
          Swal.fire({ title: "실패", text: res.data.message || "삭제 실패", icon: "error" });
        }
      } catch (err) {
        Swal.fire({ title: "실패", text: err.message || "삭제 중 오류 발생", icon: "error" });
      }
    } else if (tableType === "overTime") {
      // over_id 없는 행 = 아직 저장 안 된 신규 행 → 현재는 읽기 전용이므로 해당 없음
      if (!row.over_id) return;
      try {
        const res = await api.post("/Operate/OverTimeDelete", { over_id: row.over_id });
        if (res.data.code === 200) {
          Swal.fire({ title: "삭제", text: "삭제되었습니다.", icon: "success", confirmButtonText: "확인" });
          // 삭제 후 해당 직원의 시간외근무 목록 재조회
          if (selectedMemberId) await fetchOverTimeList(selectedMemberId);
        } else {
          Swal.fire({ title: "실패", text: res.data.message || "삭제 실패", icon: "error" });
        }
      } catch (err) {
        Swal.fire({ title: "실패", text: err.message || "삭제 중 오류 발생", icon: "error" });
      }
    }
  };

  // 왼쪽 계약형태 옵션
  const contractOptions = useMemo(
    () => [
      { value: "1", label: "4대보험" },
      { value: "2", label: "프리랜서" },
    ],
    []
  );

  // ✅ 거래처 Autocomplete 옵션
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name,
      })),
    [accountList]
  );

  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountOptions || [];
    const qLower = q.toLowerCase();
    const exact = list.find((o) => String(o?.label || "").toLowerCase() === qLower);
    const partial =
      exact || list.find((o) => String(o?.label || "").toLowerCase().includes(qLower));
    if (partial) {
      setSelectedAccountId(partial.value);
      setAccountInput(partial.label || q);
    }
  }, [accountInput, accountOptions]);

  const getContractLabel = (contract_type) => {
    const opt = contractOptions.find((o) => String(o.value) === String(contract_type));
    return opt ? opt.label : contract_type || "";
  };

  // 왼쪽 컬럼 (직원 리스트)
  const columnsLeft = useMemo(
    () => [
      { header: "성명", accessorKey: "name" },
      { header: "입사일자", accessorKey: "join_dt" },
      { header: "근무형태", accessorKey: "idx" },
      { header: "시작", accessorKey: "start_time" },
      { header: "종료", accessorKey: "end_time" },
      { header: "연차부여 여부", accessorKey: "ledger_yn" },
    ],
    []
  );

  // 오른쪽 컬럼 (연차/상세 내역)
  const columnsRight = useMemo(
    () => [
      { header: "구분", accessorKey: "type", type: "itemOptions" },
      { header: "기준일자", accessorKey: "ledger_dt", type: "date" },
      { header: "일수", accessorKey: "days", type: "text" },
      { header: "사유", accessorKey: "reason", type: "text" },
    ],
    []
  );

  // 오른쪽 셀 변경 핸들러
  const handleDetailCellChange = (rowIndex, key, value) => {
    setDetailRows((prev) =>
      prev.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
    );
  };

  // 행 추가 (오른쪽 상세)
  const handleAddDetailRow = () => {
    if (!selectedMemberId) {
      Swal.fire({ title: "안내", text: "왼쪽 테이블에서 직원을 먼저 선택해주세요.", icon: "info" });
      return;
    }

    const defaultAccountId = selectedAccountId || accountList[0]?.account_id || "";

    const newRow = {
      member_id: selectedMemberId,
      account_id: defaultAccountId,
      type: "",
      ledger_dt: "",
      days: "",
      reason: "",
    };

    setDetailRows((prev) => [...prev, newRow]);
  };

  // 조회 버튼: 선택된 거래처의 직원 리스트만 새로 조회
  const handleSearch = async () => {
    if (!selectedAccountId) return;
    await fetchAccountMemberList(selectedAccountId);
    setSelectedMemberId("");
    setDetailRows([]);
    setOriginalDetailRows([]);
    setLedgerYnChanges({});
  };

  // 저장 버튼 (변경된 행만 서버 전송)
  const handleSave = async () => {
    const hasLedgerYnChanges = Object.keys(ledgerYnChanges).length > 0;

    if (!detailRows.length && !hasLedgerYnChanges) {
      Swal.fire({ title: "안내", text: "저장할 데이터가 없습니다.", icon: "info" });
      return;
    }

    const changedRows = [];

    detailRows.forEach((row, idx) => {
      const original = originalDetailRows[idx];

      // 완전 빈 새 행이면 스킵
      const hasAnyValue = row.type || row.ledger_dt || row.days !== "" || row.reason;
      if (!original && !hasAnyValue) return;

      // 새 행이고 값이 있으면 변경으로 간주
      if (!original && hasAnyValue) {
        changedRows.push(row);
        return;
      }

      // 기존 행이면 필드 비교
      const keys = ["type", "ledger_dt", "days", "reason"];
      const isChanged = keys.some((key) => {
        const v1 = normalize(original[key] ?? "");
        const v2 = normalize(row[key] ?? "");
        return String(v1) !== String(v2);
      });

      if (isChanged) changedRows.push(row);
    });

    if (!changedRows.length && !hasLedgerYnChanges) {
      Swal.fire({ title: "안내", text: "변경된 내용이 없습니다.", icon: "info" });
      return;
    }

    try {
      // 연차 상세 저장
      if (changedRows.length > 0) {
        const response = await api.post("/Operate/AnnualLeaveSave", { list: changedRows }, {
          headers: { "Content-Type": "application/json" },
        });
        if (response.data.code !== 200) {
          Swal.fire({ title: "실패", text: response.data.message || "연차 저장 실패", icon: "error" });
          return;
        }
      }

      // 연차부여여부 저장 (N으로 해제 시 프로시저 생성 레코드 삭제)
      if (hasLedgerYnChanges) {
        await Promise.all(
          Object.entries(ledgerYnChanges).map(async ([member_id, ledger_yn]) => {
            if (ledger_yn === "N") {
              await api.post("/Operate/AnnualLeaveDeleteProcedureRecords", { member_id });
            }
            return api.post("/Operate/AnnualLeaveLedgerYnSave", { member_id, ledger_yn });
          })
        );
      }

      await Swal.fire({
        title: "저장",
        text: "저장되었습니다.",
        icon: "success",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });

      // 확인 누른 후에 재조회 (모달 중 테이블 깜빡임 방지)
      await Promise.all([
        hasLedgerYnChanges ? fetchAccountMemberList(selectedAccountId) : Promise.resolve(),
        selectedMemberId ? fetchAnnualLeaveList(selectedMemberId) : Promise.resolve(),
      ]);

      // 재조회 완료 후 변경 추적 초기화 (Swal 중 체크박스 상태 유지를 위해 여기서 클리어)
      if (hasLedgerYnChanges) setLedgerYnChanges({});
    } catch (error) {
      Swal.fire({ title: "실패", text: error.message || "저장 중 오류 발생", icon: "error" });
    }
  };

  const handleModalOpen = () => setOpen(true);
  const handleModalClose = () => setOpen(false);

  if (loading) return <LoadingScreen />;

  // 🔹 선택된 직원 정보 & 영양사 여부 (position_type === "1")
  const selectedMember = accountMemberRows.find(
    (m) => String(m.member_id) === String(selectedMemberId)
  );
  const isNutritionist = selectedMember && String(selectedMember.position_type) === "1";

  // 오른쪽 패널 숨김은 저장 완료 후 DB 값 기준으로만 반영 (미저장 체크박스 변경은 무시)
  const selectedLedgerYn = selectedMember ? (selectedMember.ledger_yn ?? "Y") : "Y";

  // 왼쪽 테이블 렌더
  const renderLeftTable = () => (
    <MDBox pt={isMobile ? 1 : 2} pb={3} sx={tableWrapperSx}>
      <MDBox
        mx={0}
        mt={-1}
        mb={0}
        py={0.8}
        px={2}
        variant="gradient"
        bgColor="info"
        borderRadius="lg"
        coloredShadow="info"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
      >
        <MDTypography variant={isMobile ? "button" : "h6"} color="white">
          직원 목록
        </MDTypography>
      </MDBox>

      <MDBox sx={tableScrollSx}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <table>
              <thead>
                <tr>
                  {columnsLeft.map((col) => (
                    <th key={col.accessorKey}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accountMemberRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    onClick={async () => {
                      setSelectedMemberId(row.member_id);
                      if (row.member_id) {
                        await Promise.all([
                          fetchAnnualLeaveList(row.member_id),
                          fetchOverTimeList(row.member_id),
                        ]);
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        String(selectedMemberId) === String(row.member_id)
                          ? "#e0f7fa"
                          : "transparent",
                    }}
                  >
                    {columnsLeft.map((col) => {
                      if (col.accessorKey === "ledger_yn") {
                        const effectiveYn = ledgerYnChanges[row.member_id] ?? row.ledger_yn ?? "Y";
                        return (
                          <td key={col.accessorKey} onClick={(e) => e.stopPropagation()} style={{ verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                              <input
                                type="checkbox"
                                checked={effectiveYn === "Y"}
                                onChange={(e) => {
                                  setLedgerYnChanges((prev) => ({
                                    ...prev,
                                    [row.member_id]: e.target.checked ? "Y" : "N",
                                  }));
                                }}
                                style={{ cursor: "pointer", margin: 0, width: 16, height: 16 }}
                              />
                            </div>
                          </td>
                        );
                      }

                      const value = row[col.accessorKey] || "";
                      let displayValue = value;

                      if (col.type === "contractOptions") {
                        displayValue = getContractLabel(value);
                      }

                      const getWorkSystemLabel = (idx) => {
                        const found = (accountWorkSystemList || []).find(
                          (w) => String(w.idx) === String(idx)
                        );
                        return found ? found.work_system : idx ?? "";
                      };

                      if (col.accessorKey === "idx") {
                        displayValue = getWorkSystemLabel(value);
                      }

                      return (
                        <td key={col.accessorKey}>
                          <span>{displayValue}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Grid>
        </Grid>
      </MDBox>
    </MDBox>
  );

  // 오른쪽 테이블 렌더 (연차 상세) — 조회 전용
  const renderRightTable = () => (
    <MDBox pt={isMobile ? 1 : 2} pb={3} sx={tableWrapperSx}>
      <MDBox
        mx={0}
        mt={-1}
        mb={0}
        py={0.8}
        px={2}
        pt={1}
        variant="gradient"
        bgColor="info"
        borderRadius="lg"
        coloredShadow="info"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
      >
        <MDTypography variant={isMobile ? "button" : "h6"} color="white">
          연차 / 상세 내역
        </MDTypography>
      </MDBox>

      {/* ✅ 상단 고정 합계 영역 */}
      <MDBox
        mt={0}
        mb={0}
        px={2}
        py={0.5}
        sx={{
          borderRadius: 1,
          border: "1px solid #cccccc",
          backgroundColor: "#fafafa",
          display: "flex",
          flexWrap: "wrap",
          gap: isMobile ? 1 : 3,
        }}
      >
        <MDBox display="flex" alignItems="center" gap={0.5}>
          <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
            연차부여
          </MDTypography>
          <MDTypography variant="button" sx={{ fontWeight: "bold" }}>
            {summary.totalGrant}
          </MDTypography>
        </MDBox>
        <MDBox display="flex" alignItems="center" gap={0.5}>
          <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
            연차사용
          </MDTypography>
          <MDTypography variant="button" sx={{ fontWeight: "bold" }}>
            {summary.totalUse}
          </MDTypography>
        </MDBox>
        <MDBox display="flex" alignItems="center" gap={0.5}>
          <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
            연차소멸
          </MDTypography>
          <MDTypography variant="button" sx={{ fontWeight: "bold" }}>
            {summary.totalExpire}
          </MDTypography>
        </MDBox>
        <MDBox display="flex" alignItems="center" gap={0.5}>
          <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
            남은연차
          </MDTypography>
          <MDTypography
            variant="button"
            sx={{
              fontWeight: "bold",
              color: summary.remaining < 0 ? "red" : "black",
            }}
          >
            {summary.remaining}
          </MDTypography>
        </MDBox>
      </MDBox>

      <MDBox sx={tableScrollSx}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <table>
              <thead>
                <tr>
                  {columnsRight.map((col) => {
                    const isCompact = col.accessorKey === "type" || col.accessorKey === "days";
                    const widthStyle = middleColWidths[col.accessorKey]
                      ? { width: middleColWidths[col.accessorKey] }
                      : {};
                    return (
                      <th
                        key={col.accessorKey}
                        style={isCompact ? { ...compactHeaderStyle, ...widthStyle } : widthStyle}
                      >
                        {col.header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[...detailRows]
                  // 선택된 직원 행만 필터
                  .filter(
                    (row) =>
                      !selectedMemberId ||
                      !row.member_id ||
                      String(row.member_id) === String(selectedMemberId)
                  )
                  .map((row, rowIndex) => {
                    // 실제 detailRows 내 인덱스 (필터/정렬 후 rowIndex와 다를 수 있음)
                    const actualIdx = detailRows.indexOf(row);
                    const isNewRow = !row.ledger_id;

                    return (
                      // 우클릭 시 연차 행 삭제 메뉴 표시
                      <tr key={rowIndex} onContextMenu={(e) => handleRowContextMenu(e, row, "annualLeave")} style={{ cursor: "context-menu" }}>
                        {columnsRight.map((col) => {
                          const rawValue = row[col.accessorKey] ?? "";
                          const original = originalDetailRows[actualIdx];
                          const origVal = normalize(original?.[col.accessorKey] ?? "");
                          const currVal = normalize(rawValue);
                          const isChanged = isNewRow || String(origVal) !== String(currVal);

                          const isCompact = col.accessorKey === "type" || col.accessorKey === "days";
                          const widthStyle = middleColWidths[col.accessorKey]
                            ? { width: middleColWidths[col.accessorKey] }
                            : {};
                          const textColor = isChanged ? { color: "red" } : {};
                          const style = isCompact
                            ? { ...textColor, ...compactCellStyle, ...widthStyle }
                            : { ...textColor, ...widthStyle };

                          if (col.accessorKey === "type") {
                            if (!isNewRow) {
                              const label = itemOptions.find((o) => o.value === rawValue)?.label ?? rawValue;
                              return <td key={col.accessorKey} style={style}>{label}</td>;
                            }
                            return (
                              <td key={col.accessorKey} style={{ ...style, padding: 0 }}>
                                <select
                                  value={rawValue}
                                  onChange={(e) => handleDetailCellChange(actualIdx, "type", e.target.value)}
                                  style={{
                                    width: "100%",
                                    fontSize: isMobile ? "10px" : "12px",
                                    border: "none",
                                    background: "transparent",
                                    outline: "none",
                                    cursor: "pointer",
                                    color: isChanged ? "red" : "inherit",
                                    padding: "0 12px",
                                  }}
                                >
                                  <option value="">선택</option>
                                  {itemOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </td>
                            );
                          }

                          if (col.accessorKey === "ledger_dt") {
                            if (!isNewRow) {
                              return <td key={col.accessorKey} style={{ ...style, textAlign: "center" }}>{rawValue}</td>;
                            }
                            return (
                              <td key={col.accessorKey} style={{ ...style, textAlign: "center" }}>
                                <input
                                  type="date"
                                  value={rawValue}
                                  onChange={(e) => handleDetailCellChange(actualIdx, "ledger_dt", e.target.value)}
                                  style={{
                                    fontSize: isMobile ? "10px" : "12px",
                                    border: "none",
                                    background: "transparent",
                                    outline: "none",
                                    width: "100%",
                                    textAlign: "center",
                                    color: isChanged ? "red" : "inherit",
                                  }}
                                />
                              </td>
                            );
                          }

                          if (col.accessorKey === "days") {
                            const daysDisplayValue = toNumber(rawValue) === 0 ? "" : rawValue;
                            if (!isNewRow) {
                              return <td key={col.accessorKey} style={style}>{daysDisplayValue}</td>;
                            }
                            return (
                              <td key={col.accessorKey} style={style}>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={daysDisplayValue}
                                  onChange={(e) => handleDetailCellChange(actualIdx, "days", e.target.value)}
                                  style={{
                                    width: "100%",
                                    textAlign: "center",
                                    fontSize: isMobile ? "10px" : "12px",
                                    border: "none",
                                    background: "transparent",
                                    outline: "none",
                                    color: isChanged ? "red" : "inherit",
                                    MozAppearance: "textfield",
                                    WebkitAppearance: "none",
                                  }}
                                />
                              </td>
                            );
                          }

                          if (col.accessorKey === "reason") {
                            if (!isNewRow) {
                              return <td key={col.accessorKey} style={style}>{rawValue}</td>;
                            }
                            return (
                              <td key={col.accessorKey} style={style}>
                                <input
                                  type="text"
                                  value={rawValue}
                                  onChange={(e) => handleDetailCellChange(actualIdx, "reason", e.target.value)}
                                  style={{
                                    width: "100%",
                                    fontSize: isMobile ? "10px" : "12px",
                                    border: "none",
                                    background: "transparent",
                                    outline: "none",
                                    color: isChanged ? "red" : "inherit",
                                  }}
                                />
                              </td>
                            );
                          }

                          return (
                            <td key={col.accessorKey} style={style}>
                              {rawValue}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </Grid>
        </Grid>
      </MDBox>
    </MDBox>
  );

  // 영양사 전용 오른쪽 끝 테이블 (시간외근무 내역 + 상단 요약)
  const renderNutritionTable = () => {
    if (!isNutritionist) return null;

    const nutritionOverRows = overTimeRows.filter(
      (row) => row.member_id && String(row.member_id) === String(selectedMemberId)
    );

    let totalGrantTime = 0;
    let totalUseTime = 0;
    let remainingTime = 0;

    nutritionOverRows.forEach((row) => {
      const t = Number(row.times) || 0;
      if (row.type === "G") totalGrantTime += t;
      else if (row.type === "U") totalUseTime += t;
      remainingTime += t;
    });

    // 영양사 시간 외 근무 내역 잠시 제외
    // return (
    //   <MDBox pt={isMobile ? 1 : 2} pb={3} sx={tableWrapperSx}>
    //     <MDBox
    //       mx={0}
    //       mt={-1}
    //       mb={0}
    //       py={0.8}
    //       px={2}
    //       pt={1}
    //       variant="gradient"
    //       bgColor="info"
    //       borderRadius="lg"
    //       coloredShadow="info"
    //       display="flex"
    //       justifyContent="space-between"
    //       alignItems="center"
    //     >
    //       <MDTypography variant={isMobile ? "button" : "h6"} color="white">
    //         영양사 시간 외 근무 내역
    //       </MDTypography>
    //     </MDBox>

    //     <MDBox
    //       mt={0}
    //       mb={0}
    //       px={2}
    //       py={0.5}
    //       sx={{
    //         borderRadius: 1,
    //         border: "1px solid #cccccc",
    //         backgroundColor: "#fafafa",
    //         display: "flex",
    //         flexWrap: "wrap",
    //         gap: isMobile ? 1 : 3,
    //       }}
    //     >
    //       <MDBox display="flex" alignItems="center" gap={0.5}>
    //         <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
    //           보상시간 부여
    //         </MDTypography>
    //         <MDTypography variant="button" sx={{ fontWeight: "bold" }}>
    //           {totalGrantTime}
    //         </MDTypography>
    //       </MDBox>
    //       <MDBox display="flex" alignItems="center" gap={0.5}>
    //         <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
    //           보상시간 사용
    //         </MDTypography>
    //         <MDTypography variant="button" sx={{ fontWeight: "bold" }}>
    //           {totalUseTime}
    //         </MDTypography>
    //       </MDBox>
    //       <MDBox display="flex" alignItems="center" gap={0.5}>
    //         <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
    //           남은시간
    //         </MDTypography>
    //         <MDTypography
    //           variant="button"
    //           sx={{ fontWeight: "bold", color: remainingTime < 0 ? "red" : "black" }}
    //         >
    //           {remainingTime}
    //         </MDTypography>
    //       </MDBox>
    //     </MDBox>

    //     <MDBox sx={tableScrollSx}>
    //     <Grid container spacing={2}>
    //       <Grid item xs={12}>
    //         <table>
    //           <thead>
    //             <tr>
    //               <th style={{ width: nutritionColWidths.over_dt }}>기준일자</th>
    //               <th style={{ ...compactHeaderStyle, width: nutritionColWidths.type }}>구분</th>
    //               <th style={{ ...compactHeaderStyle, width: nutritionColWidths.times }}>시간</th>
    //               <th style={{ width: nutritionColWidths.reason }}>사유</th>
    //             </tr>
    //           </thead>
    //           <tbody>
    //             {nutritionOverRows.map((row, idx) => (
    //               // 우클릭 시 시간외근무 행 삭제 메뉴 표시
    //               <tr key={row.over_id || idx} onContextMenu={(e) => handleRowContextMenu(e, row, "overTime")} style={{ cursor: "context-menu" }}>
    //                 <td style={{ width: nutritionColWidths.over_dt }}>{row.over_dt}</td>
    //                 <td style={{ ...compactCellStyle, width: nutritionColWidths.type }}>
    //                   {getTypeLabel(row.type)}
    //                 </td>
    //                 <td style={{ ...compactCellStyle, width: nutritionColWidths.times }}>
    //                   {row.times}
    //                 </td>
    //                 <td style={{ width: nutritionColWidths.reason }}>{row.reason}</td>
    //               </tr>
    //             ))}
    //           </tbody>
    //         </table>
    //       </Grid>
    //     </Grid>
    //     </MDBox>
    //   </MDBox>
    // );
  };

  return (
    <>
      {/* 상단 검색/버튼 영역 */}
      <MDBox
        pt={1}
        pb={1}
        gap={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        {/* ✅ 거래처 검색 가능한 Autocomplete */}
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={(() => {
            const v = String(selectedAccountId ?? "");
            return accountOptions.find((o) => o.value === v) || null;
          })()}
          onChange={(_, opt) => {
            if (!opt) return;
            setSelectedAccountId(opt.value);
          }}
          inputValue={accountInput}
          onInputChange={(_, newValue) => setAccountInput(newValue)}
          getOptionLabel={(opt) => opt?.label ?? ""}
          isOptionEqualToValue={(opt, val) => opt.value === val.value}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 검색"
              placeholder="거래처명을 입력"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  selectAccountByInput();
                }
              }}
              sx={{
                "& .MuiInputBase-root": { height: 40, fontSize: 12 },
                "& .MuiInputLabel-root": { fontSize: 12 },
                "& input": { paddingLeft: "8px", paddingTop: 0, paddingBottom: 0, lineHeight: 1 },
              }}
            />
          )}
        />

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSearch}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : 80 }}
        >
          조회
        </MDButton>

        <MDButton
          variant="gradient"
          color="success"
          onClick={handleAddDetailRow}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : 80 }}
        >
          행추가
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : 80 }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* 왼쪽 / 오른쪽 테이블 */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          {renderLeftTable()}
        </Grid>
        <Grid item xs={12} md={6}>
          {selectedLedgerYn !== "N" && renderRightTable()}
        </Grid>
      </Grid>

      {/* 우클릭 행 삭제 컨텍스트 메뉴 — accountissuesheettab.js와 동일한 스타일 */}
      {ctxMenu.open && (
        <div
          onClick={closeCtxMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeCtxMenu();
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: ctxMenu.mouseY,
              left: ctxMenu.mouseX,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
              minWidth: 140,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={handleDeleteRow}
            >
              🗑️ 행 삭제
            </button>
          </div>
        </div>
      )}

      {/* 품목 등록 모달 (현재 사용 X, 그대로 둠) */}
      <Modal open={open} onClose={handleModalClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? "90%" : 500,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: isMobile ? 3 : 5,
          }}
        >
          <Typography variant="h6" gutterBottom>
            조리도구 등록
          </Typography>
          <TextField
            fullWidth
            margin="normal"
            label="도구ID"
            name="cook_id"
            value={formData.cook_id}
            onChange={(e) => setFormData({ ...formData, cook_id: e.target.value })}
            InputLabelProps={{ style: { fontSize: "0.8rem" } }}
          />
          <TextField
            fullWidth
            margin="normal"
            label="도구명"
            name="cook_name"
            value={formData.cook_name}
            onChange={(e) => setFormData({ ...formData, cook_name: e.target.value })}
            InputLabelProps={{ style: { fontSize: "0.8rem" } }}
          />
          <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={handleModalClose}
              sx={{
                bgcolor: "#e8a500",
                color: "#ffffff",
                "&:hover": { bgcolor: "#e8a500" },
              }}
            >
              취소
            </Button>
            <Button variant="contained" sx={{ color: "#ffffff" }}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

export default AccountAnnualLeaveTab;
