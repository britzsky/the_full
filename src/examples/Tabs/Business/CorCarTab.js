/* eslint-disable react/function-component-definition */
// 법인차량 관리 화면 (위생관리 카드 구성: 차량별 요약 카드 → 차량 상세 날짜별 상태 기록 카드)
// 기록 한 건 = tb_thefull_car_management 한 행 (기록일자·주행거리·상태 사진·상태 메모·정비 내역)
import React, { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import {
  Modal,
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Tooltip,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { API_BASE_URL } from "config";
import useCarManagerData from "./corCarData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { Download, Trash2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { PhotoThumb, compressImageFile, useFillViewportHeight } from "utils/HygieneCardBoard";
import PreviewOverlay from "utils/PreviewOverlay";
import { buildFileDownloadUrl } from "utils/fileDownloadUrl";
import { askUnsavedChanges, setTabLeaveGuard } from "utils/unsavedChangesGuard";


// 변경 여부를 비교하는 기록 입력 항목
const FIELD_KEYS = ["service_dt", "mileage", "exterior_note", "service_note", "service_amt", "comment"];

// 강조 색 (위생관리와 동일한 ERP info 색)
const ACCENT = "#1A73E8";

// 카드·박스 공통 테두리 스타일
const cardStyle = { border: "1px solid #dde5eb", borderRadius: 8, backgroundColor: "#ffffff" };

// 카드 안 입력칸 공통 스타일 (위생관리 카드 입력칸과 동일)
const inputSx = {
  "& .MuiInputBase-root": { fontSize: 12, backgroundColor: "#ffffff" },
  "& .MuiInputLabel-root, & .MuiInputLabel-root.MuiInputLabel-shrink": { fontSize: 14 },
  "& .MuiInputLabel-root.MuiInputLabel-shrink ~ .MuiInputBase-root .MuiOutlinedInput-notchedOutline legend": {
    fontSize: "10.5px",
    paddingRight: 0,
  },
};

// 줄 안에 놓이는 작은 버튼 공통 높이
const buttonSx = { height: 32, minHeight: 32, py: 0, lineHeight: 1, fontSize: 12 };

// 콤마 포함 문자열을 숫자로 변환
const toNum = (value) => Number(String(value ?? "").replace(/,/g, "")) || 0;

// 숫자 입력칸 표시값 (천 단위 콤마)
const formatInput = (value) => (value ? Number(String(value).replace(/,/g, "")).toLocaleString() : "");

// 공백 차이를 무시한 비교용 문자열
const normalize = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value ?? "");

// 오늘 날짜 (YYYY-MM-DD, 새 기록 기본 기록일자)
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// 둥근 상태 배지
function Badge({ label, bg, fg }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        backgroundColor: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}

Badge.propTypes = { label: PropTypes.node, bg: PropTypes.string, fg: PropTypes.string };

function CorCarTabStyled({ embedded = false }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { carListRows, carSelectList, loading, fetchCarList, fetchCarSelectList } = useCarManagerData();

  // 상세 화면 차량번호 (null이면 전체 차량 요약 화면)
  const [selectedCar, setSelectedCar] = useState(null);

  // 전체 차량의 상태 기록 행과 마지막 조회 상태 (변경 비교 기준)
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);

  // 차량 등록 팝업 열림 여부와 입력값
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ car_number: "", car_name: "" });

  // 저장/업로드 진행 상태와 안내 문구
  const [saving, setSaving] = useState(false);
  const [savingText, setSavingText] = useState("");

  // 사진 크게 보기 목록·현재 위치 (새로 고른 사진의 임시 주소는 닫을 때 해제)
  const [previewFiles, setPreviewFiles] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // 카드 영역을 화면 맨 아래까지 채우는 높이
  const [boardAreaRef, boardAreaHeight] = useFillViewportHeight();

  // 미저장 변경 확인 후 이동 가능 여부 (저장 함수가 아래에서 정의되어 ref로 참조, 렌더마다 최신 함수로 교체)
  const leaveCheckRef = useRef(async () => true);

  // 탭 이동 전 미저장 변경 확인 등록 (경영관리·본사 관리 탭 묶음에서 탭을 바꾸기 전에 호출)
  useEffect(() => setTabLeaveGuard(() => leaveCheckRef.current()), []);

  // 최초 진입 시 차량 목록과 전체 차량 상태 기록 조회
  useEffect(() => {
    fetchCarSelectList();
    fetchCarList();
  }, []);

  // 조회 결과를 화면 편집용 행으로 변환 (사진 라벨·추가 예정 사진·삭제 예정 사진 포함)
  useEffect(() => {
    const deepCopy = (carListRows || []).map((row) => ({
      ...row,
      images: (row.images || []).map((img) => ({ ...img, image_label: img.image_label || "" })),
      pendingFiles: [],
      deletedImages: [],
    }));
    setRows(deepCopy);
    setOriginalRows(JSON.parse(JSON.stringify(deepCopy)));
  }, [carListRows]);

  // 저장된 적 없는 새 기록 여부
  const isRowNew = (rowIndex) => !originalRows[rowIndex]?.service_dt;

  // 기존 사진 중 위치 라벨이 바뀐 사진 목록 (삭제 예정 사진 제외)
  const getLabelChanges = (rowIndex) => {
    const row = rows[rowIndex];
    const origImages = originalRows[rowIndex]?.images || [];
    return (row.images || []).filter((img) => {
      if (row.deletedImages.some((d) => d.image_id === img.image_id)) return false;
      const orig = origImages.find((o) => o.image_id === img.image_id);
      return orig && normalize(orig.image_label) !== normalize(img.image_label);
    });
  };

  // 입력 항목 변경 여부
  const hasFieldChanges = (rowIndex) =>
    FIELD_KEYS.some((key) => normalize(originalRows[rowIndex]?.[key]) !== normalize(rows[rowIndex]?.[key]));

  // 기록 변경 여부 (입력 항목, 사진 추가·삭제, 사진 라벨)
  const isRowChanged = (rowIndex) => {
    const row = rows[rowIndex];
    if (!row) return false;
    return (
      isRowNew(rowIndex) ||
      hasFieldChanges(rowIndex) ||
      row.pendingFiles.length > 0 ||
      row.deletedImages.length > 0 ||
      getLabelChanges(rowIndex).length > 0
    );
  };

  // 차량별 기록 목록 (rows 인덱스 유지, 새 기록 먼저 그다음 기록일자 최신순)
  const recordsByCar = useMemo(() => {
    const map = {};
    rows.forEach((row, rowIndex) => {
      if (!map[row.car_number]) map[row.car_number] = [];
      map[row.car_number].push({ row, rowIndex });
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => {
        const aNew = !originalRows[a.rowIndex]?.service_dt;
        const bNew = !originalRows[b.rowIndex]?.service_dt;
        if (aNew !== bNew) return aNew ? -1 : 1;
        return String(b.row.service_dt || "").localeCompare(String(a.row.service_dt || ""));
      })
    );
    return map;
  }, [rows, originalRows]);

  // 차량 요약값 (저장된 기록 기준 현재 주행거리·최근 기록일·누적 건수·사진 수·대표 사진)
  const getCarSummary = (carNumber) => {
    const saved = (recordsByCar[carNumber] || [])
      .map(({ rowIndex }) => originalRows[rowIndex])
      .filter((r) => r?.service_dt);
    const latestMileage = saved.find((r) => toNum(r.mileage) > 0);
    const latestPhoto = saved.find((r) => (r.images || []).length > 0);
    return {
      mileage: latestMileage ? toNum(latestMileage.mileage).toLocaleString() : "",
      lastDt: saved[0]?.service_dt || "",
      count: saved.length,
      photoCount: saved.reduce((sum, r) => sum + (r.images || []).length, 0),
      photo: latestPhoto ? latestPhoto.images[0].exterior_image : "",
    };
  };

  // 차량번호로 표시 이름 찾기 (차량명 + 차량번호)
  const getCarName = (carNumber) =>
    carSelectList.find((c) => c.car_number === carNumber)?.full_name || carNumber;

  // ================================
  // 기록 입력 핸들러
  // ================================

  // 기록 입력값 변경
  const handleCellChange = (rowIndex, key, value) => {
    setRows((prev) => prev.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row)));
  };

  // 선택 차량에 오늘 날짜 새 상태 기록 추가 (비교 기준은 날짜 없는 빈 행이라 새 기록으로 판단)
  const handleAddRow = () => {
    const sameCar = rows.find((r) => r.car_number === selectedCar);
    const newRow = {
      car_number: selectedCar,
      car_name: sameCar?.car_name,
      service_dt: today(),
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
    setOriginalRows((prev) => [...prev, { ...newRow, service_dt: "" }]);
  };

  // 저장 전 새 기록 취소 (화면에서만 제거)
  const handleCancelNewRow = (rowIndex) => {
    setRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
    setOriginalRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
  };

  // 기록에 남아 있을 사진 수 (삭제 예정 제외 기존 사진 + 추가 예정 사진)
  const getPhotoCount = (row) =>
    (row.images || []).length - (row.deletedImages || []).length + (row.pendingFiles || []).length;

  // 사진 선택 → 추가 예정 사진에 저장 (업로드는 저장 시)
  const handleFileSelect = (rowIndex, fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? { ...r, pendingFiles: [...r.pendingFiles, ...files.map((file) => ({ file, label: "" }))] }
          : r
      )
    );
  };

  // 기존 사진 위치 라벨 변경
  const handleImageLabelChange = (rowIndex, imageId, label) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? { ...r, images: r.images.map((img) => (img.image_id === imageId ? { ...img, image_label: label } : img)) }
          : r
      )
    );
  };

  // 추가 예정 사진 위치 라벨 변경
  const handlePendingLabelChange = (rowIndex, pendingIndex, label) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? { ...r, pendingFiles: r.pendingFiles.map((pf, j) => (j === pendingIndex ? { ...pf, label } : pf)) }
          : r
      )
    );
  };

  // 기존 사진 삭제 예정 표시/해제
  const toggleImageDeleted = (rowIndex, img) => {
    const isDeleted = rows[rowIndex].deletedImages.some((d) => d.image_id === img.image_id);
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              deletedImages: isDeleted
                ? r.deletedImages.filter((d) => d.image_id !== img.image_id)
                : [...r.deletedImages, img],
            }
          : r
      )
    );
  };

  // 추가 예정 사진 제거
  const removePendingFile = (rowIndex, pendingIndex) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex ? { ...r, pendingFiles: r.pendingFiles.filter((_, j) => j !== pendingIndex) } : r
      )
    );
  };

  // 기록의 사진 전체를 크게 보기 (기존 사진 → 추가 예정 사진 순서, 라벨을 이름으로 표시)
  const openPreview = (rowIndex, startIndex) => {
    const row = rows[rowIndex];
    const list = [
      ...row.images.map((img) => ({
        url: `${API_BASE_URL}${img.exterior_image}`,
        name: img.image_label || img.image_name || "상태 사진",
        kind: "image",
      })),
      ...row.pendingFiles.map((pf) => ({
        url: URL.createObjectURL(pf.file),
        name: pf.label || pf.file.name,
        kind: "image",
      })),
    ];
    setPreviewFiles(list);
    setPreviewIndex(startIndex);
  };

  // 사진 크게 보기 닫기 (새로 고른 사진 임시 주소 해제)
  const handleClosePreview = () => {
    previewFiles.forEach((f) => f.url.startsWith("blob:") && URL.revokeObjectURL(f.url));
    setPreviewFiles([]);
    setPreviewIndex(0);
  };

  // 서버 사진 원본 다운로드
  const handleDownload = (path) => {
    if (!path) return;
    const a = document.createElement("a");
    a.href = buildFileDownloadUrl(path);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = path.split("/").pop() || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ================================
  // 차량 등록 팝업
  // ================================
  const handleModalOpen = () => setOpen(true);
  const handleModalClose = () => {
    setFormData({ car_number: "", car_name: "" });
    setOpen(false);
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 차량 마스터 등록 후 차량 목록 다시 조회
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
              await fetchCarSelectList();
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

  // ================================
  // 저장 (새 기록이면 기록 저장 먼저 → 사진 삭제 → 사진 업로드 → 라벨 수정 → 기존 기록 저장)
  // ================================

  // 저장용 기록 데이터 (숫자 콤마 제거, 화면용 사진 상태 제외)
  const buildSaveRow = (row, user_id) => {
    const saveRow = { ...row, user_id };
    // 주행거리·정비 비용은 INT 컬럼이라 빈 값은 null로 전달 (빈 문자열은 엄격 모드 DB에서 저장 오류)
    saveRow.service_amt = saveRow.service_amt ? saveRow.service_amt.toString().replace(/,/g, "") : null;
    saveRow.mileage = saveRow.mileage ? saveRow.mileage.toString().replace(/,/g, "") : null;
    delete saveRow.images;
    delete saveRow.pendingFiles;
    delete saveRow.deletedImages;
    delete saveRow.showService;
    return saveRow;
  };

  const handleSave = async () => {
    const user_id = localStorage.getItem("user_id") || "admin";

    // 같은 차량에 같은 기록일자가 두 건이면 한 건으로 덮어써지므로 저장 전에 막음
    const seen = new Set();
    const duplicated = rows.find((row) => {
      const key = `${row.car_number}|${row.service_dt}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (duplicated) {
      await Swal.fire(
        "경고",
        `${getCarName(duplicated.car_number)} 차량에 ${duplicated.service_dt} 기록이 두 건 있습니다. 기록일자를 확인해 주세요.`,
        "warning"
      );
      return false;
    }

    setSaving(true);
    setSavingText("저장 준비중...");

    // 기록일자 누락으로 건너뛴 기록이 있으면 false (저장 후 이동 시 이동하지 않음)
    let allSaved = true;

    try {
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const newRow = isRowNew(rowIndex);
        const fieldChanged = hasFieldChanges(rowIndex);
        const labelChanges = getLabelChanges(rowIndex);
        const imageChanged = row.pendingFiles.length > 0 || row.deletedImages.length > 0;

        if (!fieldChanged && !imageChanged && labelChanges.length === 0) continue;

        // 기록일자만 있고 아무것도 입력하지 않은 새 기록은 저장하지 않음
        const hasContent =
          FIELD_KEYS.some((key) => key !== "service_dt" && normalize(row[key])) || row.pendingFiles.length > 0;
        if (newRow && !hasContent) continue;

        if (!row.service_dt) {
          await Swal.fire("경고", "기록일자를 입력해 주세요.", "warning");
          allSaved = false;
          continue;
        }

        const progress = `(${rowIndex + 1}/${rows.length})`;

        // (1) 새 기록이면 기록 먼저 저장 (사진이 기록일자 기준으로 연결됨)
        if (newRow) {
          setSavingText(`기록 저장중... ${progress}`);
          await api.post("/Business/CarSave", [buildSaveRow(row, user_id)], {
            headers: { "Content-Type": "application/json" },
          });
        }

        // (2) 삭제 예정 사진 삭제
        for (const img of row.deletedImages) {
          setSavingText(`사진 삭제중... ${progress}`);
          await api.delete("/Business/CarFileDelete", {
            params: {
              car_number: row.car_number,
              service_dt: row.service_dt,
              image_id: img.image_id,
              exterior_image: img.exterior_image,
              user_id,
            },
          });
        }

        // (3) 추가 예정 사진 축소 후 업로드 (파일 순서와 같은 순서로 위치 라벨 전달)
        if (row.pendingFiles.length > 0) {
          setSavingText(`사진 업로드중... ${progress} ${row.pendingFiles.length}장`);
          const fd = new FormData();
          fd.append("car_number", row.car_number);
          fd.append("service_dt", row.service_dt);
          fd.append("user_id", user_id);
          for (const pf of row.pendingFiles) {
            fd.append("files", await compressImageFile(pf.file));
          }
          fd.append("labels", JSON.stringify(row.pendingFiles.map((pf) => pf.label.trim())));
          await api.post("/Business/CarFilesUpload", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }

        // (4) 기존 사진 위치 라벨 수정
        if (labelChanges.length > 0) {
          setSavingText(`사진 라벨 저장중... ${progress}`);
          await api.post(
            "/Business/CarFileLabelSave",
            labelChanges.map((img) => ({
              image_id: img.image_id,
              car_number: row.car_number,
              image_label: img.image_label.trim(),
            })),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        // (5) 기존 기록의 입력값 저장
        if (!newRow && fieldChanged) {
          setSavingText(`기록 저장중... ${progress}`);
          await api.post("/Business/CarSave", [buildSaveRow(row, user_id)], {
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      await fetchCarList();
      await Swal.fire("저장 완료", "모든 변경이 저장되었습니다.", "success");
      return allSaved;
    } catch (e) {
      Swal.fire("저장 실패", e?.message || String(e), "error");
      return false;
    } finally {
      setSaving(false);
      setSavingText("");
    }
  };

  // 미저장 변경이 있으면 저장 후 이동 / 취소 후 이동 / 취소 확인 (true: 이동 가능)
  // 취소 후 이동: 추가한 새 기록은 빼고 마지막 조회 상태로 되돌림
  leaveCheckRef.current = async () => {
    if (!rows.some((_, index) => isRowChanged(index))) return true;
    const choice = await askUnsavedChanges();
    if (choice === "cancel") return false;
    if (choice === "save") return handleSave();
    const savedRows = originalRows.filter((row) => row.service_dt);
    setRows(JSON.parse(JSON.stringify(savedRows)));
    setOriginalRows(savedRows);
    return true;
  };

  // 요약 카드·전체로 이동·차량 선택으로 화면 전환 (미저장 변경이 있으면 확인 후 이동)
  const handleSelectCar = async (nextCar) => {
    if (nextCar === selectedCar) return;
    if (!(await leaveCheckRef.current())) return;
    setSelectedCar(nextCar);
  };

  if (loading) return <LoadingScreen />;

  // ================================
  // 차량 상세: 상태 기록 카드 한 건
  // ================================
  const renderRecordCard = ({ row, rowIndex }, index) => {
    const newRow = isRowNew(rowIndex);
    const changed = isRowChanged(rowIndex);
    const photoCount = getPhotoCount(row);
    // 정비 내역 칸 표시 여부 (정비 내역 추가 버튼을 눌렀거나 입력된 정비 내용이 있는 경우)
    const showService =
      row.showService || ["service_note", "service_amt", "comment"].some((key) => normalize(row[key]));

    return (
      // 기록 카드 (수정된 기록은 빨간 테두리)
      <div
        key={newRow ? `new-${rowIndex}` : `${row.car_number}-${originalRows[rowIndex].service_dt}`}
        style={{
          ...cardStyle,
          borderColor: changed ? "#d32f2f" : "#dde5eb",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* 기록 번호·수정 표시·새 기록 취소 버튼 줄 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: "#dcebf3",
              color: "#1687b2",
              fontSize: 12,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {index + 1}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#344767" }}>
            {newRow ? "새 기록" : `${originalRows[rowIndex].service_dt} 기록`}
          </span>
          {changed && <Badge label={newRow ? "저장 전" : "수정됨"} bg="#fdecea" fg="#d32f2f" />}
          <span style={{ flex: 1 }} />
          {newRow && (
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleCancelNewRow(rowIndex)}
              disabled={saving}
              sx={buttonSx}
            >
              취소
            </MDButton>
          )}
        </div>

        {/* 기록일자·주행거리 입력 (저장된 기록의 날짜는 사진 연결 기준이라 수정 불가) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <TextField
            type="date"
            size="small"
            label="기록일자"
            value={row.service_dt || ""}
            onChange={(e) => handleCellChange(rowIndex, "service_dt", e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{ readOnly: !newRow }}
            disabled={saving}
            fullWidth
            sx={inputSx}
          />
          <TextField
            size="small"
            label="주행거리"
            value={formatInput(row.mileage)}
            onChange={(e) => handleCellChange(rowIndex, "mileage", e.target.value.replace(/[^\d]/g, ""))}
            InputLabelProps={{ shrink: true }}
            InputProps={{ endAdornment: <InputAdornment position="end">km</InputAdornment> }}
            placeholder="현재 계기판 주행거리"
            disabled={saving}
            fullWidth
            sx={inputSx}
          />
        </div>

        {/* 상태 사진 영역 (사진마다 위치 라벨 입력) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* 사진 영역 제목·장수·사진 추가 버튼 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#344767" }}>상태 사진</span>
            <span style={{ fontSize: 12, color: "#7b809a" }}>
              {photoCount}장
            </span>
            <span style={{ flex: 1 }} />
            <MDButton
              component="label"
              variant="outlined"
              color="info"
              size="small"
              disabled={saving}
              sx={buttonSx}
            >
              + 사진 추가
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  handleFileSelect(rowIndex, e.target.files);
                  e.target.value = ""; // 같은 파일 재선택 가능
                }}
              />
            </MDButton>
            {/* 정비 내역 입력 칸 열기 버튼 (칸이 열려 있으면 미표시) */}
            {!showService && (
              <MDButton
                variant="outlined"
                color="info"
                size="small"
                onClick={() => handleCellChange(rowIndex, "showService", true)}
                disabled={saving}
                sx={buttonSx}
              >
                + 정비 내역
              </MDButton>
            )}
          </div>

          {row.images.length === 0 && row.pendingFiles.length === 0 ? (
            // 사진 없는 기록 안내
            <div
              style={{
                padding: 16,
                border: "1px dashed #d3dce3",
                borderRadius: 6,
                backgroundColor: "#f8fafb",
                color: "#9aa6b1",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              등록된 사진이 없습니다. 사진 추가를 눌러 차량 상태 사진을 올려 주세요.
            </div>
          ) : (
            // 사진 칸 목록 (기존 사진 → 추가 예정 사진)
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {row.images.map((img, imgIndex) => {
                const isDeleted = row.deletedImages.some((d) => d.image_id === img.image_id);
                return (
                  // 기존 사진 칸 (삭제 예정이면 흐리게)
                  <div
                    key={img.image_id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      padding: 6,
                      borderRadius: 8,
                      backgroundColor: "#f7f9fa",
                      opacity: isDeleted ? 0.4 : 1,
                    }}
                  >
                    <PhotoThumb value={img.exterior_image} onView={() => openPreview(rowIndex, imgIndex)} />
                    {/* 위치 라벨 입력과 다운로드·삭제 아이콘 */}
                    <TextField
                      size="small"
                      value={img.image_label}
                      onChange={(e) => handleImageLabelChange(rowIndex, img.image_id, e.target.value)}
                      placeholder="위치 (예: 앞범퍼)"
                      disabled={saving || isDeleted}
                      inputProps={{ maxLength: 50 }}
                      fullWidth
                      sx={inputSx}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Tooltip title="다운로드">
                        <IconButton size="small" sx={{ color: ACCENT, p: 0.5 }} onClick={() => handleDownload(img.exterior_image)}>
                          <Download size={14} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={isDeleted ? "삭제 취소" : "삭제"}>
                        <IconButton
                          size="small"
                          color={isDeleted ? "warning" : "error"}
                          sx={{ p: 0.5 }}
                          onClick={() => toggleImageDeleted(rowIndex, img)}
                          disabled={saving}
                        >
                          {isDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
              {row.pendingFiles.map((pf, pendingIndex) => (
                // 추가 예정 사진 칸 (초록 배경, 저장 시 업로드)
                <div
                  key={`pending-${pendingIndex}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: "#eff7f1",
                  }}
                >
                  <PhotoThumb
                    value={pf.file}
                    onView={() => openPreview(rowIndex, row.images.length + pendingIndex)}
                  />
                  <TextField
                    size="small"
                    value={pf.label}
                    onChange={(e) => handlePendingLabelChange(rowIndex, pendingIndex, e.target.value)}
                    placeholder="위치 (예: 앞범퍼)"
                    disabled={saving}
                    inputProps={{ maxLength: 50 }}
                    fullWidth
                    sx={inputSx}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#3e7652" }}>추가 예정</span>
                    <Tooltip title="제거">
                      <IconButton
                        size="small"
                        color="error"
                        sx={{ p: 0.5 }}
                        onClick={() => removePendingFile(rowIndex, pendingIndex)}
                        disabled={saving}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 상태 메모 입력 */}
        <TextField
          size="small"
          label="상태 메모"
          value={row.exterior_note || ""}
          onChange={(e) => handleCellChange(rowIndex, "exterior_note", e.target.value)}
          placeholder="찍힘, 긁힘, 실내 상태 등을 입력해 주세요."
          InputLabelProps={{ shrink: true }}
          disabled={saving}
          multiline
          minRows={2}
          fullWidth
          sx={inputSx}
        />

        {/* 정비 내역 입력 영역 (정비내용·정비 비용·정비시 특이사항), 정비 내역 버튼을 누르거나 내용이 있을 때 표시 */}
        {showService && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "10px 8px",
            borderRadius: 8,
            backgroundColor: "#f7f9fa",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#344767" }}>정비 내역</span>
          <TextField
            size="small"
            label="정비내용"
            value={row.service_note || ""}
            onChange={(e) => handleCellChange(rowIndex, "service_note", e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={saving}
            multiline
            minRows={2}
            fullWidth
            sx={inputSx}
          />
          <TextField
            size="small"
            label="정비 비용"
            value={formatInput(row.service_amt)}
            onChange={(e) => handleCellChange(rowIndex, "service_amt", e.target.value.replace(/[^\d]/g, ""))}
            InputLabelProps={{ shrink: true }}
            InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
            disabled={saving}
            fullWidth
            sx={inputSx}
          />
          <TextField
            size="small"
            label="정비시 특이사항"
            value={row.comment || ""}
            onChange={(e) => handleCellChange(rowIndex, "comment", e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={saving}
            multiline
            minRows={2}
            fullWidth
            sx={inputSx}
          />
        </div>
        )}
      </div>
    );
  };

  // ================================
  // 차량 상세 화면
  // ================================
  const renderDetail = () => {
    const records = recordsByCar[selectedCar] || [];
    const summary = getCarSummary(selectedCar);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>
        {/* 선택 차량 이름·현재 주행거리·최근 기록일·누적 건수 요약 박스 */}
        <div
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#344767" }}>{getCarName(selectedCar)}</div>
            <div style={{ fontSize: 13, color: "#7b809a" }}>
              현재 {summary.mileage ? `${summary.mileage}km` : "주행거리 미입력"}
              {summary.lastDt ? ` · 최근 기록 ${summary.lastDt}` : ""}
            </div>
          </div>
          <span style={{ fontSize: 13, color: "#7b809a" }}>누적 {summary.count}건</span>
        </div>

        {/* 상태 기록 카드 목록 (새 기록 → 최신 기록순), 기록이 없으면 안내 박스 */}
        {records.length === 0 ? (
          <div style={{ ...cardStyle, padding: 20, textAlign: "center", fontSize: 13, color: "#7b809a" }}>
            등록된 기록이 없습니다. 아래 상태 기록 추가를 눌러 현재 주행거리와 사진을 등록해 주세요.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(560px, 1fr))",
              gap: 12,
            }}
          >
            {records.map(renderRecordCard)}
          </div>
        )}

        {/* 선택 차량 상태 기록 추가 버튼 */}
        <MDButton
          variant="outlined"
          color="info"
          onClick={handleAddRow}
          disabled={saving}
          sx={{ borderStyle: "dashed", fontSize: 14 }}
        >
          + 상태 기록 추가
        </MDButton>
      </div>
    );
  };

  // ================================
  // 전체 차량 요약 화면
  // ================================
  const renderSummary = () =>
    carSelectList.length === 0 ? (
      <div style={{ ...cardStyle, padding: 20, textAlign: "center", fontSize: 13, color: "#7b809a" }}>
        등록된 차량이 없습니다. 차량등록을 눌러 차량을 추가해 주세요.
      </div>
    ) : (
      // 차량별 요약 카드 목록 (클릭 시 상세 화면 이동)
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
          paddingBottom: 24,
        }}
      >
        {carSelectList.map((car) => {
          const summary = getCarSummary(car.car_number);
          const changed = (recordsByCar[car.car_number] || []).some(({ rowIndex }) => isRowChanged(rowIndex));

          return (
            // 차량 요약 카드
            <div
              key={car.car_number}
              onClick={() => handleSelectCar(car.car_number)}
              style={{
                ...cardStyle,
                borderColor: changed ? "#d32f2f" : "#dde5eb",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                cursor: "pointer",
              }}
            >
              {/* 차량명과 상세 보기 표시 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#344767",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {car.full_name}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, color: ACCENT, whiteSpace: "nowrap" }}>
                  상세 보기
                  <ChevronRight size={14} />
                </span>
              </div>
              {/* 최근 기록 대표 사진 */}
              <PhotoThumb value={summary.photo} onView={() => {}} />
              {/* 현재 주행거리 */}
              <div style={{ fontSize: 18, fontWeight: 800, color: summary.mileage ? ACCENT : "#9aa6b1" }}>
                {summary.mileage ? `${summary.mileage} km` : "주행거리 미입력"}
              </div>
              {/* 최근 기록일·누적 건수·사진 수 배지 */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <Badge label={summary.lastDt ? `최근 ${summary.lastDt}` : "기록 없음"} bg="#f2f5f7" fg="#667584" />
                <Badge label={`누적 ${summary.count}건`} bg="#f2f5f7" fg="#667584" />
                <Badge label={`사진 ${summary.photoCount}장`} bg="#eef6f1" fg="#3e7652" />
                {changed && <Badge label="저장 전" bg="#fdecea" fg="#d32f2f" />}
              </div>
            </div>
          );
        })}
      </div>
    );

  const content = (
    <>
      {!embedded && (
        <MDBox
          sx={{
            // 스크롤 시 상단 네비가 화면 위에 유지되도록 고정
            position: "sticky",
            top: 0,
            zIndex: isMobile ? theme.zIndex.appBar + 1 : 10,
            backgroundColor: "#ffffff",
          }}
        >
          <DashboardNavbar title="🚙 법인차량 관리" />
        </MDBox>
      )}

      {/* 상단 바 (상세 화면: 전체로 이동·차량 선택 / 요약 화면: 차량 수, 오른쪽 차량등록·저장 버튼) */}
      <MDBox
        gap={1}
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
          pt: 0.25,
          pb: 1,
          backgroundColor: "#ffffff",
        }}
      >
        {selectedCar ? (
          <>
            {/* 전체 차량 요약 화면으로 이동 버튼 */}
            <button
              type="button"
              onClick={() => handleSelectCar(null)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                height: 32,
                padding: "0 14px 0 8px",
                borderRadius: 999,
                border: `1px solid ${ACCENT}`,
                backgroundColor: "#f7f9fa",
                color: ACCENT,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <ChevronLeft size={18} />
              전체로 이동
            </button>
            {/* 다른 차량 상세로 바로 이동하는 차량 선택 */}
            <TextField
              select
              size="small"
              value={selectedCar}
              onChange={(e) => handleSelectCar(e.target.value)}
              sx={{ minWidth: isMobile ? 140 : 180 }}
              SelectProps={{ native: true }}
              disabled={saving}
            >
              {carSelectList.map((car) => (
                <option key={car.car_number} value={car.car_number}>
                  {car.full_name}
                </option>
              ))}
            </TextField>
          </>
        ) : (
          <span style={{ fontSize: 14, color: "#7b809a" }}>
            차량 <b style={{ color: "#344767" }}>{carSelectList.length}대</b>
          </span>
        )}

        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
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

      {/* 카드 화면 (요약 카드 또는 차량 상세 기록 카드), 화면 맨 아래까지 채우고 영역 안에서만 스크롤 */}
      <MDBox
        ref={boardAreaRef}
        pt={1}
        sx={{
          height: boardAreaHeight ?? (isMobile ? "60vh" : "75vh"),
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {selectedCar ? renderDetail() : renderSummary()}
      </MDBox>

      {/* 차량 등록 팝업 */}
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

      {/* 사진 크게 보기 미리보기 창 (기록 사진 넘겨보기·확대·회전·다운로드) */}
      <PreviewOverlay
        open={previewFiles.length > 0}
        files={previewFiles}
        currentIndex={previewIndex}
        onChangeIndex={setPreviewIndex}
        onClose={handleClosePreview}
        anchorX={1 / 2}
      />

      {/* 저장/업로드 진행 로딩 */}
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
        <Typography sx={{ color: "#fff", fontSize: isMobile ? 12 : 14 }}>{savingText || "저장중..."}</Typography>
      </Backdrop>
    </>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}

CorCarTabStyled.propTypes = {
  embedded: PropTypes.bool,
};

export default CorCarTabStyled;
