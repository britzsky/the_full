/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback } from "react";
import MDBox from "components/MDBox";
import {
  Modal,
  Box,
  Select,
  MenuItem,
  Typography,
  Button,
  TextField,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  Checkbox,
} from "@mui/material";
import MDButton from "components/MDButton";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import Grid from "@mui/material/Grid";
import useRetailBusinessData from "./retailBusinessData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { API_BASE_URL } from "config";

// ======================== 은행/포맷 유틸 ========================
const KOREAN_BANKS = [
  "KB국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "IBK기업은행",
  "NH농협은행",
  "수협은행",
  "KDB산업은행",
  "SC제일은행",
  "씨티은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "우체국",
  "새마을금고",
  "신협",
  "저축은행",
  "부산은행",
  "대구은행",
  "광주은행",
  "전북은행",
  "경남은행",
  "제주은행",
  "기타(직접입력)",
];

const onlyDigits = (v = "") => String(v).replace(/\D/g, "");

const formatByGroups = (digits, groups) => {
  let idx = 0;
  const parts = [];
  for (const g of groups) {
    if (digits.length <= idx) break;
    parts.push(digits.slice(idx, idx + g));
    idx += g;
  }
  if (digits.length > idx) parts.push(digits.slice(idx));
  return parts.filter(Boolean).join("-");
};

// 은행별 대표 포맷(현실적으로 케이스가 많아서 “대표 패턴 + fallback” 방식)
const BANK_MASKS_BY_NAME = {
  KB국민은행: [
    [3, 2, 6],
    [3, 3, 6],
  ],
  신한은행: [
    [3, 3, 6],
    [3, 2, 6],
  ],
  우리은행: [
    [4, 3, 6],
    [3, 3, 6],
  ],
  하나은행: [
    [3, 6, 5],
    [3, 3, 6],
  ],
  IBK기업은행: [
    [3, 6, 2, 3],
    [3, 3, 6],
  ],
  NH농협은행: [
    [3, 4, 4, 2],
    [3, 3, 6],
  ],
  카카오뱅크: [
    [4, 2, 7],
    [3, 3, 6],
  ],
  토스뱅크: [
    [3, 3, 6],
    [4, 3, 6],
  ],
  케이뱅크: [
    [3, 3, 6],
    [4, 2, 7],
  ],
  우체국: [
    [4, 4, 4],
    [3, 3, 6],
  ],
};

const pickBestMask = (bankName, len) => {
  const masks = BANK_MASKS_BY_NAME[bankName] || [];
  if (!masks.length) return null;

  let best = masks[0];
  let bestScore = Infinity;
  for (const m of masks) {
    const sum = m.reduce((a, b) => a + b, 0);
    const score = Math.abs(sum - len);
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
};

const formatAccountNumber = (bankName, value) => {
  const digits = onlyDigits(value).slice(0, 16);
  const mask = pickBestMask(bankName, digits.length);

  if (mask) return formatByGroups(digits, mask);

  // fallback (보기 좋은 일반 포맷)
  if (digits.length <= 9) return formatByGroups(digits, [3, 3, 3]);
  if (digits.length <= 12) return formatByGroups(digits, [3, 3, 6]);
  return formatByGroups(digits, [4, 4, 4, 4]);
};

// 사업자번호: 10자리 -> 000-00-00000
const formatBizNo = (value) => {
  const digits = onlyDigits(value).slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 5);
  const c = digits.slice(5, 10);
  if (digits.length <= 3) return a;
  if (digits.length <= 5) return `${a}-${b}`;
  return `${a}-${b}-${c}`;
};

// 연락처(휴대폰) 포맷: 010-1234-5678 / 02-123-4567 / 0505-123-4567 등 최대한 대응
const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11); // 보통 10~11자리

  // 서울 02
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`; // 02-1234-5678
  }

  // 0505 같은 특수번호(4자리 국번)
  if (digits.startsWith("0505")) {
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`; // 0505-123-4567
  }

  // 일반 휴대폰/지역번호(3자리)
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`; // 010-123-4567
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`; // 010-1234-5678
};

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
      return normalize(original) !== normalize(value) ? { color: "red" } : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  // ✅ 셀 값 변경
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)));
  };

  // ✅ 이미지 확대
  const handleViewImage = (value) => {
    if (!value) return;
    setViewImageSrc(
      typeof value === "object" ? URL.createObjectURL(value) : `${API_BASE_URL}${value}`
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

      const response = await api.post(`/Operate/AccountRetailBusinessSaveV2`, payload, {
        headers: { "Content-Type": "application/json" },
      });

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
      { header: "약식명", accessorKey: "add_name", size: 80 },
      { header: "약식사용", accessorKey: "add_yn", size: 50 },
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
    maxHeight: isMobile ? "55vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
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
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
  };

  // ========================== Modal 관련 시작 ==========================
  const initialForm = {
    name: "",
    biz_no: "",
    ceo_name: "",
    tel: "",
    bank_name: "",
    bank_no: "",
    bank_image: null,
    biz_image: null,
    add_yn: "N",
    add_name: "",
  };

  const [open2, setOpen2] = useState(false);

  const [formData, setFormData] = useState(initialForm);

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

  const handleAddYnChange = (e) => {
    const checked = e.target.checked;

    setFormData((prev) => ({
      ...prev,
      add_yn: checked ? "Y" : "N",
      // 체크 해제되면 약식명 비우기(원치 않으면 이 줄 삭제)
      add_name: checked ? prev.add_name || "" : "",
    }));
  };

  // ✅ 계좌번호 입력 시 은행명 기준으로 자동 포맷
  const handleBankNoChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      bank_no: formatAccountNumber(prev.bank_name || "", value),
    }));
  };

  // ✅ 사업자번호 입력 시 자동 포맷
  const handleBizNoChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      biz_no: formatBizNo(value),
    }));
  };

  // ✅ 은행 Select (은행명 문자열로 저장)
  const handleBankSelect = (e) => {
    const bankName = e.target.value;

    setFormData((prev) => {
      // 기타(직접입력)면 bank_name 유지(직접 입력 텍스트필드로)
      if (bankName === "기타(직접입력)") {
        return {
          ...prev,
          bank_name: prev.bank_name || "",
          bank_no: formatAccountNumber(prev.bank_name || "", prev.bank_no || ""),
        };
      }

      return {
        ...prev,
        bank_name: bankName,
        bank_no: formatAccountNumber(bankName, prev.bank_no || ""),
      };
    });
  };

  // ✅ 연락처 입력 시 자동 포맷
  const handleTelChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      tel: formatPhone(value),
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
        setFormData(initialForm);
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
          // 모바일에서는 검색/버튼 영역도 본문과 함께 스크롤
          position: isMobile ? "static" : "sticky",
          zIndex: isMobile ? "auto" : 10,
          top: isMobile ? "auto" : 78,
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
      <MDBox pt={0} pb={3} sx={tableSx}>
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
                          onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
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

                  // ✅ 약식여부 select
                  if (key === "add_yn") {
                    return (
                      <td key={key} style={{ width: col.size }}>
                        <select
                          value={value || "N"}
                          onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
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
                      <td key={key} style={{ verticalAlign: "middle", width: col.size }}>
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
                            onChange={(e) => handleCellChange(rowIndex, key, e.target.files?.[0])}
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
                          handleCellChange(rowIndex, key, e.currentTarget.innerText.trim());
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
          <img src={viewImageSrc} alt="미리보기" style={{ maxWidth: "80%", maxHeight: "80%" }} />
        </div>
      )}

      {/* ================= 거래처 등록 모달(open2) ================= */}
      <Modal open={open2} onClose={handleModalClose2}>
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
            required
            margin="normal"
            label="거래처명"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="name"
            value={formData.name || ""}
            onChange={handleChange2}
            sx={{ mt: 1 }}
          />
          {/* ✅ 약식사용(체크박스+라벨) + 약식명 한 줄 배치 */}
          <Grid container spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            {/* 왼쪽: 체크박스 + 라벨 (완전 한 줄) */}
            <Grid item xs={4} sm={3}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Checkbox
                  size="small"
                  checked={(formData.add_yn || "N") === "Y"}
                  onChange={handleAddYnChange}
                  sx={{ p: 0.5 }} // 너무 크면 0.25로 줄여도 됨
                />
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    lineHeight: 1,
                    whiteSpace: "nowrap", // 라벨 줄바꿈 방지
                  }}
                >
                  약식사용
                </Typography>
              </Box>
            </Grid>

            {/* 오른쪽: 약식명 */}
            <Grid item xs={8} sm={9}>
              <TextField
                fullWidth
                margin="none"
                label="약식명"
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                name="add_name"
                value={formData.add_name || ""}
                onChange={handleChange2}
                disabled={(formData.add_yn || "N") !== "Y"}
                placeholder="약식사용 체크 시 입력"
                size="small"
              />
            </Grid>
          </Grid>
          <TextField
            fullWidth
            required
            margin="normal"
            label="사업자번호"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="biz_no"
            value={formData.biz_no || ""}
            onChange={handleBizNoChange}
            placeholder="예: 123-45-67890"
            inputProps={{ inputMode: "numeric" }}
            sx={{ mt: 1 }}
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
            sx={{ mt: 1 }}
          />

          <TextField
            fullWidth
            required
            margin="normal"
            label="연락처"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="tel"
            value={formData.tel || ""}
            onChange={handleTelChange}
            placeholder="예: 010-1234-5678"
            inputProps={{ inputMode: "numeric" }}
            sx={{ mt: 1 }}
          />

          {/* ✅ 은행명: Select로 변경 */}
          <Box mt={1}>
            <Typography sx={{ fontSize: "0.8rem", mb: 0.5 }}>은행명 (필수)</Typography>
            <Select
              fullWidth
              size="small"
              value={
                KOREAN_BANKS.includes(formData.bank_name)
                  ? formData.bank_name
                  : formData.bank_name
                  ? "기타(직접입력)"
                  : ""
              }
              onChange={handleBankSelect}
              displayEmpty
              sx={{ fontSize: "0.85rem" }}
            >
              <MenuItem value="">
                <em>은행 선택</em>
              </MenuItem>
              {KOREAN_BANKS.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>

            {/* 기타(직접입력) 선택 시 직접입력 */}
            {(!KOREAN_BANKS.includes(formData.bank_name) ||
              formData.bank_name === "기타(직접입력)") && (
              <TextField
                fullWidth
                required
                margin="normal"
                label="은행명 직접입력"
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                name="bank_name"
                value={formData.bank_name === "기타(직접입력)" ? "" : formData.bank_name || ""}
                onChange={handleChange2}
                sx={{ mt: 1 }}
              />
            )}
          </Box>

          {/* ✅ 계좌번호: 은행명에 맞춰 자동 포맷 */}
          <TextField
            fullWidth
            required
            margin="normal"
            label="계좌번호"
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            name="bank_no"
            value={formData.bank_no || ""}
            onChange={handleBankNoChange}
            placeholder="숫자만 입력해도 자동으로 - 가 들어갑니다."
            inputProps={{ inputMode: "numeric" }}
            sx={{ mt: 1 }}
          />

          {/* 통장사본 첨부 */}
          <Box mt={2} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "0.8rem", minWidth: "120px" }}>통장사본 (필수)</Typography>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Button
                variant="outlined"
                component="label"
                sx={{
                  color: "#e8a500",
                  borderColor: "#e8a500",
                  fontSize: "12px",
                  height: "32px",
                  "&:hover": { borderColor: "#e8a500", backgroundColor: "rgba(232, 165, 0, 0.1)" },
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
                      transition: "transform 0.2s",
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
                  "&:hover": { borderColor: "#e8a500", backgroundColor: "rgba(232, 165, 0, 0.1)" },
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
                      transition: "transform 0.2s",
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
            left: "33.3333%",
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
