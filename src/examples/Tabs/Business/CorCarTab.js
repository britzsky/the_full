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
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { API_BASE_URL } from "config";
import useCarManagerData from "./corCarData";
import api from "api/api";
// 이 화면의 알림·확인창은 바깥(검은 배경) 클릭으로 닫히지 않는 Swal 사용
import { LockedSwal as Swal, showSwalLoading, updateSwalLoading } from "utils/swalLoading";
import { Download, Trash2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { PhotoThumb, compressImageFile, useFillViewportHeight } from "utils/HygieneCardBoard";
import PreviewOverlay from "utils/PreviewOverlay";
import { buildFileDownloadUrl } from "utils/fileDownloadUrl";
import { askUnsavedChanges, setTabLeaveGuard } from "utils/unsavedChangesGuard";
import useDetailBackGuard from "utils/useDetailBackGuard";


// 변경 여부를 비교하는 기록 입력 항목
const FIELD_KEYS = ["service_dt", "mileage", "exterior_note", "service_note", "service_amt", "comment"];

// 요약 화면 최근 기록 목록에 보여줄 건수
const RECENT_COUNT = 10;

// 조회 로딩 창 최소 표시 시간(ms) (사용자 관리와 동일, 너무 빨리 닫혀 깜빡이는 것 방지)
const MIN_LOADING_MODAL_MS = 420;

// 정비 내역 칸 입력 항목 (정비내용·정비 비용·정비시 특이사항)
const SERVICE_KEYS = ["service_note", "service_amt", "comment"];

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

  // 저장/업로드 진행 상태 (진행 문구는 Swal 로딩 창에 표시)
  const [saving, setSaving] = useState(false);

  // 사진 크게 보기 목록·현재 위치 (새로 고른 사진의 임시 주소는 닫을 때 해제)
  const [previewFiles, setPreviewFiles] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // 카드 영역을 화면 맨 아래까지 채우는 높이
  const [boardAreaRef, boardAreaHeight] = useFillViewportHeight();

  // 미저장 변경 확인 후 이동 가능 여부 (저장 함수가 아래에서 정의되어 ref로 참조, 렌더마다 최신 함수로 교체)
  const leaveCheckRef = useRef(async () => true);

  // 탭 이동 전 미저장 변경 확인 등록 (경영관리·본사 관리 탭 묶음에서 탭을 바꾸기 전에 호출)
  useEffect(() => setTabLeaveGuard(() => leaveCheckRef.current()), []);

  // 최초 조회 완료 여부와 첫 진입 대표 사진 준비 완료 여부 (준비 전까지 로딩 화면 표시)
  const [dataLoaded, setDataLoaded] = useState(false);
  const [firstPhotosReady, setFirstPhotosReady] = useState(false);

  // 최초 진입 시 차량 목록과 전체 차량 상태 기록 조회
  useEffect(() => {
    Promise.all([fetchCarSelectList(), fetchCarList()]).finally(() => setDataLoaded(true));
  }, []);

  // 첫 진입 시 요약 카드 대표 사진(차량별 최근 기록의 첫 사진)을 미리 받아 둔 뒤 화면 표시
  // 사진 칸과 같은 주소·CORS 방식으로 받아 브라우저 캐시를 그대로 사용
  // ponytail: 최대 8초만 대기, 느린 사진은 이후 사진 칸에서 이어서 표시
  useEffect(() => {
    if (!dataLoaded || firstPhotosReady) return undefined;

    const latestByCar = {};
    (carListRows || []).forEach((r) => {
      if (!(r.images || []).length) return;
      const cur = latestByCar[r.car_number];
      if (!cur || String(r.service_dt) > String(cur.service_dt)) latestByCar[r.car_number] = r;
    });
    const urls = Object.values(latestByCar).map((r) => encodeURI(`${API_BASE_URL}${r.images[0].exterior_image}`));

    const preload = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
      });

    let cancelled = false;
    Promise.race([Promise.all(urls.map(preload)), new Promise((resolve) => setTimeout(resolve, 8000))]).then(() => {
      if (!cancelled) setFirstPhotosReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [dataLoaded, carListRows, firstPhotosReady]);

  // 조회 중(첫 진입 대표 사진 준비 포함) 여부와 조회 로딩 창을 띄운 시각
  const busy = loading || !firstPhotosReady;
  const loadingOpenedAtRef = useRef(0);

  // 조회 로딩 창이 떠 있으면 닫기 (저장 결과 등 다른 Swal 창은 유지)
  const closeFetchLoading = () => {
    if (Swal.isVisible() && (Swal.getTitle()?.textContent || "").includes("불러오는 중")) Swal.close();
  };

  // 조회 중에는 Swal 로딩 창 표시 (사용자 관리와 같은 방식, 너무 빨리 끝나도 최소 표시 시간만큼 유지해 깜빡임 방지)
  // 저장 중 다시 조회할 때는 이미 떠 있는 저장 로딩 창을 그대로 사용
  useEffect(() => {
    if (busy) {
      if (!saving) {
        showSwalLoading("불러오는 중...", "차량 기록을 조회하고 있습니다.");
        loadingOpenedAtRef.current = Date.now();
      }
      return undefined;
    }
    if (!loadingOpenedAtRef.current) return undefined;
    const remain = Math.max(MIN_LOADING_MODAL_MS - (Date.now() - loadingOpenedAtRef.current), 0);
    loadingOpenedAtRef.current = 0;
    const timer = setTimeout(closeFetchLoading, remain);
    return () => clearTimeout(timer);
  }, [busy]);

  // 조회 중 탭을 벗어나면 조회 로딩 창 닫기
  useEffect(() => closeFetchLoading, []);

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

  // 차량 요약값 (저장된 기록 기준 현재 주행거리·최근 기록일·누적 건수·대표 사진)
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

  // 정비 내역 칸 열기/추가 취소 (취소 시 입력한 정비 내용을 마지막 조회 값으로 되돌리고 칸 닫기)
  const handleToggleService = (rowIndex, open) => {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        if (open) return { ...row, showService: true };
        const original = originalRows[rowIndex] || {};
        const restored = Object.fromEntries(SERVICE_KEYS.map((key) => [key, original[key] ?? ""]));
        return { ...row, ...restored, showService: false };
      })
    );
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

  // 주행거리 앞뒤 기록 비교 안내 문구 (같은 차량의 이전 기록보다 작거나 다음 기록보다 크면 문구 반환)
  // 새 기록이거나 주행거리를 바꾼 기록만 검사 (기존 저장 데이터는 안내하지 않음)
  const getMileageWarning = (rowIndex) => {
    const row = rows[rowIndex];
    const km = toNum(row?.mileage);
    if (!km || !row.service_dt) return "";
    if (!isRowNew(rowIndex) && normalize(originalRows[rowIndex]?.mileage) === normalize(row.mileage)) return "";

    const others = rows.filter(
      (r, i) => i !== rowIndex && r.car_number === row.car_number && r.service_dt && toNum(r.mileage) > 0
    );
    const prev = others
      .filter((r) => r.service_dt < row.service_dt)
      .sort((a, b) => b.service_dt.localeCompare(a.service_dt))[0];
    const next = others
      .filter((r) => r.service_dt > row.service_dt)
      .sort((a, b) => a.service_dt.localeCompare(b.service_dt))[0];

    if (prev && km < toNum(prev.mileage)) {
      return `이전 기록(${prev.service_dt} ${toNum(prev.mileage).toLocaleString()}km)보다 작습니다.`;
    }
    if (next && km > toNum(next.mileage)) {
      return `다음 기록(${next.service_dt} ${toNum(next.mileage).toLocaleString()}km)보다 큽니다.`;
    }
    return "";
  };

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

    // 주행거리가 앞뒤 기록과 맞지 않는 기록이 있으면 그대로 저장할지 확인 (계기판 교체 등 예외 허용)
    const mileageWarnings = rows
      .map((row, rowIndex) => ({ row, message: getMileageWarning(rowIndex) }))
      .filter(({ message }) => message);
    if (mileageWarnings.length > 0) {
      const result = await Swal.fire({
        title: "주행거리를 확인해 주세요.",
        html: mileageWarnings
          .map(({ row, message }) => `${getCarName(row.car_number)} ${row.service_dt}: ${toNum(row.mileage).toLocaleString()}km<br/>→ ${message}`)
          .join("<br/><br/>"),
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "그대로 저장",
        cancelButtonText: "수정하기",
        confirmButtonColor: "#1976d2",
        cancelButtonColor: "#9e9e9e",
      });
      if (!result.isConfirmed) return false;
    }

    setSaving(true);
    showSwalLoading("저장 중...", "저장 준비중...");

    // 서버 응답 code가 200이 아니면 실패로 처리 (실패도 HTTP 200으로 돌려주는 API 대응)
    const checkOk = (res, label) => {
      if (res?.data?.code !== 200) throw new Error(`${label} 실패: ${res?.data?.message || "서버 응답 오류"}`);
    };

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
          // 경고창이 로딩 창을 대신했으므로 남은 기록 저장을 위해 로딩 창 다시 표시
          showSwalLoading("저장 중...", "저장 준비중...");
          allSaved = false;
          continue;
        }

        // (1) 새 기록이면 기록 먼저 저장 (사진이 기록일자 기준으로 연결됨)
        if (newRow) {
          updateSwalLoading(`${row.service_dt} 기록 저장 중...`);
          const res = await api.post("/Business/CarSave", [buildSaveRow(row, user_id)], {
            headers: { "Content-Type": "application/json" },
          });
          checkOk(res, "기록 저장");
        }

        // (2) 삭제 예정 사진 삭제
        for (const [i, img] of row.deletedImages.entries()) {
          updateSwalLoading(`사진 삭제 중... (${i + 1}/${row.deletedImages.length}장)`);
          const res = await api.delete("/Business/CarFileDelete", {
            params: {
              car_number: row.car_number,
              service_dt: row.service_dt,
              image_id: img.image_id,
              exterior_image: img.exterior_image,
              user_id,
            },
          });
          checkOk(res, "사진 삭제");
        }

        // (3) 추가 예정 사진 축소 후 업로드 (파일 순서와 같은 순서로 위치 라벨 전달)
        if (row.pendingFiles.length > 0) {
          const fd = new FormData();
          fd.append("car_number", row.car_number);
          fd.append("service_dt", row.service_dt);
          fd.append("user_id", user_id);
          // 사진을 한 장씩 줄이면서 진행 장수 표시
          for (const [i, pf] of row.pendingFiles.entries()) {
            updateSwalLoading(`사진 줄이는 중... (${i + 1}/${row.pendingFiles.length}장)`);
            fd.append("files", await compressImageFile(pf.file));
          }
          updateSwalLoading(`사진 ${row.pendingFiles.length}장 업로드 중...`);
          fd.append("labels", JSON.stringify(row.pendingFiles.map((pf) => pf.label.trim())));
          const res = await api.post("/Business/CarFilesUpload", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          checkOk(res, "사진 업로드");
        }

        // (4) 기존 사진 위치 라벨 수정
        if (labelChanges.length > 0) {
          updateSwalLoading("사진 위치 라벨 저장 중...");
          const res = await api.post(
            "/Business/CarFileLabelSave",
            labelChanges.map((img) => ({
              image_id: img.image_id,
              car_number: row.car_number,
              image_label: img.image_label.trim(),
            })),
            { headers: { "Content-Type": "application/json" } }
          );
          checkOk(res, "사진 라벨 저장");
        }

        // (5) 기존 기록의 입력값 저장
        if (!newRow && fieldChanged) {
          updateSwalLoading(`${row.service_dt} 기록 저장 중...`);
          const res = await api.post("/Business/CarSave", [buildSaveRow(row, user_id)], {
            headers: { "Content-Type": "application/json" },
          });
          checkOk(res, "기록 저장");
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

  // 요약 카드·전체로 이동·차량 선택으로 화면 전환 (미저장 변경이 있으면 확인 후 이동, 이동하면 true)
  const handleSelectCar = async (nextCar) => {
    if (nextCar === selectedCar) return true;
    if (!(await leaveCheckRef.current())) return false;
    setSelectedCar(nextCar);
    return true;
  };

  // 상세 화면에서 브라우저 뒤로가기 시 전체 차량 요약 화면으로 이동
  useDetailBackGuard(selectedCar !== null, () => handleSelectCar(null));


  // ================================
  // 차량 상세: 상태 기록 카드 한 건
  // ================================
  const renderRecordCard = ({ row, rowIndex }, index) => {
    const newRow = isRowNew(rowIndex);
    const changed = isRowChanged(rowIndex);
    const photoCount = getPhotoCount(row);
    // 주행거리 앞뒤 기록 비교 안내 문구 (문제 없으면 빈 문자열)
    const mileageWarning = getMileageWarning(rowIndex);
    // 저장된 정비 내용이 있는 기록 여부 (이미 저장된 정비 내역은 추가 취소 대상이 아니라 칸 항상 표시)
    const hasSavedService = SERVICE_KEYS.some((key) => normalize(originalRows[rowIndex]?.[key]));
    // 정비 내역 칸 표시 여부 (정비 내역 추가 버튼을 눌렀거나 입력된 정비 내용이 있는 경우)
    const showService = row.showService || SERVICE_KEYS.some((key) => normalize(row[key]));

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
            // 같은 차량 앞뒤 기록과 맞지 않으면 빨간 테두리와 안내 문구
            error={Boolean(mileageWarning)}
            helperText={mileageWarning || undefined}
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
            {/* 정비 내역 칸 추가/추가 취소 버튼 (저장된 정비 내역이 있는 기록은 미표시) */}
            {!hasSavedService && (
              <MDButton
                variant="outlined"
                color={showService ? "error" : "info"}
                size="small"
                onClick={() => handleToggleService(rowIndex, !showService)}
                disabled={saving}
                sx={buttonSx}
              >
                {showService ? "정비 내역 취소" : "+ 정비 내역"}
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
  const renderSummary = () => {
    if (carSelectList.length === 0) {
      return (
        <div style={{ ...cardStyle, padding: 20, textAlign: "center", fontSize: 13, color: "#7b809a" }}>
          등록된 차량이 없습니다. 차량등록을 눌러 차량을 추가해 주세요.
        </div>
      );
    }

    // 전체 차량의 저장된 기록 중 최신 기록 목록 (기록일자 최신순)
    const recentRecords = originalRows
      .filter((r) => r?.service_dt)
      .sort((a, b) => String(b.service_dt).localeCompare(String(a.service_dt)))
      .slice(0, RECENT_COUNT);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>
      {/* 차량별 요약 카드 목록 (PC 한 줄 3~4대, 클릭 시 상세 화면 이동) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
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
              <PhotoThumb value={summary.photo} onView={() => {}} height={isMobile ? 140 : 200} />
              {/* 현재 주행거리 */}
              <div style={{ fontSize: 18, fontWeight: 800, color: summary.mileage ? ACCENT : "#9aa6b1" }}>
                {summary.mileage ? `${summary.mileage} km` : "주행거리 미입력"}
              </div>
              {/* 최근 기록일·저장 전 배지 */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <Badge label={summary.lastDt ? `최근 ${summary.lastDt}` : "기록 없음"} bg="#f2f5f7" fg="#667584" />
                {changed && <Badge label="저장 전" bg="#fdecea" fg="#d32f2f" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* 전체 차량 최근 기록 목록 (클릭 시 해당 차량 상세 화면 이동) */}
      <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#344767", borderBottom: "1px solid #eef2f5" }}>
          최근 기록
        </div>
        {recentRecords.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "#7b809a" }}>등록된 기록이 없습니다.</div>
        ) : (
          recentRecords.map((r) => {
            // 기록 내용 미리보기 (정비내용 우선, 없으면 상태 메모 첫 줄)
            const note = String(r.service_note || r.exterior_note || "").trim().split("\n")[0];
            return (
              // 최근 기록 한 줄 (기록일자·차량·주행거리·내용·정비 비용)
              <div
                key={`${r.car_number}-${r.service_dt}`}
                onClick={() => handleSelectCar(r.car_number)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  gap: isMobile ? "4px 10px" : 14,
                  padding: "10px 14px",
                  borderBottom: "1px solid #f2f5f7",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#7b809a", whiteSpace: "nowrap" }}>{r.service_dt}</span>
                <span style={{ fontWeight: 700, color: "#344767", whiteSpace: "nowrap" }}>{getCarName(r.car_number)}</span>
                <span style={{ color: ACCENT, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {toNum(r.mileage) > 0 ? `${toNum(r.mileage).toLocaleString()} km` : "-"}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: isMobile ? "100%" : 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: note ? "#344767" : "#9aa6b1",
                  }}
                >
                  {note || "내용 없음"}
                </span>
                {toNum(r.service_amt) > 0 && (
                  <Badge label={`정비 ${toNum(r.service_amt).toLocaleString()}원`} bg="#fff3e6" fg="#a55d1d" />
                )}
                {!isMobile && <ChevronRight size={16} color="#9aa6b1" />}
              </div>
            );
          })
        )}
      </div>
      </div>
    );
  };

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
          pb: 0,
          // 차량 수 문구가 왼쪽 끝에 붙지 않도록 카드 영역과 같은 왼쪽 여백
          pl: 1,
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
          {/* 요약 화면: 차량등록 / 상세 화면: 선택 차량 상태 기록 추가 */}
          <MDButton
            variant="gradient"
            color="info"
            onClick={selectedCar ? handleAddRow : handleModalOpen}
            disabled={saving}
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : undefined }}
          >
            {selectedCar ? "상태 기록 추가" : "차량등록"}
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
        // 카드가 왼쪽 끝에 붙지 않도록 왼쪽 여백
        pl={1}
        sx={{
          height: boardAreaHeight ?? (isMobile ? "60vh" : "75vh"),
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* 첫 진입 조회·대표 사진 준비 전에는 비워 두고 로딩 창만 표시 */}
        {firstPhotosReady && (selectedCar ? renderDetail() : renderSummary())}
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
    </>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}

CorCarTabStyled.propTypes = {
  embedded: PropTypes.bool,
};

export default CorCarTabStyled;
