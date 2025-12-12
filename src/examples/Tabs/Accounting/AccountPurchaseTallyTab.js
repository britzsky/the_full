// src/layouts/account/AccountPurchaseDeadlineTab.js
/* eslint-disable react/function-component-definition */
import React, { useState, useMemo, useEffect } from "react";
import {
  Grid,
  TextField,
  useTheme,
  useMediaQuery,
  Box,
  IconButton,
  Modal,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import Swal from "sweetalert2";
import api from "api/api";
import { API_BASE_URL } from "config";
import useAccountPurchaseTallyData from "./accountPurchaseTallyData";

function AccountPurchaseTallyTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // 🔹 오늘 날짜 (YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);

  // ✅ 조회조건 상태
  const [filters, setFilters] = useState({
    type: "1", // 타입
    fromDate: todayStr,
    toDate: todayStr,
    account_id: "", // 거래처 (account_id)
    payType: "1", // 조회구분
  });

  // 🔹 상단 거래처(사업장) select용 리스트
  const [accountList, setAccountList] = useState([]);

  // 🔹 이미지 미리보기 모달 상태
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");

  const handlePreviewOpen = (src) => {
    setPreviewImage(src);
    setPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setPreviewImage("");
  };

  // 🔹 증빙자료 없을 때 클릭 시 안내
  const handleNoImageAlert = () => {
    Swal.fire("이미지 없음", "등록된 증빙자료가 없습니다.", "warning");
  };

  // ✅ 데이터 훅 사용
  const {
    rows,
    setRows,
    originalRows,
    loading,
    fetchPurchaseList,
  } = useAccountPurchaseTallyData();

  // ✅ 최초 로딩 시: 거래처 목록 조회 + 첫 번째 거래처 자동 선택 & 자동 조회
  useEffect(() => {
    api
      .get("/Account/AccountList", {
        params: { account_type: "0" },
      })
      .then((res) => {
        const list = (res.data || []).map((item) => ({
          account_id: item.account_id,
          account_name: item.account_name,
        }));
        setAccountList(list);

        if (list.length > 0) {
          const firstId = list[0].account_id;
          setFilters((prev) => {
            const next = { ...prev, account_id: firstId };
            // 🔹 첫 번째 거래처로 바로 조회
            fetchPurchaseList(next);
            return next;
          });
        }
      })
      .catch((err) => console.error("데이터 조회 실패 (AccountList):", err));
  }, []);

  // ✅ 조회조건 변경
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev, [name]: value };

      // 🔹 거래처 select 변경 시는 즉시 재조회 (account_id 기준)
      if (name === "account_id") {
        fetchPurchaseList(next);
      }

      return next;
    });
  };

  // ✅ 조회 버튼 클릭 (다른 조건 변경 후 수동조회)
  const handleSearch = async () => {
    try {
      await fetchPurchaseList(filters);
    } catch (e) {
      Swal.fire("오류", e.message, "error");
    }
  };

  // ✅ 변경 감지 스타일
  const normalize = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value)
        ? { color: "red" }
        : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r))
    );
  };

  const tableSx = {
    flex: 1,
    minHeight: 0,
    overflowX: "auto", // 🔹 가로 스크롤
    overflowY: "auto",
    maxHeight: isMobile ? "calc(100vh - 260px)" : "none",
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
      backgroundColor: "#fef6e4",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& input[type='text'], & input[type='date']": {
      fontSize: "12px",
      padding: "4px",
      border: "none",
      background: "transparent",
      textAlign: "center",
    },
  };

  const columns = useMemo(
    () => [
      { header: "사업장", accessorKey: "account_name", size: 120 },
      { header: "날짜", accessorKey: "saleDate", size: 100 },
      { header: "상품명", accessorKey: "name", size: 180 },
      { header: "구분", accessorKey: "itemType", size: 90 },
      { header: "수량", accessorKey: "qty", size: 80 },
      { header: "단가", accessorKey: "unitPrice", size: 80 },
      { header: "금액", accessorKey: "amount", size: 80 },
      { header: "VAT", accessorKey: "taxType", size: 90 },
      { header: "증빙자료사진", accessorKey: "receipt_image", size: 200 },
      { header: "기타", accessorKey: "note", size: 200 },
    ],
    []
  );

  if (loading) return <LoadingScreen />;

  // 🔹 미리보기용 이미지 URL (상대경로 → 절대경로)
  const previewSrc = previewImage ? `${API_BASE_URL}${previewImage}` : "";

  return (
    <>
      {/* 🔹 조회조건 영역 */}
      <MDBox
        display="flex"
        flexWrap={isMobile ? "wrap" : "nowrap"}
        flexDirection={isMobile ? "column" : "row"}
        justifyContent={isMobile ? "flex-start" : "flex-end"}
        alignItems={isMobile ? "stretch" : "center"}
        gap={isMobile ? 1 : 2}
        my={1}
        mx={1}
        sx={{
          position: "sticky",
          top: 75,
          zIndex: 10,
          backgroundColor: "#ffffff",
          padding: isMobile ? 1 : 2,
          borderRadius: isMobile ? 1 : 2,
        }}
      >
        <TextField
          select
          label="타입"
          size="small"
          name="type"
          onChange={handleFilterChange}
          sx={{ minWidth: isMobile ? 120 : 150 }}
          SelectProps={{ native: true }}
          value={filters.type}
        >
          <option value="1">위탁급식</option>
          <option value="2">도소매</option>
          <option value="3">프랜차이즈</option>
          <option value="4">산업체</option>
        </TextField>

        <TextField
          type="date"
          name="fromDate"
          value={filters.fromDate}
          onChange={handleFilterChange}
          size="small"
          label="조회기간(From)"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: isMobile ? 150 : 170 }}
        />

        <TextField
          type="date"
          name="toDate"
          value={filters.toDate}
          onChange={handleFilterChange}
          size="small"
          label="조회기간(To)"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: isMobile ? 150 : 170 }}
        />

        {/* 🔹 거래처(사업장) select - account_id 사용 */}
        <TextField
          select
          label="거래처"
          size="small"
          name="account_id"
          onChange={handleFilterChange}
          sx={{ minWidth: isMobile ? 160 : 180 }}
          SelectProps={{ native: true }}
          value={filters.account_id}
        >
          {accountList.length === 0 ? (
            <option value="">사업장 선택</option>
          ) : (
            accountList.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.account_name}
              </option>
            ))
          )}
        </TextField>

        <TextField
          select
          label="조회구분"
          size="small"
          name="payType"
          onChange={handleFilterChange}
          sx={{ minWidth: isMobile ? 120 : 150 }}
          SelectProps={{ native: true }}
          value={filters.payType}
        >
          <option value="1">현금</option>
          <option value="2">카드</option>
        </TextField>

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSearch}
          sx={{ minWidth: isMobile ? 90 : 100, fontSize: isMobile ? "11px" : "13px" }}
        >
          조회
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          sx={{ minWidth: isMobile ? 90 : 110, fontSize: isMobile ? "11px" : "13px" }}
        >
          엑셀다운로드
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          sx={{ minWidth: isMobile ? 70 : 90, fontSize: isMobile ? "11px" : "13px" }}
        >
          인쇄
        </MDButton>
      </MDBox>

      {/* 🔹 테이블 */}
      <MDBox pt={0} pb={2} sx={tableSx}>
        <MDBox
          py={1}
          px={1}
          pt={1}
          variant="gradient"
          bgColor="info"
          borderRadius="lg"
          coloredShadow="info"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 3,
          }}
        >
          <MDTypography variant="h6" color="white">
            매입 집계용
          </MDTypography>
        </MDBox>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.accessorKey} style={{ minWidth: col.size }}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      style={{ textAlign: "center", padding: "12px" }}
                    >
                      데이터가 없습니다. 조회 조건을 선택한 후 [조회] 버튼을 눌러주세요.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {columns.map((col) => {
                        const key = col.accessorKey;
                        const value = row[key] ?? "";

                        // 🔹 taxType 컬럼은 select로 표시 (1=과세, 2=면세, 3=알수없음)
                        if (key === "taxType") {
                          return (
                            <td
                              key={key}
                              style={{
                                ...getCellStyle(rowIndex, key, value),
                                width: `${col.size}px`,
                              }}
                            >
                              <select
                                value={value}
                                onChange={(e) =>
                                  handleCellChange(rowIndex, key, e.target.value)
                                }
                                style={{
                                  fontSize: "12px",
                                  border: "none",
                                  background: "transparent",
                                  textAlign: "center",
                                  width: "100%",
                                }}
                              >
                                <option value="1">과세</option>
                                <option value="2">면세</option>
                                <option value="2">알수없음</option>
                              </select>
                            </td>
                          );
                        }

                        // 🔹 itemType 컬럼은 select로 표시 (1=식재료, 2=소모품, 3=알수없음)
                        if (key === "itemType") {
                          return (
                            <td
                              key={key}
                              style={{
                                ...getCellStyle(rowIndex, key, value),
                                width: `${col.size}px`,
                              }}
                            >
                              <select
                                value={value}
                                onChange={(e) =>
                                  handleCellChange(rowIndex, key, e.target.value)
                                }
                                style={{
                                  fontSize: "12px",
                                  border: "none",
                                  background: "transparent",
                                  textAlign: "center",
                                  width: "100%",
                                }}
                              >
                                <option value="1">식재료</option>
                                <option value="2">소모품</option>
                                <option value="2">알수없음</option>
                              </select>
                            </td>
                          );
                        }

                        // 🔹 증빙자료사진 컬럼: 다운로드 + 미리보기 아이콘
                        if (key === "receipt_image") {
                          const hasImage = !!value;

                          return (
                            <td
                              key={key}
                              style={{
                                ...getCellStyle(rowIndex, key, value),
                                width: `${col.size}px`,
                              }}
                            >
                              <Box
                                display="flex"
                                justifyContent="center"
                                alignItems="center"
                                gap={0.5}
                              >
                                {/* 다운로드 아이콘 */}
                                <IconButton
                                  size="small"
                                  component={hasImage ? "a" : "button"}
                                  href={hasImage ? `${API_BASE_URL}${value}` : undefined}
                                  target={hasImage ? "_blank" : undefined}
                                  rel={hasImage ? "noopener noreferrer" : undefined}
                                  onClick={
                                    hasImage
                                      ? undefined
                                      : handleNoImageAlert
                                  }
                                  color={hasImage ? "primary" : "error"} // 🔵/🔴
                                  sx={{ padding: "3px", lineHeight: 0 }}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>

                                {/* 미리보기 아이콘 */}
                                <IconButton
                                  size="small"
                                  onClick={
                                    hasImage
                                      ? () => handlePreviewOpen(value)
                                      : handleNoImageAlert
                                  }
                                  color={hasImage ? "primary" : "error"} // 🔵/🔴
                                  sx={{ padding: "3px", lineHeight: 0 }}
                                >
                                  <ImageSearchIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </td>
                          );
                        }

                        // 🔹 기본 텍스트 / 수정 가능 셀
                        return (
                          <td
                            key={key}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) =>
                              handleCellChange(rowIndex, key, e.target.innerText)
                            }
                            style={{
                              ...getCellStyle(rowIndex, key, value),
                              width: `${col.size}px`,
                            }}
                          >
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Grid>
        </Grid>
      </MDBox>

      {/* 🔍 이미지 미리보기 모달 */}
      <Modal open={previewOpen} onClose={handlePreviewClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 2,
          }}
        >
          {previewSrc && (
            <img
              src={previewSrc}
              alt="영수증 미리보기"
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                borderRadius: 8,
                objectFit: "contain",
              }}
            />
          )}
        </Box>
      </Modal>
    </>
  );
}

export default AccountPurchaseTallyTab;
