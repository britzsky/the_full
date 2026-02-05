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
    };
    loadMembers();
  }, [selectedAccountId]); // ❗ fetchAccountMemberList 도 의존성에서 뺀다

  // 마스터(왼쪽) 원본 스냅샷
  useEffect(() => {
    setOriginalMasterRows(accountMemberRows.map((r) => ({ ...r })));
  }, [accountMemberRows]);

  // 상세(오른쪽) 데이터 & 원본 스냅샷 세팅 (연차 리스트 기준)
  useEffect(() => {
    const copied = annualLeaveRows.map((r) => ({ ...r }));
    setDetailRows(copied);
    setOriginalDetailRows(copied);
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

  // ✅ 선택된 직원의 연차 합계 계산
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
        totalUse += days;
      } else if (row.type === "E") {
        totalExpire += days;
      }
    });

    // ✅ 남은연차 = 부여 - 사용 - 소멸 (DB 에서 U, E 가 음수라면 단순 합으로 처리됨)
    const remaining = totalGrant + totalUse + totalExpire;

    return {
      totalGrant,
      totalUse,
      totalExpire,
      remaining,
    };
  }, [detailRows, selectedMemberId]);

  // 오른쪽 테이블 셀 스타일 (변경 시 빨간 글씨)
  const getDetailCellStyle = (rowIndex, key) => {
    const original = originalDetailRows[rowIndex];
    const current = detailRows[rowIndex];

    // 새로 추가된 행 (원본 없음) + 뭔가 값이 있는 경우 -> 빨간색
    if (!original) {
      const v = current?.[key];
      if (v !== undefined && v !== null && v !== "") {
        return { color: "red" };
      }
      return { color: "black" };
    }

    const v1 = normalize(original[key] ?? "");
    const v2 = normalize(current?.[key] ?? "");

    if (String(v1) !== String(v2)) {
      return { color: "red" };
    }
    return { color: "black" };
  };

  // 전체 테이블 스타일 (모바일 대응)
  const tableSx = {
    flex: 1,
    minHeight: 0,
    maxHeight: isMobile ? "55vh" : "75vh",
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
      overflow: "hidden",
      textOverflow: "ellipsis",
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
  };

  // ✅ width 조절용: 가운데(연차) 테이블 컬럼 폭
  const middleColWidths = {
    type: isMobile ? "12%" : "10%", // 구분
    ledger_dt: isMobile ? "26%" : "25%", // 기준일자
    days: isMobile ? "12%" : "10%", // 일수
    reason: isMobile ? "50%" : "55%", // 사유
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

  const getTypeLabel = (type) => {
    const opt = itemOptions.find((o) => String(o.value) === String(type));
    return opt ? opt.label : type || "";
  };

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
  };

  // 저장 버튼 (변경된 행만 서버 전송)
  const handleSave = async () => {
    if (!detailRows.length) {
      Swal.fire({ title: "안내", text: "저장할 데이터가 없습니다.", icon: "info" });
      return;
    }

    const changedRows = [];

    detailRows.forEach((row, idx) => {
      const original = originalDetailRows[idx];

      // 완전 빈 새 행이면 스킵
      const hasAnyValue = Object.values(row).some((v) => v !== null && v !== undefined && v !== "");
      if (!original && !hasAnyValue) return;

      // 새 행이고 값이 있으면 변경으로 간주
      if (!original && hasAnyValue) {
        changedRows.push(row);
        return;
      }

      // 기존 행이면 필드 비교
      const keys = ["type", "account_id", "ledger_dt", "days", "reason"];
      const isChanged = keys.some((key) => {
        const v1 = normalize(original[key] ?? "");
        const v2 = normalize(row[key] ?? "");
        return String(v1) !== String(v2);
      });

      if (isChanged) changedRows.push(row);
    });

    if (!changedRows.length) {
      Swal.fire({ title: "안내", text: "변경된 내용이 없습니다.", icon: "info" });
      return;
    }

    try {
      const payload = { outList: { list: changedRows } };

      const response = await api.post("/Business/CookWearSave", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        if (selectedMemberId) {
          await fetchAnnualLeaveList(selectedMemberId); // member_id만 전달
        }
      } else {
        Swal.fire({ title: "실패", text: response.data.message || "저장 실패", icon: "error" });
      }
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

  // 왼쪽 테이블 렌더
  const renderLeftTable = () => (
    <MDBox pt={isMobile ? 1 : 2} pb={3} sx={tableSx}>
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
  );

  // 오른쪽 테이블 렌더 (연차 상세) — 조회 전용
  const renderRightTable = () => (
    <MDBox pt={isMobile ? 1 : 2} pb={3} sx={tableSx}>
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
              {detailRows.map((row, rowIndex) => {
                if (
                  selectedMemberId &&
                  row.member_id &&
                  String(row.member_id) !== String(selectedMemberId)
                ) {
                  return null;
                }

                return (
                  <tr key={rowIndex}>
                    {columnsRight.map((col) => {
                      const rawValue = row[col.accessorKey] || "";
                      const baseStyle = getDetailCellStyle(rowIndex, col.accessorKey);

                      const isCompact = col.accessorKey === "type" || col.accessorKey === "days";
                      const widthStyle = middleColWidths[col.accessorKey]
                        ? { width: middleColWidths[col.accessorKey] }
                        : {};
                      const style = isCompact
                        ? { ...baseStyle, ...compactCellStyle, ...widthStyle }
                        : { ...baseStyle, ...widthStyle };

                      let displayValue = rawValue;
                      if (col.type === "itemOptions") displayValue = getTypeLabel(row.type);

                      return (
                        <td key={col.accessorKey} style={style}>
                          {displayValue}
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

    return (
      <MDBox pt={isMobile ? 1 : 2} pb={3} sx={tableSx}>
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
            영양사 시간외 근무 내역
          </MDTypography>
        </MDBox>

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
              보상시간 부여
            </MDTypography>
            <MDTypography variant="button" sx={{ fontWeight: "bold" }}>
              {totalGrantTime}
            </MDTypography>
          </MDBox>
          <MDBox display="flex" alignItems="center" gap={0.5}>
            <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
              보상시간 사용
            </MDTypography>
            <MDTypography variant="button" sx={{ fontWeight: "bold" }}>
              {totalUseTime}
            </MDTypography>
          </MDBox>
          <MDBox display="flex" alignItems="center" gap={0.5}>
            <MDTypography variant="caption" sx={{ fontWeight: "bold" }}>
              남은시간
            </MDTypography>
            <MDTypography
              variant="button"
              sx={{ fontWeight: "bold", color: remainingTime < 0 ? "red" : "black" }}
            >
              {remainingTime}
            </MDTypography>
          </MDBox>
        </MDBox>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: nutritionColWidths.over_dt }}>기준일자</th>
                  <th style={{ ...compactHeaderStyle, width: nutritionColWidths.type }}>구분</th>
                  <th style={{ ...compactHeaderStyle, width: nutritionColWidths.times }}>시간</th>
                  <th style={{ width: nutritionColWidths.reason }}>사유</th>
                </tr>
              </thead>
              <tbody>
                {nutritionOverRows.map((row, idx) => (
                  <tr key={row.over_id || idx}>
                    <td style={{ width: nutritionColWidths.over_dt }}>{row.over_dt}</td>
                    <td style={{ ...compactCellStyle, width: nutritionColWidths.type }}>
                      {getTypeLabel(row.type)}
                    </td>
                    <td style={{ ...compactCellStyle, width: nutritionColWidths.times }}>
                      {row.times}
                    </td>
                    <td style={{ width: nutritionColWidths.reason }}>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Grid>
        </Grid>
      </MDBox>
    );
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
                "& input": { padding: "0 8px" },
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
          color="info"
          onClick={handleSave}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : 80 }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* 왼쪽 / 가운데 / 오른쪽(영양사 전용) 테이블 */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={isNutritionist ? 4 : 6}>
          {renderLeftTable()}
        </Grid>
        <Grid item xs={12} md={isNutritionist ? 4 : 6}>
          {renderRightTable()}
        </Grid>
        {isNutritionist && (
          <Grid item xs={12} md={4}>
            {renderNutritionTable()}
          </Grid>
        )}
      </Grid>

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
