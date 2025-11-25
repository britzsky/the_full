import React, { useState, useMemo } from "react";
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender } from "@tanstack/react-table";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import { Modal, Box, Typography, Button, TextField, Select, MenuItem } from "@mui/material";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DaumPostcode from "react-daum-postcode";
import LoadingScreen from "../loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";

import HeaderWithLogout from "components/Common/HeaderWithLogout";

import useTableData from "layouts/tables/data/authorsTableData";
import "./tables.css";

export default function Tables() {
  const [selectedType, setSelectedType] = useState("0");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 22 });
  const [open, setOpen] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [formData, setFormData] = useState({
    account_name: "",
    account_address: "",
    account_address_detail: "",
    phone: "",
    account_rqd_member: "",
    account_headcount: "",
    account_type: "",
    meal_type: "",
  });

  // ✅ 데이터 조회 Hook
  const { columns, rows, loading } = useTableData(selectedType);

  const tableColumns = useMemo(
    () => columns.map((col) => ({ header: col.Header, accessorKey: col.accessor, cell: (info) => info.getValue() })),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const onSearchList = (e) => setSelectedType(e.target.value);
  const handleChange = (e) => { const { name, value } = e.target; setFormData((prev) => ({ ...prev, [name]: value })); };
  const handleModalOpen = () => setOpen(true);
  const handleModalClose = () => setFormData({ account_name: "", account_address: "", account_address_detail: "", phone: "", account_rqd_member: "", account_headcount: "", account_type: "", meal_type: "" }) || setOpen(false);
  const handleAddressSelect = (data) => { setFormData((prev) => ({ ...prev, account_address: data.address })); setAddrOpen(false); };

  const handleSubmit = () => {
    if (!formData.account_name || !formData.account_address || !formData.phone || formData.meal_type === "" || formData.account_type === "") {
      return Swal.fire({ title: "경고", text: "필수항목을 확인하세요.", icon: "error", confirmButtonColor: "#d33", confirmButtonText: "확인" });
    }
    api.post("/Account/AccountSave", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => { if (res.data.code === 200) Swal.fire({ title: "저장", text: "저장되었습니다.", icon: "success", confirmButtonColor: "#d33", confirmButtonText: "확인" }).then((result) => { if (result.isConfirmed) handleModalClose(); }); })
      .catch(() => Swal.fire({ title: "실패", text: "저장을 실패했습니다.", icon: "error", confirmButtonColor: "#d33", confirmButtonText: "확인" }));

  };

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      {/* 🔹 공통 헤더 사용 */}
      <HeaderWithLogout title="🏢 고객사 목록" />
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card>
            {/* 상단 select + 추가 버튼 */}
            <MDBox display="flex" justifyContent="flex-end" alignItems="center" gap={2} my={1} mx={1}>
              <TextField select size="small" onChange={onSearchList} sx={{ minWidth: 150 }} SelectProps={{ native: true }} value={selectedType}>
                <option value="0">전체</option>
                <option value="1">위탁급식</option>
                <option value="2">도소매</option>
                <option value="4">산업체</option>
              </TextField>
              <MDBox display="flex" justifyContent="center" alignItems="center" width="2.25rem" height="2.25rem" bgColor="white" shadow="sm" borderRadius="50%" color="warning" sx={{ cursor: "pointer" }} onClick={handleModalOpen}>
                <Icon fontSize="large" color="inherit">add</Icon>
              </MDBox>
            </MDBox>

            {/* 테이블 헤더 */}
            {/* <MDBox mx={0} mt={0} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info" display="flex" justifyContent="space-between" alignItems="center">
              <MDTypography variant="h6" color="white">거래처</MDTypography>
            </MDBox> */}

            {/* 테이블 */}
            <MDBox pt={0} sx={{ overflowX: "auto", "& table": { borderCollapse: "collapse", width: "max-content", minWidth: "100%" }, "& th, & td": { border: "1px solid #ddd", textAlign: "center", padding: "6px", whiteSpace: "nowrap" }, "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 10 }, "& td:first-of-type, & th:first-of-type": { position: "sticky", left: 0, background: "#f0f0f0", zIndex: 20 } }}>
              <table className="accountsheet-table">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>{hg.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </MDBox>

            {/* 페이지네이션 */}
            <MDBox display="flex" justifyContent="space-between" alignItems="center" p={1}>
              <MDBox>
                <Button variant="outlined" size="small" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} sx={{ mr: 1, color: "#000000" }}>이전</Button>
                <Button variant="outlined" size="small" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} sx={{ mr: 1, color: "#000000" }}>다음</Button>
              </MDBox>
              <MDTypography variant="button" fontWeight="regular">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 페이지</MDTypography>
              <MDBox display="flex" alignItems="center">
                <MDTypography variant="button" mr={1}>표시 개수:</MDTypography>
                <Select size="small" value={table.getState().pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))}>
                  {[10, 15, 20].map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
                </Select>
              </MDBox>
            </MDBox>
          </Card>
        </Grid>
      </Grid>

      {/* 등록 모달 */}
      <Modal open={open} onClose={handleModalClose}>
        <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, bgcolor: "background.paper", borderRadius: 2, boxShadow: 24, p: 5 }}>
          <Typography variant="h6" gutterBottom>거래처 등록</Typography>
          <TextField fullWidth margin="normal" label="거래처명" name="account_name" value={formData.account_name} onChange={handleChange} />
          <Box display="flex" gap={1}>
            <TextField fullWidth margin="normal" label="주소" name="account_address" value={formData.account_address} onChange={handleChange} />
            <Button variant="contained" onClick={() => setAddrOpen(true)} sx={{ mt: 2, padding: "1px 5px", margin: "15px 0px 27px", color: "#ffffff", bgcolor: "#009439", "&:hover": { bgcolor: "#009439", color: "#ffffff" } }}>주소찾기</Button>
          </Box>
          <TextField fullWidth margin="normal" label="상세주소" name="account_address_detail" value={formData.account_address_detail} onChange={handleChange} />
          <TextField fullWidth margin="normal" label="연락처" name="phone" value={formData.phone} onChange={handleChange} />
          <Box display="flex" gap={2}>
            <TextField select fullWidth margin="normal" name="account_type" value={formData.account_type} onChange={handleChange} SelectProps={{ native: true }}>
              <option value="">선택</option>
              <option value="1">위탁급식</option>
              <option value="2">도소매</option>
              <option value="3">프랜차이즈</option>
              <option value="4">산업체</option>
            </TextField>
            <TextField select fullWidth margin="normal" name="meal_type" value={formData.meal_type} onChange={handleChange} SelectProps={{ native: true }}>
              <option value="">선택</option>
              <option value="1">요양주간</option>
              <option value="2">요양직원</option>
              <option value="3">요양</option>
              <option value="4">주간보호</option>
              <option value="5">산업체</option>
            </TextField>
            <TextField fullWidth margin="normal" label="필수인원" name="account_rqd_member" value={formData.account_rqd_member} onChange={handleChange} />
            <TextField fullWidth margin="normal" label="현재인원" name="account_headcount" value={formData.account_headcount} onChange={handleChange} />
          </Box>
          <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
            <Button variant="contained" onClick={handleModalClose} sx={{ bgcolor: "#e8a500", color: "#ffffff", "&:hover": { bgcolor: "#e8a500", color: "#ffffff" } }}>취소</Button>
            <Button variant="contained" onClick={handleSubmit} sx={{ color: "#ffffff" }}>저장</Button>
          </Box>
        </Box>
      </Modal>

      {/* 주소 검색 모달 */}
      <Modal open={addrOpen} onClose={() => setAddrOpen(false)}>
        <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", bgcolor: "background.paper", p: 2 }}>
          <DaumPostcode onComplete={handleAddressSelect} />
        </Box>
      </Modal>
    </DashboardLayout>
  );
}
