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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Autocomplete from "@mui/material/Autocomplete";
import dayjs from "dayjs";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import useTallysheetData, { parseNumber, formatNumber } from "./tallysheetData";
import Swal from "sweetalert2";
import api from "api/api";
import PropTypes from "prop-types";

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
    "& table": {
      borderCollapse: "collapse",
      width: "100%",
      minWidth: "100%",
      borderSpacing: 0,
    },
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
                <input
                  type="checkbox"
                  checked={isSelected(row)}
                  onChange={() => toggleSelect(row)}
                />
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
function TallySheetTab() {
  // ✅ localStorage account_id를 우선 적용
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");

  const [originalRows, setOriginalRows] = useState([]);
  const [original2Rows, setOriginal2Rows] = useState([]);
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [images, setImages] = useState(Array(31).fill(null));
  const [receiptType, setReceiptType] = useState([]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ 탭 상태 (0: 현재월, 1: 전월)
  const [tabValue, setTabValue] = useState(0);

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

  // ✅ localStorage account_id에 해당하는 거래처만 보이도록 필터링
  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter((row) => String(row.account_id) === String(localAccountId));
  }, [accountList, localAccountId]);

  // ✅ Autocomplete용 선택된 거래처 객체
  const selectedAccountOption = useMemo(() => {
    if (!selectedAccountId) return null;
    return (
      (filteredAccountList || []).find((a) => String(a.account_id) === String(selectedAccountId)) ||
      null
    );
  }, [filteredAccountList, selectedAccountId]);

  // ✅ 원본 데이터 관리 로직 개선
  useEffect(() => {
    setDataRows([]);
    setData2Rows([]);
    setOriginalRows([]);
    setOriginal2Rows([]);
  }, [selectedAccountId, year, month, setDataRows, setData2Rows]);

  useEffect(() => {
    if (dataRows?.length > 0 && originalRows.length === 0) {
      setOriginalRows(dataRows.map((r) => ({ ...r })));
    }
  }, [dataRows, originalRows.length]);

  useEffect(() => {
    if (data2Rows?.length > 0 && original2Rows.length === 0) {
      setOriginal2Rows(data2Rows.map((r) => ({ ...r })));
    }
  }, [data2Rows, original2Rows.length]);

  // ✅ 거래처 자동 선택: localStorage 있으면 고정, 없으면 첫번째
  useEffect(() => {
    if (localAccountId) {
      setSelectedAccountId(localAccountId);
      return;
    }

    if ((accountList || []).length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId, localAccountId]);

  // ======================== ✅ 법인카드 모달 플로우(추가) ========================
  const [cardChoiceOpen, setCardChoiceOpen] = useState(false); // 등록/수정 선택
  const [cardCreateOpen, setCardCreateOpen] = useState(false); // 1번 모달(등록)
  const [cardListOpen, setCardListOpen] = useState(false); // 2번 모달(목록)
  const [cardEditOpen, setCardEditOpen] = useState(false); // 3번 모달(수정)

  const [cardContext, setCardContext] = useState({
    isSecond: false,
    rowIndex: null,
    colKey: null,
    dayIndex: null,
    dateStr: "",
    cellValue: 0,
  });

  const [cardRows, setCardRows] = useState([]);
  const [cardSelectedRow, setCardSelectedRow] = useState(null);

  const [cardForm, setCardForm] = useState({
    id: null,
    merchant: "",
    amount: "",
    receipt: null,
  });

  const buildDateStr = (y, m, dayIdx) => {
    const mm = String(m).padStart(2, "0");
    const dd = String(dayIdx + 1).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  // ✅ 법인카드 목록 조회 (엔드포인트/필드명은 백엔드에 맞게 수정)
  const fetchCorpCardList = async (accountId, dateStr) => {
    // 예시: /Operate/CorpCardPayList?account_id=...&pay_date=YYYY-MM-DD
    const res = await api.get("/Operate/CorpCardPayList", {
      params: { account_id: accountId, pay_date: dateStr },
      validateStatus: () => true,
    });

    if (res.status !== 200) throw new Error(res.data?.message || "목록 조회 실패");
    return res.data || [];
  };

  // ✅ 등록/수정 저장 (엔드포인트/필드명은 백엔드에 맞게 수정)
  const saveCorpCard = async (mode) => {
    const fd = new FormData();
    fd.append("account_id", selectedAccountId);
    fd.append("pay_date", cardContext.dateStr);
    fd.append("merchant", cardForm.merchant);
    fd.append("amount", parseNumber(cardForm.amount));

    if (cardForm.receipt) fd.append("file", cardForm.receipt);
    if (mode === "edit") fd.append("id", cardForm.id);

    const url = mode === "create" ? "/Operate/CorpCardPayCreate" : "/Operate/CorpCardPayUpdate";

    const res = await api.post(url, fd, {
      headers: { "Content-Type": "multipart/form-data" },
      validateStatus: () => true,
    });

    // 백엔드 응답 규격에 맞게(예: {code:200})라면 아래 조건만 조정
    if (res.status !== 200 || res.data?.code === 400) {
      throw new Error(res.data?.message || "저장 실패");
    }
    return res.data;
  };

  // ✅ type=1000 셀 클릭 시 플로우
  const handleCorpCardCellClick = (rowOriginal, rIdx, colKey, isSecond = false) => {
    // 총합/비편집 영역 제외
    if (!rowOriginal || rowOriginal.name === "총합") return;
    if (colKey === "name" || colKey === "total") return;

    // type 1000만 대상
    if (String(rowOriginal.type) !== "1000") return;

    const rows = isSecond ? data2Rows : dataRows;
    const cellVal = parseNumber(rows?.[rIdx]?.[colKey]);

    const dayIndex = Number(String(colKey).replace("day_", "")) - 1;
    if (Number.isNaN(dayIndex) || dayIndex < 0) return;

    const dateStr = buildDateStr(year, month, dayIndex);

    setCardContext({
      isSecond,
      rowIndex: rIdx,
      colKey,
      dayIndex,
      dateStr,
      cellValue: cellVal,
    });

    // 값이 0이면 바로 등록 모달
    if (!cellVal || cellVal === 0) {
      setCardForm({ id: null, merchant: "", amount: "", receipt: null });
      setCardCreateOpen(true);
      return;
    }

    // 0이 아니면 등록/수정 선택
    setCardChoiceOpen(true);
  };

  const openCreateFromChoice = () => {
    setCardChoiceOpen(false);
    setCardForm({ id: null, merchant: "", amount: "", receipt: null });
    setCardCreateOpen(true);
  };

  const openListFromChoice = async () => {
    setCardChoiceOpen(false);
    setCardSelectedRow(null);

    try {
      Swal.fire({
        title: "불러오는 중",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const list = await fetchCorpCardList(selectedAccountId, cardContext.dateStr);
      Swal.close();

      setCardRows(list);
      setCardListOpen(true);
    } catch (e) {
      Swal.close();
      Swal.fire("오류", e.message || "목록 조회 중 오류", "error");
    }
  };

  const openEditFromList = () => {
    if (!cardSelectedRow) {
      Swal.fire("안내", "수정할 항목을 선택하세요.", "info");
      return;
    }

    setCardForm({
      id: cardSelectedRow.id, // ✅ 백엔드 PK 필드명에 맞게
      merchant: cardSelectedRow.merchant || "", // ✅ 필드명에 맞게
      amount: String(cardSelectedRow.amount ?? ""),
      receipt: null,
    });

    setCardListOpen(false);
    setCardEditOpen(true);
  };
  // ======================== ✅ 법인카드 모달 플로우(추가 끝) ========================

  // 컬럼 구성
  const columns = useMemo(() => {
    const dayColumns = Array.from({ length: 31 }, (_, i) => ({
      header: `${i + 1}일`,
      accessorKey: `day_${i + 1}`,
      size: 100,
    }));
    return [
      { header: "구분", accessorKey: "name", size: 100 },
      ...dayColumns,
      { header: "합계", accessorKey: "total", size: 100 },
    ];
  }, []);

  // 합계 계산
  const makeTableData = (rows) => {
    if (!rows || rows.length === 0) return [];

    const calculatedRows = rows.map((r) => {
      const total = Array.from({ length: 31 }, (_, i) => parseNumber(r[`day_${i + 1}`])).reduce(
        (sum, val) => sum + val,
        0
      );
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

    if (!typeForDay) return Swal.fire("경고", "영수증 유형을 선택하세요.", "info");

    const file = e.target.files[0];
    if (!file) return;

    setImages((prev) => {
      const newImages = [...prev];
      newImages[dayIndex] = file;
      return newImages;
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", typeForDay);
    formData.append("account_id", selectedAccountId);

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

        const { total, saleDate, type } = res.data;

        const sale = dayjs(saleDate);
        if (sale.isValid()) {
          if (sale.year() !== year || sale.month() + 1 !== month) {
            Swal.fire(
              "주의",
              `영수증 날짜(${sale.format("YYYY-MM-DD")})가 선택된 연월(${year}-${String(
                month
              ).padStart(2, "0")})과 다릅니다.`,
              "warning"
            );
            return;
          }
        }

        const colKey = `day_${dayIndex + 1}`;

        setDataRows((prev) => {
          if (!prev || prev.length === 0) return prev;

          const targetIndex = prev.findIndex((row) => String(row.type) === String(type));
          if (targetIndex === -1) {
            Swal.fire(
              "매핑 필요",
              "해당 영수증 유형이 집계표 항목과 매핑되어 있지 않습니다.\n'거래처 연결'에서 먼저 매핑을 설정해주세요.",
              "info"
            );
            return prev;
          }

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
        Swal.fire(
          "오류",
          res.data?.message || `예상치 못한 오류가 발생했습니다. (code: ${res.status})`,
          "error"
        );
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
          }
        });
      }
    } catch (e) {
      Swal.fire("실패", e.message || "저장 중 오류 발생", "error");
    }
  };

  const ratioData = useMemo(
    () => Array.from({ length: 31 }, (_, i) => (((i + 1) / 31) * 100).toFixed(2) + "%"),
    []
  );

  // 모달 상태 및 항목 관리 상태
  const [open, setOpen] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState([]);
  const [selectedRight, setSelectedRight] = useState([]);

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

  const moveRight = () => {
    const duplicates = selectedLeft.filter((item) =>
      rightItems.some((r) => r.type === item.type && r.del_yn === "N")
    );
    if (duplicates.length > 0) {
      Swal.fire({ title: "중복", text: "이미 등록되어 있는 항목입니다.", icon: "warning" });
      return;
    }

    const updatedRightItems = [
      ...rightItems,
      ...selectedLeft.map((item) => ({ ...item, account_id: selectedAccountId, del_yn: "N" })),
    ];
    setRightItems(updatedRightItems);
    setSelectedLeft([]);
  };

  const moveLeft = () => {
    const updatedRightItems = rightItems.map((item) =>
      selectedRight.includes(item) ? { ...item, del_yn: "Y" } : item
    );
    setRightItems(updatedRightItems);
    setSelectedRight([]);
  };

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

  // 거래처 등록 (원본 로직 유지)
  const [formData, setFormData] = useState({ name: "" });
  const [imagePreviews, setImagePreviews] = useState({ bank_image: null, biz_image: null });
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

  const handleModalOpen2 = async () => setOpen2(true);
  const handleModalClose2 = async () => setOpen2(false);

  const handleChange2 = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const handleImageUploadPreview = (e) => {
    const { name, files } = e.target;
    const file = files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreviews((prev) => ({ ...prev, [name]: previewUrl }));
    setFormData((prev) => ({ ...prev, [name]: file }));
  };

  const handleSubmit2 = async () => {
    const requiredFields = ["name", "biz_no", "ceo_name", "tel", "bank_image", "biz_image"];
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

      const payload = { ...formData, bank_image: bankPath, biz_image: bizPath, del_yn: "N" };
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
        setFormData({ name: "" });
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

  const renderTable = (tableInstance, originalData, handleChange, dataState, isSecond = false) => (
    <MDBox
      pt={0}
      sx={{
        overflowX: "auto",
        "& table": {
          borderCollapse: "separate",
          width: "max-content",
          minWidth: "50%",
          borderSpacing: 0,
        },
        "& th, & td": {
          border: "1px solid #686D76",
          textAlign: "center",
          whiteSpace: "nowrap",
          fontSize: "12px",
          padding: "4px",
        },
        "& th": { backgroundColor: "#f0f0f0", position: "sticky", top: 0, zIndex: 2 },
        "& td:first-of-type, & th:first-of-type": {
          position: "sticky",
          left: 0,
          background: "#f0f0f0",
          zIndex: 3,
        },
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
                const isEditable =
                  colKey !== "name" && colKey !== "total" && row.original.name !== "총합";

                const currVal = parseNumber(dataState[rIdx]?.[colKey]);
                const origVal = parseNumber(originalData[rIdx]?.[colKey]);
                const isChanged = isEditable && currVal !== origVal;

                return (
                  <td
                    key={cell.id}
                    contentEditable={isEditable}
                    suppressContentEditableWarning
                    style={{ color: isChanged ? "#d32f2f" : "black", width: "80px" }}
                    // ✅ type=1000 셀 클릭 시 법인카드 모달 플로우 (추가)
                    onClick={() => handleCorpCardCellClick(row.original, rIdx, colKey, isSecond)}
                    onBlur={(e) => handleChange(rIdx, colKey, e.currentTarget.innerText, isSecond)}
                  >
                    {colKey === "name" ? row.original[colKey] : formatNumber(row.original[colKey])}
                  </td>
                );
              })}
            </tr>
          ))}

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
    <>
      {/* 상단 고정 필터/저장 */}
      <MDBox
        pt={1}
        pb={1}
        gap={1}
        sx={{
          display: "flex",
          flexWrap: isMobile ? "wrap" : "nowrap",
          justifyContent: isMobile ? "flex-start" : "flex-end",
          position: "sticky",
          zIndex: 10,
          top: 75,
          backgroundColor: "#ffffff",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
        }}
      >
        {/* ✅ 거래처: 문자 검색 가능한 Autocomplete */}
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={filteredAccountList || []}
          value={selectedAccountOption}
          onChange={(_, newValue) => setSelectedAccountId(newValue ? newValue.account_id : "")}
          getOptionLabel={(opt) => (opt?.account_name ? String(opt.account_name) : "")}
          isOptionEqualToValue={(opt, val) => String(opt?.account_id) === String(val?.account_id)}
          disableClearable={!!localAccountId}
          disabled={!!localAccountId}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 검색"
              placeholder="거래처명을 입력"
              sx={{
                "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                "& input": { padding: "0 8px" },
              }}
            />
          )}
        />

        <TextField
          select
          size="small"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ minWidth: isMobile ? 140 : 150 }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          sx={{ minWidth: isMobile ? 140 : 150 }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </TextField>

        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 70 : 90,
            px: isMobile ? 1 : 2,
          }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* ✅ 테이블 탭(현재월/전월) */}
      <MDBox pt={3} pb={3}>
        <Card>
          <MDBox
            mx={0}
            mt={-3}
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}
          >
            <MDTypography variant="h6" color="white">
              집계표
            </MDTypography>

            <Tabs
              value={tabValue}
              onChange={(_, v) => setTabValue(v)}
              textColor="inherit"
              indicatorColor="secondary"
              variant={isMobile ? "scrollable" : "standard"}
              sx={{
                minHeight: 36,
                "& .MuiTab-root": {
                  minHeight: 36,
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 13,
                  fontWeight: 600,
                },
                "& .Mui-selected": { color: "#fff" },
              }}
            >
              <Tab label={countMonth ? `현재월 (${countMonth})` : "현재월"} />
              <Tab label={count2Month ? `전월 (${count2Month})` : "전월"} />
            </Tabs>
          </MDBox>

          <MDBox pt={1}>
            {tabValue === 0 && renderTable(table, originalRows, handleCellChange, dataRows)}
            {tabValue === 1 &&
              renderTable(table2, original2Rows, handleCellChange, data2Rows, true)}
          </MDBox>
        </Card>
      </MDBox>

      {/* 거래처 연결 모달 */}
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
          <MDBox
            mx={0}
            mt={-2}
            py={1}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
          >
            <MDTypography variant="h6" color="white">
              거래처 연결
            </MDTypography>
          </MDBox>

          <Grid container spacing={2}>
            <Grid item xs={5}>
              <YourSelectableTable
                data={leftItems}
                selected={selectedLeft}
                setSelected={setSelectedLeft}
              />
            </Grid>
            <Grid
              item
              xs={2}
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
            >
              <MDButton variant="gradient" color="info" onClick={moveRight}>
                {">"}
              </MDButton>
              <MDButton variant="gradient" color="primary" onClick={moveLeft}>
                {"<"}
              </MDButton>
            </Grid>
            <Grid item xs={5}>
              <YourSelectableTable
                data={rightItems}
                selected={selectedRight}
                setSelected={setSelectedRight}
              />
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

      {/* 거래처 등록 모달 */}
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

      {/* 이미지 확대 미리보기 */}
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
              style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: 8, objectFit: "contain" }}
            />
          )}
        </Box>
      </Modal>

      {/* ======================== ✅ 법인카드 모달 3종 (추가) ======================== */}

      {/* 등록/수정 선택 모달 */}
      <Modal open={cardChoiceOpen} onClose={() => setCardChoiceOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 420,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            법인카드 결제
          </Typography>
          <Typography sx={{ fontSize: 13, mb: 2 }}>
            이미 입력된 금액이 있습니다.
            <br />
            등록 / 수정을 선택하세요. ({cardContext.dateStr})
          </Typography>

          <Box display="flex" justifyContent="flex-end" gap={1}>
            <Button variant="contained" color="info" onClick={openCreateFromChoice}>
              등록
            </Button>
            <Button variant="contained" color="primary" onClick={openListFromChoice}>
              수정
            </Button>
            <Button variant="outlined" onClick={() => setCardChoiceOpen(false)}>
              취소
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 1) 법인카드 결제 등록 모달 */}
      <Modal open={cardCreateOpen} onClose={() => setCardCreateOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 520,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            법인카드 결제 등록
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="사용처"
                value={cardForm.merchant}
                onChange={(e) => setCardForm((p) => ({ ...p, merchant: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="합계금액"
                value={cardForm.amount}
                onChange={(e) => setCardForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography sx={{ minWidth: 60, fontSize: 13 }}>영수증</Typography>
                <Button variant="outlined" component="label">
                  영수증 업로드
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) =>
                      setCardForm((p) => ({ ...p, receipt: e.target.files?.[0] || null }))
                    }
                  />
                </Button>
                <Typography sx={{ fontSize: 12, color: "#666" }}>
                  {cardForm.receipt?.name || ""}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box mt={3} display="flex" justifyContent="center" gap={2}>
            <Button
              variant="contained"
              color="info"
              onClick={async () => {
                try {
                  await saveCorpCard("create");
                  Swal.fire("완료", "등록되었습니다.", "success");
                  setCardCreateOpen(false);
                } catch (e) {
                  Swal.fire("오류", e.message || "등록 실패", "error");
                }
              }}
            >
              저장
            </Button>
            <Button variant="contained" color="warning" onClick={() => setCardCreateOpen(false)}>
              취소
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 2) 법인카드 결제 목록 모달 */}
      <Modal open={cardListOpen} onClose={() => setCardListOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 760,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            법인카드 결제 목록
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#666", mb: 2 }}>{cardContext.dateStr}</Typography>

          <Box sx={{ maxHeight: 380, overflow: "auto", border: "1px solid #ddd" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>사용처</th>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>금액</th>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>결제일자</th>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>영수증</th>
                </tr>
              </thead>
              <tbody>
                {(cardRows || []).map((r, idx) => {
                  const selected = cardSelectedRow?.id === r.id;
                  return (
                    <tr
                      key={r.id ?? idx}
                      onClick={() => setCardSelectedRow(r)}
                      style={{ background: selected ? "#d3f0ff" : "white", cursor: "pointer" }}
                    >
                      <td style={{ border: "1px solid #ddd", padding: 6 }}>{r.merchant}</td>
                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "right" }}>
                        {formatNumber(r.amount)}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        {r.pay_date}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: 6, textAlign: "center" }}>
                        {r.receipt_url ? "O" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>

          <Box mt={2} display="flex" justifyContent="center" gap={2}>
            <Button variant="contained" color="info" onClick={openEditFromList}>
              선택
            </Button>
            <Button variant="contained" color="warning" onClick={() => setCardListOpen(false)}>
              취소
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 3) 법인카드 결제 수정 모달 */}
      <Modal open={cardEditOpen} onClose={() => setCardEditOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 520,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            법인카드 결제 수정
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="사용처"
                value={cardForm.merchant}
                onChange={(e) => setCardForm((p) => ({ ...p, merchant: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="합계금액"
                value={cardForm.amount}
                onChange={(e) => setCardForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography sx={{ minWidth: 60, fontSize: 13 }}>영수증</Typography>
                <Button variant="outlined" component="label">
                  영수증 업로드
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) =>
                      setCardForm((p) => ({ ...p, receipt: e.target.files?.[0] || null }))
                    }
                  />
                </Button>
                <Typography sx={{ fontSize: 12, color: "#666" }}>
                  {cardForm.receipt?.name || "(새 파일 선택 시 교체)"}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box mt={3} display="flex" justifyContent="center" gap={2}>
            <Button
              variant="contained"
              color="info"
              onClick={async () => {
                try {
                  await saveCorpCard("edit");
                  Swal.fire("완료", "수정되었습니다.", "success");
                  setCardEditOpen(false);
                } catch (e) {
                  Swal.fire("오류", e.message || "수정 실패", "error");
                }
              }}
            >
              저장
            </Button>
            <Button variant="contained" color="warning" onClick={() => setCardEditOpen(false)}>
              취소
            </Button>
          </Box>
        </Box>
      </Modal>
      {/* ======================== ✅ 법인카드 모달 3종 (추가 끝) ======================== */}
    </>
  );
}

export default TallySheetTab;
