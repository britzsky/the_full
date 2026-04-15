// src/layouts/property/PropertySheetTab.js
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import {
  TextField,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  Autocomplete,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import usePropertiessheetData, { parseNumber, formatNumber } from "./propertiessheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import dayjs from "dayjs";
import { API_BASE_URL } from "config";

const RECEIPT_IMAGE_FIELDS = ["receipt_img", "receipt_img2", "receipt_img3"];
const RECEIPT_IMAGE_MAX_COUNT = RECEIPT_IMAGE_FIELDS.length;

const isLocalUploadImage = (value) =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  value.file instanceof File &&
  typeof value.previewUrl === "string";

const createLocalUploadImage = (file) => ({
  file,
  previewUrl: URL.createObjectURL(file),
});

const extractUploadFile = (value) => {
  if (isLocalUploadImage(value)) return value.file;
  return value instanceof File ? value : null;
};

const getReceiptImageValues = (row) =>
  RECEIPT_IMAGE_FIELDS.map((field) => row?.[field]).filter(Boolean);

const applyReceiptImageValues = (row, imageValues) => {
  const nextRow = { ...row };

  RECEIPT_IMAGE_FIELDS.forEach((field, index) => {
    nextRow[field] = imageValues[index] || "";
  });

  return nextRow;
};

function PropertySheetTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const { activeRows, accountList, loading, fetcPropertyList } = usePropertiessheetData();
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);
  const [excelDownloading, setExcelDownloading] = useState(false);
  const rowsRef = useRef([]);

  // ✅ 우클릭(컨텍스트) 메뉴 상태
  const [ctxMenu, setCtxMenu] = useState({
    open: false,
    mouseX: 0,
    mouseY: 0,
    rowIndex: null,
  });

  const numericCols = ["purchase_price"];

  // ✅ 거래처 옵션(Autocomplete)
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name,
      })),
    [accountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  const cleanupLocalImageValue = useCallback((value) => {
    if (isLocalUploadImage(value)) {
      URL.revokeObjectURL(value.previewUrl);
    }
  }, []);

  const cleanupRowLocalImageValues = useCallback(
    (row) => {
      cleanupLocalImageValue(row?.item_img);
      RECEIPT_IMAGE_FIELDS.forEach((field) => cleanupLocalImageValue(row?.[field]));
    },
    [cleanupLocalImageValue]
  );

  const resolveImageSource = useCallback((value) => {
    if (!value) return "";
    if (typeof value === "string") return `${API_BASE_URL}${value}`;
    if (isLocalUploadImage(value)) return value.previewUrl;
    return "";
  }, []);

  const updateReceiptImages = useCallback(
    (rowIndex, nextImagesOrUpdater) => {
      setRows((prevRows) =>
        prevRows.map((row, idx) => {
          if (idx !== rowIndex) return row;

          const currentImages = getReceiptImageValues(row);
          const nextImagesRaw =
            typeof nextImagesOrUpdater === "function"
              ? nextImagesOrUpdater(currentImages, row)
              : nextImagesOrUpdater;
          const nextImages = (Array.isArray(nextImagesRaw) ? nextImagesRaw : currentImages)
            .filter(Boolean)
            .slice(0, RECEIPT_IMAGE_MAX_COUNT);

          currentImages.forEach((imageValue) => {
            if (isLocalUploadImage(imageValue) && !nextImages.includes(imageValue)) {
              cleanupLocalImageValue(imageValue);
            }
          });

          const isSameOrder =
            currentImages.length === nextImages.length &&
            currentImages.every((imageValue, imageIndex) => imageValue === nextImages[imageIndex]);

          return isSameOrder ? row : applyReceiptImageValues(row, nextImages);
        })
      );
    },
    [cleanupLocalImageValue]
  );

  const handleReceiptFileChange = useCallback(
    (rowIndex, fileList) => {
      const selectedFiles = Array.from(fileList || []).filter(Boolean);
      if (selectedFiles.length === 0) return;

      const currentImages = getReceiptImageValues(rows[rowIndex] || {});
      const remainCount = RECEIPT_IMAGE_MAX_COUNT - currentImages.length;
      if (remainCount <= 0) return;

      const nextLocalImages = selectedFiles
        .slice(0, remainCount)
        .map((file) => createLocalUploadImage(file));

      updateReceiptImages(rowIndex, [...currentImages, ...nextLocalImages]);

      if (selectedFiles.length > remainCount) {
        Swal.fire({
          title: "안내",
          text: `영수증 이미지는 최대 ${RECEIPT_IMAGE_MAX_COUNT}장까지 등록할 수 있습니다.`,
          icon: "info",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      }
    },
    [rows, updateReceiptImages]
  );

  const handleRemoveReceiptImage = useCallback(
    (rowIndex, imageIndex) => {
      updateReceiptImages(rowIndex, (currentImages) =>
        currentImages.filter((_, currentIndex) => currentIndex !== imageIndex)
      );
    },
    [updateReceiptImages]
  );

  // ✅ localStorage account_id 있으면 거래처 고정
  const lockedAccountId = useMemo(() => {
    const v = localStorage.getItem("account_id");
    return v ? String(v) : "";
  }, []);

  const isAccountLocked = !!lockedAccountId;

  const selectAccountByInput = useCallback(() => {
    if (isAccountLocked) return;
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountOptions || [];
    const qLower = q.toLowerCase();
    const exact = list.find((o) => String(o?.label || "").toLowerCase() === qLower);
    const partial =
      exact || list.find((o) => String(o?.label || "").toLowerCase().includes(qLower));
    if (partial) {
      setSelectedAccountId(partial.value);
      setAccountInput(partial.label || q);
    }
  }, [accountInput, accountOptions, isAccountLocked]);

  useEffect(() => {
    if (selectedAccountId) {
      fetcPropertyList(selectedAccountId);
    } else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    // ✅ type은 select 비교/표시 위해 문자열로 통일
    const deepCopy = (activeRows || []).map((r) => ({
      ...applyReceiptImageValues(r, getReceiptImageValues(r)),
      type: r.type == null ? "0" : String(r.type),
    }));

    // ✅ 감가상각 자동 계산
    const updated = deepCopy.map((row) => {
      const { purchase_dt, purchase_price } = row;
      if (!purchase_dt || !purchase_price) return { ...row, depreciation: "" };

      const price = parseNumber(purchase_price);
      const purchaseDate = dayjs(purchase_dt);
      const now = dayjs();

      if (!purchaseDate.isValid()) return { ...row, depreciation: "" };

      let monthsPassed = now.diff(purchaseDate, "month") + 1;
      if (monthsPassed < 1) monthsPassed = 1;
      if (monthsPassed > 60) monthsPassed = 60;

      const depreciationValue = ((monthsPassed / 60) * price).toFixed(0);
      return { ...row, depreciation: formatNumber(depreciationValue) };
    });

    rowsRef.current.forEach((row) => cleanupRowLocalImageValues(row));
    setRows(updated);
    setOriginalRows(deepCopy);
  }, [activeRows, cleanupRowLocalImageValues]);

  useEffect(() => {
    if (!accountList?.length) return;

    // 1) localStorage에 account_id 있으면 그걸로 고정
    if (lockedAccountId) {
      setSelectedAccountId(String(lockedAccountId));
      return;
    }

    // 2) 없으면 기존 로직(첫 거래처 자동 선택)
    if (!selectedAccountId) {
      setSelectedAccountId(String(accountList[0].account_id));
    }
  }, [accountList, selectedAccountId, lockedAccountId]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(
    () => () => {
      rowsRef.current.forEach((row) => cleanupRowLocalImageValues(row));
    },
    [cleanupRowLocalImageValues]
  );

  const onSearchList = (e) => setSelectedAccountId(e.target.value);

  const handleCellChange = (rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) => {
        if (idx !== rowIndex) return row;

        const prevValue = row[key];
        if (prevValue === value) return row;

        cleanupLocalImageValue(prevValue);
        return { ...row, [key]: value };
      })
    );
  };

  const normalize = (value) => {
    if (typeof value !== "string") return value ?? "";
    return value.replace(/\s+/g, " ").trim();
  };

  // ✅ (FIX) 값 비교를 key별로 통일 (type은 string 비교)
  const isSameValue = (key, original, current) => {
    if (key === "type") {
      return String(original ?? "") === String(current ?? "");
    }
    if (numericCols.includes(key)) {
      return Number(original ?? 0) === Number(current ?? 0);
    }
    if (typeof original === "string" && typeof current === "string") {
      return normalize(original) === normalize(current);
    }
    return original === current;
  };

  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    return isSameValue(key, original, value) ? { color: "black" } : { color: "red" };
  };

  const handleAddRow = () => {
    const newRow = {
      account_id: selectedAccountId,
      purchase_dt: "",
      purchase_name: "",
      item: "",
      spec: "",
      qty: "",
      type: "0", // ✅ 문자열
      purchase_price: "0",
      item_img: "",
      receipt_img: "",
      receipt_img2: "",
      receipt_img3: "",
      note: "",
      depreciation: "",
      del_yn: "N", // ✅ 기본 N
      isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
    setOriginalRows((prev) => [...prev, { ...newRow }]);
  };

  const handleViewImage = (value) => {
    if (!value) return;
    const imageSrc = resolveImageSource(value);
    if (!imageSrc) return;
    setViewImageSrc(imageSrc);
  };
  const handleCloseViewer = () => setViewImageSrc(null);

  // ✅ 우클릭 메뉴 열기
  const handleRowContextMenu = (e, rowIndex) => {
    e.preventDefault();
    setCtxMenu({
      open: true,
      mouseX: e.clientX,
      mouseY: e.clientY,
      rowIndex,
    });
  };

  const closeCtxMenu = () => {
    setCtxMenu((prev) => ({ ...prev, open: false, rowIndex: null }));
  };

  // ✅ 행 삭제: del_yn=Y 로 서버에 저장 태우고, 성공하면 화면에서만 제거(재조회 X)
  const handleDeleteRow = async (rowIndex) => {
    if (rowIndex == null) return;

    const row = rows[rowIndex];
    if (!row) return;

    const result = await Swal.fire({
      title: "행 삭제",
      text: "해당 행을 삭제할까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#9e9e9e",
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });

    if (!result.isConfirmed) return;

    try {
      const deleteRow = { ...row };

      // ✅ 삭제 플래그
      deleteRow.del_yn = "Y";

      // ✅ account_id 보정
      deleteRow.account_id = selectedAccountId || row.account_id;

      // ✅ 감가상각은 서버 저장 제외
      delete deleteRow.depreciation;

      // ✅ 숫자 컬럼 콤마 제거
      numericCols.forEach((col) => {
        if (deleteRow[col] != null) {
          deleteRow[col] = deleteRow[col].toString().replace(/,/g, "");
        }
      });

      // ✅ 로컬에서만 들고 있는 업로드 파일은 삭제 저장 payload에서 제외
      ["item_img", ...RECEIPT_IMAGE_FIELDS].forEach((f) => {
        if (extractUploadFile(deleteRow[f])) {
          delete deleteRow[f];
        }
      });

      const response = await api.post(`/Operate/PropertiesSave`, [deleteRow], {
        headers: { "Content-Type": "application/json" },
      });

      if (response?.data?.code === 200) {
        cleanupRowLocalImageValues(row);
        // ✅ 재조회 없이 화면에서만 제거
        setRows((prev) => prev.filter((_, i) => i !== rowIndex));
        setOriginalRows((prev) => prev.filter((_, i) => i !== rowIndex));

        closeCtxMenu();

        Swal.fire({
          title: "삭제",
          text: "삭제 처리되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      } else {
        Swal.fire({
          title: "오류",
          text: "삭제 저장에 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "오류",
        text: "삭제 저장 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  const uploadImage = async (file, purchaseDt, account_id) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "property");
      formData.append("gubun", purchaseDt);
      formData.append("folder", account_id);

      const res = await api.post(`/Operate/OperateImgUpload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.code === 200) return res.data.image_path;
    } catch (err) {
      Swal.fire({
        title: "실패",
        text: "이미지 업로드 실패",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  // ✅ 다운로드 (서버 경로 문자열일 때만)
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

  const buildImageUrl = useCallback((path) => {
    if (!path || typeof path !== "string") return "";
    const raw = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
    return encodeURI(raw);
  }, []);

  const toImageExtension = useCallback((mimeType = "", fileName = "") => {
    const mime = String(mimeType || "").toLowerCase();
    const name = String(fileName || "").toLowerCase();

    if (mime.includes("png") || name.endsWith(".png")) return "png";
    if (mime.includes("jpeg") || mime.includes("jpg") || name.endsWith(".jpg") || name.endsWith(".jpeg"))
      return "jpeg";
    if (mime.includes("gif") || name.endsWith(".gif")) return "gif";

    return "";
  }, []);

  const arrayBufferToBase64 = useCallback((arrayBuffer) => {
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return window.btoa(binary);
  }, []);

  const loadImageForExcel = useCallback(
    async (value) => {
      if (!value) return null;

      const uploadFile = extractUploadFile(value);
      if (uploadFile) {
        const extension = toImageExtension(uploadFile.type, uploadFile.name);
        if (!extension) return null;
        const base64 = arrayBufferToBase64(await uploadFile.arrayBuffer());
        return { base64: `data:${uploadFile.type || `image/${extension}`};base64,${base64}`, extension };
      }

      if (typeof value === "string") {
        const url = buildImageUrl(value);
        if (!url) return null;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;

        const blob = await res.blob();
        const extension = toImageExtension(blob.type, value);
        if (!extension) return null;

        const base64 = arrayBufferToBase64(await blob.arrayBuffer());
        return { base64: `data:${blob.type || `image/${extension}`};base64,${base64}`, extension };
      }

      return null;
    },
    [arrayBufferToBase64, buildImageUrl, toImageExtension]
  );

  const handleExcelDownload = useCallback(async () => {
    if (excelDownloading) return;
    if (!rows.length) {
      Swal.fire({
        title: "안내",
        text: "다운로드할 데이터가 없습니다.",
        icon: "info",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      return;
    }

    try {
      setExcelDownloading(true);
      Swal.fire({
        title: "엑셀 생성 중...",
        text: "이미지 포함 파일을 준비 중입니다.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "THEFULL";
      const ws = workbook.addWorksheet("기물관리");

      const headers = [
        "구매일자",
        "구매처",
        "품목",
        "규격",
        "수량",
        "신규/중고",
        "구매가격",
        "예상감가(60개월 기준)",
        "제품사진",
        "영수증사진1",
        "영수증사진2",
        "영수증사진3",
        "비고",
      ];

      ws.columns = [
        { width: 13 },
        { width: 18 },
        { width: 20 },
        { width: 14 },
        { width: 8 },
        { width: 11 },
        { width: 13 },
        { width: 18 },
        { width: 40 },
        { width: 40 },
        { width: 40 },
        { width: 40 },
        { width: 20 },
      ];

      ws.addRow(headers);
      const borderThin = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      headers.forEach((_, idx) => {
        const cell = ws.getCell(1, idx + 1);
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
        cell.border = borderThin;
      });

      const imageTasks = [];

      rows.forEach((row, idx) => {
        const excelRowNo = idx + 2;
        const receiptImages = getReceiptImageValues(row);

        ws.addRow([
          row.purchase_dt || "",
          row.purchase_name || "",
          row.item || "",
          row.spec || "",
          parseNumber(row.qty || 0),
          String(row.type) === "1" ? "중고" : "신규",
          parseNumber(row.purchase_price || 0),
          parseNumber(row.depreciation || 0),
          "",
          "",
          "",
          "",
          row.note || "",
        ]);

        for (let c = 1; c <= 13; c += 1) {
          const cell = ws.getCell(excelRowNo, c);
          cell.border = borderThin;
          cell.alignment = { horizontal: c >= 5 && c <= 8 ? "right" : "center", vertical: "middle" };
          if ([5, 7, 8].includes(c)) cell.numFmt = "#,##0";
          if ([9, 10, 11, 12, 13].includes(c)) cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        }

        imageTasks.push({ rowNo: excelRowNo, colNo: 9, source: row.item_img, kind: "item" });
        receiptImages
          .filter((imageValue) => Boolean(imageValue))
          .slice(0, 3)
          .forEach((imageValue, imageIndex) => {
            imageTasks.push({
              rowNo: excelRowNo,
              colNo: 10 + imageIndex,
              source: imageValue,
              kind: "receipt",
            });
          });
      });

      const runImageTask = async (task) => {
        if (!task?.source) return;
        const image = await loadImageForExcel(task.source);
        if (!image) return;

        const imageId = workbook.addImage({
          base64: image.base64,
          extension: image.extension,
        });

        const isReceiptImage = task.kind === "receipt";
        const imageWidth = isReceiptImage ? 220 : 260;
        const imageHeight = isReceiptImage ? 165 : 195;
        const colOffset = 0.02;
        const rowOffset = isReceiptImage ? 0.06 : 0.04;
        const minRowHeight = isReceiptImage ? 190 : 210;

        ws.getRow(task.rowNo).height = Math.max(ws.getRow(task.rowNo).height || 20, minRowHeight);
        ws.addImage(imageId, {
          tl: { col: task.colNo - 1 + colOffset, row: task.rowNo - 1 + rowOffset },
          ext: { width: imageWidth, height: imageHeight },
        });
      };

      let cursor = 0;
      const worker = async () => {
        while (cursor < imageTasks.length) {
          const current = imageTasks[cursor];
          cursor += 1;
          try {
            await runImageTask(current);
          } catch (e) {
            console.error("엑셀 이미지 삽입 실패:", e);
          }
        }
      };

      const workerCount = Math.min(4, imageTasks.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const accountLabel = selectedAccountOption?.label || "전체";
      const filename = `기물관리_${accountLabel}_${dayjs().format("YYYYMM")}.xlsx`;
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Swal.close();
      Swal.fire({
        title: "완료",
        text: "엑셀 다운로드가 완료되었습니다.",
        icon: "success",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    } catch (error) {
      console.error(error);
      Swal.close();
      Swal.fire({
        title: "실패",
        text: "엑셀 다운로드 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    } finally {
      setExcelDownloading(false);
    }
  }, [
    excelDownloading,
    rows,
    loadImageForExcel,
    selectedAccountOption?.label,
  ]);

  // ✅ 아이콘 파란색
  const fileIconSx = { color: "#1e88e5" };

  // 🟧 감가상각 자동 계산 useEffect
  useEffect(() => {
    const updated = rows.map((row) => {
      const { purchase_dt, purchase_price } = row;
      if (!purchase_dt || !purchase_price) return { ...row, depreciation: "" };

      const price = parseNumber(purchase_price);
      const purchaseDate = dayjs(purchase_dt);
      const now = dayjs();

      if (!purchaseDate.isValid()) return { ...row, depreciation: "" };

      let monthsPassed = now.diff(purchaseDate, "month") + 1;
      if (monthsPassed < 1) monthsPassed = 1;
      if (monthsPassed > 60) monthsPassed = 60;

      const depreciationValue = ((monthsPassed / 60) * price).toFixed(0);
      return { ...row, depreciation: formatNumber(depreciationValue) };
    });

    setRows(updated);
  }, [rows.map((r) => `${r.purchase_dt}-${r.purchase_price}`).join(",")]);

  const handleSave = async () => {
    try {
      const modifiedRows = await Promise.all(
        rows.map(async (row, idx) => {
          const original = originalRows[idx] || {};
          let updatedRow = { ...row };

          // ✅ (FIX) 변경 감지도 동일 비교 로직 사용
          const isChanged =
            row.isNew ||
            Object.keys(updatedRow).some((key) => {
              const origVal = original[key];
              const curVal = updatedRow[key];
              return !isSameValue(key, origVal, curVal);
            });

          if (!isChanged) return null;

          numericCols.forEach((col) => {
            if (updatedRow[col]) updatedRow[col] = updatedRow[col].toString().replace(/,/g, "");
          });

          updatedRow = applyReceiptImageValues(updatedRow, getReceiptImageValues(updatedRow));

          const imageFields = ["item_img", ...RECEIPT_IMAGE_FIELDS];
          for (const field of imageFields) {
            const uploadFile = extractUploadFile(row[field]);
            if (uploadFile) {
              const uploadedPath = await uploadImage(
                uploadFile,
                row.purchase_dt,
                selectedAccountId
              );
              updatedRow[field] = uploadedPath;
            }
          }

          // 🟧 감가상각은 서버 저장 제외
          delete updatedRow.depreciation;

          // ✅ type은 저장시에도 문자열->그대로(서버가 숫자 원하면 여기서 Number로 변환 가능)
          return {
            ...updatedRow,
            account_id: selectedAccountId || row.account_id,
          };
        })
      );

      const payload = modifiedRows.filter(Boolean);
      if (payload.length === 0) {
        Swal.fire({
          title: "안내",
          text: "변경된 내용이 없습니다.",
          icon: "info",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
        return;
      }

      const response = await api.post(`/Operate/PropertiesSave`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
        await fetcPropertyList(selectedAccountId);
      }
    } catch (error) {
      Swal.fire({
        title: "오류",
        text: "저장 중 오류가 발생했습니다.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      console.error(error);
    }
  };

  const columns = useMemo(
    () => [
      { header: "구매일자", accessorKey: "purchase_dt", size: 80 },
      { header: "구매처", accessorKey: "purchase_name", size: 120 },
      { header: "품목", accessorKey: "item", size: 160 },
      { header: "규격", accessorKey: "spec", size: 110 },
      { header: "수량", accessorKey: "qty", size: 70 },
      { header: "신규/중고", accessorKey: "type", size: 80 },
      { header: "구매가격", accessorKey: "purchase_price", size: 100 },
      { header: "예상감가\n(60개월 기준)", accessorKey: "depreciation", size: 100 },
      { header: "제품사진", accessorKey: "item_img", size: 140 },
      { header: "영수증사진", accessorKey: "receipt_img", size: 250 },
      { header: "비고", accessorKey: "note", size: 120 },
    ],
    []
  );

  // ✅ 모바일 대응 테이블 스타일
  const tableSx = {
    flex: 1,
    minHeight: 0,
    maxHeight: isMobile ? "55vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    "& table": {
      borderCollapse: "separate",
      width: "max-content",
      minWidth: "100%",
      borderSpacing: 0,
      tableLayout: "fixed",
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
    "& input[type='date'], & input[type='text']": {
      fontSize: isMobile ? "10px" : "12px",
      padding: isMobile ? "2px 3px" : "4px",
      minWidth: isMobile ? "70px" : "80px",
      border: "none",
      background: "transparent",
    },
  };

  const getFileIconSx = (isChanged) => ({
    color: isChanged ? "#d32f2f" : "#1e88e5",
  });

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 필터/버튼 영역 (모바일 대응) */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          flexWrap: isMobile ? "wrap" : "nowrap",
          // 모바일에서는 검색/버튼 영역도 본문과 함께 스크롤
          position: isMobile ? "static" : "sticky",
          zIndex: isMobile ? "auto" : 10,
          top: isMobile ? "auto" : 78,
          backgroundColor: "#ffffff",
        }}
      >
        {/* ✅ 거래처 Select → 검색 가능한 Autocomplete로 변경 */}
        {(accountList || []).length > 0 && (
          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={accountOptions}
            value={selectedAccountOption}
            disabled={isAccountLocked} // ✅ 잠금
            onChange={(_, opt) => {
              if (isAccountLocked) return; // ✅ 혹시 몰라 방어
              // 입력 비움 시 거래처 선택 유지
              if (!opt) return;
              setSelectedAccountId(opt.value);
            }}
            inputValue={accountInput}
            onInputChange={(_, newValue) => setAccountInput(newValue)}
            getOptionLabel={(opt) => opt?.label ?? ""}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            filterOptions={(options, state) => {
              const q = (state.inputValue ?? "").trim().toLowerCase();
              if (!q) return options;
              return options.filter((o) => (o.label ?? "").toLowerCase().includes(q));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={isAccountLocked ? "거래처(고정)" : "거래처"}
                placeholder={isAccountLocked ? "거래처가 고정되어 있습니다" : "거래처명을 입력"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    selectAccountByInput();
                  }
                }}
                sx={{
                  "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                  "& input": { padding: "0 8px" },
                }}
              />
            )}
          />
        )}

        <MDButton
          color="info"
          onClick={handleExcelDownload}
          disabled={excelDownloading}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 90 : 110,
          }}
        >
          {excelDownloading ? "다운로드중" : "엑셀다운로드"}
        </MDButton>

        <MDButton
          color="info"
          onClick={handleAddRow}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 70 : 90,
          }}
        >
          행 추가
        </MDButton>

        <MDButton
          color="info"
          onClick={handleSave}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 70 : 90,
          }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* 테이블 영역 */}
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
              <tr
                key={rowIndex}
                onContextMenu={(e) => handleRowContextMenu(e, rowIndex)} // ✅ 우클릭
                style={{ cursor: "context-menu" }}
              >
                {columns.map((col) => {
                  const key = col.accessorKey;
                  const value = row[key] ?? "";
                  const style = getCellStyle(rowIndex, key, value);

                  if (key === "purchase_dt")
                    return (
                      <td key={key} style={{ width: col.size }}>
                        <input
                          type="date"
                          value={value}
                          onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
                          style={{
                            ...style,
                            width: "100%",
                            border: "none",
                            background: "transparent",
                          }}
                        />
                      </td>
                    );

                  if (key === "type")
                    return (
                      <td key={key} style={{ width: col.size }}>
                        <select
                          value={String(value ?? "0")}
                          onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
                          style={{
                            ...style,
                            width: "100%",
                            border: "none",
                            background: "transparent",
                            fontSize: isMobile ? "10px" : "12px",
                          }}
                        >
                          <option value="0">신규</option>
                          <option value="1">중고</option>
                        </select>
                      </td>
                    );

                  if (key === "receipt_img") {
                    const receiptImages = getReceiptImageValues(row);
                    const isReceiptChanged = RECEIPT_IMAGE_FIELDS.some(
                      (field) => !isSameValue(field, originalRows[rowIndex]?.[field], row[field])
                    );

                    return (
                      <td
                        key={key}
                        style={{
                          width: col.size,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          id={`upload-${key}-${rowIndex}`}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            handleReceiptFileChange(rowIndex, e.target.files);
                            e.target.value = "";
                          }}
                        />

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: 8,
                            flexWrap: "wrap",
                            minHeight: isMobile ? 84 : 96,
                            padding: 0,
                          }}
                        >
                          {receiptImages.map((imageValue, imageIndex) => (
                            <div
                              key={`receipt-image-${rowIndex}-${imageIndex}`}
                              style={{
                                position: "relative",
                                width: isMobile ? 52 : 62,
                                height: isMobile ? 80 : 92,
                                borderRadius: 6,
                                overflow: "hidden",
                                border: `1px solid ${isReceiptChanged ? "#d32f2f" : "#d0d7e2"}`,
                                backgroundColor: "#f1f4f8",
                                flexShrink: 0,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleViewImage(imageValue)}
                                style={{
                                  border: "none",
                                  background: "none",
                                  width: "100%",
                                  height: "100%",
                                  padding: 0,
                                  cursor: "pointer",
                                }}
                              >
                                <img
                                  src={encodeURI(resolveImageSource(imageValue))}
                                  alt={`영수증 이미지 ${imageIndex + 1}`}
                                  loading="lazy"
                                  decoding="async"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              </button>

                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveReceiptImage(rowIndex, imageIndex);
                                }}
                                sx={{
                                  position: "absolute",
                                  top: 2,
                                  right: 2,
                                  width: 22,
                                  height: 22,
                                  borderRadius: "999px",
                                  border: "1px solid #e2b4b4",
                                  backgroundColor: "#fff1f1",
                                  color: "#d32f2f",
                                  "&:hover": {
                                    backgroundColor: "#ffe3e3",
                                  },
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </div>
                          ))}

                          {receiptImages.length < RECEIPT_IMAGE_MAX_COUNT && (
                            <label htmlFor={`upload-${key}-${rowIndex}`}>
                              <MDButton
                                component="span"
                                size="small"
                                color="info"
                                sx={{
                                  fontSize: isMobile ? "10px" : "12px",
                                  minWidth: isMobile ? 54 : 62,
                                  minHeight: isMobile ? 32 : 36,
                                  px: isMobile ? 0.75 : 1,
                                  py: isMobile ? 0.35 : 0.45,
                                  lineHeight: 1.2,
                                  whiteSpace: "normal",
                                  border: isReceiptChanged
                                    ? "1px solid #d32f2f"
                                    : "1px solid transparent",
                                }}
                              >
                                <>
                                  파일선택
                                  <br />
                                  (최대 3장)
                                </>
                              </MDButton>
                            </label>
                          )}
                        </div>
                      </td>
                    );
                  }

                  if (key === "item_img") {
                    const hasImage = !!value;

                    // ✅ 원본 대비 변경 여부 (File 객체로 재업로드되면 무조건 변경)
                    const original = originalRows[rowIndex]?.[key];
                    const isImgChanged = !isSameValue(key, original, value);

                    return (
                      <td
                        key={key}
                        style={{
                          width: col.size,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          id={`upload-${key}-${rowIndex}`}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCellChange(rowIndex, key, createLocalUploadImage(file));
                            e.target.value = ""; // 같은 파일 재선택 가능
                          }}
                        />

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            flexWrap: isMobile ? "wrap" : "nowrap",
                          }}
                        >
                          {/* 업로드/재업로드 */}
                          <label htmlFor={`upload-${key}-${rowIndex}`}>
                            <MDButton
                              component="span"
                              size="small"
                              color={hasImage ? "info" : "info"}
                              sx={{ fontSize: isMobile ? "10px" : "12px" }}
                            >
                              {hasImage ? "재업로드" : "이미지 업로드"}
                            </MDButton>
                          </label>

                          {/* 다운로드: 서버 문자열일 때만 */}
                          {typeof value === "string" && (
                            <Tooltip title="다운로드">
                              <IconButton
                                size="small"
                                sx={getFileIconSx(isImgChanged)}
                                onClick={() => handleDownload(value)}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* 미리보기: 서버/로컬 모두 */}
                          {hasImage && (
                            <Tooltip title="미리보기">
                              <IconButton
                                size="small"
                                sx={getFileIconSx(isImgChanged)}
                                onClick={() => handleViewImage(value)}
                              >
                                <ImageSearchIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    );
                  }

                  if (key === "depreciation") {
                    return (
                      <td
                        key={key}
                        style={{
                          ...style,
                          width: col.size,
                          backgroundColor: "#fafafa",
                          color: "#333",
                        }}
                      >
                        {value || ""}
                      </td>
                    );
                  }

                  const isNumeric = numericCols.includes(key);
                  return (
                    <td
                      key={key}
                      contentEditable
                      suppressContentEditableWarning
                      style={{ ...style, width: col.size }}
                      onBlur={(e) => {
                        let newValue = e.currentTarget.innerText.trim();
                        if (isNumeric) newValue = parseNumber(newValue);
                        handleCellChange(rowIndex, key, newValue);
                        if (isNumeric) e.currentTarget.innerText = formatNumber(newValue);
                      }}
                    >
                      {isNumeric ? formatNumber(value) : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </MDBox>

      {/* 이미지 전체보기 오버레이 */}
      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
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
              maxWidth: "100%",
              maxHeight: "100%",
              padding: isMobile ? 8 : 16,
            }}
          >
            <TransformWrapper initialScale={1} minScale={0.5} maxScale={5} centerOnInit>
              {() => (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      zIndex: 1000,
                    }}
                  >
                    <button
                      onClick={handleCloseViewer}
                      style={{
                        border: "none",
                        borderRadius: 4,
                        padding: "4px 8px",
                        fontSize: isMobile ? 12 : 14,
                        cursor: "pointer",
                      }}
                    >
                      닫기
                    </button>
                  </div>

                  <TransformComponent>
                    <img
                      src={encodeURI(viewImageSrc)}
                      alt="미리보기"
                      style={{
                        maxWidth: "95vw",
                        maxHeight: "90vh",
                        borderRadius: 8,
                      }}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}

      {/* ✅ 우클릭 컨텍스트 메뉴 */}
      {ctxMenu.open && (
        <div
          onClick={closeCtxMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeCtxMenu();
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: ctxMenu.mouseY,
              left: ctxMenu.mouseX,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
              minWidth: 140,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={() => handleDeleteRow(ctxMenu.rowIndex)}
            >
              🗑️ 행 삭제
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default PropertySheetTab;
