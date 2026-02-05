// src/layouts/property/PropertySheetTab.js
import React, { useMemo, useState, useEffect, useCallback } from "react";
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
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import usePropertiessheetData, { parseNumber, formatNumber } from "./propertiessheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import { API_BASE_URL } from "config";

function PropertySheetTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const { activeRows, accountList, loading, fetcPropertyList } = usePropertiessheetData();
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

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

  const selectAccountByInput = useCallback(() => {
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
  }, [accountInput, accountOptions]);

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
      ...r,
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

    setRows(updated);
    setOriginalRows(deepCopy);
  }, [activeRows]);

  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountList[0].account_id);
    }
  }, [accountList, selectedAccountId]);

  const onSearchList = (e) => setSelectedAccountId(e.target.value);

  const handleCellChange = (rowIndex, key, value) => {
    setRows((prevRows) =>
      prevRows.map((row, idx) => (idx === rowIndex ? { ...row, [key]: value } : row))
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
      note: "",
      depreciation: "",
      del_yn: "N",
      isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
    setOriginalRows((prev) => [...prev, { ...newRow }]);
  };

  const handleViewImage = (value) => {
    if (!value) return;
    if (typeof value === "object") {
      setViewImageSrc(URL.createObjectURL(value));
    } else {
      setViewImageSrc(`${API_BASE_URL}${value}`);
    }
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

  // ✅ 행 삭제 (rows / originalRows 둘 다 동일 인덱스 제거)
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
      // ✅ 서버로 보낼 삭제 payload 만들기
      const deleteRow = { ...row };

      // del_yn = Y
      deleteRow.del_yn = "Y";

      // account_id 보정
      deleteRow.account_id = selectedAccountId || row.account_id;

      // 감가상각은 저장 제외
      delete deleteRow.depreciation;

      // 숫자 컬럼 콤마 제거
      numericCols.forEach((col) => {
        if (deleteRow[col] != null) {
          deleteRow[col] = deleteRow[col].toString().replace(/,/g, "");
        }
      });

      // ✅ 이미지가 File 객체(로컬 업로드만 된 상태)면 삭제 저장에선 굳이 보낼 필요 없으니 제거
      ["item_img", "receipt_img"].forEach((f) => {
        if (deleteRow[f] && typeof deleteRow[f] === "object") {
          delete deleteRow[f];
        }
      });

      const response = await api.post(`/Operate/PropertiesSave`, [deleteRow], {
        headers: { "Content-Type": "application/json" },
      });

      if (response?.data?.code === 200) {
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

          const imageFields = ["item_img", "receipt_img"];
          for (const field of imageFields) {
            if (row[field] && typeof row[field] === "object") {
              const uploadedPath = await uploadImage(
                row[field],
                row.purchase_dt,
                selectedAccountId
              );
              updatedRow[field] = uploadedPath;
            }
          }

          // 🟧 감가상각은 서버 저장 제외
          delete updatedRow.depreciation;

          // ✅ type은 저장시에도 문자열->그대로(서버가 숫자 원하면 여기서 Number로 변환 가능)
          return { ...updatedRow, account_id: selectedAccountId || row.account_id };
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
      { header: "영수증사진", accessorKey: "receipt_img", size: 140 },
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
          position: "sticky",
          zIndex: 10,
          top: 78,
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
            onChange={(_, opt) => setSelectedAccountId(opt ? opt.value : "")}
            inputValue={accountInput}
            onInputChange={(_, newValue) => setAccountInput(newValue)}
            getOptionLabel={(opt) => opt?.label ?? ""}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            // ✅ 포함 검색(원하는 검색 규칙이면 유지)
            filterOptions={(options, state) => {
              const q = (state.inputValue ?? "").trim().toLowerCase();
              if (!q) return options;
              return options.filter((o) => (o.label ?? "").toLowerCase().includes(q));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="거래처 검색"
                placeholder="거래처명을 입력"
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
          onClick={handleAddRow}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : 90 }}
        >
          행 추가
        </MDButton>

        <MDButton
          color="info"
          onClick={handleSave}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 70 : 90 }}
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
                onContextMenu={(e) => handleRowContextMenu(e, rowIndex)}
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

                  if (["item_img", "receipt_img"].includes(key)) {
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
                            if (file) handleCellChange(rowIndex, key, file);
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
                                sx={getFileIconSx(isImgChanged)} // ✅ 변경 시 빨간색
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
