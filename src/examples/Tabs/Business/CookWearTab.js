/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { Modal, Box, Typography, Button, TextField } from "@mui/material";

import useCookWearManagerData from "./cookWearData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";

function CookWearTabStyled() {
  const [selectedAccount, setSelectedAccount] = useState("");

  const {
    cookWearRows,
    cookWearOutRows,
    cookWearNewRows,
    accountList,
    loading,
    fetchCookWearList,
    fetchCookWearOutList,
    fetchCookWearNewList,
    fetchAccountList,
    setCookWearRows,
    setCookWearOutRows,
    setCookWearNewRows,
  } = useCookWearManagerData();

  // 원본 데이터
  const [originalRows1, setOriginalRows1] = useState([]);
  const [originalRows2, setOriginalRows2] = useState([]);
  const [originalRows3, setOriginalRows3] = useState([]);

  const [open, setOpen] = useState(false);

  // 등록 폼
  const [formData, setFormData] = useState({
    cook_id: "",
    cook_name: "",
  });

  // 최초 로딩
  useEffect(() => {
    const init = async () => {
      await fetchAccountList();
      await fetchCookWearList();
      await fetchCookWearOutList();
      await fetchCookWearNewList();
    };
    init();
  }, []);

  // account 기본 선택
  useEffect(() => {
    if (accountList.length > 0 && !selectedAccount) {
      setSelectedAccount(accountList[0].account_id);
    }
  }, [accountList]);

  // 원본 저장
  useEffect(() => {
    setOriginalRows1(cookWearRows.map((r) => ({ ...r })));
  }, [cookWearRows]);
  useEffect(() => {
    setOriginalRows2(cookWearOutRows.map((r) => ({ ...r })));
  }, [cookWearOutRows]);
  useEffect(() => {
    setOriginalRows3(cookWearNewRows.map((r) => ({ ...r })));
  }, [cookWearNewRows]);

  // normalize
  const normalize = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;

  // 셀 스타일 (새 행 빨강, 수정 시 빨강)
  const getCellStyle = (originalRows) => (rowIndex, key, value, row) => {
    if (row?.modified) return { color: "red" }; // 플래그 우선
    const original = originalRows[rowIndex]?.[key];

    // 새로 추가된 행
    if (original === undefined) return { color: "red" };

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
    "& table": {
      borderCollapse: "separate",
      width: "100%",
      tableLayout: "fixed",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "4px",
      fontSize: "12px",
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
      fontSize: "12px",
      padding: "2px",
      minWidth: "80px",
      border: "none",
      background: "transparent",
      outline: "none",
    },
  };

  // 셀 변경 + 자동계산
  const handleCellChange = (setRows, type) => (rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) =>
        idx === rowIndex ? { ...row, [key]: value } : row
      )
    );

    if (type === "out") {
      if (key === "out_qty" || key === "type") {
        const selectedType = String(
          cookWearOutRows[rowIndex]?.type || ""
        );
        const qty =
          key === "out_qty" ? Number(value || 0) : Number(cookWearOutRows[rowIndex]?.out_qty || 0);

        setCookWearRows((prev) =>
          prev.map((r, i) =>
            String(r.type) === selectedType
              ? {
                  ...r,
                  out_qty: qty,
                  remain_qty:
                    (Number(r.current_qty || 0) +
                      Number(r.new_qty || 0)) -
                    qty,
                  modified:
                    //String(originalRows1[i]?.remain_qty ?? "") !==
                    String(
                      (Number(r.current_qty || 0) +
                        Number(r.new_qty || 0)) -
                        qty
                    ),
                }
              : r
          )
        );
      }
    } else if (type === "new") {
      if (key === "new_qty" || key === "type") {
        const selectedType = String(
          cookWearNewRows[rowIndex]?.type || ""
        );
        const qty =
          key === "new_qty" ? Number(value || 0) : Number(cookWearNewRows[rowIndex]?.new_qty || 0);

        setCookWearRows((prev) =>
          prev.map((r, i) =>
            String(r.type) === selectedType
              ? {
                  ...r,
                  new_qty: qty,
                  remain_qty:
                    (Number(r.current_qty || 0) + qty) -
                    Number(r.out_qty || 0),
                  modified:
                    //String(originalRows1[i]?.remain_qty ?? "") !==
                    String(
                      (Number(r.current_qty || 0) + qty) -
                        Number(r.out_qty || 0)
                    ),
                }
              : r
          )
        );
      }
    }
  };

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
        stockList: { list: cookWearRows },
        outList: { list: formattedOutList },
        newList: { list: formattedNewList },
      };
      
      const response = await api.post(
        "/Business/CookWearSave",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      
      if (response.data.code === 200) {

        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        await fetchCookWearList();
        await fetchCookWearOutList();
        await fetchCookWearNewList();
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

  const handleModalOpen = () => setOpen(true);

  const itemOptions = [
    { value: "1", label: "M" },
    { value: "2", label: "L" },
    { value: "3", label: "XL" },
    { value: "4", label: "XXL" },
    { value: "5", label: "조리모" },
  ];

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

  const renderTable = (
    title,
    rows,
    setRows,
    originalRows,
    columns,
    readOnly = false,
    type
  ) => {
    const handleChangeCellFunc = handleCellChange(setRows, type);
    const styleFn = (rowIndex, key, value, row) =>
      getCellStyle(originalRows)(rowIndex, key, value, row);

    return (
      <MDBox pt={4} pb={3} sx={tableSx}>
        <MDBox
          mx={0}
          mt={-3}
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
            {title}
          </MDTypography>
        </MDBox>
        <Grid container spacing={3}>
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
                      let cellContent;

                      if (col.type === "date") {
                        cellContent = (
                          <input
                            type="date"
                            value={value}
                            disabled={readOnly}
                            style={styleFn(
                              rowIndex,
                              col.accessorKey,
                              value,
                              row
                            )}
                            onChange={(e) =>
                              handleChangeCellFunc(
                                rowIndex,
                                col.accessorKey,
                                e.target.value
                              )
                            }
                          />
                        );
                      } else if (col.type === "selectItem") {
                        cellContent = (
                          <select
                            value={value}
                            disabled={readOnly}
                            style={styleFn(
                              rowIndex,
                              col.accessorKey,
                              value,
                              row
                            )}
                            onChange={(e) =>
                              handleChangeCellFunc(
                                rowIndex,
                                col.accessorKey,
                                e.target.value
                              )
                            }
                          >
                            <option value="">선택</option>
                            {itemOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        );
                      } else if (col.type === "selectAccount") {
                        cellContent = (
                          <select
                            value={value}
                            disabled={readOnly}
                            style={styleFn(
                              rowIndex,
                              col.accessorKey,
                              value,
                              row
                            )}
                            onChange={(e) =>
                              handleChangeCellFunc(
                                rowIndex,
                                col.accessorKey,
                                e.target.value
                              )
                            }
                          >
                            {accountList.map((acc) => (
                              <option
                                key={acc.account_id}
                                value={acc.account_id}
                              >
                                {acc.account_name}
                              </option>
                            ))}
                          </select>
                        );
                      } else {
                        cellContent = readOnly ? (
                          <span
                            style={styleFn(
                              rowIndex,
                              col.accessorKey,
                              value,
                              row
                            )}
                          >
                            {value}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={value}
                            style={styleFn(
                              rowIndex,
                              col.accessorKey,
                              value,
                              row
                            )}
                            onChange={(e) =>
                              handleChangeCellFunc(
                                rowIndex,
                                col.accessorKey,
                                e.target.value
                              )
                            }
                          />
                        );
                      }

                      return <td key={col.accessorKey}>{cellContent}</td>;
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
      {/* 상단 버튼 */}
      <MDBox
        pt={1}
        pb={1}
        gap={1}
        sx={{ display: "flex", justifyContent: "flex-end" }}
      >
        <MDButton
          variant="gradient"
          color="info"
          onClick={() =>
            setCookWearOutRows([
              ...cookWearOutRows,
              { type: "", account_id: accountList[0]?.account_id ?? "", out_qty: "", out_dt: "", note: "" },
            ])
          }
        >
          분출현황 행 추가
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          onClick={() =>
            setCookWearNewRows([
              ...cookWearNewRows,
              { type: "", account_id: accountList[0]?.account_id ?? "", new_qty: "", new_dt: "", note: "" },
            ])
          }
        >
          주문현황 행 추가
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleModalOpen}>
          품목 등록
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      {/* 테이블 */}
      <Grid container spacing={2}>
        <Grid item xs={4}>
          {renderTable(
            "조리복 재고현황",
            cookWearRows,
            setCookWearRows,
            originalRows1,
            columns1,
            true
          )}
        </Grid>
        <Grid item xs={4}>
          {renderTable(
            "조리복 분출현황",
            cookWearOutRows,
            setCookWearOutRows,
            originalRows2,
            columns2,
            false,
            "out"
          )}
        </Grid>
        <Grid item xs={4}>
          {renderTable(
            "조리복 주문현황",
            cookWearNewRows,
            setCookWearNewRows,
            originalRows3,
            columns3,
            false,
            "new"
          )}
        </Grid>
      </Grid>

      {/* 모달 */}
      <Modal open={open} onClose={() => setOpen(false)}>
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
            조리도구 등록
          </Typography>
          <TextField
            fullWidth
            margin="normal"
            label="도구ID"
            name="cook_id"
            value={formData.cook_id}
            onChange={(e) =>
              setFormData({ ...formData, cook_id: e.target.value })
            }
          />
          <TextField
            fullWidth
            margin="normal"
            label="도구명"
            name="cook_name"
            value={formData.cook_name}
            onChange={(e) =>
              setFormData({ ...formData, cook_name: e.target.value })
            }
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
            <Button variant="contained" sx={{ color: "#ffffff" }}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

export default CookWearTabStyled;
