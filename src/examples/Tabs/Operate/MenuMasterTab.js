/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import Swal from "sweetalert2";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";
import { API_BASE_URL } from "config";
import { buildFileDownloadUrl } from "utils/fileDownloadUrl";
import PreviewOverlay from "utils/PreviewOverlay";
import { getHeadOfficeDocumentPreviewKind } from "utils/headOfficeDocumentImageUtils";
import useMenuMasterData, {
  FOOD_TYPE_OPTIONS,
  MENU_TYPE_OPTIONS,
  MENU_GUBUN_OPTIONS,
  MEAL_PLAN_TYPE_OPTIONS,
  labelOf,
} from "./menuMasterData";
import IngredientDetailEditor from "./IngredientDetailEditor";

// 전역 테마(assets/theme/components/form/select.js)가 .MuiSelect-select에
// padding: 0 12px !important 를 걸어놔서 세로 패딩이 0이 되어버리는 실제 버그 보정
const smallSelectSx = {
  // 테마 쪽 규칙도 !important라서 우선순위(특이도)를 더 높여야 실제로 이김
  "&& .MuiSelect-select": {
    paddingTop: "10px !important",
    paddingBottom: "10px !important",
    paddingRight: "28px !important",
  },
  // 전역 테마(assets/theme/components/form/select.js)가 화살표 아이콘을
  // display:none으로 꺼놔서, 여기서만 로컬로 다시 보이게 함
  "& .MuiSelect-icon": {
    display: "inline-block",
    right: 6,
  },
};

const emptyForm = {
  menu_id: "",
  menu_name: "",
  food_type: 1,
  menu_type: 0,
  menu_gubun: "",
  meal_plan_type: 0,
  calories_per_serving: "",
  menu_img: "",
};

// 🔹 운영 > 메뉴/레시피 관리 > 메뉴 관리 탭 (OperateTabs_7에서 사용)
export default function MenuMasterTab() {
  const { menuRows, loading, fetchMenuList, saveMenu, deleteMenu, uploadMenuImage } =
    useMenuMasterData();

  const [keyword, setKeyword] = useState("");
  const [foodTypeFilter, setFoodTypeFilter] = useState("");
  const [menuTypeFilter, setMenuTypeFilter] = useState("");
  const [menuGubunFilter, setMenuGubunFilter] = useState("");
  const [mealPlanTypeFilter, setMealPlanTypeFilter] = useState("");
  const [expandedMenuId, setExpandedMenuId] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // ✅ 이미지 미리보기 (AccountMemberSheetTab과 동일하게 공통 PreviewOverlay 사용)
  const [previewFiles, setPreviewFiles] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewObjectUrlsRef = useRef([]);

  useEffect(() => {
    fetchMenuList();
  }, [fetchMenuList]);

  const handleSearch = () =>
    fetchMenuList({
      keyword,
      food_type: foodTypeFilter,
      menu_type: menuTypeFilter,
      menu_gubun: menuGubunFilter,
      meal_plan_type: mealPlanTypeFilter,
    });

  const openCreateDialog = () => {
    setForm(emptyForm);
    setImageFile(null);
    setDialogOpen(true);
  };

  const openEditDialog = (row) => {
    setForm({
      menu_id: row.menu_id,
      menu_name: row.menu_name || "",
      food_type: row.food_type ?? 1,
      menu_type: row.menu_type ?? 0,
      menu_gubun: row.menu_gubun ?? "",
      meal_plan_type: row.meal_plan_type ?? 0,
      calories_per_serving: row.calories_per_serving ?? "",
      menu_img: row.menu_img ?? "",
    });
    setImageFile(null);
    setDialogOpen(true);
  };

  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.menu_name?.trim()) {
      Swal.fire("메뉴명을 입력해주세요.", "", "warning");
      return;
    }

    setSaving(true);
    try {
      let menuImg = form.menu_img;
      if (imageFile) {
        menuImg = await uploadMenuImage(imageFile, form.menu_id);
      }

      await saveMenu({ ...form, menu_img: menuImg });
      Swal.fire("저장되었습니다.", "", "success");
      setDialogOpen(false);
      handleSearch();
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const confirm = await Swal.fire({
      title: `"${row.menu_name}" 메뉴를 삭제할까요?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "삭제",
      cancelButtonText: "취소",
    });
    if (!confirm.isConfirmed) return;

    try {
      await deleteMenu(row.menu_id);
      Swal.fire("삭제되었습니다.", "", "success");
      handleSearch();
    } catch (err) {
      Swal.fire("삭제 실패", err.message, "error");
    }
  };

  const toggleExpand = (menuId) => setExpandedMenuId((prev) => (prev === menuId ? null : menuId));

  // ✅ 이미지 미리보기 (AccountMemberSheetTab과 동일 로직: File 객체 / 서버 경로 문자열 모두 지원)
  const clearPreviewObjectUrls = useCallback(() => {
    previewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrlsRef.current = [];
  }, []);

  const toPreviewUrl = useCallback((value) => {
    if (!value) return "";
    if (typeof value === "object") {
      const objectUrl = URL.createObjectURL(value);
      previewObjectUrlsRef.current.push(objectUrl);
      return objectUrl;
    }
    return `${API_BASE_URL}${value}`;
  }, []);

  const handleViewImage = useCallback(
    (value, name) => {
      if (!value) return;
      clearPreviewObjectUrls();
      setPreviewFiles([
        {
          url: toPreviewUrl(value),
          name: name || "메뉴 이미지",
          kind: getHeadOfficeDocumentPreviewKind(
            typeof value === "object" ? value : { image_path: value }
          ),
        },
      ]);
      setPreviewIndex(0);
    },
    [clearPreviewObjectUrls, toPreviewUrl]
  );

  const handleCloseViewer = useCallback(() => {
    setPreviewFiles([]);
    setPreviewIndex(0);
    clearPreviewObjectUrls();
  }, [clearPreviewObjectUrls]);

  // ✅ 다운로드 (서버 경로 문자열일 때만)
  const handleDownload = (path) => {
    if (!path || typeof path !== "string") return;
    const url = buildFileDownloadUrl(path);
    const filename = path.split("/").pop() || "download";

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ✅ 목록 행에서 바로 이미지 재업로드(선택 즉시 업로드 + 저장)
  const handleRowImageChange = async (row, file) => {
    if (!file) return;
    try {
      const menuImg = await uploadMenuImage(file, row.menu_id);
      await saveMenu({ ...row, menu_img: menuImg });
      handleSearch();
    } catch (err) {
      Swal.fire("이미지 업로드 실패", err.message, "error");
    }
  };

  return (
    <>
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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 130 }}>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>식사분류</Box>
            <TextField
              select
              size="small"
              sx={smallSelectSx}
              value={foodTypeFilter}
              onChange={(e) => setFoodTypeFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {FOOD_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 200 }}>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>키워드</Box>
            <TextField
              size="small"
              placeholder="메뉴명, 키워드"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 130 }}>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>메뉴유형</Box>
            <TextField
              select
              size="small"
              sx={smallSelectSx}
              value={menuTypeFilter}
              onChange={(e) => setMenuTypeFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {MENU_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 130 }}>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>메뉴구분</Box>
            <TextField
              select
              size="small"
              sx={smallSelectSx}
              value={menuGubunFilter}
              onChange={(e) => setMenuGubunFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {MENU_GUBUN_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 130 }}>
            <Box sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>식단유형</Box>
            <TextField
              select
              size="small"
              sx={smallSelectSx}
              value={mealPlanTypeFilter}
              onChange={(e) => setMealPlanTypeFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {MEAL_PLAN_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* 검색 버튼은 필터 바로 옆에 — 검색은 왼쪽 필터들에 대한 동작이니 필터와 붙어 있어야 함 */}
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
          메뉴 신규 등록
        </MDButton>
      </MDBox>

      {loading ? (
        <LoadingScreen />
      ) : (
        <Box
          sx={{
            overflowX: "auto",
            "& table": { borderCollapse: "collapse", width: "100%", minWidth: 900 },
            "& th, & td": {
              border: "1px solid #ddd",
              fontSize: "12px",
              padding: "6px 8px",
              textAlign: "center",
            },
            "& th": { backgroundColor: "#f5f5f5" },
          }}
        >
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>순번</th>
                <th style={{ width: 200 }}>메뉴명</th>
                <th style={{ width: 190 }}>이미지</th>
                <th style={{ width: 80 }}>음식유형</th>
                <th style={{ width: 90 }}>메뉴타입</th>
                <th style={{ width: 110 }}>세부분류</th>
                <th style={{ width: 100 }}>식단표타입</th>
                <th style={{ width: 90 }}>열량(kcal)</th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {menuRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ color: "#999" }}>
                    등록된 메뉴가 없습니다.
                  </td>
                </tr>
              )}
              {menuRows.map((row) => (
                <React.Fragment key={row.menu_id}>
                  <tr
                    style={{ cursor: "pointer", backgroundColor: expandedMenuId === row.menu_id ? "#f0f7ff" : undefined }}
                    onClick={() => toggleExpand(row.menu_id)}
                  >
                    <td>{Number(String(row.menu_id).replace(/^\D+/, "")) || row.menu_id}</td>
                    <td style={{ textAlign: "left", fontWeight: "bold" }}>{row.menu_name}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept="image/*"
                        id={`menu-img-upload-${row.menu_id}`}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          handleRowImageChange(row, file);
                          e.target.value = ""; // 같은 파일 재선택 가능
                        }}
                      />
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, flexWrap: "wrap" }}>
                        <label htmlFor={`menu-img-upload-${row.menu_id}`}>
                          <MDButton size="small" component="span" color="info" sx={{ fontSize: "10px" }}>
                            {row.menu_img ? "재업로드" : "이미지 업로드"}
                          </MDButton>
                        </label>
                        {row.menu_img && (
                          <Tooltip title="다운로드">
                            <IconButton size="small" color="info" onClick={() => handleDownload(row.menu_img)}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {row.menu_img && (
                          <Tooltip title="미리보기">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => handleViewImage(row.menu_img, row.menu_name)}
                            >
                              <ImageSearchIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </td>
                    <td>{labelOf(FOOD_TYPE_OPTIONS, row.food_type)}</td>
                    <td>{labelOf(MENU_TYPE_OPTIONS, row.menu_type)}</td>
                    <td>{labelOf(MENU_GUBUN_OPTIONS, row.menu_gubun)}</td>
                    <td>{labelOf(MEAL_PLAN_TYPE_OPTIONS, row.meal_plan_type)}</td>
                    <td>{row.calories_per_serving ?? "-"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" color="info" onClick={() => openEditDialog(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </td>
                  </tr>
                  {expandedMenuId === row.menu_id && (
                    <tr>
                      <td colSpan={9} style={{ backgroundColor: "#fafafa", textAlign: "left" }}>
                        <IngredientDetailEditor menuId={row.menu_id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.menu_id ? "메뉴 수정" : "메뉴 신규 등록"}</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            // MuiDialogTitle-root + MuiDialogContent-root 조합엔 MUI가
            // padding-top:0을 강제 주입(특이도 더 높음)해서 !important로 이겨야 함
            pt: "20px !important",
            pb: "12px !important",
          }}
        >
          <TextField
            label="메뉴명 *"
            size="small"
            fullWidth
            value={form.menu_name}
            onChange={(e) => handleFormChange("menu_name", e.target.value)}
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              select
              label="음식유형"
              size="small"
              fullWidth
              sx={smallSelectSx}
              value={form.food_type}
              onChange={(e) => handleFormChange("food_type", Number(e.target.value))}
            >
              {FOOD_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="메뉴타입"
              size="small"
              fullWidth
              sx={smallSelectSx}
              value={form.menu_type}
              onChange={(e) => handleFormChange("menu_type", Number(e.target.value))}
            >
              {MENU_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              select
              label="세부 분류"
              size="small"
              fullWidth
              sx={smallSelectSx}
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
              value={form.menu_gubun}
              onChange={(e) =>
                handleFormChange("menu_gubun", e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <MenuItem value="">
                <em>선택</em>
              </MenuItem>
              {MENU_GUBUN_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="식단표 타입"
              size="small"
              fullWidth
              sx={smallSelectSx}
              value={form.meal_plan_type}
              onChange={(e) => handleFormChange("meal_plan_type", Number(e.target.value))}
            >
              {MEAL_PLAN_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField
            label="1인분 기준 열량(kcal)"
            size="small"
            fullWidth
            type="number"
            value={form.calories_per_serving}
            onChange={(e) => handleFormChange("calories_per_serving", e.target.value)}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {form.menu_img && !imageFile && (
              <img src={form.menu_img} alt="menu" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }} />
            )}
            <MDButton variant="outlined" color="dark" component="label" size="small">
              이미지 업로드
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </MDButton>
            {imageFile && <span style={{ fontSize: 12 }}>{imageFile.name}</span>}
            {(imageFile || form.menu_img) && (
              <Tooltip title="미리보기">
                <IconButton
                  size="small"
                  color="info"
                  onClick={() =>
                    handleViewImage(imageFile || form.menu_img, form.menu_name || "메뉴 이미지")
                  }
                >
                  <ImageSearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <MDButton
            onClick={() => setDialogOpen(false)}
            sx={{ border: "1px solid currentColor" }}
          >
            취소
          </MDButton>
          <MDButton variant="contained" color="info" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </MDButton>
        </DialogActions>
      </Dialog>

      {/* 이미지 미리보기 (AccountMemberSheetTab과 동일한 공통 PreviewOverlay 사용) */}
      <PreviewOverlay
        open={previewFiles.length > 0}
        files={previewFiles}
        currentIndex={previewIndex}
        onChangeIndex={setPreviewIndex}
        onClose={handleCloseViewer}
      />
    </>
  );
}
