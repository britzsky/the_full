import React, { useMemo, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
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
} from "@mui/material";
import dayjs from "dayjs";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "../loading/loadingscreen";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import useTallysheetData, { parseNumber, formatNumber } from "./data/TallySheetData";
import Swal from "sweetalert2";
import api from "api/api";
import PropTypes from "prop-types";

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
  "KB국민은행": [[3, 2, 6], [3, 3, 6]],
  "신한은행": [[3, 3, 6], [3, 2, 6]],
  "우리은행": [[4, 3, 6], [3, 3, 6]],
  "하나은행": [[3, 6, 5], [3, 3, 6]],
  "IBK기업은행": [[3, 6, 2, 3], [3, 3, 6]],
  "NH농협은행": [[3, 4, 4, 2], [3, 3, 6]],
  "카카오뱅크": [[4, 2, 7], [3, 3, 6]],
  "토스뱅크": [[3, 3, 6], [4, 3, 6]],
  "케이뱅크": [[3, 3, 6], [4, 2, 7]],
  우체국: [[4, 4, 4], [3, 3, 6]],
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

// ======================== 선택 테이블 컴포넌트 ========================
function YourSelectableTable({ data, selected, setSelected }) {
  const toggleSelect = (item) => {
    const index = selected.findIndex((i) => JSON.stringify(i) === JSON.stringify(item));
    if (index !== -1) setSelected(selected.filter((_, idx) => idx !== index));
    else setSelected([...selected, item]);
  };

  const isSelected = (item) => selected.some((i) => JSON.stringify(i) === JSON.stringify(item));

  const tableSx = {
    maxHeight: "550px",
    overflow: "auto",
    "& table": { borderCollapse: "collapse", width: "100%", minWidth: "100%", borderSpacing: 0 },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: "4px",
      whiteSpace: "nowrap",
      fontSize: "12px",
    },
    "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 2 },
  };

  return (
    <Box sx={tableSx}>
      <table>
        <thead>
          <tr>
            <th>선택</th>
            <th>이름</th>
            <th>타입</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              style={{
                background: isSelected(row) ? "#d3f0ff" : row.del_yn === "Y" ? "#E0E0E0" : "white",
              }}
            >
              <td>
                <input type="checkbox" checked={isSelected(row)} onChange={() => toggleSelect(row)} />
              </td>
              <td>{row.name}</td>
              <td>{row.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

YourSelectableTable.propTypes = {
  data: PropTypes.array.isRequired,
  selected: PropTypes.array.isRequired,
  setSelected: PropTypes.func.isRequired,
};

// ======================== 메인 집계표 컴포넌트 ========================
function TallySheet() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [originalRows, setOriginalRows] = useState([]);
  const [original2Rows, setOriginal2Rows] = useState([]);
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [images, setImages] = useState(Array(31).fill(null)); // 1~31일 이미지
  const [receiptType, setReceiptType] = useState([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    dataRows,
    setDataRows,
    data2Rows,
    setData2Rows,
    accountList,
    countMonth,
    count2Month,
    loading,
    fetchDataRows,
    fetchData2Rows,
  } = useTallysheetData(selectedAccountId, year, month);

  // ✅ 원본 데이터 관리 로직 개선
  useEffect(() => {
    setDataRows([]);
    setData2Rows([]);
    setOriginalRows([]);
    setOriginal2Rows([]);
  }, [selectedAccountId, year, month]);

  useEffect(() => {
    if (dataRows?.length > 0 && originalRows.length === 0) {
      setOriginalRows(dataRows.map((r) => ({ ...r })));
    }
  }, [dataRows]);

  useEffect(() => {
    if (data2Rows?.length > 0 && original2Rows.length === 0) {
      setOriginal2Rows(data2Rows.map((r) => ({ ...r })));
    }
  }, [data2Rows]);

  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId) setSelectedAccountId(accountList[0].account_id);
  }, [accountList, selectedAccountId]);

  // 컬럼 구성
  const columns = useMemo(() => {
    const dayColumns = Array.from({ length: 31 }, (_, i) => ({
      header: `${i + 1}일`,
      accessorKey: `day_${i + 1}`,
      size: 100,
    }));
    return [{ header: "구분", accessorKey: "name", size: 100 }, ...dayColumns, { header: "합계", accessorKey: "total", size: 100 }];
  }, []);

  // 합계 계산
  const makeTableData = (rows) => {
    if (!rows || rows.length === 0) return [];

    const calculatedRows = rows.map((r) => {
      const total = Array.from({ length: 31 }, (_, i) => parseNumber(r[`day_${i + 1}`])).reduce((sum, val) => sum + val, 0);
      return { ...r, total };
    });

    const totals = {};
    for (let i = 1; i <= 31; i++) {
      totals[`day_${i}`] = calculatedRows.reduce((sum, r) => sum + parseNumber(r[`day_${i}`]), 0);
    }
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    return [...calculatedRows, { name: "총합", ...totals, total: grandTotal }];
  };

  const tableData = useMemo(() => makeTableData(dataRows), [dataRows]);
  const table2Data = useMemo(() => makeTableData(data2Rows), [data2Rows]);

  const table = useReactTable({ data: tableData, columns, getCoreRowModel: getCoreRowModel() });
  const table2 = useReactTable({ data: table2Data, columns, getCoreRowModel: getCoreRowModel() });

  // ✅ 셀 변경 핸들러
  const handleCellChange = (rowIndex, colKey, value, isSecond = false) => {
    const setter = isSecond ? setData2Rows : setDataRows;
    const rows = isSecond ? data2Rows : dataRows;
    const row = rows[rowIndex];
    if (!row || row.name === "총합" || colKey === "name" || colKey === "total") return;
    const newValue = parseNumber(value);
    setter(rows.map((r, i) => (i === rowIndex ? { ...r, [colKey]: newValue } : r)));
  };

  const handleImageUpload = async (e, dayIndex) => {
    const typeForDay = receiptType[dayIndex];

    if (!typeForDay) {
      return Swal.fire("경고", "영수증 유형을 선택하세요.", "info");
    }

    const file = e.target.files[0];
    if (!file) return;

    // ✅ 현재 선택된 셀 날짜 (year/month + dayIndex)
    const day = dayIndex + 1;
    const selectedDate = dayjs(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);

    // (선택) 달에 없는 날짜(예: 2월 31일) 업로드 방지
    if (!selectedDate.isValid() || selectedDate.month() + 1 !== month) {
      return Swal.fire("경고", "선택한 날짜가 유효하지 않습니다.", "warning");
    }

    setImages((prev) => {
      const newImages = [...prev];
      newImages[dayIndex] = file;
      return newImages;
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", typeForDay);
    formData.append("account_id", selectedAccountId);

    // ✅ 날짜 같이 전송 (서버에서 원하는 포맷으로)
    formData.append("cell_day", String(day)); // 1~31
    formData.append("cell_date", selectedDate.format("YYYY-MM-DD")); // "2025-12-22" 같은 형태

    try {
      Swal.fire({
        title: "영수증 확인 중 입니다.",
        text: "잠시만 기다려 주세요...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post("/receipt-scan", formData, {
        headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
        validateStatus: () => true,
      });

      Swal.close();

      if (res.status === 200) {
        Swal.fire("완료", "영수증 확인이 완료되었습니다.", "success");

        const colKey = `day_${dayIndex + 1}`;

        setDataRows((prev) => {
          if (!prev || prev.length === 0) return prev;

          const targetIndex = prev.findIndex((row) => String(row.type) === String(type));
          const numericTotal = parseNumber(total);

          return prev.map((row, idx) => {
            if (idx !== targetIndex) return row;

            const prevVal = parseNumber(row[colKey]);
            return { ...row, [colKey]: prevVal + numericTotal };
          });
        });
      } else if (res.status === 400) {
        Swal.fire("실패", res.data?.message || "영수증 인식에 실패했습니다.", "error");
      } else {
        Swal.fire("오류", res.data?.message || `예상치 못한 오류가 발생했습니다. (code: ${res.status})`, "error");
      }
    } catch (err) {
      Swal.close();
      Swal.fire("오류", err.message || "영수증 확인 중 문제가 발생했습니다.", "error");
    } finally {
      e.target.value = "";
    }
  };

  // ✅ 저장
  const handleSave = async () => {
    const getChangedRows = (curr, orig) =>
      curr
        .map((row, idx) => {
          const changed = {};
          let hasChange = false;
          Object.keys(row).forEach((k) => {
            if (["name", "total"].includes(k) || row.name === "총합") return;
            if (parseNumber(row[k]) !== parseNumber(orig?.[idx]?.[k])) {
              changed[k] = parseNumber(row[k]);
              hasChange = true;
            }
          });
          return hasChange ? { ...row, ...changed } : null;
        })
        .filter(Boolean);

    const changedNow = getChangedRows(dataRows, originalRows);
    const changedBefore = getChangedRows(data2Rows, original2Rows);

    if (!changedNow.length && !changedBefore.length) {
      return Swal.fire("정보", "변경된 내용이 없습니다.", "info");
    }

    try {
      const payload = { nowList: changedNow, beforeList: changedBefore };
      const res = await api.post("/Operate/TallySheetSave", payload);
      if (res.data.code === 200) {
        Swal.fire({
          title: "저장",
          text: "저장되었습니다.",
          icon: "success",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        }).then(async (result) => {
          if (result.isConfirmed) {
            await fetchDataRows(selectedAccountId, year, month);
            await fetchData2Rows(selectedAccountId, year, month);
            setOriginalRows(dataRows.map((r) => ({ ...r })));
            setOriginal2Rows(data2Rows.map((r) => ({ ...r })));
          }
        });
      }
    } catch (e) {
      Swal.fire("실패", e.message || "저장 중 오류 발생", "error");
    }
  };

  const ratioData = useMemo(() => Array.from({ length: 31 }, (_, i) => (((i + 1) / 31) * 100).toFixed(2) + "%"), []);

  // 모달 상태 및 항목 관리 상태
  const [open, setOpen] = useState(false); // 거래처 연결 모달
  const [open2, setOpen2] = useState(false); // 거래처 등록 모달
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState([]);
  const [selectedRight, setSelectedRight] = useState([]);

  // 거래처 연결 모달 오픈
  const handleModalOpen = async () => {
    setOpen(true);
    setSelectedLeft([]);
    setSelectedRight([]);
    try {
      const leftRes = await api.get("/Operate/AccountMappingList");
      setLeftItems(leftRes.data || []);
      if (selectedAccountId) {
        const rightRes = await api.get("/Operate/AccountMappingV2List", {
          params: { account_id: selectedAccountId },
        });
        setRightItems(rightRes.data || []);
      } else {
        setRightItems([]);
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ title: "오류", text: "거래처 목록을 불러오지 못했습니다.", icon: "error" });
    }
  };

  // 항목 이동(오른쪽)
  const moveRight = () => {
    const duplicates = selectedLeft.filter((item) => rightItems.some((r) => r.type === item.type && r.del_yn === "N"));
    if (duplicates.length > 0) {
      Swal.fire({ title: "중복", text: "이미 등록되어 있는 항목입니다.", icon: "warning" });
      return;
    }

    const updatedRightItems = [...rightItems, ...selectedLeft.map((item) => ({ ...item, account_id: selectedAccountId, del_yn: "N" }))];
    setRightItems(updatedRightItems);
    setSelectedLeft([]);
  };

  // 항목 이동(왼쪽) => 삭제 플래그
  const moveLeft = () => {
    const updatedRightItems = rightItems.map((item) => (selectedRight.includes(item) ? { ...item, del_yn: "Y" } : item));
    setRightItems(updatedRightItems);
    setSelectedRight([]);
  };

  // 거래처 연결 저장
  const handleSubmit = async () => {
    if (!selectedAccountId) {
      return Swal.fire({ title: "계정 선택", text: "계정을 먼저 선택하세요.", icon: "warning" });
    }

    try {
      const payload = rightItems;
      const response = await api.post("/Operate/AccountMappingSave", payload);

      if (response.data.code === 200) {
        Swal.fire({ title: "저장", text: "저장되었습니다.", icon: "success" });
        setOpen(false);
        await fetchDataRows(selectedAccountId, year, month);
        await fetchData2Rows(selectedAccountId, year, month);
      }
    } catch (err) {
      Swal.fire({ title: "오류", text: err.message || "저장 실패", icon: "error" });
    }
  };

  // ======================= 거래처 등록 =======================
  const initialForm = {
    name: "",
    biz_no: "",
    ceo_name: "",
    tel: "",
    bank_name: "",
    bank_no: "",
    bank_image: null,
    biz_image: null,
  };

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
    const requiredFields = ["name", "biz_no", "ceo_name", "tel", "bank_name", "bank_no", "bank_image", "biz_image"];

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

        const formDataToSend = new FormData();
        formDataToSend.append("file", file);
        formDataToSend.append("type", "account");
        formDataToSend.append("gubun", field);
        formDataToSend.append("folder", selectedAccountId);

        const res = await api.post("/Operate/OperateImgUpload", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res.data.code === 200) return res.data.image_path;
        throw new Error(res.data.message || "이미지 업로드 실패");
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
        setImagePreviews({ bank_image: null, biz_image: null });
      } else {
        Swal.fire("실패", response.data.message || "저장 중 오류 발생", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("에러", err.message || "저장 중 문제가 발생했습니다.", "error");
    }
  };

  const handleTypeChange = (e, index) => {
    const newTypes = [...receiptType];
    newTypes[index] = e.target.value;
    setReceiptType(newTypes);
  };

  if (loading) return <LoadingScreen />;

  // ✅ React 기반 색상 비교 렌더링
  const renderTable = (tableInstance, originalData, handleChange, dataState, isSecond = false) => (
    <MDBox
      pt={0}
      sx={{
        overflowX: "auto",
        "& table": { borderCollapse: "separate", width: "max-content", minWidth: "50%", borderSpacing: 0 },
        "& th, & td": { border: "1px solid #686D76", textAlign: "center", whiteSpace: "nowrap", fontSize: "12px", padding: "4px" },
        "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 2 },
        "& td:first-of-type, & th:first-of-type": { position: "sticky", left: 0, background: "#f0f0f0", zIndex: 3 },
        "& .total-row": { backgroundColor: "#FFE3A9", fontWeight: "bold" },
      }}
    >
      <table>
        <thead>
          <tr style={{ backgroundColor: "#FFE3A9" }}>
            <td>일 사용기준 %</td>
            {ratioData.map((val, idx) => (
              <td key={idx}>{val}</td>
            ))}
            <td></td>
          </tr>
          {tableInstance.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {tableInstance.getRowModel().rows.map((row, rIdx) => (
            <tr key={row.id} className={row.original.name === "총합" ? "total-row" : ""}>
              {row.getVisibleCells().map((cell) => {
                const colKey = cell.column.columnDef.accessorKey;
                const isEditable = colKey !== "name" && colKey !== "total" && row.original.name !== "총합";

                const currVal = parseNumber(dataState[rIdx]?.[colKey]);
                const origVal = parseNumber(originalData[rIdx]?.[colKey]);
                const isChanged = isEditable && currVal !== origVal;

                return (
                  <td
                    key={cell.id}
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    style={{ color: isChanged ? "#d32f2f" : "black", width: "80px" }}
                    onBlur={(e) => handleChange(rIdx, colKey, e.currentTarget.innerText, isSecond)}
                  >
                    {colKey === "name" ? row.original[colKey] : formatNumber(row.original[colKey])}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* 🔹 총합 밑 이미지첨부 row */}
          <tr>
            <td style={{ fontWeight: "bold", background: "#f0f0f0" }}>이미지첨부</td>

            {Array.from({ length: 31 }, (_, i) => (
              <td
                key={`img_${i}`}
                style={{
                  textAlign: "center",
                  background: "#f9f9f9",
                  fontSize: "12px",
                  verticalAlign: "top",
                }}
              >
                <select
                  value={receiptType[i] || ""}
                  onChange={(e) => handleTypeChange(e, i)}
                  style={{
                    width: "65px",
                    fontSize: "11px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                >
                  <option value="">유형</option>
                  <option value="mart">마트</option>
                  <option value="convenience">편의점</option>
                  <option value="coupang">쿠팡</option>
                  <option value="delivery">배달앱</option>
                </select>
                <br />
                <input
                  type="file"
                  accept="image/*"
                  style={{ width: "65px", fontSize: "12px", marginBottom: "4px" }}
                  onChange={(e) => handleImageUpload(e, i)}
                />
              </td>
            ))}

            <td></td>
          </tr>
        </tbody>
      </table>
    </MDBox>
  );

  return (
    <DashboardLayout>
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <HeaderWithLogout showMenuButton title="🧮 집계표" />
        <MDBox
          pt={1}
          pb={1}
          sx={{
            display: "flex",
            flexWrap: isMobile ? "wrap" : "nowrap",
            justifyContent: isMobile ? "flex-start" : "flex-end",
            alignItems: "center",
            gap: isMobile ? 1 : 2,
          }}
        >
          <TextField
            select
            size="small"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            sx={{ minWidth: isMobile ? 140 : 150 }}
            SelectProps={{ native: true }}
          >
            {(accountList || []).map((row) => (
              <option key={row.account_id} value={row.account_id}>
                {row.account_name}
              </option>
            ))}
          </TextField>

          <Select value={year} onChange={(e) => setYear(e.target.value)} size="small" sx={{ minWidth: isMobile ? 90 : 110, fontSize: isMobile ? "12px" : "13px" }}>
            {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
              <MenuItem key={y} value={y}>
                {y}년
              </MenuItem>
            ))}
          </Select>

          <Select value={month} onChange={(e) => setMonth(e.target.value)} size="small" sx={{ minWidth: isMobile ? 80 : 100, fontSize: isMobile ? "12px" : "13px" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <MenuItem key={m} value={m}>
                {m}월
              </MenuItem>
            ))}
          </Select>

          <MDButton
            variant="gradient"
            color="info"
            onClick={handleModalOpen2}
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 90 : 110, px: isMobile ? 1 : 2 }}
          >
            거래처 등록
          </MDButton>

          <MDButton
            variant="gradient"
            color="info"
            onClick={handleModalOpen}
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 90 : 110, px: isMobile ? 1 : 2 }}
          >
            거래처 연결
          </MDButton>

          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : 90, px: isMobile ? 1 : 2 }}
          >
            저장
          </MDButton>
        </MDBox>
      </MDBox>

      {/* 현재월 테이블 */}
      <MDBox pt={3} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox mx={0} mt={-3} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
                <MDTypography variant="h6" color="white">
                  집계표 {countMonth ? `(${countMonth})` : ""}
                </MDTypography>
              </MDBox>
              {renderTable(table, originalRows, handleCellChange, dataRows)}
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {/* 이전월 테이블 */}
      <MDBox pt={1} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox mx={0} mt={-3} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
                <MDTypography variant="h6" color="white">
                  집계표 {count2Month ? `(${count2Month})` : ""}
                </MDTypography>
              </MDBox>
              {renderTable(table2, original2Rows, handleCellChange, data2Rows, true)}
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {/* ================= 거래처 연결 모달(open) ================= */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <MDBox
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 800,
            bgcolor: "background.paper",
            borderRadius: 2,
            p: 3,
          }}
        >
          <MDBox mx={0} mt={-2} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
            <MDTypography variant="h6" color="white">
              거래처 연결
            </MDTypography>
          </MDBox>

          <Grid container spacing={2}>
            <Grid item xs={5}>
              <YourSelectableTable data={leftItems} selected={selectedLeft} setSelected={setSelectedLeft} />
            </Grid>
            <Grid item xs={2} display="flex" flexDirection="column" justifyContent="center" alignItems="center">
              <MDButton variant="gradient" color="info" onClick={moveRight}>
                {">"}
              </MDButton>
              <MDButton variant="gradient" color="primary" onClick={moveLeft}>
                {"<"}
              </MDButton>
            </Grid>
            <Grid item xs={5}>
              <YourSelectableTable data={rightItems} selected={selectedRight} setSelected={setSelectedRight} />
            </Grid>
          </Grid>

          <MDBox mt={2} display="flex" justifyContent="flex-end" gap={1}>
            <MDButton variant="gradient" color="primary" onClick={() => setOpen(false)}>
              취소
            </MDButton>
            <MDButton variant="gradient" color="info" onClick={handleSubmit}>
              저장
            </MDButton>
          </MDBox>
        </MDBox>
      </Modal>

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
          />

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

          {/* ✅ 은행명: Select로 변경 */}
          <Box mt={2}>
            <Typography sx={{ fontSize: "0.8rem", mb: 0.5 }}>은행명 (필수)</Typography>
            <Select
              fullWidth
              size="small"
              value={KOREAN_BANKS.includes(formData.bank_name) ? formData.bank_name : (formData.bank_name ? "기타(직접입력)" : "")}
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
            {(!KOREAN_BANKS.includes(formData.bank_name) || formData.bank_name === "기타(직접입력)") && (
              <TextField
                fullWidth
                required
                margin="normal"
                label="은행명 직접입력"
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                name="bank_name"
                value={formData.bank_name === "기타(직접입력)" ? "" : (formData.bank_name || "")}
                onChange={handleChange2}
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
                <input type="file" accept="image/*" name="bank_image" onChange={handleImageUploadPreview} />
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
            <Typography sx={{ fontSize: "0.8rem", minWidth: "120px" }}>사업자등록증 (필수)</Typography>
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
                <input type="file" accept="image/*" name="biz_image" onChange={handleImageUploadPreview} />
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
              sx={{ bgcolor: "#e8a500", color: "#ffffff", "&:hover": { bgcolor: "#e8a500", color: "#ffffff" } }}
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
    </DashboardLayout>
  );
}

export default TallySheet;
