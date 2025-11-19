// table/index.js
import React, { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useLocation  } from "react-router-dom";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import { Modal, Box, Typography, Button, TextField, Select, MenuItem } from "@mui/material";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";

import DaumPostcode from "react-daum-postcode";
import authorsTableData from "layouts/directmanagement/data/authorsTableData";

import api from "api/api";
import Swal from "sweetalert2";
import "./tables.css";

function DirectTable() {
  const { columns, rows } = authorsTableData();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const account_name = queryParams.get("name");

  // react-table 컬럼 정의 변환
  const tableColumns = useMemo(
    () =>
      columns.map((col) => ({
        header: col.Header,
        accessorKey: col.accessor,
        cell: (info) => info.getValue(),
      })),
    [columns]
  );

  // ✅ 페이징 상태
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 23,
  });

  // react-table 객체 생성
  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // 모달 상태
  const [open, setOpen] = useState(false);
  const handleModalOpen = () => setOpen(true);

  const [formData, setFormData] = useState({
    account_name: "",
    account_address: "",
    account_address_detail: "",
    phone: "",
    account_rqd_member: "",
    account_headcount: "",
    account_type: "",
  });

  const handleModalClose = () => {
    setFormData({
      account_name: "",
      account_address: "",
      account_address_detail: "",
      phone: "",
      account_rqd_member: "",
      account_headcount: "",
    });
    setOpen(false);
  };

  // 주소검색 모달 상태
  const [addrOpen, setAddrOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressSelect = (data) => {
    setFormData((prev) => ({ ...prev, account_address: data.address }));
    setAddrOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.account_name || !formData.account_address || !formData.phone) {
      Swal.fire({
        title: "경고",
        text: "필수항목을 확인하세요.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      return;
    }
    api
      .post("/Account/AccountSave", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((response) => {
        if (response.data.code === 200) {
          Swal.fire({
            title: "저장",
            text: "저장되었습니다.",
            icon: "success",
            confirmButtonColor: "#d33",
            confirmButtonText: "확인",
          }).then((result) => {
            if (result.isConfirmed) {
              handleModalClose();
              setOpen(false);
            }
          });
        }
      })
      .catch(() => {
        Swal.fire({
          title: "실패",
          text: "저장을 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      });
  };

  return (
    <DashboardLayout>
      {/* <DashboardNavbar /> */}
      <Grid container spacing={6}>
        {/* 거래처 테이블 */}
        <Grid item xs={12}>
          <Card>
            <MDBox
              mx={0}
              mt={0}
              py={1}
              px={2}
              variant="gradient"
              bgColor="info"
              borderRadius="lg"
              coloredShadow="info"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <MDTypography variant="h6" color="white">
                거래처
              </MDTypography>
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

            <MDBox
              pt={0}
              sx={{
                overflowX: "auto",
                "& table": {
                  borderCollapse: "collapse",
                  width: "max-content",
                  minWidth: "100%",
                },
                "& th, & td": {
                  border: "1px solid #ddd",
                  textAlign: "center",
                  padding: "6px",
                  whiteSpace: "nowrap",
                },
                "& th": {
                  backgroundColor: "#f0f0f0",
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                },
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
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </MDBox>

            {/* ✅ 페이지네이션 UI */}
            <MDBox
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              p={1}
            >
              {/* 이전/다음 버튼 */}
              <MDBox sx={{color: "black"}}>
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

              {/* 현재 페이지 정보 */}
              <MDTypography variant="button" fontWeight="regular">
                {table.getState().pagination.pageIndex + 1} /{" "}
                {table.getPageCount()} 페이지
              </MDTypography>

              {/* 페이지 사이즈 선택 */}
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
          />
          <Box display="flex" gap={1}>
            <TextField
              fullWidth
              margin="normal"
              label="주소"
              name="account_address"
              value={formData.account_address}
              onChange={handleChange}
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
                "&:hover": {
                  bgcolor: "#009439",
                  color: "#ffffff",
                },
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
          />
          <TextField
            fullWidth
            margin="normal"
            label="연락처"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
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
              <option value="1">위탁급식</option>
              <option value="2">도소매</option>
              <option value="3">프랜차이즈</option>
              <option value="4">산업체</option>
            </TextField>
            <TextField
              fullWidth
              margin="normal"
              label="필수인원"
              name="account_rqd_member"
              value={formData.account_rqd_member}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="현재인원"
              name="account_headcount"
              value={formData.account_headcount}
              onChange={handleChange}
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
            <Button
              variant="contained"
              onClick={handleSubmit}
              sx={{ color: "#ffffff" }}
            >
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

export default DirectTable;
