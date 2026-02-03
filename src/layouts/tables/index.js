/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import { Modal, Box, Typography, Button, TextField, Select, MenuItem } from "@mui/material";

import PropTypes from "prop-types";
import MDBox from "components/MDBox";
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
  const [selectedType, setSelectedType] = useState("0");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 22 });

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

  // ✅ 데이터 조회 Hook
  const { columns, rows, loading } = useTableData(selectedType, refreshKey);

  // =========================
  // ✅ 값 정리 유틸 (rows에 ReactElement가 섞여있을 수 있어서)
  // =========================
  const toPlainText = useCallback((v) => {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);

    // ✅ React import를 했으니 안전
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

  // =========================
  // ✅ rows를 로컬 편집용으로 복사
  // =========================
  const [localRows, setLocalRows] = useState([]);

  // ✅ 원래값 저장(빨간색 비교용)
  const [originalMap, setOriginalMap] = useState({});

  useEffect(() => {
    const base = Array.isArray(rows) ? rows : [];
    const next = base.map((r, idx) => {
      const accountId = r?.account_id;
      const rowKey =
        accountId != null && String(accountId) !== "" ? String(accountId) : `row-${idx}`;

      return {
        ...r,
        _rowKey: rowKey,
        account_rqd_member: toNumberString(toPlainText(r?.account_rqd_member)),
        account_headcount: toNumberString(toPlainText(r?.account_headcount)),
        del_yn: (toPlainText(r?.del_yn) || "N").toUpperCase(), // ✅ 추가
      };
    });

    // ✅ localRows 세팅
    setLocalRows(next);

    // ✅ originalMap 세팅(원래값)
    const om = {};
    next.forEach((r) => {
      om[r._rowKey] = {
        account_rqd_member: String(r.account_rqd_member ?? ""),
        account_headcount: String(r.account_headcount ?? ""),
        del_yn: String(r.del_yn ?? "N").toUpperCase(), // ✅ 추가
      };
    });
    setOriginalMap(om);

    // ✅ 서버 rows가 바뀌었을 때(필터/조회 변경)는 페이지 0
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [rows, toPlainText, toNumberString]);

  // ✅ 수정된 값만 따로 (rowKey 기준)
  const [editedMap, setEditedMap] = useState({});

  useEffect(() => {
    setEditedMap({});
  }, [selectedType]);

  const onSearchList = (e) => setSelectedType(e.target.value);

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
    const value = editedMap?.[rowKey]?.[field] ?? base;

    const org = originalMap?.[rowKey]?.[field] ?? "";
    const isDirtyCell = String(value ?? "") !== String(org ?? "");

    return (
      <TextField
        value={value}
        onChange={(e) => updateEditableField(rowKey, accountId, field, e.target.value)}
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
  const tableColumns = useMemo(() => {
    return (columns || []).map((col) => {
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
    data: localRows,
    columns: tableColumns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),

    // ✅✅ 핵심: 편집으로 data(localRows)가 바뀌어도 페이지가 0으로 리셋되지 않게
    autoResetPageIndex: false,
  });

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <DashboardNavbar title="🏢 고객사 목록" />

      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
            {/* 상단 select + 저장 + 추가 버튼 */}
            <MDBox
              display="flex"
              justifyContent="flex-end"
              alignItems="center"
              gap={2}
              my={1}
              mx={1}
            >
              <TextField
                select
                size="small"
                onChange={onSearchList}
                sx={{ minWidth: 150 }}
                SelectProps={{ native: true }}
                value={selectedType}
              >
                <option value="0">전체</option>
                <option value="1">요양원</option>
                <option value="4">산업체</option>
                <option value="5">학교</option>
              </TextField>

              {/* ✅ 전체 저장 버튼 */}
              <Button
                variant="contained"
                onClick={handleSaveAll}
                sx={{
                  height: "2.25rem",
                  bgcolor: "#1976d2",
                  color: "#fff",
                  "&:hover": { bgcolor: "#1565c0" },
                }}
              >
                변경 저장
              </Button>

              {/* 등록 버튼 */}
              <MDBox
                display="flex"
                justifyContent="center"
                alignItems="center"
                width="2.25rem"
                height="2.25rem"
                bgColor="white"
                shadow="sm"
                borderRadius="50%"
                color="warning"
                sx={{ cursor: "pointer" }}
                onClick={handleModalOpen}
              >
                <Icon fontSize="large" color="inherit">
                  add
                </Icon>
              </MDBox>
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
                        <th key={header.id}>
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
                        <td key={cell.id}>
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
