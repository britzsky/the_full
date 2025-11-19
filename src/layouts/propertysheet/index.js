import React, { useMemo, useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { useLocation  } from "react-router-dom";
import api from "api/api";
import { API_BASE_URL } from "config";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import usePropertiessheetData, { parseNumber, formatNumber } from "./data/propertiessheetData";

function PropertiesSheet() {
  const { activeRows, setActiveRows, saveData } = usePropertiessheetData();
  const [originalRows, setOriginalRows] = useState([]);
  const UPLOAD_URL = `${API_BASE_URL}/image/hangyeol/properties`;

  const numericCols = ["purchase_price"];

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const account_name = queryParams.get("name");

  // 초기 데이터 및 합계 적용
  useEffect(() => {
    if (activeRows && activeRows.length > 0) {
      const updated = activeRows.map((row) => ({ ...row }));
      setActiveRows(updated);
      setOriginalRows(updated);
    }
  }, [activeRows?.length]);

  // 이미지 업로드 핸들러
  const handleImageUpload = async (file, rowIndex, colKey) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/image/hangyeol/properties", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // 서버에서 파일명만 리턴한다고 가정
      const fileName = res.data.fileName || file.name;
      const filePath = `/image/hangyeol/properties/${fileName}`;

      const updatedRows = activeRows.map((r, idx) =>
        idx === rowIndex ? { ...r, [colKey]: filePath } : r
      );

      setActiveRows(updatedRows);
    } catch (err) {
      console.error("이미지 업로드 실패:", err);
      alert("이미지 업로드 실패");
    }
  };

  const columns = useMemo(
    () => [
      {
        id: "rowNumber",
        header: "구분",
        size: "3%",
        cell: (info) => info.row.index + 1,
      },
      { header: "구매일자", accessorKey: "purchase_dt", size: "5%" },
      { header: "구매처", accessorKey: "purchase_name", size: "5%" },
      { header: "품목", accessorKey: "item", size: "15%" },
      { header: "규격", accessorKey: "spec", size: "10%" },
      { header: "수량", accessorKey: "qty", size: "5%" },
      {
        header: "신규/중고",
        accessorKey: "type",
        size: "5%",
        cell: (info) => {
          const value = info.getValue();
          return value === "1" ? "신규" : value === "2" ? "중고" : "";
        },
      },
      { header: "구매가격", accessorKey: "purchase_price", size: "5%" },
      { header: "제품사진", accessorKey: "item_img", size: "8%" },
      { header: "영수증사진", accessorKey: "receipt_img", size: "8%" },
      { header: "비고", accessorKey: "note", size: 120 },
    ],
    []
  );

  const renderTable = (rows, originals) => {
    const table = useReactTable({
      data: rows,
      columns,
      getCoreRowModel: getCoreRowModel(),
    });

    return (
      <MDBox
        pt={0}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          "& table": {
            width: "max-content",
            minWidth: "100%",
            borderSpacing: 0,
            borderCollapse: "separate",
          },
          "& th, & td": {
            border: "1px solid #686D76",
            textAlign: "center",
            padding: "4px",
            whiteSpace: "nowrap",
            fontSize: "12px",
          },
          "& th": {
            backgroundColor: "#f0f0f0",
            position: "sticky",
            top: 0,
            zIndex: 2,
          },
          "& td:first-of-type, & th:first-of-type": {
            position: "sticky",
            left: 0,
            background: "#f0f0f0",
            zIndex: 3,
          },
          "thead th:first-of-type": { zIndex: 5 },
          "& .edited-cell": {
            color: "#d32f2f",
            fontWeight: 500,
          },
          "td[contenteditable]": {
            minWidth: "80px",
            cursor: "text",
          },
        }}
      >
        <table className="dinersheet-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ width: header.column.columnDef.size }}>
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
                  const isEditable =
                    colKey &&
                    !["rowNumber", "item_img", "receipt_img"].includes(colKey);

                  const currentValue = colKey
                    ? row.getValue(colKey)
                    : cell.column.columnDef.cell?.(cell.getContext());
                  const originalValue = originals?.[rowIndex]?.[colKey];

                  const isNumeric = numericCols.includes(colKey);
                  const normCurrent = isNumeric ? Number(currentValue ?? 0) : String(currentValue ?? "");
                  const normOriginal = isNumeric ? Number(originalValue ?? 0) : String(originalValue ?? "");
                  const isChanged = normCurrent !== normOriginal;

                  // 신규/중고 select 처리
                  if (colKey === "type") {
                    return (
                      <td key={cell.id}>
                        <select
                          value={currentValue || ""}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            const updatedRows = rows.map((r, idx) =>
                              idx === rowIndex ? { ...r, [colKey]: newValue } : r
                            );
                            setActiveRows(updatedRows);
                          }}
                        >
                          <option value="">선택</option>
                          <option value="1">신규</option>
                          <option value="2">중고</option>
                        </select>
                      </td>
                    );
                  }

                  // 이미지 처리
                  if (colKey === "item_img" || colKey === "receipt_img") {
                    const imgSrc = currentValue ? `${API_BASE_URL}${currentValue}` : null;
                    return (
                      <td key={cell.id} style={{ textAlign: "center" }}>
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt="첨부이미지"
                            style={{ width: "80px", height: "80px", objectFit: "cover" }}
                          />
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              id={`${colKey}-${rowIndex}`}
                              onChange={(e) =>
                                handleImageUpload(e.target.files[0], rowIndex, colKey)
                              }
                            />
                            <label htmlFor={`${colKey}-${rowIndex}`}>
                              <MDButton component="span" size="small" color="info">
                                이미지 첨부
                              </MDButton>
                            </label>
                          </>
                        )}
                      </td>
                    );
                  }

                  return (
                    <td
                      style={{ whiteSpace: "pre-line" }}
                      key={cell.id}
                      contentEditable={isEditable}
                      suppressContentEditableWarning
                      className={isEditable && isChanged ? "edited-cell" : ""}
                      onBlur={(e) => {
                        if (!isEditable) return;

                        let newValue = e.target.innerText.trim();
                        if (isNumeric) newValue = parseNumber(newValue);

                        const updatedRows = rows.map((r, idx) =>
                          idx === rowIndex ? { ...r, [colKey]: newValue } : r
                        );

                        setActiveRows(updatedRows);

                        if (isNumeric) {
                          e.currentTarget.innerText = formatNumber(newValue);
                        }
                      }}
                    >
                      {numericCols.includes(colKey)
                        ? formatNumber(currentValue)
                        : currentValue}
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

  const handleSave = () => {
    saveData(activeRows);
    setOriginalRows([...activeRows]);
  };

  return (
    <DashboardLayout>
      <MDBox pt={1} pb={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      <MDBox pt={4} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card
              sx={{
                height: "calc(100vh - 160px)",
                display: "flex",
                flexDirection: "column",
              }}
            >
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
                  기물리스트 (업장명 : {account_name})
                </MDTypography>
              </MDBox>

              {renderTable(activeRows, originalRows)}
            </Card>
          </Grid>
        </Grid>
      </MDBox>
    </DashboardLayout>
  );
}

export default PropertiesSheet;
