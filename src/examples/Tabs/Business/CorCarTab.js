import React, { useMemo, useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { Modal, Box, Typography, Button, TextField, Select, MenuItem } from "@mui/material";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

import useCarManagerData from "./corCarData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";

function CorCarTabStyled() {
  const [selectedCar, setSelectedCar] = useState("");
  const { carListRows, carSelectList, loading, fetchCarList, fetchCarSelectList } =
    useCarManagerData();

  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  // 차량등록 항목
  const [formData, setFormData] = useState({
    car_number: "",
    car_name: "",
  });

  // 차량 선택 목록 불러오기
  useEffect(() => {
    const fetch = async () => {
      await fetchCarSelectList();
    };
    fetch();
  }, []);

  // 차량 선택 시 기본값 설정 + 테이블 데이터 fetch
  useEffect(() => {
    if (carSelectList.length > 0) {
      if (!selectedCar) {
        setSelectedCar(carSelectList[0].car_number);
      } else {
        fetchCarList(selectedCar);
      }
    } else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [selectedCar, carSelectList]);

  // carListRows 변경 시 rows 업데이트
  useEffect(() => {
    const deepCopy = carListRows.map((row) => ({ ...row }));
    setRows(deepCopy);
    setOriginalRows(deepCopy);
  }, [carListRows]);

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
      service_dt: "",
      service_note: "",
      mileage: "",
      service_amt: "",
      comment: "",
      exterior_image: null,
      exterior_note: "",
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

  const uploadImage = async (file, serviceDt, carNumber) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "car");
      formData.append("gubun", serviceDt);
      formData.append("folder", carNumber);

      const res = await api.post("/Business/BusinessImgUpload", formData, {
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
  
  // modal 관련
  const handleModalOpen = () => setOpen(true);
  const handleModalClose = () => setFormData({ car_number: "", car_name: "" }) || setOpen(false);
  const handleChange = (e) => { const { name, value } = e.target; setFormData((prev) => ({ ...prev, [name]: value })); };
  // 차량 등록
  const handleSubmit = async () => {
    if (!formData.car_number || !formData.car_name ) {
      return Swal.fire({ title: "경고", text: "필수항목을 확인하세요.", icon: "error", confirmButtonColor: "#d33", confirmButtonText: "확인" });
    }
    api.post("/Business/CarNewSave", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => { 
        if (res.data.code === 200) 
          Swal.fire({ title: "저장", text: "저장되었습니다.", icon: "success", confirmButtonColor: "#d33", confirmButtonText: "확인" })
        .then((result) = async ()=> { 
          if (result.isConfirmed) {
            handleModalClose(); 
            await fetchCarList(selectedCar);
          } 
        }); 
      })
      .catch(() => Swal.fire({ title: "실패", text: "저장을 실패했습니다.", icon: "error", confirmButtonColor: "#d33", confirmButtonText: "확인" }));
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

          if (updatedRow.service_amt) {
            updatedRow.service_amt = updatedRow.service_amt.toString().replace(/,/g, "");
          }
          if (updatedRow.mileage) {
            updatedRow.mileage = updatedRow.mileage.toString().replace(/,/g, "");
          }

          if (row.exterior_image && typeof row.exterior_image === "object") {
            const uploadedPath = await uploadImage(
              row.exterior_image,
              row.service_dt,
              selectedCar
            );
            updatedRow.exterior_image = uploadedPath;
          }

          return { ...updatedRow, car_number: selectedCar };
        })
      );

      const payload = modifiedRows.filter(Boolean);

      if (payload.length === 0) {
        console.log("변경된 내용이 없습니다.");
        return;
      }

      const response = await api.post(
        "/Business/CarSave",
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

        await fetchCarList(selectedCar);
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
      { header: "날짜", accessorKey: "service_dt", size: 100 },
      { header: "정비내용", accessorKey: "service_note", size: 350 },
      { header: "정비시 주행거리", accessorKey: "mileage", size: 80 },
      { header: "정비 비용", accessorKey: "service_amt", size: 80 },
      { header: "정비시 특이사항", accessorKey: "comment", size: 350 },
      { header: "외관 이미지", accessorKey: "exterior_image", size: 150 },
      { header: "외관내용", accessorKey: "exterior_note", size: 350 },
    ],
    []
  );

  if (loading) return <LoadingScreen />;

  return (
    <>
      <MDBox pt={1} pb={1} gap={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
        {carSelectList.length > 0 && (
          <TextField
            select
            size="small"
            value={selectedCar}
            onChange={(e) => setSelectedCar(e.target.value)}
            sx={{ minWidth: 150 }}
            SelectProps={{ native: true }}
          >
            {carSelectList.map((car) => (
              <option key={car.car_number} value={car.car_number}>
                {car.full_name}
              </option>
            ))}
          </TextField>
        )}

        <MDButton variant="gradient" color="info" onClick={handleAddRow}>
          행 추가
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleModalOpen}>
          차량등록
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
            법인차량 관리
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

                      if (col.accessorKey === "exterior_image") {
                        return (
                          <td
                            key={col.accessorKey}
                            style={{
                              ...getCellStyle(rowIndex, col.accessorKey, value),
                              width: `${col.size}px`,
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              id={`upload-${rowIndex}`}
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files[0];
                                handleCellChange(rowIndex, col.accessorKey, file);
                              }}
                            />
                            <label htmlFor={`upload-${rowIndex}`}>
                              <MDButton size="small" component="span" color="info">
                                이미지 업로드
                              </MDButton>
                            </label>
                            {value && (
                              <span
                                style={{
                                  display: "inline-block",
                                  maxWidth: "120px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  cursor: "pointer",
                                  marginLeft: 6,
                                }}
                                onClick={() => handleViewImage(value)}
                              >
                                {typeof value === "object" ? value.name : value}
                              </span>
                            )}
                          </td>
                        );
                      }

                      const isDate = col.accessorKey === "service_dt";
                      const isNumber = col.accessorKey === "service_amt" || col.accessorKey === "mileage";

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

                      if (isNumber) {
                        return (
                          <td
                            key={col.accessorKey}
                            style={{
                              ...getCellStyle(rowIndex, col.accessorKey, value),
                              width: `${col.size}px`,
                            }}
                          >
                            <input
                              type="text"
                              value={value ? Number(value.replace(/,/g, "")).toLocaleString() : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, "").replace(/[^\d]/g, "");
                                handleCellChange(rowIndex, col.accessorKey, raw);
                              }}
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
        {/* 등록 모달 */}
        <Modal open={open} onClose={handleModalClose}>
          <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, bgcolor: "background.paper", borderRadius: 2, boxShadow: 24, p: 5 }}>
            <Typography variant="h6" gutterBottom>차량 등록</Typography>
            <TextField fullWidth margin="normal" label="차량번호" InputLabelProps={{ style: { fontSize: "0.7rem" } }} name="car_number" value={formData.car_number} onChange={handleChange} />
            <TextField fullWidth margin="normal" label="차량명" InputLabelProps={{ style: { fontSize: "0.7rem" } }} name="car_name" value={formData.car_name} onChange={handleChange} />
            <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
              <Button variant="contained" onClick={handleModalClose} sx={{ bgcolor: "#e8a500", color: "#ffffff", "&:hover": { bgcolor: "#e8a500", color: "#ffffff" } }}>취소</Button>
              <Button variant="contained" onClick={handleSubmit} sx={{ color: "#ffffff" }}>저장</Button>
            </Box>
          </Box>
        </Modal>
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

export default CorCarTabStyled;
