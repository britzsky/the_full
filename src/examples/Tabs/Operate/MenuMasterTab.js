/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useRef, useState } from "react";
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

// 🔹 메뉴 등록/수정 폼 초기값
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

// 🔹 한 페이지에 보여줄 개수 선택지 (20단위로 100까지)
const MENU_PAGE_SIZE_OPTIONS = [20, 40, 60, 80, 100];
const DEFAULT_MENU_PAGE_SIZE = MENU_PAGE_SIZE_OPTIONS[0];

// 페이지 이동 바에서 쓰는 작은 드롭다운 보정
// (전역 테마가 .MuiSelect-select 패딩을 0으로 만들고 화살표를 숨겨서 여기서 다시 살린다)
const pageSizeSelectSx = {
  width: 96,
  "& .MuiOutlinedInput-root": { backgroundColor: "#fff" },
  "&& .MuiSelect-select": {
    fontSize: 12,
    padding: "6px 26px 6px 10px !important",
  },
  "& .MuiSelect-icon": { display: "inline-block", right: 4 },
};

// 🔹 운영 > 메뉴/레시피 관리 > 메뉴 관리 탭 (OperateTabs_7에서 사용)
export default function MenuMasterTab() {
  const { menuRows, menuTotal, loading, fetchMenuList, saveMenu, deleteMenu, uploadMenuImage } =
    useMenuMasterData();

  const [keyword, setKeyword] = useState(""); // 메뉴명/키워드 검색어
  const [foodTypeFilter, setFoodTypeFilter] = useState(""); // 식사분류 필터
  const [menuTypeFilter, setMenuTypeFilter] = useState(""); // 메뉴유형 필터
  const [menuGubunFilter, setMenuGubunFilter] = useState(""); // 메뉴구분(세부분류) 필터
  const [mealPlanTypeFilter, setMealPlanTypeFilter] = useState(""); // 식단유형 필터
  const [sortDirection, setSortDirection] = useState("asc"); // 순번 정렬 방향
  const [menuPage, setMenuPage] = useState(1); // 메뉴 목록 현재 페이지
  const [menuPageSize, setMenuPageSize] = useState(DEFAULT_MENU_PAGE_SIZE); // 한 페이지에 보여줄 개수
  const [selectedMenu, setSelectedMenu] = useState(null); // 식재료 상세 모달에서 선택된 메뉴

  const [dialogOpen, setDialogOpen] = useState(false); // 메뉴 등록/수정 모달 열림 여부
  const [form, setForm] = useState(emptyForm); // 메뉴 등록/수정 폼 입력값
  const [imageFile, setImageFile] = useState(null); // 새로 선택한 메뉴 이미지 파일
  const [saving, setSaving] = useState(false); // 메뉴 저장 진행 여부

  // ✅ 이미지 미리보기 (AccountMemberSheetTab과 동일하게 공통 PreviewOverlay 사용)
  const [previewFiles, setPreviewFiles] = useState([]); // PreviewOverlay에 표시할 파일 목록
  const [previewIndex, setPreviewIndex] = useState(0); // 현재 보고 있는 미리보기 인덱스
  const previewObjectUrlsRef = useRef([]); // File 객체를 위해 생성한 objectURL 목록 (해제용)

  // 메뉴가 수천 건이라 전체를 한 번에 조회하면 느려서, 목록은 항상 서버에서 페이지 단위로만 받아온다.
  // (검색 필터 + 페이지 + 페이지당 개수 + 정렬방향을 합쳐 요청 파라미터로 만드는 헬퍼)
  const buildListParams = (page, sortDir, pageSize = menuPageSize) => ({
    keyword,
    food_type: foodTypeFilter,
    menu_type: menuTypeFilter,
    menu_gubun: menuGubunFilter,
    meal_plan_type: mealPlanTypeFilter,
    page,
    pageSize,
    sortDir,
  });

  // 최초 진입 시 메뉴 목록 1페이지 조회
  useEffect(() => {
    fetchMenuList(buildListParams(1, sortDirection, DEFAULT_MENU_PAGE_SIZE));
  }, [fetchMenuList]);

  // 전체 페이지 수 (서버가 내려준 검색 조건 기준 전체 건수로 계산)
  const menuTotalPages = Math.max(1, Math.ceil(menuTotal / menuPageSize));

  // 키워드/필터 조건으로 메뉴 목록 검색 처리 (검색은 항상 1페이지부터 다시 봄)
  const handleSearch = () => {
    setMenuPage(1);
    fetchMenuList(buildListParams(1, sortDirection));
  };

  // 페이지 이동: 검색 조건/정렬은 유지한 채 해당 페이지만 다시 조회
  const goToMenuPage = (page) => {
    const target = Math.min(Math.max(1, page), menuTotalPages);
    setMenuPage(target);
    fetchMenuList(buildListParams(target, sortDirection));
  };

  // 페이지당 개수 변경: 보던 위치가 어긋나므로 1페이지부터 다시 조회
  const handleChangePageSize = (size) => {
    setMenuPageSize(size);
    setMenuPage(1);
    fetchMenuList(buildListParams(1, sortDirection, size));
  };

  // 순번 정렬 방향 토글 (1페이지로 되돌리고 새 정렬로 다시 조회)
  const toggleSortDirection = () => {
    const nextDir = sortDirection === "asc" ? "desc" : "asc";
    setSortDirection(nextDir);
    setMenuPage(1);
    fetchMenuList(buildListParams(1, nextDir));
  };

  // 메뉴 신규 등록 모달 열기
  const openCreateDialog = () => {
    setForm(emptyForm);
    setImageFile(null);
    setDialogOpen(true);
  };

  // 메뉴 수정 모달 열기 (선택 행 값으로 폼 채우기)
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

  // 메뉴 등록/수정 폼 필드 값 변경 처리
  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // 메뉴 등록/수정 저장 처리 (신규 이미지 선택 시 업로드 후 경로 저장)
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

  // 메뉴 삭제 확인 및 처리
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

  // 식재료 상세 모달 닫기
  const closeIngredientDialog = () => setSelectedMenu(null);

  // ✅ 이미지 미리보기 (AccountMemberSheetTab과 동일 로직: File 객체 / 서버 경로 문자열 모두 지원)
  // 미리보기용으로 생성해둔 objectURL 전체 해제 (메모리 누수 방지)
  const clearPreviewObjectUrls = useCallback(() => {
    previewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrlsRef.current = [];
  }, []);

  // 미리보기 대상 값(File 객체 또는 서버 경로 문자열)을 실제 이미지 URL로 변환
  const toPreviewUrl = useCallback((value) => {
    if (!value) return "";
    if (typeof value === "object") {
      const objectUrl = URL.createObjectURL(value);
      previewObjectUrlsRef.current.push(objectUrl);
      return objectUrl;
    }
    return `${API_BASE_URL}${value}`;
  }, []);

  // 이미지 미리보기 오버레이 열기
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

  // 이미지 미리보기 오버레이 닫기
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
    // 최상위 Fragment: 필터/목록 영역 + 식재료 상세 모달 + 등록/수정 모달 + 이미지 미리보기 오버레이
    <>
      {/* 상단 영역: 좌측 검색 필터 그룹 + 우측 "메뉴 신규 등록" 버튼 */}
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
        {/* 검색 필터 그룹: 식사분류/키워드/메뉴유형/메뉴구분/식단유형 + 검색 버튼 */}
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
          {/* 식사분류 필터 (라벨 + 드롭다운) */}
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

          {/* 키워드(메뉴명) 검색 필터 (라벨 + 텍스트 입력, 엔터로 검색) */}
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

          {/* 메뉴유형 필터 (라벨 + 드롭다운) */}
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

          {/* 메뉴구분(세부분류) 필터 (라벨 + 드롭다운) */}
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

          {/* 식단유형 필터 (라벨 + 드롭다운) */}
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

        {/* 메뉴 신규 등록 버튼: 클릭 시 등록/수정 모달을 빈 폼으로 연다 */}
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

      {/* 메뉴 목록 영역: 로딩 중에는 로딩 화면, 완료되면 테이블 + 페이지 이동 바 표시 */}
      {loading ? (
        <LoadingScreen />
      ) : (
        <>
        {/* 테이블 wrapper Box: 스크롤/테두리/표 스타일(th/td, hover 등)을 sx로 일괄 지정 */}
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
          {/* 메뉴 목록 테이블 */}
          <table>
            {/* 테이블 헤더: 순번/메뉴명/식사분류/메뉴유형/메뉴구분/식단 유형/칼로리(kcal)/등록일 + 이미지/수정/삭제 열 */}
            <thead>
              <tr>
                {/* 순번 열: 클릭 시 오름차순/내림차순 정렬 전환 */}
                <th style={{ width: 70 }}>
                  <TableSortLabel
                    active
                    direction={sortDirection}
                    onClick={toggleSortDirection}
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
                <th style={{ width: 90 }}>식사분류</th>
                <th style={{ width: 90 }}>메뉴유형</th>
                <th style={{ width: 110 }}>메뉴구분</th>
                <th style={{ width: 90 }}>식단 유형</th>
                <th style={{ width: 90 }}>칼로리(kcal)</th>
                <th style={{ width: 100 }}>등록일</th>
                <th style={{ width: 190 }}>이미지</th>
                <th style={{ width: 60 }}>수정</th>
                <th style={{ width: 60 }}>삭제</th>
              </tr>
            </thead>
            {/* 테이블 본문: 메뉴 데이터가 없으면 안내 행, 있으면 메뉴 행을 순번 정렬해서 표시 */}
            <tbody>
              {/* 등록된 메뉴가 없을 때 보여줄 안내 행 */}
              {menuRows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ color: "#94a3b8", padding: "32px 8px" }}>
                    등록된 메뉴가 없습니다.
                  </td>
                </tr>
              )}
              {/* 메뉴 행: 행 클릭 시 해당 메뉴의 식재료 상세 모달을 연다 (서버에서 이미 정렬/페이지 적용된 목록) */}
              {menuRows.map((row, index) => (
                <tr
                  key={row.menu_id}
                  className="menu-row"
                  onClick={() => openIngredientDialog(row)}
                >
                  {/* 순번: menu_id 숫자가 아니라 현재 페이지 기준 연속 번호 (삭제된 메뉴가 있어도 번호가 건너뛰지 않음) */}
                  <td>{(menuPage - 1) * menuPageSize + index + 1}</td>
                  {/* 메뉴명 열: 좌측 메뉴명 + 우측 menu_id */}
                  <td style={{ textAlign: "left" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                      <Box component="span" sx={{ fontWeight: 700, color: "#1e293b" }}>
                        {row.menu_name}
                      </Box>
                      <Box component="span" sx={{ fontSize: 10, color: "#bbb", flexShrink: 0 }}>
                        {row.menu_id}
                      </Box>
                    </Box>
                  </td>
                  <td>{labelOf(FOOD_TYPE_OPTIONS, row.food_type)}</td>
                  <td>{labelOf(MENU_TYPE_OPTIONS, row.menu_type)}</td>
                  <td>{labelOf(MENU_GUBUN_OPTIONS, row.menu_gubun)}</td>
                  <td>{labelOf(MEAL_PLAN_TYPE_OPTIONS, row.meal_plan_type)}</td>
                  <td>{row.calories_per_serving ?? "-"}</td>
                  <td>{row.created_at ? row.created_at.slice(0, 10) : "-"}</td>
                  {/* 이미지 열: 숨김 파일 입력 + 업로드/다운로드/미리보기 버튼. 행 클릭 이벤트로 모달이 열리지 않도록 전파 차단 */}
                  <td onClick={(e) => e.stopPropagation()}>
                    {/* 실제 파일 선택 input은 숨기고 아래 라벨 버튼으로 클릭을 위임 */}
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
                    {/* 업로드/다운로드/미리보기 버튼을 가로로 나열하는 그룹 Box */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.5,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* 이미지 업로드/재업로드 버튼 (숨김 input을 감싸는 label) */}
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
                      {/* 이미지가 등록된 경우에만 다운로드 버튼 표시 */}
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
                      {/* 이미지가 등록된 경우에만 미리보기 버튼 표시 */}
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
                  {/* 수정 열: 클릭 시 등록/수정 모달을 해당 메뉴 값으로 연다 (행 클릭 이벤트 전파 차단) */}
                  <td onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="메뉴 수정">
                      <IconButton size="small" color="info" onClick={() => openEditDialog(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </td>
                  {/* 삭제 열: 클릭 시 확인 후 메뉴 삭제 (행 클릭 이벤트 전파 차단) */}
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

        {/* 페이지 이동 바: 좌측 전체 건수 / 가운데 처음·이전·현재-전체·다음·마지막 / 우측 페이지당 개수 */}
        {menuTotal > 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mt: 1.5,
            }}
          >
            {/* 전체 건수 (가운데 페이지 버튼을 실제 중앙에 두려고 좌우를 같은 비율로 벌려둠) */}
            <Box sx={{ flex: 1, fontSize: 12, color: "#94a3b8" }}>총 {menuTotal}건</Box>

            {/* 처음 페이지로 이동 */}
            <MDButton
              size="small"
              variant="outlined"
              color="info"
              disabled={menuPage === 1}
              onClick={() => goToMenuPage(1)}
              sx={{ minWidth: 0, px: 1, fontSize: 12 }}
            >
              처음
            </MDButton>
            {/* 이전 페이지로 이동 */}
            <MDButton
              size="small"
              variant="outlined"
              color="info"
              disabled={menuPage === 1}
              onClick={() => goToMenuPage(menuPage - 1)}
              sx={{ minWidth: 0, px: 1, fontSize: 12 }}
            >
              이전
            </MDButton>
            {/* 현재 페이지 / 전체 페이지 수 */}
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
              {menuPage} / {menuTotalPages}
            </Box>
            {/* 다음 페이지로 이동 */}
            <MDButton
              size="small"
              variant="outlined"
              color="info"
              disabled={menuPage === menuTotalPages}
              onClick={() => goToMenuPage(menuPage + 1)}
              sx={{ minWidth: 0, px: 1, fontSize: 12 }}
            >
              다음
            </MDButton>
            {/* 마지막 페이지로 이동 */}
            <MDButton
              size="small"
              variant="outlined"
              color="info"
              disabled={menuPage === menuTotalPages}
              onClick={() => goToMenuPage(menuTotalPages)}
              sx={{ minWidth: 0, px: 1, fontSize: 12 }}
            >
              마지막
            </MDButton>

            {/* 페이지당 개수 선택 (20단위로 100까지) */}
            <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
              <TextField
                select
                size="small"
                sx={pageSizeSelectSx}
                value={menuPageSize}
                onChange={(e) => handleChangePageSize(Number(e.target.value))}
              >
                {MENU_PAGE_SIZE_OPTIONS.map((size) => (
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
        {/* 모달 헤더: 파란 그라디언트 배경 + 아이콘 + 제목/부제 + 닫기 버튼 */}
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
            {/* 아이콘 + 제목/부제 묶음 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
              {/* 원형 배경의 식당(레시피) 아이콘 */}
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
              {/* 제목("메뉴 식재료 상세") + 부제(선택 메뉴명 안내) */}
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
            {/* 모달 닫기 버튼 */}
            <IconButton
              aria-label="상세 모달 닫기"
              onClick={closeIngredientDialog}
              sx={{ color: "#fff", backgroundColor: "rgba(255, 255, 255, 0.12)" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        {/* 모달 본문: 메뉴 요약 정보(Chip) + 식재료 상세 편집 컴포넌트 */}
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
                {/* 음식유형 배지 */}
                <Chip
                  size="small"
                  label={labelOf(FOOD_TYPE_OPTIONS, selectedMenu.food_type)}
                  sx={{ backgroundColor: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}
                />
                {/* 메뉴타입 배지 */}
                <Chip
                  size="small"
                  label={labelOf(MENU_TYPE_OPTIONS, selectedMenu.menu_type)}
                  sx={{ backgroundColor: "#eef2ff", color: "#4338ca", fontWeight: 600 }}
                />
                {/* 메뉴구분(세부분류) 배지 */}
                <Chip
                  size="small"
                  label={labelOf(MENU_GUBUN_OPTIONS, selectedMenu.menu_gubun)}
                  sx={{ backgroundColor: "#f1f5f9", color: "#475569", fontWeight: 600 }}
                />
                {/* 1인분 열량 배지 */}
                <Chip
                  size="small"
                  label={`${selectedMenu.calories_per_serving ?? "-"} kcal`}
                  sx={{ backgroundColor: "#fff7ed", color: "#c2410c", fontWeight: 600 }}
                />
              </Box>
              {/* 식재료 상세 편집 컴포넌트를 감싸는 카드 Box */}
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
        {/* 모달 하단 버튼 영역: 닫기 버튼 */}
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
        {/* 모달 헤더: 아이콘 + 제목(신규 등록/수정 구분) + 부제 + 닫기 버튼 */}
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
            {/* 아이콘 + 제목/부제 묶음 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              {/* 원형 배경의 식당(레시피) 아이콘 */}
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
              {/* 제목("메뉴 수정" / "메뉴 신규 등록")과 안내 문구 */}
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
            {/* 모달 닫기 버튼 */}
            <IconButton
              aria-label="메뉴 등록 모달 닫기"
              onClick={() => setDialogOpen(false)}
              sx={{ color: "#475569" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        {/* 모달 본문: 메뉴명 / 음식유형·메뉴타입 / 세부분류·식단표타입 / 열량 / 이미지 업로드 입력 폼 */}
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
          {/* 메뉴명 입력 (필수) */}
          <TextField
            label="메뉴명 *"
            size="small"
            fullWidth
            value={form.menu_name}
            onChange={(e) => handleFormChange("menu_name", e.target.value)}
          />
          {/* 음식유형 + 메뉴타입 드롭다운을 나란히 배치하는 행 Box */}
          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
            {/* 음식유형 선택 */}
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
            {/* 메뉴타입 선택 */}
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
          {/* 세부 분류 + 식단표 타입 드롭다운을 나란히 배치하는 행 Box */}
          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
            {/* 세부 분류(메뉴구분) 선택 */}
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
            {/* 식단표 타입 선택 */}
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
          {/* 1인분 기준 열량 입력 */}
          <TextField
            label="1인분 기준 열량(kcal)"
            size="small"
            fullWidth
            type="number"
            value={form.calories_per_serving}
            onChange={(e) => handleFormChange("calories_per_serving", e.target.value)}
          />
          {/* 메뉴 이미지 업로드 영역: 업로드 버튼 + 선택된 파일명 + 미리보기 버튼 */}
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
            {/* 실제 파일 선택 input을 감싸는 업로드/재업로드 버튼 */}
            <MDButton variant="outlined" color="info" component="label" size="small">
              {imageFile || form.menu_img ? "이미지 재업로드" : "이미지 업로드"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </MDButton>
            {/* 새로 선택한 파일명 표시 */}
            {imageFile && (
              <Box component="span" sx={{ color: "#475569", fontSize: 12 }}>
                {imageFile.name}
              </Box>
            )}
            {/* 새 파일 또는 기존 이미지가 있을 때만 미리보기 버튼 표시 */}
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
        {/* 모달 하단 버튼 영역: 취소 / 저장 버튼 */}
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
