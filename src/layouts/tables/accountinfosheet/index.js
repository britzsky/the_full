/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, forwardRef, useEffect, useRef, useCallback } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";

import Modal from "@mui/material/Modal";
import IconButton from "@mui/material/IconButton";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";

import DatePicker from "react-datepicker";
import {
  Grid,
  Box,
  MenuItem,
  TextField,
  Card,
  Autocomplete,
  Tooltip,
} from "@mui/material";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PreviewOverlay from "utils/PreviewOverlay";
import useAccountInfosheetData from "./data/AccountInfoSheetData";
import PropTypes from "prop-types";
import Swal from "sweetalert2";
import api from "api/api";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "config";

// =========================
// ✅ 계약기간 직접입력 유틸
// =========================
function formatDateObj(dt) {
  if (!dt) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ✅ YYYY-MM-DD 포맷 만들기(숫자만, 자동 하이픈)
function formatYMDInput(raw) {
  const digits = String(raw || "")
    .replace(/\D/g, "")
    .slice(0, 8); // YYYYMMDD
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);

  let out = y;
  if (m) out += `-${m}`;
  if (d) out += `-${d}`;
  return out;
}

// ✅ "YYYY-MM-DD" 유효하면 Date 반환, 아니면 null
function tryParseYMD(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return null;
  const [yy, mm, dd] = String(ymd).split("-").map(Number);
  const dt = new Date(yy, mm - 1, dd);
  if (dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
}

// ✅ DatePicker 커스텀 인풋 (컴포넌트 밖에 두어야 포커스 안날아감)
const DatePickerTextInput = forwardRef(function DatePickerTextInput(
  { value, onClick, onChange, placeholder, inputColor = "black" },
  ref
) {
  return (
    <MDInput
      value={value || ""}
      onClick={onClick}
      onChange={onChange}
      placeholder={placeholder}
      inputRef={ref}
      sx={{
        flex: 1,
        fontSize: "13px",
        "& input": {
          padding: "4px 4px",
          height: "20px",
          color: inputColor,
        },
      }}
    />
  );
});

DatePickerTextInput.propTypes = {
  value: PropTypes.string,
  onClick: PropTypes.func,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  inputColor: PropTypes.string,
};

// 숫자 컬럼만 천단위 콤마 포맷
const numericCols = [
  "basic_price",
  "diet_price",
  "before_diet_price",
  "elderly",
  "snack",
  "cesco",
  "food_process",
  "dishwasher",
  "water_puri",
  "utility_bills",
  "extra_diet1_price",
  "extra_diet2_price",
  "extra_diet3_price",
  "extra_diet4_price",
  "extra_diet5_price",
  "dishwasher_cnt",
  "water_puri_cnt",
];

const formatNumber = (num) => {
  if (num === null || num === undefined || num === "") return "";
  return Number(num).toLocaleString();
};

// ✅ 상단 첨부파일 타입(순서 = 이전/다음 순서)
const FILE_TYPES = [
  { key: "business_report", label: "영업신고증" },
  { key: "business_regist", label: "사업자등록증" },
  { key: "kitchen_drawing", label: "주방도면" },
  { key: "nutritionist_room_img", label: "영양사실" },
  { key: "chef_lounge_img", label: "휴게실" },
  { key: "meal_service_contract", label: "위탁급식계약서" },
];

function AccountInfoSheet() {
  // 🔹 추가 식단가 모달 상태
  const [extraDietModalOpen, setExtraDietModalOpen] = useState(false);

  // 🔹 추가 식단가 값 (5개 slot)
  const [extraDiet, setExtraDiet] = useState(
    Array.from({ length: 5 }, () => ({ name: "", price: "" }))
  );

  const { account_id: paramAccountId } = useParams();
  const navigate = useNavigate();
  const [selectedAccountId, setSelectedAccountId] = useState(paramAccountId || "");
  const [accountInput, setAccountInput] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  const {
    basicInfo,
    priceRows,
    etcRows,
    managerRows,
    eventRows,
    businessImgRows,
    accountList,
    loading,
    saveData,
    fetchAllData,
  } = useAccountInfosheetData(selectedAccountId);

  const selectedAccountOption = useMemo(
    () =>
      (accountList || []).find((a) => String(a.account_id) === String(selectedAccountId)) || null,
    [accountList, selectedAccountId]
  );

  const isDeletedAccount = String(selectedAccountOption?.del_yn ?? "N").toUpperCase() === "Y";

  const showDeletedAccountReadonlyAlert = useCallback(() => {
    if (Swal.isVisible()) return;
    Swal.fire("안내", "삭제업장은 수정할 수 없습니다.", "info");
  }, []);

  const handleBlockedMouseAction = useCallback(
    (e) => {
      if (!isDeletedAccount) return;
      e.preventDefault();
      e.stopPropagation();
      showDeletedAccountReadonlyAlert();
    },
    [isDeletedAccount, showDeletedAccountReadonlyAlert]
  );

  useEffect(() => {
    if (isDeletedAccount && extraDietModalOpen) {
      setExtraDietModalOpen(false);
    }
  }, [isDeletedAccount, extraDietModalOpen]);

  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountList || [];
    const qLower = q.toLowerCase();
    const exact = list.find((a) => String(a?.account_name || "").toLowerCase() === qLower);
    const partial =
      exact ||
      list.find((a) =>
        String(a?.account_name || "")
          .toLowerCase()
          .includes(qLower)
      );
    if (partial) {
      setSelectedAccountId(partial.account_id);
      setAccountInput(partial.account_name || q);
    }
  }, [accountInput, accountList]);

  const didInitAccountRef = useRef(false);

  // ✅ accountList 로딩 완료 후, URL에서 받은 account_id가 있을 때 자동 선택
  useEffect(() => {
    if (accountList.length === 0) return;

    // ✅ paramAccountId는 최초 1회만 반영
    if (paramAccountId && !didInitAccountRef.current) {
      const found = accountList.find((a) => a.account_id === paramAccountId);
      if (found) {
        setSelectedAccountId(found.account_id);
        didInitAccountRef.current = true;
        return;
      }
    }

    // ✅ param이 없거나 못 찾았고, 아직 선택이 없으면 첫번째로
    if (!selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, paramAccountId]); // ✅ selectedAccountId 의존성 제거

  // ✅ 선택된 account_id로 조회
  useEffect(() => {
    if (selectedAccountId) {
      fetchAllData(selectedAccountId);
    }
  }, [selectedAccountId]);

  const [selectedFiles, setSelectedFiles] = useState({
    business_report: null,
    business_regist: null,
    kitchen_drawing: null,
    nutritionist_room_img: null,
    chef_lounge_img: null,
    meal_service_contract: null,
  });

  // ✅ "{k=v, k2=v2}" 형태 문자열 파싱
  const parseServerMapString = (s) => {
    if (!s || typeof s !== "string") return {};
    const trimmed = s.trim();
    const body = trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed.slice(1, -1) : trimmed;

    const out = {};
    body.split(",").forEach((chunk) => {
      const part = chunk.trim();
      if (!part) return;
      const eq = part.indexOf("=");
      if (eq < 0) return;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      out[k] = v;
    });
    return out;
  };

  // ============================================================
  // ✅ 첨부파일 미리보기 공통 오버레이
  // ============================================================
  const fileIconSx = { color: "#1e88e5" };

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ✅ blob url cache (type별)
  const blobCacheRef = useRef({}); // { [type]: { file: File, url: string } }

  const safeJoinUrl = useCallback((path) => {
    if (!path) return "";
    const p = String(path);
    if (/^https?:\/\//i.test(p)) return p;

    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    const pp = p.startsWith("/") ? p : `/${p}`;
    return `${base}${pp}`;
  }, []);

  // 저장된 파일은 전용 조회 API 경로로 미리보기 URL을 구성한다.
  const buildFilePreviewUrl = useCallback((path) => {
    if (!path) return "";
    if (/^(https?:\/\/|blob:|data:)/i.test(path)) return path;
    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    const params = new URLSearchParams();
    params.set("file_path", String(path).startsWith("/") ? String(path) : `/${path}`);
    return `${base}/Account/AccountStoredFileView?${params.toString()}`;
  }, []);

  const getItemFromSelected = useCallback(
    (type) => {
      const v = selectedFiles[type];
      if (!v) return null;

      // 업로드 전: File
      if (v instanceof File) {
        return {
          type,
          label: FILE_TYPES.find((x) => x.key === type)?.label || type,
          kind: "file",
          file: v,
        };
      }

      // 업로드 후: {name, path}
      if (typeof v === "object" && v.path) {
        return {
          type,
          label: FILE_TYPES.find((x) => x.key === type)?.label || type,
          kind: "path",
          path: String(v.path),
          name: v.name || "",
        };
      }

      // 혹시 path 문자열만 들어온 경우도 대응
      if (typeof v === "string") {
        return {
          type,
          label: FILE_TYPES.find((x) => x.key === type)?.label || type,
          kind: "path",
          path: String(v),
          name: String(v).split("/").pop(),
        };
      }

      return null;
    },
    [selectedFiles]
  );

  // ✅ 현재 아이템의 src 만들기 (File이면 blob url 생성/캐시)
  const getSrcOfItem = useCallback(
    (it) => {
      if (!it) return "";

      if (it.kind === "path") {
        return buildFilePreviewUrl(it.path);
      }

      if (it.kind === "file") {
        const cached = blobCacheRef.current[it.type];
        if (cached?.file === it.file && cached?.url) return cached.url;

        // 기존 url 있으면 revoke
        if (cached?.url) {
          try {
            URL.revokeObjectURL(cached.url);
          } catch (e) { }
        }

        const url = URL.createObjectURL(it.file);
        blobCacheRef.current[it.type] = { file: it.file, url };
        return url;
      }

      return "";
    },
    [buildFilePreviewUrl]
  );

  // 파일명/경로에서 확장자를 추출한다.
  const getFileExtension = useCallback((value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const clean = raw.split("?")[0].split("#")[0];
    const idx = clean.lastIndexOf(".");
    if (idx < 0) return "";
    return clean.slice(idx + 1).toLowerCase();
  }, []);

  // PreviewOverlay 전달용 kind를 확장자 기준으로 결정한다.
  const resolvePreviewKind = useCallback(
    (it) => {
      const baseName = it?.kind === "file" ? it?.file?.name : it?.name || it?.path || "";
      const ext = getFileExtension(baseName);
      if (ext === "pdf") return "pdf";
      if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
      if (["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "heic", "heif"].includes(ext)) {
        return "image";
      }
      return "file";
    },
    [getFileExtension]
  );

  // 뷰어에 들어갈 아이템 목록(순서 고정)
  const previewFiles = useMemo(() => {
    const arr = [];
    FILE_TYPES.forEach(({ key, label }) => {
      const it = getItemFromSelected(key);
      if (!it) return;
      if (!(it.kind === "file" || (it.kind === "path" && it.path))) return;

      const url = getSrcOfItem(it);
      if (!url) return;

      arr.push({
        type: key,
        url,
        name: it?.name || it?.file?.name || label,
        kind: resolvePreviewKind(it),
      });
    });
    return arr;
  }, [getItemFromSelected, getSrcOfItem, resolvePreviewKind]);

  // ✅ unmount 시 blob url cleanup
  useEffect(() => {
    return () => {
      const m = blobCacheRef.current || {};
      Object.keys(m).forEach((k) => {
        const url = m[k]?.url;
        if (url) {
          try {
            URL.revokeObjectURL(url);
          } catch (e) { }
        }
      });
      blobCacheRef.current = {};
    };
  }, []);

  const handleCloseViewer = useCallback(() => setViewerOpen(false), []);

  // ✅ 이미지 목록이 바뀌면 index 보정
  useEffect(() => {
    if (!viewerOpen) return;
    if (!previewFiles.length) {
      setViewerIndex(0);
      return;
    }
    if (viewerIndex > previewFiles.length - 1) setViewerIndex(previewFiles.length - 1);
  }, [viewerOpen, previewFiles.length, viewerIndex]);

  const handleViewByType = useCallback(
    (type) => {
      // type에 해당하는 아이템이 목록에 있는지 확인
      const idx = previewFiles.findIndex((x) => x.type === type);
      if (idx < 0) return;
      setViewerIndex(idx);
      setViewerOpen(true);
    },
    [previewFiles]
  );

  const handleDownloadAny = useCallback(
    (it) => {
      if (!it) return;

      const filenameBase = it.label || it.type || "download";

      // 서버 path 다운로드: CorporateCardSheet 방식
      if (it.kind === "path" && it.path) {
        const url = safeJoinUrl(it.path);
        const filename = it.name || String(it.path).split("/").pop() || filenameBase;

        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 로컬 File 다운로드: blob url로
      if (it.kind === "file" && it.file) {
        const url = getSrcOfItem(it);
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.download = it.file.name || filenameBase;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    },
    [safeJoinUrl, getSrcOfItem]
  );

  // 첨부파일 유형별 미리보기 열기
  const handlePreviewByType = useCallback(
    (type) => {
      const it = getItemFromSelected(type);
      if (!it) return;
      handleViewByType(type);
    },
    [getItemFromSelected, handleViewByType]
  );

  // 첨부파일 유형별 다운로드 실행
  const handleDownloadByType = useCallback(
    (type) => {
      const it = getItemFromSelected(type);
      if (!it) return;
      handleDownloadAny(it);
    },
    [getItemFromSelected, handleDownloadAny]
  );

  // 버튼 클릭 시 input 클릭
  const handleFileSelect = (type) => {
    if (isDeletedAccount) {
      showDeletedAccountReadonlyAlert();
      return;
    }
    document.getElementById(type).click();
  };

  // ✅ 추가: 어떤 타입이 변경되었는지 추적
  const [dirtyFiles, setDirtyFiles] = useState(() => new Set());

  // input 변경 시 파일 상태 업데이트
  const handleFileChange = (type, e) => {
    if (isDeletedAccount) {
      e.target.value = "";
      showDeletedAccountReadonlyAlert();
      return;
    }

    const file = e.target.files?.[0] || null;

    // 같은 파일 다시 선택 가능하도록 value 초기화
    e.target.value = "";

    if (!file) return;

    setSelectedFiles((prev) => ({
      ...prev,
      [type]: file,
    }));

    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.add(type);
      return next;
    });
  };

  // ✅ 업로드 응답을 {key: path} 형태로 최대한 복원
  const normalizeUploadMap = (raw) => {
    if (!raw) return {};

    // 1) 이미 객체로 온 경우
    if (typeof raw === "object") return raw;

    // 2) 문자열인 경우
    const s = String(raw).trim();

    // 2-1) JSON처럼 생긴 경우 먼저 JSON.parse 시도
    // (예: {"business_report":"/image/a.png"} )
    if (s.startsWith("{") && s.includes(":")) {
      try {
        const obj = JSON.parse(s);
        if (obj && typeof obj === "object") return obj;
      } catch (e) {
        // ignore
      }
    }

    // 2-2) "{k=v, k2=v2}" 형태 파싱
    return parseServerMapString(s);
  };

  // 한 번에 업로드 (✅ dirty만)
  const handleFileUpload = async () => {
    if (isDeletedAccount) {
      showDeletedAccountReadonlyAlert();
      return;
    }

    const formData = new FormData();
    const account_id = basicInfo.account_id;
    formData.append("account_id", account_id);

    let hasFile = false;
    dirtyFiles.forEach((type) => {
      const file = selectedFiles[type];
      if (file instanceof File) {
        formData.append(type, file);
        hasFile = true;
      }
    });

    if (!hasFile) {
      Swal.fire("안내", "변경된(선택된) 파일이 없습니다.", "info");
      return;
    }

    try {
      const res = await api.post("/Account/AccountBusinessImgUpload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // ✅ 성공 판정(서버 규격에 맞춰 하나만 택)
      const ok = res?.status === 200 && (res?.data?.code === 200 || res?.data?.code === undefined); // code 없을 수도 있으니

      const raw = res?.data?.data ?? res?.data; // data가 없고 res.data에 있을 수도
      const map = normalizeUploadMap(raw);

      const keys = [
        "business_report",
        "business_regist",
        "kitchen_drawing",
        "nutritionist_room_img",
        "chef_lounge_img",
        "meal_service_contract",
      ];

      const next = {};
      keys.forEach((k) => {
        const filePath = map?.[k];
        if (filePath) next[k] = { name: String(filePath).split("/").pop(), path: filePath };
      });

      const hasAnyReturned = Object.keys(next).length > 0;

      if (!hasAnyReturned) {
        // ✅ 업로드는 성공했는데 서버가 path를 안 준 케이스:
        // 👉 초기화하면 안 됨. 서버값으로 다시 조회해서 맞추기.
        if (ok) {
          await fetchAllData(selectedAccountId); // ✅ 서버값으로 동기화
          setDirtyFiles(new Set()); // ✅ 업로드한 건 처리 완료로 본다
          Swal.fire("완료", "업로드 완료(응답 path 없음) - 재조회로 동기화했습니다.", "success");
          return;
        }

        // ok도 아니면 진짜 실패 가능성
        Swal.fire("실패", "업로드 응답을 확인할 수 없습니다.", "error");
        return;
      }

      // ✅ 정상: 내려온 애들 반영
      setSelectedFiles((prev) => ({ ...prev, ...next }));

      // ✅ 반영된 key만 dirty에서 제거
      setDirtyFiles((prev) => {
        const n = new Set(prev);
        Object.keys(next).forEach((k) => n.delete(k));
        return n;
      });

      Swal.fire("완료", "선택한 파일 업로드 완료!", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("실패", "업로드 실패!", "error");
    }
  };

  // 원본 데이터 (비교용)
  const [originalBasic, setOriginalBasic] = useState({});
  const [originalPrice, setOriginalPrice] = useState([]);
  const [originalEtc, setOriginalEtc] = useState([]);
  const [originalManager, setOriginalManager] = useState([]);
  const [originalEvent, setOriginalEvent] = useState([]);

  // 편집 데이터 (화면 표시용)
  const [formData, setFormData] = useState({});
  const [priceData, setPriceData] = useState([]);
  const [etcData, setEtcData] = useState([]);
  const [managerData, setManagerData] = useState([]);
  const [eventData, setEventData] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // ✅ 계약기간 입력용 텍스트(직접입력 지원)
  const [contractStartText, setContractStartText] = useState("");
  const [contractEndText, setContractEndText] = useState("");

  useEffect(() => {
    setFormData(basicInfo);
    setPriceData(priceRows);
    setEtcData(etcRows);
    setManagerData(managerRows);
    setEventData(eventRows);

    setOriginalBasic(basicInfo);
    setOriginalPrice(priceRows);
    setOriginalEtc(etcRows);
    setOriginalManager(managerRows);
    setOriginalEvent(eventRows);

    // ✅ 계약기간 초기화 + 텍스트 동기화
    if (basicInfo.contract_start) {
      const [y, m, d] = basicInfo.contract_start.split("-");
      const dt = new Date(y, m - 1, d);
      setStartDate(dt);
      setContractStartText(formatDateObj(dt));
    } else {
      setStartDate(null);
      setContractStartText("");
    }

    if (basicInfo.contract_end) {
      const [y, m, d] = basicInfo.contract_end.split("-");
      const dt = new Date(y, m - 1, d);
      setEndDate(dt);
      setContractEndText(formatDateObj(dt));
    } else {
      setEndDate(null);
      setContractEndText("");
    }

    const keys = [
      "business_report",
      "business_regist",
      "kitchen_drawing",
      "nutritionist_room_img",
      "chef_lounge_img",
      "meal_service_contract",
    ];

    // 서버에서 내려온 row
    const img = (businessImgRows && businessImgRows.length > 0 && businessImgRows[0]) || null;

    setSelectedFiles((prev) => {
      const updated = { ...prev };

      keys.forEach((key) => {
        const filePath = img?.[key];

        if (filePath) {
          updated[key] = {
            name: String(filePath).split("/").pop(),
            path: filePath,
          };
        } else {
          // ✅ 서버에 값이 없으면 input 비우기
          updated[key] = null;
        }
      });

      return updated;
    });

    // 🔹 extra_diet1~5 name/price 초기화 (priceRows[0] 기준으로 우선)
    const extraSource = priceRows[0] || basicInfo || {};

    const extras = Array.from({ length: 5 }, (_, i) => {
      const idx = i + 1;
      return {
        name: extraSource[`extra_diet${idx}_name`] || "",
        price:
          extraSource[`extra_diet${idx}_price`] !== undefined &&
            extraSource[`extra_diet${idx}_price`] !== null
            ? String(extraSource[`extra_diet${idx}_price`])
            : "",
      };
    });
    setExtraDiet(extras);
  }, [basicInfo, priceRows, etcRows, managerRows, eventRows, businessImgRows]);

  // 값 변경 핸들러
  const handleChange = (field, value) => {
    if (isDeletedAccount) return;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 🔹 식단가명 변경
  const handleExtraNameChange = (index, value) => {
    if (isDeletedAccount) return;
    setExtraDiet((prev) => prev.map((item, i) => (i === index ? { ...item, name: value } : item)));
  };

  // 🔹 식단가 가격(숫자만, 자동콤마)
  const handleExtraPriceChange = (index, rawValue) => {
    if (isDeletedAccount) return;
    const numeric = rawValue.replace(/[^\d]/g, "");
    setExtraDiet((prev) =>
      prev.map((item, i) => (i === index ? { ...item, price: numeric } : item))
    );
  };

  const normalizeVal = (v) => {
    if (v === undefined || v === null) return "";
    if (typeof v === "string") return v.trim().replace(/\s+/g, " ");
    return String(v);
  };

  const getColor = (field, value, rowIndex = null, tableType = null) => {
    let basicVal = "";
    if (tableType === "price") basicVal = originalPrice[rowIndex]?.[field];
    else if (tableType === "etc") basicVal = originalEtc[rowIndex]?.[field];
    else if (tableType === "manager") basicVal = originalManager[rowIndex]?.[field];
    else if (tableType === "event") basicVal = originalEvent[rowIndex]?.[field];
    else basicVal = originalBasic[field];

    const base = normalizeVal(basicVal);
    const current = normalizeVal(value);

    return base === current ? "black" : "red";
  };

  // 🔹 식단가 추가 버튼/모달 사용 여부
  const isExtraDietEnabled =
    Number(formData.account_type) === 4 || Number(formData.account_type) === 5;

  // 🔹 학교 / 산업체 여부 (문자/숫자 둘 다 대응)
  const isSchoolOrIndustry =
    formData.account_type === "학교" ||
    formData.account_type === "산업체" ||
    Number(formData.account_type) === 4 ||
    Number(formData.account_type) === 5;

  // ----------------- 테이블 컬럼 -----------------
  const priceTableColumns = useMemo(() => {
    const extraDietColumns = extraDiet
      .map((item, index) => ({
        idx: index + 1,
        name: item.name,
      }))
      .filter((item) => item.name && item.name.trim() !== "")
      .map((item) => ({
        header: item.name,
        accessorKey: `extra_diet${item.idx}_price`,
      }));

    const baseDietColumns = [
      { header: "식단가", accessorKey: "diet_price" },
      { header: "기초 식단가", accessorKey: "basic_price" },
      { header: "인상전 단가", accessorKey: "before_diet_price" },
      { header: "인상시점", accessorKey: "after_dt" },
    ];

    if (!isSchoolOrIndustry) {
      baseDietColumns.push(
        { header: "어르신", accessorKey: "elderly" },
        { header: "간식", accessorKey: "snack" },
        { header: "직원", accessorKey: "employ" }
      );
    }

    baseDietColumns.push(...extraDietColumns);

    return [
      { header: "식단가", columns: baseDietColumns },
      {
        header: "식수인원(마감기준)",
        columns: [
          { header: "만실", accessorKey: "full_room" },
          { header: "기초", accessorKey: "basic" },
          { header: "일반", accessorKey: "normal" },
          { header: "간식", accessorKey: "eat_snack" },
          { header: "경관식", accessorKey: "ceremony" },
          { header: "직원", accessorKey: "eat_employ" },
        ],
      },
      {
        header: "경비(신규영업, 중도운영)",
        columns: [
          { header: "음식물처리", accessorKey: "food_process" },
          { header: "유형", accessorKey: "food_process_type" },
          { header: "식기세척기", accessorKey: "dishwasher" },
          { header: "수량", accessorKey: "dishwasher_cnt" },
          { header: "세스코 방제", accessorKey: "cesco" },
          { header: "정수기", accessorKey: "water_puri" },
          { header: "수량", accessorKey: "water_puri_cnt" },
          { header: "수도광열비", accessorKey: "utility_bills" },
          { header: "경비비고", accessorKey: "expenses_note" },
        ],
      },
    ];
  }, [extraDiet, isSchoolOrIndustry]);

  const etcTableColumns = useMemo(
    () => [
      {
        header: "배식방법",
        columns: [
          { header: "세팅/바트/그릇", accessorKey: "setting_item" },
          { header: "조리실", accessorKey: "cuisine" },
          { header: "특이사항", accessorKey: "cuisine_note" },
          { header: "조식시간", accessorKey: "breakfast_time" },
          { header: "중식시간", accessorKey: "lunch_time" },
          { header: "석식시간", accessorKey: "dinner_time" },
          { header: "간식시간", accessorKey: "snack_time" },
        ],
      },
      {
        header: "구매",
        columns: [
          { header: "영양사", accessorKey: "name" },
          { header: "예산관리 특이사항", accessorKey: "budget_note" },
        ],
      },
      {
        header: "인력",
        columns: [
          { header: "인원", accessorKey: "members" },
          { header: "근무체", accessorKey: "work_system" },
        ],
      },
    ],
    []
  );

  const managerTableColumns = useMemo(
    () => [
      {
        header: "운영유지 유형",
        columns: [
          { header: "정수기 렌탈 여부", accessorKey: "puri_type" },
          { header: "가스", accessorKey: "gas_type" },
          { header: "사업자", accessorKey: "business_type" },
        ],
      },
      { header: "보험", columns: [{ header: "보험가입 현황", accessorKey: "insurance_note" }] },
      { header: "마감", columns: [{ header: "마감 특이사항", accessorKey: "finish_note" }] },
    ],
    []
  );

  const eventTableColumns = useMemo(
    () => [
      {
        header: "제안",
        columns: [
          { header: "만족도 조사", accessorKey: "satis_note" },
          { header: "위생점검", accessorKey: "hygiene_note" },
          { header: "이벤트", accessorKey: "event_note" },
          { header: "집단급식소 여부", accessorKey: "group_feed_yn" },
          { header: "생신잔치 여부", accessorKey: "birthday_note" },
          { header: "영양사실 여부", accessorKey: "nutritionist_room_yn" },
          { header: "조리사휴게실 여부", accessorKey: "chef_lounge_yn" },
        ],
      },
    ],
    []
  );

  // ✅ dropdown options
  const dropdownOptions = {
    puri_type: [
      { value: 0, label: "해당없음" },
      { value: 1, label: "고객사 렌탈" },
      { value: 2, label: "더채움 렌탈" },
      { value: 3, label: "고객사 소유" },
      { value: 4, label: "더채움 소유" },
      { value: 5, label: "고객사렌탈+더채움렌탈" },
      { value: 6, label: "고객사렌탈+더채움소유" },
      { value: 7, label: "고객사소유+더채움렌탈" },
      { value: 8, label: "더채움소유+더채움소유" },
    ],
    gas_type: [
      { value: 0, label: "해당없음" },
      { value: 1, label: "도시가스" },
      { value: 2, label: "LPG" },
    ],
    business_type: [
      { value: 0, label: "해당없음" },
      { value: 1, label: "개인" },
      { value: 2, label: "법인" },
      { value: 3, label: "애단원" },
    ],
    food_process_type: [
      { value: 0, label: "해당없음" },
      { value: 1, label: "고객사+업체" },
      { value: 2, label: "고객사+종량제" },
      { value: 3, label: "더채움+업체" },
      { value: 4, label: "더채움+종량제" },
    ],
  };

  // ✅ Y/N 공통 옵션
  const yesNoOptions = [
    { value: "N", label: "N" },
    { value: "Y", label: "Y" },
  ];

  const columnWidths = {
    diet_price: "3%",
    basic_price: "3%",
    before_diet_price: "3%",
    after_dt: "4%",
    elderly: "3%",
    snack: "3%",
    employ: "3%",
    extra_diet1_price: "4%",
    extra_diet2_price: "4%",
    extra_diet3_price: "4%",
    extra_diet4_price: "4%",
    extra_diet5_price: "4%",
    full_room: "7%",
    basic: "3%",
    normal: "3%",
    eat_snack: "3%",
    ceremony: "3%",
    eat_employ: "3%",
    food_process: "3%",
    dishwasher: "3%",
    cesco: "3%",
    water_puri: "3%",
    utility_bills: "3%",
    expenses_note: "5%",
    setting_item: "5%",
    cuisine: "3%",
    cuisine_note: "5%",
    name: "3%",
    budget_note: "5%",
    breakfast_time: "2%",
    lunch_time: "2%",
    dinner_time: "2%",
    snack_time: "2%",
    members: "5%",
    work_system: "20%",
    puri_type: "7%",
    gas_type: "7%",
    business_type: "7%",
    insurance_note: "25%",
    finish_note: "25%",
    satis_note: "33%",
    hygiene_note: "33%",
    event_note: "33%",
    dishwasher_cnt: "2%",
    water_puri_cnt: "2%",
    food_process_type: "170px",
    birthday_note: "2%",
    group_feed_yn: "2%",
    nutritionist_room_yn: "2%",
    chef_lounge_yn: "2%",
  };

  const columnMinWidths = {
    food_process_type: "170px",
  };

  // ----------------- 공통 테이블 렌더 -----------------
  const renderTable = (dataState, setDataState, tableType, columns) => {
    const table = useReactTable({
      data: dataState,
      columns,
      getCoreRowModel: getCoreRowModel(),
    });

    const getOriginal = (rowIndex, field) => {
      if (tableType === "price") return originalPrice[rowIndex]?.[field];
      if (tableType === "etc") return originalEtc[rowIndex]?.[field];
      if (tableType === "manager") return originalManager[rowIndex]?.[field];
      if (tableType === "event") return originalEvent[rowIndex]?.[field];
      return "";
    };

    const nonEditableCols = [
      "name",
      "members",
      "work_system",
      "puri_type",
      "gas_type",
      "business_type",
      "food_process_type",
      "group_feed_yn",
      "nutritionist_room_yn",
      "chef_lounge_yn",
    ];

    return (
      <MDBox
        sx={{
          overflowX: "auto",
          "& table": { borderCollapse: "collapse", width: "max-content", minWidth: "100%" },
          "& th, & td": {
            border: "1px solid #686D76",
            textAlign: "center",
            padding: "3px",
            fontSize: "13px",
            whiteSpace: "nowrap",
          },
          "& th": { backgroundColor: "#f0f0f0" },
          "& .edited-cell": { color: "#d32f2f", fontWeight: 500 },
        }}
      >
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} colSpan={header.colSpan}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const colKey = cell.column.columnDef.accessorKey;
                  const isNumeric = numericCols.includes(colKey);

                  const currentValue = dataState[rowIndex]?.[colKey] ?? "";
                  const originalValue = getOriginal(rowIndex, colKey);

                  const parseVal = (val) => {
                    if (isNumeric) return Number(String(val).replace(/,/g, "")) || 0;
                    return val ?? "";
                  };

                  const changed = parseVal(currentValue) !== parseVal(originalValue);

                  // ✅ select 컬럼들
                  const isSelectNumber = [
                    "puri_type",
                    "gas_type",
                    "business_type",
                    "food_process_type",
                  ].includes(colKey);
                  const isSelectYN = [
                    "group_feed_yn",
                    "nutritionist_room_yn",
                    "chef_lounge_yn",
                  ].includes(colKey);

                  return (
                    <td
                      key={cell.id}
                      contentEditable={!isDeletedAccount && !nonEditableCols.includes(colKey)}
                      suppressContentEditableWarning
                      style={{
                        color: changed ? "red" : "black",
                        padding: "3px",
                        width: columnWidths[colKey] || "auto",
                        minWidth: columnMinWidths[colKey] || "40px",
                        backgroundColor: isDeletedAccount ? "#f8f8f8" : "transparent",
                      }}
                      onBlur={(e) => {
                        if (isDeletedAccount || nonEditableCols.includes(colKey)) return;

                        let newValue = e.target.innerText.trim();
                        if (isNumeric) {
                          newValue = Number(newValue.replace(/,/g, "")) || 0;
                          e.currentTarget.innerText = formatNumber(newValue);
                        }

                        const updatedRows = dataState.map((r, idx) =>
                          idx === rowIndex ? { ...r, [colKey]: newValue } : r
                        );
                        setDataState(updatedRows);
                      }}
                    >
                      {/* ✅ 숫자 select */}
                      {isSelectNumber ? (
                        <select
                          value={currentValue ?? 0}
                          disabled={isDeletedAccount}
                          style={{
                            width: colKey === "food_process_type" ? "170px" : "100%",
                            minWidth: colKey === "food_process_type" ? "170px" : undefined,
                            color: String(currentValue) === String(originalValue) ? "black" : "red",
                            backgroundColor: isDeletedAccount ? "#f2f2f2" : undefined,
                          }}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const updatedRows = dataState.map((r, idx) =>
                              idx === rowIndex ? { ...r, [colKey]: v } : r
                            );
                            setDataState(updatedRows);
                          }}
                        >
                          {(dropdownOptions[colKey] || []).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : isSelectYN ? (
                        <select
                          value={String(currentValue || "N")}
                          disabled={isDeletedAccount}
                          style={{
                            width: "100%",
                            color: String(currentValue) === String(originalValue) ? "black" : "red",
                            backgroundColor: isDeletedAccount ? "#f2f2f2" : undefined,
                          }}
                          onChange={(e) => {
                            const v = e.target.value; // "N" or "Y"
                            const updatedRows = dataState.map((r, idx) =>
                              idx === rowIndex ? { ...r, [colKey]: v } : r
                            );
                            setDataState(updatedRows);
                          }}
                        >
                          {yesNoOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : isNumeric ? (
                        formatNumber(currentValue)
                      ) : (
                        currentValue
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </MDBox>
    );
  };

  // 🔹 extraDiet을 formData에 합쳐 payload 만드는 헬퍼
  const buildPayloadWithExtraDiet = () => {
    const updatedFormData = { ...formData };

    extraDiet.forEach((item, index) => {
      const idx = index + 1;
      updatedFormData[`extra_diet${idx}_name`] = item.name;
      updatedFormData[`extra_diet${idx}_price`] = item.price
        ? Number(String(item.price).replace(/,/g, ""))
        : 0;
    });

    return {
      formData: updatedFormData,
      priceData,
      etcData,
      managerData,
      eventData,
    };
  };

  // ----------------- 전체 저장 -----------------
  const handleSave = async () => {
    if (isDeletedAccount) {
      showDeletedAccountReadonlyAlert();
      return;
    }

    const user_id = localStorage.getItem("user_id") || "";

    // ✅ formData에 user_id 주입
    const _formData = { ...formData, user_id };

    // ✅ 각 테이블 row에 user_id 주입 (배열이면 map으로)
    const _priceData = (priceData || []).map((r) => ({ ...r, user_id }));
    const _etcData = (etcData || []).map((r) => ({ ...r, user_id }));
    const _managerData = (managerData || []).map((r) => ({ ...r, user_id }));
    const _eventData = (eventData || []).map((r) => ({ ...r, user_id }));

    const payload = {
      formData: _formData,
      priceData: _priceData,
      etcData: _etcData,
      managerData: _managerData,
      eventData: _eventData,
    };

    try {
      const res = await api.post("/Account/AccountInfoSave", payload);
      if (res.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        }).then(async (result) => {
          if (result.isConfirmed) {
            setOriginalBasic(formData);
            setOriginalPrice([...priceData]);
            setOriginalEtc([...etcData]);
            setOriginalManager([...managerData]);
            setOriginalEvent([...eventData]);
          }
        });
      }
    } catch (e) {
      Swal.fire("실패", e.message || "저장 중 오류 발생", "error");
    }
  };

  // 🔹 식단가 추가 버튼 클릭 시: Business/AccountEctDietList 조회 후 모달 오픈
  const handleOpenExtraDietModal = async () => {
    if (isDeletedAccount) {
      showDeletedAccountReadonlyAlert();
      return;
    }

    if (!selectedAccountId) {
      Swal.fire("안내", "거래처를 먼저 선택하세요.", "info");
      return;
    }

    try {
      const res = await api.get("/Business/AccountEctDietList", {
        params: { account_id: selectedAccountId },
      });

      const row = Array.isArray(res.data) ? res.data[0] || {} : res.data || {};

      const extraSource = Object.keys(row).length > 0 ? row : priceRows[0] || basicInfo || {};

      const extras = Array.from({ length: 5 }, (_, i) => {
        const idx = i + 1;
        return {
          name: extraSource[`extra_diet${idx}_name`] || "",
          price:
            extraSource[`extra_diet${idx}_price`] !== undefined &&
              extraSource[`extra_diet${idx}_price`] !== null
              ? String(extraSource[`extra_diet${idx}_price`])
              : "",
        };
      });

      setExtraDiet(extras);
      setExtraDietModalOpen(true);
    } catch (e) {
      console.error("추가 식단가 조회 실패:", e);
      Swal.fire("오류", "추가 식단가 조회 중 오류가 발생했습니다.", "error");
    }
  };

  const handleApplyExtraDiet = async () => {
    if (isDeletedAccount) {
      showDeletedAccountReadonlyAlert();
      return;
    }

    const payload = buildPayloadWithExtraDiet();
    try {
      const res = await api.post("/Business/AccountEctDietSave", payload);
      if (res.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "추가 식단가가 저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        }).then(async (result) => {
          if (result.isConfirmed) {
            await fetchAllData(selectedAccountId);

            setFormData(payload.formData);
            setOriginalBasic(payload.formData);
            setOriginalPrice([...priceData]);
            setOriginalEtc([...etcData]);
            setOriginalManager([...managerData]);
            setOriginalEvent([...eventData]);

            setExtraDietModalOpen(false);
          }
        });
      }
    } catch (e) {
      Swal.fire("실패", e.message || "추가 식단가 저장 중 오류 발생", "error");
    }
  };

  if (loading) {
    // 기존 loading 처리 필요 시 사용 (현재 훅에서 loading 사용)
    // return <LoadingScreen />;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar title="📋 고객사 상세관리" />

      {/* 버튼영역 */}
      <MDBox
        pt={1}
        pb={2}
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        {/* 첨부파일 업로드 및 미리보기 영역 */}
        <MDBox
          onMouseDownCapture={isDeletedAccount ? handleBlockedMouseAction : undefined}
          onClickCapture={isDeletedAccount ? handleBlockedMouseAction : undefined}
          sx={{
            display: "flex",
            gap: 0.5,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-start",
            ...(isDeletedAccount ? { cursor: "not-allowed" } : {}),
          }}
        >
          {FILE_TYPES.map(({ key: type, label }) => {
            const v = selectedFiles[type];
            const hasPreview =
              !!v && (v instanceof File || !!v?.path || (typeof v === "string" && v));

            return (
              <Box key={type} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <MDButton
                  variant="gradient"
                  color="success"
                  size="small"
                  onClick={() => handleFileSelect(type)}
                  sx={{
                    minWidth: 88,
                    height: 32,
                    px: 1,
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  {label}
                </MDButton>

                <Box
                  sx={{
                    minWidth: 70,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    px: 0.5,
                    border: "1px solid #CFD8DC",
                    borderRadius: "6px",
                    backgroundColor: "#fff",
                    mt: 0.06,
                  }}
                >
                  <Tooltip title={hasPreview ? "다운로드" : "다운로드 불가"}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!hasPreview}
                        sx={hasPreview ? { ...fileIconSx, mt: -0.25 } : { color: "#bdbdbd", mt: -0.25 }}
                        onClick={() => handleDownloadByType(type)}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Tooltip title={hasPreview ? "미리보기(창)" : "미리보기 불가"}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!hasPreview}
                        sx={hasPreview ? { ...fileIconSx, mt: -0.25 } : { color: "#bdbdbd", mt: -0.25 }}
                        onClick={() => handlePreviewByType(type)}
                      >
                        <ImageSearchIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                <input
                  type="file"
                  id={type}
                  style={{ display: "none" }}
                  disabled={isDeletedAccount}
                  onChange={(e) => handleFileChange(type, e)}
                />
              </Box>
            );
          })}

          <MDButton
            variant="gradient"
            color="primary"
            size="small"
            onClick={handleFileUpload}
            sx={{
              minWidth: 88,
              height: 32,
              px: 1,
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            업로드
          </MDButton>
        </MDBox>

        {/* 거래처 검색, 목록 이동, 저장 영역 */}
        <MDBox
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            justifyContent: "flex-start",
            flexWrap: "wrap",
            ml: "auto",
          }}
        >
          {(accountList || []).length > 0 && (
            <Autocomplete
              size="small"
              sx={{ minWidth: 220, mt: 0.25 }}
              options={accountList || []}
              value={selectedAccountOption}
              onChange={(_, newValue) => {
                // 입력 비움 시 거래처 선택 유지
                if (!newValue) return;
                setSelectedAccountId(newValue.account_id);
              }}
              inputValue={accountInput}
              onInputChange={(_, newValue) => setAccountInput(newValue)}
              open={accountOpen}
              onOpen={() => setAccountOpen(true)}
              onClose={() => setAccountOpen(false)}
              getOptionLabel={(option) => option?.account_name ?? ""}
              isOptionEqualToValue={(option, value) =>
                String(option?.account_id) === String(value?.account_id)
              }
              renderOption={(optionProps, option) => (
                <li
                  {...optionProps}
                  key={option.account_id}
                  style={{
                    ...(optionProps.style || {}),
                    color: String(option?.del_yn ?? "N").toUpperCase() === "Y" ? "#d32f2f" : "inherit",
                  }}
                >
                  {option?.account_name ?? ""}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="거래처 검색"
                  placeholder="거래처명을 입력"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      selectAccountByInput();
                      setAccountOpen(false);
                    }
                  }}
                  sx={{
                    "& .MuiInputBase-root": { height: 32, fontSize: 12 },
                    "& input": {
                      padding: "0 8px",
                      color: isDeletedAccount ? "#d32f2f" : "inherit",
                    },
                  }}
                />
              )}
            />
          )}

          <MDButton
            variant="gradient"
            color="secondary"
            size="small"
            onClick={() => navigate("/account")}
            sx={{ minWidth: 88, height: 32, px: 1, fontSize: 12, lineHeight: 1 }}
          >
            목록보기
          </MDButton>

          <MDButton
            variant="gradient"
            color="info"
            size="small"
            onClick={handleSave}
            sx={{ minWidth: 88, height: 32, px: 1, fontSize: 12, lineHeight: 1 }}
          >
            저장
          </MDButton>
        </MDBox>
      </MDBox>

      <MDBox sx={{ position: "relative" }}>
        {isDeletedAccount && (
          <Box
            onMouseDown={handleBlockedMouseAction}
            onClick={handleBlockedMouseAction}
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              cursor: "not-allowed",
              backgroundColor: "transparent",
            }}
          />
        )}

        {/* 상단 기본 정보 */}
        <Card sx={{ p: { xs: 1, sm: 1.5, lg: 2 }, mb: 1 }}>
          <Grid container spacing={2}>
            {/* 왼쪽 */}
            <Grid item xs={12} md={12} lg={6}>
              <Grid container spacing={{ xs: 1, sm: 1.25, lg: 2 }}>
                {/* 업장명 + 계약기간 */}
                <Grid
                  item
                  xs={12}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: { xs: 0.75, sm: 1 },
                    flexWrap: { xs: "wrap", sm: "wrap", lg: "nowrap" },
                    "& .react-datepicker-wrapper": {
                      flex: { xs: "1 1 calc(100% - 76px)", sm: "0 0 128px", lg: "0 0 112px" },
                      minWidth: { xs: 0, lg: 104 },
                      "& > div": { width: "100%" },
                    },
                    "& .react-datepicker-wrapper + .react-datepicker-wrapper": {
                      flex: { xs: "1 1 calc(100% - 76px)", sm: "0 0 128px", lg: "0 0 112px" },
                      ml: { xs: "68px", sm: 0 },
                    },
                  }}
                >
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "75px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    업장명
                  </MDTypography>
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(100% - 70px)", sm: "1 1 220px", lg: 1 },
                      minWidth: { xs: 0, sm: 180, lg: 0 },
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("account_name", formData.account_name),
                      },
                    }}
                    value={formData.account_name || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("account_name", e.target.value)}
                  />
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "75px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    계약기간
                  </MDTypography>
                  {/* ✅ 계약 시작: 달력 + 직접입력(포커스 안날아감) */}
                  <DatePicker
                    selected={startDate}
                    value={contractStartText}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="YYYY-MM-DD"
                    disabled={isDeletedAccount}
                    customInput={
                      <DatePickerTextInput
                        placeholder="YYYY-MM-DD"
                        inputColor={
                          String(contractStartText || "") ===
                            String(originalBasic.contract_start ?? "")
                            ? "black"
                            : "red"
                        }
                      />
                    }
                    onChange={(date) => {
                      if (isDeletedAccount) return;
                      setStartDate(date);
                      const ymd = date ? formatDateObj(date) : "";
                      setContractStartText(ymd);
                      handleChange("contract_start", ymd);
                    }}
                    onChangeRaw={(e) => {
                      if (isDeletedAccount) return;
                      const formatted = formatYMDInput(e.target.value);
                      setContractStartText(formatted);
                      handleChange("contract_start", formatted);

                      if (!formatted) {
                        setStartDate(null);
                        return;
                      }
                      if (formatted.length === 10) {
                        const parsed = tryParseYMD(formatted);
                        if (parsed) setStartDate(parsed);
                      }
                    }}
                  />
                  ~{/* ✅ 계약 종료: 달력 + 직접입력(포커스 안날아감) */}
                  <DatePicker
                    selected={endDate}
                    value={contractEndText}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="YYYY-MM-DD"
                    disabled={isDeletedAccount}
                    customInput={
                      <DatePickerTextInput
                        placeholder="YYYY-MM-DD"
                        inputColor={
                          String(contractEndText || "") === String(originalBasic.contract_end ?? "")
                            ? "black"
                            : "red"
                        }
                      />
                    }
                    onChange={(date) => {
                      if (isDeletedAccount) return;
                      setEndDate(date);
                      const ymd = date ? formatDateObj(date) : "";
                      setContractEndText(ymd);
                      handleChange("contract_end", ymd);
                    }}
                    onChangeRaw={(e) => {
                      if (isDeletedAccount) return;
                      const formatted = formatYMDInput(e.target.value);
                      setContractEndText(formatted);
                      handleChange("contract_end", formatted);

                      if (!formatted) {
                        setEndDate(null);
                        return;
                      }
                      if (formatted.length === 10) {
                        const parsed = tryParseYMD(formatted);
                        if (parsed) setEndDate(parsed);
                      }
                    }}
                  />
                </Grid>

                {/* 주소 */}
                <Grid
                  item
                  xs={12}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: { xs: 0.75, sm: 1, lg: 2 },
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                    paddingTop: "10px !important",
                  }}
                >
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "75px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    주소
                  </MDTypography>
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(100% - 70px)", sm: 1 },
                      minWidth: 0,
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("account_address", formData.account_address),
                      },
                    }}
                    value={formData.account_address || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("account_address", e.target.value)}
                  />
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(100% - 70px)", sm: 1 },
                      ml: { xs: "62px", sm: 0 },
                      minWidth: 0,
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("account_address_detail", formData.account_address_detail),
                      },
                    }}
                    value={formData.account_address_detail || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("account_address_detail", e.target.value)}
                  />
                </Grid>

                {/* 담당자1 */}
                <Grid
                  item
                  xs={12}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: { xs: 0.75, sm: 1 },
                    flexWrap: { xs: "wrap", sm: "wrap", lg: "nowrap" },
                    paddingTop: "10px !important",
                  }}
                >
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "65px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    1.담당자명
                  </MDTypography>
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(50% - 76px)", sm: "1 1 120px", lg: 0.8 },
                      minWidth: { xs: 96, lg: 0 },
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("manager_name", formData.manager_name),
                      },
                    }}
                    value={formData.manager_name || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("manager_name", e.target.value)}
                  />
                  <MDTypography
                    sx={{
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                      minWidth: { xs: "42px", sm: "50px" },
                    }}
                  >
                    연락처
                  </MDTypography>
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(50% - 54px)", sm: "1 1 120px", lg: 0.8 },
                      minWidth: { xs: 96, lg: 0 },
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("manager_tel", formData.manager_tel),
                      },
                    }}
                    value={formData.manager_tel || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("manager_tel", e.target.value)}
                  />

                  {/* ✅ account_type 선택 */}
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "70px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    업종유형
                  </MDTypography>
                  <TextField
                    select
                    size="small"
                    value={formData.account_type || ""}
                    disabled={isDeletedAccount}
                    onChange={(e) => handleChange("account_type", e.target.value)}
                    sx={{
                      width: { xs: "calc(100% - 70px)", sm: 130 },
                      minWidth: { xs: 160, sm: 130 },
                      "& .MuiInputBase-root": {
                        height: 29,
                        fontSize: { xs: "12px", sm: "13px" },
                      },
                      "& .MuiSelect-select": {
                        minHeight: "0 !important",
                        height: "20px",
                        py: "4px",
                        px: "6px",
                        display: "flex",
                        alignItems: "center",
                      },
                    }}
                  >
                    <MenuItem value={1}>위탁급식</MenuItem>
                    <MenuItem value={2}>도소매</MenuItem>
                    <MenuItem value={3}>프랜차이즈</MenuItem>
                    <MenuItem value={4}>산업체</MenuItem>
                  </TextField>
                </Grid>

                {/* 담당자2 */}
                <Grid
                  item
                  xs={12}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: { xs: 0.75, sm: 1 },
                    flexWrap: { xs: "wrap", sm: "wrap", lg: "nowrap" },
                    paddingTop: "10px !important",
                  }}
                >
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "65px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    2.담당자명
                  </MDTypography>
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(50% - 76px)", sm: "1 1 120px", lg: 0.8 },
                      minWidth: { xs: 96, lg: 0 },
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("manager_name2", formData.manager_name2),
                      },
                    }}
                    value={formData.manager_name2 || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("manager_name2", e.target.value)}
                  />
                  <MDTypography
                    sx={{
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                      minWidth: { xs: "42px", sm: "50px" },
                    }}
                  >
                    연락처
                  </MDTypography>
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(50% - 54px)", sm: "1 1 120px", lg: 0.8 },
                      minWidth: { xs: 96, lg: 0 },
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("manager_tel2", formData.manager_tel2),
                      },
                    }}
                    value={formData.manager_tel2 || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("manager_tel2", e.target.value)}
                  />

                  {/* ✅ meal_type 선택 */}
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "70px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    식단유형
                  </MDTypography>
                  <TextField
                    select
                    size="small"
                    value={formData.meal_type || ""}
                    disabled={isDeletedAccount}
                    onChange={(e) => handleChange("meal_type", e.target.value)}
                    sx={{
                      width: { xs: "calc(100% - 70px)", sm: 130 },
                      minWidth: { xs: 160, sm: 130 },
                      "& .MuiInputBase-root": {
                        height: 29,
                        fontSize: { xs: "12px", sm: "13px" },
                      },
                      "& .MuiSelect-select": {
                        minHeight: "0 !important",
                        height: "20px",
                        py: "4px",
                        px: "6px",
                        display: "flex",
                        alignItems: "center",
                      },
                    }}
                  >
                    <MenuItem value={1}>요양주간</MenuItem>
                    <MenuItem value={2}>요양직원</MenuItem>
                    <MenuItem value={3}>요양</MenuItem>
                    <MenuItem value={4}>주간보호</MenuItem>
                    <MenuItem value={5}>산업체</MenuItem>
                  </TextField>
                </Grid>

                {/* 마감 담당자 */}
                <Grid
                  item
                  xs={12}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: { xs: 0.75, sm: 1, lg: 2 },
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                    paddingTop: "10px !important",
                  }}
                >
                  <MDTypography
                    sx={{
                      minWidth: { xs: "86px", sm: "75px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    마감담당자명
                  </MDTypography>
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(100% - 94px)", sm: 1 },
                      minWidth: 0,
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("closing_name", formData.closing_name),
                      },
                    }}
                    value={formData.closing_name || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("closing_name", e.target.value)}
                  />
                  <MDTypography
                    sx={{
                      minWidth: { xs: "86px", sm: "auto" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    연락처
                  </MDTypography>
                  <MDInput
                    sx={{
                      flex: { xs: "1 1 calc(100% - 94px)", sm: 1 },
                      minWidth: 0,
                      fontSize: { xs: "12px", sm: "13px" },
                      "& input": {
                        padding: "4px 4px",
                        color: getColor("closing_tel", formData.closing_tel),
                      },
                    }}
                    value={formData.closing_tel || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("closing_tel", e.target.value)}
                  />
                </Grid>

                {/* 시설기기 */}
                <Grid
                  item
                  xs={12}
                  sx={{
                    display: "flex",
                    alignItems: { xs: "stretch", sm: "center" },
                    gap: { xs: 0.75, sm: 1, lg: 2 },
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                    paddingTop: "10px !important",
                  }}
                >
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "75px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "right",
                      fontWeight: "bold",
                      pt: { xs: 0.75, sm: 0 },
                    }}
                  >
                    시설기기
                    <br />
                    투자여부
                  </MDTypography>
                  <MDInput
                    multiline
                    rows={3}
                    sx={{
                      flex: { xs: "1 1 calc(100% - 70px)", sm: 1 },
                      minWidth: 0,
                      "& textarea": {
                        color: getColor("property_note", formData.property_note),
                      },
                    }}
                    value={formData.property_note || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("property_note", e.target.value)}
                  />
                  <MDTypography
                    sx={{
                      minWidth: { xs: "62px", sm: "75px" },
                      fontSize: { xs: "12px", sm: "13px" },
                      textAlign: "center",
                      fontWeight: "bold",
                      pt: { xs: 0.75, sm: 0 },
                    }}
                  >
                    시설기기
                    <br />
                    A/S기준
                  </MDTypography>
                  <MDInput
                    multiline
                    rows={3}
                    sx={{
                      flex: { xs: "1 1 calc(100% - 70px)", sm: 1 },
                      minWidth: 0,
                      "& textarea": {
                        color: getColor("property_as_note", formData.property_as_note),
                      },
                    }}
                    value={formData.property_as_note || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("property_as_note", e.target.value)}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* 오른쪽 */}
            <Grid item xs={12} md={12} lg={6}>
              {priceData.some((p) => p.account_type === 4) ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MDTypography
                      sx={{
                        fontSize: "13px",
                        textAlign: "center",
                        fontWeight: "bold",
                        mb: 0,
                      }}
                    >
                      영업내용 및 특이사항
                    </MDTypography>
                    <MDInput
                      multiline
                      rows={12}
                      sx={{
                        width: "100%",
                        textAlign: "center",
                        "& textarea": {
                          color: getColor("business_note", formData.business_note),
                        },
                      }}
                      value={formData.business_note || ""}
                      inputProps={{ readOnly: isDeletedAccount }}
                      onChange={(e) => handleChange("business_note", e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <MDTypography
                      sx={{
                        fontSize: "13px",
                        textAlign: "center",
                        fontWeight: "bold",
                        mb: 0,
                      }}
                    >
                      산업체 특이사항
                    </MDTypography>
                    <MDInput
                      multiline
                      rows={12}
                      sx={{ width: "100%", textAlign: "center" }}
                      value={formData.industry_note || ""}
                      inputProps={{ readOnly: isDeletedAccount }}
                      onChange={(e) => handleChange("industry_note", e.target.value)}
                    />
                  </Grid>
                </Grid>
              ) : (
                <>
                  <MDTypography
                    sx={{
                      fontSize: "13px",
                      textAlign: "center",
                      fontWeight: "bold",
                      mb: 0,
                    }}
                  >
                    영업내용 및 특이사항
                  </MDTypography>
                  <MDInput
                    multiline
                    rows={12}
                    sx={{
                      width: "100%",
                      textAlign: "center",
                      "& textarea": {
                        color: getColor("business_note", formData.business_note),
                      },
                    }}
                    value={formData.business_note || ""}
                    inputProps={{ readOnly: isDeletedAccount }}
                    onChange={(e) => handleChange("business_note", e.target.value)}
                  />
                </>
              )}
            </Grid>
          </Grid>
        </Card>

        {/* 하단 테이블 */}
        <Card sx={{ p: 1, mb: 1 }}>
          <MDBox sx={{ display: "flex", justifyContent: "flex-start", alignItems: "center", mb: 1 }}>
            {isExtraDietEnabled && (
              <MDButton
                variant="outlined"
                color="info"
                size="small"
                onClick={handleOpenExtraDietModal}
              >
                식단가 추가
              </MDButton>
            )}
          </MDBox>
          {renderTable(priceData, setPriceData, "price", priceTableColumns)}
        </Card>

        <Card sx={{ p: 1, mb: 1 }}>{renderTable(etcData, setEtcData, "etc", etcTableColumns)}</Card>
        <Card sx={{ p: 1, mb: 1 }}>
          {renderTable(managerData, setManagerData, "manager", managerTableColumns)}
        </Card>
        <Card sx={{ p: 1, mb: 1 }}>
          {renderTable(eventData, setEventData, "event", eventTableColumns)}
        </Card>
      </MDBox>

      {/* 첨부파일(이미지/PDF/엑셀) 공용 미리보기 오버레이 */}
      <PreviewOverlay
        open={viewerOpen}
        files={previewFiles}
        currentIndex={viewerIndex}
        onChangeIndex={setViewerIndex}
        onClose={handleCloseViewer}
        anchorX={1 / 3}
      />

      {/* 🔹 추가 식단가 입력 모달 */}
      <Modal
        open={extraDietModalOpen}
        onClose={() => setExtraDietModalOpen(false)}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
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
          <MDTypography sx={{ fontSize: "15px", fontWeight: "bold", mb: 2, textAlign: "center" }}>
            추가 식단가 설정
          </MDTypography>

          {extraDiet.map((item, index) => (
            <Grid container spacing={1} key={index} sx={{ mb: 1, alignItems: "center" }}>
              <Grid item xs={6}>
                <MDInput
                  label={`식단가명${index + 1}`}
                  value={item.name}
                  onChange={(e) => handleExtraNameChange(index, e.target.value)}
                  fullWidth
                  inputProps={{ readOnly: isDeletedAccount }}
                />
              </Grid>
              <Grid item xs={6}>
                <MDInput
                  label={`식단가${index + 1}`}
                  value={formatNumber(item.price)}
                  onChange={(e) => handleExtraPriceChange(index, e.target.value)}
                  fullWidth
                  inputProps={{ style: { textAlign: "right" }, readOnly: isDeletedAccount }}
                />
              </Grid>
            </Grid>
          ))}

          <MDBox sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 1 }}>
            <MDButton
              variant="outlined"
              color="secondary"
              size="small"
              onClick={() => setExtraDietModalOpen(false)}
            >
              닫기
            </MDButton>
            <MDButton
              variant="gradient"
              color="info"
              size="small"
              onClick={handleApplyExtraDiet}
            >
              적용
            </MDButton>
          </MDBox>
        </Box>
      </Modal>
    </DashboardLayout>
  );
}

export default AccountInfoSheet;
