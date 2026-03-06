/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useCallback } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery } from "@mui/material";
import Swal from "sweetalert2";
import useAccountEmergencyMemberSheetData, {
  parseNumber,
  formatNumber,
} from "./accountEmergencyMemberSheetData";
import LoadingScreen from "layouts/loading/loadingscreen";

function AccountEmergencyMemberSheet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,
    loading,
    fetchAccountMembersAllList,
    saveData,
  } = useAccountEmergencyMemberSheetData();

  const [searchName, setSearchName] = useState("");

  useEffect(() => {
    fetchAccountMembersAllList({ name: "" });
  }, [fetchAccountMembersAllList]);

  const positionOptions = useMemo(
    () => [
      { value: "4", label: "조리사" },
      { value: "5", label: "조리원" },
    ],
    []
  );

  const carYnOptions = useMemo(
    () => [
      { value: "N", label: "N" },
      { value: "Y", label: "Y" },
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      { value: "1", label: "가능" },
      { value: "2", label: "블랙리스트" },
    ],
    []
  );

  const manpowerTypeOptions = useMemo(
    () => [
      { value: "1", label: "내부대체" },
      { value: "2", label: "외부대체" },
      { value: "3", label: "퇴사자" },
      { value: "4", label: "파출" },
    ],
    []
  );

  const originalMap = useMemo(() => {
    const map = new Map();
    (originalRows || []).forEach((row) => {
      map.set(String(row._rid), row);
    });
    return map;
  }, [originalRows]);

  const isRowChanged = useCallback(
    (row) => {
      if (!row) return false;
      if (row._isNew) return true;

      const original = originalMap.get(String(row._rid));
      if (!original) return true;

      return (
        String(row.name ?? "") !== String(original.name ?? "") ||
        String(row.position_type ?? "") !== String(original.position_type ?? "") ||
        Number(row.salary ?? 0) !== Number(original.salary ?? 0) ||
        String(row.car_yn ?? "") !== String(original.car_yn ?? "") ||
        String(row.note ?? "") !== String(original.note ?? "") ||
        String(row.status ?? "") !== String(original.status ?? "") ||
        String(row.manpower_type ?? "") !== String(original.manpower_type ?? "")
      );
    },
    [originalMap]
  );

  const isCellChanged = useCallback(
    (row, key) => {
      if (!row) return false;
      if (row._isNew) return true;

      const original = originalMap.get(String(row._rid));
      if (!original) return true;

      if (key === "salary") {
        return Number(row[key] ?? 0) !== Number(original[key] ?? 0);
      }
      return String(row[key] ?? "") !== String(original[key] ?? "");
    },
    [originalMap]
  );

  const updateRow = useCallback(
    (rid, key, value) => {
      setActiveRows((prev) =>
        (prev || []).map((row) => {
          if (String(row._rid) !== String(rid)) return row;

          if (key === "salary") {
            return { ...row, salary: parseNumber(value) };
          }

          if (key === "car_yn") {
            return { ...row, car_yn: String(value ?? "").toUpperCase() === "Y" ? "Y" : "N" };
          }

          return { ...row, [key]: value };
        })
      );
    },
    [setActiveRows]
  );

  const handleSearch = useCallback(() => {
    fetchAccountMembersAllList({ name: searchName });
  }, [fetchAccountMembersAllList, searchName]);

  const handleAddRow = useCallback(() => {
    const newRow = {
      _rid: `NEW_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      _isNew: true,
      idx: null,
      name: "",
      position_type: "4",
      salary: 0,
      car_yn: "N",
      note: "",
      status: "1",
      manpower_type: "1",
    };

    setActiveRows((prev) => [newRow, ...(prev || [])]);
  }, [setActiveRows]);

  const handleSave = useCallback(async () => {
    const changedRows = (activeRows || []).filter((row) => isRowChanged(row));

    if (changedRows.length === 0) {
      Swal.fire("안내", "저장할 변경사항이 없습니다.", "info");
      return;
    }

    const hasInvalidName = changedRows.some((row) => !String(row.name ?? "").trim());
    if (hasInvalidName) {
      Swal.fire("안내", "이름은 비워둘 수 없습니다.", "warning");
      return;
    }

    try {
      const res = await saveData(changedRows);
      const ok = res?.data?.code === 200 || res?.status === 200;

      if (!ok) {
        Swal.fire("실패", res?.data?.message || "저장 실패", "error");
        return;
      }

      await Swal.fire("저장 완료", "변경된 행만 저장되었습니다.", "success");

      const refreshed = await fetchAccountMembersAllList({ name: searchName });
      setOriginalRows((refreshed || []).map((row) => ({ ...row, _isNew: false })));
    } catch (err) {
      Swal.fire("실패", err?.message || "저장 중 오류", "error");
    }
  }, [activeRows, fetchAccountMembersAllList, isRowChanged, saveData, searchName, setOriginalRows]);

  const getTextColor = useCallback(
    (row, key) => {
      if (isCellChanged(row, key)) return "#d32f2f";
      return "#344767";
    },
    [isCellChanged]
  );

  const getStatusBackgroundColor = useCallback((status) => {
    if (String(status ?? "") === "1") return "#AACDDC";
    if (String(status ?? "") === "2") return "#FFB2B2";
    return "transparent";
  }, []);

  const tableSx = {
    flex: 1,
    minHeight: 0,
    maxHeight: isMobile ? "58vh" : "74vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",

    "& table": {
      borderCollapse: "separate",
      width: "100%",
      minWidth: 900,
      borderSpacing: 0,
      tableLayout: "fixed",
    },

    "& th, & td": {
      border: "1px solid #686D76",
      padding: isMobile ? "4px" : "6px",
      fontSize: isMobile ? "11px" : "12px",
      verticalAlign: "middle",
      textAlign: "center",
      whiteSpace: "nowrap",
      backgroundColor: "#fff",
    },

    "& th": {
      position: "sticky",
      top: 0,
      zIndex: 2,
      backgroundColor: "#f0f2f5",
      fontWeight: 700,
    },

    "& input, & select": {
      width: "100%",
      border: "none",
      outline: "none",
      fontSize: isMobile ? "11px" : "12px",
      textAlign: "center",
    },
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          gap: 1,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <TextField
          size="small"
          label="이름"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          sx={{ minWidth: isMobile ? 160 : 220 }}
        />

        <MDButton variant="gradient" color="info" onClick={handleSearch}>
          검색
        </MDButton>

        <MDButton variant="gradient" color="success" onClick={handleAddRow}>
          행추가
        </MDButton>

        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      <MDBox pt={1} pb={3}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <MDBox sx={tableSx}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>순번</th>
                    <th style={{ width: 140 }}>이름</th>
                    <th style={{ width: 120 }}>직책</th>
                    <th style={{ width: 120 }}>급여</th>
                    <th style={{ width: 90 }}>차량여부</th>
                    <th style={{ width: 140 }}>상태</th>
                    <th style={{ width: 140 }}>인력구분</th>
                    <th style={{ minWidth: 220 }}>비고</th>
                  </tr>
                </thead>

                <tbody>
                  {(activeRows || []).map((row) => (
                    <tr key={row._rid}>
                      <td
                        style={{
                          color: row._isNew ? "#d32f2f" : "#344767",
                          fontWeight: row._isNew ? 600 : 400,
                        }}
                      >
                        {row.idx ?? ""}
                      </td>

                      <td>
                        <input
                          value={row.name ?? ""}
                          onChange={(e) => updateRow(row._rid, "name", e.target.value)}
                          style={{
                            color: getTextColor(row, "name"),
                            fontWeight: isCellChanged(row, "name") ? 600 : 400,
                            textAlign: "left",
                            backgroundColor: "transparent",
                          }}
                        />
                      </td>

                      <td>
                        <select
                          value={row.position_type ?? "4"}
                          onChange={(e) => updateRow(row._rid, "position_type", e.target.value)}
                          style={{
                            color: getTextColor(row, "position_type"),
                            fontWeight: isCellChanged(row, "position_type") ? 600 : 400,
                            backgroundColor: "transparent",
                          }}
                        >
                          {positionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          value={formatNumber(row.salary)}
                          onChange={(e) => updateRow(row._rid, "salary", e.target.value)}
                          style={{
                            color: getTextColor(row, "salary"),
                            fontWeight: isCellChanged(row, "salary") ? 600 : 400,
                            textAlign: "right",
                            backgroundColor: "transparent",
                          }}
                          inputMode="numeric"
                        />
                      </td>

                      <td>
                        <select
                          value={row.car_yn ?? "N"}
                          onChange={(e) => updateRow(row._rid, "car_yn", e.target.value)}
                          style={{
                            color: getTextColor(row, "car_yn"),
                            fontWeight: isCellChanged(row, "car_yn") ? 600 : 400,
                            backgroundColor: "transparent",
                          }}
                        >
                          {carYnOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          value={row.status ?? "1"}
                          onChange={(e) => updateRow(row._rid, "status", e.target.value)}
                          style={{
                            color: isCellChanged(row, "status") ? "#d32f2f" : "#ffffff",
                            fontWeight: isCellChanged(row, "status") ? 600 : 600,
                            backgroundColor: getStatusBackgroundColor(row.status),
                            borderRadius: 4,
                          }}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          value={row.manpower_type ?? "1"}
                          onChange={(e) => updateRow(row._rid, "manpower_type", e.target.value)}
                          style={{
                            color: getTextColor(row, "manpower_type"),
                            fontWeight: isCellChanged(row, "manpower_type") ? 600 : 400,
                            backgroundColor: "transparent",
                          }}
                        >
                          {manpowerTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          value={row.note ?? ""}
                          onChange={(e) => updateRow(row._rid, "note", e.target.value)}
                          style={{
                            color: getTextColor(row, "note"),
                            fontWeight: isCellChanged(row, "note") ? 600 : 400,
                            textAlign: "left",
                            backgroundColor: "transparent",
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MDBox>
          </Grid>
        </Grid>
      </MDBox>
    </>
  );
}

export default AccountEmergencyMemberSheet;
