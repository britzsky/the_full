/* eslint-disable react/function-component-definition */
import React, { useEffect, useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Checkbox,
  CircularProgress,
  IconButton,
  TextField,
  Autocomplete,
  MenuItem,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import useIngredientDetailData from "./ingredientDetailData";

// 🔹 기준단위/원본단위 공통 프리셋 — 목록에 없는 단위는 "기타"로 직접 입력
const UNIT_PRESETS = ["g", "mL", "EA", "팩"];
const OTHER_UNIT = "기타";

// 프리셋 선택 + "기타" 선택 시 자유 텍스트 입력으로 전환되는 단위 입력 셀
function UnitCell({ value, onChange }) {
  const isPreset = UNIT_PRESETS.includes(value);
  const [customMode, setCustomMode] = useState(!!value && !isPreset);

  // 식재료 선택 등으로 외부에서 프리셋 밖의 값이 채워지면 자동으로 직접입력 모드로 전환
  useEffect(() => {
    if (value && !UNIT_PRESETS.includes(value) && !customMode) {
      setCustomMode(true);
    }
  }, [value, customMode]);

  if (customMode) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%" }}>
        <TextField
          fullWidth
          size="small"
          placeholder="단위 직접 입력"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <IconButton
          size="small"
          onClick={() => {
            setCustomMode(false);
            onChange("");
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <TextField
      select
      fullWidth
      size="small"
      SelectProps={{
        displayEmpty: true,
        MenuProps: {
          PaperProps: {
            sx: {
              minWidth: 180,
              mt: 0.5,
              borderRadius: 2,
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.16)",
            },
          },
          MenuListProps: {
            sx: {
              py: 0.75,
              "& .MuiMenuItem-root": {
                minHeight: 36,
                mx: 0.75,
                px: 1.25,
                borderRadius: 1,
                fontSize: 13,
              },
            },
          },
        },
      }}
      sx={{
        minWidth: 100,
        "& .MuiOutlinedInput-root": {
          minHeight: 40,
          backgroundColor: "#fff",
        },
        "&& .MuiSelect-select": {
          display: "flex",
          alignItems: "center",
          minHeight: "unset !important",
          padding: "9px 32px 9px 12px !important",
        },
        "& .MuiSelect-icon": { display: "inline-block", right: 8 },
      }}
      value={isPreset ? value : ""}
      onChange={(e) => {
        if (e.target.value === OTHER_UNIT) {
          setCustomMode(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <MenuItem value="">
        <em>선택</em>
      </MenuItem>
      {UNIT_PRESETS.map((u) => (
        <MenuItem key={u} value={u}>
          {u}
        </MenuItem>
      ))}
      <MenuItem value={OTHER_UNIT}>기타(직접입력)</MenuItem>
    </TextField>
  );
}

UnitCell.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

UnitCell.defaultProps = {
  value: "",
};

// 🔹 메뉴 관리 / 레시피 관리 탭이 공유하는 "식재료 상세" 편집 컴포넌트
//    - menu_id를 받아 tb_recipe_detail 행을 조회/추가/수정/삭제한다.
//    - 식재료는 tb_ingredient_master 자동완성 검색, 없으면 그 자리에서 즉석 등록한다.
export default function IngredientDetailEditor({ menuId, onInitialLoadComplete }) {
  const {
    loading,
    fetchRecipeDetailList,
    saveRecipeDetailRows,
    deleteRecipeDetailRow,
    searchIngredients,
    quickCreateIngredient,
  } = useIngredientDetailData();

  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // ✅ 행별 식재료 자동완성 옵션/입력값
  const [optionsByRow, setOptionsByRow] = useState({});
  const searchTimerRef = useRef(null);

  const loadRows = useCallback(async () => {
    const list = await fetchRecipeDetailList(menuId);
    setRows(
      list.map((row) => ({
        ...row,
        _rowKey: row.recipe_detail_id ?? `new_${Math.random().toString(36).slice(2)}`,
      }))
    );
  }, [fetchRecipeDetailList, menuId]);

  useEffect(() => {
    let active = true;

    if (menuId) {
      setInitialLoading(true);
      Swal.fire({
        title: "식재료 조회 중",
        text: "잠시만 기다려주세요.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
      loadRows().finally(() => {
        if (active) {
          setInitialLoading(false);
          onInitialLoadComplete?.();
          Swal.close();
        }
      });
    } else {
      setRows([]);
      setInitialLoading(false);
    }

    return () => {
      active = false;
      Swal.close();
    };
  }, [menuId, loadRows, onInitialLoadComplete]);

  const makeEmptyRow = () => ({
    _rowKey: `new_${Math.random().toString(36).slice(2)}`,
    recipe_detail_id: null,
    ingredient_id: "",
    ingredient_name_std: "",
    ingredient_name_raw: "",
    qty_raw: "",
    qty_unit: "",
    qty_num: "",
    recipe_yield_servings: 1,
    qty_base: "",
    base_unit: "",
    qty_per_person: "",
    review_flag: 0,
  });

  const handleAddRow = () => setRows((prev) => [...prev, makeEmptyRow()]);

  const handleRemoveRow = async (rowKey) => {
    const target = rows.find((r) => r._rowKey === rowKey);
    if (!target) return;

    const confirm = await Swal.fire({
      title: "이 식재료를 삭제할까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;

    if (target.recipe_detail_id) {
      try {
        await deleteRecipeDetailRow(target.recipe_detail_id);
      } catch (err) {
        Swal.fire("삭제 실패", err.message, "error");
        return;
      }
    }
    setRows((prev) => prev.filter((r) => r._rowKey !== rowKey));
  };

  // ✅ 숫자/텍스트 공통 입력 변경 + qty_per_person 자동 계산
  const handleFieldChange = (rowKey, field, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row._rowKey !== rowKey) return row;
        const next = { ...row, [field]: value };
        if (field === "qty_base" || field === "recipe_yield_servings") {
          const base = Number(field === "qty_base" ? value : next.qty_base);
          const servings = Number(field === "recipe_yield_servings" ? value : next.recipe_yield_servings);
          next.qty_per_person = base > 0 && servings > 0 ? Number((base / servings).toFixed(3)) : "";
        }
        return next;
      })
    );
  };

  // ✅ 식재료 자동완성 검색 (300ms 디바운스)
  const handleIngredientInputChange = (rowKey, keyword) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      const list = await searchIngredients(keyword);
      setOptionsByRow((prev) => ({ ...prev, [rowKey]: list }));
    }, 300);
  };

  // ✅ 목록에서 선택
  const handleIngredientSelect = (rowKey, option) => {
    if (!option) {
      handleFieldChange(rowKey, "ingredient_id", "");
      return;
    }
    setRows((prev) =>
      prev.map((row) =>
        row._rowKey === rowKey
          ? {
              ...row,
              ingredient_id: option.ingredient_id,
              ingredient_name_std: option.ingredient_name_std,
              base_unit: row.base_unit || option.base_unit || "",
            }
          : row
      )
    );
  };

  const handleSave = async () => {
    const missingName = rows.find((r) => !r.ingredient_id && !r.ingredient_name_std?.trim());
    if (missingName) {
      Swal.fire("식재료 미입력", "식재료명을 입력하거나 목록에서 선택해주세요.", "warning");
      return;
    }

    const missingBaseUnit = rows.find((r) => !r.ingredient_id && !r.base_unit?.trim());
    if (missingBaseUnit) {
      Swal.fire(
        "기준단위 미선택",
        `"${missingBaseUnit.ingredient_name_std}"의 기준단위를 드롭다운에서 선택해주세요.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      // 목록에 없는 식재료는 행에서 선택한 기준단위로 저장 시 함께 등록한다.
      const resolvedRows = await Promise.all(
        rows.map(async (row) => {
          if (row.ingredient_id) return row;
          const created = await quickCreateIngredient({
            ingredient_name_std: row.ingredient_name_std.trim(),
            base_unit: row.base_unit.trim(),
          });
          return {
            ...row,
            ingredient_id: created.ingredient_id,
            base_unit: created.base_unit || row.base_unit,
          };
        })
      );
      setRows(resolvedRows);

      const payloadRows = resolvedRows.map((r) => ({
        recipe_detail_id: r.recipe_detail_id,
        ingredient_id: r.ingredient_id,
        ingredient_name_raw: r.ingredient_name_raw || r.ingredient_name_std,
        qty_raw: r.qty_raw,
        qty_num: r.qty_num === "" ? null : Number(r.qty_num),
        qty_unit: r.qty_unit,
        recipe_yield_servings: Number(r.recipe_yield_servings) || 1,
        qty_base: Number(r.qty_base) || 0,
        base_unit: r.base_unit,
        qty_per_person: Number(r.qty_per_person) || 0,
        review_flag: r.review_flag ? 1 : 0,
      }));
      await saveRecipeDetailRows(menuId, payloadRows);
      await loadRows();
      Swal.fire("저장되었습니다.", "", "success");
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!menuId) {
    return (
      <MDBox sx={{ p: 2, color: "#999", fontSize: 13 }}>메뉴를 먼저 등록하거나 선택해주세요.</MDBox>
    );
  }

  // 최초 조회 중에는 인라인 요소를 만들지 않아 표 레이아웃이 바뀌지 않도록 한다.
  if (initialLoading) return null;

  return (
    <MDBox sx={{ mt: 1 }}>
      <MDBox sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <MDBox component="span" sx={{ fontWeight: "bold", fontSize: 13 }}>
          🧂 식재료 상세
        </MDBox>
        <Box sx={{ display: "flex", gap: 1 }}>
          <MDButton size="small" variant="outlined" color="info" startIcon={<AddIcon />} onClick={handleAddRow}>
            식재료 추가
          </MDButton>
          <MDButton size="small" variant="contained" color="info" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </MDButton>
        </Box>
      </MDBox>

      <Box
        sx={{
          position: "relative",
          overflowX: "auto",
          "& table": {
            borderCollapse: "collapse",
            tableLayout: "fixed",
            width: "100%",
            minWidth: 900,
          },
          "& th, & td": {
            border: "1px solid #ddd",
            fontSize: "12px",
            padding: "4px 6px",
            textAlign: "center",
          },
          "& th": { backgroundColor: "#f5f5f5" },
        }}
      >
        <table>
          <thead>
            <tr>
              <th style={{ width: 200 }}>식재료명</th>
              <th style={{ width: 90 }}>원본수량</th>
              <th style={{ width: 110 }}>원본단위</th>
              <th style={{ width: 90 }}>인분수</th>
              <th style={{ width: 100 }}>전체필요량</th>
              <th style={{ width: 110 }}>기준단위</th>
              <th style={{ width: 100 }}>1인 필요량</th>
              <th style={{ width: 60 }}>검토필요</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: "#999" }}>
                  등록된 식재료가 없습니다. &quot;식재료 추가&quot; 버튼으로 등록해주세요.
                </td>
              </tr>
            )}
            {rows.length > 0 &&
              rows.map((row) => (
                <tr key={row._rowKey}>
                  <td style={{ textAlign: "left" }}>
                    <Autocomplete
                      size="small"
                      freeSolo
                      options={optionsByRow[row._rowKey] || []}
                      getOptionLabel={(opt) =>
                        typeof opt === "string" ? opt : opt.ingredient_name_std || ""
                      }
                      value={row.ingredient_name_std || ""}
                      onInputChange={(_, value) => {
                        handleFieldChange(row._rowKey, "ingredient_name_std", value);
                        handleFieldChange(row._rowKey, "ingredient_id", "");
                        handleIngredientInputChange(row._rowKey, value);
                      }}
                      onChange={(_, option) => handleIngredientSelect(row._rowKey, option)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="식재료 검색 또는 새 이름 입력"
                        />
                      )}
                    />
                  </td>
                  <td>
                    <TextField
                      size="small"
                      value={row.qty_raw ?? ""}
                      onChange={(e) => handleFieldChange(row._rowKey, "qty_raw", e.target.value)}
                    />
                  </td>
                  <td>
                    <UnitCell
                      value={row.qty_unit}
                      onChange={(v) => handleFieldChange(row._rowKey, "qty_unit", v)}
                    />
                  </td>
                  <td>
                    <TextField
                      size="small"
                      type="number"
                      value={row.recipe_yield_servings ?? ""}
                      onChange={(e) =>
                        handleFieldChange(row._rowKey, "recipe_yield_servings", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <TextField
                      size="small"
                      type="number"
                      value={row.qty_base ?? ""}
                      onChange={(e) => handleFieldChange(row._rowKey, "qty_base", e.target.value)}
                    />
                  </td>
                  <td>
                    <UnitCell
                      value={row.base_unit}
                      onChange={(v) => handleFieldChange(row._rowKey, "base_unit", v)}
                    />
                  </td>
                  <td>{row.qty_per_person === "" || row.qty_per_person == null ? "-" : row.qty_per_person}</td>
                  <td>
                    <Checkbox
                      size="small"
                      checked={!!row.review_flag}
                      onChange={(e) => handleFieldChange(row._rowKey, "review_flag", e.target.checked ? 1 : 0)}
                    />
                  </td>
                  <td>
                    <IconButton size="small" color="error" onClick={() => handleRemoveRow(row._rowKey)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255, 255, 255, 0.68)",
            }}
          >
            <CircularProgress size={28} thickness={4} />
          </Box>
        )}
      </Box>
    </MDBox>
  );
}

IngredientDetailEditor.propTypes = {
  menuId: PropTypes.string,
  onInitialLoadComplete: PropTypes.func,
};

IngredientDetailEditor.defaultProps = {
  menuId: null,
  onInitialLoadComplete: undefined,
};
