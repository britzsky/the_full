/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import {
  Modal,
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";

import { API_BASE_URL } from "config";
import useCarManagerData from "./corCarData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import {
  Download,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const MAX_FILES = 5;

function CorCarTabStyled() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [selectedCar, setSelectedCar] = useState("");
  const { carListRows, carSelectList, loading, fetchCarList, fetchCarSelectList } =
    useCarManagerData();

  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [originalRows, setOriginalRows] = useState([]);

  // ✅ 저장/업로드 로딩
  const [saving, setSaving] = useState(false);
  const [savingText, setSavingText] = useState("");

  // 미리보기 Dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewList, setPreviewList] = useState([]); // {url, name}[]
  const [currentIndex, setCurrentIndex] = useState(0);

  // 차량등록 항목
  const [formData, setFormData] = useState({
    car_number: "",
    car_name: "",
  });

  // ================================
  // 초기: 차량 선택 목록
  // ================================
  useEffect(() => {
    const fetch = async () => {
      await fetchCarSelectList();
    };
    fetch();
  }, []);

  // ================================
  // 차량 선택 시 기본값 설정 + 테이블 데이터 fetch
  // ================================
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

  // ================================
  // carListRows 변경 시 rows 업데이트
  // images / pendingFiles / deletedImages 세팅
  // ================================
  useEffect(() => {
    const deepCopy = (carListRows || []).map((row) => ({
      ...row,
      images: row.images || [],
      pendingFiles: [],
      deletedImages: [],
    }));
    setRows(deepCopy);
    setOriginalRows(JSON.parse(JSON.stringify(deepCopy)));
  }, [carListRows]);

  // ================================
  // 공통 Cell 변경
  // ================================
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
    );
  };

  const normalize = (value) => {
    if (typeof value !== "string") return "";
    return value.replace(/\s+/g, " ").trim();
  };

  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value)
        ? { color: "red" }
        : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  // ✅ 반응형 테이블 컨테이너
  const tableSx = {
    flex: 1,
    minHeight: 0,
    maxHeight: isMobile ? "60vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "2px" : "4px",
      whiteSpace: "pre-wrap",
      fontSize: isMobile ? "10px" : "12px",
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
    "& input[type='date'], & input[type='text']": {
      fontSize: isMobile ? "10px" : "12px",
      padding: isMobile ? "2px" : "4px",
      minWidth: isMobile ? "60px" : "80px",
      border: "none",
      background: "transparent",
    },
  };

  // 행추가
  const handleAddRow = () => {
    const newRow = {
      service_dt: "",
      service_note: "",
      mileage: "",
      service_amt: "",
      comment: "",
      exterior_note: "",
      images: [],
      pendingFiles: [],
      deletedImages: [],
    };
    setRows((prev) => [...prev, newRow]);
    setOriginalRows((prev) => [...prev, JSON.parse(JSON.stringify(newRow))]);
  };

  // ================================
  // 이미지 관련 핸들러
  // ================================

  // 파일 선택 → pendingFiles 에만 저장 (업로드 X)
  const handleFileSelect = (rowIndex, fileList) => {
    if (!fileList || fileList.length === 0) return;

    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;

        const imagesCount = row.images?.length || 0;
        const pendingCount = row.pendingFiles?.length || 0;
        const currentCount = imagesCount + pendingCount;

        if (currentCount >= MAX_FILES) {
          Swal.fire(`이미지는 최대 ${MAX_FILES}장까지 등록 가능합니다.`, "", "warning");
          return row;
        }

        let files = Array.from(fileList);
        const available = MAX_FILES - currentCount;

        if (files.length > available) {
          files = files.slice(0, available);
          Swal.fire(
            "이미지 개수 제한",
            `최대 ${MAX_FILES}장까지 등록 가능하여 ${available}장만 추가되었습니다.`,
            "info"
          );
        }

        const wrapped = files.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }));

        return {
          ...row,
          pendingFiles: [...(row.pendingFiles || []), ...wrapped],
        };
      })
    );
  };

  // 기존 이미지 삭제(토글) → deletedImages에 넣었다 뺐다
  const toggleImageDeleted = (rowIndex, imgIndex) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;

        const target = row.images[imgIndex];
        if (!target) return row;

        const exists = row.deletedImages.some((d) =>
          d.image_id && target.image_id
            ? d.image_id === target.image_id
            : d.image_path === target.image_path
        );

        return exists
          ? {
              ...row,
              deletedImages: row.deletedImages.filter((d) =>
                d.image_id && target.image_id
                  ? d.image_id !== target.image_id
                  : d.image_path !== target.image_path
              ),
            }
          : {
              ...row,
              deletedImages: [...row.deletedImages, target],
            };
      })
    );
  };

  // pendingFiles에서 제거
  const removePendingFile = (rowIndex, indexInPending) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;

        const target = row.pendingFiles[indexInPending];
        if (target && target.previewUrl) {
          URL.revokeObjectURL(target.previewUrl);
        }

        return {
          ...row,
          pendingFiles: row.pendingFiles.filter((_, idx) => idx !== indexInPending),
        };
      })
    );
  };

  // 이미지 미리보기 (기존 images만 슬라이드)
  const openPreview = (rowIndex, imgIndex) => {
    const row = rows[rowIndex];
    if (!row || !row.images) return;

    const list = row.images.map((img) => ({
      url: `${API_BASE_URL}${img.exterior_image}`,
      name: img.image_name,
    }));

    setPreviewList(list);
    setCurrentIndex(imgIndex || 0);
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewList([]);
    setCurrentIndex(0);
  };

  // ================================
  // 차량 등록 Modal
  // ================================
  const handleModalOpen = () => setOpen(true);
  const handleModalClose = () =>
    setFormData({ car_number: "", car_name: "" }) || setOpen(false);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.car_number || !formData.car_name) {
      return Swal.fire({
        title: "경고",
        text: "필수항목을 확인하세요.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
    api
      .post("/Business/CarNewSave", formData, {
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
          }).then(async (result) => {
            if (result.isConfirmed) {
              handleModalClose();
              await fetchCarList(selectedCar);
            }
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

  const columns = useMemo(
    () => [
      { header: "날짜", accessorKey: "service_dt", size: isMobile ? 80 : 100 },
      { header: "정비내용", accessorKey: "service_note", size: isMobile ? 220 : 300 },
      { header: "정비시\n주행거리", accessorKey: "mileage", size: isMobile ? 70 : 80 },
      { header: "정비 비용", accessorKey: "service_amt", size: isMobile ? 70 : 80 },
      { header: "정비시 특이사항", accessorKey: "comment", size: isMobile ? 230 : 350 },
      { header: "외관 이미지", accessorKey: "exterior_image", size: isMobile ? 220 : 260 },
      { header: "외관내용", accessorKey: "exterior_note", size: isMobile ? 230 : 350 },
    ],
    [isMobile]
  );

  // ================================
  // ✅ 저장 헬퍼 (신규 행이면 CarSave 먼저 → 이미지 업로드)
  // ================================
  const isRowNew = (orig) => !orig?.service_dt;

  const buildSaveRow = (row) => {
    const saveRow = { ...row };

    if (saveRow.service_amt) saveRow.service_amt = saveRow.service_amt.toString().replace(/,/g, "");
    if (saveRow.mileage) saveRow.mileage = saveRow.mileage.toString().replace(/,/g, "");

    delete saveRow.images;
    delete saveRow.pendingFiles;
    delete saveRow.deletedImages;

    return saveRow;
  };

  // ================================
  // ✅ 저장 (신규 행이면 정비 저장 먼저 -> 이미지 업로드/삭제)
  // ================================
  const handleSave = async () => {
    const user_id = localStorage.getItem("user_id") || "admin";

    setSaving(true);
    setSavingText("저장 준비중...");

    try {
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const original = originalRows[rowIndex] || {};

        const hasFieldChanges = columns.some((col) => {
          const key = col.accessorKey;
          const origVal = original[key];
          const newVal = row[key];

          if (typeof origVal === "string" && typeof newVal === "string") {
            return normalize(origVal) !== normalize(newVal);
          }
          return origVal !== newVal;
        });

        const hasImageChanges =
          (row.pendingFiles && row.pendingFiles.length > 0) ||
          (row.deletedImages && row.deletedImages.length > 0);

        if (!hasFieldChanges && !hasImageChanges) continue;

        if (hasImageChanges && !row.service_dt) {
          await Swal.fire("경고", "이미지를 업로드/삭제하려면 먼저 날짜를 입력해주세요.", "warning");
          continue;
        }

        const newRow = isRowNew(original);

        // ✅ 신규행이면 먼저 정비이력 저장(부모 생성) -> 그 다음 이미지 업로드/삭제
        if (newRow && (hasFieldChanges || hasImageChanges)) {
          setSavingText(`정비이력 저장중... (${rowIndex + 1}/${rows.length})`);

          const saveRow = buildSaveRow(row);
          saveRow.car_number = selectedCar;
          saveRow.user_id = user_id;

          await api.post("/Business/CarSave", [saveRow], {
            headers: { "Content-Type": "application/json" },
          });
        }

        // (1) 기존 이미지 삭제
        if (row.deletedImages && row.deletedImages.length > 0) {
          setSavingText(`이미지 삭제중... (${rowIndex + 1}/${rows.length})`);

          for (const img of row.deletedImages) {
            await api.delete("/Business/CarFileDelete", {
              params: {
                car_number: selectedCar,
                service_dt: row.service_dt,
                image_id: img.image_id,
                image_path: img.image_path,
                exterior_image: img.exterior_image,
                user_id,
              },
            });
          }
        }

        // (2) 새 이미지 업로드
        if (row.pendingFiles && row.pendingFiles.length > 0) {
          setSavingText(
            `이미지 업로드중... (${rowIndex + 1}/${rows.length}) ${row.pendingFiles.length}장`
          );

          const fd = new FormData();
          fd.append("car_number", selectedCar);
          fd.append("service_dt", row.service_dt);
          fd.append("user_id", user_id);

          row.pendingFiles.forEach((pf) => {
            fd.append("files", pf.file);
          });

          await api.post("/Business/CarFilesUpload", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }

        // (3) 신규행이 아닌 경우에만 정비 데이터 저장
        if (!newRow && hasFieldChanges) {
          setSavingText(`정비이력 저장중... (${rowIndex + 1}/${rows.length})`);

          const saveRow = buildSaveRow(row);
          saveRow.car_number = selectedCar;
          saveRow.user_id = user_id;

          await api.post("/Business/CarSave", [saveRow], {
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // pending previewUrl 정리
      rows.forEach((row) =>
        (row.pendingFiles || []).forEach((pf) => {
          if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
        })
      );

      await fetchCarList(selectedCar);
      await Swal.fire("저장 완료", "모든 변경이 저장되었습니다.", "success");
    } catch (e) {
      Swal.fire("저장 실패", e?.message || String(e), "error");
    } finally {
      setSaving(false);
      setSavingText("");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 차량 선택 + 버튼 영역 - 모바일에서 줄바꿈 */}
      <MDBox
        pt={1}
        pb={1}
        gap={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        {carSelectList.length > 0 && (
          <TextField
            select
            size="small"
            value={selectedCar}
            onChange={(e) => setSelectedCar(e.target.value)}
            sx={{ minWidth: isMobile ? 140 : 150 }}
            SelectProps={{ native: true }}
            disabled={saving}
          >
            {carSelectList.map((car) => (
              <option key={car.car_number} value={car.car_number}>
                {car.full_name}
              </option>
            ))}
          </TextField>
        )}

        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleAddRow}
            disabled={saving}
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : undefined }}
          >
            행 추가
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleModalOpen}
            disabled={saving}
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : undefined }}
          >
            차량등록
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            disabled={saving}
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : undefined }}
          >
            저장
          </MDButton>
        </Box>
      </MDBox>

      <MDBox pt={1} pb={3} sx={tableSx}>
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

                      // ===========================
                      // 외관 이미지 열
                      // ===========================
                      if (col.accessorKey === "exterior_image") {
                        const images = row.images || [];
                        const pending = row.pendingFiles || [];
                        const deleted = row.deletedImages || [];

                        return (
                          <td
                            key={col.accessorKey}
                            style={{
                              width: `${col.size}px`,
                              textAlign: "center",
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              {/* 기존 이미지 목록 */}
                              <Box
                                sx={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, 1fr)",
                                  gap: 0.5,
                                  width: "100%",
                                }}
                              >
                                {images.map((img, imgIndex) => {
                                  const isDeleted = deleted.some(
                                    (d) => d.exterior_image === img.exterior_image
                                  );
                                  return (
                                    <Box
                                      key={img.exterior_image + imgIndex}
                                      sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        p: 0.5,
                                        border: "1px solid #ccc",
                                        borderRadius: "4px",
                                        background: "#fafafa",
                                        opacity: isDeleted ? 0.4 : 1,
                                        filter: isDeleted ? "blur(1px)" : "none",
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          width: "100%",
                                          height: 50,
                                          mb: 0.5,
                                          overflow: "hidden",
                                          borderRadius: "4px",
                                          cursor: "pointer",
                                        }}
                                        onClick={() => openPreview(rowIndex, imgIndex)}
                                      >
                                        <img
                                          src={`${API_BASE_URL}${img.exterior_image}`}
                                          alt={img.image_name}
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                          }}
                                        />
                                      </Box>
                                      <button
                                        type="button"
                                        onClick={() => openPreview(rowIndex, imgIndex)}
                                        style={{
                                          border: "none",
                                          background: "none",
                                          fontSize: "10px",
                                          cursor: "pointer",
                                          textDecoration: "underline",
                                          overflow: "hidden",
                                          whiteSpace: "nowrap",
                                          textOverflow: "ellipsis",
                                          textAlign: "left",
                                          marginBottom: 2,
                                        }}
                                      >
                                        {img.image_name}
                                      </button>
                                      <Box
                                        sx={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                        }}
                                      >
                                        <IconButton
                                          size="small"
                                          color="success"
                                          component="a"
                                          href={`${API_BASE_URL}${img.image_path}`}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          sx={{ p: 0.5 }}
                                          disabled={saving}
                                        >
                                          <Download size={14} />
                                        </IconButton>
                                        <IconButton
                                          size="small"
                                          color={isDeleted ? "warning" : "error"}
                                          sx={{ p: 0.5 }}
                                          onClick={() => toggleImageDeleted(rowIndex, imgIndex)}
                                          disabled={saving}
                                        >
                                          {isDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                                        </IconButton>
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </Box>

                              {/* 추가될 이미지 미리보기 (pendingFiles) */}
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 0.5,
                                  width: "100%",
                                }}
                              >
                                {pending.map((pf, idx2) => (
                                  <Box
                                    key={idx2}
                                    sx={{
                                      border: "1px solid #ccc",
                                      borderRadius: "4px",
                                      padding: "4px",
                                      display: "flex",
                                      gap: 0.5,
                                      alignItems: "center",
                                      background: "#f9fff6",
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        width: 30,
                                        height: 30,
                                        overflow: "hidden",
                                        borderRadius: "4px",
                                        flexShrink: 0,
                                      }}
                                    >
                                      <img
                                        src={pf.previewUrl}
                                        alt={pf.file.name}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                    </Box>
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        flex: 1,
                                        textAlign: "left",
                                      }}
                                    >
                                      {pf.file.name}
                                    </span>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      sx={{ p: 0.5 }}
                                      onClick={() => removePendingFile(rowIndex, idx2)}
                                      disabled={saving}
                                    >
                                      <Trash2 size={14} />
                                    </IconButton>
                                  </Box>
                                ))}
                              </Box>

                              {/* 파일 선택 */}
                              <div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  disabled={saving}
                                  style={{ width: "120px", fontSize: "11px" }}
                                  onChange={(e) => {
                                    handleFileSelect(rowIndex, e.target.files);
                                    e.target.value = null;
                                  }}
                                />
                                <div style={{ fontSize: "10px", color: "#999" }}>
                                  (최대 {MAX_FILES}장)
                                </div>
                              </div>
                            </Box>
                          </td>
                        );
                      }

                      const isDate = col.accessorKey === "service_dt";
                      const isNumber =
                        col.accessorKey === "service_amt" || col.accessorKey === "mileage";

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
                              disabled={saving}
                              onChange={(e) =>
                                handleCellChange(rowIndex, col.accessorKey, e.target.value)
                              }
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
                              disabled={saving}
                              value={
                                value ? Number(value.replace(/,/g, "")).toLocaleString() : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value
                                  .replace(/,/g, "")
                                  .replace(/[^\d]/g, "");
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
                          contentEditable={!saving}
                          suppressContentEditableWarning
                          onBlur={(e) =>
                            !saving &&
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
              차량 등록
            </Typography>
            <TextField
              fullWidth
              margin="normal"
              label="차량번호"
              InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              name="car_number"
              value={formData.car_number}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="차량명"
              InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              name="car_name"
              value={formData.car_name}
              onChange={handleChange}
            />
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
      </MDBox>

      {/* 이미지 미리보기 Dialog */}
      <Dialog open={previewOpen} onClose={handleClosePreview} maxWidth="md" fullWidth>
        <DialogContent
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            p: isMobile ? 1.5 : 2,
          }}
        >
          <IconButton
            onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
            disabled={currentIndex === 0}
            sx={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              "&:hover": {
                background: "rgba(0,0,0,0.55)",
              },
            }}
          >
            <ChevronLeft size={isMobile ? 24 : 32} />
          </IconButton>

          {previewList.length > 0 && (
            <img
              src={previewList[currentIndex].url}
              alt={previewList[currentIndex].name || "preview"}
              style={{
                maxWidth: "100%",
                maxHeight: isMobile ? "70vh" : "80vh",
                objectFit: "contain",
              }}
            />
          )}

          <IconButton
            onClick={() =>
              setCurrentIndex((prev) => Math.min(prev + 1, previewList.length - 1))
            }
            disabled={currentIndex === previewList.length - 1}
            sx={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.35)",
              color: "white",
              "&:hover": {
                background: "rgba(0,0,0,0.55)",
              },
            }}
          >
            <ChevronRight size={isMobile ? 24 : 32} />
          </IconButton>
        </DialogContent>
      </Dialog>

      {/* ✅ 저장/업로드 로딩 */}
      <Backdrop
        open={saving}
        sx={{
          color: "#fff",
          zIndex: (t) => t.zIndex.modal + 20,
          flexDirection: "column",
          gap: 1,
        }}
      >
        <CircularProgress color="inherit" />
        <Typography sx={{ color: "#fff", fontSize: isMobile ? 12 : 14 }}>
          {savingText || "이미지 등록중..."}
        </Typography>
      </Backdrop>
    </>
  );
}

export default CorCarTabStyled;
