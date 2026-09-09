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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import useIngredientDetailData from "./ingredientDetailData";
import {
  STORAGE_TYPE_PRESETS,
  OTHER_STORAGE_TYPE,
  INGREDIENT_CATEGORY_OPTIONS,
  UNIT_PRESETS,
  OTHER_UNIT,
  normalizeUnit,
} from "./ingredientMasterData";

// 전역 테마(assets/theme/components/form/select.js)가 .MuiSelect-select에
// padding: 0 12px !important 를 걸어놔서 세로 패딩이 0이 되어버리는 실제 버그 보정.
// + 실측 결과, 패딩·line-height를 옆 TextField와 똑같이 맞춰도 <input>과 <div role="combobox">는
//   브라우저에서 서로 다른 높이로 그려진다 — <input>은 line-height를 무시하고 MUI 기본값인
//   1.4375em(폰트 12px 기준 17.25px)으로 렌더링되는데, <div>인 select는 상속받은 line-height를
//   그대로 반영해 20.125px가 되면서 select만 약 3px 더 커진다. 그래서 select의 line-height도
//   1.4375em으로 강제로 맞춰야 실제 렌더링 높이가 완전히 같아진다(패딩만 맞추는 걸로는 부족함).
// IngredientMasterTab.js도 같은 보정이 필요해서 여기서 export해 같이 쓴다.
export const smallSelectSx = {
  "&& .MuiSelect-select": {
    paddingTop: "10px !important",
    paddingBottom: "10px !important",
    paddingRight: "28px !important",
    lineHeight: "1.4375em !important",
  },
  "& .MuiSelect-icon": {
    display: "inline-block",
    right: 6,
  },
};

// 🔹 단위 입력 셀 (기준단위/발주단위/원본단위 공용) — 프리셋 선택 + "기타" 선택 시 직접입력으로 전환.
//    IngredientMasterTab.js(식재료 관리 탭)도 기준단위 입력에 그대로 재사용한다.
export function UnitCell({ value, onChange }) {
  const normalizedValue = normalizeUnit(value);
  const isPreset = UNIT_PRESETS.includes(normalizedValue); // 대소문자를 통일한 현재 값이 프리셋 목록에 있는지 여부
  const [customMode, setCustomMode] = useState(!!value && !isPreset); // 직접입력 모드 여부

  // 식재료 선택 등으로 외부에서 프리셋 밖의 값이 채워지면 자동으로 직접입력 모드로 전환
  useEffect(() => {
    if (value && !UNIT_PRESETS.includes(normalizedValue) && !customMode) {
      setCustomMode(true);
    }
  }, [value, normalizedValue, customMode]);

  // 직접입력 모드: 텍스트 입력 + 프리셋 모드로 되돌리는 닫기 버튼
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

  // 프리셋 모드: 드롭다운 선택 ("기타" 선택 시 직접입력 모드로 전환)
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
        "& .MuiOutlinedInput-root": { backgroundColor: "#fff" },
        // 옆 일반 TextField(size="small")와 세로 패딩(10px)을 맞춰 높이를 정확히 일치시킨다.
        ...smallSelectSx,
        "& .MuiSelect-icon": { display: "inline-block", right: 8 },
      }}
      value={isPreset ? normalizedValue : ""}
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

// 🔹 식재료 상세정보 보완 다이얼로그 입력값 초기값
const emptyIngredientDetailForm = {
  ingredient_id: "",
  ingredient_name_std: "",
  category_name: "",
  base_unit: "",
  order_unit: "",
  convert_value: 1,
  storage_type: "",
  needs_review: 0,
  note: "",
  menu_usage_count: 0,
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
    getIngredient,
    updateIngredient,
  } = useIngredientDetailData();

  const [rows, setRows] = useState([]); // 식재료 상세 행 목록
  const [saving, setSaving] = useState(false); // 전체 저장 진행 여부
  const [initialLoading, setInitialLoading] = useState(true); // 최초 조회 진행 여부
  // ✅ 행별 식재료 자동완성 옵션/입력값
  const [optionsByRow, setOptionsByRow] = useState({});
  const searchTimerRef = useRef(null); // 자동완성 검색 디바운스 타이머

  // ✅ 식재료 상세정보(분류/보관방법/안전재고 등) 보완 다이얼로그
  const [detailForm, setDetailForm] = useState(null); // 다이얼로그 입력값 (null이면 닫힘)
  const [detailLoading, setDetailLoading] = useState(false); // 상세정보 조회 진행 여부
  const [detailSaving, setDetailSaving] = useState(false); // 상세정보 저장 진행 여부

  // 식재료 상세 목록 조회 및 행 키 부여 (필요 수량 = qty_num 우선, 없으면 qty_base)
  const loadRows = useCallback(async () => {
    const list = await fetchRecipeDetailList(menuId);
    setRows(
      list.map((row) => ({
        ...row,
        _rowKey: row.recipe_detail_id ?? `new_${Math.random().toString(36).slice(2)}`,
        category_name: row.category_name || "",
        qty_num: row.qty_num ?? row.qty_base ?? "",
        qty_unit: normalizeUnit(row.qty_unit || row.base_unit || row.ingredient_base_unit || ""),
      }))
    );
  }, [fetchRecipeDetailList, menuId]);

  // menuId 변경 시 식재료 상세 최초 조회 (로딩 모달 표시)
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

  // 식재료 상세 신규 행 초기값 생성
  const makeEmptyRow = () => ({
    _rowKey: `new_${Math.random().toString(36).slice(2)}`,
    recipe_detail_id: null,
    ingredient_id: "",
    ingredient_name_std: "",
    category_name: "",
    qty_num: "",
    qty_unit: "",
  });

  // 식재료 상세 행 추가
  const handleAddRow = () => setRows((prev) => [...prev, makeEmptyRow()]);

  // 식재료 상세 행 삭제 확인 및 처리
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

  // ✅ 숫자/텍스트 공통 입력 변경
  const handleFieldChange = (rowKey, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row._rowKey === rowKey ? { ...row, [field]: value } : row))
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

  // ✅ 목록에서 선택 시 카테고리/단위를 식재료 마스터 값으로 자동 채움
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
              category_name: row.category_name || option.category_name || "",
              qty_unit: normalizeUnit(row.qty_unit || option.base_unit || ""),
            }
          : row
      )
    );
  };

  // ✅ 식재료 상세정보(분류/보관방법/안전재고 등 tb_ingredient_master) 보완 다이얼로그 열기
  const openIngredientDetail = async (row) => {
    if (!row.ingredient_id) {
      Swal.fire("먼저 저장해주세요.", "식재료를 먼저 저장한 뒤 상세정보를 입력할 수 있습니다.", "info");
      return;
    }
    setDetailLoading(true);
    setDetailForm({ ...emptyIngredientDetailForm, ingredient_id: row.ingredient_id });
    try {
      const info = await getIngredient(row.ingredient_id);
      setDetailForm({ ...emptyIngredientDetailForm, ...(info || {}), ingredient_id: row.ingredient_id });
    } catch (err) {
      Swal.fire("식재료 상세 조회 실패", err.message, "error");
      setDetailForm(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // 식재료 상세정보 보완 다이얼로그 닫기
  const closeIngredientDetail = () => setDetailForm(null);

  // 식재료 상세정보 필드 값 변경 처리
  const handleDetailFieldChange = (field, value) =>
    setDetailForm((prev) => ({ ...prev, [field]: value }));

  // 식재료 상세정보 저장 처리
  const handleDetailSave = async () => {
    setDetailSaving(true);
    try {
      // ingredient_name_raw는 별도 입력칸 없이 표준명과 동일하게 백엔드에서 자동으로 맞춰준다.
      const saved = await updateIngredient({
        ingredient_id: detailForm.ingredient_id,
        ingredient_name_std: detailForm.ingredient_name_std || null,
        category_name: detailForm.category_name || null,
        order_unit: detailForm.order_unit || null,
        convert_value: detailForm.convert_value === "" ? null : Number(detailForm.convert_value),
        storage_type: detailForm.storage_type || null,
        needs_review: detailForm.needs_review ? 1 : 0,
        note: detailForm.note || null,
      });
      // 표준명이 목록에 반영되도록 화면의 해당 행들을 갱신
      setRows((prev) =>
        prev.map((row) =>
          row.ingredient_id === detailForm.ingredient_id
            ? { ...row, ingredient_name_std: saved.ingredient_name_std || row.ingredient_name_std }
            : row
        )
      );
      Swal.fire("식재료 상세정보가 저장되었습니다.", "", "success");
      setDetailForm(null);
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    } finally {
      setDetailSaving(false);
    }
  };

  // 식재료 상세 행 전체 저장 처리 (미등록 식재료는 즉석 등록 후 저장)
  //   화면엔 "필요 수량" 하나만 입력받으므로, 인분수는 1로 고정해 전체필요량 = 1인필요량 = 필요 수량이 되게 맞춘다.
  const handleSave = async () => {
    const missingName = rows.find((r) => !r.ingredient_id && !r.ingredient_name_std?.trim());
    if (missingName) {
      Swal.fire("식재료 미입력", "식재료명을 입력하거나 목록에서 선택해주세요.", "warning");
      return;
    }

    const missingUnit = rows.find((r) => !r.ingredient_id && !r.qty_unit?.trim());
    if (missingUnit) {
      Swal.fire(
        "단위 미선택",
        `"${missingUnit.ingredient_name_std}"의 단위를 드롭다운에서 선택해주세요.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      // 목록에 없는 식재료는 행에서 선택한 단위로 저장 시 함께 등록한다.
      const resolvedRows = await Promise.all(
        rows.map(async (row) => {
          if (row.ingredient_id) return row;
          const created = await quickCreateIngredient({
            ingredient_name_std: row.ingredient_name_std.trim(),
            base_unit: normalizeUnit(row.qty_unit),
          });
          return {
            ...row,
            ingredient_id: created.ingredient_id,
            category_name: row.category_name || created.category_name || "",
          };
        })
      );
      setRows(resolvedRows);

      const payloadRows = resolvedRows.map((r) => ({
        recipe_detail_id: r.recipe_detail_id,
        ingredient_id: r.ingredient_id,
        ingredient_name_raw: r.ingredient_name_std,
        qty_raw: r.qty_num === "" ? "" : String(r.qty_num),
        qty_num: r.qty_num === "" ? null : Number(r.qty_num),
        qty_unit: normalizeUnit(r.qty_unit),
        recipe_yield_servings: 1,
        qty_base: Number(r.qty_num) || 0,
        base_unit: normalizeUnit(r.qty_unit),
        qty_per_person: Number(r.qty_num) || 0,
        review_flag: 0,
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

  // 메뉴가 선택되지 않은 경우 안내 문구만 표시
  if (!menuId) {
    return (
      <MDBox sx={{ p: 2, color: "#999", fontSize: 13 }}>메뉴를 먼저 등록하거나 선택해주세요.</MDBox>
    );
  }

  // 최초 조회 중에는 인라인 요소를 만들지 않아 표 레이아웃이 바뀌지 않도록 한다.
  if (initialLoading) return null;

  return (
    // 최상위 wrapper: 제목/버튼 영역 + 식재료 상세 테이블 + 상세정보 보완 다이얼로그
    <MDBox sx={{ mt: 1 }}>
      {/* 상단 영역: 좌측 제목("🧂 식재료 상세") + 우측 "식재료 추가"/"저장" 버튼 */}
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

      {/* 테이블 wrapper Box: 가로 스크롤 + 표 테두리/헤더 스타일을 sx로 일괄 지정, 조회 중 오버레이도 여기에 겹쳐 표시 */}
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
        {/* 식재료 상세 목록 테이블 */}
        <table>
          {/* 테이블 헤더: 카테고리/식자재 선택/필요 수량/삭제 열 */}
          <thead>
            <tr>
              <th style={{ width: 120 }}>카테고리</th>
              <th style={{ width: 260 }}>식자재 선택</th>
              <th style={{ width: 160 }}>필요 수량</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          {/* 테이블 본문: 행이 없으면 안내 문구, 있으면 식재료 상세 입력 행 */}
          <tbody>
            {/* 등록된 식재료가 없을 때 보여줄 안내 행 */}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "#999" }}>
                  등록된 식재료가 없습니다. &quot;식재료 추가&quot; 버튼으로 등록해주세요.
                </td>
              </tr>
            )}
            {/* 식재료 상세 입력 행 */}
            {rows.length > 0 &&
              rows.map((row) => (
                <tr key={row._rowKey}>
                  {/* 카테고리 열: 식자재 선택 시 식재료 마스터의 분류명을 자동으로 채워 보여줌 (읽기 전용) */}
                  <td style={{ color: row.category_name ? "inherit" : "#bbb" }}>
                    {row.category_name || "-"}
                  </td>
                  {/* 식자재 선택 열: 자동완성 검색/직접입력 + 상세정보 다이얼로그 여는 버튼 */}
                  <td style={{ textAlign: "left" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {/* 식자재명 자동완성 (freeSolo: 목록에 없으면 직접 입력한 텍스트 그대로 사용) */}
                      <Autocomplete
                        size="small"
                        freeSolo
                        fullWidth
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
                            placeholder="식자재 검색 또는 새 이름 입력"
                          />
                        )}
                      />
                      {/* 식재료 상세정보(분류/보관방법 등) 다이얼로그 여는 버튼. 아직 저장 전(ingredient_id 없음)이면 비활성화 */}
                      <Tooltip
                        title={
                          row.ingredient_id
                            ? "식재료 상세정보(분류/보관방법/안전재고 등)"
                            : "먼저 저장한 뒤 상세정보를 입력할 수 있습니다"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            color="info"
                            disabled={!row.ingredient_id}
                            onClick={() => openIngredientDetail(row)}
                          >
                            <InfoOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </td>
                  {/* 필요 수량 열: 수량 입력 + 단위 선택(UnitCell) */}
                  <td>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <TextField
                        size="small"
                        type="number"
                        sx={{ width: 80 }}
                        value={row.qty_num ?? ""}
                        onChange={(e) => handleFieldChange(row._rowKey, "qty_num", e.target.value)}
                      />
                      <UnitCell
                        value={row.qty_unit}
                        onChange={(v) => handleFieldChange(row._rowKey, "qty_unit", v)}
                      />
                    </Box>
                  </td>
                  {/* 삭제 열: 클릭 시 확인 후 행 삭제 */}
                  <td>
                    <IconButton size="small" color="error" onClick={() => handleRemoveRow(row._rowKey)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {/* 목록 조회/저장 진행 중 표시하는 반투명 로딩 오버레이 */}
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

      {/* 식재료 상세정보(tb_ingredient_master 확장 필드) 보완 다이얼로그 */}
      <Dialog open={Boolean(detailForm)} onClose={closeIngredientDetail} maxWidth="xs" fullWidth>
        {/* 모달 헤더: 제목 + 닫기 버튼 */}
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          식재료 상세정보
          <IconButton size="small" onClick={closeIngredientDetail}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        {/* 모달 본문: 조회 중이면 로딩 스피너, 완료되면 상세정보 입력 폼 */}
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {detailLoading || !detailForm ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              {/* 표준 식재료명 입력 */}
              <TextField
                label="표준 식재료명"
                size="small"
                fullWidth
                value={detailForm.ingredient_name_std || ""}
                onChange={(e) => handleDetailFieldChange("ingredient_name_std", e.target.value)}
              />
              {/* 분류명 선택 (고정 목록, 가나다순) */}
              <TextField
                select
                label="분류명"
                size="small"
                fullWidth
                sx={smallSelectSx}
                SelectProps={{
                  displayEmpty: true,
                  // 목록이 길어서 선택된 항목 위치로 자동 스크롤되면 맨 위가 아니라 중간부터 열려 보인다.
                  anchorOrigin: { vertical: "bottom", horizontal: "left" },
                  transformOrigin: { vertical: "top", horizontal: "left" },
                }}
                InputLabelProps={{ shrink: true }}
                value={detailForm.category_name || ""}
                onChange={(e) => handleDetailFieldChange("category_name", e.target.value)}
              >
                <MenuItem value="">
                  <em>카테고리 선택</em>
                </MenuItem>
                {INGREDIENT_CATEGORY_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
              {/* 발주단위/환산값은 일단 화면에서 숨김 (order_unit/convert_value는 DB 기본값 그대로 유지) */}
              {/* 보관방법 선택 ("기타" 선택 시 아래 직접입력 필드 노출) */}
              <TextField
                select
                label="보관방법"
                size="small"
                fullWidth
                sx={smallSelectSx}
                SelectProps={{ displayEmpty: true }}
                InputLabelProps={{ shrink: true }}
                value={
                  STORAGE_TYPE_PRESETS.includes(detailForm.storage_type) ? detailForm.storage_type : ""
                }
                onChange={(e) => {
                  if (e.target.value === OTHER_STORAGE_TYPE) {
                    handleDetailFieldChange("storage_type", "");
                  } else {
                    handleDetailFieldChange("storage_type", e.target.value);
                  }
                }}
              >
                <MenuItem value="">
                  <em>선택</em>
                </MenuItem>
                {STORAGE_TYPE_PRESETS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
                <MenuItem value={OTHER_STORAGE_TYPE}>기타(직접입력)</MenuItem>
              </TextField>
              {/* 보관방법이 프리셋에 없는 값("기타")일 때만 노출되는 직접입력 필드 */}
              {!STORAGE_TYPE_PRESETS.includes(detailForm.storage_type) && (
                <TextField
                  label="보관방법 직접입력"
                  size="small"
                  fullWidth
                  value={detailForm.storage_type || ""}
                  onChange={(e) => handleDetailFieldChange("storage_type", e.target.value)}
                />
              )}
              {/* 비고 입력 */}
              <TextField
                label="비고"
                size="small"
                fullWidth
                multiline
                minRows={2}
                value={detailForm.note || ""}
                onChange={(e) => handleDetailFieldChange("note", e.target.value)}
              />
              {/* 검토 필요 체크박스 + 이 식재료를 사용 중인 메뉴 수 안내 */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Checkbox
                  size="small"
                  checked={!!detailForm.needs_review}
                  onChange={(e) => handleDetailFieldChange("needs_review", e.target.checked ? 1 : 0)}
                />
                <Box component="span" sx={{ fontSize: 13 }}>검토 필요</Box>
                <Box component="span" sx={{ ml: "auto", fontSize: 12, color: "#888" }}>
                  이 식재료를 사용하는 메뉴 수: {detailForm.menu_usage_count ?? 0}
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        {/* 모달 하단 버튼 영역: 취소 / 저장 버튼 */}
        <DialogActions>
          <MDButton variant="outlined" color="dark" onClick={closeIngredientDetail}>
            취소
          </MDButton>
          <MDButton
            variant="contained"
            color="info"
            onClick={handleDetailSave}
            disabled={detailSaving || detailLoading || !detailForm}
          >
            {detailSaving ? "저장 중..." : "저장"}
          </MDButton>
        </DialogActions>
      </Dialog>
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
