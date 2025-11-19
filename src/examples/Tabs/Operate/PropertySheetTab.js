// src/layouts/property/PropertySheetTab.js
import React, { useMemo, useState, useEffect } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { TextField } from "@mui/material";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import usePropertiessheetData, { parseNumber, formatNumber } from "./propertiessheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import dayjs from "dayjs"; // 🟧 감가상각 계산용
import { API_BASE_URL } from "config";

function PropertySheetTab() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const { activeRows, setActiveRows, accountList, loading, fetcPropertyList } =
    usePropertiessheetData();
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [viewImageSrc, setViewImageSrc] = useState(null);

  const numericCols = ["purchase_price"];

  useEffect(() => {
    if (selectedAccountId) {
      fetcPropertyList(selectedAccountId);
    } else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    const deepCopy = activeRows.map((r) => ({ ...r }));

    // ✅ 감가상각 자동 계산 추가
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

  const getCellStyle = (rowIndex, key, value) => {
    const original = originalRows[rowIndex]?.[key];
    if (numericCols.includes(key)) {
      return Number(original ?? 0) !== Number(value ?? 0)
        ? { color: "red" }
        : { color: "black" };
    }
    if (typeof original === "string" && typeof value === "string") {
      return normalize(original) !== normalize(value)
        ? { color: "red" }
        : { color: "black" };
    }
    return original !== value ? { color: "red" } : { color: "black" };
  };

  const handleAddRow = () => {
    const newRow = {
      account_id: selectedAccountId,
      purchase_dt: "",
      purchase_name: "",
      item: "",
      spec: "",
      qty: "",
      type: "0",
      purchase_price: "0",
      item_img: "",
      receipt_img: "",
      note: "",
      depreciation: "", // 🟧 추가
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

  // 🟧 감가상각 자동 계산 useEffect
  useEffect(() => {
    const updated = rows.map((row) => {
      const { purchase_dt, purchase_price } = row;
      if (!purchase_dt || !purchase_price) return { ...row, depreciation: "" };

      const price = parseNumber(purchase_price);
      const purchaseDate = dayjs(purchase_dt);
      const now = dayjs();

      if (!purchaseDate.isValid()) return { ...row, depreciation: "" };

      // 구매월부터 현재까지의 경과월 계산 (구매월도 포함)
      let monthsPassed = now.diff(purchaseDate, "month") + 1;
      if (monthsPassed < 1) monthsPassed = 1;
      if (monthsPassed > 60) monthsPassed = 60;

      const depreciationValue = ((monthsPassed / 60) * price).toFixed(0);

      return {
        ...row,
        depreciation: formatNumber(depreciationValue),
      };
    });

    setRows(updated);
  }, [rows.map((r) => `${r.purchase_dt}-${r.purchase_price}`).join(",")]); // purchase_dt, purchase_price 변할 때 재계산

  const handleSave = async () => {
    try {
      const modifiedRows = await Promise.all(
        rows.map(async (row, idx) => {
          const original = originalRows[idx] || {};
          let updatedRow = { ...row };

          const isChanged =
            row.isNew ||
            Object.keys(updatedRow).some((key) => {
              //if (key === "depreciation") return false; // 🟧 감가상각은 저장 제외
              const origVal = original[key];
              const curVal = updatedRow[key];
              if (numericCols.includes(key))
                return Number(origVal ?? 0) !== Number(curVal ?? 0);
              if (typeof origVal === "string" && typeof curVal === "string")
                return normalize(origVal) !== normalize(curVal);
              return origVal !== curVal;
            });

          if (!isChanged) return null;

          numericCols.forEach((col) => {
            if (updatedRow[col])
              updatedRow[col] = updatedRow[col].toString().replace(/,/g, "");
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
      { header: "구매처", accessorKey: "purchase_name", size: 100 },
      { header: "품목", accessorKey: "item", size: 150 },
      { header: "규격", accessorKey: "spec", size: 100 },
      { header: "수량", accessorKey: "qty", size: 80 },
      { header: "신규/중고", accessorKey: "type", size: 80 },
      { header: "구매가격", accessorKey: "purchase_price", size: 80 },
      { header: "예상감가(60개월 기준)", accessorKey: "depreciation", size: 80 }, // 🟧 읽기 전용
      { header: "제품사진", accessorKey: "item_img", size: 150 },
      { header: "영수증사진", accessorKey: "receipt_img", size: 150 },
      { header: "비고", accessorKey: "note", size: 100 },
    ],
    []
  );

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
      verticalAlign: "middle",
    },
    "& th": {
      backgroundColor: "#f0f0f0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    "& input[type='date'], & input[type='text']": {
      fontSize: "12px",
      padding: "4px",
      minWidth: "80px",
      border: "none",
      background: "transparent",
    },
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <MDBox pt={1} pb={1} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
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
        <MDButton color="info" onClick={handleAddRow}>
          행 추가
        </MDButton>
        <MDButton color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      <MDBox pt={4} pb={3} sx={tableSx}>
        <MDBox
          mx={0}
          mt={-3}
          py={1}
          px={2}
          variant="gradient"
          bgColor="info"
          borderRadius="lg"
          coloredShadow="info"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <MDTypography variant="h6" color="white">
            기물리스트 관리
          </MDTypography>
        </MDBox>
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

                  if (key === "purchase_dt")
                    return (
                      <td key={key} style={{ width: col.size }}>
                        <input
                          type="date"
                          value={value}
                          onChange={(e) =>
                            handleCellChange(rowIndex, key, e.target.value)
                          }
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
                          value={value}
                          onChange={(e) =>
                            handleCellChange(rowIndex, key, e.target.value)
                          }
                          style={{
                            ...style,
                            width: "100%",
                            border: "none",
                            background: "transparent",
                            fontSize: "12px",
                          }}
                        >
                          <option value="0">신규</option>
                          <option value="1">중고</option>
                        </select>
                      </td>
                    );

                  if (["item_img", "receipt_img"].includes(key))
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
                          onChange={(e) =>
                            handleCellChange(rowIndex, key, e.target.files[0])
                          }
                        />
                        {value && (
                          <img
                            src={
                              typeof value === "object"
                                ? URL.createObjectURL(value)
                                : `${API_BASE_URL}${value}`
                            }
                            alt="preview"
                            style={{
                              maxWidth: "150px",
                              maxHeight: "150px",
                              cursor: "pointer",
                              display: "block",
                              margin: "6px auto",
                            }}
                            onClick={() => handleViewImage(value)}
                          />
                        )}
                        <label htmlFor={`upload-${key}-${rowIndex}`}>
                          <MDButton component="span" size="small" color="info">
                            이미지 업로드
                          </MDButton>
                        </label>
                      </td>
                    );

                  if (key === "depreciation") {
                    // 🟧 감가상각은 읽기 전용
                    return (
                      <td
                        key={key}
                        style={{
                          ...style,
                          width: "8%",
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
                        let newValue = e.target.innerText.trim();
                        if (isNumeric) newValue = parseNumber(newValue);
                        handleCellChange(rowIndex, key, newValue);
                        if (isNumeric)
                          e.currentTarget.innerText = formatNumber(newValue);
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

      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={handleCloseViewer}
        >
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={5}>
            <TransformComponent>
              <img
                src={viewImageSrc}
                alt="미리보기"
                style={{ maxWidth: "80%", maxHeight: "80%" }}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
    </>
  );
}

export default PropertySheetTab;
