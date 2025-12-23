/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import {
  Modal,
  Box,
  Typography,
  Button,
  TextField,
  useTheme,
  useMediaQuery,
} from "@mui/material";

import useCookWearManagerData, { parseNumber } from "./cookWearData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";

function CookWearTabStyled() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [selectedAccount, setSelectedAccount] = useState("");

  const {
    cookWearRows,
    cookWearOutRows,
    cookWearNewRows,
    accountList,
    loading,

    stockLoaded,
    outLoaded,
    newLoaded,

    fetchCookWearList,
    fetchCookWearOutList,
    fetchCookWearNewList,
    fetchAccountList,
    setCookWearRows,
    setCookWearOutRows,
    setCookWearNewRows,
  } = useCookWearManagerData();

  // ✅ 원본 데이터(스냅샷) - "조회 완료 시점"에만 세팅
  const [originalRows1, setOriginalRows1] = useState([]);
  const [originalRows2, setOriginalRows2] = useState([]);
  const [originalRows3, setOriginalRows3] = useState([]);
  const needOriginalSyncRef = useRef(true);

  const [open, setOpen] = useState(false);

  // ✅ 품목 등록 폼 (type_name, current_qty)
  const [formData, setFormData] = useState({
    type_name: "",
    current_qty: "",
  });

  // =========================================
  // 최초 로딩
  // =========================================
  useEffect(() => {
    const init = async () => {
      needOriginalSyncRef.current = true;
      await fetchAccountList();
      await Promise.all([
        fetchCookWearList(),
        fetchCookWearOutList(),
        fetchCookWearNewList(),
      ]);
    };
    init();
  }, []);

  // account 기본 선택
  useEffect(() => {
    if (accountList.length > 0 && !selectedAccount) {
      setSelectedAccount(accountList[0].account_id);
    }
  }, [accountList]);

  // ✅ 3개 테이블이 전부 로드 완료 되었을 때만 원본 스냅샷 저장
  useEffect(() => {
    if (!needOriginalSyncRef.current) return;
    if (!stockLoaded || !outLoaded || !newLoaded) return;

    setOriginalRows1((cookWearRows || []).map((r) => ({ ...r })));
    setOriginalRows2((cookWearOutRows || []).map((r) => ({ ...r })));
    setOriginalRows3((cookWearNewRows || []).map((r) => ({ ...r })));
    needOriginalSyncRef.current = false;
  }, [
    stockLoaded,
    outLoaded,
    newLoaded,
    cookWearRows,
    cookWearOutRows,
    cookWearNewRows,
  ]);

  // =========================================
  // ✅ 사이즈 옵션: value=type / label=type_name
  // (조회 데이터에 있는 type_name 기반)
  // =========================================
  const sizeOptions = useMemo(() => {
    const base = (originalRows1?.length ? originalRows1 : cookWearRows) || [];
    const map = new Map();

    base.forEach((r) => {
      const type = r?.type;
      const name = r?.type_name;
      if (type === undefined || type === null || String(type) === "") return;
      map.set(String(type), name || String(type));
    });

    // out/new 쪽에도 혹시 type_name이 있으면 합쳐줌(안전)
    (cookWearOutRows || []).forEach((r) => {
      const type = r?.type;
      const name = r?.type_name;
      if (!type) return;
      if (!map.has(String(type))) map.set(String(type), name || String(type));
    });
    (cookWearNewRows || []).forEach((r) => {
      const type = r?.type;
      const name = r?.type_name;
      if (!type) return;
      if (!map.has(String(type))) map.set(String(type), name || String(type));
    });

    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [cookWearRows, cookWearOutRows, cookWearNewRows, originalRows1]);

  const normalize = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

  const getCellStyle = (originalRows) => (rowIndex, key, value) => {
    if (originalRows[rowIndex] === undefined) return { color: "red" }; // 새 행
    const original = originalRows[rowIndex]?.[key];

    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value)
        ? { color: "red" }
        : { color: "black" };
    }
    return String(original ?? "") !== String(value ?? "")
      ? { color: "red" }
      : { color: "black" };
  };

  const tableSx = {
    flex: 1,
    minHeight: 0,
    maxHeight: isMobile ? "40vh" : "60vh",
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

  /**
   * ✅ 핵심: "원본(조회값)"은 건드리지 않고,
   * out/new 테이블에서 변경된 것(현재 - 원본)만 Δ로 계산해서
   * 재고현황을 "원본 + Δ" 로 미리보기만 만든다.
   */
  const stockViewRows = useMemo(() => {
    const base = (originalRows1.length ? originalRows1 : cookWearRows) || [];

    const deltaOutByType = {};
    const deltaNewByType = {};

    // out delta 계산 (현재 - 원본)
    (cookWearOutRows || []).forEach((row, i) => {
      const type = String(row.type || "");
      if (!type) return;

      const cur = parseNumber(row.out_qty);
      const orig = parseNumber(originalRows2[i]?.out_qty); // 원본 없으면 0
      const delta = cur - orig;

      deltaOutByType[type] = (deltaOutByType[type] || 0) + delta;
    });

    // new delta 계산 (현재 - 원본)
    (cookWearNewRows || []).forEach((row, i) => {
      const type = String(row.type || "");
      if (!type) return;

      const cur = parseNumber(row.new_qty);
      const orig = parseNumber(originalRows3[i]?.new_qty);
      const delta = cur - orig;

      deltaNewByType[type] = (deltaNewByType[type] || 0) + delta;
    });

    return base.map((r) => {
      const type = String(r.type || "");
      const baseNew = parseNumber(r.new_qty);
      const baseOut = parseNumber(r.out_qty);
      const baseRemain = parseNumber(r.remain_qty);

      const dNew = deltaNewByType[type] || 0;
      const dOut = deltaOutByType[type] || 0;

      const viewNew = baseNew + dNew;
      const viewOut = baseOut + dOut;
      const viewRemain = baseRemain + dNew - dOut;

      return {
        ...r,
        new_qty: viewNew.toLocaleString(),
        out_qty: viewOut.toLocaleString(),
        remain_qty: viewRemain.toLocaleString(),
      };
    });
  }, [
    cookWearRows,
    cookWearOutRows,
    cookWearNewRows,
    originalRows1,
    originalRows2,
    originalRows3,
  ]);

  // ✅ out/new 값만 변경
  const handleCellChange = (setRows) => (rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) =>
        idx === rowIndex ? { ...row, [key]: value } : row
      )
    );
  };

  // =========================================
  // ✅ 공통 저장 함수 (CookWearSave 호출)
  // =========================================
  const postCookWearSave = useCallback(async (payload) => {
    const response = await api.post("/Business/CookWearSave", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return response;
  }, []);

  // =========================================
  // ✅ 메인 저장
  // =========================================
  const handleSave = async () => {
    try {
      const formattedOutList = cookWearOutRows.map((row) => ({
        ...row,
        item: row.item,
        type: row.type,
        account_id: row.account_id,
      }));

      const formattedNewList = cookWearNewRows.map((row) => ({
        ...row,
        item: row.item,
        type: row.type,
        account_id: row.account_id,
      }));

      const payload = {
        stockList: { list: stockViewRows },
        outList: { list: formattedOutList },
        newList: { list: formattedNewList },
      };

      const response = await postCookWearSave(payload);

      if (response.data.code === 200) {
        await Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        needOriginalSyncRef.current = true;
        await Promise.all([
          fetchCookWearList(),
          fetchCookWearOutList(),
          fetchCookWearNewList(),
        ]);
      }
    } catch (error) {
      Swal.fire({
        title: "실패",
        text: error.message || "저장 중 오류 발생",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  // =========================================
  // ✅ 품목등록 모달 저장 함수 (요구사항)
  // - CookWearSave로 저장
  // =========================================
  const handleRegisterItemSave = async () => {
    try {
      const name = (formData.type_name || "").trim();
      const qty = parseNumber(formData.current_qty);

      if (!name) {
        Swal.fire("품목명(type_name)을 입력하세요.", "", "warning");
        return;
      }

     const response = await api.post("/Business/CookWearSaveV2", formData, {
      headers: { "Content-Type": "application/json" },
    });

      if (response.data.code === 200) {
        await Swal.fire({
          title: "저장",
          text: "품목이 등록되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        setOpen(false);
        setFormData({ type_name: "", current_qty: "" });

        needOriginalSyncRef.current = true;
        await Promise.all([
          fetchCookWearList(),
          fetchCookWearOutList(),
          fetchCookWearNewList(),
        ]);
      } else {
        Swal.fire("실패", response.data.message || "등록 실패", "error");
      }
    } catch (error) {
      Swal.fire("실패", error.message || "등록 중 오류 발생", "error");
    }
  };

  const columns1 = useMemo(
    () => [
      { header: "사이즈", accessorKey: "type", type: "selectItem" },
      { header: "현재고", accessorKey: "current_qty" },
      { header: "주문갯수", accessorKey: "new_qty" },
      { header: "분출갯수", accessorKey: "out_qty" },
      { header: "현재갯수", accessorKey: "remain_qty" },
      { header: "이전재고", accessorKey: "before_qty" },
    ],
    []
  );

  const columns2 = useMemo(
    () => [
      { header: "사이즈", accessorKey: "type", type: "selectItem" },
      { header: "출고일자", accessorKey: "out_dt", type: "date" },
      { header: "분출갯수", accessorKey: "out_qty", type: "text" },
      { header: "거래처", accessorKey: "account_id", type: "selectAccount" },
    ],
    []
  );

  const columns3 = useMemo(
    () => [
      { header: "사이즈", accessorKey: "type", type: "selectItem" },
      { header: "입고일자", accessorKey: "new_dt", type: "date" },
      { header: "주문갯수", accessorKey: "new_qty" },
      { header: "거래처", accessorKey: "account_id", type: "selectAccount" },
    ],
    []
  );

  if (loading) return <LoadingScreen />;

  const renderTable = (title, rows, setRows, originalRows, columns, readOnly = false) => {
    const styleFn = (rowIndex, key, value) => getCellStyle(originalRows)(rowIndex, key, value);

    const getTypeLabel = (typeValue) => {
      const found = sizeOptions.find((o) => String(o.value) === String(typeValue));
      return found?.label || "";
    };

    return (
      <MDBox pt={isMobile ? 2 : 4} pb={3} sx={tableSx}>
        <MDBox
          mx={0}
          mt={-1}
          mb={1}
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
            {title}
          </MDTypography>
        </MDBox>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.accessorKey}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((col) => {
                      const value = row[col.accessorKey] || "";

                      if (col.type === "date") {
                        return (
                          <td key={col.accessorKey}>
                            <input
                              type="date"
                              value={value}
                              disabled={readOnly}
                              style={styleFn(rowIndex, col.accessorKey, value)}
                              onChange={(e) =>
                                handleCellChange(setRows)(rowIndex, col.accessorKey, e.target.value)
                              }
                            />
                          </td>
                        );
                      }

                      // ✅ 사이즈: value=type, label=type_name
                      if (col.type === "selectItem") {
                        return (
                          <td key={col.accessorKey}>
                            {readOnly ? (
                              <span style={styleFn(rowIndex, col.accessorKey, value)}>
                                {getTypeLabel(value) || row.type_name || value}
                              </span>
                            ) : (
                              <select
                                value={value}
                                disabled={readOnly}
                                style={styleFn(rowIndex, col.accessorKey, value)}
                                onChange={(e) =>
                                  handleCellChange(setRows)(rowIndex, col.accessorKey, e.target.value)
                                }
                              >
                                <option value="">선택</option>
                                {sizeOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        );
                      }

                      if (col.type === "selectAccount") {
                        return (
                          <td key={col.accessorKey}>
                            <select
                              value={value}
                              disabled={readOnly}
                              style={styleFn(rowIndex, col.accessorKey, value)}
                              onChange={(e) =>
                                handleCellChange(setRows)(rowIndex, col.accessorKey, e.target.value)
                              }
                            >
                              {accountList.map((acc) => (
                                <option key={acc.account_id} value={acc.account_id}>
                                  {acc.account_name}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

                      return (
                        <td key={col.accessorKey}>
                          {readOnly ? (
                            <span style={styleFn(rowIndex, col.accessorKey, value)}>{value}</span>
                          ) : (
                            <input
                              type="text"
                              value={value}
                              style={styleFn(rowIndex, col.accessorKey, value)}
                              onChange={(e) =>
                                handleCellChange(setRows)(rowIndex, col.accessorKey, e.target.value)
                              }
                            />
                          )}
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
  };

  return (
    <>
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
        <MDButton
          variant="gradient"
          color="info"
          onClick={() =>
            setCookWearOutRows([
              ...cookWearOutRows,
              { type: "", type_name: "", account_id: accountList[0]?.account_id ?? "", out_qty: "", out_dt: "", note: "" },
            ])
          }
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 90 : undefined }}
        >
          분출현황 행 추가
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          onClick={() =>
            setCookWearNewRows([
              ...cookWearNewRows,
              { type: "", type_name: "", account_id: accountList[0]?.account_id ?? "", new_qty: "", new_dt: "", note: "" },
            ])
          }
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 90 : undefined }}
        >
          주문현황 행 추가
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          onClick={() => setOpen(true)}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 80 : undefined }}
        >
          품목 등록
        </MDButton>

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : undefined }}
        >
          저장
        </MDButton>
      </MDBox>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          {/* ✅ 재고현황은 stockViewRows 보여줌 */}
          {renderTable("조리복 재고현황", stockViewRows, setCookWearRows, originalRows1, columns1, true)}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderTable("조리복 분출현황", cookWearOutRows, setCookWearOutRows, originalRows2, columns2, false)}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderTable("조리복 주문현황", cookWearNewRows, setCookWearNewRows, originalRows3, columns3, false)}
        </Grid>
      </Grid>

      <Modal open={open} onClose={() => setOpen(false)}>
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
            품목 등록
          </Typography>

          <TextField
            fullWidth
            margin="normal"
            label="품목명"
            name="type_name"
            value={formData.type_name}
            onChange={(e) => setFormData({ ...formData, type_name: e.target.value })}
            InputLabelProps={{ style: { fontSize: "0.8rem" } }}
          />

          <TextField
            fullWidth
            margin="normal"
            label="현재고"
            name="current_qty"
            value={formData.current_qty}
            onChange={(e) => setFormData({ ...formData, current_qty: e.target.value })}
            InputLabelProps={{ style: { fontSize: "0.8rem" } }}
          />

          <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={() => setOpen(false)}
              sx={{
                bgcolor: "#e8a500",
                color: "#ffffff",
                "&:hover": { bgcolor: "#e8a500" },
              }}
            >
              취소
            </Button>

            {/* ✅ 모달 저장 버튼 → 별도 함수 */}
            <Button
              variant="contained"
              sx={{ color: "#ffffff" }}
              onClick={handleRegisterItemSave}
            >
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

export default CookWearTabStyled;
