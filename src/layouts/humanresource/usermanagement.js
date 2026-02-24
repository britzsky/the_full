/* eslint-disable react/prop-types */
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { useTheme, useMediaQuery } from "@mui/material";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import api from "api/api";
import Swal from "sweetalert2";

// 직책 코드 → 라벨
const POSITION_LABELS = {
  0: "대표",
  1: "팀장",
  2: "파트장",
  3: "매니저",
  // 4: "매니저",
  // 5: "매니저",
  // 6: "매니저",
  // 7: "매니저",
  8: "영양사",
};

// 부서 코드 → 라벨
const DEPT_LABELS = {
  0: "대표",
  // 1: "신사업팀",
  2: "회계팀",
  3: "인사팀",
  4: "영업팀",
  5: "운영팀",
  6: "개발팀",
  7: "현장",
};

const HQ_DEPARTMENT_OPTIONS = Object.entries(DEPT_LABELS)
  .filter(([code]) => !["0", "7"].includes(String(code)))
  .map(([value, label]) => ({ value: String(value), label }));

const POSITION_OPTIONS = [
  { value: "1", label: "팀장" },
  { value: "2", label: "파트장" },
  { value: "3", label: "매니저" },
  // { value: "4", label: "매니저" },
  // { value: "5", label: "매니저" },
  // { value: "6", label: "매니저" },
  // { value: "7", label: "매니저" },
  { value: "8", label: "영양사" },
];

// 통합/유틸 인력 전용 직책(position_type) 옵션
const UTIL_MEMBER_TYPE_OPTIONS = [
  { value: "7", label: "통합" },
  { value: "6", label: "유틸" },
];

const PROFILE_TRACK_FIELDS = [
  "user_name",
  "password",
  "department",
  "account_id",
  "position",
  "join_dt",
  "birth_date",
  "phone",
  "address",
  "address_detail",
  "user_type",
  "util_member_type",
];

const asText = (value) => (value == null ? "" : String(value));

const normalizeCode = (value) => {
  const next = asText(value).trim();
  return next ? next : "";
};

const buildAddressFull = (address, addressDetail) => {
  const base = asText(address).trim();
  const detail = asText(addressDetail).trim();
  if (!base && !detail) return "-";
  return `${base}${detail ? ` ${detail}` : ""}`.trim();
};

const inferUserType = (row) => {
  if (normalizeCode(row.user_type)) return normalizeCode(row.user_type);
  if (asText(row.account_id).trim()) return "3";
  if (normalizeCode(row.position) === "0") return "1";
  return "2";
};

const toComparableValue = (field, value) => {
  if (["department", "account_id", "position", "user_type", "util_member_type"].includes(field)) {
    return normalizeCode(value);
  }
  return asText(value);
};

const getUtilMemberLabel = (positionType) => {
  const normalized = normalizeCode(positionType);
  if (normalized === "7") return "통합";
  if (normalized === "6") return "유틸";
  return "-";
};

const isCeo = (row) => normalizeCode(row.position) === "0";
const isHeadOffice = (row) => !asText(row.account_id).trim();

// accountissuesheet2 테이블 톤과 맞추기 위한 컬럼 설정
const TABLE_COLUMNS = [
  { key: "ui_index", label: "순번", width: 52, align: "center" },
  { key: "user_name", label: "성명", width: 78, align: "center" },
  { key: "user_id", label: "아이디", width: 96, align: "center" },
  { key: "password", label: "비밀번호", width: 92, align: "center" },
  { key: "dept_or_account", label: "부서/거래처", width: 190, align: "center" },
  { key: "position_label", label: "직책", width: 86, align: "center" },
  { key: "join_dt", label: "입사일자", width: 108, align: "center" },
  { key: "birth_date", label: "생년월일", width: 108, align: "center" },
  { key: "phone", label: "전화번호", width: 120, align: "center" },
  { key: "address_full", label: "주소", width: 186, align: "left" },
  { key: "del_yn", label: "퇴사여부", width: 86, align: "center" },
];

// accountissuesheet2 본문과 동일 계열 폰트/크기
const TABLE_FONT_FAMILY = "inherit";
const TABLE_FONT_SIZE = 12;
const CELL_HEIGHT = 33;
const CELL_INNER_HEIGHT = 23;
const MIN_LOADING_MODAL_MS = 420;
const PAGE_SIZE = 20;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toNullableNumber = (value) => {
  const normalized = normalizeCode(value);
  return normalized === "" ? null : Number(normalized);
};

const toNullableDate = (value) => {
  const next = asText(value).trim();
  return next ? next : null;
};

const parseApiCode = (data) => {
  if (data && typeof data === "object" && data.code != null) {
    return String(data.code);
  }

  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.code != null) return String(parsed.code);
    } catch (e) {
      return "";
    }
  }

  return "";
};

const buildUserSavePayload = (row) => {
  const userTypeCode = normalizeCode(row.user_type) || inferUserType(row);
  const accountId = asText(row.account_id).trim();
  const normalizedDepartment = userTypeCode === "4" ? 7 : toNullableNumber(row.department);
  const utilMemberType = normalizeCode(row.util_member_type);
  const payload = {
    is_update: true,
    info: {
      user_id: asText(row.user_id).trim(),
      user_name: asText(row.user_name).trim(),
      password: asText(row.password),
      user_type: toNullableNumber(userTypeCode),
      join_dt: toNullableDate(row.join_dt),
      department: normalizedDepartment,
      position: userTypeCode === "4" ? null : toNullableNumber(row.position),
      account_id: accountId || null,
      util_member_type: userTypeCode === "4" ? utilMemberType || null : null,
    },
    detail: {
      user_id: asText(row.user_id).trim(),
      phone: asText(row.phone).trim() || null,
      address: asText(row.address).trim() || "",
      address_detail: asText(row.address_detail).trim() || "",
      zipcode: asText(row.zipcode).trim() || null,
      birth_date: toNullableDate(row.birth_date),
    },
  };

  // 원래 /User/UserRgt 저장 로직을 유지하면서 통합/유틸(account_members) 생성까지 동일 경로로 태움
  if (userTypeCode === "4" && (utilMemberType === "6" || utilMemberType === "7")) {
    payload.account_member = {
      position_type: Number(utilMemberType), // 7: 통합, 6: 유틸
    };
  }

  return payload;
};

const readSingleRow = (data) => {
  if (Array.isArray(data)) return data[0] || null;
  if (data && typeof data === "object") return data;
  return null;
};

const collectProfileChangedRows = (targetRows, originalsById) =>
  targetRows.filter((row) => {
    const original = originalsById[row.user_id];
    if (!original) return false;

    return PROFILE_TRACK_FIELDS.some(
      (field) => toComparableValue(field, row[field]) !== toComparableValue(field, original[field])
    );
  });

const collectDelEntriesFromRows = (targetRows, originalsById) =>
  targetRows
    .map((row) => {
      const original = originalsById[row.user_id] || {};
      const nextDelYn = asText(row.del_yn || "N").toUpperCase();
      const originalDelYn = asText(original.orig_del_yn ?? original.del_yn ?? "N").toUpperCase();
      if (nextDelYn === originalDelYn) return null;

      return {
        user_id: row.user_id,
        del_yn: nextDelYn,
      };
    })
    .filter(Boolean);

const buildSearchBlob = (row) =>
  [
    row.ui_index,
    row.user_id,
    row.user_name,
    row.dept_or_account,
    row.position_label,
    row.join_dt,
    row.birth_date,
    row.phone,
    row.address_full,
    row.del_yn === "Y" ? "퇴사" : "재직",
  ]
    .map((value) => asText(value).toLowerCase())
    .join(" ");

function UserManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // 화면 데이터/상태
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingDelYn, setPendingDelYn] = useState({});
  const [pendingProfileChanges, setPendingProfileChanges] = useState({});
  const [originalRowsById, setOriginalRowsById] = useState({});
  const [accountOptions, setAccountOptions] = useState([]);
  const [accountOptionsLoading, setAccountOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [editingAccountUserId, setEditingAccountUserId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearchKeyword = useDeferredValue(searchKeyword);
  const rowsRef = useRef(rows);
  const originalRowsByIdRef = useRef(originalRowsById);

  const accountOptionById = useMemo(() => {
    const map = new Map();
    accountOptions.forEach((option) => {
      map.set(String(option.account_id), option);
    });
    return map;
  }, [accountOptions]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    originalRowsByIdRef.current = originalRowsById;
  }, [originalRowsById]);

  // 서버 응답을 화면 전용 행 데이터로 정규화
  const mapUserRow = (item, index) => {
    const department = normalizeCode(item.department);
    const account_id = asText(item.account_id).trim();
    const account_name = asText(item.account_name);
    const position = normalizeCode(item.position);
    const user_type = normalizeCode(item.user_type);
    const util_member_type_raw = normalizeCode(item.util_member_type);
    const util_member_type =
      util_member_type_raw || (position === "6" || position === "7" ? position : "");
    const normalizedUserType =
      user_type || (util_member_type ? "4" : account_id ? "3" : position === "0" ? "1" : "2");
    const del_yn = asText(item.del_yn || "N").toUpperCase();
    const positionLabel =
      normalizedUserType === "4"
        ? getUtilMemberLabel(util_member_type)
        : POSITION_LABELS[position] ?? position ?? "-";

    const mappedRow = {
      ui_index: index + 1,
      user_id: asText(item.user_id),
      user_name: asText(item.user_name),
      password: asText(item.password),
      department,
      account_id,
      account_name,
      position,
      util_member_type,
      user_type: normalizedUserType,
      position_label: positionLabel,
      join_dt: asText(item.join_dt),
      birth_date: asText(item.birth_date),
      phone: asText(item.phone),
      address: asText(item.address),
      address_detail: asText(item.address_detail),
      zipcode: asText(item.zipcode),
      del_yn,
      orig_del_yn: del_yn,
      dept_or_account:
        account_name || (account_id ? account_id : DEPT_LABELS[department] ?? department ?? "-"),
      address_full: buildAddressFull(item.address, item.address_detail),
    };

    mappedRow.search_blob = buildSearchBlob(mappedRow);
    return mappedRow;
  };

  // 사용자 목록 조회 (서버 → 화면 상태)
  const fetchUsers = async () => {
    if (loading) return;

    let loadingOpenedAt = 0;
    try {
      setLoading(true);
      Swal.fire({
        title: "불러오는 중...",
        text: "사용자 목록을 조회하고 있습니다.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
      loadingOpenedAt = Date.now();

      const res = await api.get("/User/UserManageList");
      const list = Array.isArray(res.data) ? res.data : [];
      const mapped = list.map((item, idx) => mapUserRow(item, idx));
      const originals = {};
      mapped.forEach((row) => {
        originals[row.user_id] = { ...row };
      });

      setRows(mapped);
      rowsRef.current = mapped;
      setOriginalRowsById(originals);
      originalRowsByIdRef.current = originals;
      setPendingDelYn({});
      setPendingProfileChanges({});
      setEditingAccountUserId("");
      setCurrentPage(1);
    } catch (err) {
      console.error("사용자 목록 조회 실패:", err);
      Swal.fire("조회 실패", "사용자 목록을 불러오지 못했습니다.", "error");
      setRows([]);
      rowsRef.current = [];
    } finally {
      setLoading(false);
      if (loadingOpenedAt > 0) {
        const elapsed = Date.now() - loadingOpenedAt;
        const remain = Math.max(MIN_LOADING_MODAL_MS - elapsed, 0);
        if (remain > 0) {
          await wait(remain);
        }
      }
      const currentTitle = Swal.getTitle()?.textContent || "";
      if (Swal.isVisible() && currentTitle.includes("불러오는 중")) {
        Swal.close();
      }
    }
  };

  // 거래처 검색용 옵션 조회
  const fetchAccountOptions = async () => {
    if (accountOptions.length > 0 || accountOptionsLoading) return;

    try {
      setAccountOptionsLoading(true);
      const res = await api.get("/Account/AccountList", {
        params: { account_type: 0 },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setAccountOptions(
        list
          .map((item) => ({
            account_id: asText(item.account_id),
            account_name: asText(item.name || item.account_name || item.account_id),
          }))
          .filter((item) => item.account_id)
      );
    } catch (err) {
      console.error("거래처 목록 조회 실패:", err);
      setAccountOptions([]);
    } finally {
      setAccountOptionsLoading(false);
    }
  };

  const fetchUserInfoForSave = async (userId) => {
    try {
      const res = await api.get("/User/SelectUserInfo", { params: { user_id: userId } });
      return readSingleRow(res.data);
    } catch (err) {
      console.error(`저장 전 사용자 상세 조회 실패 (${userId}):`, err);
      return null;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // accountissuesheet2와 동일한 테이블 외곽/헤더/본문 톤
  const tableSx = {
    flex: 1,
    maxHeight: "79vh",
    overflow: "auto",
    "& table": {
      width: "max-content",
      minWidth: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      tableLayout: "fixed",
    },
    "& th, & td": {
      border: "1px solid #cfd6de",
      textAlign: "center",
      padding: "0 4px",
      fontSize: `${TABLE_FONT_SIZE}px`,
      fontFamily: TABLE_FONT_FAMILY,
      fontWeight: 400,
      color: "#111",
      background: "#fff",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
      height: `${CELL_HEIGHT}px`,
      boxSizing: "border-box",
      verticalAlign: "middle",
    },
    "& thead th": {
      position: "sticky",
      top: -1,
      background: "#dbe7f5 !important",
      zIndex: 8,
      fontWeight: 700,
      fontFamily: TABLE_FONT_FAMILY,
      color: "#344054",
      paddingTop: 0,
      paddingBottom: 0,
      lineHeight: `${CELL_HEIGHT}px`,
      verticalAlign: "middle",
      boxShadow: "none",
      borderBottom: "1px solid #cfd6de",
      transform: "translateZ(0)",
      backgroundClip: "padding-box",
    },
  };

  // 드롭다운 화살표/텍스트 간격을 모든 셀에서 동일하게 강제
  const compactSelectSx = {
    minWidth: 72,
    height: CELL_INNER_HEIGHT,
    margin: 0,
    color: "#111",
    backgroundColor: "#f3f5f7",
    borderRadius: "4px",
    "& .MuiOutlinedInput-notchedOutline": {
      border: "none !important",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      border: "none !important",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      border: "none !important",
    },
    "& .MuiSelect-select, & .MuiSelect-select.MuiSelect-select": {
      paddingTop: "0 !important",
      paddingBottom: "0 !important",
      paddingLeft: "8px !important",
      paddingRight: "8px !important",
      fontSize: TABLE_FONT_SIZE,
      fontFamily: TABLE_FONT_FAMILY,
      fontWeight: 400,
      minHeight: `${CELL_INNER_HEIGHT}px !important`,
      lineHeight: `${CELL_INNER_HEIGHT}px !important`,
      display: "flex !important",
      alignItems: "center !important",
      justifyContent: "center",
      textAlign: "center",
      boxSizing: "border-box",
      height: `${CELL_INNER_HEIGHT}px !important`,
    },
    "&.MuiInputBase-root, & .MuiInputBase-root": {
      minHeight: `${CELL_INNER_HEIGHT}px`,
      height: `${CELL_INNER_HEIGHT}px`,
      alignItems: "center !important",
      margin: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    "& .MuiInputBase-input": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: 0,
    },
    "& .MuiSelect-icon": {
      display: "none",
    },
  };

  // 행 변경 시 원본 대비 diff를 계산해 "화면 저장 대상"으로 적재
  const syncPendingProfileByRow = (userId, nextRow) => {
    const original = originalRowsById[userId];
    if (!original) return;

    const changed = {};
    PROFILE_TRACK_FIELDS.forEach((field) => {
      const beforeValue = toComparableValue(field, original[field]);
      const afterValue = toComparableValue(field, nextRow[field]);
      if (beforeValue !== afterValue) {
        changed[field] = nextRow[field];
      }
    });

    setPendingProfileChanges((prev) => {
      const next = { ...prev };
      if (Object.keys(changed).length === 0) {
        delete next[userId];
      } else {
        next[userId] = changed;
      }
      return next;
    });
  };

  // 특정 행에 patch를 적용하고 표시용 파생값(직책 라벨/주소 등)도 함께 갱신
  const applyRowPatch = (userId, patch) => {
    let updatedRow = null;

    setRows((prev) => {
      const nextRows = prev.map((row) => {
        if (row.user_id !== userId) return row;

        const next = { ...row, ...patch };
        const normalized = {
          ...next,
          department: normalizeCode(next.department),
          account_id: asText(next.account_id).trim(),
          account_name: asText(next.account_name),
          position: normalizeCode(next.position),
          util_member_type: normalizeCode(next.util_member_type),
          user_type: inferUserType(next),
          user_name: asText(next.user_name),
          password: asText(next.password),
          join_dt: asText(next.join_dt),
          birth_date: asText(next.birth_date),
          phone: asText(next.phone),
          address: asText(next.address),
          address_detail: asText(next.address_detail),
          zipcode: asText(next.zipcode),
        };

        normalized.position_label =
          normalized.user_type === "4"
            ? getUtilMemberLabel(normalized.util_member_type)
            : POSITION_LABELS[normalized.position] ?? normalized.position ?? "-";
        normalized.dept_or_account =
          normalized.account_name ||
          (normalized.account_id
            ? normalized.account_id
            : DEPT_LABELS[normalized.department] ?? normalized.department ?? "-");
        normalized.address_full = buildAddressFull(normalized.address, normalized.address_detail);
        normalized.search_blob = buildSearchBlob(normalized);

        updatedRow = normalized;
        return normalized;
      });
      rowsRef.current = nextRows;
      return nextRows;
    });

    if (updatedRow) {
      syncPendingProfileByRow(userId, updatedRow);
    }
  };

  // 텍스트 셀 변경
  const handleTextFieldChange = (userId, field, value) => {
    applyRowPatch(userId, { [field]: value });
  };

  // 본사 사용자의 부서 변경
  const handleDepartmentChange = (userId, nextDepartment) => {
    applyRowPatch(userId, {
      department: normalizeCode(nextDepartment),
      account_id: "",
      account_name: "",
      user_type: "2",
    });
  };

  // 거래처 사용자의 거래처 변경
  const handleAccountChange = (userId, option) => {
    if (!option) return;
    applyRowPatch(userId, {
      account_id: asText(option.account_id),
      account_name: asText(option.account_name),
      department: "7",
      user_type: "3",
    });
  };

  // 직책 변경
  const handlePositionChange = (userId, nextPosition) => {
    applyRowPatch(userId, { position: normalizeCode(nextPosition) });
  };

  // 통합/유틸 직책(position_type) 변경
  const handleUtilMemberTypeChange = (userId, nextType) => {
    const normalizedType = normalizeCode(nextType);
    applyRowPatch(userId, {
      user_type: "4",
      department: "7",
      util_member_type: normalizedType,
      position: "",
      account_id: "",
      account_name: "",
    });
  };

  // 퇴사여부 변경
  const handleDelYnChange = (userId, nextValue) => {
    const nextUpper = asText(nextValue).toUpperCase();
    setRows((prev) => {
      const nextRows = prev.map((row) => {
        if (row.user_id !== userId) return row;
        const nextRow = { ...row, del_yn: nextUpper };
        nextRow.search_blob = buildSearchBlob(nextRow);
        return nextRow;
      });
      rowsRef.current = nextRows;
      return nextRows;
    });

    const originalValue = asText(originalRowsById[userId]?.orig_del_yn || "N").toUpperCase();
    setPendingDelYn((prev) => {
      const next = { ...prev };
      if (nextUpper === originalValue) {
        delete next[userId];
      } else {
        next[userId] = nextUpper;
      }
      return next;
    });
  };

  // 드롭다운이 있든 없든 동일 높이로 보이게 맞추는 본문 텍스트 기본 스타일
  const cellTextStyle = {
    fontFamily: TABLE_FONT_FAMILY,
    fontSize: `${TABLE_FONT_SIZE}px`,
    fontWeight: 400,
    lineHeight: "1.2",
    display: "inline-flex",
    alignItems: "center",
    minHeight: `${CELL_INNER_HEIGHT}px`,
  };

  const controlCellWrapStyle = {
    width: "100%",
    minHeight: `${CELL_INNER_HEIGHT}px`,
    height: `${CELL_INNER_HEIGHT}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
  };

  const makeCellTextStyle = (extra = {}) => ({
    ...cellTextStyle,
    ...extra,
  });

  // 아이디는 클릭 안내만 제공하고 편집은 막는다
  const handleReadonlyIdClick = () => {
    Swal.fire("안내", "아이디는 변경할 수 없습니다.", "info");
  };

  // 텍스트를 클릭하면 같은 자리에서 바로 수정되도록 contentEditable을 사용한다
  const renderEditableCell = (row, field, align = "left") => {
    const userId = row.user_id;
    const value = asText(row[field]);

    return (
      <span
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        style={{
          ...cellTextStyle,
          color: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: align === "center" ? "center" : "flex-start",
          textAlign: align,
          width: "100%",
          minHeight: `${CELL_INNER_HEIGHT}px`,
          height: `${CELL_INNER_HEIGHT}px`,
          margin: 0,
          padding: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          outline: "none",
          cursor: "text",
        }}
        onBlur={(e) => {
          const nextValue = asText(e.currentTarget.textContent);
          if (nextValue !== value) {
            handleTextFieldChange(userId, field, nextValue);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.textContent = value;
            e.currentTarget.blur();
          }
        }}
      >
        {value}
      </span>
    );
  };

  // 변경된 사용자 정보/퇴사여부를 DB에 저장
  const handleSaveChanges = async () => {
    // contentEditable 마지막 입력이 onBlur로 반영되도록 저장 전에 포커스를 해제
    const activeEl = document.activeElement;
    if (activeEl && typeof activeEl.blur === "function") {
      activeEl.blur();
      await wait(0);
    }

    const snapshotRows = rowsRef.current;
    const snapshotOriginals = originalRowsByIdRef.current;
    const profileRows = collectProfileChangedRows(snapshotRows, snapshotOriginals);
    const profileUserIds = profileRows.map((row) => row.user_id);
    const delEntries = collectDelEntriesFromRows(snapshotRows, snapshotOriginals);

    if (profileUserIds.length === 0 && delEntries.length === 0) {
      Swal.fire("알림", "변경 사항이 없습니다.", "info");
      return;
    }

    try {
      setSaving(true);
      Swal.fire({
        title: "저장 중...",
        text: "변경사항을 반영하고 있습니다.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      // 1) 사용자 기본정보 저장
      for (const row of profileRows) {
        const userId = row.user_id;

        const backup = await fetchUserInfoForSave(userId);
        const mergedRow = {
          ...backup,
          ...row,
          user_type:
            normalizeCode(row.user_type) ||
            normalizeCode(backup?.user_type) ||
            inferUserType(row),
          util_member_type:
            normalizeCode(row.util_member_type) ||
            normalizeCode(backup?.util_member_type) ||
            (normalizeCode(row.position) === "6" || normalizeCode(row.position) === "7"
              ? normalizeCode(row.position)
              : normalizeCode(backup?.position)),
          zipcode: asText(row.zipcode).trim() || asText(backup?.zipcode).trim(),
        };

        // 통합/유틸 사용자 저장 시 position_type(6/7)가 비어 있으면 안내 후 중단
        if (
          normalizeCode(mergedRow.user_type) === "4" &&
          !["6", "7"].includes(normalizeCode(mergedRow.util_member_type))
        ) {
          throw new Error(`통합/유틸 구분값을 선택해주세요. (${userId})`);
        }

        const payload = buildUserSavePayload(mergedRow);
        const res = await api.post("/User/UserRgt", payload);
        const code = parseApiCode(res.data);

        if (code && code !== "200") {
          throw new Error(
            `사용자 정보 저장 실패 (${userId})${res?.data?.message ? `: ${res.data.message}` : ""}`
          );
        }
      }

      // 2) 퇴사여부 저장
      for (const entry of delEntries) {
        const res = await api.post("/User/UserDelYnSave", entry);
        const code = parseApiCode(res.data);
        if (code && code !== "200") {
          throw new Error(
            `퇴사여부 저장 실패 (${entry.user_id})${res?.data?.msg ? `: ${res.data.msg}` : ""}`
          );
        }
      }

      const nextOriginals = {};
      snapshotRows.forEach((row) => {
        nextOriginals[row.user_id] = { ...row, orig_del_yn: asText(row.del_yn || "N").toUpperCase() };
      });
      setOriginalRowsById(nextOriginals);
      originalRowsByIdRef.current = nextOriginals;
      setPendingProfileChanges({});
      setPendingDelYn({});

      const messages = [];
      if (profileUserIds.length > 0) messages.push(`사용자 정보 ${profileUserIds.length}건`);
      if (delEntries.length > 0) messages.push(`퇴사여부 ${delEntries.length}건`);

      if (Swal.isVisible()) Swal.close();
      Swal.fire("저장 완료", `${messages.join(", ")} DB에 저장되었습니다.`, "success");
    } catch (err) {
      if (Swal.isVisible()) Swal.close();
      console.error("사용자 관리 저장 실패:", err);
      Swal.fire("저장 실패", err.message || "저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  // 컬럼 key 기준으로 셀 내용을 렌더링하는 함수
  const renderTableCellContent = (row, columnKey) => {
    // 1) 순번
    if (columnKey === "ui_index") {
      return (
        <span
          style={makeCellTextStyle({
            fontWeight: 500,
            color: "#555",
            width: "100%",
            justifyContent: "center",
          })}
        >
          {row.ui_index}
        </span>
      );
    }

    // 2) 아이디(클릭은 가능하지만 변경 불가 안내만 표시)
    if (columnKey === "user_id") {
      return (
        <span
          role="button"
          tabIndex={0}
          style={makeCellTextStyle({
            color: "#111",
            cursor: "not-allowed",
            textDecoration: "underline dotted",
            textUnderlineOffset: "3px",
            width: "100%",
            justifyContent: "center",
          })}
          onClick={handleReadonlyIdClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleReadonlyIdClick();
          }}
        >
          {row.user_id || "-"}
        </span>
      );
    }

    // 3) 일반 텍스트 편집 셀
    if (columnKey === "user_name") return renderEditableCell(row, "user_name", "center");
    if (columnKey === "password") return renderEditableCell(row, "password", "center");
    if (columnKey === "join_dt") return renderEditableCell(row, "join_dt", "center");
    if (columnKey === "birth_date") return renderEditableCell(row, "birth_date", "center");
    if (columnKey === "phone") return renderEditableCell(row, "phone", "center");
    if (columnKey === "address_full") return renderEditableCell(row, "address", "left");

    // 4) 부서/거래처 클릭 편집 셀
    if (columnKey === "dept_or_account") {
      if (normalizeCode(row.user_type) === "4") {
        return (
          <div style={controlCellWrapStyle}>
            <Select
              size="small"
              value="현장"
              disabled
              sx={{
                ...compactSelectSx,
                minWidth: 112,
                width: "100%",
              }}
            >
              <MenuItem value="현장">현장</MenuItem>
            </Select>
          </div>
        );
      }

      if (isCeo(row)) {
        return (
          <div style={controlCellWrapStyle}>
            <Select
              size="small"
              value="대표"
              disabled
              sx={{
                ...compactSelectSx,
                minWidth: 112,
                width: "100%",
              }}
            >
              <MenuItem value="대표">대표</MenuItem>
            </Select>
          </div>
        );
      }

      if (isHeadOffice(row)) {
        return (
          <div style={controlCellWrapStyle}>
            <Select
              size="small"
              value={normalizeCode(row.department)}
              onChange={(e) => {
                handleDepartmentChange(row.user_id, e.target.value);
              }}
              sx={{ ...compactSelectSx, minWidth: 112, width: "100%" }}
            >
              {HQ_DEPARTMENT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </div>
        );
      }

      const selected =
        accountOptionById.get(asText(row.account_id)) ||
        (row.account_id
          ? {
            account_id: asText(row.account_id),
            account_name: asText(row.account_name || row.account_id),
          }
          : null);

      if (editingAccountUserId !== row.user_id) {
        return (
          <div style={controlCellWrapStyle}>
            <span
              role="button"
              tabIndex={0}
              style={{
                ...makeCellTextStyle({
                  width: "100%",
                  justifyContent: "center",
                  backgroundColor: "#f3f5f7",
                  borderRadius: "4px",
                  height: `${CELL_INNER_HEIGHT}px`,
                  cursor: "pointer",
                  color: "#111",
                  padding: "0 8px",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }),
              }}
              onClick={() => {
                setEditingAccountUserId(row.user_id);
                fetchAccountOptions();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditingAccountUserId(row.user_id);
                  fetchAccountOptions();
                }
              }}
            >
              {asText(selected?.account_name || selected?.account_id || "-")}
            </span>
          </div>
        );
      }

      return (
        <div style={controlCellWrapStyle}>
          <Autocomplete
            size="small"
            disableClearable
            openOnFocus
            loading={accountOptionsLoading}
            onOpen={fetchAccountOptions}
            onClose={() => {
              setEditingAccountUserId("");
            }}
            options={accountOptions}
            value={selected}
            onChange={(_, next) => {
              handleAccountChange(row.user_id, next);
              setEditingAccountUserId("");
            }}
            autoHighlight
            blurOnSelect
            getOptionLabel={(option) => asText(option?.account_name)}
            isOptionEqualToValue={(option, value) =>
              asText(option?.account_id) === asText(value?.account_id)
            }
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="거래처 검색"
                size="small"
                autoFocus
              />
            )}
            sx={{
              width: "100%",
              margin: 0,
              "& .MuiOutlinedInput-notchedOutline": {
                border: "none !important",
              },
              "& .MuiInputBase-root": {
                minHeight: CELL_INNER_HEIGHT,
                height: CELL_INNER_HEIGHT,
                backgroundColor: "#f3f5f7",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                py: "0 !important",
                px: "8px !important",
                margin: 0,
              },
              "& .MuiInputBase-root.MuiOutlinedInput-root": {
                minHeight: `${CELL_INNER_HEIGHT}px !important`,
                height: `${CELL_INNER_HEIGHT}px !important`,
                paddingTop: "0 !important",
                paddingBottom: "0 !important",
                alignItems: "center !important",
              },
              "& .MuiInputBase-input": {
                fontSize: TABLE_FONT_SIZE,
                fontFamily: TABLE_FONT_FAMILY,
                lineHeight: `${CELL_INNER_HEIGHT}px !important`,
                height: `${CELL_INNER_HEIGHT}px !important`,
                py: "0 !important",
                px: "0 !important",
                textAlign: "center",
                boxSizing: "border-box",
                margin: "0 !important",
              },
              "& .MuiAutocomplete-inputRoot": {
                alignItems: "center !important",
                paddingTop: "0 !important",
                paddingBottom: "0 !important",
                minHeight: `${CELL_INNER_HEIGHT}px !important`,
                height: `${CELL_INNER_HEIGHT}px !important`,
              },
              "& .MuiAutocomplete-input": {
                lineHeight: `${CELL_INNER_HEIGHT}px !important`,
                height: `${CELL_INNER_HEIGHT}px !important`,
                paddingTop: "0 !important",
                paddingBottom: "0 !important",
                paddingLeft: "0 !important",
                paddingRight: "0 !important",
                margin: "0 !important",
                display: "flex",
                alignItems: "center",
              },
              "& input::placeholder": {
                textAlign: "center",
                opacity: 1,
              },
              "& .MuiAutocomplete-popupIndicator": {
                display: "none",
              },
              "& .MuiAutocomplete-clearIndicator": {
                display: "none",
              },
              "& .MuiAutocomplete-endAdornment": {
                display: "none",
              },
            }}
          />
        </div>
      );
    }

    // 5) 직책 클릭 편집 셀
    if (columnKey === "position_label") {
      if (normalizeCode(row.user_type) === "4") {
        return (
          <div style={controlCellWrapStyle}>
            <Select
              size="small"
              value={normalizeCode(row.util_member_type)}
              onChange={(e) => {
                handleUtilMemberTypeChange(row.user_id, e.target.value);
              }}
            sx={{
                ...compactSelectSx,
                minWidth: 88,
                width: "100%",
              }}
            >
              {UTIL_MEMBER_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </div>
        );
      }

      if (isCeo(row)) {
        return (
          <div style={controlCellWrapStyle}>
            <Select
              size="small"
              value="대표"
              disabled
              sx={{
                ...compactSelectSx,
                minWidth: 82,
                width: "100%",
              }}
            >
              <MenuItem value="대표">대표</MenuItem>
            </Select>
          </div>
        );
      }

      return (
        <div style={controlCellWrapStyle}>
          <Select
            size="small"
            value={normalizeCode(row.position)}
            onChange={(e) => {
              handlePositionChange(row.user_id, e.target.value);
            }}
            sx={{
              ...compactSelectSx,
              minWidth: 82,
              width: "100%",
            }}
          >
            {POSITION_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </div>
      );
    }

    // 6) 퇴사여부는 항상 드롭다운을 표시
    if (columnKey === "del_yn") {
      const userId = row.user_id;
      const currentValue = pendingDelYn[userId] ?? asText(row.del_yn || "N").toUpperCase();

      return (
        <div style={controlCellWrapStyle}>
          <Select
            key={`${userId}-${currentValue}`}
            size="small"
            value={currentValue}
            onChange={(e) => {
              handleDelYnChange(userId, e.target.value);
            }}
            sx={{
              ...compactSelectSx,
              minWidth: 76,
              width: "100%",
            }}
          >
            <MenuItem value="N">재직</MenuItem>
            <MenuItem value="Y">퇴사</MenuItem>
          </Select>
        </div>
      );
    }

    return (
      <span style={makeCellTextStyle({ width: "100%" })}>
        {asText(row[columnKey]) || "-"}
      </span>
    );
  };

  const filteredRows = useMemo(() => {
    const keyword = deferredSearchKeyword.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) => asText(row.search_blob).includes(keyword));
  }, [rows, deferredSearchKeyword]);

  const totalFilteredRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredRows / PAGE_SIZE));
  const maxPageButtons = 5;

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= maxPageButtons) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    const half = Math.floor(maxPageButtons / 2);
    let start = currentPage - half;
    let end = currentPage + half;

    if (start < 1) {
      end += 1 - start;
      start = 1;
    }
    if (end > totalPages) {
      start -= end - totalPages;
      end = totalPages;
    }
    start = Math.max(1, start);

    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchKeyword]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <DashboardLayout>
      {/* 상단 네비 */}
      <DashboardNavbar title="🧑‍🔧사용자 관리" />
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card sx={{ mt: 1 }}>
            <MDBox
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                backgroundColor: "#ffffff",
                borderBottom: "1px solid #eee",
              }}
            >
              <MDBox
                pt={1}
                pb={1}
                sx={{
                  display: "flex",
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  justifyContent: isMobile ? "flex-start" : "flex-end",
                  alignItems: "center",
                  gap: isMobile ? 1 : 2,
                }}
              >
                <MDBox sx={{ width: isMobile ? "100%" : "14rem", mr: isMobile ? 0 : 1 }}>
                  <MDInput
                    placeholder="필터 검색"
                    value={searchKeyword}
                    size="small"
                    fullWidth
                    onChange={({ currentTarget }) => setSearchKeyword(currentTarget.value)}
                  />
                </MDBox>
                <MDButton
                  size="medium"
                  variant="contained"
                  color="success"
                  onClick={fetchUsers}
                  disabled={loading}
                >
                  새로고침
                </MDButton>
                <MDButton
                  size="medium"
                  variant="contained"
                  color="info"
                  onClick={handleSaveChanges}
                  disabled={saving}
                  sx={{ mr: isMobile ? 0 : 1 }}
                >
                  저장
                </MDButton>
              </MDBox>
            </MDBox>
            {/* 작은 화면에서 테이블이 박스 밖으로 넘치지 않도록 내부 스크롤 처리 */}
            <MDBox px={2} pt={1.25} pb={1} sx={{ maxHeight: "88vh", overflow: "auto" }}>
              <>
                {isMobile ? (
                  // ✅ 모바일: 카드형 리스트
                  <MDBox display="flex" flexDirection="column" gap={1}>
                    {pagedRows.map((row) => (
                      <Card key={row.ui_index} sx={{ p: 1.5 }}>
                        <MDBox display="flex" justifyContent="space-between" gap={1}>
                          <MDBox>
                            <MDTypography variant="caption" color="#111" fontWeight="medium">
                              {row.user_name} ({row.user_id})
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {row.dept_or_account} · {row.position_label}
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {row.phone || "-"}
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {row.join_dt || "-"}
                            </MDTypography>
                          </MDBox>
                          <Select
                            size="small"
                            value={pendingDelYn[row.user_id] ?? row.del_yn}
                            onChange={(e) => handleDelYnChange(row.user_id, e.target.value)}
                            sx={{ ...compactSelectSx, minWidth: 84 }}
                          >
                            <MenuItem value="N">재직</MenuItem>
                            <MenuItem value="Y">퇴사</MenuItem>
                          </Select>
                        </MDBox>
                        <MDTypography variant="caption" color="text">
                          {row.address_full}
                        </MDTypography>
                      </Card>
                    ))}
                  </MDBox>
                ) : (
                  // 데스크톱: accountissuesheet2 톤으로 직접 테이블 렌더링
                  <MDBox sx={tableSx}>
                    <table>
                      <colgroup>
                        {TABLE_COLUMNS.map((col) => (
                          <col key={col.key} style={{ width: `${col.width}px` }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          {TABLE_COLUMNS.map((col) => (
                            <th key={col.key} style={{ minWidth: col.width, width: col.width }}>
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map((row) => (
                          <tr key={`${row.ui_index}_${row.user_id}`}>
                            {TABLE_COLUMNS.map((col) => (
                              <td
                                key={`${row.ui_index}_${col.key}`}
                                style={{
                                  minWidth: col.width,
                                  width: col.width,
                                  textAlign: col.align || "center",
                                  verticalAlign: "middle",
                                  paddingLeft: 4,
                                  paddingRight: 4,
                                  fontFamily: TABLE_FONT_FAMILY,
                                  fontSize: `${TABLE_FONT_SIZE}px`,
                                }}
                              >
                                {renderTableCellContent(row, col.key)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {pagedRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={TABLE_COLUMNS.length}
                              style={{
                                textAlign: "center",
                                padding: "10px",
                                fontFamily: TABLE_FONT_FAMILY,
                                fontSize: `${TABLE_FONT_SIZE}px`,
                              }}
                            >
                              데이터가 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </MDBox>
                )}
              </>
            </MDBox>
            <MDBox
              px={2}
              py={1}
              sx={{
                borderTop: "1px solid #eceff3",
                display: "flex",
                flexWrap: isMobile ? "wrap" : "nowrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <MDBox sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <MDBox
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr 32px",
                    alignItems: "center",
                    gap: 0.5,
                    width: isMobile ? "100%" : 220,
                  }}
                >
                  <MDButton
                    size="small"
                    variant="outlined"
                    color="dark"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    sx={{ minWidth: 32, px: 0 }}
                  >
                    {"<"}
                  </MDButton>
                  <MDBox sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                    {visiblePageNumbers.map((pageNum) => (
                      <MDButton
                        key={pageNum}
                        size="small"
                        variant={pageNum === currentPage ? "contained" : "outlined"}
                        color={pageNum === currentPage ? "info" : "dark"}
                        onClick={() => setCurrentPage(pageNum)}
                        sx={{ minWidth: 32, px: 0 }}
                      >
                        {pageNum}
                      </MDButton>
                    ))}
                  </MDBox>
                  <MDButton
                    size="small"
                    variant="outlined"
                    color="dark"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    sx={{ minWidth: 32, px: 0 }}
                  >
                    {">"}
                  </MDButton>
                </MDBox>
              </MDBox>
              <MDTypography variant="caption" color="text">
                총 {totalFilteredRows}건 - {currentPage}/{totalPages}페이지
              </MDTypography>
            </MDBox>
          </Card>
        </Grid>
      </Grid>
    </DashboardLayout>
  );
}

export default UserManagement;
