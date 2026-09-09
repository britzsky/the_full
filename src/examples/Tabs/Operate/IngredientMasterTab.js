/* eslint-disable react/function-component-definition */
import React, { useEffect, useState } from "react";
import { Box, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Checkbox, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import KitchenIcon from "@mui/icons-material/Kitchen";
import Swal from "sweetalert2";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import useIngredientMasterData, {
  INGREDIENT_CATEGORY_OPTIONS,
  STORAGE_TYPE_PRESETS,
  OTHER_STORAGE_TYPE,
} from "./ingredientMasterData";
import { UnitCell, smallSelectSx } from "./IngredientDetailEditor";

// 🔹 한 페이지에 보여줄 개수 선택지 (메뉴 관리 탭과 동일한 패턴)
const INGREDIENT_PAGE_SIZE_OPTIONS = [20, 40, 60, 80, 100];
const DEFAULT_INGREDIENT_PAGE_SIZE = INGREDIENT_PAGE_SIZE_OPTIONS[0];

// 페이지 이동 바에서 쓰는 작은 드롭다운 보정
const pageSizeSelectSx = {
  width: 96,
  "& .MuiOutlinedInput-root": { backgroundColor: "#fff" },
  "&& .MuiSelect-select": {
    fontSize: 12,
    padding: "6px 26px 6px 10px !important",
    lineHeight: "1.4375em !important",
  },
  "& .MuiSelect-icon": { display: "inline-block", right: 4 },
};

// 🔹 식재료 등록/수정 폼 초기값
const emptyForm = {
  ingredient_id: "",
  ingredient_name_std: "",
  category_name: "",
  base_unit: "",
  order_unit: "",
  convert_value: 1,
  storage_type: "",
  note: "",
  needs_review: 0,
};

// 🔹 운영 > 메뉴/레시피 관리 > 식재료 관리 탭 (OperateTabs_7에서 사용)
export default function IngredientMasterTab() {
  const {
    ingredientRows,
    ingredientTotal,
    loading,
    fetchIngredientList,
    saveIngredient,
    deleteIngredient,
  } = useIngredientMasterData();

  const [keyword, setKeyword] = useState(""); // 식재료명 검색어
  const [categoryFilter, setCategoryFilter] = useState(""); // 분류명 필터
  const [storageFilter, setStorageFilter] = useState(""); // 보관방법 필터
  const [page, setPage] = useState(1); // 현재 페이지
  const [pageSize, setPageSize] = useState(DEFAULT_INGREDIENT_PAGE_SIZE); // 한 페이지에 보여줄 개수

  const [dialogOpen, setDialogOpen] = useState(false); // 등록/수정 모달 열림 여부
  const [form, setForm] = useState(emptyForm); // 등록/수정 폼 입력값
  const [saving, setSaving] = useState(false); // 저장 진행 여부

  // 검색 조건 + 페이지 + 페이지당 개수를 합쳐 요청 파라미터로 만드는 헬퍼
  const buildListParams = (targetPage, targetPageSize = pageSize) => ({
    keyword,
    category_name: categoryFilter,
    storage_type: storageFilter,
    page: targetPage,
    pageSize: targetPageSize,
  });

  // 최초 진입 시 식재료 목록 1페이지 조회
  useEffect(() => {
    fetchIngredientList(buildListParams(1, DEFAULT_INGREDIENT_PAGE_SIZE));
  }, [fetchIngredientList]);

  const totalPages = Math.max(1, Math.ceil(ingredientTotal / pageSize));

  // 키워드/필터 조건으로 목록 검색 처리 (검색은 항상 1페이지부터 다시 봄)
  const handleSearch = () => {
    setPage(1);
    fetchIngredientList(buildListParams(1));
  };

  // 페이지 이동
  const goToPage = (target) => {
    const next = Math.min(Math.max(1, target), totalPages);
    setPage(next);
    fetchIngredientList(buildListParams(next));
  };

  // 페이지당 개수 변경
  const handleChangePageSize = (size) => {
    setPageSize(size);
    setPage(1);
    fetchIngredientList(buildListParams(1, size));
  };

  // 식재료 신규 등록 모달 열기
  const openCreateDialog = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  // 식재료 수정 모달 열기 (선택 행 값으로 폼 채우기)
  const openEditDialog = (row) => {
    setForm({
      ingredient_id: row.ingredient_id,
      ingredient_name_std: row.ingredient_name_std || "",
      category_name: row.category_name || "",
      base_unit: row.base_unit || "",
      order_unit: row.order_unit || "",
      convert_value: row.convert_value ?? 1,
      storage_type: row.storage_type || "",
      note: row.note || "",
      needs_review: row.needs_review ? 1 : 0,
    });
    setDialogOpen(true);
  };

  // 등록/수정 폼 필드 값 변경 처리
  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // 등록/수정 저장 처리
  const handleSave = async () => {
    if (!form.ingredient_name_std?.trim()) {
      Swal.fire("식재료명을 입력해주세요.", "", "warning");
      return;
    }
    if (!form.base_unit?.trim()) {
      Swal.fire("기준단위를 선택해주세요.", "", "warning");
      return;
    }

    setSaving(true);
    try {
      await saveIngredient(form);
      Swal.fire("저장되었습니다.", "", "success");
      setDialogOpen(false);
      handleSearch();
    } catch (err) {
      Swal.fire("저장 실패", err.response?.data || err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // 삭제 확인 및 처리 (레시피에서 사용 중이면 서버에서 거부됨)
  const handleDelete = async (row) => {
    const confirm = await Swal.fire({
      title: `"${row.ingredient_name_std}" 식재료를 삭제할까요?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;

    try {
      await deleteIngredient(row.ingredient_id);
      Swal.fire("삭제되었습니다.", "", "success");
      handleSearch();
    } catch (err) {
      // 레시피에서 사용 중인 식재료는 서버가 409로 안내 문구를 그대로 내려준다.
      Swal.fire("삭제 실패", err.response?.data || err.message, "error");
    }
  };

  return (
    // 최상위 Fragment: 필터/목록 영역 + 등록/수정 모달
    <>
      {/* 상단 영역: 좌측 검색 필터 그룹 + 우측 "식재료 신규 등록" 버튼 */}
      <MDBox
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          mb: 2,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
          {/* 키워드(식재료명) 검색 필터 */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 200 }}>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>키워드</Box>
            <TextField
              size="small"
              placeholder="식재료명"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </Box>

          {/* 분류명 필터 */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 150 }}>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>분류명</Box>
            <TextField
              select
              size="small"
              sx={smallSelectSx}
              SelectProps={{
                displayEmpty: true,
                // 목록이 길어서 선택된 항목 위치로 자동 스크롤되면 맨 위가 아니라 중간부터 열려 보인다.
                // 항상 셀렉트 박스 바로 아래, 맨 위부터 펼쳐지도록 앵커를 고정한다.
                anchorOrigin: { vertical: "bottom", horizontal: "left" },
                transformOrigin: { vertical: "top", horizontal: "left" },
              }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {INGREDIENT_CATEGORY_OPTIONS.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* 보관방법 필터 */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 130 }}>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>보관방법</Box>
            <TextField
              select
              size="small"
              sx={smallSelectSx}
              SelectProps={{ displayEmpty: true }}
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {STORAGE_TYPE_PRESETS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <MDButton variant="outlined" color="info" onClick={handleSearch} sx={{ height: 40 }}>
            검색
          </MDButton>
        </Box>

        <MDButton
          variant="contained"
          color="info"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
          sx={{ height: 40 }}
        >
          식재료 신규 등록
        </MDButton>
      </MDBox>

      {/* 식재료 목록 영역: 로딩 중에는 로딩 화면, 완료되면 테이블 + 페이지 이동 바 표시 */}
      {loading ? (
        <LoadingScreen />
      ) : (
        <>
          {/* 테이블 wrapper Box */}
          <Box
            sx={{
              overflowX: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 2,
              backgroundColor: "#fff",
              boxShadow: "0 4px 18px rgba(15, 23, 42, 0.06)",
              "& table": {
                borderCollapse: "separate",
                borderSpacing: 0,
                width: "100%",
                minWidth: 1100,
              },
              "& th, & td": {
                borderBottom: "1px solid #e2e8f0",
                fontSize: "12px",
                padding: "10px 8px",
                textAlign: "center",
              },
              "& th": {
                backgroundColor: "#f8fafc",
                color: "#475569",
                fontWeight: 700,
                whiteSpace: "nowrap",
              },
              "& tbody tr:last-of-type td": { borderBottom: 0 },
            }}
          >
            <table>
              {/* 테이블 헤더: 순번/식재료명/분류명/기준단위/보관방법/사용메뉴수/검토필요/수정/삭제 (발주단위/환산값은 일단 숨김) */}
              <thead>
                <tr>
                  <th style={{ width: 60 }}>순번</th>
                  <th style={{ width: 160 }}>식재료명</th>
                  <th style={{ width: 100 }}>분류명</th>
                  <th style={{ width: 80 }}>기준단위</th>
                  <th style={{ width: 80 }}>보관방법</th>
                  <th style={{ width: 90 }}>사용메뉴수</th>
                  <th style={{ width: 70 }}>검토필요</th>
                  <th style={{ width: 60 }}>수정</th>
                  <th style={{ width: 60 }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {/* 등록된 식재료가 없을 때 보여줄 안내 행 */}
                {ingredientRows.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ color: "#94a3b8", padding: "32px 8px" }}>
                      등록된 식재료가 없습니다.
                    </td>
                  </tr>
                )}
                {/* 식재료 행 (서버에서 이미 정렬/페이지 적용된 목록) */}
                {ingredientRows.map((row, index) => (
                  <tr key={row.ingredient_id}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td style={{ textAlign: "left" }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                        <Box component="span" sx={{ fontWeight: 700, color: "#1e293b" }}>
                          {row.ingredient_name_std}
                        </Box>
                        <Box component="span" sx={{ fontSize: 10, color: "#bbb", flexShrink: 0 }}>
                          {row.ingredient_id}
                        </Box>
                      </Box>
                    </td>
                    <td style={{ color: row.category_name ? "inherit" : "#bbb" }}>
                      {row.category_name || "-"}
                    </td>
                    <td>{row.base_unit || "-"}</td>
                    <td style={{ color: row.storage_type ? "inherit" : "#bbb" }}>
                      {row.storage_type || "-"}
                    </td>
                    <td>{row.menu_usage_count ?? 0}</td>
                    <td>{row.needs_review ? "✅" : "-"}</td>
                    <td>
                      <Tooltip title="식재료 수정">
                        <IconButton size="small" color="info" onClick={() => openEditDialog(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </td>
                    <td>
                      <Tooltip title="식재료 삭제">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>

          {/* 페이지 이동 바 */}
          {ingredientTotal > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
              <Box sx={{ flex: 1, fontSize: 12, color: "#94a3b8" }}>총 {ingredientTotal}건</Box>
              <MDButton size="small" variant="outlined" color="info" disabled={page === 1} onClick={() => goToPage(1)} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>
                처음
              </MDButton>
              <MDButton size="small" variant="outlined" color="info" disabled={page === 1} onClick={() => goToPage(page - 1)} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>
                이전
              </MDButton>
              <Box
                sx={{
                  minWidth: 56,
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#475569",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 999,
                  px: 1,
                  py: 0.4,
                }}
              >
                {page} / {totalPages}
              </Box>
              <MDButton size="small" variant="outlined" color="info" disabled={page === totalPages} onClick={() => goToPage(page + 1)} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>
                다음
              </MDButton>
              <MDButton size="small" variant="outlined" color="info" disabled={page === totalPages} onClick={() => goToPage(totalPages)} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>
                마지막
              </MDButton>
              <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                <TextField
                  select
                  size="small"
                  sx={pageSizeSelectSx}
                  value={pageSize}
                  onChange={(e) => handleChangePageSize(Number(e.target.value))}
                >
                  {INGREDIENT_PAGE_SIZE_OPTIONS.map((size) => (
                    <MenuItem key={size} value={size} sx={{ fontSize: 12 }}>
                      {size}개씩
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          )}
        </>
      )}

      {/* 식재료 신규 등록/수정 모달 */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", boxShadow: "0 20px 55px rgba(15, 23, 42, 0.2)" } }}
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              px: 3,
              py: 2,
              color: "#1e3a5f",
              backgroundColor: "#e8f3fb",
              borderBottom: "1px solid #bfdbfe",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 38,
                  height: 38,
                  color: "#0288d1",
                  borderRadius: "11px",
                  backgroundColor: "rgba(255, 255, 255, 0.75)",
                }}
              >
                <KitchenIcon fontSize="small" />
              </Box>
              <Box>
                <Box sx={{ fontSize: 18, fontWeight: 700 }}>
                  {form.ingredient_id ? "식재료 수정" : "식재료 신규 등록"}
                </Box>
                <Box sx={{ mt: 0.2, color: "#64748b", fontSize: 12, fontWeight: 400 }}>
                  {form.ingredient_id
                    ? "식재료의 기본 정보를 수정합니다."
                    : "새로 등록할 식재료의 기본 정보를 입력합니다."}
                </Box>
              </Box>
            </Box>
            <IconButton aria-label="식재료 등록 모달 닫기" onClick={() => setDialogOpen(false)} sx={{ color: "#475569" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            px: "24px !important",
            pt: "24px !important",
            pb: "20px !important",
            backgroundColor: "#f8fafc",
            "& .MuiOutlinedInput-root": { backgroundColor: "#fff" },
          }}
        >
          {/* 표준 식재료명 입력 (필수) */}
          <TextField
            label="식재료명 *"
            size="small"
            fullWidth
            value={form.ingredient_name_std}
            onChange={(e) => handleFormChange("ingredient_name_std", e.target.value)}
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
            value={form.category_name}
            onChange={(e) => handleFormChange("category_name", e.target.value)}
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
          {/* 기준단위(필수). 발주단위/환산값은 일단 화면에서 숨김(order_unit/convert_value는 DB 기본값 유지) */}
          <Box>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600, mb: 0.5 }}>기준단위 *</Box>
            <UnitCell value={form.base_unit} onChange={(v) => handleFormChange("base_unit", v)} />
          </Box>
          {/* 보관방법 선택 ("기타" 선택 시 아래 직접입력 필드 노출) */}
          <TextField
            select
            label="보관방법"
            size="small"
            fullWidth
            sx={smallSelectSx}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
            value={STORAGE_TYPE_PRESETS.includes(form.storage_type) ? form.storage_type : ""}
            onChange={(e) => {
              if (e.target.value === OTHER_STORAGE_TYPE) {
                handleFormChange("storage_type", "");
              } else {
                handleFormChange("storage_type", e.target.value);
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
          {!STORAGE_TYPE_PRESETS.includes(form.storage_type) && (
            <TextField
              label="보관방법 직접입력"
              size="small"
              fullWidth
              value={form.storage_type}
              onChange={(e) => handleFormChange("storage_type", e.target.value)}
            />
          )}
          {/* 비고 입력 */}
          <TextField
            label="비고"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={form.note}
            onChange={(e) => handleFormChange("note", e.target.value)}
          />
          {/* 검토 필요 체크박스 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Checkbox
              size="small"
              checked={!!form.needs_review}
              onChange={(e) => handleFormChange("needs_review", e.target.checked ? 1 : 0)}
            />
            <Box component="span" sx={{ fontSize: 13 }}>검토 필요</Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 0.75, borderTop: "1px solid #e2e8f0", backgroundColor: "#fff" }}>
          <MDButton variant="outlined" color="dark" onClick={() => setDialogOpen(false)}>
            취소
          </MDButton>
          <MDButton variant="contained" color="info" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </MDButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
