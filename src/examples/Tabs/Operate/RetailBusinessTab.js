/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback } from "react";
import MDBox from "components/MDBox";
import {
  Modal,
  Box,
  Typography,
  Button,
  TextField,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
} from "@mui/material";
import MDButton from "components/MDButton";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";

import useRetailBusinessData from "./retailBusinessData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { API_BASE_URL } from "config";

function RetailBusinessTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { activeRows, loading, fetcRetailBusinessList } = useRetailBusinessData();
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  // ✅ 초기 데이터 조회 (기본 조회)
  useEffect(() => {
    fetcRetailBusinessList();
  }, []);

  // ✅ activeRows → rows / originalRows 복사
  useEffect(() => {
    const deepCopy = (activeRows || []).map((r) => ({ ...r }));
    setRows(deepCopy);
    setOriginalRows(deepCopy);
  }, [activeRows]);

  // ✅ 셀 값 비교용 normalize
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

  // ✅ 셀 값 변경
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row))
    );
  };

  // ✅ 이미지 확대
  const handleViewImage = (value) => {
    if (!value) return;
    setViewImageSrc(
      typeof value === "object"
        ? URL.createObjectURL(value)
        : `${API_BASE_URL}${value}`
    );
  };
  const handleCloseViewer = () => setViewImageSrc(null);

  // ✅ 이미지 업로드 (folder = retail)
  const uploadImage = async (file, typeValue, field) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "account");
      formData.append("gubun", field);
      formData.append("folder", "retail");

      const res = await api.post(`/Operate/OperateImgUpload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.code === 200) return res.data.image_path;
    } catch {
      Swal.fire("오류", "이미지 업로드 실패", "error");
    }
  };

  // ✅ (NEW) 다운로드 (문자열 path일 때만)
  const handleDownload = useCallback((path) => {
    if (!path || typeof path !== "string") return;
    const url = `${API_BASE_URL}${path}`;
    const filename = path.split("/").pop() || "download";

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ✅ (NEW) 아이콘 파란색 공통
  const fileIconSx = { color: "#1e88e5" };

  // ✅ 저장 (account_id 제거 + type 기반 이미지업로드)
  const handleSave = async () => {
    try {
      const modifiedRows = await Promise.all(
        rows.map(async (row, idx) => {
          const original = originalRows[idx] || {};
          let updatedRow = { ...row };

          const isChanged = Object.keys(updatedRow).some((key) => {
            const origVal = original[key];
            const curVal = updatedRow[key];
            if (typeof origVal === "string" && typeof curVal === "string")
              return normalize(origVal) !== normalize(curVal);
            return origVal !== curVal;
          });

          if (!isChanged) return null;

          for (const field of ["bank_image", "biz_image"]) {
            if (row[field] && typeof row[field] === "object") {
              const uploadedPath = await uploadImage(row[field], row.type, field);
              updatedRow[field] = uploadedPath;
            }
          }

          return updatedRow;
        })
      );

      const payload = modifiedRows.filter(Boolean);
      if (payload.length === 0) {
        Swal.fire("안내", "변경된 내용이 없습니다.", "info");
        return;
      }

      const response = await api.post(
        `/Operate/AccountRetailBusinessSaveV2`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.code === 200) {
        Swal.fire("성공", "저장되었습니다.", "success");
        await fetcRetailBusinessList();
      }
    } catch {
      Swal.fire("오류", "저장 중 오류", "error");
    }
  };

  // ✅ 테이블 컬럼 정의
  const columns = useMemo(
    () => [
      { header: "업체명", accessorKey: "name", size: 100 },
      { header: "사업자번호", accessorKey: "biz_no", size: 80 },
      { header: "대표자명", accessorKey: "ceo_name", size: 120 },
      { header: "전화번호", accessorKey: "tel", size: 80 },
      { header: "은행명", accessorKey: "bank_name", size: 60 },
      { header: "계좌번호", accessorKey: "bank_no", size: 80 },
      { header: "통장사본", accessorKey: "bank_image", size: 80 },
      { header: "사업자등록증", accessorKey: "biz_image", size: 80 },
      { header: "삭제여부", accessorKey: "del_yn", size: 50 },
      { header: "연결 거래처", accessorKey: "account_name", size: 80 },
    ],
    []
  );

  // ✅ 테이블 스타일 유지
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
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 130,
      zIndex: 10,
    },
  };

  // ========================== Modal 관련 시작 ==========================
  const [open, setOpen] = useState(false); // (현재는 사용 안 하지만 유지)
  const [open2, setOpen2] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
  });

  const [imagePreviews, setImagePreviews] = useState({
    bank_image: null,
    biz_image: null,
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const handleImagePreviewOpen = (src) => {
    setPreviewImage(src);
    setPreviewOpen(true);
  };

  const handleImagePreviewClose = () => {
    setPreviewOpen(false);
    setPreviewImage(null);
  };

  const handleModalOpen2 = async () => {
    setOpen2(true);
  };

  const handleModalClose2 = async () => {
    setOpen2(false);
  };

  const handleChange2 = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  // ======================= 이미지 미리보기 =======================
  const handleImageUploadPreview = (e) => {
    const { name, files } = e.target;
    const file = files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreviews((prev) => ({ ...prev, [name]: previewUrl }));
    setFormData((prev) => ({ ...prev, [name]: file }));
  };

  // ======================= 거래처 저장 =======================
  const handleSubmit2 = async () => {
    const requiredFields = [
      "name",
      "biz_no",
      "ceo_name",
      "tel",
      "bank_name",
      "bank_no",
      "bank_image",
      "biz_image",
    ];

    const missing = requiredFields.filter((key) => !formData[key]);
    if (missing.length > 0) {
      return Swal.fire({
        title: "경고",
        text: "필수항목을 모두 입력하세요.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }

    try {
      const imageFields = ["bank_image", "biz_image"];
      const uploadPromises = imageFields.map(async (field) => {
        const file = formData[field];
        if (!file || typeof file === "string") return file;

        try {
          const formDataToSend = new FormData();
          formDataToSend.append("file", file);
          formDataToSend.append("type", "account");
          formDataToSend.append("gubun", field);
          formDataToSend.append("folder", "retail");

          const res = await api.post("/Operate/OperateImgUpload", formDataToSend, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          if (res.data.code === 200) {
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
      });

      const [bankPath, bizPath] = await Promise.all(uploadPromises);

      const payload = {
        ...formData,
        bank_image: bankPath,
        biz_image: bizPath,
        del_yn: "N",
      };

      const response = await api.post("/Operate/AccountRetailBusinessSave", payload);
      if (response.data.code === 200) {
        Swal.fire({
          title: "성공",
          text: "거래처가 등록되었습니다.",
          icon: "success",
          confirmButtonColor: "#3085d6",
          confirmButtonText: "확인",
        });
        setOpen2(false);
        setFormData({});
        setImagePreviews({});
        fetcRetailBusinessList();
      } else {
        Swal.fire("실패", response.data.message || "저장 중 오류 발생", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("에러", err.message || "저장 중 문제가 발생했습니다.", "error");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* ✅ 상단 버튼 바 (모바일 대응) */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          flexWrap: isMobile ? "wrap" : "nowrap",
          justifyContent: isMobile ? "flex-start" : "flex-end",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleModalOpen2}
          sx={{
            fontSize: isMobile ? "0.75rem" : "0.875rem",
            minWidth: isMobile ? 110 : 130,
            px: isMobile ? 1 : 2,
          }}
        >
          거래처 등록
        </MDButton>
        <MDButton
          color="info"
          onClick={handleSave}
          sx={{
            fontSize: isMobile ? "0.75rem" : "0.875rem",
            minWidth: isMobile ? 70 : 90,
            px: isMobile ? 1 : 2,
          }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* ✅ 테이블 렌더 */}
      <MDBox pt={1} pb={3} sx={tableSx}>
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
                  const key = col.accessorKey;
                  const value = row[key] ?? "";
                  const style = getCellStyle(rowIndex, key, value);

                  // ✅ 삭제여부 select
                  if (key === "del_yn") {
                    return (
                      <td key={key} style={{ width: col.size }}>
                        <select
                          value={value || "N"}
                          onChange={(e) =>
                            handleCellChange(rowIndex, key, e.target.value)
                          }
                          style={{
                            width: "100%",
                            border: "none",
                            background: "transparent",
                            fontSize: "12px",
                            ...style,
                          }}
                        >
                          <option value="N">N</option>
                          <option value="Y">Y</option>
                        </select>
                      </td>
                    );
                  }

                  // ✅ 이미지 필드: 있으면 (다운로드/미리보기 파란아이콘), 없으면 업로드 버튼
                  if (["bank_image", "biz_image"].includes(key)) {
                    const hasImage = !!value;

                    return (
                      <td
                        key={key}
                        style={{ verticalAlign: "middle", width: col.size }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            id={`upload-${key}-${rowIndex}`}
                            style={{ display: "none" }}
                            onChange={(e) =>
                              handleCellChange(rowIndex, key, e.target.files?.[0])
                            }
                          />

                          {hasImage ? (
                            <>
                              {/* ✅ 다운로드: 서버 경로(문자열)일 때만 */}
                              {typeof value === "string" && (
                                <Tooltip title="다운로드">
                                  <IconButton
                                    size="small"
                                    sx={fileIconSx}
                                    onClick={() => handleDownload(value)}
                                  >
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                              {/* ✅ 미리보기: 서버/로컬(File) 모두 */}
                              <Tooltip title="미리보기">
                                <IconButton
                                  size="small"
                                  sx={fileIconSx}
                                  onClick={() => handleViewImage(value)}
                                >
                                  <ImageSearchIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <label htmlFor={`upload-${key}-${rowIndex}`}>
                              <MDButton component="span" size="small" color="info">
                                업로드
                              </MDButton>
                            </label>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // ✅ 일반 텍스트 셀
                  return (
                    <td
                      key={key}
                      contentEditable={key !== "account_name"} // ✅ account_name 수정 불가
                      suppressContentEditableWarning
                      style={{ ...style, width: col.size }}
                      onBlur={(e) => {
                        if (key !== "account_name") {
                          handleCellChange(
                            rowIndex,
                            key,
                            e.currentTarget.innerText.trim()
                          );
                        }
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
      </MDBox>

      {/* ✅ 이미지 확대 팝업 */}
      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={handleCloseViewer}
        >
          <img
            src={viewImageSrc}
            alt="미리보기"
            style={{ maxWidth: "80%", maxHeight: "80%" }}
          />
        </div>
      )}

      {/* 🔹 거래처 등록 모달 */}
      <Modal open={open2} onClose={handleModalClose2}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "90vw", sm: 500 },
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
            required
            margin="normal"
            label="거래처명"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="name"
            value={formData.name || ""}
            onChange={handleChange2}
          />

          <TextField
            fullWidth
            required
            margin="normal"
            label="사업자번호"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="biz_no"
            value={formData.biz_no || ""}
            onChange={handleChange2}
            placeholder="예: 123-45-67890"
          />

          <TextField
            fullWidth
            required
            margin="normal"
            label="대표자명"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="ceo_name"
            value={formData.ceo_name || ""}
            onChange={handleChange2}
          />

          <TextField
            fullWidth
            required
            margin="normal"
            label="연락처"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="tel"
            value={formData.tel || ""}
            onChange={handleChange2}
            placeholder="예: 010-1234-5678"
          />

          <TextField
            fullWidth
            required
            margin="normal"
            label="은행명"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="bank_name"
            value={formData.bank_name || ""}
            onChange={handleChange2}
          />

          <TextField
            fullWidth
            required
            margin="normal"
            label="계좌번호"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="bank_no"
            value={formData.bank_no || ""}
            onChange={handleChange2}
          />

          {/* 통장사본 첨부 */}
          <Box mt={2} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "0.8rem", minWidth: "120px" }}>
              통장사본 (필수)
            </Typography>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Button
                variant="outlined"
                component="label"
                sx={{
                  color: "#e8a500",
                  borderColor: "#e8a500",
                  fontSize: "12px",
                  height: "32px",
                  "&:hover": {
                    borderColor: "#e8a500",
                    backgroundColor: "rgba(232, 165, 0, 0.1)",
                  },
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  name="bank_image"
                  onChange={handleImageUploadPreview}
                />
              </Button>

              {imagePreviews.bank_image && (
                <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <img
                    src={imagePreviews.bank_image}
                    alt="bank_image"
                    style={{
                      width: 100,
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      cursor: "pointer",
                    }}
                    onClick={() => handleImagePreviewOpen(imagePreviews.bank_image)}
                  />
                  <Typography variant="caption" sx={{ fontSize: "11px" }}>
                    {formData.bank_image?.name || "업로드 완료"}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* 사업자등록증 첨부 */}
          <Box mt={2} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "0.8rem", minWidth: "120px" }}>
              사업자등록증 (필수)
            </Typography>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Button
                variant="outlined"
                component="label"
                sx={{
                  color: "#e8a500",
                  borderColor: "#e8a500",
                  fontSize: "12px",
                  height: "32px",
                  "&:hover": {
                    borderColor: "#e8a500",
                    backgroundColor: "rgba(232, 165, 0, 0.1)",
                  },
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  name="biz_image"
                  onChange={handleImageUploadPreview}
                />
              </Button>

              {imagePreviews.biz_image && (
                <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <img
                    src={imagePreviews.biz_image}
                    alt="biz_image"
                    style={{
                      width: 100,
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      cursor: "pointer",
                    }}
                    onClick={() => handleImagePreviewOpen(imagePreviews.biz_image)}
                  />
                  <Typography variant="caption" sx={{ fontSize: "11px" }}>
                    {formData.biz_image?.name || "업로드 완료"}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* 하단 버튼 */}
          <Box mt={4} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={handleModalClose2}
              sx={{
                bgcolor: "#e8a500",
                color: "#ffffff",
                "&:hover": { bgcolor: "#e8a500", color: "#ffffff" },
              }}
            >
              취소
            </Button>
            <Button variant="contained" onClick={handleSubmit2} sx={{ color: "#ffffff" }}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 🔍 이미지 확대 미리보기 모달 */}
      <Modal open={previewOpen} onClose={handleImagePreviewClose}>
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
          {previewImage && (
            <img
              src={previewImage}
              alt="미리보기"
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

export default RetailBusinessTab;
