/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Chip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TableSortLabel,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
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

// 메뉴 ID에서 목록에 표시하고 정렬할 순번 값을 가져오는 함수
const getMenuSequence = (menuId) => {
  const sequence = Number(String(menuId).replace(/^\D+/, ""));
  return Number.isNaN(sequence) ? String(menuId) : sequence;
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
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedMenu, setSelectedMenu] = useState(null);

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

  // 순번은 기본 오름차순으로 표시하고 헤더 클릭 시 정렬 방향을 전환한다.
  const sortedMenuRows = useMemo(
    () =>
      [...menuRows].sort((a, b) => {
        const first = getMenuSequence(a.menu_id);
        const second = getMenuSequence(b.menu_id);
        const comparison =
          typeof first === "number" && typeof second === "number"
            ? first - second
            : String(first).localeCompare(String(second), "ko", { numeric: true });
        return sortDirection === "asc" ? comparison : -comparison;
      }),
    [menuRows, sortDirection]
  );

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

  // 선택한 메뉴의 식재료 상세를 별도 모달에서 보여준다.
  const openIngredientDialog = (row) => setSelectedMenu(row);

  const closeIngredientDialog = () => setSelectedMenu(null);

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
              SelectProps={{ displayEmpty: true }}
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
              SelectProps={{ displayEmpty: true }}
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
              SelectProps={{ displayEmpty: true }}
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
              SelectProps={{ displayEmpty: true }}
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
            "& .menu-row": {
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            },
            "& .menu-row:hover": { backgroundColor: "#f0f7ff" },
            "& tbody tr:last-of-type td": { borderBottom: 0 },
          }}
        >
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>
                  <TableSortLabel
                    active
                    direction={sortDirection}
                    onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                    sx={{
                      color: "inherit !important",
                      fontSize: "12px",
                      fontWeight: 700,
                      "& .MuiTableSortLabel-icon": { color: "#1976d2 !important" },
                    }}
                  >
                    순번
                  </TableSortLabel>
                </th>
                <th style={{ width: 200 }}>메뉴명</th>
                <th style={{ width: 80 }}>음식유형</th>
                <th style={{ width: 90 }}>메뉴타입</th>
                <th style={{ width: 110 }}>세부분류</th>
                <th style={{ width: 100 }}>식단표타입</th>
                <th style={{ width: 90 }}>열량(kcal)</th>
                <th style={{ width: 190 }}>이미지</th>
                <th style={{ width: 60 }}>수정</th>
                <th style={{ width: 60 }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {menuRows.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ color: "#94a3b8", padding: "32px 8px" }}>
                    등록된 메뉴가 없습니다.
                  </td>
                </tr>
              )}
              {sortedMenuRows.map((row) => (
                <tr
                  key={row.menu_id}
                  className="menu-row"
                  onClick={() => openIngredientDialog(row)}
                >
                  <td>{getMenuSequence(row.menu_id)}</td>
                  <td style={{ textAlign: "left", fontWeight: 700, color: "#1e293b" }}>
                    {row.menu_name}
                  </td>
                  <td>{labelOf(FOOD_TYPE_OPTIONS, row.food_type)}</td>
                  <td>{labelOf(MENU_TYPE_OPTIONS, row.menu_type)}</td>
                  <td>{labelOf(MENU_GUBUN_OPTIONS, row.menu_gubun)}</td>
                  <td>{labelOf(MEAL_PLAN_TYPE_OPTIONS, row.meal_plan_type)}</td>
                  <td>{row.calories_per_serving ?? "-"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="file"
                      accept="image/*"
                      id={`menu-img-upload-${row.menu_id}`}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        handleRowImageChange(row, file);
                        e.target.value = ""; // 같은 파일을 다시 선택할 수 있도록 입력값을 초기화한다.
                      }}
                    />
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <label htmlFor={`menu-img-upload-${row.menu_id}`}>
                        <MDButton
                          size="small"
                          component="span"
                          color="info"
                          sx={{ fontSize: "10px" }}
                        >
                          {row.menu_img ? "재업로드" : "이미지 업로드"}
                        </MDButton>
                      </label>
                      {row.menu_img && (
                        <Tooltip title="다운로드">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => handleDownload(row.menu_img)}
                          >
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
                  <td onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="메뉴 수정">
                      <IconButton size="small" color="info" onClick={() => openEditDialog(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="메뉴 삭제">
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
      )}

      {/* 선택한 메뉴의 식재료 상세를 확인하고 편집하는 모달 */}
      <Dialog
        open={Boolean(selectedMenu)}
        onClose={closeIngredientDialog}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            maxHeight: "90vh",
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.24)",
          },
        }}
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              px: 3,
              py: 2.25,
              color: "#fff",
              background: "linear-gradient(135deg, #1565c0 0%, #0288d1 100%)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  borderRadius: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.18)",
                }}
              >
                <RestaurantMenuIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>메뉴 식재료 상세</Box>
                <Box
                  sx={{
                    mt: 0.25,
                    fontSize: 13,
                    fontWeight: 400,
                    opacity: 0.85,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {selectedMenu?.menu_name || "선택한 메뉴"}의 구성 식재료를 확인하고 관리합니다.
                </Box>
              </Box>
            </Box>
            <IconButton
              aria-label="상세 모달 닫기"
              onClick={closeIngredientDialog}
              sx={{ color: "#fff", backgroundColor: "rgba(255, 255, 255, 0.12)" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent
          sx={{
            p: "24px !important",
            minHeight: 470,
            backgroundColor: "#f8fafc",
          }}
        >
          {selectedMenu && (
            <>
              {/* 선택한 메뉴의 주요 분류와 열량 정보 */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box sx={{ mr: 1, color: "#0f172a", fontSize: 17, fontWeight: 700 }}>
                  {selectedMenu.menu_name}
                </Box>
                <Chip
                  size="small"
                  label={labelOf(FOOD_TYPE_OPTIONS, selectedMenu.food_type)}
                  sx={{ backgroundColor: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}
                />
                <Chip
                  size="small"
                  label={labelOf(MENU_TYPE_OPTIONS, selectedMenu.menu_type)}
                  sx={{ backgroundColor: "#eef2ff", color: "#4338ca", fontWeight: 600 }}
                />
                <Chip
                  size="small"
                  label={labelOf(MENU_GUBUN_OPTIONS, selectedMenu.menu_gubun)}
                  sx={{ backgroundColor: "#f1f5f9", color: "#475569", fontWeight: 600 }}
                />
                <Chip
                  size="small"
                  label={`${selectedMenu.calories_per_serving ?? "-"} kcal`}
                  sx={{ backgroundColor: "#fff7ed", color: "#c2410c", fontWeight: 600 }}
                />
              </Box>
              <Box
                sx={{
                  p: 2,
                  border: "1px solid #e2e8f0",
                  borderRadius: 2,
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
                }}
              >
                <IngredientDetailEditor menuId={selectedMenu.menu_id} />
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.75, borderTop: "1px solid #e2e8f0" }}>
          <MDButton
            variant="outlined"
            color="info"
            onClick={closeIngredientDialog}
            sx={{ minWidth: 88 }}
          >
            닫기
          </MDButton>
        </DialogActions>
      </Dialog>

      {/* 메뉴 기본 정보를 신규 등록하거나 수정하는 모달 */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: "0 20px 55px rgba(15, 23, 42, 0.2)",
          },
        }}
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
                <RestaurantMenuIcon fontSize="small" />
              </Box>
              <Box>
                <Box sx={{ fontSize: 18, fontWeight: 700 }}>
                  {form.menu_id ? "메뉴 수정" : "메뉴 신규 등록"}
                </Box>
                <Box sx={{ mt: 0.2, color: "#64748b", fontSize: 12, fontWeight: 400 }}>
                  {form.menu_id
                    ? "메뉴의 기본 정보와 이미지를 수정합니다."
                    : "새로 등록할 메뉴의 기본 정보를 입력합니다."}
                </Box>
              </Box>
            </Box>
            <IconButton
              aria-label="메뉴 등록 모달 닫기"
              onClick={() => setDialogOpen(false)}
              sx={{ color: "#475569" }}
            >
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
            // MuiDialogTitle-root + MuiDialogContent-root 조합엔 MUI가
            // padding-top:0을 강제 주입(특이도 더 높음)해서 !important로 이겨야 함
            pt: "24px !important",
            pb: "20px !important",
            backgroundColor: "#f8fafc",
            "& .MuiOutlinedInput-root": { backgroundColor: "#fff" },
          }}
        >
          <TextField
            label="메뉴명 *"
            size="small"
            fullWidth
            value={form.menu_name}
            onChange={(e) => handleFormChange("menu_name", e.target.value)}
          />
          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
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
          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1.5,
              flexWrap: "wrap",
              border: "1px dashed #93c5fd",
              borderRadius: 2,
              backgroundColor: "#f0f9ff",
            }}
          >
            <MDButton variant="outlined" color="info" component="label" size="small">
              {imageFile || form.menu_img ? "이미지 재업로드" : "이미지 업로드"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </MDButton>
            {imageFile && (
              <Box component="span" sx={{ color: "#475569", fontSize: 12 }}>
                {imageFile.name}
              </Box>
            )}
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
        <DialogActions
          sx={{ px: 3, py: 2, gap: 0.75, borderTop: "1px solid #e2e8f0", backgroundColor: "#fff" }}
        >
          <MDButton variant="outlined" color="dark" onClick={() => setDialogOpen(false)}>
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
