import React, { useMemo, useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { Modal, Box, Typography, Button, TextField, Select, MenuItem } from "@mui/material";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import useHygienesheetData  from "./hygienesheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";

function HygieneSheetTab() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const { hygieneListRows, setHygieneListRows, accountList, loading, fetcHygieneList } =
  useHygienesheetData(); // ✅ 교체

  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  // 차량등록 항목
  const [formData, setFormData] = useState({
    car_number: "",
    car_name: "",
  });

  // 거래처 기본값 설정 + 테이블 데이터 fetch
  useEffect(() => {
    if (selectedAccountId) {
      fetcHygieneList(selectedAccountId);
    } else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);  // ✅ 첫 번째 업장 자동 선택
    }
  }, [accountList, selectedAccountId]);

  // carListRows 변경 시 rows 업데이트
  useEffect(() => {
    const deepCopy = hygieneListRows.map((row) => ({ ...row }));
    setRows(deepCopy);
    setOriginalRows(deepCopy);
  }, [hygieneListRows]);

  const onSearchList = (e) => setSelectedAccountId(e.target.value);

  // cell 값 변경 처리
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) =>
        idx === rowIndex ? { ...row, [key]: value } : row
      )
    );
  };

  const normalize = (value) => {
    if (typeof value !== "string") return "";
    return value.replace(/\s+/g, " ").trim();
  };

  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value) ? { color: "red" } : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  const tableSx = {
    flex: 1,
    minHeight: 0,
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
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& input[type='date'], & input[type='text']": {
      fontSize: "12px",
      padding: "4px",
      minWidth: "80px",
      border: "none",
      background: "transparent",
    },
  };

  // 숫자 입력 시 콤마 적용
  const handleNumberChange = (rowIndex, key, value) => {
    // 숫자만 남기기
    let num = value.replace(/,/g, "").replace(/[^\d]/g, "");
    // 화면용 콤마
    const formatted = num ? Number(num).toLocaleString() : "";
    handleCellChange(rowIndex, key, formatted);
  };
  // 행추가
  const handleAddRow = () => {
    const newRow = {
      account_id: selectedAccountId,  // ✅ 추가
      reg_dt: "",
      problem_note: "",
      mod_dt: "",
      clean_note: "",
      note: "",
    };
    setRows((prev) => [...prev, newRow]);
    setOriginalRows((prev) => [...prev, { ...newRow }]);
  };
  // 이미지 뷰어
  const handleViewImage = (value) => {
    if (!value) return;
    if (typeof value === "object") {
      setViewImageSrc(URL.createObjectURL(value));
    } else {
      setViewImageSrc(`http://localhost:8080${value}`);
    }
  };

  const handleCloseViewer = () => {
    setViewImageSrc(null);
  };

  const uploadImage = async (file, imageDt, account_id) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "hygiene");
      formData.append("gubun", imageDt);
      formData.append("folder", account_id);

      const res = await api.post("/Operate/OperateImgUpload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.code === 200) {
        Swal.fire({
          title: "성공",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

        return res.data.image_path;
      }
    } catch (err) {
       Swal.fire({
          title: "실패",
          text: err,
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });

      throw err;
    }
  };
  
  // 저장
  const handleSave = async () => {
    try {
      const modifiedRows = await Promise.all(
        rows.map(async (row, index) => {
          const original = originalRows[index] || {};
          let updatedRow = { ...row };

          const isChanged = columns.some((col) => {
            const key = col.accessorKey;
            const origVal = original[key];
            const newVal = row[key];
            if (typeof origVal === "string" && typeof newVal === "string") {
              return normalize(origVal) !== normalize(newVal);
            }
            return origVal !== newVal;
          });

          if (!isChanged) return null;

          // 숫자 처리
          if (updatedRow.service_amt) {
            updatedRow.service_amt = updatedRow.service_amt.toString().replace(/,/g, "");
          }
          if (updatedRow.mileage) {
            updatedRow.mileage = updatedRow.mileage.toString().replace(/,/g, "");
          }

          // 이미지 처리
          const imageFields = ["problem_image", "clean_image"];
          for (const field of imageFields) {
            if (row[field] && typeof row[field] === "object") {
              let uploadedPath;
              if (field === "problem_image") {
                uploadedPath = await uploadImage(row[field], row.reg_dt, selectedAccountId);
              } else if (field === "clean_image") {
                uploadedPath = await uploadImage(row[field], row.mod_dt, selectedAccountId);
              }
              console.log(uploadedPath);
              updatedRow[field] = uploadedPath;
            }
          }

          // ✅ 여기서 account_id 붙임
          return { ...updatedRow, account_id: selectedAccountId || row.account_id  };
        })
      );

      const payload = modifiedRows.filter(Boolean);

      console.log(payload);

      if (payload.length === 0) {
        console.log("변경된 내용이 없습니다.");
        return;
      }

      const response = await api.post(
        "/Operate/HygieneSave",
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

        await fetcHygieneList(selectedAccountId);
      }
    } catch (error) {
      Swal.fire({
        title: "실패",
        text: error,
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  const columns = useMemo(
    () => [
      { header: "등록일자", accessorKey: "reg_dt", size: 100 },
      { header: "조치 전 사진", accessorKey: "problem_image", size: 200, },
      { header: "전달 내용", accessorKey: "problem_note", size: 150 },
      { header: "조치일자", accessorKey: "mod_dt", size: 100 },
      { header: "조치 사진", accessorKey: "clean_image", size: 200 },
      { header: "조치 내용", accessorKey: "clean_note", size: 150 },
      { header: "비고", accessorKey: "note", size: 150 },
    ],
    []
  );

  if (loading) return <LoadingScreen />;

  return (
    <>
      <MDBox pt={1} pb={1} gap={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
        {accountList.length > 0 && (
          <TextField
            select
            size="small"
            value={selectedAccountId}
            onChange={onSearchList}
            sx={{ minWidth: 150 }}
            SelectProps={{ native: true }}
          >
            {(accountList || []).map((row) => (
              <option key={row.account_id} value={row.account_id}>
                {row.account_name}
              </option>
            ))}
          </TextField>
        )}

        <MDButton variant="gradient" color="info" onClick={handleAddRow}>
          행 추가
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

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
            위생관리
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

                      if (["problem_image", "clean_image"].includes(col.accessorKey)) {
                      return (
                        <td
                          key={col.accessorKey}
                          style={{
                            ...getCellStyle(rowIndex, col.accessorKey, value),
                            width: `${col.size}px`,
                            textAlign: "center",   // ✅ 이미지 가운데 정렬
                            verticalAlign: "middle",
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            id={`upload-${col.accessorKey}-${rowIndex}`}
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              handleCellChange(rowIndex, col.accessorKey, file);
                            }}
                          />
                          {/* ✅ 바로 썸네일 표시 */}
                          {value && (
                            <img
                              src={
                                typeof value === "object"
                                  ? URL.createObjectURL(value)
                                  : `http://localhost:8080${value}`
                              }
                              alt="preview"
                              style={{
                                display: "block",      // ✅ block 으로 바꿔야 margin auto 적용됨
                                margin: "6px auto",    // ✅ 가운데 정렬
                                maxWidth: "200px",
                                maxHeight: "200px",
                                objectFit: "cover",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                              onClick={() => handleViewImage(value)} // 필요 없으면 이 줄 삭제
                            />
                          )}

                          <label htmlFor={`upload-${col.accessorKey}-${rowIndex}`}>
                            <MDButton size="small" component="span" color="info">
                              이미지 업로드
                            </MDButton>
                          </label>
                        </td>
                      );
                    }

                      const isDate = ["reg_dt", "mod_dt"].includes(col.accessorKey);

                      if (isDate) {
                        return (
                          <td
                            key={col.accessorKey}
                            style={{
                              ...getCellStyle(rowIndex, col.accessorKey, value),
                              width: `${col.size}px`,
                            }}
                          >
                            <input
                              type="date"
                              value={value || ""}
                              onChange={(e) => handleCellChange(rowIndex, col.accessorKey, e.target.value)}
                              style={{
                                ...getCellStyle(rowIndex, col.accessorKey, value),
                                width: `${col.size}px`,
                              }}
                            />
                          </td>
                        );
                      }
                      return (
                        <td
                          key={col.accessorKey}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) =>
                            handleCellChange(rowIndex, col.accessorKey, e.target.innerText)
                          }
                          style={{
                            ...getCellStyle(rowIndex, col.accessorKey, value),
                            width: `${col.size}px`,
                          }}
                        >
                          {value}
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

      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "50vh",
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={handleCloseViewer}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "80%",
              maxHeight: "80%",
            }}
          >
            <TransformWrapper initialScale={1} minScale={0.5} maxScale={5} centerOnInit>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      zIndex: 1000,
                    }}
                  >
                    <button onClick={zoomIn}>+</button>
                    <button onClick={zoomOut}>-</button>
                    <button onClick={resetTransform}>⟳</button>
                    <button onClick={handleCloseViewer}>X</button>
                  </div>

                  <TransformComponent>
                    <img
                      src={encodeURI(viewImageSrc)}
                      alt="미리보기"
                      style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}
    </>
  );
}

export default HygieneSheetTab;
