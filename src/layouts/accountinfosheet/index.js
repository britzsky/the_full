import React, { useMemo, useState, forwardRef, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Modal from "@mui/material/Modal";
import IconButton from "@mui/material/IconButton";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RefreshIcon from "@mui/icons-material/Refresh"
import DatePicker from "react-datepicker";
import { Grid, Box, MenuItem, TextField, Card } from "@mui/material";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import LoadingScreen from "layouts/loading/loadingscreen";
import useAccountInfosheetData from "./data/accountinfosheetData";
import PropTypes from "prop-types";
import Swal from "sweetalert2";
import api from "api/api";
import { useParams } from "react-router-dom"; // ✅ 추가

// 숫자 컬럼만 천단위 콤마 포맷
const numericCols = ["basic_price", "diet_price", "before_diet_price", "elderly", "snack", "cesco", "food_process", "dishwasher", "water_puri", "utility_bills"];
const formatNumber = (num) => {
  if (num === null || num === undefined || num === "") return "";
  return Number(num).toLocaleString();
};

function AccountInfoSheet() {

  const { account_id: paramAccountId } = useParams(); // ✅ URL에서 account_id 받기
  const [selectedAccountId, setSelectedAccountId] = useState(paramAccountId || ""); // 기본값 설정
  const {
    basicInfo, priceRows, etcRows, managerRows, eventRows, businessImgRows,
    accountList, loading, saveData, fetchAllData
  } = useAccountInfosheetData(selectedAccountId);

  const [isOpen, setIsOpen] = useState(false);
  const [activeImg, setActiveImg] = useState("");

  // ✅ accountList 로딩 완료 후, URL에서 받은 account_id가 있을 때 자동 선택
  useEffect(() => {
    if (accountList.length > 0 && paramAccountId) {
      const found = accountList.find((a) => a.account_id === paramAccountId);
      if (found) setSelectedAccountId(found.account_id);
    } else if (accountList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, paramAccountId, selectedAccountId]);
  
  // ✅ 선택된 account_id로 조회
  useEffect(() => {
    if (selectedAccountId) {
      fetchAllData(selectedAccountId);
    }
  }, [selectedAccountId]);

  const onSearchList = (e) => setSelectedAccountId(e.target.value);

  const handleInputClick = (type) => {
    if (selectedFiles[type]?.path) {
      setActiveImg(`http://localhost:8080${selectedFiles[type].path}`);
      setIsOpen(true);
    }
  };

  const [selectedFiles, setSelectedFiles] = useState({
    business_report: null,
    business_regist: null,
    kitchen_drawing: null,
  });

  // 버튼 클릭 시 input 클릭
  const handleFileSelect = (type) => {
    document.getElementById(type).click();
  };

  // input 변경 시 파일 상태 업데이트
  const handleFileChange = (type, e) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [type]: e.target.files[0],
    }));
  };

  // 한 번에 업로드
  const handleFileUpload = async () => {
    const formData = new FormData();
    const account_id = basicInfo.account_id; // 실제 account_id로 변경
    formData.append("account_id", account_id);

    let hasFile = false;
    Object.entries(selectedFiles).forEach(([type, file]) => {
      if (file && file instanceof File) {
        formData.append(type, file);
        hasFile = true;
      }
    });

    if (!hasFile) return alert("업로드할 파일을 선택하세요!");

    try {
      await api.post("/Account/AccountBusinessImgUpload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("모든 파일 업로드 완료!");
      setSelectedFiles({
        business_report: null,
        business_regist: null,
        kitchen_drawing: null,
      });
    } catch (err) {
      console.error(err);
      alert("업로드 실패!");
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

    if (basicInfo.contract_start) {
      const [y, m, d] = basicInfo.contract_start.split("-");
      setStartDate(new Date(y, m - 1, d));
    }
    if (basicInfo.contract_end) {
      const [y, m, d] = basicInfo.contract_end.split("-");
      setEndDate(new Date(y, m - 1, d));
    }

    if (businessImgRows && businessImgRows.length > 0 && businessImgRows[0]) {
      const img = businessImgRows[0] || {};
      const newSelectedFiles = {};

      ["business_report", "business_regist", "kitchen_drawing"].forEach((key) => {
        const filePath = img[key];
        if (filePath) {
          newSelectedFiles[key] = {
            name: filePath.split("/").pop(),
            path: filePath, // 전체 경로 저장
          };
        }
      });
      setSelectedFiles(newSelectedFiles);
    }
  }, [basicInfo, priceRows, etcRows, managerRows, eventRows, businessImgRows]);

  // 값 변경 핸들러
  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getColor = (field, value, rowIndex = null, tableType = null) => {
    let basicVal = "";
    if (tableType === "price") basicVal = originalPrice[rowIndex]?.[field];
    else if (tableType === "etc") basicVal = originalEtc[rowIndex]?.[field];
    else if (tableType === "manager") basicVal = originalManager[rowIndex]?.[field];
    else if (tableType === "event") basicVal = originalEvent[rowIndex]?.[field];
    else basicVal = originalBasic[field];

    const currentVal = value ?? "";
    if (basicVal === undefined || basicVal === null) return "black";
    return String(currentVal) === String(basicVal) ? "black" : "red";
  };

  // 달력용 MDInput (forwardRef 필수)
  const DatePickerInput = forwardRef(({ value, onClick, placeholder, field }, ref) => {
    const basicVal = basicInfo[field] ?? "";
    const currentVal = value ?? "";

    return (
      <MDInput
        value={value}
        onClick={onClick}
        placeholder={placeholder}
        inputRef={ref}
        sx={{
          flex: 1,
          fontSize: "13px",
          "& input": {
            padding: "4px 4px",
            height: "20px",
            color: String(currentVal) === String(basicVal) ? "black" : "red",
          },
        }}
      />
    );
  });

  DatePickerInput.propTypes = {
    value: PropTypes.string,
    onClick: PropTypes.func,
    placeholder: PropTypes.string,
    style: PropTypes.object,
    field: PropTypes.object,
  };

  // ----------------- 테이블 컬럼 -----------------
  const priceTableColumns = useMemo(
    () => [
      {
        header: "식단가",
        columns: [
          { header: "2025년 식단가", accessorKey: "diet_price" },
          { header: "기초 식단가", accessorKey: "basic_price" },
          { header: "인상전 단가", accessorKey: "before_diet_price" },
          // ✅ 여기! after_dt 달력으로 변경
          {
            header: "인상시점",
            accessorKey: "after_dt",
            cell: ({ row, getValue }) => {
              const value = getValue();
              const [dateValue, setDateValue] = useState(
                value ? new Date(value) : null
              );

              return (
                <DatePicker
                  selected={dateValue}
                  onChange={(date) => {
                    setDateValue(date);
                    row.original.after_dt = date
                      ? date.toISOString().slice(0, 10)
                      : "";
                  }}
                  dateFormat="yyyy-MM-dd"
                  customInput={
                    <input
                      style={{
                        width: "100%",
                        border: "none",
                        textAlign: "center",
                        background: "transparent",
                        color:
                          String(row.original.after_dt) ===
                          String(row._valuesCache.after_dt)
                            ? "black"
                            : "red",
                      }}
                    />
                  }
                />
              );
            },
          },
          { header: "어르신", accessorKey: "elderly" },
          { header: "간식", accessorKey: "snack" },
          { header: "직원", accessorKey: "employ" },
        ],
      },
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
          { header: "식기세척기", accessorKey: "dishwasher" },
          { header: "세스코 방제", accessorKey: "cesco" },
          { header: "정수기", accessorKey: "water_puri" },
          { header: "수도광열비", accessorKey: "utility_bills" },
          { header: "경비비고", accessorKey: "expenses_note" },
        ],
      },
    ],
    []
  );

  const etcTableColumns = useMemo(
    () => [
      {
        header: "배식방법",
        columns: [
          { header: "세팅/바트/그릇", accessorKey: "setting_item" },
          { header: "조리실", accessorKey: "cuisine" },
          { header: "특이사항", accessorKey: "cuisine_note" },
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
      {
        header: "보험",
        columns: [{ header: "보험가입 현황", accessorKey: "insurance_note" }],
      },
      {
        header: "마감",
        columns: [{ header: "마감 특이사항", accessorKey: "finish_note" }],
      },
    ],
    []
  );

  const eventTableColumns = useMemo(
    () => [
      {
        header: "제안",
        columns: [
          { header: "만족도 조사", accessorKey: "satis_note",
            cell: ({ getValue, row, column }) => (
              <textarea
                value={getValue() || ""}
                onChange={(e) =>
                  row.original[column.id] = e.target.value // 상태관리 필요시 수정
                }
                rows={2} // 👉 여기서 두 줄 입력
                style={{
                  width: "100%",
                  resize: "none", // 크기 고정 (원하면 "both")
                }}
              />
            ),
          },
          { header: "위생점검", accessorKey: "hygiene_note" },
          { header: "이벤트", accessorKey: "event_note" },
        ],
      },
    ],
    []
  );

  const dropdownOptions = {
    puri_type: [
      { value: 0, label: "해당없음" },
      { value: 1, label: "고객사 렌탈" },
      { value: 2, label: "더채움 렌탈" },
      { value: 3, label: "고객사 소유" },
      { value: 4, label: "더채움 소유" },
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
  };

  const columnWidths = {
    diet_price: "3%",
    basic_price: "3%",
    before_diet_price: "3%",
    after_dt: "5%",
    elderly: "5%",
    snack: "5%",
    employ: "5%",
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
    expenses_note: "10%",
    setting_item: "5%",
    cuisine: "3%",
    cuisine_note: "5%",
    name: "3%",
    budget_note: "5%",
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
  };
  // ----------------- 공통 테이블 렌더 -----------------
  const renderTable = (dataState, setDataState, tableType, columns) => {
    const table = useReactTable({ data: dataState, columns, getCoreRowModel: getCoreRowModel() });

    const getOriginal = (rowIndex, field) => {
      if (tableType === "price") return originalPrice[rowIndex]?.[field];
      if (tableType === "etc") return originalEtc[rowIndex]?.[field];
      if (tableType === "manager") return originalManager[rowIndex]?.[field];
      if (tableType === "event") return originalEvent[rowIndex]?.[field];
      return "";
    };

    return (
      <MDBox
        sx={{
          overflowX: "auto",
          "& table": { borderCollapse: "collapse", width: "100%" },
          "& th, & td": {
            border: "1px solid #686D76",
            textAlign: "center",
            padding: "3px",
            fontSize: "13px",
            whiteSpace: "nowrap",
          },
          "& th": { backgroundColor: "#f0f0f0" },
          "& .edited-cell": { color: "#d32f2f", fontWeight: 500 },
          ".ReactModal__Content img": { maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" },
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
                  const parseVal = (val) =>
                    isNumeric ? Number(String(val).replace(/,/g, "")) || 0 : val ?? "";
                  const changed = parseVal(currentValue) !== parseVal(originalValue);

                  return (
                    <td
                      key={cell.id}
                      contentEditable={
                        !["name", "members", "work_system", "puri_type", "gas_type", "business_type"].includes(colKey)
                      }
                      suppressContentEditableWarning
                      style={{
                        color: changed ? "red" : "black",
                        padding: "3px",
                        width: columnWidths[colKey] || "auto",
                        minWidth: "40px",
                      }}
                      onBlur={(e) => {
                        if (
                          ["name", "members", "work_system", "puri_type", "gas_type", "business_type"].includes(colKey)
                        )
                          return;

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
                      {["puri_type", "gas_type", "business_type"].includes(colKey) ? (
                        <select
                          value={currentValue ?? 0}
                          style={{
                            width: "50%",
                            color: String(currentValue) === String(originalValue) ? "black" : "red",
                          }}
                          onChange={(e) => {
                            const updatedRows = dataState.map((r, idx) =>
                              idx === rowIndex ? { ...r, [colKey]: Number(e.target.value) } : r
                            );
                            setDataState(updatedRows);
                          }}
                        >
                          {dropdownOptions[colKey].map((opt) => (
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

  // ----------------- 전체 저장 -----------------
  const handleSave = async () => {
    const payload = { formData, priceData, etcData, managerData, eventData };
    
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

  return (
    <DashboardLayout>
      {/* 버튼's */}
      <MDBox
        pt={0}
        pb={2}
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
        }}
      >
        {/* 왼쪽 버튼 그룹 */}
        <MDBox sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {["business_report", "business_regist", "kitchen_drawing"].map((type) => (
            <React.Fragment key={type}>
              {/* 파일 선택 버튼 */}
              <MDButton
                variant="gradient"
                color="success"
                onClick={() => handleFileSelect(type)}
              >
                {type === "business_report"
                  ? "영업신고증"
                  : type === "business_regist"
                  ? "사업자등록증"
                  : "주방도면"}
              </MDButton>

              {/* 파일명 input, 클릭 시 modal */}
              <MDInput
                value={selectedFiles[type]?.name || ""}
                readOnly
                sx={{ width: 100, cursor: selectedFiles[type]?.path ? "pointer" : "default" }}
                onClick={() => handleInputClick(type)}
              />
              {/* 숨긴 input */}
              <input
                type="file"
                id={type}
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(type, e)}
              />
            </React.Fragment>
          ))}
          {/* 이미지 뷰어 모달 */}
          <Modal
            open={isOpen}
            onClose={() => setIsOpen(false)}
            sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Box sx={{ width: "100vw", height: "90vh", bgcolor: "rgba(0,0,0,0.9)", position: "relative" }}>
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={5}
                centerOnInit
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    {/* 컨트롤 버튼 영역 */}
                    <Box
                      sx={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        zIndex: 1000,
                        bgcolor: "rgba(255,255,255,0.2)",
                        borderRadius: 2,
                        p: 1,
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{ color: "white" }}
                        onClick={() => zoomIn()}
                      >
                        <ZoomInIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{ color: "white" }}
                        onClick={() => zoomOut()}
                      >
                        <ZoomOutIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{ color: "white" }}
                        onClick={() => resetTransform()}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Box>

                    {/* 이미지 영역 */}
                    <TransformComponent>
                      <img
                        src={activeImg}
                        alt="미리보기"
                        style={{
                          maxWidth: "80%",
                          maxHeight: "80%",
                          margin: "auto",
                          display: "block",
                        }}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </Box>
          </Modal>
          {/* 업로드 버튼 */}
          <MDButton variant="gradient" color="primary" onClick={handleFileUpload}>
            업로드
          </MDButton>
        </MDBox>

        <TextField
          select
          size="small"
          value={selectedAccountId}
          onChange={onSearchList}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          {(accountList || []).map((row) => (
            <option key={row.account_id} value={row.account_id}>
              {row.account_name}
            </option>
          ))}
        </TextField>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>
      {/* 상단 기본 정보 */}
      <Card sx={{ p: 2, mb: 1 }}>
        <Grid container spacing={2}>
          {/* 왼쪽 */}
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              {/* 업장명 + 계약기간 */}
              <Grid item xs={12} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <MDTypography sx={{ minWidth: "75px", fontSize: "13px", textAlign: "right", fontWeight: "bold" }}>업장명</MDTypography>
                <MDInput
                  sx={{ flex: 1, fontSize: "13px", "& input": { padding: "4px 4px", color: getColor("account_name", formData.account_name) } }}
                  value={formData.account_name || ""}
                  onChange={(e) => handleChange("account_name", e.target.value)}
                />
                <MDTypography sx={{ minWidth: "75px", fontSize: "13px", textAlign: "right", fontWeight: "bold" }}>계약기간</MDTypography>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => {
                    setStartDate(date);
                    handleChange("contract_start", date ? date.toISOString().slice(0, 10) : "");
                  }}
                  dateFormat="yyyy-MM-dd"
                  customInput={<DatePickerInput field="contract_start" />}
                  placeholderText="To"
                />
                ~
                <DatePicker
                  selected={endDate}
                  onChange={(date) => {
                    setEndDate(date);
                    handleChange("contract_end", date ? date.toISOString().slice(0, 10) : "");
                  }}
                  dateFormat="yyyy-MM-dd"
                  customInput={<DatePickerInput field="contract_end" />}
                  placeholderText="To"
                />
              </Grid>

              {/* 주소 */}
              <Grid item xs={12} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <MDTypography sx={{ minWidth: "75px", fontSize: "13px", textAlign: "right", fontWeight: "bold" }}>주소</MDTypography>
                <MDInput
                  sx={{ flex: 1, fontSize: "13px", "& input": { padding: "4px 4px", color: getColor("account_address", formData.account_address) } }}
                  value={formData.account_address || ""}
                  onChange={(e) => handleChange("account_address", e.target.value)}
                />
                <MDInput
                  sx={{ flex: 1, fontSize: "13px", "& input": { padding: "4px 4px", color: getColor("account_address", formData.account_address) } }}
                  value={formData.account_address_detail || ""}
                  onChange={(e) => handleChange("account_address_detail", e.target.value)}
                />
              </Grid>

              {/* 담당자1 */}
              <Grid item xs={12} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <MDTypography
                  sx={{
                    minWidth: "65px",
                    fontSize: "13px",
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  1.담당자명
                </MDTypography>
                <MDInput
                  sx={{
                    flex: 0.8,
                    fontSize: "13px",
                    "& input": {
                      padding: "4px 4px",
                      color: getColor("manager_name", formData.manager_name),
                    },
                  }}
                  value={formData.manager_name || ""}
                  onChange={(e) => handleChange("manager_name", e.target.value)}
                />
                <MDTypography
                  sx={{
                    fontSize: "13px",
                    textAlign: "right",
                    fontWeight: "bold",
                    minWidth: "50px",
                  }}
                >
                  연락처
                </MDTypography>
                <MDInput
                  sx={{
                    flex: 0.8,
                    fontSize: "13px",
                    "& input": {
                      padding: "4px 4px",
                      color: getColor("manager_tel", formData.manager_tel),
                    },
                  }}
                  value={formData.manager_tel || ""}
                  onChange={(e) => handleChange("manager_tel", e.target.value)}
                />

                {/* ✅ account_type 선택 */}
                <MDTypography
                  sx={{
                    minWidth: "70px",
                    fontSize: "13px",
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
                  onChange={(e) => handleChange("account_type", e.target.value)}
                  sx={{ width: 130, "& select": { fontSize: "13px", padding: "6px" } }}
                >
                  <MenuItem value={1}>위탁급식</MenuItem>
                  <MenuItem value={2}>도소매</MenuItem>
                  <MenuItem value={3}>프랜차이즈</MenuItem>
                  <MenuItem value={4}>산업체</MenuItem>
                </TextField>
              </Grid>

              {/* 담당자2 */}
              <Grid item xs={12} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <MDTypography
                  sx={{
                    minWidth: "65px",
                    fontSize: "13px",
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  2.담당자명
                </MDTypography>
                <MDInput
                  sx={{
                    flex: 0.8,
                    fontSize: "13px",
                    "& input": {
                      padding: "4px 4px",
                      color: getColor("manager_name2", formData.manager_name2),
                    },
                  }}
                  value={formData.manager_name2 || ""}
                  onChange={(e) => handleChange("manager_name2", e.target.value)}
                />
                <MDTypography
                  sx={{
                    fontSize: "13px",
                    textAlign: "right",
                    fontWeight: "bold",
                    minWidth: "50px",
                  }}
                >
                  연락처
                </MDTypography>
                <MDInput
                  sx={{
                    flex: 0.8,
                    fontSize: "13px",
                    "& input": {
                      padding: "4px 4px",
                      color: getColor("manager_tel2", formData.manager_tel2),
                    },
                  }}
                  value={formData.manager_tel2 || ""}
                  onChange={(e) => handleChange("manager_tel2", e.target.value)}
                />

                {/* ✅ meal_type 선택 */}
                <MDTypography
                  sx={{
                    minWidth: "70px",
                    fontSize: "13px",
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
                  onChange={(e) => handleChange("meal_type", e.target.value)}
                  sx={{ width: 130, "& select": { fontSize: "13px", padding: "6px" } }}
                >
                  <MenuItem value={1}>요양주간</MenuItem>
                  <MenuItem value={2}>요양직원</MenuItem>
                  <MenuItem value={3}>요양</MenuItem>
                  <MenuItem value={4}>주간보호</MenuItem>
                  <MenuItem value={5}>산업체</MenuItem>
                </TextField>
              </Grid>

              {/* 마감 담당자 */}
              <Grid item xs={12} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <MDTypography sx={{ minWidth: "75px", fontSize: "13px", textAlign: "right", fontWeight: "bold" }}>마감담당자명</MDTypography>
                <MDInput
                  sx={{ flex: 1, fontSize: "13px", "& input": { padding: "4px 4px", color: getColor("closing_name", formData.closing_name) } }}
                  value={formData.closing_name || ""}
                  onChange={(e) => handleChange("closing_name", e.target.value)}
                />
                <MDTypography sx={{ fontSize: "13px", textAlign: "right", fontWeight: "bold" }}>연락처</MDTypography>
                <MDInput
                  sx={{ flex: 1, fontSize: "13px", "& input": { padding: "4px 4px", color: getColor("closing_tel", formData.closing_tel) } }}
                  value={formData.closing_tel || ""}
                  onChange={(e) => handleChange("closing_tel", e.target.value)}
                />
              </Grid>

              {/* 시설기기 */}
              <Grid item xs={12} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <MDTypography sx={{ minWidth: "75px", fontSize: "13px", textAlign: "right", fontWeight: "bold" }}>
                  시설기기<br />투자여부
                </MDTypography>
                <MDInput
                  multiline
                  rows={3}
                  sx={{ width: "80%", "& textarea": { color: getColor("property_note", formData.property_note) } }}
                  value={formData.property_note || ""}
                  onChange={(e) => handleChange("property_note", e.target.value)}
                />
                <MDTypography sx={{ minWidth: "75px", fontSize: "13px", textAlign: "center", fontWeight: "bold" }}>
                  시설기기<br />A/S기준
                </MDTypography>
                <MDInput
                  multiline
                  rows={3}
                  sx={{ width: "80%", "& textarea": { color: getColor("property_as_note", formData.property_as_note) } }}
                  value={formData.property_as_note || ""}
                  onChange={(e) => handleChange("property_as_note", e.target.value)}
                />
              </Grid>
            </Grid>
          </Grid>

          {/* 오른쪽 */}
          <Grid item xs={12} md={6}>
            {priceData.some(p => p.account_type === 4) ? (
              <Grid container spacing={2}>
                {/* 기존 business_note 영역 반으로 줄이기 */}
                <Grid item xs={12} md={6}>
                  <MDTypography sx={{ fontSize: "13px", textAlign: "center", fontWeight: "bold", mb: 0 }}>
                    영업내용 및 특이사항
                  </MDTypography>
                  <MDInput
                    multiline
                    rows={13}
                    sx={{ width: "100%", textAlign: "center", "& textarea": { color: getColor("business_note", formData.business_note) } }}
                    value={formData.business_note || ""}
                    onChange={(e) => handleChange("business_note", e.target.value)}
                  />
                </Grid>

                {/* 새로 추가할 input */}
                <Grid item xs={12} md={6}>
                  <MDTypography sx={{ fontSize: "13px", textAlign: "center", fontWeight: "bold", mb: 0 }}>
                    산업체 특이사항
                  </MDTypography>
                  <MDInput
                    multiline
                    rows={13}
                    sx={{ width: "100%", textAlign: "center" }}
                    value={formData.industry_note || ""} // formData에 새로운 필드 필요
                    onChange={(e) => handleChange("industry_note", e.target.value)}
                  />
                </Grid>
              </Grid>
            ) : (
              // account_type이 4가 아닌 경우 기존 그대로
              <>
                <MDTypography sx={{ fontSize: "13px", textAlign: "center", fontWeight: "bold", mb: 0 }}>
                  영업내용 및 특이사항
                </MDTypography>
                <MDInput
                  multiline
                  rows={13}
                  sx={{ width: "100%", textAlign: "center", "& textarea": { color: getColor("business_note", formData.business_note) } }}
                  value={formData.business_note || ""}
                  onChange={(e) => handleChange("business_note", e.target.value)}
                />
              </>
            )}
          </Grid>
        </Grid>
      </Card>

      {/* 하단 테이블 */}
      {/* 하단 테이블 */}
      <Card sx={{ p: 1, mb: 1 }}>{renderTable(priceData, setPriceData, "price", priceTableColumns)}</Card>
      <Card sx={{ p: 1, mb: 1 }}>{renderTable(etcData, setEtcData, "etc", etcTableColumns)}</Card>
      <Card sx={{ p: 1, mb: 1 }}>{renderTable(managerData, setManagerData, "manager", managerTableColumns)}</Card>
      <Card sx={{ p: 1, mb: 1 }}>{renderTable(eventData, setEventData, "event", eventTableColumns)}</Card>
    </DashboardLayout>
  );
}

export default AccountInfoSheet;
