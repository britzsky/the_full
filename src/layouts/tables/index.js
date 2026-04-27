/* eslint-disable react/function-component-definition */
import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import {
  Modal,
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
} from "@mui/material";

import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DaumPostcode from "react-daum-postcode";
import LoadingScreen from "../loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";

import useTableData from "layouts/tables/data/authorsTableData";
import "./tables.css";

export default function Tables() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isCompactTable = useMediaQuery("(max-width:1536px)");
  const [selectedType, setSelectedType] = useState("0");
  // 삭제여부 조회값 상태
  const [selectedDelYn, setSelectedDelYn] = useState("ALL");
  // 고객사 목록 정렬 기준 상태
  const [accountSortKey, setAccountSortKey] = useState("account_name");
  // 조회 필터 변경 시 로딩 화면 유지 상태
  const [sortLoading, setSortLoading] = useState(false);
  // 서버 조회 결과를 화면 목록 상태로 반영하는 동안 유지하는 로딩 상태
  const [viewLoading, setViewLoading] = useState(true);
  // 실제 조회 시작 여부 추적(로딩 조기 종료 방지)
  const searchStartedRef = useRef(false);
  // 로딩 원인 추적(SEARCH: 서버조회, LOCAL: 화면 정렬/필터)
  const sortLoadingReasonRef = useRef("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 21 });

  const [open, setOpen] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formData, setFormData] = useState({
    account_name: "",
    account_address: "",
    account_address_detail: "",
    phone: "",
    account_rqd_member: "",
    account_headcount: "",
    account_type: "",
    meal_type: "",
    del_yn: "",
  });

  // 고객사 목록 조회 훅
  const { columns, rows, loading } = useTableData(selectedType, refreshKey);
  const rowsByDelYn = rows;

  // 목록 값 문자열 정리 유틸
  const toPlainText = useCallback((v) => {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);

    // React 엘리먼트 자식 문자열 추출
    if (React.isValidElement(v)) {
      const c = v.props?.children;
      if (c == null) return "";
      if (Array.isArray(c)) return c.map((x) => (x == null ? "" : String(x))).join("");
      return String(c);
    }
    return String(v);
  }, []);

  const normalizeAccountType = useCallback(
    (v) => {
      const s = toPlainText(v).trim();
      if (!s) return "";
      if (/^\d+$/.test(s)) return s;

      const map = {
        요양원: "1",
        도소매: "2",
        프랜차이즈: "3",
        산업체: "4",
        학교: "5",
      };
      return map[s] || "";
    },
    [toPlainText]
  );

  const normalizeMealType = useCallback(
    (v) => {
      const s = toPlainText(v).trim();
      if (!s) return "";
      if (/^\d+$/.test(s)) return s;

      // 모달 옵션 기준
      const map = {
        요양주간: "1",
        요양직원: "2",
        요양: "3",
        주간보호: "4",
        산업체: "5",
      };
      return map[s] || "";
    },
    [toPlainText]
  );

  const toNumberString = useCallback((v) => {
    if (v == null) return "";
    return String(v).replace(/[^0-9]/g, "");
  }, []);

  // 로컬 편집용 목록 상태
  const [localRows, setLocalRows] = useState([]);

  // 변경 비교 기준 원본값 상태
  const [originalMap, setOriginalMap] = useState({});

  useLayoutEffect(() => {
    const base = Array.isArray(rowsByDelYn) ? rowsByDelYn : [];
    const next = base.map((r, idx) => {
      const accountId = r?.account_id;
      const rowKey =
        accountId != null && String(accountId) !== "" ? String(accountId) : `row-${idx}`;

      return {
        ...r,
        _rowKey: rowKey,
        account_rqd_member: toNumberString(toPlainText(r?.account_rqd_member)),
        account_headcount: toNumberString(toPlainText(r?.account_headcount)),
        del_yn: (toPlainText(r?.del_yn) || "N").toUpperCase(), // 삭제여부 대문자 정규화
      };
    });

    // 로컬 편집 목록 반영
    setLocalRows(next);

    // 변경 비교 원본값 구성
    const om = {};
    next.forEach((r) => {
      om[r._rowKey] = {
        account_rqd_member: String(r.account_rqd_member ?? ""),
        account_headcount: String(r.account_headcount ?? ""),
        del_yn: String(r.del_yn ?? "N").toUpperCase(), // 삭제여부 대문자 정규화
      };
    });
    setOriginalMap(om);

    // 조회결과 변경 시 첫 페이지 이동
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setViewLoading(false);
  }, [rowsByDelYn, toPlainText, toNumberString]);

  // 수정값 누적 상태
  const [editedMap, setEditedMap] = useState({});

  useEffect(() => {
    setEditedMap({});
  }, [selectedType]);

  const onSearchList = (e) => {
    const nextType = String(e.target.value || "0");
    if (nextType === selectedType) return;

    sortLoadingReasonRef.current = "SEARCH";
    setSortLoading(true);
    searchStartedRef.current = false;
    setSelectedType(nextType);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // 삭제여부 필터 변경 핸들러
  const handledelynChange = (e) => {
    const nextDelYn = String(e.target.value || "ALL").trim().toUpperCase();
    if (nextDelYn === selectedDelYn) return;

    sortLoadingReasonRef.current = "LOCAL";
    setSortLoading(true);
    setSelectedDelYn(nextDelYn);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // 정렬 기준 변경 핸들러
  const handleSortChange = (e) => {
    const nextKey = String(e.target.value);
    if (nextKey === accountSortKey) return;

    sortLoadingReasonRef.current = "LOCAL";
    setSortLoading(true);
    setAccountSortKey(nextKey);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  useEffect(() => {
    if (!sortLoading) return;

    const reason = sortLoadingReasonRef.current;
    if (reason === "LOCAL") {
      const rafId = window.requestAnimationFrame(() => {
        setSortLoading(false);
        sortLoadingReasonRef.current = "";
      });
      return () => window.cancelAnimationFrame(rafId);
    }

    // 조회가 시작되면 시작 플래그를 기록
    if (loading) {
      searchStartedRef.current = true;
      return;
    }

    // 조회가 시작된 이후 loading=false가 된 시점에만 로딩 종료
    if (searchStartedRef.current) {
      setSortLoading(false);
      searchStartedRef.current = false;
      sortLoadingReasonRef.current = "";
    }
  }, [loading, sortLoading, selectedDelYn, accountSortKey]);

  // 화면 표시 전용 정렬 목록
  const sortedLocalRows = useMemo(() => {
    const copied = Array.isArray(localRows) ? [...localRows] : [];
    // 삭제여부 1차 필터
    const normalizedDelYn = String(selectedDelYn ?? "ALL").trim().toUpperCase();
    const filtered =
      normalizedDelYn === "ALL"
        ? copied
        : copied.filter(
          (row) => String(row?.del_yn ?? "N").trim().toUpperCase() === normalizedDelYn
        );

    const textCompare = (a, b) =>
      String(a ?? "").localeCompare(String(b ?? ""), "ko-KR", {
        numeric: true,
        sensitivity: "base",
      });

    filtered.sort((a, b) => {
      // ✅ "전체" 옵션이 있을 경우 항상 상단 고정
      const isAllA =
        String(a?.account_id ?? "").trim().toUpperCase() === "ALL" ||
        String(toPlainText(a?.account_name) ?? "").trim() === "전체";
      const isAllB =
        String(b?.account_id ?? "").trim().toUpperCase() === "ALL" ||
        String(toPlainText(b?.account_name) ?? "").trim() === "전체";
      if (isAllA && !isAllB) return -1;
      if (!isAllA && isAllB) return 1;

      const keyA =
        accountSortKey === "account_id"
          ? String(a?.account_id ?? "").trim()
          : String(toPlainText(a?.account_name) ?? "").trim();
      const keyB =
        accountSortKey === "account_id"
          ? String(b?.account_id ?? "").trim()
          : String(toPlainText(b?.account_name) ?? "").trim();

      if (keyA && keyB) {
        const byKey = textCompare(keyA, keyB);
        if (byKey !== 0) return byKey;
      } else if (keyA && !keyB) {
        return -1;
      } else if (!keyA && keyB) {
        return 1;
      }

      // ✅ 동순위 fallback: 거래처명 -> account_id
      const nameA = String(toPlainText(a?.account_name) ?? "").trim();
      const nameB = String(toPlainText(b?.account_name) ?? "").trim();
      const byName = textCompare(nameA, nameB);
      if (byName !== 0) return byName;

      return textCompare(
        String(a?.account_id ?? "").trim(),
        String(b?.account_id ?? "").trim()
      );
    });

    return filtered;
  }, [localRows, accountSortKey, selectedDelYn, toPlainText]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleModalOpen = () => setOpen(true);

  const handleModalClose = () => {
    setFormData({
      account_name: "",
      account_address: "",
      account_address_detail: "",
      phone: "",
      account_rqd_member: "",
      account_headcount: "",
      account_type: "",
      meal_type: "",
      del_yn: "N", // ✅ 추가
    });
    setOpen(false);
  };

  const handleAddressSelect = (data) => {
    setFormData((prev) => ({ ...prev, account_address: data.address }));
    setAddrOpen(false);
  };

  const handleSubmit = () => {
    if (
      !formData.account_name ||
      !formData.account_address ||
      !formData.phone ||
      formData.meal_type === "" ||
      formData.account_type === ""
    ) {
      return Swal.fire({
        title: "경고",
        text: "필수항목을 확인하세요.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }

    api
      .post("/Account/AccountSave", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        if (res.data.code === 200)
          Swal.fire({
            title: "저장",
            text: "저장되었습니다.",
            icon: "success",
            confirmButtonColor: "#d33",
            confirmButtonText: "확인",
          }).then((result) => {
            if (result.isConfirmed) handleModalClose();
          });
      })
      .catch(() =>
        Swal.fire({
          title: "실패",
          text: "저장을 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        })
      );
  };

  // =========================
  // ✅ 편집 로직 (rowKey 기반)
  // =========================
  const updateEditableField = useCallback(
    (rowKey, account_id, field, value) => {
      const clean = field === "del_yn" ? String(value || "N").toUpperCase() : toNumberString(value);

      // 1) localRows 갱신
      setLocalRows((prev) =>
        prev.map((r) => (r._rowKey === rowKey ? { ...r, [field]: clean } : r))
      );

      // 2) editedMap 갱신 (+ 원래값으로 되돌리면 자동 제거)
      setEditedMap((prev) => {
        const nextRow = {
          ...(prev[rowKey] || {}),
          account_id,
          [field]: clean,
        };

        const org = originalMap[rowKey] || {
          account_rqd_member: "",
          account_headcount: "",
          del_yn: "N",
        };

        const mergedRqd = String(nextRow.account_rqd_member ?? org.account_rqd_member ?? "");
        const mergedHead = String(nextRow.account_headcount ?? org.account_headcount ?? "");
        const mergedDel = String(nextRow.del_yn ?? org.del_yn ?? "N").toUpperCase();

        const dirty =
          mergedRqd !== String(org.account_rqd_member ?? "") ||
          mergedHead !== String(org.account_headcount ?? "") ||
          mergedDel !== String(org.del_yn ?? "N").toUpperCase();

        if (!dirty) {
          const copy = { ...prev };
          delete copy[rowKey];
          return copy;
        }

        return { ...prev, [rowKey]: nextRow };
      });
    },
    [toNumberString, originalMap]
  );

  // ✅ 진짜 변경 여부(원래값 vs 현재값)
  const isRowDirty = useCallback(
    (row) => {
      const rowKey = row?._rowKey;
      if (!rowKey) return false;

      const org = originalMap[rowKey];
      if (!org) return false;

      const nowRqd = String(row?.account_rqd_member ?? "");
      const nowHead = String(row?.account_headcount ?? "");
      const nowDel = String(row?.del_yn ?? "N").toUpperCase();

      return (
        nowRqd !== String(org.account_rqd_member ?? "") ||
        nowHead !== String(org.account_headcount ?? "") ||
        nowDel !== String(org.del_yn ?? "N").toUpperCase()
      );
    },
    [originalMap]
  );

  const normalizeDelYn = useCallback(
    (v) => {
      const s = toPlainText(v).trim().toUpperCase();
      if (s === "Y" || s === "N") return s;
      return "N";
    },
    [toPlainText]
  );

  // ✅ 저장(행 단위)
  const handleSaveRow = useCallback(
    async (row) => {
      const rowKey = row?._rowKey;
      const account_id = row?.account_id;

      if (!rowKey) return Swal.fire({ title: "오류", text: "rowKey가 없습니다.", icon: "error" });
      if (!account_id)
        return Swal.fire({ title: "오류", text: "account_id가 없습니다.", icon: "error" });

      const edited = editedMap[rowKey] || {};
      const account_rqd_member = edited.account_rqd_member ?? row.account_rqd_member ?? "";
      const account_headcount = edited.account_headcount ?? row.account_headcount ?? "";

      const account_type = normalizeAccountType(row.account_type_value ?? row.account_type);
      const meal_type = normalizeMealType(row.meal_type_value ?? row.meal_type);

      // ✅ 여기서 edited 우선
      const del_yn = normalizeDelYn(edited.del_yn ?? row.del_yn_value ?? row.del_yn ?? "N");

      const fd = new FormData();
      fd.append("account_id", String(account_id));
      fd.append("account_rqd_member", String(account_rqd_member));
      fd.append("account_headcount", String(account_headcount));
      fd.append("account_type", String(account_type));
      fd.append("meal_type", String(meal_type));
      fd.append("del_yn", String(del_yn)); // ✅ 추가

      try {
        const res = await api.post("/Account/AccountSave", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res.data?.code === 200) {
          Swal.fire({ title: "저장", text: "저장되었습니다.", icon: "success" });

          setOriginalMap((prev) => ({
            ...prev,
            [rowKey]: {
              account_rqd_member: String(account_rqd_member ?? ""),
              account_headcount: String(account_headcount ?? ""),
              del_yn: String(del_yn ?? "N").toUpperCase(),
            },
          }));

          setEditedMap((prev) => {
            const next = { ...prev };
            delete next[rowKey];
            return next;
          });

          setRefreshKey((k) => k + 1); // ✅ 화면(데이터) 새로고침
        } else {
          Swal.fire({ title: "실패", text: "저장 실패", icon: "error" });
        }
      } catch (e) {
        console.error(e);
        Swal.fire({ title: "실패", text: "저장 실패", icon: "error" });
      }
    },
    [editedMap, normalizeAccountType, normalizeMealType, normalizeDelYn]
  );

  // ✅ 전체 저장
  const handleSaveAll = useCallback(async () => {
    const dirtyRows = (localRows || []).filter((r) => isRowDirty(r));

    if (!dirtyRows.length) {
      Swal.fire({ title: "안내", text: "변경된 내용이 없습니다.", icon: "info" });
      return;
    }

    const confirm = await Swal.fire({
      title: "저장하시겠습니까?",
      text: `총 ${dirtyRows.length}건 저장합니다.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "예",
      cancelButtonText: "아니오",
      confirmButtonColor: "#d33",
    });

    if (!confirm.isConfirmed) return;

    for (const r of dirtyRows) {
      await handleSaveRow(r);
    }
    setRefreshKey((k) => k + 1); // ✅ 전체 저장 완료 후 1번만 재조회
  }, [localRows, isRowDirty, handleSaveRow]);

  // =========================
  // ✅ 편집 셀 + 변경 시 빨간 글씨
  // =========================
  const EditableCell = ({ info, field }) => {
    const row = info.row.original;
    const rowKey = row?._rowKey;
    const accountId = row?.account_id;

    const base = toPlainText(info.getValue());
    const committedValue = editedMap?.[rowKey]?.[field] ?? base;

    const org = originalMap?.[rowKey]?.[field] ?? "";
    const isDirtyCell = String(committedValue ?? "") !== String(org ?? "");

    return (
      <TextField
        key={`${rowKey}-${field}-${committedValue}`}
        defaultValue={committedValue}
        // 입력 중 전체 테이블 재렌더를 막기 위해 blur 시점에만 행 상태를 갱신
        onBlur={(e) => updateEditableField(rowKey, accountId, field, e.target.value)}
        size="small"
        variant="outlined"
        // ✅ 입력이 페이지 이동(리셋)을 유발하지 않게 하려면
        // 핵심은 아래 useReactTable의 autoResetPageIndex: false
        sx={{
          width: 70,
          "& .MuiInputBase-root": { height: 28 },
          "& .MuiOutlinedInput-input": {
            py: 0.25,
            px: 0.75,
            fontSize: "0.75rem",
            textAlign: "center",
            color: isDirtyCell ? "#d32f2f" : "inherit",
            fontWeight: isDirtyCell ? 800 : 400,
          },
        }}
      />
    );
  };

  const EditableSelectCell = ({ info, field }) => {
    const row = info.row.original;
    const rowKey = row?._rowKey;
    const accountId = row?.account_id;

    const base = (toPlainText(info.getValue()) || "N").toUpperCase();
    const value = (editedMap?.[rowKey]?.[field] ?? base).toUpperCase();

    const org = (originalMap?.[rowKey]?.[field] ?? "N").toUpperCase();
    const isDirtyCell = String(value) !== String(org);

    return (
      <Select
        size="small"
        value={value}
        onChange={(e) => updateEditableField(rowKey, accountId, field, e.target.value)}
        sx={{
          width: 80,
          height: 28,
          fontSize: "0.75rem",
          "& .MuiSelect-select": {
            py: 0.25,
            px: 1,
            textAlign: "center",
            color: isDirtyCell ? "#d32f2f" : "inherit",
            fontWeight: isDirtyCell ? 800 : 400,
          },
        }}
      >
        <MenuItem value="N">N</MenuItem>
        <MenuItem value="Y">Y</MenuItem>
      </Select>
    );
  };

  EditableSelectCell.propTypes = {
    info: PropTypes.shape({
      getValue: PropTypes.func.isRequired,
      row: PropTypes.shape({
        original: PropTypes.shape({
          _rowKey: PropTypes.string,
          account_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        }).isRequired,
      }).isRequired,
    }).isRequired,
    field: PropTypes.oneOf(["del_yn"]).isRequired,
  };

  EditableCell.propTypes = {
    info: PropTypes.shape({
      getValue: PropTypes.func.isRequired,
      row: PropTypes.shape({
        original: PropTypes.shape({
          _rowKey: PropTypes.string,
          account_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        }).isRequired,
      }).isRequired,
    }).isRequired,
    field: PropTypes.oneOf(["account_rqd_member", "account_headcount"]).isRequired,
  };

  // =========================
  // ✅ 테이블 컬럼 구성
  // =========================
  const paddedMobileColumnSet = useMemo(
    () =>
      new Set([
        "account_address",
        "full_room",
        "diet_price",
        "normal",
        "contract_period",
        "account_type",
      ]),
    []
  );

  const tableColumns = useMemo(() => {
    // ✅ 집계표(tally) 컬럼은 index.js 화면에서 제외
    return (columns || [])
      .filter((col) => col?.accessor !== "tally")
      .map((col) => {
        const accessorKey = col.accessor;

        if (accessorKey === "account_rqd_member") {
          return {
            header: col.Header,
            accessorKey,
            cell: (info) => <EditableCell info={info} field="account_rqd_member" />,
          };
        }

        if (accessorKey === "account_headcount") {
          return {
            header: col.Header,
            accessorKey,
            cell: (info) => <EditableCell info={info} field="account_headcount" />,
          };
        }

        if (accessorKey === "del_yn") {
          return {
            header: col.Header,
            accessorKey,
            cell: (info) => <EditableSelectCell info={info} field="del_yn" />,
          };
        }

        return {
          header: col.Header,
          accessorKey,
          cell: (info) => info.getValue(),
        };
      });
  }, [columns, editedMap, toPlainText, originalMap, updateEditableField]);

  // =========================
  // ✅ 테이블 생성
  // =========================
  const table = useReactTable({
    data: sortedLocalRows,
    columns: tableColumns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),

    // ✅✅ 핵심: 편집으로 data(localRows)가 바뀌어도 페이지가 0으로 리셋되지 않게
    autoResetPageIndex: false,
  });

  if (loading || sortLoading || viewLoading)
    return <LoadingScreen />;

  return (
    <DashboardLayout>
      {/* 상단 네비 여백 가림 영역 */}
      <MDBox
        sx={(theme2) => ({
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "12px",
          backgroundColor: theme2.palette.background.default,
          zIndex: 1099,
          pointerEvents: "none",
        })}
      />
      <DashboardNavbar title="🏢 고객사 목록" />

      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
            {/* 상단 select + 저장 + 추가 버튼 */}
            <MDBox
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                my: 1,
                mx: 1,
              }}
            >
              <TextField
                select
                size="small"
                value={selectedDelYn}
                onChange={handledelynChange}
                sx={{
                  minWidth: 90,
                  flex: "1 1 130px",
                  maxWidth: 150,
                }}
                SelectProps={{ native: true }}
              >
                {/* ✅ 삭제여부 조회: 전체(N+Y) / 정상(N) / 삭제(Y) */}
                <option value="ALL">전체(삭제여부)</option>
                <option value="N">정상</option>
                <option value="Y">삭제</option>
              </TextField>

              <TextField
                select
                size="small"
                onChange={onSearchList}
                sx={{
                  minWidth: 90,
                  flex: "1 1 130px",
                  maxWidth: 150,
                }}
                SelectProps={{ native: true }}
                value={selectedType}
              >
                <option value="0">전체(업장구분)</option>
                <option value="1">요양원</option>
                <option value="4">산업체</option>
                <option value="5">학교</option>
              </TextField>

              <TextField
                select
                size="small"
                value={accountSortKey}
                onChange={handleSortChange}
                sx={{
                  minWidth: 90,
                  flex: "1 1 130px",
                  maxWidth: 150,
                }}
                SelectProps={{ native: true }}
              >
                <option value="account_name">거래처명 정렬</option>
                <option value="account_id">거래처ID 정렬</option>
              </TextField>

              <MDButton
                variant="gradient"
                color="info"
                onClick={handleSaveAll}
                sx={{
                  minWidth: isMobile ? 100 : 110,
                  fontSize: isMobile ? "11px" : "13px",
                }}
              >
                변경 저장
              </MDButton>

              <MDButton
                variant="gradient"
                color="info"
                onClick={handleModalOpen}
                sx={{
                  minWidth: isMobile ? 100 : 110,
                  fontSize: isMobile ? "11px" : "13px",
                }}
              >
                거래처 추가
              </MDButton>
            </MDBox>

            {/* 테이블 */}
            <MDBox
              pt={0}
              sx={{
                overflowX: "auto",
                "& table": { borderCollapse: "collapse", width: "max-content", minWidth: "100%" },
                "& th, & td": {
                  border: "1px solid #ddd",
                  textAlign: "center",
                  padding: "2px 2px",
                  whiteSpace: "nowrap",
                  fontSize: "12px",
                  lineHeight: 1.1,
                },
                "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 10 },
                "& td:first-of-type, & th:first-of-type": {
                  position: "sticky",
                  left: 0,
                  background: "#f0f0f0",
                  zIndex: 20,
                },
              }}
            >
              <table className="accountsheet-table">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          style={{
                            padding:
                              isCompactTable && paddedMobileColumnSet.has(header.column.id)
                                ? "2px 6px"
                                : undefined,
                          }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          style={{
                            padding:
                              isCompactTable && paddedMobileColumnSet.has(cell.column.id)
                                ? "2px 6px"
                                : undefined,
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </MDBox>

            {/* 페이지네이션 */}
            <MDBox display="flex" justifyContent="space-between" alignItems="center" p={1}>
              <MDBox>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                  sx={{ mr: 1, color: "#000000" }}
                >
                  이전
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                  sx={{ mr: 1, color: "#000000" }}
                >
                  다음
                </Button>
              </MDBox>

              <MDTypography variant="button" fontWeight="regular">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 페이지
              </MDTypography>

              <MDBox display="flex" alignItems="center">
                <MDTypography variant="button" mr={1}>
                  표시 개수:
                </MDTypography>
                <Select
                  size="small"
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                >
                  {[10, 15, 20].map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </MDBox>
            </MDBox>
          </Card>
        </Grid>
      </Grid>

      {/* 등록 모달 */}
      <Modal open={open} onClose={handleModalClose}>
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
          <Typography variant="h6" gutterBottom>
            거래처 등록
          </Typography>

          <TextField
            fullWidth
            margin="normal"
            label="거래처명"
            name="account_name"
            value={formData.account_name}
            onChange={handleChange}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
          />

          <Box display="flex" gap={1}>
            <TextField
              fullWidth
              margin="normal"
              label="주소"
              name="account_address"
              value={formData.account_address}
              onChange={handleChange}
              InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            />
            <Button
              variant="contained"
              onClick={() => setAddrOpen(true)}
              sx={{
                mt: 2,
                padding: "1px 5px",
                margin: "15px 0px 27px",
                color: "#ffffff",
                bgcolor: "#009439",
                "&:hover": { bgcolor: "#009439", color: "#ffffff" },
              }}
            >
              주소찾기
            </Button>
          </Box>

          <TextField
            fullWidth
            margin="normal"
            label="상세주소"
            name="account_address_detail"
            value={formData.account_address_detail}
            onChange={handleChange}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
          />

          <TextField
            fullWidth
            margin="normal"
            label="연락처"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
          />

          <Box display="flex" gap={2}>
            <TextField
              select
              fullWidth
              margin="normal"
              name="account_type"
              value={formData.account_type}
              onChange={handleChange}
              SelectProps={{ native: true }}
            >
              <option value="">선택</option>
              <option value="1">요양원</option>
              <option value="4">산업체</option>
              <option value="5">학교</option>
            </TextField>

            <TextField
              select
              fullWidth
              margin="normal"
              name="meal_type"
              value={formData.meal_type}
              onChange={handleChange}
              SelectProps={{ native: true }}
            >
              <option value="">선택</option>
              <option value="1">요양주간</option>
              <option value="2">요양직원</option>
              <option value="3">요양</option>
              <option value="4">주간보호</option>
              <option value="5">산업체</option>
            </TextField>

            <TextField
              fullWidth
              margin="normal"
              label="필요조리인력"
              name="account_rqd_member"
              value={formData.account_rqd_member}
              onChange={handleChange}
              InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            />

            <TextField
              fullWidth
              margin="normal"
              label="현재인력"
              name="account_headcount"
              value={formData.account_headcount}
              onChange={handleChange}
              InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            />
          </Box>

          <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={handleModalClose}
              sx={{
                bgcolor: "#e8a500",
                color: "#ffffff",
                "&:hover": { bgcolor: "#e8a500", color: "#ffffff" },
              }}
            >
              취소
            </Button>
            <Button variant="contained" onClick={handleSubmit} sx={{ color: "#ffffff" }}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 주소 검색 모달 */}
      <Modal open={addrOpen} onClose={() => setAddrOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "background.paper",
            p: 2,
          }}
        >
          <DaumPostcode onComplete={handleAddressSelect} />
        </Box>
      </Modal>
    </DashboardLayout>
  );
}
