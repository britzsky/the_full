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
  Menu,
  MenuItem,
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
import ExcelJS from "exceljs";
import useAccountPurchaseDeadlineData from "./accountPurchaseDeadlineData";

function AccountPurchaseDeadlineTab() {
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
  const { rows, setRows, originalRows, loading, fetchPurchaseList } =
    useAccountPurchaseDeadlineData();

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
      { header: "구매처", accessorKey: "name", size: 180 },
      { header: "부가세", accessorKey: "vat", size: 80 },
      { header: "면세", accessorKey: "taxFree", size: 80 },
      { header: "구분(현금,카드)", accessorKey: "payType", size: 90 },
      { header: "합계", accessorKey: "total", size: 80 },
      { header: "증빙자료사진", accessorKey: "receipt_image", size: 200 },
      { header: "기타", accessorKey: "note", size: 200 },
    ],
    []
  );

  // ✅ URL 조립(이미 절대경로면 그대로, 아니면 API_BASE_URL 붙임)
  const buildFileUrl = (path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    const p = String(path).startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  };

  // 🔹 미리보기용 이미지 URL
  const previewSrc = previewImage ? buildFileUrl(previewImage) : "";

  // -----------------------------
  // ✅ 엑셀 다운로드(메뉴 + 세금계산서)
  // -----------------------------
  const [excelAnchorEl, setExcelAnchorEl] = useState(null);
  const excelMenuOpen = Boolean(excelAnchorEl);

  const handleExcelMenuOpen = (e) => setExcelAnchorEl(e.currentTarget);
  const handleExcelMenuClose = () => setExcelAnchorEl(null);

  const parseNumber = (v) => {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const payTypeText = (v) => (String(v) === "2" ? "카드" : "현금");

  const getAccountName = () => {
    const found = accountList.find((a) => a.account_id === filters.account_id);
    return found?.account_name || "";
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadTaxInvoiceExcel = async () => {
    if (!rows || rows.length === 0) {
      Swal.fire("다운로드 불가", "다운로드할 데이터가 없습니다.", "warning");
      return;
    }

    // ✅ 공급받는자(우리) 정보: 현재 소스엔 bizNo/ceo가 없어서 TODO
    const buyer = {
      bizNo: "000-00-00000", // TODO: 사업장 사업자번호
      name: getAccountName() || "공급받는자(사업장)",
      ceoName: "대표자명",   // TODO: 사업장 대표자명
    };

    // 시트명 안전 처리(엑셀 31자 제한 + 특수문자 제거)
    const safeSheetName = (s) =>
      String(s || "세금계산서")
        .replace(/[\[\]\*\/\\\?\:]/g, " ")
        .trim()
        .slice(0, 31) || "세금계산서";

    // 공급가액(과세분) 추정: total = 공급가액(과세) + vat(세액) + taxFree(면세) 라는 가정
    const calcTaxableSupply = (r) => {
      const total = parseNumber(r.total);
      const vat = parseNumber(r.vat);
      const taxFree = parseNumber(r.taxFree);
      const supply = total - vat - taxFree;
      return supply > 0 ? supply : 0;
    };

    // ✅ 공급자별로 그룹핑
    const groups = new Map();
    rows.forEach((r) => {
      const supplierBizNo = (r.bizNo || "").trim();
      const supplierName = (r.name || "").trim();
      const key = `${supplierBizNo}__${supplierName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "THEFULL";

    // (선택) 목록 시트
    const listWs = wb.addWorksheet("목록");
    listWs.addRow(["공급자 사업자번호", "공급자 상호", "기간", "건수", "공급가액(과세)", "세액", "면세", "합계"]);
    listWs.getRow(1).font = { bold: true };

    // 공급자별 시트 생성
    for (const [key, items] of groups.entries()) {
      const [supplierBizNo, supplierName] = key.split("__");
      const supplierCeo = items[0]?.ceo_name || ""; // 같은 공급자면 동일하다고 가정

      // 날짜 정렬(있으면)
      items.sort((a, b) => String(a.saleDate || "").localeCompare(String(b.saleDate || "")));

      const ws = wb.addWorksheet(safeSheetName(`${supplierName || "공급자"}_세금계산서`));

      // ===== 상단 제목 =====
      ws.mergeCells("A1:I1");
      ws.getCell("A1").value = "세 금 계 산 서 (출력/보관용)";
      ws.getCell("A1").font = { bold: true, size: 16 };
      ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

      // ===== 공급자 / 공급받는자 블록 =====
      // 라벨 스타일
      const label = (addr, text) => {
        ws.getCell(addr).value = text;
        ws.getCell(addr).font = { bold: true };
        ws.getCell(addr).alignment = { horizontal: "center", vertical: "middle" };
        ws.getCell(addr).border = {
          top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
        };
        ws.getCell(addr).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2CC" } };
      };
      const box = (addr, text) => {
        ws.getCell(addr).value = text;
        ws.getCell(addr).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        ws.getCell(addr).border = {
          top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
        };
      };

      // 공급자(좌)
      label("A3", "공급자");
      label("A4", "사업자번호"); box("B4", supplierBizNo);
      label("A5", "상호(명칭)"); box("B5", supplierName);
      label("A6", "대표자");     box("B6", supplierCeo);

      // 공급받는자(우)
      label("E3", "공급받는자");
      label("E4", "사업자번호"); box("F4", buyer.bizNo);
      label("E5", "상호(명칭)"); box("F5", buyer.name);
      label("E6", "대표자");     box("F6", buyer.ceoName);

      // 조회기간/구분 표시
      label("A8", "조회기간");
      box("B8", `${filters.fromDate} ~ ${filters.toDate}`);
      label("E8", "조회구분");
      box("F8", payTypeText(filters.payType));

      // ===== 품목 테이블 =====
      const headerRowIndex = 10;
      const headers = ["일자", "품목(집계)", "수량", "단가", "공급가액(과세)", "세액", "면세", "합계", "비고"];
      ws.getRow(headerRowIndex).values = headers;
      ws.getRow(headerRowIndex).font = { bold: true };
      ws.getRow(headerRowIndex).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(headerRowIndex).height = 18;

      // 헤더 스타일
      headers.forEach((_, i) => {
        const c = ws.getRow(headerRowIndex).getCell(i + 1);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2CC" } };
        c.border = {
          top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
        };
      });

      // 데이터 rows
      let supplySum = 0;
      let vatSum = 0;
      let taxFreeSum = 0;
      let totalSum = 0;

      items.forEach((r) => {
        const supply = calcTaxableSupply(r);
        const vat = parseNumber(r.vat);
        const taxFree = parseNumber(r.taxFree);
        const total = parseNumber(r.total);

        supplySum += supply;
        vatSum += vat;
        taxFreeSum += taxFree;
        totalSum += total;

        ws.addRow([
          r.saleDate ?? "",
          "매입집계",          // 현재 데이터는 품목이 없으니 고정(원하면 r.itemName 같은 걸로 교체)
          "",                  // 수량
          "",                  // 단가
          supply,
          vat,
          taxFree,
          total,
          r.note ?? "",
        ]);
      });

      // 합계 라인
      ws.addRow(["", "합계", "", "", supplySum, vatSum, taxFreeSum, totalSum, ""]);

      // 컬럼폭
      ws.columns = [
        { width: 12 }, // 일자
        { width: 14 }, // 품목
        { width: 8 },  // 수량
        { width: 10 }, // 단가
        { width: 16 }, // 공급가액
        { width: 12 }, // 세액
        { width: 12 }, // 면세
        { width: 14 }, // 합계
        { width: 30 }, // 비고
      ];

      // 숫자 포맷 + 테두리
      ws.eachRow((row, rowNumber) => {
        if (rowNumber < headerRowIndex) return;
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
          };
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          if ([5, 6, 7, 8].includes(colNumber)) cell.numFmt = "#,##0";
        });
      });

      // 목록 시트에도 요약 추가
      listWs.addRow([
        supplierBizNo,
        supplierName,
        `${filters.fromDate}~${filters.toDate}`,
        items.length,
        supplySum,
        vatSum,
        taxFreeSum,
        totalSum,
      ]);
    }

    // 목록 숫자 포맷
    for (let r = 2; r <= listWs.rowCount; r += 1) {
      [5, 6, 7, 8].forEach((c) => (listWs.getCell(r, c).numFmt = "#,##0"));
    }
    listWs.columns = [
      { width: 16 }, { width: 22 }, { width: 24 }, { width: 8 },
      { width: 16 }, { width: 12 }, { width: 12 }, { width: 14 },
    ];

    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `세금계산서_출력용_${getAccountName() || "전체"}_${filters.fromDate}_${filters.toDate}_${ymd}.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, filename);
  };

  const handleExcelDownload = async (type) => {
    handleExcelMenuClose();

    if (type === "taxInvoice") {
      await downloadTaxInvoiceExcel();
      return;
    }

    Swal.fire("준비중", "현재는 세금계산서만 먼저 구현되어 있어요.", "info");
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 🔹 조회조건 영역 */}
      <MDBox
        display="flex"
        flexWrap={isMobile ? "wrap" : "nowrap"}
        flexDirection={isMobile ? "column" : "row"}
        justifyContent={isMobile ? "flex-start" : "flex-end"}
        alignItems={isMobile ? "stretch" : "center"}
        gap={isMobile ? 1 : 1}
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
          sx={{ minWidth: isMobile ? 100 : 120 }}
          SelectProps={{ native: true }}
          value={filters.type}
        >
          <option value="1">위탁급식</option>
          <option value="2">도소매</option>
          <option value="3">프랜차이즈</option>
          <option value="4">산업체</option>
        </TextField>
        <TextField
          select
          label="조회구분"
          size="small"
          name="payType"
          onChange={handleFilterChange}
          sx={{ minWidth: isMobile ? 100 : 120 }}
          SelectProps={{ native: true }}
          value={filters.payType}
        >
          <option value="1">현금</option>
          <option value="2">카드</option>
        </TextField>
        <TextField
          type="date"
          name="fromDate"
          value={filters.fromDate}
          onChange={handleFilterChange}
          size="small"
          label="조회기간(From)"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: isMobile ? 100 : 120 }}
        />

        <TextField
          type="date"
          name="toDate"
          value={filters.toDate}
          onChange={handleFilterChange}
          size="small"
          label="조회기간(To)"
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: isMobile ? 100 : 120 }}
        />
        {/* 🔹 거래처(사업장) select - account_id 사용 */}
        <TextField
          select
          label="거래처"
          size="small"
          name="account_id"
          onChange={handleFilterChange}
          sx={{ minWidth: isMobile ? 120 : 150 }}
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
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSearch}
          sx={{
            minWidth: isMobile ? 90 : 100,
            fontSize: isMobile ? "11px" : "13px",
          }}
        >
          조회
        </MDButton>

        {/* ✅ 엑셀다운로드: 메뉴 선택(세금계산서/계산서/간이과세) */}
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleExcelMenuOpen}
          sx={{
            minWidth: isMobile ? 90 : 110,
            fontSize: isMobile ? "11px" : "13px",
          }}
        >
          엑셀다운로드
        </MDButton>

        <Menu
          anchorEl={excelAnchorEl}
          open={excelMenuOpen}
          onClose={handleExcelMenuClose}
        >
          <MenuItem onClick={() => handleExcelDownload("taxInvoice")}>
            세금계산서
          </MenuItem>
          <MenuItem onClick={() => handleExcelDownload("invoice")}>
            계산서
          </MenuItem>
          <MenuItem onClick={() => handleExcelDownload("simple")}>
            간이과세
          </MenuItem>
        </Menu>

        <MDButton
          variant="gradient"
          color="info"
          sx={{
            minWidth: isMobile ? 70 : 90,
            fontSize: isMobile ? "11px" : "13px",
          }}
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

                        // 🔹 payType 컬럼은 select로 표시 (1=현금, 2=카드)
                        if (key === "payType") {
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
                                  handleCellChange(
                                    rowIndex,
                                    key,
                                    e.target.value
                                  )
                                }
                                style={{
                                  fontSize: "12px",
                                  border: "none",
                                  background: "transparent",
                                  textAlign: "center",
                                  width: "100%",
                                }}
                              >
                                <option value="1">현금</option>
                                <option value="2">카드</option>
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
                                  href={hasImage ? buildFileUrl(value) : undefined}
                                  target={hasImage ? "_blank" : undefined}
                                  rel={hasImage ? "noopener noreferrer" : undefined}
                                  onClick={hasImage ? undefined : handleNoImageAlert}
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
              src={encodeURI(previewSrc)}
              alt="영수증 미리보기"
              onError={() => {
                Swal.fire(
                  "미리보기 실패",
                  "이미지 경로 또는 서버 응답을 확인해주세요.",
                  "error"
                );
              }}
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

export default AccountPurchaseDeadlineTab;
