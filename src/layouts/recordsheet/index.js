/* eslint-disable react/prop-types */
import React, { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { useLocation, useParams } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import {
  Modal,
  Box,
  Select,
  MenuItem,
  Button,
  TextField,
  Checkbox,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import api from "api/api";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import useRecordsheetData from "./data/RecordSheetData";
import Swal from "sweetalert2";
import LoadingScreen from "layouts/loading/loadingscreen";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// 근무 타입별 배경색
const typeColors = {
  1: "#d9f2d9",
  2: "#fff7cc",
  3: "#e6d9f2",
  4: "#f9d9d9",
  5: "#ffe6cc",
  6: "#cce6ff",
  19: "#d9f2e6",
  16: "#DDAED3",
  17: "#9F8383",
};

const TYPE_LABEL = {
  0: "-",
  1: "영양사",
  2: "상용",
  3: "초과",
  17: "조기퇴근",
  4: "결근",
  5: "파출",
  6: "직원파출",
  7: "유틸",
  8: "대체근무",
  9: "연차",
  10: "반차",
  11: "대체휴무",
  12: "병가",
  13: "출산휴가",
  14: "육아휴직",
  15: "하계휴가",
  16: "업장휴무",
  18: "경조사",
  19: "통합",
};

const safeStr = (v, fallback = "") => (v == null ? fallback : String(v));
const safeTrim = (v, fallback = "") => safeStr(v, fallback).trim();

const isDispatchTypeValue = (v) => {
  const t = safeTrim(v, "");
  if (!t) return false;
  return t === "5" || t === "6" || t === "파출" || t === "직원파출";
};

const isEmployeeDispatchType = (v) => {
  const t = safeTrim(v, "");
  return t === "6" || t === "직원파출";
};

const getDispatchKeys = (row) => {
  if (!row) return [];
  const keys = [];
  const mid = safeTrim(row.member_id ?? row.memberId ?? "", "");
  if (mid) keys.push(String(mid));
  const name = safeTrim(row.name ?? "", "");
  if (name) keys.push(name);
  return keys;
};

const getDispatchStatFromMap = (map, row) => {
  if (!map || !row) return null;
  const keys = getDispatchKeys(row);
  for (const k of keys) {
    if (map.has(k)) return map.get(k);
  }
  return null;
};

const toNumberLike = (v) => {
  const s = String(v ?? "").replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// ✅ 은행명 추출
const extractBankName = (accountNumber) => {
  const s = safeTrim(accountNumber, "");
  if (!s) return "";

  const firstToken = s.split(/\s+/)[0] || "";
  const m = s.match(/^([A-Za-z가-힣]+(?:은행)?)/) || firstToken.match(/^([A-Za-z가-힣]+(?:은행)?)/);

  return safeTrim(m?.[1] ?? firstToken, "");
};

// ✅ 계좌번호만 추출
const extractAccountOnly = (accountNumber) => {
  const s = safeTrim(accountNumber, "");
  if (!s) return "";

  const bank = extractBankName(s);
  let rest = s;

  if (bank) {
    rest = rest.replace(new RegExp(`^\\s*${bank}\\s*`), "");
  }

  const only = rest.replace(/[^0-9-]/g, "").trim();
  if (!only) return s.replace(/[^0-9-]/g, "").trim();

  return only;
};

// ✅ 숫자/문자 모두 보기좋게
const formatMoneyLike = (v) => {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";

  if (/[가-힣]/.test(s) || /회/.test(s) || /원/.test(s)) return s;

  const n = Number(s.replace(/,/g, ""));
  if (!Number.isNaN(n)) return n.toLocaleString();

  return s;
};

const parseEmployeeDispatchInfo = (v) => {
  const s = safeTrim(v, "");
  if (!s) return { count: 0, amount: "", origin: "", dispatch: "" };

  let count = 0;
  const countMatch = s.match(/([0-9]+)\s*회/);
  if (countMatch) count = Number(countMatch[1]);

  let amount = "";
  const nums = s.match(/([0-9][0-9,]*)/g) || [];
  if (nums.length >= 2) {
    amount = toNumberLike(nums[nums.length - 1]);
  } else if (nums.length === 1 && /원/.test(s)) {
    const n = toNumberLike(nums[0]);
    if (!(countMatch && n === count)) amount = n;
  }

  let origin = "";
  let dispatch = "";
  const originMatch = s.match(
    /원\s*소\s*속\s*[:：]?\s*([^,\/>→]+?)(?=\s*(파견|직원파출|\d+\s*회|\d|$))/
  );
  if (originMatch) origin = originMatch[1].trim();
  const dispatchMatch = s.match(/파견(?:업장)?\s*[:：]?\s*([^,\/>→]+?)(?=\s*(\d+\s*회|\d|$))/);
  if (dispatchMatch) dispatch = dispatchMatch[1].trim();

  if (!origin || !dispatch) {
    const parts = s.split(/\s*(?:->|→|=>|>|\/)\s*/).filter(Boolean);
    if (parts.length >= 2) {
      if (!origin) origin = parts[0].trim();
      if (!dispatch) dispatch = parts[1].trim();
    }
  }

  return { count, amount, origin, dispatch };
};

// ✅ 숫자 변환 (엑셀용)
const toNumberMaybe = (v) => {
  if (v == null || v === "") return "";
  const cleaned = String(v)
    .replace(/[^0-9.-]/g, "")
    .trim();
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isNaN(n) ? "" : n;
};

// ✅ 셀 비교용 헬퍼
const normalizeCell = (cell) => {
  if (!cell) return { type: "", start: "", end: "", salary: 0, note: "", pay_yn: "N" };

  const toNum = (v) => {
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const payYn = safeTrim(cell.pay_yn ?? cell.payYn ?? "", "").toUpperCase() === "Y" ? "Y" : "N";

  return {
    type: cell.type ?? "",
    start: cell.start || cell.start_time || "",
    end: cell.end || cell.end_time || "",
    salary: toNum(cell.salary),
    note: cell.note ?? cell.note ?? "",
    pay_yn: payYn,
  };
};

const isCellEqual = (a, b) => {
  const na = normalizeCell(a);
  const nb = normalizeCell(b);
  return (
    na.type === nb.type &&
    na.start === nb.start &&
    na.end === nb.end &&
    na.salary === nb.salary &&
    na.note === nb.note &&
    na.pay_yn === nb.pay_yn
  );
};

// ✅ 출근현황 셀
const AttendanceCell = React.memo(function AttendanceCell({
  getValue,
  row,
  column,
  table,
  typeOptions,
}) {
  const isJoinLocked = Boolean(table.options.meta?.isCellLocked?.(row.original, column.id));
  const rawVal = getValue() || {};
  const val = {
    type: "",
    start: "",
    end: "",
    salary: "",
    note: "",
    pay_yn: "N",
    ...rawVal,
  };
  const isDispatchType = ["5", "6"].includes(String(val.type));
  const isPayableDispatch = String(val.type) === "5" || String(val.type) === "파출";

  const times = [];
  for (let h = 5; h <= 20; h++) {
    for (let m of ["00", "30"]) {
      if (h === 20 && m !== "00") continue;
      times.push(`${h.toString().padStart(2, "")}:${m}`);
    }
  }

  const bgColor = typeColors[val.type] || "#ffefd5";

  const parseTime = (str) => {
    if (!str) return null;
    const [h, m] = str.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return dayjs().hour(h).minute(m).second(0);
  };

  const handleChange = (field, newVal) => {
    if (isJoinLocked) return;
    const dayKey = column.id;

    const rowGubun = safeTrim(row.original?.gubun, "nor");
    const rowPt = safeTrim(row.original?.position_type, "");

    const baseValue = row.original?.[dayKey] || {};

    const updatedValue = {
      ...baseValue,
      ...val,

      // ✅ gubun/position_type 유지
      gubun: safeTrim(baseValue.gubun ?? val.gubun ?? rowGubun, "nor"),
      position_type: safeTrim(baseValue.position_type ?? val.position_type ?? rowPt, ""),

      [field]: newVal,
    };

    // ✅ type을 0/-로 내리면 나머지 초기화
    if (field === "type" && (newVal === "0" || newVal === "")) {
      updatedValue.start = "";
      updatedValue.end = "";
      updatedValue.start_time = "";
      updatedValue.end_time = "";
      updatedValue.salary = "";
      updatedValue.note = "";
      updatedValue.pay_yn = "N";
    }

    if (field === "type") {
      const nextType = String(newVal ?? "");
      const nextIsDispatch = ["5", "6"].includes(nextType);
      if (!nextIsDispatch) updatedValue.pay_yn = "N";
    }

    // 🔹 초과/조기퇴근 자동 계산 (note에 0.5 단위로 반영)
    if (
      (updatedValue.type === "3" || updatedValue.type === "17") &&
      updatedValue.start &&
      updatedValue.end &&
      (field === "start" || field === "end")
    ) {
      const start = parseTime(updatedValue.start);
      const end = parseTime(updatedValue.end);

      const org = table.options.meta?.getOrgTimes?.(row.original) || {};
      const baseStart = parseTime(org.org_start_time);
      const baseEnd = parseTime(org.org_end_time);

      if (start && end && baseStart && baseEnd) {
        const workedMinutes = end.diff(start, "minute");
        const baseMinutes = baseEnd.diff(baseStart, "minute");
        const diffMinutes = workedMinutes - baseMinutes; // 초과면 +, 조기퇴근이면 -

        // 30분 단위로 환산(0.5)
        const abs = Math.abs(diffMinutes);
        const units = Math.floor(abs / 60) + (abs % 60 >= 30 ? 0.5 : 0);

        if (updatedValue.type === "3") {
          // 초과: +일 때만 표시
          updatedValue.note = diffMinutes > 0 ? String(units) : "";
        } else if (updatedValue.type === "17") {
          // 조기퇴근: -일 때만 표시
          updatedValue.note = diffMinutes < 0 ? String(-units) : "";
        }
      }
    }

    table.options.meta?.updateData(row.index, dayKey, updatedValue);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        backgroundColor: bgColor,
        ...(isJoinLocked ? { backgroundColor: "#e0e0e0" } : {}),
        padding: "2px",
        borderRadius: "4px",
        width: "100%",
      }}
    >
      <select
        disabled={isJoinLocked}
        value={val.type}
        onChange={(e) => handleChange("type", e.target.value)}
        style={{
          fontSize: "0.75rem",
          textAlign: "center",
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
          display: "block",
        }}
      >
        {typeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {["1", "2", "3", "5", "6", "7", "8", "17", "19"].includes(val.type) && (
        <>
          <select
            disabled={isJoinLocked}
            value={val.start}
            onChange={(e) => handleChange("start", e.target.value)}
            style={{
              fontSize: "0.725rem",
              width: "100%",
              minWidth: 0,
              maxWidth: "100%",
              boxSizing: "border-box",
              display: "block",
            }}
          >
            <option value="">출근</option>
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            disabled={isJoinLocked}
            value={val.end}
            onChange={(e) => handleChange("end", e.target.value)}
            style={{
              fontSize: "0.725rem",
              width: "100%",
              minWidth: 0,
              maxWidth: "100%",
              boxSizing: "border-box",
              display: "block",
            }}
          >
            <option value="">퇴근</option>
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </>
      )}

      {isDispatchType && (
        <input
          disabled={isJoinLocked}
          type="text"
          placeholder="급여"
          value={val.salary != null && val.salary !== "" ? Number(val.salary).toLocaleString() : ""}
          onChange={(e) => handleChange("salary", e.target.value.replace(/[^0-9]/g, ""))}
          style={{
            fontSize: "0.725rem",
            textAlign: "center",
            border: "1px solid black",
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            display: "block",
          }}
        />
      )}

      {isPayableDispatch && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            fontSize: "0.7rem",
          }}
        >
          <input
            type="checkbox"
            disabled={isJoinLocked}
            checked={String(val.pay_yn ?? "N").toUpperCase() === "Y"}
            onChange={(e) => handleChange("pay_yn", e.target.checked ? "Y" : "N")}
          />
          지급
        </label>
      )}

      {["3", "11", "17"].includes(val.type) && (
        <input
          disabled={isJoinLocked}
          type="text"
          placeholder={val.type === "3" ? "초과" : val.type === "17" ? "조기퇴근" : "대체휴무"}
          value={val.note ?? ""}
          onChange={(e) => handleChange("note", e.target.value)}
          style={{
            fontSize: "0.725rem",
            textAlign: "center",
            border: "1px solid black",
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            display: "block",
          }}
        />
      )}
    </div>
  );
});

AttendanceCell.propTypes = {
  getValue: PropTypes.func.isRequired,
  row: PropTypes.object.isRequired,
  column: PropTypes.object.isRequired,
  table: PropTypes.object.isRequired,
  typeOptions: PropTypes.array.isRequired,
};

function ReadonlyCell({ getValue }) {
  return <span style={{ fontSize: "0.75rem" }}>{getValue() || ""}</span>;
}
ReadonlyCell.propTypes = { getValue: PropTypes.func.isRequired };

// =======================================================
// ✅ 파출 테이블 기능(원본스냅샷/변경감지/변경분만 저장/자동 재조회/레이스 방지)
// =======================================================

// ✅ _rid 안정적으로 부여 (조회 시에만 부여되므로, 편집 중 _rid가 바뀌지 않음)
const ensureDispatchRid = (row) => {
  if (!row) return row;
  if (row._rid) return row;

  const base = row.dispatch_id ?? row.dispatchId ?? row.id ?? row.member_id ?? row.memberId ?? "";
  if (base) return { ...row, _rid: String(base) };

  // base가 없으면 그래도 최대한 안정적으로(조회 기준) 구성
  const fallback = [row.account_id ?? "", row.name ?? "", row.rrn ?? "", row.account_number ?? ""]
    .filter(Boolean)
    .join("_");

  if (fallback) return { ...row, _rid: `DIS_${fallback}` };

  return { ...row, _rid: `DIS_${Date.now()}_${Math.random().toString(16).slice(2)}` };
};

const normalizeDispatchValue = (field, v) => {
  const s = String(v ?? "");
  // ✅ 파출정보 수정이력 비교 시 공백(스페이스)도 변경으로 인식
  //    (기존처럼 trim/공백제거를 하지 않고 원문 그대로 비교)
  if (field === "del_yn") return s.trim().toUpperCase();
  return s;
};

function DispatchEditableCell({ getValue, row, table, field }) {
  const value = getValue() ?? "";
  const rid = String(row?.original?._rid ?? "");

  const original = table.options.meta?.getOriginalDispatchValueByRid?.(rid, field) ?? "";
  const isChanged =
    normalizeDispatchValue(field, value) !== normalizeDispatchValue(field, original);

  const handleChange = (e) => {
    const newVal = e.target.value;
    table.options.meta?.updateDispatchByRid?.(rid, { [field]: newVal });
  };

  return (
    <input
      value={value}
      onChange={handleChange}
      style={{
        width: "100%",
        height: 20,
        boxSizing: "border-box",
        fontSize: "0.75rem",
        lineHeight: 1.1,
        textAlign: "center",
        border: "1px solid #ccc",
        borderRadius: 3,
        padding: "0 2px",
        background: "#fff",
        color: isChanged ? "red" : "black",
        fontWeight: isChanged ? 700 : 400,
      }}
    />
  );
}

DispatchEditableCell.propTypes = {
  getValue: PropTypes.func.isRequired,
  row: PropTypes.object.isRequired,
  table: PropTypes.object.isRequired,
  field: PropTypes.string.isRequired,
};

// ✅ 파출 삭제/복원 버튼 셀
function DispatchActionCell({ row, onToggle }) {
  const delYn = row.original?.del_yn ?? "N";
  const isDeleted = String(delYn).toUpperCase() === "Y";

  return (
    <MDButton
      size="small"
      variant="gradient"
      color={isDeleted ? "success" : "error"}
      onClick={() => onToggle(row.original)}
      sx={{
        minHeight: 20,
        height: 20,
        px: 0.75,
        py: 0,
        minWidth: 52,
        fontSize: "0.65rem",
        lineHeight: 1,
      }}
    >
      {isDeleted ? "복원" : "삭제"}
    </MDButton>
  );
}

function DispatchPayCell({ row, status, onToggle }) {
  const total = status?.total ?? 0;
  const paid = status?.paid ?? 0;
  const checked = total > 0 && paid === total;
  const indeterminate = total > 0 && paid > 0 && paid < total;
  const label = total === 0 ? "-" : checked ? "지급" : indeterminate ? "부분" : "미지급";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <Checkbox
        size="small"
        checked={checked}
        indeterminate={indeterminate}
        disabled={total === 0}
        onChange={(e) => onToggle(row.original?.member_id, e.target.checked)}
      />
      <span style={{ fontSize: "0.7rem" }}>{label}</span>
    </div>
  );
}

DispatchPayCell.propTypes = {
  row: PropTypes.object.isRequired,
  status: PropTypes.object,
  onToggle: PropTypes.func.isRequired,
};

function RecordSheet() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const [attendanceRows, setAttendanceRows] = useState([]);
  const [originalAttendanceRows, setOriginalAttendanceRows] = useState([]);
  const [defaultTimes, setDefaultTimes] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");

  const [dispatchDelFilter, setDispatchDelFilter] = useState("N");
  const [dispatchMappingRows, setDispatchMappingRows] = useState([]);
  const dispatchMappingReqSeqRef = useRef(0);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const account_name = queryParams.get("name"); // 유지

  const { account_id } = useParams();
  const daysInMonth = dayjs(`${year}-${month}`).daysInMonth();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [open, setOpen] = useState(false);
  const handleModalOpen = () => setOpen(true);

  const [excelDownloading, setExcelDownloading] = useState(false);
  const [excelRangeOpen, setExcelRangeOpen] = useState(false);
  const [excelRange, setExcelRange] = useState({ start: "", end: "" });

  const [payRangeOpen, setPayRangeOpen] = useState(false);
  const [payRange, setPayRange] = useState({ start: "", end: "" });
  const [payRangeLoading, setPayRangeLoading] = useState(false);
  const [payRangeRows, setPayRangeRows] = useState([]);
  const [payRangeSelected, setPayRangeSelected] = useState({});
  const payRangeRecordMapRef = useRef(new Map());

  // ✅ hook: dispatchRows는 여기서 쓰지 않고 "파출은 로컬 state + fetchDispatchOnly"로 통일
  const { memberRows, sheetRows, timesRows, accountList, fetchAllData, loading } =
    useRecordsheetData(selectedAccountId, year, month);

  const isCellLockedByActJoin = useCallback(
    (row, columnId) => {
      if (!row || !String(columnId || "").startsWith("day_")) return false;
      const gubun = safeTrim(row?.gubun ?? "", "").toLowerCase();
      if (gubun !== "rec") return false;

      const joinRaw = safeTrim(row?.act_join_dt ?? "", "");
      if (!joinRaw) return false;

      const joinDate = dayjs(joinRaw);
      if (!joinDate.isValid()) return false;

      const dayNum = Number(String(columnId).replace("day_", ""));
      if (!Number.isFinite(dayNum)) return false;

      const joinYear = joinDate.year();
      const joinMonth = joinDate.month() + 1;
      const joinDay = joinDate.date();

      if (year < joinYear || (year === joinYear && month < joinMonth)) return true;
      if (year > joinYear || (year === joinYear && month > joinMonth)) return false;
      return dayNum < joinDay;
    },
    [year, month]
  );

  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
    if (!q) return;
    const list = accountList || [];
    const qLower = q.toLowerCase();
    const exact = list.find((a) => String(a?.account_name || "").toLowerCase() === qLower);
    const partial =
      exact ||
      list.find((a) =>
        String(a?.account_name || "")
          .toLowerCase()
          .includes(qLower)
      );
    if (partial) {
      setSelectedAccountId(partial.account_id);
      setAccountInput(partial.account_name || q);
    }
  }, [accountInput, accountList]);

  // ✅ 로딩화면 없이 "직원정보 테이블"만 쓱 새로고침
  const [employeeRowsView, setEmployeeRowsView] = useState([]);
  useEffect(() => {
    setEmployeeRowsView(Array.isArray(memberRows) ? memberRows : []);
  }, [memberRows]);

  // =========================
  // ✅ 1) payload 안전 처리 (문자열 JSON 파싱까지)
  // =========================
  const parseMaybeJson = (payload) => {
    if (typeof payload !== "string") return payload;
    const s = payload.trim();
    if (!s) return payload;
    if (!(s.startsWith("{") || s.startsWith("["))) return payload;
    try {
      return JSON.parse(s);
    } catch {
      return payload;
    }
  };

  const extractArray = (payload) => {
    payload = parseMaybeJson(payload);

    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    if (Array.isArray(payload.resultList)) return payload.resultList;
    if (Array.isArray(payload.result)) return payload.result;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.list)) return payload.list;
    if (Array.isArray(payload.rows)) return payload.rows;

    if (payload.data && typeof payload.data === "object") {
      if (Array.isArray(payload.data.resultList)) return payload.data.resultList;
      if (Array.isArray(payload.data.list)) return payload.data.list;
      if (Array.isArray(payload.data.rows)) return payload.data.rows;
      if (Array.isArray(payload.data.data)) return payload.data.data;
    }

    const v1 = Object.values(payload).find(Array.isArray);
    if (v1) return v1;

    if (payload.data && typeof payload.data === "object") {
      const v2 = Object.values(payload.data).find(Array.isArray);
      if (v2) return v2;
    }

    return [];
  };

  const openExcelRangeModal = () => {
    const hasAttendanceChanges = (() => {
      if (!attendanceRows || attendanceRows.length === 0) return false;
      const useDiffMode =
        originalAttendanceRows && originalAttendanceRows.length === attendanceRows.length;
      if (!useDiffMode) return true;
      for (let i = 0; i < attendanceRows.length; i += 1) {
        const row = attendanceRows[i];
        const originalRow = originalAttendanceRows[i];
        if (!originalRow) return true;
        const dayKeys = Object.keys(row || {}).filter((k) => k.startsWith("day_"));
        for (const key of dayKeys) {
          if (!isCellEqual(row?.[key], originalRow?.[key])) return true;
        }
      }
      return false;
    })();

    const hasDispatchChanges = (() => {
      if (!dispatchRows || dispatchRows.length === 0) return false;
      const editableFields = ["phone", "rrn", "account_number"];
      return (dispatchRows || []).some((row) => {
        const rid = String(row?._rid ?? "");
        const original = originalDispatchMap.get(rid);
        if (!original) return true;
        return editableFields.some((f) => {
          const cur = normalizeDispatchValue(f, row?.[f]);
          const org = normalizeDispatchValue(f, original?.[f]);
          return cur !== org;
        });
      });
    })();

    if (hasAttendanceChanges || hasDispatchChanges) {
      Swal.fire({
        title: "안내",
        html: "변경된 내용이 있습니다.<br/>저장 후에 전체 거래처 엑셀을 다운로드 해주세요.",
        icon: "info",
      });
      return;
    }

    const start = dayjs(`${year}-${String(month).padStart(2, "0")}-01`).format("YYYY-MM-DD");
    const end = dayjs(`${year}-${String(month).padStart(2, "0")}-${daysInMonth}`).format(
      "YYYY-MM-DD"
    );
    setExcelRange({ start, end });
    setExcelRangeOpen(true);
  };

  const handleExcelRangeConfirm = async () => {
    const start = dayjs(excelRange.start);
    const end = dayjs(excelRange.end);

    if (!start.isValid() || !end.isValid()) {
      Swal.fire("기간 오류", "시작일/종료일을 올바르게 선택하세요.", "warning");
      return;
    }

    setExcelRangeOpen(false);
    await handleExcelDownloadAllAccounts();
  };

  const openPayRangeModal = () => {
    const start = dayjs(`${year}-${String(month).padStart(2, "0")}-01`).format("YYYY-MM-DD");
    const end = dayjs(`${year}-${String(month).padStart(2, "0")}-${daysInMonth}`).format(
      "YYYY-MM-DD"
    );
    setPayRange({ start, end });
    setPayRangeRows([]);
    setPayRangeSelected({});
    payRangeRecordMapRef.current = new Map();
    setPayRangeOpen(true);
  };

  const handlePayRangeCompute = async () => {
    if (!selectedAccountId) {
      Swal.fire("거래처 선택", "먼저 거래처를 선택해주세요.", "warning");
      return;
    }

    const start = dayjs(payRange.start);
    const end = dayjs(payRange.end);

    if (!start.isValid() || !end.isValid()) {
      Swal.fire("기간 오류", "시작일/종료일을 올바르게 선택하세요.", "warning");
      return;
    }

    setPayRangeLoading(true);
    try {
      const realStart = start.isBefore(end) ? start.startOf("day") : end.startOf("day");
      const realEnd = start.isBefore(end) ? end.startOf("day") : start.startOf("day");

      const monthsInRange = [];
      let cursor = realStart.startOf("month");
      const endCursor = realEnd.startOf("month");
      while (cursor.isBefore(endCursor) || cursor.isSame(endCursor)) {
        monthsInRange.push({ y: cursor.year(), m: cursor.month() + 1 });
        cursor = cursor.add(1, "month");
      }

      const sumMap = new Map();
      const infoMap = new Map();
      const recordMap = new Map();
      const seenKeys = new Set();

      for (let mi = 0; mi < monthsInRange.length; mi++) {
        const { y, m } = monthsInRange[mi];
        const daysInThisMonth = dayjs(`${y}-${String(m).padStart(2, "0")}-01`).daysInMonth();

        const { sheetRowsArg, dispatchRowsArg } = await fetchBundleForAccount(
          selectedAccountId,
          y,
          m
        );

        (dispatchRowsArg || []).forEach((d) => {
          const mid = d.member_id;
          if (!mid) return;
          if (!infoMap.has(mid)) {
            infoMap.set(mid, {
              member_id: mid,
              name: d.name || "",
              phone: d.phone || "",
              rrn: d.rrn || "",
              account_number: d.account_number || "",
            });
          }
        });

        const monthStart = dayjs(`${y}-${String(m).padStart(2, "0")}-01`);
        const monthEnd = monthStart.endOf("month");
        const startInMonth =
          (realStart.isAfter(monthStart) || realStart.isSame(monthStart, "day")) &&
          (realStart.isBefore(monthEnd) || realStart.isSame(monthEnd, "day"));
        const endInMonth =
          (realEnd.isAfter(monthStart) || realEnd.isSame(monthStart, "day")) &&
          (realEnd.isBefore(monthEnd) || realEnd.isSame(monthEnd, "day"));

        const fromDay = startInMonth ? realStart.date() : realStart.isAfter(monthEnd) ? null : 1;
        const toDay = endInMonth
          ? realEnd.date()
          : realEnd.isBefore(monthStart)
          ? null
          : daysInThisMonth;

        if (fromDay == null || toDay == null) continue;

        (sheetRowsArg || []).forEach((r) => {
          const dayNum = toDayNumber(r?.record_date ?? r?.record_day ?? r?.day ?? r?.date);
          if (!(dayNum >= fromDay && dayNum <= toDay)) return;
          const g = safeTrim(r?.gubun ?? "", "").toLowerCase();
          if (g !== "dis") return;

          const mid = r?.member_id;
          if (!mid) return;

          const t = String(r?.type ?? "");
          const isDispatch = t === "5" || t === "6";
          if (!isDispatch) return;

          const dedupeKey = getDispatchDedupKey(r, y, m, dayNum, t);
          if (seenKeys.has(dedupeKey)) return;
          seenKeys.add(dedupeKey);

          const sal = Number(String(r?.salary ?? 0).replace(/,/g, "")) || 0;
          const payYn = String(r?.pay_yn ?? "").toUpperCase() === "Y";

          const cur = sumMap.get(mid) || {
            member_id: mid,
            name: r?.name || infoMap.get(mid)?.name || "",
            total_pay: 0,
            paid_cnt: 0,
            total_cnt: 0,
          };
          cur.total_pay += sal;
          cur.total_cnt += 1;
          if (payYn) cur.paid_cnt += 1;
          sumMap.set(mid, cur);

          const recordObj = {
            gubun: "dis",
            account_id: r?.account_id || selectedAccountId,
            member_id: mid,
            position_type: safeTrim(r?.position_type ?? "", ""),
            positionType: safeTrim(r?.position_type ?? "", ""),
            record_date: dayNum,
            record_year: r?.record_year ?? y,
            record_month: r?.record_month ?? m,
            type: Number(safeTrim(t, "0")) || 0,
            start_time: r?.start_time || "",
            end_time: r?.end_time || "",
            salary: sal,
            note: r?.note ?? "",
            pay_yn: "Y",
            position: r?.position || "",
          };

          if (!recordMap.has(mid)) recordMap.set(mid, []);
          recordMap.get(mid).push(recordObj);
        });
      }

      const rows = Array.from(sumMap.values())
        .map((r) => {
          const info = infoMap.get(r.member_id) || {};
          const totalCnt = Number(r.total_cnt || 0);
          const paidCnt = Number(r.paid_cnt || 0);
          const payStatus =
            totalCnt > 0
              ? paidCnt === totalCnt
                ? "지급"
                : paidCnt === 0
                ? "미지급"
                : "부분"
              : "-";

          return {
            ...info,
            ...r,
            pay_status: payStatus,
          };
        })
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

      setPayRangeRows(rows);
      setPayRangeSelected(
        rows.reduce((acc, r) => {
          acc[r.member_id] = false;
          return acc;
        }, {})
      );
      payRangeRecordMapRef.current = recordMap;
    } catch (e) {
      console.error(e);
      Swal.fire("오류", e?.message || "기간 합계 계산 중 오류", "error");
    } finally {
      setPayRangeLoading(false);
    }
  };

  const handlePayRangeApply = async () => {
    const selectedIds = Object.keys(payRangeSelected || {}).filter((k) => payRangeSelected[k]);
    if (!selectedIds.length) {
      Swal.fire("선택 필요", "지급 처리할 인원을 선택하세요.", "warning");
      return;
    }

    const disRecords = [];
    selectedIds.forEach((mid) => {
      const list = payRangeRecordMapRef.current.get(mid) || [];
      list.forEach((r) => disRecords.push({ ...r, pay_yn: "Y" }));
    });

    if (!disRecords.length) {
      Swal.fire("안내", "지급 처리할 데이터가 없습니다.", "info");
      return;
    }

    try {
      const res = await api.post("/Account/AccountRecordSave", {
        normalRecords: [],
        disRecords,
        recRecords: [],
      });

      if (res?.data?.code && res.data.code !== 200) {
        throw new Error(res.data?.message || "지급 처리 실패");
      }

      // ✅ 현재 화면 월 데이터만 갱신
      await Promise.all([fetchAllData?.(), fetchDispatchOnly(dispatchDelFilter)]);

      await Swal.fire({ title: "지급 처리", text: "선택 인원 지급 처리 완료", icon: "success" });

      // ✅ 확인 후 모달 닫고 출근부로 복귀
      setPayRangeOpen(false);
      setPayRangeRows([]);
      setPayRangeSelected({});
      payRangeRecordMapRef.current = new Map();
    } catch (e) {
      console.error(e);
      Swal.fire("오류", e?.message || "지급 처리 중 오류", "error");
    }
  };

  // ✅ 유형 키가 여러 이름으로 올 수 있어 통일
  const pickType = (src) =>
    safeTrim(
      src?.type ??
        src?.record_type ??
        src?.work_type ??
        src?.recordType ??
        src?.workType ??
        src?.work_kind ??
        src?.work_cd ??
        "",
      ""
    );

  const toDayNumber = (v) => {
    if (v == null) return NaN;
    if (typeof v === "number") return v;
    const s = String(v).trim();
    if (!s) return NaN;
    // 날짜 문자열(연-월-일 형식, 시간 포함)
    const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})([T\s].*)?$/);
    if (m) return Number(m[3]);
    // 날짜 문자열(연월일 8자리)
    if (/^\d{8}$/.test(s)) return Number(s.slice(6, 8));
    // 문자열 안에 연-월-일 패턴이 있으면 사용
    const m2 = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m2) return Number(m2[3]);
    // 마지막 숫자 chunk 사용 (예: "2026-02-24 00:00:00.0")
    const m3 = s.match(/(\d{1,2})(?!.*\d)/);
    if (m3) return Number(m3[1]);
    const n = Number(s);
    return Number.isNaN(n) ? NaN : n;
  };

  const getDispatchDedupKey = (r, y, m, dayNum, t) => {
    const id =
      r?.record_id ??
      r?.recordId ??
      r?.record_seq ??
      r?.recordSeq ??
      r?.id ??
      r?.seq ??
      r?.idx ??
      "";
    const idStr = safeTrim(id, "");
    if (idStr) return `id_${idStr}`;

    const mid = safeTrim(r?.member_id ?? r?.memberId ?? "", "");
    const start = safeTrim(r?.start_time ?? r?.start ?? "", "");
    const end = safeTrim(r?.end_time ?? r?.end ?? "", "");
    const sal = safeTrim(r?.salary ?? "", "");
    return `${mid}_${y}_${m}_${dayNum}_${t}_${start}_${end}_${sal}`;
  };

  // =========================
  // ✅ 2) day 소스 찾기 (pivot/obj/arr)
  // =========================
  const getDaySource = (item, d) => {
    if (!item) return null;
    const key = `day_${d}`;

    if (item[key]) return item[key];

    if (item.days && typeof item.days === "object" && !Array.isArray(item.days)) {
      if (item.days[key]) return item.days[key];
      if (item.days[d]) return item.days[d];
    }

    if (Array.isArray(item.days)) {
      const found =
        item.days.find((x) => toDayNumber(x?.record_date) === d) ||
        item.days.find((x) => toDayNumber(x?.record_day) === d) ||
        item.days.find((x) => toDayNumber(x?.day) === d) ||
        item.days.find((x) => toDayNumber(x?.date) === d);
      if (found) return found;
    }

    const key2 = `day_${String(d).padStart(2, "0")}`;
    if (item[key2]) return item[key2];
    if (item.days && typeof item.days === "object" && item.days[key2]) return item.days[key2];

    return null;
  };

  // =========================
  // ✅ 3) long 형태를 pivot 형태로 변환
  // =========================
  const normalizeSheetRows = (rows, daysInMonthArg) => {
    const arr = Array.isArray(rows) ? rows : [];
    if (arr.length === 0) return [];

    const sample = arr[0] || {};
    const keys = Object.keys(sample);

    const hasPivotDayKey = keys.some((k) => /^day_\d+$/.test(k));
    const hasDaysField = arr.some(
      (r) => r?.days && typeof r.days === "object" && !Array.isArray(r.days)
    );
    if (hasPivotDayKey || hasDaysField) return arr;

    const hasLongDay = arr.some(
      (r) => r?.record_date != null || r?.record_day != null || r?.day != null || r?.date != null
    );

    if (!hasLongDay) return arr;

    const map = new Map();

    for (const r of arr) {
      const mid = r.member_id;
      if (!mid) continue;

      if (!map.has(mid)) {
        map.set(mid, {
          name: r.name,
          account_id: r.account_id,
          member_id: r.member_id,
          position: r.position || "",
          del_yn: r.del_yn ?? "",
          act_join_dt: safeTrim(r.act_join_dt ?? "", ""),
          gubun: r.gubun ?? "nor",
          position_type: r.position_type ?? "",
          day_default: r.day_default || null,
        });
      }

      const g = map.get(mid);
      const dayNum = toDayNumber(r.record_date ?? r.record_day ?? r.day ?? r.date);

      if (dayNum >= 1 && dayNum <= daysInMonthArg) {
        g[`day_${dayNum}`] = { ...r };
      }
    }

    return Array.from(map.values());
  };

  // =========================
  // ✅ 4) sheetRows -> attendanceRows
  // =========================
  const buildAttendanceRowsFromSheet = (
    sheetRowsArg,
    memberRowsArg,
    timesRowsArg,
    daysInMonthArg
  ) => {
    const normalizedSheetRows = normalizeSheetRows(sheetRowsArg, daysInMonthArg);

    const parseEmployDispatchAmount = (v) => {
      if (v == null || v === "") return "";
      const s = String(v);
      const matches = s.match(/([0-9][0-9,]*)/g);
      if (!matches || matches.length === 0) return "";
      const last = matches[matches.length - 1];
      const n = Number(String(last).replace(/,/g, ""));
      return Number.isNaN(n) ? "" : n;
    };

    const memberDispatchAmountMap = new Map();
    (memberRowsArg || []).forEach((m) => {
      const mid = m?.member_id;
      if (!mid) return;
      const amt = parseEmployDispatchAmount(m?.employ_dispatch);
      if (amt !== "") memberDispatchAmountMap.set(String(mid), amt);
    });

    // ✅ member_id 기준 중복 제거 (동명이인/중복 row 병합)
    const isEmptyDay = (v) => {
      if (!v) return true;
      const t = safeTrim(v.type ?? "", "");
      const s = safeTrim(v.start_time ?? v.start ?? "", "");
      const e = safeTrim(v.end_time ?? v.end ?? "", "");
      const sal = safeTrim(v.salary ?? "", "");
      const note = safeTrim(v.note ?? v.note ?? "", "");
      return !t && !s && !e && !sal && !note;
    };

    const dedupedRows = (() => {
      const map = new Map();
      const passthrough = [];

      (normalizedSheetRows || []).forEach((item) => {
        const mid = item?.member_id;
        if (!mid) {
          passthrough.push(item);
          return;
        }

        if (!map.has(mid)) {
          map.set(mid, { ...item });
          return;
        }

        const target = map.get(mid);
        for (let d = 1; d <= daysInMonthArg; d++) {
          const key = `day_${d}`;
          const curr = target[key];
          const next = item[key];
          if (isEmptyDay(curr) && !isEmptyDay(next)) {
            target[key] = next;
          }
        }

        if (!target.day_default && item.day_default) target.day_default = item.day_default;
        if (!target.position && item.position) target.position = item.position;
        if (!target.position_type && item.position_type) target.position_type = item.position_type;
        if (!target.gubun && item.gubun) target.gubun = item.gubun;
        if (!target.act_join_dt && item.act_join_dt) target.act_join_dt = item.act_join_dt;
      });

      return [...map.values(), ...passthrough];
    })();

    const newAttendance = (dedupedRows || []).map((item) => {
      const member = (memberRowsArg || []).find((m) => m.member_id === item.member_id);

      const baseGubun = safeTrim(item.gubun ?? item.day_default?.gubun, "nor");
      const basePt = safeTrim(item.position_type ?? item.day_default?.position_type, "");

      const base = {
        name: item.name,
        account_id: item.account_id,
        member_id: item.member_id,
        position: item.position || member?.position || "",
        del_yn: item.del_yn ?? member?.del_yn ?? "",
        act_join_dt: safeTrim(item.act_join_dt ?? member?.act_join_dt ?? "", ""),
        gubun: baseGubun,
        position_type: basePt,
        day_default: item.day_default || null,
      };

      const dayEntries = {};
      for (let d = 1; d <= daysInMonthArg; d++) {
        const key = `day_${d}`;
        const source = getDaySource(item, d) || item[key] || null;

        const t = pickType(source);
        // const memberDispatchAmount = memberDispatchAmountMap.get(String(item.member_id)) ?? "";
        // const isEmployeeDispatch = String(t) === "6" || String(t) === "직원파출";

        dayEntries[key] = source
          ? {
              ...source,
              type: t,
              gubun: safeTrim(source.gubun, baseGubun),
              position_type: safeTrim(source.position_type, basePt),
              start: source.start_time || source.start || "",
              end: source.end_time || source.end || "",
              start_time: source.start_time || "",
              end_time: source.end_time || "",
              salary: source.salary || "",
              note: source.note ?? source.note ?? "",
              pay_yn:
                safeTrim(source.pay_yn ?? source.payYn ?? "", "").toUpperCase() === "Y" ? "Y" : "N",
            }
          : {
              account_id: item.account_id,
              member_id: item.member_id,
              gubun: baseGubun,
              position_type: basePt,
              type: "",
              start: "",
              end: "",
              start_time: "",
              end_time: "",
              salary: "",
              note: "",
              pay_yn: "N",
            };
      }

      return { ...base, ...dayEntries };
    });

    const defaultTimesMap = {};
    (normalizedSheetRows || []).forEach((item) => {
      defaultTimesMap[item.member_id] = {
        start:
          item.day_default?.start_time ||
          (timesRowsArg || []).find((t) => t.member_id === item.member_id)?.start_time ||
          "",
        end:
          item.day_default?.end_time ||
          (timesRowsArg || []).find((t) => t.member_id === item.member_id)?.end_time ||
          "",
      };
    });

    return { attendanceRowsBuilt: newAttendance, defaultTimesMap };
  };

  // ✅ 거래처 1개에 대한 모든 데이터 조회 (엑셀 전체다운용)
  const fetchBundleForAccount = async (accountId, y, m) => {
    const sheetRes = await api.get("/Account/AccountRecordSheetList", {
      params: { account_id: accountId, year: y, month: m },
    });
    const sheetRowsArg = extractArray(sheetRes.data);

    const memberRes = await api.get("/Account/AccountRecordMemberList", {
      params: { account_id: accountId, year: y, month: m },
    });
    const memberRowsArg = extractArray(memberRes.data);

    const timeRes = await api.get("/Account/AccountMemberRecordTime", {
      params: { account_id: accountId, year: y, month: m },
    });
    const timesRowsArg = extractArray(timeRes.data);

    const [disN, disY] = await Promise.all([
      api.get("/Account/AccountRecordDispatchList", {
        params: { account_id: accountId, year: y, month: m, del_yn: "N" },
      }),
      api.get("/Account/AccountRecordDispatchList", {
        params: { account_id: accountId, year: y, month: m, del_yn: "Y" },
      }),
    ]);

    const dispatchN = extractArray(disN.data);
    const dispatchY = extractArray(disY.data);
    const dispatchRowsArg = [
      ...(Array.isArray(dispatchN) ? dispatchN : []),
      ...(Array.isArray(dispatchY) ? dispatchY : []),
    ];

    return { sheetRowsArg, memberRowsArg, timesRowsArg, dispatchRowsArg };
  };

  // ✅ 엑셀 셀 출력 (4행 분리용)
  function splitDayCell(cell) {
    if (!cell) return ["", "", "", ""];

    // 문자열로 내려오는 경우 (이미 포맷된 셀) 처리
    if (typeof cell === "string") {
      const s = cell.trim();
      if (!s) return ["", "", "", ""];

      const lines = s
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      let typeLabel = lines[0] || "";
      let start = "";
      let end = "";
      let salary = "";

      // 2번째 줄에 시간 (예: 6:00~18:00 / 6:00-18:00)
      const timeLine = lines.find((l) => /~|-/.test(l)) || "";
      if (timeLine) {
        const m = timeLine.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
        if (m) {
          start = m[1];
          end = m[2];
        }
      }

      // 급여 라인
      const salaryLine = lines.find((l) => l.includes("급여")) || "";
      if (salaryLine) {
        const m = salaryLine.match(/급여[:\s]*([0-9,]+)/);
        if (m) salary = m[1];
      }

      return [typeLabel, start, end, salary];
    }

    const t = safeTrim(cell?.type, "");
    if (!t || t === "0") return ["", "", "", ""];

    const typeLabel = TYPE_LABEL[String(t)] ?? String(t);
    const start = cell.start || cell.start_time || "";
    const end = cell.end || cell.end_time || "";

    const salaryRaw = cell.salary != null && String(cell.salary).trim() !== "" ? cell.salary : "";
    const isDispatchType = String(t) === "5" || String(t) === "6";
    const payYn = String(cell?.pay_yn ?? "").toUpperCase() === "Y";
    const salary = isDispatchType ? formatMoneyLike(salaryRaw) : "";
    const salaryOut = salary && payYn ? `${salary} (지급)` : salary;

    return [typeLabel, start || "", end || "", salaryOut || ""];
  }

  // ✅ 출근현황(전체)용: 지급 표기 없이 급여 숫자만
  function splitDayCellAttend(cell) {
    if (!cell) return ["", "", "", ""];

    const t = safeTrim(cell?.type, "");
    if (!t || t === "0") return ["", "", "", ""];

    const typeLabel = TYPE_LABEL[String(t)] ?? String(t);
    const start = cell.start || cell.start_time || "";
    const end = cell.end || cell.end_time || "";

    const salaryRaw = cell.salary != null && String(cell.salary).trim() !== "" ? cell.salary : "";
    const noteRaw = cell.note != null && String(cell.note).trim() !== "" ? cell.note : "";
    const isDispatchType = String(t) === "5" || String(t) === "6";
    // ✅ 파출은 salary, 초과/조기퇴근/대체휴무 등은 note 값을 4번째 줄에 반영
    let bottomValue = "";
    if (isDispatchType) {
      bottomValue = toNumberMaybe(salaryRaw);
    } else if (noteRaw !== "") {
      bottomValue = toNumberMaybe(noteRaw);
    } else if (salaryRaw !== "") {
      bottomValue = toNumberMaybe(salaryRaw);
    }

    return [typeLabel, start || "", end || "", bottomValue];
  }

  const EXCEL_ATTENDANCE_COLOR_TYPES = new Set(["3", "4", "5", "6", "16", "17", "19"]);
  const getExcelAttendanceFillArgb = (type) => {
    const key = safeTrim(type, "");
    if (!EXCEL_ATTENDANCE_COLOR_TYPES.has(key)) return "";
    const hex = String(typeColors[key] || "").trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) return "";
    const raw = hex.startsWith("#") ? hex.slice(1) : hex;
    return `FF${raw.toUpperCase()}`;
  };

  // ✅ 거래처 전체 엑셀 다운로드
  const handleExcelDownloadAllAccounts = async () => {
    if (excelDownloading) return;
    if (!accountList || accountList.length === 0) return;

    setExcelDownloading(true);

    try {
      Swal.fire({
        title: "엑셀 생성 중...",
        text: "거래처별 데이터를 조회하고 있습니다.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = "RecordSheet";

      const rangeStart = excelRange?.start ? dayjs(excelRange.start) : null;
      const rangeEnd = excelRange?.end ? dayjs(excelRange.end) : null;
      const validStart = rangeStart && rangeStart.isValid();
      const validEnd = rangeEnd && rangeEnd.isValid();
      if (!validStart || !validEnd) {
        Swal.fire("기간 오류", "시작일/종료일을 올바르게 선택하세요.", "warning");
        return;
      }

      const startDate = rangeStart.startOf("day");
      const endDate = rangeEnd.startOf("day");
      const realStart = startDate.isBefore(endDate) ? startDate : endDate;
      const realEnd = startDate.isBefore(endDate) ? endDate : startDate;
      const rangeLabel = `${realStart.format("YYYY-MM-DD")} ~ ${realEnd.format("YYYY-MM-DD")}`;

      const filename = `출근부_전체거래처_${rangeLabel}.xlsx`;

      const accountNameMap = new Map(
        (accountList || []).map((a) => [String(a.account_id), safeTrim(a.account_name ?? "", "")])
      );

      const wsAttend = wb.addWorksheet("출근현황");
      const wsAttendSummary = wb.addWorksheet("출근현황요약");
      const wsDispatch = wb.addWorksheet("파출정보");
      const wsDispatchSummary = wb.addWorksheet("파출정보 요약");

      const addSectionTitle = (ws, title, colCount) => {
        ws.addRow([title]);
        const r = ws.lastRow.number;
        ws.mergeCells(r, 1, r, colCount);
        const cell = ws.getCell(r, 1);
        cell.font = { bold: true, size: 12 };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        ws.getRow(r).height = 20;
      };

      const styleHeaderRow = (ws, rowNum) => {
        const row = ws.getRow(rowNum);
        row.font = { bold: true };
        row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0F0F0" },
          };
        });
      };

      const styleDataRow = (ws, rowNum) => {
        const row = ws.getRow(rowNum);
        row.alignment = { vertical: "top", horizontal: "left", wrapText: true };
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      };

      const monthsInRange = [];
      let cursor = realStart.startOf("month");
      const endCursor = realEnd.startOf("month");
      while (cursor.isBefore(endCursor) || cursor.isSame(endCursor)) {
        monthsInRange.push({ y: cursor.year(), m: cursor.month() + 1 });
        cursor = cursor.add(1, "month");
      }

      const dateList = [];
      let dcur = realStart.clone();
      while (dcur.isBefore(realEnd) || dcur.isSame(realEnd, "day")) {
        dateList.push(dcur.clone());
        dcur = dcur.add(1, "day");
      }

      const attendColCount = 1 + dateList.length;
      const attendRightHeader = [
        "업장",
        "직원명",
        "직책",
        "근로일수",
        "직원파출",
        "초과",
        "결근",
        "비고",
      ];
      const attendRightWidths = [
        24, // 업장
        18, // 직원명
        12, // 직책
        25, // 근로일수
        35, // 직원파출
        15, // 초과
        15, // 결근
        50, // 비고
      ];
      const dispatchRightHeader = [
        "업장",
        "직원명",
        "주민등록번호",
        "계좌번호",
        "파출횟수",
        "파출비",
        "파출비소계",
        "비고",
      ];
      const dispatchRightWidths = [
        14, // 업장
        12, // 직원명
        18, // 주민등록번호
        28, // 계좌번호
        12, // 파출횟수
        18, // 파출비
        18, // 파출비소계
        40, // 비고
      ];

      wsAttend.columns = [
        { width: 14 },
        ...Array.from({ length: dateList.length }, () => ({ width: 14 })),
      ];

      const dispatchHeader = [
        "거래처",
        "이름",
        "연락처",
        "주민등록번호",
        "은행",
        "계좌정보",
        "급여",
        "지급여부",
        "삭제여부(del_yn)",
      ];

      wsDispatch.columns = [
        { width: 18 },
        { width: 12 },
        { width: 14 },
        { width: 18 },
        { width: 18 },
        { width: 28 },
        { width: 14 },
        { width: 12 },
        { width: 14 },
      ];

      addSectionTitle(wsDispatch, `■ 파출정보 / ${rangeLabel}`, dispatchHeader.length);
      wsDispatch.addRow(dispatchHeader);
      styleHeaderRow(wsDispatch, wsDispatch.lastRow.number);

      const allDispatchRows = new Map();
      const dispatchRightRowsAll = [];

      let globalDispatchTotal = 0;
      const employeeRightRowsAll = [];
      const employeeRightRowMap = new Map();
      const employeeDispatchSheetRowsAll = [];

      const mergeEmployeeRow = (target, next) => {
        const keys = [
          "name",
          "position",
          "working_day",
          "employ_dispatch",
          "over_work",
          "non_work",
          "note",
        ];
        keys.forEach((k) => {
          const v = next[k];
          if (v != null && v !== "") target[k] = v;
        });
      };

      const collectEmployeeRows = (rows, accId, accName) => {
        (rows || []).forEach((m) => {
          const mid = m?.member_id ?? m?.memberId ?? m?.id ?? m?.name;
          if (!mid) return;
          const key = `${accId}::${mid}`;
          const rowData = {
            account_id: accId,
            account_name: accName,
            member_id: mid,
            name: m?.name || "",
            position: m?.position || "",
            working_day: m?.working_day ?? "",
            employ_dispatch: m?.employ_dispatch ?? "",
            over_work: m?.over_work ?? "",
            non_work: m?.non_work ?? "",
            note: m?.note ?? "",
          };
          const existing = employeeRightRowMap.get(key);
          if (!existing) {
            employeeRightRowMap.set(key, rowData);
            employeeRightRowsAll.push(rowData);
          } else {
            mergeEmployeeRow(existing, rowData);
          }
        });
      };

      for (let i = 0; i < accountList.length; i++) {
        const acc = accountList[i];
        const accId = acc.account_id;
        const accName = acc.account_name || accId;

        const employeeDispatchSummaryMap = new Map();
        let dispatchMappingRowsArg = [];
        try {
          const mappingRes = await api.get("/Account/AccountMemberDispatchMappingList", {
            params: { dispatch_account_id: accId },
          });
          dispatchMappingRowsArg = extractArray(mappingRes.data);
        } catch (err) {
          console.error("직원파출 매핑 조회 실패(엑셀):", err);
          dispatchMappingRowsArg = [];
        }

        addSectionTitle(wsAttend, `■ ${accName} (${accId})  /  ${rangeLabel}`, attendColCount);

        const header = ["직원명", ...dateList.map((d) => `${d.format("M/D")}`)];
        wsAttend.addRow(header);
        styleHeaderRow(wsAttend, wsAttend.lastRow.number);

        const memberMap = new Map(); // 회원 아이디 → { 이름, 셀: { [날짜키]: 셀 } }
        const memberInfoMap = new Map(); // 회원 아이디 → { rrn, account_number, position_type }
        const dispatchSummaryMap = new Map(); // 회원 아이디 → 요약

        for (let mi = 0; mi < monthsInRange.length; mi++) {
          const { y, m } = monthsInRange[mi];
          const daysInThisMonth = dayjs(`${y}-${String(m).padStart(2, "0")}-01`).daysInMonth();

          const { sheetRowsArg, memberRowsArg, timesRowsArg, dispatchRowsArg } =
            await fetchBundleForAccount(accId, y, m);

          // ✅ 출근현황 우측 직원정보 수집(월별 → 중복 병합)
          collectEmployeeRows(memberRowsArg, accId, accName);

          // ✅ account_members 정보(주민번호/계좌) 확보
          (memberRowsArg || []).forEach((m) => {
            const mid = m?.member_id ?? m?.memberId ?? m?.id;
            if (!mid) return;
            const key = String(mid);
            const prev = memberInfoMap.get(key) || {
              rrn: "",
              account_number: "",
              position_type: m?.position_type ?? m?.positionType ?? "",
            };
            if (!prev.rrn) prev.rrn = m?.rrn || "";
            if (!prev.account_number) prev.account_number = m?.account_number || "";
            if (!prev.position_type) {
              prev.position_type = m?.position_type ?? m?.positionType ?? "";
            }
            memberInfoMap.set(key, prev);
          });

          // ✅ 파출 기본 정보(이름/주민번호/계좌) 확보
          (dispatchRowsArg || []).forEach((d) => {
            const mid = d?.member_id ?? d?.memberId;
            if (!mid) return;
            const key = String(mid);
            const prev = dispatchSummaryMap.get(key) || {
              member_id: key,
              account_name: accName,
              name: "",
              rrn: "",
              account_number: "",
              dispatchCount: 0,
              dispatchPays: [],
              dispatchTotal: 0,
              hasEmployeeDispatch: false,
            };
            prev.name = prev.name || d.name || "";
            prev.rrn = prev.rrn || d.rrn || "";
            prev.account_number = prev.account_number || d.account_number || "";
            dispatchSummaryMap.set(key, prev);
          });

          const monthStart = dayjs(`${y}-${String(m).padStart(2, "0")}-01`);
          const monthEnd = monthStart.endOf("month");
          const startInMonth =
            (realStart.isAfter(monthStart) || realStart.isSame(monthStart, "day")) &&
            (realStart.isBefore(monthEnd) || realStart.isSame(monthEnd, "day"));
          const endInMonth =
            (realEnd.isAfter(monthStart) || realEnd.isSame(monthStart, "day")) &&
            (realEnd.isBefore(monthEnd) || realEnd.isSame(monthEnd, "day"));

          const fromDay = startInMonth ? realStart.date() : realStart.isAfter(monthEnd) ? null : 1;
          const toDay = endInMonth
            ? realEnd.date()
            : realEnd.isBefore(monthStart)
            ? null
            : daysInThisMonth;

          if (fromDay == null || toDay == null) {
            continue;
          }

          const { attendanceRowsBuilt } = buildAttendanceRowsFromSheet(
            sheetRowsArg,
            memberRowsArg,
            timesRowsArg,
            daysInThisMonth
          );

          (attendanceRowsBuilt || []).forEach((row) => {
            const mid = row.member_id || row.id || row.name;
            if (!mid) return;
            if (!memberMap.has(mid)) {
              memberMap.set(mid, { name: row.name || "", cells: {} });
            }
            const entry = memberMap.get(mid);
            for (let d = 1; d <= daysInThisMonth; d++) {
              const key = `day_${d}`;
              const dateKey = dayjs(
                `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
              ).format("YYYY-MM-DD");
              entry.cells[dateKey] = row[key];
            }
          });

          const monthPayMap = new Map();
          const monthPayStatusMap = new Map();

          (attendanceRowsBuilt || []).forEach((row) => {
            const mid = row?.member_id ?? row?.memberId ?? row?.id ?? row?.name;
            if (!mid) return;

            for (let d = fromDay; d <= toDay; d++) {
              const cell = row?.[`day_${d}`];
              if (!cell) continue;
              const t = safeTrim(cell?.type ?? "", "");
              if (!isDispatchTypeValue(t)) continue;

              const sal = toNumberLike(cell?.salary);
              const isEmployeeDispatch = t === "6" || t === "직원파출";
              if (isEmployeeDispatch) {
                const midKey = String(mid);
                const prev = employeeDispatchSummaryMap.get(midKey) || {
                  member_id: midKey,
                  name: row?.name || "",
                  count: 0,
                  amount: 0,
                };
                if (!prev.name) prev.name = row?.name || "";
                prev.count += 1;
                prev.amount += sal;
                employeeDispatchSummaryMap.set(midKey, prev);
                continue;
              }

              const midKey = String(mid);
              monthPayMap.set(mid, (monthPayMap.get(mid) || 0) + sal);
              globalDispatchTotal += sal;

              // ✅ 출근현황 시트 우측 파출 요약 (직원파출 제외)
              const prev = dispatchSummaryMap.get(midKey) || {
                member_id: midKey,
                account_name: accName,
                name: "",
                rrn: "",
                account_number: "",
                dispatchCount: 0,
                dispatchPays: [],
                dispatchPayFlags: [],
                dispatchTotal: 0,
                hasEmployeeDispatch: false,
              };
              prev.name = prev.name || row?.name || "";
              if (!Array.isArray(prev.dispatchPays)) prev.dispatchPays = [];
              if (!Array.isArray(prev.dispatchPayFlags)) prev.dispatchPayFlags = [];
              prev.dispatchCount += 1;
              prev.dispatchPays.push(sal);
              prev.dispatchPayFlags.push(
                String(cell?.pay_yn ?? cell?.payYn ?? "").toUpperCase() === "Y"
              );
              prev.dispatchTotal += sal;
              dispatchSummaryMap.set(midKey, prev);

              const payYn = String(cell?.pay_yn ?? cell?.payYn ?? "").toUpperCase() === "Y";
              const stat = monthPayStatusMap.get(mid) || { paid: 0, total: 0 };
              stat.total += 1;
              if (payYn) stat.paid += 1;
              monthPayStatusMap.set(mid, stat);
            }
          });

          (dispatchRowsArg || []).forEach((d) => {
            const mid = d.member_id;
            if (!mid) return;
            const paySum = monthPayMap.get(mid) || 0;
            if (!paySum || Number(paySum) <= 0) return;
            const key = String(mid);
            const prev = allDispatchRows.get(key) || {
              accNames: new Set(),
              member_id: mid,
              name: d.name || "",
              phone: d.phone || "",
              rrn: d.rrn || "",
              account_number: d.account_number || "",
              salary: d.salary ?? "",
              total: d.total ?? "",
              del_yn: d.del_yn ?? "N",
              period_pay: 0,
              paid_cnt: 0,
              total_cnt: 0,
            };
            prev.accNames.add(accName);
            // del_yn은 하나라도 N이면 N 유지
            if (String(prev.del_yn).toUpperCase() !== "N") {
              prev.del_yn = d.del_yn ?? prev.del_yn;
            }
            prev.period_pay += paySum;
            const stat = monthPayStatusMap.get(mid);
            if (stat) {
              prev.paid_cnt += stat.paid;
              prev.total_cnt += stat.total;
            }
            allDispatchRows.set(key, prev);
          });
        }

        // ✅ 직원파출이 있다면 account_members 기반으로 주민번호/계좌번호 보완
        dispatchSummaryMap.forEach((d, key) => {
          if (!d?.hasEmployeeDispatch) return;
          if (d.rrn && d.account_number) return;
          const info = memberInfoMap.get(String(key));
          if (!info) return;
          if (!d.rrn) d.rrn = info.rrn || d.rrn;
          if (!d.account_number) d.account_number = info.account_number || d.account_number;
        });

        const dispatchRowsForAccountRaw = Array.from(dispatchSummaryMap.values()).map((d) => {
          const payLines = (d.dispatchPays || []).map((p) => toNumberLike(p));
          const payFlags = Array.isArray(d.dispatchPayFlags) ? d.dispatchPayFlags : [];
          const totalLine = payLines.length > 0 ? toNumberLike(d.dispatchTotal) : "";
          return {
            account_name: d.account_name || accName,
            name: d.name || "",
            rrn: d.rrn || "",
            account_number: d.account_number || "",
            dispatchCount: d.dispatchCount || 0,
            dispatchPays: payLines,
            dispatchPayFlags: payFlags,
            dispatchTotal: totalLine,
            hasEmployeeDispatch: !!d.hasEmployeeDispatch,
          };
        });

        const dispatchRowsForAccount = dispatchRowsForAccountRaw.filter(
          (d) => (d.dispatchCount || 0) > 0 || (d.dispatchPays || []).length > 0
        );

        if (employeeDispatchSummaryMap.size > 0) {
          const employeeDispatchRowsForAccount = [];
          const seenKey = new Set();
          const seenMember = new Set();

          (dispatchMappingRowsArg || []).forEach((row) => {
            const mid = safeTrim(row?.member_id ?? row?.memberId ?? "", "");
            if (!mid) return;

            const stat = employeeDispatchSummaryMap.get(mid);
            if (!stat || (!stat.count && !stat.amount)) return;

            const recordDateRaw = safeTrim(row?.record_date ?? row?.recordDate ?? "", "");
            if (recordDateRaw) {
              const rd = dayjs(recordDateRaw);
              if (rd.isValid() && (rd.isBefore(realStart, "day") || rd.isAfter(realEnd, "day"))) {
                return;
              }
            }

            const originId = safeTrim(row?.account_id ?? row?.origin_account_id ?? "", "");
            const dispatchId = safeTrim(
              row?.dispatch_account_id ?? row?.dispatchAccountId ?? "",
              ""
            );
            if (dispatchId && dispatchId !== String(accId)) return;

            const info = parseEmployeeDispatchInfo(row?.employ_dispatch);
            const origin = safeTrim(
              row?.origin_account_name ??
                row?.origin_account ??
                accountNameMap.get(originId) ??
                info.origin ??
                "",
              ""
            );
            const dispatch = safeTrim(
              row?.dispatch_account_name ??
                row?.dispatch_account ??
                row?.dispatch_account_nm ??
                row?.dispatch_accountName ??
                accountNameMap.get(dispatchId) ??
                info.dispatch ??
                accName ??
                "",
              ""
            );
            const name = safeTrim(row?.name ?? row?.member_name ?? stat?.name ?? "", "");

            if (!name && !origin && !dispatch) return;

            const key = `${mid}::${origin || originId}::${dispatch || dispatchId}`;
            if (seenKey.has(key)) return;
            seenKey.add(key);
            seenMember.add(mid);

            employeeDispatchRowsForAccount.push({
              name,
              origin,
              dispatch,
              count: stat.count || 0,
              amount: stat.amount || 0,
            });
          });

          employeeDispatchSummaryMap.forEach((stat, midKey) => {
            if (seenMember.has(midKey)) return;
            if (!stat || (!stat.count && !stat.amount)) return;
            employeeDispatchRowsForAccount.push({
              name: stat.name || "",
              origin: "",
              dispatch: accName || "",
              count: stat.count || 0,
              amount: stat.amount || 0,
            });
          });

          employeeDispatchRowsForAccount.forEach((row) => {
            employeeDispatchSheetRowsAll.push(row);
          });
        }

        Array.from(memberMap.values()).forEach((row) => {
          const startRow = wsAttend.lastRow.number + 1;

          const r1 = [row.name || ""];
          const r2 = [""];
          const r3 = [""];
          const r4 = [""];
          const dayTypes = [];

          dateList.forEach((d) => {
            const key = d.format("YYYY-MM-DD");
            const cell = row.cells[key];
            const [v1, v2, v3, v4] = splitDayCellAttend(row.cells[key]);
            dayTypes.push(safeTrim(cell?.type ?? "", ""));
            r1.push(v1);
            r2.push(v2);
            r3.push(v3);
            r4.push(v4);
          });

          wsAttend.addRow(r1);
          styleDataRow(wsAttend, wsAttend.lastRow.number);
          wsAttend.addRow(r2);
          styleDataRow(wsAttend, wsAttend.lastRow.number);
          wsAttend.addRow(r3);
          styleDataRow(wsAttend, wsAttend.lastRow.number);
          wsAttend.addRow(r4);
          styleDataRow(wsAttend, wsAttend.lastRow.number);

          for (let r = startRow; r <= startRow + 3; r++) {
            for (let c = 2; c <= attendColCount; c++) {
              const cell = wsAttend.getCell(r, c);
              cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            }
          }

          // ✅ 전체 거래처 엑셀: 날짜 셀(4줄 블록) 배경색 적용
          dayTypes.forEach((type, idx) => {
            const argb = getExcelAttendanceFillArgb(type);
            if (!argb) return;
            const col = idx + 2;
            for (let r = startRow; r <= startRow + 3; r++) {
              wsAttend.getCell(r, col).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb },
              };
            }
          });

          // ✅ 급여(4번째 줄) 숫자 포맷 적용
          const salaryRowNum = startRow + 3;
          for (let c = 2; c <= attendColCount; c++) {
            const cell = wsAttend.getCell(salaryRowNum, c);
            if (typeof cell.value === "number") {
              cell.numFmt = "#,##0";
            }
          }

          wsAttend.mergeCells(startRow, 1, startRow + 3, 1);
          const nameCell = wsAttend.getCell(startRow, 1);
          nameCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        });

        dispatchRowsForAccount.forEach((d) => {
          dispatchRightRowsAll.push({
            ...d,
            account_name: d.account_name || accName,
          });
        });

        wsAttend.addRow([]);
        wsAttend.addRow([]);
      }

      Array.from(allDispatchRows.values()).forEach((d) => {
        if (!d.period_pay || Number(d.period_pay) <= 0) return;
        const bank = extractBankName(d.account_number);
        const accountOnly = extractAccountOnly(d.account_number);
        const accName =
          d.accNames && d.accNames.size > 0 ? Array.from(d.accNames).join(", ") : d.accName || "";
        const pay = d.period_pay;
        const totalCnt = Number(d.total_cnt || 0);
        const paidCnt = Number(d.paid_cnt || 0);
        const payStatus =
          totalCnt > 0
            ? `${
                paidCnt === totalCnt ? "지급" : paidCnt === 0 ? "미지급" : "부분"
              }(${paidCnt}/${totalCnt})`
            : "";

        wsDispatch.addRow([
          accName,
          d.name,
          d.phone,
          d.rrn,
          bank,
          accountOnly,
          formatMoneyLike(pay),
          payStatus,
          d.del_yn,
        ]);
        const lastRowNum = wsDispatch.lastRow.number;
        const salaryCell = wsDispatch.getCell(lastRowNum, 7);
        const salaryNum = toNumberLike(pay);
        if (salaryNum) {
          salaryCell.value = salaryNum;
          salaryCell.numFmt = "#,##0";
        }
        styleDataRow(wsDispatch, lastRowNum);
      });

      wsAttend.views = [{ state: "frozen", xSplit: 0, ySplit: 0 }];
      wsDispatch.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];

      // ✅ 기존 우측 테이블을 별도 요약 시트로 분리
      wsAttendSummary.columns = attendRightWidths.map((w) => ({ width: w }));
      addSectionTitle(wsAttendSummary, `■ 출근현황요약 / ${rangeLabel}`, attendRightHeader.length);
      wsAttendSummary.addRow(attendRightHeader);
      styleHeaderRow(wsAttendSummary, wsAttendSummary.lastRow.number);

      employeeRightRowsAll.forEach((d) => {
        const workingDayNum = toNumberMaybe(d.working_day);
        const overWorkNum = toNumberMaybe(d.over_work);
        const nonWorkNum = toNumberMaybe(d.non_work);
        wsAttendSummary.addRow([
          d.account_name || "",
          d.name || "",
          d.position || "",
          workingDayNum === "" ? "" : workingDayNum,
          d.employ_dispatch ?? "",
          overWorkNum === "" ? "" : overWorkNum,
          nonWorkNum === "" ? "" : nonWorkNum,
          d.note ?? "",
        ]);
        const rowNum = wsAttendSummary.lastRow.number;
        styleDataRow(wsAttendSummary, rowNum);
        const workingDayCell = wsAttendSummary.getCell(rowNum, 4);
        if (typeof workingDayCell.value === "number") workingDayCell.numFmt = "#,##0";
        const overWorkCell = wsAttendSummary.getCell(rowNum, 6);
        if (typeof overWorkCell.value === "number") overWorkCell.numFmt = "#,##0";
        const nonWorkCell = wsAttendSummary.getCell(rowNum, 7);
        if (typeof nonWorkCell.value === "number") nonWorkCell.numFmt = "#,##0";
        for (let c = 1; c <= attendRightHeader.length; c++) {
          const cell = wsAttendSummary.getCell(rowNum, c);
          cell.alignment = {
            vertical: "middle",
            horizontal: c === attendRightHeader.length ? "left" : "center",
            wrapText: true,
          };
        }
      });
      wsAttendSummary.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];

      wsDispatchSummary.columns = dispatchRightWidths.map((w) => ({ width: w }));
      addSectionTitle(
        wsDispatchSummary,
        `■ 파출정보 요약 / ${rangeLabel}`,
        dispatchRightHeader.length
      );
      wsDispatchSummary.addRow(dispatchRightHeader);
      styleHeaderRow(wsDispatchSummary, wsDispatchSummary.lastRow.number);

      wsDispatchSummary.addRow(["합계", "", "", "", "", globalDispatchTotal || 0, "", ""]);
      const dispatchSummaryTotalRowNum = wsDispatchSummary.lastRow.number;
      styleDataRow(wsDispatchSummary, dispatchSummaryTotalRowNum);
      const dispatchSummaryTotalCell = wsDispatchSummary.getCell(dispatchSummaryTotalRowNum, 6);
      dispatchSummaryTotalCell.numFmt = "#,##0";
      for (let c = 1; c <= dispatchRightHeader.length; c++) {
        const cell = wsDispatchSummary.getCell(dispatchSummaryTotalRowNum, c);
        cell.alignment = {
          vertical: "middle",
          horizontal: c === dispatchRightHeader.length ? "left" : "center",
          wrapText: true,
        };
      }

      dispatchRightRowsAll.forEach((d) => {
        const payLines = d.dispatchPays || [];
        const totalLine = d.dispatchTotal || "";
        const totalRows = payLines.length > 0 ? payLines.length : 1;
        const payFlags = Array.isArray(d.dispatchPayFlags) ? d.dispatchPayFlags : [];

        for (let iLine = 0; iLine < totalRows; iLine++) {
          const amountVal = toNumberMaybe(payLines[iLine] ?? "");
          const isLastRow = iLine === totalRows - 1;
          const countVal = iLine === 0 ? toNumberMaybe(d.dispatchCount || 0) : "";
          const totalVal =
            isLastRow && totalLine !== "" && totalLine != null ? toNumberMaybe(totalLine) : "";
          const hasBaro =
            String(d.rrn ?? "").includes("바로인력") ||
            String(d.account_number ?? "").includes("바로인력");
          const remarkParts = [];
          if (d.hasEmployeeDispatch) remarkParts.push("직원파출");
          if (hasBaro) remarkParts.push("바로인력");

          wsDispatchSummary.addRow([
            iLine === 0 ? d.account_name || "" : "",
            iLine === 0 ? d.name : "",
            iLine === 0 ? d.rrn : "",
            iLine === 0 ? d.account_number : "",
            countVal === "" ? "" : countVal,
            amountVal === "" ? "" : amountVal,
            totalVal === "" ? "" : totalVal,
            iLine === 0 ? remarkParts.join(", ") : "",
          ]);

          const rowNum = wsDispatchSummary.lastRow.number;
          styleDataRow(wsDispatchSummary, rowNum);

          const countCell = wsDispatchSummary.getCell(rowNum, 5);
          if (typeof countCell.value === "number") countCell.numFmt = "#,##0";
          const amountCell = wsDispatchSummary.getCell(rowNum, 6);
          if (typeof amountCell.value === "number") amountCell.numFmt = "#,##0";
          if (payFlags[iLine] && amountCell.value !== "") {
            amountCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF2CC" },
            };
          }

          const totalCell = wsDispatchSummary.getCell(rowNum, 7);
          if (typeof totalCell.value === "number") totalCell.numFmt = "#,##0";

          for (let c = 1; c <= dispatchRightHeader.length; c++) {
            const cell = wsDispatchSummary.getCell(rowNum, c);
            cell.alignment = {
              vertical: "middle",
              horizontal: c === dispatchRightHeader.length ? "left" : "center",
              wrapText: true,
            };
          }
        }
      });
      wsDispatchSummary.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];

      if (employeeDispatchSheetRowsAll.length > 0) {
        const wsEmployeeDispatch = wb.addWorksheet("직원파출정보");
        const employeeDispatchHeader = ["직원명", "원소속", "파견업장", "횟수", "금액"];

        wsEmployeeDispatch.columns = [
          { width: 16 },
          { width: 24 },
          { width: 24 },
          { width: 10 },
          { width: 16 },
        ];

        addSectionTitle(
          wsEmployeeDispatch,
          `■ 직원파출정보 / ${rangeLabel}`,
          employeeDispatchHeader.length
        );
        wsEmployeeDispatch.addRow(employeeDispatchHeader);
        styleHeaderRow(wsEmployeeDispatch, wsEmployeeDispatch.lastRow.number);

        employeeDispatchSheetRowsAll.forEach((d) => {
          const countNum = toNumberMaybe(d.count);
          const amountNum = toNumberMaybe(d.amount);
          wsEmployeeDispatch.addRow([
            d.name || "-",
            d.origin || "-",
            d.dispatch || "-",
            countNum === "" ? "" : countNum,
            amountNum === "" ? "" : amountNum,
          ]);
          const rowNum = wsEmployeeDispatch.lastRow.number;
          styleDataRow(wsEmployeeDispatch, rowNum);
          const countCell = wsEmployeeDispatch.getCell(rowNum, 4);
          if (typeof countCell.value === "number") countCell.numFmt = "#,##0";
          const amountCell = wsEmployeeDispatch.getCell(rowNum, 5);
          if (typeof amountCell.value === "number") amountCell.numFmt = "#,##0";
        });

        wsEmployeeDispatch.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, filename);

      Swal.fire({ title: "완료", text: "엑셀 다운로드가 완료되었습니다.", icon: "success" });
    } catch (e) {
      console.error(e);
      Swal.fire({ title: "실패", text: "엑셀 생성 중 오류가 발생했습니다.", icon: "error" });
    } finally {
      setExcelDownloading(false);
    }
  };

  // ✅ "출근한 사람" 카운트 타입
  const COUNT_TYPES = new Set(["1", "2", "3", "5", "6", "7", "8", "19"]);
  const isWorkingType = (cell) => {
    const t = safeTrim(cell?.type, "");
    if (!t || t === "0") return false;
    return COUNT_TYPES.has(t);
  };

  const dayWorkCounts = useMemo(() => {
    const counts = {};
    for (let d = 1; d <= daysInMonth; d++) counts[`day_${d}`] = 0;

    (attendanceRows || []).forEach((row) => {
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `day_${d}`;
        if (isWorkingType(row?.[key])) counts[key] += 1;
      }
    });

    return counts;
  }, [attendanceRows, daysInMonth]);

  const [formData, setFormData] = useState({
    account_id: selectedAccountId,
    name: "",
    phone: "",
    rrn: "",
    account_number: "",
    position_type: "4", // ✅ 추가: 기본값(조리사)
    dispatch_account: "",
    note: "",
  });

  const handleModalClose = () => {
    setFormData({
      account_id: selectedAccountId,
      name: "",
      phone: "",
      rrn: "",
      account_number: "",
      position_type: "4", // ✅ 추가
      dispatch_account: "",
      note: "",
    });
    setOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ 직원정보만 조용히 갱신
  const fetchMemberOnlySilently = useCallback(async () => {
    if (!selectedAccountId) return;
    try {
      const memberRes = await api.get("/Account/AccountRecordMemberList", {
        params: { account_id: selectedAccountId, year, month },
      });
      const list = extractArray(memberRes.data);
      setEmployeeRowsView(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("직원정보 새로고침 실패:", e);
    }
  }, [selectedAccountId, year, month]);

  // ============================================================
  // ✅ 파출 state / snapshot / 레이스방지 / 로딩표시
  // ============================================================
  const [dispatchRows, setDispatchRows] = useState([]);
  const [originalDispatchRows, setOriginalDispatchRows] = useState([]);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const dispatchReqSeqRef = useRef(0);
  const [dispatchMemoOpen, setDispatchMemoOpen] = useState({});

  const getDispatchRowKey = useCallback(
    (row) => String(row?._rid ?? row?.dispatch_id ?? row?.member_id ?? row?.id ?? row?.name ?? ""),
    []
  );

  const toggleDispatchMemo = useCallback(
    (row) => {
      const key = getDispatchRowKey(row);
      if (!key) return;
      setDispatchMemoOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [getDispatchRowKey]
  );

  // ✅ 파출만 조회 (조회 직후 original 스냅샷도 같이 갱신 => 빨간글씨 초기화)
  const fetchDispatchOnly = useCallback(
    async (overrideDelYn) => {
      if (!selectedAccountId) return;

      const del_yn = overrideDelYn ?? dispatchDelFilter;
      const mySeq = ++dispatchReqSeqRef.current;

      setDispatchLoading(true);
      try {
        const res = await api.get("/Account/AccountRecordDispatchList", {
          params: { account_id: selectedAccountId, year, month, del_yn },
        });

        if (mySeq !== dispatchReqSeqRef.current) return;

        const list = extractArray(res.data);

        const mapped = (Array.isArray(list) ? list : []).map((item) =>
          ensureDispatchRid({
            ...item,
            account_id: item.account_id ?? selectedAccountId,
            member_id: item.member_id,
            name: item.name,
            rrn: item.rrn ?? "",
            account_number: item.account_number ?? "",
            total: item.total,
            salary: item.salary,
            note: item.note ?? item.memo ?? "",
            phone: item.phone ?? "",
            dispatch_account: item.dispatch_account ?? "",
            del_yn: item.del_yn ?? del_yn ?? "N",
            dispatch_id: item.dispatch_id ?? item.id,
          })
        );

        setDispatchRows(mapped);

        // ✅ 중요: 조회 직후 스냅샷도 동일하게 세팅해야 빨간글씨가 남지 않음
        setOriginalDispatchRows(mapped.map((r) => ({ ...r })));
        setDispatchMemoOpen({});
      } catch (err) {
        if (mySeq !== dispatchReqSeqRef.current) return;

        console.error("파출 재조회 실패:", err);
        Swal.fire({
          title: "오류",
          text: "파출직원 조회 중 오류가 발생했습니다.",
          icon: "error",
        });
      } finally {
        if (mySeq === dispatchReqSeqRef.current) setDispatchLoading(false);
      }
    },
    [selectedAccountId, year, month, dispatchDelFilter]
  );

  const fetchDispatchMappingOnly = useCallback(async () => {
    const accId = String(selectedAccountId ?? "");
    if (!accId) {
      setDispatchMappingRows([]);
      return;
    }

    const mySeq = ++dispatchMappingReqSeqRef.current;
    try {
      const res = await api.get("/Account/AccountMemberDispatchMappingList", {
        params: { dispatch_account_id: accId },
      });

      if (mySeq !== dispatchMappingReqSeqRef.current) return;

      const list = extractArray(res.data);
      setDispatchMappingRows(Array.isArray(list) ? list : []);
    } catch (err) {
      if (mySeq !== dispatchMappingReqSeqRef.current) return;
      console.error("직원파출 매핑 조회 실패:", err);
      setDispatchMappingRows([]);
    }
  }, [selectedAccountId, year, month]);

  // ✅ 핵심: year/month/selectedAccountId/filter 바뀌면 자동 재조회
  useEffect(() => {
    if (!selectedAccountId) return;
    fetchDispatchOnly(dispatchDelFilter);
  }, [selectedAccountId, year, month, dispatchDelFilter, fetchDispatchOnly]);

  useEffect(() => {
    fetchDispatchMappingOnly();
  }, [fetchDispatchMappingOnly]);

  // ✅ 파출 등록
  const handleSubmit = () => {
    if (!formData.name || !formData.rrn || !formData.account_number) {
      Swal.fire({
        title: "경고",
        text: "필수항목을 확인하세요.",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
      return;
    }

    const payload = {
      ...formData,
      account_id: selectedAccountId,
      del_yn: "N",
      record_year: year,
      record_month: month,
    };

    api
      .post("/Account/AccountDispatchMemberSave", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((response) => {
        if (response.data.code === 200) {
          Swal.fire({
            title: "저장",
            text: "저장되었습니다.",
            icon: "success",
            confirmButtonColor: "#d33",
            confirmButtonText: "확인",
          }).then(async (result) => {
            if (result.isConfirmed) {
              handleModalClose();
              setOpen(false);
              await fetchDispatchOnly(dispatchDelFilter); // ✅ 등록 후 즉시 재조회 + 스냅샷 갱신
            }
          });
        }
      })
      .catch(() => {
        Swal.fire({
          title: "실패",
          text: "저장을 실패했습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      });
  };

  // ✅ 파출 삭제/복원 (즉시 저장)
  const handleToggleDispatch = useCallback(
    async (row) => {
      const cur = row?.del_yn ?? "N";
      const next = String(cur).toUpperCase() === "Y" ? "N" : "Y";
      const actionLabel = next === "Y" ? "삭제" : "복원";

      const confirm = await Swal.fire({
        title: `${actionLabel} 하시겠습니까?`,
        text:
          next === "Y"
            ? "삭제 처리되면 목록에서 제외될 수 있습니다."
            : "복원 처리하면 목록에 다시 표시됩니다.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "예",
        cancelButtonText: "아니오",
        confirmButtonColor: "#d33",
      });

      if (!confirm.isConfirmed) return;

      const member_id = row.member_id;

      if (!member_id) {
        Swal.fire({
          title: "오류",
          text: "파출직원 식별키(member_id 등)를 찾을 수 없습니다.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
        return;
      }

      try {
        const fd = new FormData();
        fd.append("account_id", row.account_id ?? selectedAccountId ?? "");
        fd.append("member_id", member_id ?? "");
        fd.append("del_yn", next);
        fd.append("name", row.name ?? "");
        fd.append("rrn", row.rrn ?? "");
        fd.append("account_number", row.account_number ?? "");
        fd.append("total", row.total ?? "");
        fd.append("salary", row.salary ?? "");
        fd.append("phone", row.phone ?? "");
        fd.append("record_year", String(year));
        fd.append("record_month", String(month));

        const response = await api.post("/Account/AccountDispatchMemberSave", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data?.code === 200) {
          await Swal.fire({
            title: "저장",
            text: `${actionLabel} 처리되었습니다.`,
            icon: "success",
            confirmButtonColor: "#d33",
            confirmButtonText: "확인",
          });

          await fetchDispatchOnly(dispatchDelFilter); // ✅ 즉시 재조회 + 스냅샷 갱신
        } else {
          Swal.fire({
            title: "실패",
            text: `${actionLabel} 저장에 실패했습니다.`,
            icon: "error",
            confirmButtonColor: "#d33",
            confirmButtonText: "확인",
          });
        }
      } catch (e) {
        Swal.fire({
          title: "실패",
          text: `${actionLabel} 저장에 실패했습니다.`,
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "확인",
        });
      }
    },
    [dispatchDelFilter, fetchDispatchOnly, selectedAccountId, year, month]
  );

  // ✅ originalMap (_rid 매칭)
  const originalDispatchMap = useMemo(() => {
    const m = new Map();
    (originalDispatchRows || []).forEach((r) => m.set(String(r._rid), r));
    return m;
  }, [originalDispatchRows]);

  const updateDispatchByRid = useCallback((rid, patch) => {
    setDispatchRows((prev) =>
      (prev || []).map((r) => (String(r._rid) === String(rid) ? { ...r, ...patch } : r))
    );
  }, []);

  // ✅ 파출 저장: 변경된 row만 전송
  const handleDispatchSave = useCallback(async () => {
    if (!selectedAccountId) return;

    const editableFields = ["phone", "rrn", "account_number", "dispatch_account"];

    const changedRows = (dispatchRows || []).filter((row) => {
      const rid = String(row?._rid ?? "");
      const original = originalDispatchMap.get(rid);
      if (!original) return true;

      return editableFields.some((f) => {
        const cur = normalizeDispatchValue(f, row?.[f]);
        const org = normalizeDispatchValue(f, original?.[f]);
        return cur !== org;
      });
    });

    if (changedRows.length === 0) {
      Swal.fire({ title: "안내", text: "변경된 내용이 없습니다.", icon: "info" });
      return;
    }

    try {
      for (const r of changedRows) {
        const fd = new FormData();
        fd.append("account_id", r.account_id || selectedAccountId);
        fd.append("member_id", r.member_id || "");
        fd.append("name", r.name || "");
        fd.append("rrn", r.rrn || "");
        fd.append("phone", r.phone || "");
        fd.append("account_number", r.account_number || "");
        fd.append("dispatch_account", r.dispatch_account || "");
        fd.append("total", r.total || "");
        fd.append("salary", r.salary ?? "");
        fd.append("del_yn", r.del_yn ?? "N");
        fd.append("record_year", String(year));
        fd.append("record_month", String(month));

        await api.post("/Account/AccountDispatchMemberSave", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      Swal.fire({ title: "저장", text: "저장 완료", icon: "success" });
      await fetchDispatchOnly(dispatchDelFilter); // ✅ 저장 후 재조회 + 스냅샷 갱신 (빨간글씨 초기화)
    } catch (e) {
      Swal.fire({ title: "오류", text: e.message || "저장 중 오류", icon: "error" });
    }
  }, [
    dispatchRows,
    originalDispatchMap,
    selectedAccountId,
    dispatchDelFilter,
    fetchDispatchOnly,
    year,
    month,
  ]);

  // ✅ accountList 로딩 후 account_id 1회 적용
  useEffect(() => {
    if (!accountList || accountList.length === 0) return;

    setSelectedAccountId((prev) => {
      if (prev) return prev;

      if (account_id && accountList.some((row) => row.account_id === account_id)) {
        return account_id;
      }
      return accountList[0].account_id;
    });
  }, [accountList, account_id]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, account_id: selectedAccountId }));
  }, [selectedAccountId]);

  // ✅ 화면도 buildAttendanceRowsFromSheet 로 통일
  useEffect(() => {
    if (!sheetRows || !sheetRows.length) {
      setAttendanceRows([]);
      setOriginalAttendanceRows([]);
      setDefaultTimes({});
      return;
    }

    const { attendanceRowsBuilt, defaultTimesMap } = buildAttendanceRowsFromSheet(
      sheetRows,
      memberRows,
      timesRows,
      daysInMonth
    );

    setAttendanceRows(attendanceRowsBuilt);
    setOriginalAttendanceRows(JSON.parse(JSON.stringify(attendanceRowsBuilt)));
    setDefaultTimes(defaultTimesMap);
  }, [sheetRows, memberRows, timesRows, daysInMonth]);

  const getOrgTimes = (row, defaultTimesObj) => {
    const orgStart = row.day_default?.start_time || defaultTimesObj[row.member_id]?.start || "";
    const orgEnd = row.day_default?.end_time || defaultTimesObj[row.member_id]?.end || "";
    return { org_start_time: orgStart, org_end_time: orgEnd };
  };

  const dayColumns = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const date = dayjs(`${year}-${month}-${i + 1}`);
        const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.day()];

        return {
          header: `${i + 1}일(${weekday})`,
          accessorKey: `day_${i + 1}`,
          cell: (props) => {
            const typeOptions = (() => {
              const isType5Member = Object.keys(props.row.original)
                .filter((k) => k.startsWith("day_"))
                .some((k) => safeTrim(props.row.original[k]?.type, "") === "5");

              if (isType5Member) {
                return [
                  { value: "0", label: "-" },
                  { value: "5", label: "파출" },
                ];
              }

              return [
                { value: "0", label: "-" },
                { value: "1", label: "영양사" },
                { value: "2", label: "상용" },
                { value: "3", label: "초과" },
                { value: "17", label: "조기퇴근" },
                { value: "4", label: "결근" },
                { value: "5", label: "파출" },
                { value: "6", label: "직원파출" },
                { value: "7", label: "유틸" },
                { value: "19", label: "통합" },
                { value: "8", label: "대체근무" },
                { value: "9", label: "연차" },
                { value: "10", label: "반차" },
                { value: "11", label: "대체휴무" },
                { value: "12", label: "병가" },
                { value: "13", label: "출산휴가" },
                { value: "14", label: "육아휴직" },
                { value: "15", label: "하계휴가" },
                { value: "16", label: "업장휴무" },
              ];
            })();

            return <AttendanceCell {...props} typeOptions={typeOptions} />;
          },
          size: isMobile ? 52 : 80,
        };
      }),
    [daysInMonth, year, month, isMobile]
  );

  const memberDelYnMap = useMemo(() => {
    const map = new Map();
    (memberRows || []).forEach((m) => {
      const delYn = String(m?.del_yn ?? "").toUpperCase();
      const mid = safeTrim(m?.member_id ?? m?.memberId ?? "", "");
      if (mid) map.set(mid, delYn || "N");
      const name = safeTrim(m?.name ?? "", "");
      if (name && !map.has(name)) map.set(name, delYn || "N");
    });
    return map;
  }, [memberRows]);

  const attendanceColumns = useMemo(
    () => [
      {
        header: "직원명",
        accessorKey: "name",
        size: "2%",
        cell: (info) => {
          return <b>{info.getValue()}</b>;
        },
      },
      ...dayColumns,
    ],
    [dayColumns, memberDelYnMap]
  );

  const attendanceTable = useReactTable({
    data: attendanceRows,
    columns: attendanceColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowIndex, columnId, newValue) => {
        setAttendanceRows((old) =>
          old.map((row, index) =>
            index !== rowIndex ? row : { ...row, [columnId]: { ...row[columnId], ...newValue } }
          )
        );
      },
      getOrgTimes: (row) => getOrgTimes(row, defaultTimes),
      isCellLocked: (row, columnId) => isCellLockedByActJoin(row, columnId),
    },
  });

  const dispatchPayStatusMap = useMemo(() => {
    const map = new Map();
    (attendanceRows || []).forEach((row) => {
      const keys = getDispatchKeys(row);
      if (keys.length === 0) return;
      let total = 0;
      let paid = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = row?.[`day_${d}`];
        if (!cell) continue;
        const t = safeTrim(cell?.type ?? "", "");
        if (!isDispatchTypeValue(t)) continue;
        total += 1;
        if (String(cell?.pay_yn ?? "").toUpperCase() === "Y") paid += 1;
      }
      if (total > 0) {
        const stat = { total, paid };
        keys.forEach((k) => {
          if (!map.has(k)) map.set(k, stat);
        });
      }
    });
    return map;
  }, [attendanceRows, daysInMonth]);

  const dispatchAmountMap = useMemo(() => {
    const map = new Map();
    (attendanceRows || []).forEach((row) => {
      const keys = getDispatchKeys(row);
      if (keys.length === 0) return;
      let totalCnt = 0;
      let totalPay = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = row?.[`day_${d}`];
        if (!cell) continue;
        const t = safeTrim(cell?.type ?? "", "");
        if (!isDispatchTypeValue(t)) continue;
        totalCnt += 1;
        totalPay += toNumberLike(cell?.salary);
      }
      if (totalCnt > 0 || totalPay > 0) {
        const stat = { totalCnt, totalPay };
        keys.forEach((k) => {
          if (!map.has(k)) map.set(k, stat);
        });
      }
    });
    return map;
  }, [attendanceRows, daysInMonth]);

  const employeeDispatchStatMap = useMemo(() => {
    const map = new Map();
    (attendanceRows || []).forEach((row) => {
      const mid = safeTrim(row.member_id ?? row.memberId ?? "", "");
      if (!mid) return;
      let totalCnt = 0;
      let totalPay = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = row?.[`day_${d}`];
        if (!cell) continue;
        const t = safeTrim(cell?.type ?? "", "");
        if (!isEmployeeDispatchType(t)) continue;
        totalCnt += 1;
        totalPay += toNumberLike(cell?.salary);
      }
      if (totalCnt > 0 || totalPay > 0) {
        map.set(String(mid), { totalCnt, totalPay });
      }
    });
    return map;
  }, [attendanceRows, daysInMonth]);

  const payRangeSummary = useMemo(() => {
    const totalSum = (payRangeRows || []).reduce(
      (acc, r) => acc + (Number(r.total_pay || 0) || 0),
      0
    );
    const selectedRows = (payRangeRows || []).filter((r) => payRangeSelected?.[r.member_id]);
    const selectedSum = selectedRows.reduce((acc, r) => acc + (Number(r.total_pay || 0) || 0), 0);
    return {
      totalCount: payRangeRows?.length || 0,
      selectedCount: selectedRows.length,
      totalSum,
      selectedSum,
    };
  }, [payRangeRows, payRangeSelected]);

  const payRangeAllSelected =
    (payRangeRows || []).length > 0 &&
    (payRangeRows || []).every((r) => payRangeSelected?.[r.member_id]);
  const payRangeSomeSelected =
    (payRangeRows || []).some((r) => payRangeSelected?.[r.member_id]) && !payRangeAllSelected;

  const excelModalBtn = {
    outline: {
      color: "#111",
      borderColor: "#111",
      "&:hover": { bgcolor: "rgba(0,0,0,0.06)", borderColor: "#000", color: "#000" },
    },
    solid: {
      bgcolor: "#111",
      color: "#fff",
      "&:hover": { bgcolor: "#000", color: "#fff" },
    },
  };

  const payModalBtn = {
    outline: {
      color: "#e91e63",
      borderColor: "#e91e63",
      "&:hover": {
        bgcolor: "#e91e63",
        borderColor: "#e91e63",
        color: "#fff",
      },
    },
    solid: {
      bgcolor: "#e91e63",
      color: "#fff",
      "&:hover": { bgcolor: "#d81b60", color: "#fff" },
      "&.Mui-disabled": { bgcolor: "#f8bbd0", color: "#fff" },
    },
  };

  const payCheckboxSx = (theme) => ({
    color: theme.palette.primary.main,
    "&.Mui-checked": { color: theme.palette.primary.main },
    "&.MuiCheckbox-indeterminate": { color: theme.palette.primary.main },
  });

  const handlePayRangeToggleAll = useCallback(
    (checked) => {
      setPayRangeSelected(
        (payRangeRows || []).reduce((acc, r) => {
          acc[r.member_id] = checked;
          return acc;
        }, {})
      );
    },
    [payRangeRows]
  );

  const handlePayRangeToggleOne = useCallback((memberId, checked) => {
    setPayRangeSelected((prev) => ({ ...(prev || {}), [memberId]: checked }));
  }, []);

  const handleToggleDispatchPay = useCallback(
    (memberId, nextChecked) => {
      if (!memberId) return;
      const payVal = nextChecked ? "Y" : "N";
      setAttendanceRows((prev) =>
        (prev || []).map((row) => {
          if (String(row.member_id) !== String(memberId)) return row;
          const updated = { ...row };
          for (let d = 1; d <= daysInMonth; d++) {
            const key = `day_${d}`;
            const cell = updated[key];
            if (!cell) continue;
            const t = safeTrim(cell?.type ?? "", "");
            if (!(t === "5" || t === "6")) continue;
            updated[key] = { ...cell, pay_yn: payVal };
          }
          return updated;
        })
      );
    },
    [daysInMonth]
  );

  const employeeTable = useReactTable({
    data: employeeRowsView,
    columns: [
      { header: "직원명", accessorKey: "name", size: "3%", cell: ReadonlyCell },
      { header: "직책", accessorKey: "position", size: "3%", cell: ReadonlyCell },
      { header: "근로일수", accessorKey: "working_day", size: "3%", cell: ReadonlyCell },
      { header: "초과", accessorKey: "over_work", size: "3%", cell: ReadonlyCell },
      { header: "결근", accessorKey: "non_work", size: "3%", cell: ReadonlyCell },
      { header: "비고", accessorKey: "note", size: "20%", cell: ReadonlyCell },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  const employeeDispatchRows = useMemo(() => {
    const accId = String(selectedAccountId ?? "");
    if (!accId) return [];

    const accNameMap = new Map(
      (accountList || []).map((a) => [String(a.account_id), safeTrim(a.account_name ?? "", "")])
    );

    const rows = [];
    const seen = new Set();

    const isSameMonthRecord = (row) => {
      const raw = safeTrim(row?.record_date ?? row?.recordDate ?? "", "");
      if (!raw) return true;
      const d = dayjs(raw);
      if (!d.isValid()) return true;
      return d.year() === Number(year) && d.month() + 1 === Number(month);
    };

    (dispatchMappingRows || []).forEach((row) => {
      const mid = safeTrim(row?.member_id ?? row?.memberId ?? "", "");
      if (!mid || seen.has(mid)) return;
      if (!isSameMonthRecord(row)) return;

      const originId = safeTrim(row?.account_id ?? row?.origin_account_id ?? "", "");
      const dispatchId = safeTrim(row?.dispatch_account_id ?? row?.dispatchAccountId ?? "", "");

      if (dispatchId && dispatchId !== accId) return;
      if (originId && originId === accId) return;

      seen.add(mid);

      const info = parseEmployeeDispatchInfo(row?.employ_dispatch);
      const stat = employeeDispatchStatMap.get(mid);

      const origin = safeTrim(
        row?.origin_account_name ??
          row?.origin_account ??
          accNameMap.get(originId) ??
          info.origin ??
          "",
        ""
      );

      const dispatch = safeTrim(
        row?.dispatch_account_name ??
          row?.dispatch_account ??
          row?.dispatch_account_nm ??
          row?.dispatch_accountName ??
          accNameMap.get(dispatchId) ??
          info.dispatch ??
          "",
        ""
      );

      const count = stat?.totalCnt ?? info.count ?? 0;
      const amount = stat?.totalPay ?? info.amount ?? "";
      const name = safeTrim(row?.name ?? row?.member_name ?? "", "");

      if (!name && !origin && !dispatch) return;

      rows.push({ name, origin, dispatch, count, amount });
    });

    return rows;
  }, [dispatchMappingRows, selectedAccountId, employeeDispatchStatMap, accountList, year, month]);

  // ✅ 파출 컬럼: 편집/변경감지/삭제복원 유지
  const dispatchColumns = useMemo(
    () => [
      {
        header: "이름",
        accessorKey: "name",
        size: "3%",
        cell: ({ row, getValue }) => {
          const name = getValue() || "";
          const key = getDispatchRowKey(row.original);
          const isOpen = !!dispatchMemoOpen?.[key];
          return (
            <span
              role="button"
              tabIndex={0}
              onClick={() => toggleDispatchMemo(row.original)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") toggleDispatchMemo(row.original);
              }}
              style={{
                cursor: "pointer",
                textDecoration: isOpen ? "underline" : "none",
                fontSize: "0.75rem",
              }}
              title="메모 보기"
            >
              {isOpen ? "▾ " : "▸ "}
              {name}
            </span>
          );
        },
      },
      {
        header: "연락처",
        accessorKey: "phone",
        size: "3%",
        cell: (props) => <DispatchEditableCell {...props} field="phone" />,
      },
      {
        header: "주민등록번호",
        accessorKey: "rrn",
        size: "3%",
        cell: (props) => <DispatchEditableCell {...props} field="rrn" />,
      },
      {
        header: "계좌정보",
        accessorKey: "account_number",
        size: "3%",
        cell: (props) => <DispatchEditableCell {...props} field="account_number" />,
      },
      {
        header: "금액",
        accessorKey: "total",
        size: "15%",
        cell: ({ row, getValue }) => {
          const stat = getDispatchStatFromMap(dispatchAmountMap, row.original);
          if (!stat) {
            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  lineHeight: 1.1,
                  fontSize: "0.72rem",
                  width: "100%",
                }}
              >
                0회
              </div>
            );
          }
          const cnt = Number(stat.totalCnt || 0);
          const pay = Number(stat.totalPay || 0);
          if (cnt <= 0) {
            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  lineHeight: 1.1,
                  fontSize: "0.72rem",
                  width: "100%",
                }}
              >
                0회
              </div>
            );
          }
          const payText = pay > 0 ? `${formatMoneyLike(pay)}원` : "-";
          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                lineHeight: 1.1,
                fontSize: "0.72rem",
                width: "100%",
              }}
            >
              <span>{cnt}회</span>
              <span>{payText}</span>
            </div>
          );
        },
      },
      {
        header: "지급",
        id: "pay_yn",
        size: "3%",
        cell: ({ row }) => (
          <DispatchPayCell
            row={row}
            status={getDispatchStatFromMap(dispatchPayStatusMap, row.original)}
            onToggle={handleToggleDispatchPay}
          />
        ),
      },
      {
        header: "파출업체",
        accessorKey: "dispatch_account",
        size: "3%",
        cell: (props) => <DispatchEditableCell {...props} field="dispatch_account" />,
      },
      {
        header: "관리",
        id: "actions",
        size: "1%",
        cell: ({ row }) => <DispatchActionCell row={row} onToggle={handleToggleDispatch} />,
      },
    ],
    [
      dispatchPayStatusMap,
      dispatchAmountMap,
      handleToggleDispatchPay,
      handleToggleDispatch,
      dispatchMemoOpen,
      toggleDispatchMemo,
      getDispatchRowKey,
    ]
  );

  const dispatchTable = useReactTable({
    data: dispatchRows,
    columns: dispatchColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row?._rid ?? row?.dispatch_id ?? row?.member_id ?? row?.id ?? ""),
    meta: {
      updateDispatchByRid: (rid, patch) => updateDispatchByRid(rid, patch),
      getOriginalDispatchValueByRid: (rid, field) => {
        const org = originalDispatchMap.get(String(rid));
        return org ? org[field] ?? "" : "";
      },
    },
  });

  const dispatchColStyle = (columnId) => {
    if (columnId === "phone") {
      return { width: 110, minWidth: 110, maxWidth: 110 };
    }
    if (columnId === "rrn") {
      return { width: 115, minWidth: 115, maxWidth: 115 };
    }
    if (columnId === "account_number") {
      return { width: 180, minWidth: 180, maxWidth: 180 };
    }
    if (columnId === "total") {
      return { width: 80, minWidth: 80, maxWidth: 80 };
    }
    return undefined;
  };

  const tableSx = {
    maxHeight: "430px",
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
      border: "1px solid #686D76",
    },
    "thead th:first-of-type": { zIndex: 5 },
    "& button": { height: "20px !important", padding: "2px" },
  };

  const handleApplyDefaultTime = () => {
    setAttendanceRows((prevRows) =>
      prevRows.map((row) => {
        const updated = { ...row };
        const { org_start_time, org_end_time } = getOrgTimes(row, defaultTimes);

        Object.keys(updated)
          .filter((k) => k.startsWith("day_"))
          .forEach((dayKey) => {
            const cell = updated[dayKey];
            if (!cell) return;

            const typeNum = Number(cell.type);
            if (typeNum === 1 || typeNum === 2) {
              updated[dayKey] = {
                ...cell,
                start: org_start_time,
                end: org_end_time,
                start_time: org_start_time,
                end_time: org_end_time,
              };
            }
          });

        return updated;
      })
    );
  };

  // ✅ 저장(출근현황)
  // 저장 성공 시 직원정보/파출정보를 로딩 없이 "쓱" 갱신
  const handleSave = async () => {
    if (!attendanceRows || !attendanceRows.length) return;

    const normalRecords = [];
    const disRecords = [];
    const recRecords = [];

    const useDiffMode =
      originalAttendanceRows && originalAttendanceRows.length === attendanceRows.length;

    attendanceRows.forEach((row, rowIndex) => {
      const originalRow = useDiffMode ? originalAttendanceRows[rowIndex] : null;
      const { org_start_time, org_end_time } = getOrgTimes(row, defaultTimes);

      const rowGubun = safeTrim(row.gubun, "nor");
      const rowPt = safeTrim(row.position_type, "");

      Object.entries(row)
        .filter(([key]) => key.startsWith("day_"))
        .forEach(([key, val]) => {
          const dayNum = parseInt(key.replace("day_", ""), 10);
          if (Number.isNaN(dayNum) || dayNum === 0) return;

          const originalVal = useDiffMode && originalRow ? originalRow[key] : null;

          if (useDiffMode) {
            if (isCellEqual(val, originalVal)) return;
          }

          const curType = safeTrim(val?.type, "");
          const orgType = safeTrim(originalVal?.type, "");

          const cleared =
            (curType === "0" || curType === "") && !(orgType === "" || orgType === "0");

          const gubun = safeTrim(val?.gubun, rowGubun);
          const pt = safeTrim(val?.position_type, rowPt);

          // ✅ 직원파출 저장 시 현재 거래처(account_id)로 강제
          const isEmployeeDispatchSave =
            String(curType) === "6" || String(orgType) === "6" || String(val?.type ?? "") === "6";
          const resolvedAccountId =
            isEmployeeDispatchSave && selectedAccountId
              ? selectedAccountId
              : val?.account_id || row.account_id || selectedAccountId || "";

          if (cleared) {
            const recordObj = {
              gubun,
              account_id: resolvedAccountId,
              member_id: val?.member_id || row.member_id || "",
              position_type: pt,
              positionType: pt,
              record_date: dayNum,
              record_year: year,
              record_month: month,
              type: 0,
              // ✅ 추가: type 0(삭제/비출근 처리)면 출근여부 N
              is_present: "N",
              start_time: "",
              end_time: "",
              salary: 0,
              note: "",
              position: row.position || "",
              org_start_time,
              org_end_time,
            };

            const gg = safeTrim(recordObj.gubun, "nor").toLowerCase();
            if (gg === "dis") {
              recordObj.pay_yn = "N";
              disRecords.push(recordObj);
            } else if (gg === "rec") {
              recRecords.push(recordObj);
            } else {
              normalRecords.push(recordObj);
            }
            return;
          }

          if (!val || !curType || curType === "0") return;

          const recordObj = {
            gubun,
            account_id: resolvedAccountId,
            member_id: val.member_id || row.member_id || "",
            position_type: pt,
            positionType: pt,
            record_date: dayNum,
            record_year: year,
            record_month: month,
            type: Number(curType),
            start_time: val.start || "",
            end_time: val.end || "",
            salary: val.salary ? Number(String(val.salary).replace(/,/g, "")) : 0,
            note: val.note || "",
            position: row.position || "",
            org_start_time,
            org_end_time,
          };

          const gg = safeTrim(recordObj.gubun, "nor").toLowerCase();
          if (gg === "dis") {
            recordObj.pay_yn = String(val?.pay_yn ?? "N").toUpperCase() === "Y" ? "Y" : "N";
            disRecords.push(recordObj);
          } else if (gg === "rec") {
            recRecords.push(recordObj);
          } else {
            normalRecords.push(recordObj);
          }
        });
    });

    if (!normalRecords.length && !disRecords.length && !recRecords.length) {
      Swal.fire({ title: "안내", text: "변경된 내용이 없습니다.", icon: "info" });
      return;
    }

    try {
      const res = await api.post("/Account/AccountRecordSave", {
        normalRecords,
        disRecords,
        recRecords,
      });

      if (res.data?.code === 200) {
        Swal.fire({ title: "저장", text: "저장 완료", icon: "success" });

        // ✅ 변경 스냅샷 갱신
        setOriginalAttendanceRows(JSON.parse(JSON.stringify(attendanceRows)));

        // ✅ 저장 후 우측 2개 테이블을 로딩 없이 "쓱" 갱신
        await Promise.all([fetchMemberOnlySilently(), fetchDispatchOnly(dispatchDelFilter)]);
      } else {
        Swal.fire({ title: "실패", text: "저장 실패", icon: "error" });
      }
    } catch (err) {
      console.error("저장 실패:", err);
      Swal.fire({ title: "실패", text: "저장 실패", icon: "error" });
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <DashboardNavbar title="🚌 출근부" />
        <MDBox
          pt={1}
          pb={3}
          sx={{
            display: "flex",
            flexWrap: isMobile ? "wrap" : "nowrap",
            justifyContent: isMobile ? "flex-start" : "flex-end",
            alignItems: "center",
            gap: isMobile ? 1 : 2,
          }}
        >
          <Box
            sx={{
              flexWrap: isMobile ? "wrap" : "nowrap",
              justifyContent: isMobile ? "flex-start" : "flex-end",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "right",
              gap: 1,
            }}
          >
            <Autocomplete
              size="small"
              options={accountList || []}
              value={(accountList || []).find((a) => a.account_id === selectedAccountId) || null}
              onChange={(_, newVal) => {
                setSelectedAccountId(newVal?.account_id || "");
              }}
              inputValue={accountInput}
              onInputChange={(_, newValue) => setAccountInput(newValue)}
              getOptionLabel={(opt) => opt?.account_name || ""}
              isOptionEqualToValue={(opt, val) => opt?.account_id === val?.account_id}
              sx={{ minWidth: 200 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="거래처 검색"
                  placeholder="거래처명을 입력"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      selectAccountByInput();
                    }
                  }}
                  sx={{
                    "& .MuiInputBase-root": { height: 40, fontSize: 12 },
                    "& input": { padding: "0 8px" },
                  }}
                />
              )}
            />

            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              size="small"
              sx={{
                minWidth: isMobile ? 90 : 110,
                "& .MuiSelect-select": { fontSize: isMobile ? "0.75rem" : "0.875rem" },
              }}
            >
              {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
                <MenuItem key={y} value={y}>
                  {y}년
                </MenuItem>
              ))}
            </Select>

            <Select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              size="small"
              sx={{
                minWidth: isMobile ? 80 : 100,
                "& .MuiSelect-select": { fontSize: isMobile ? "0.75rem" : "0.875rem" },
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <MenuItem key={m} value={m}>
                  {m}월
                </MenuItem>
              ))}
            </Select>

            <MDButton
              variant="gradient"
              color="success"
              onClick={handleApplyDefaultTime}
              sx={{
                fontSize: isMobile ? "0.7rem" : "0.8rem",
                minWidth: isMobile ? 110 : 130,
                px: isMobile ? 1 : 2,
              }}
            >
              출퇴근 일괄 적용
            </MDButton>

            <MDButton
              variant="gradient"
              color="dark"
              onClick={openExcelRangeModal}
              disabled={excelDownloading}
              sx={{
                fontSize: isMobile ? "0.7rem" : "0.8rem",
                minWidth: isMobile ? 90 : 140,
                px: isMobile ? 1 : 2,
                opacity: excelDownloading ? 0.6 : 1,
              }}
            >
              {excelDownloading ? "엑셀 생성 중..." : "전체 거래처 엑셀"}
            </MDButton>

            <MDButton
              variant="gradient"
              color="primary"
              onClick={openPayRangeModal}
              sx={{
                fontSize: isMobile ? "0.7rem" : "0.8rem",
                minWidth: isMobile ? 90 : 130,
                px: isMobile ? 1 : 2,
              }}
            >
              지급 일괄
            </MDButton>

            <MDButton
              variant="gradient"
              color="warning"
              onClick={async () => {
                await fetchAllData?.();
                // ✅ 조회 버튼 눌렀을 때 파출도 즉시 재조회 + 스냅샷 갱신(빨간글씨 초기화)
                await fetchDispatchOnly(dispatchDelFilter);
                await fetchDispatchMappingOnly();
              }}
              sx={{
                fontSize: isMobile ? "0.7rem" : "0.8rem",
                minWidth: isMobile ? 70 : 90,
                px: isMobile ? 1 : 2,
              }}
            >
              조회
            </MDButton>

            <MDButton
              variant="gradient"
              color="info"
              onClick={handleSave}
              sx={{
                fontSize: isMobile ? "0.7rem" : "0.8rem",
                minWidth: isMobile ? 70 : 90,
                px: isMobile ? 1 : 2,
              }}
            >
              저장
            </MDButton>
          </Box>
        </MDBox>
      </MDBox>

      <Grid container spacing={5}>
        {/* 출근 현황 */}
        <Grid item xs={12}>
          <Card>
            <MDBox
              mx={0}
              mt={1}
              py={1}
              px={2}
              variant="gradient"
              bgColor="info"
              borderRadius="lg"
              coloredShadow="info"
            >
              <MDTypography variant="h6" color="white">
                출근 현황
              </MDTypography>
            </MDBox>

            <MDBox pt={0} sx={tableSx}>
              <table className="recordsheet-table" style={{ tableLayout: "fixed" }}>
                <thead>
                  {attendanceTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th key={header.id}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {attendanceTable.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => {
                        const rowDelYn = String(row.original?.del_yn ?? "").toUpperCase();
                        const memberId = safeTrim(
                          row.original?.member_id ?? row.original?.memberId ?? "",
                          ""
                        );
                        const fallbackDelYn =
                          (memberId && memberDelYnMap.get(memberId)) ||
                          memberDelYnMap.get(safeTrim(row.original?.name ?? "", "")) ||
                          "N";
                        const isRetired = rowDelYn === "Y" || fallbackDelYn === "Y";
                        const isJoinLocked =
                          cell.column.id.startsWith("day_") &&
                          isCellLockedByActJoin(row.original, cell.column.id);
                        let bg = "";
                        if (isRetired && cell.column.id === "name") {
                          bg = "#ffe5e5";
                        } else if (isJoinLocked) {
                          bg = "#e0e0e0";
                        } else if (cell.column.id.startsWith("day_")) {
                          const v = cell.getValue();
                          bg = typeColors[v?.type || ""] || "";
                        }
                        return (
                          <td
                            key={cell.id}
                            style={{
                              width: cell.column.columnDef.size,
                              backgroundColor: bg,
                              pointerEvents: isJoinLocked ? "none" : "auto",
                              userSelect: isJoinLocked ? "none" : "auto",
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* ✅ 일자별 출근자 수 요약 행 */}
                  <tr>
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        bottom: 0,
                        background: "#f0f0f0",
                        zIndex: 6,
                        fontWeight: "bold",
                      }}
                    >
                      출근자 수
                    </td>

                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const key = `day_${i + 1}`;
                      const cnt = dayWorkCounts[key] || 0;
                      return (
                        <td
                          key={key}
                          style={{
                            position: "sticky",
                            bottom: 0,
                            backgroundColor: "#fafafa",
                            fontWeight: "bold",
                            textAlign: "center",
                            zIndex: 5,
                          }}
                        >
                          {cnt}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </MDBox>
          </Card>
        </Grid>

        {/* 직원 정보 */}
        <Grid item xs={12} md={6}>
          <Card>
            <MDBox
              mx={0}
              mt={-3}
              py={1}
              px={2}
              variant="gradient"
              bgColor="info"
              borderRadius="lg"
              coloredShadow="info"
            >
              <MDTypography variant="h6" color="white">
                직원 정보
              </MDTypography>
            </MDBox>
            <MDBox pt={0} sx={tableSx}>
              <table className="recordsheet-table">
                <thead>
                  {employeeTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th key={header.id}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {employeeTable.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </MDBox>
          </Card>
          {employeeDispatchRows.length > 0 && (
            <Card sx={{ mt: 6 }}>
              <MDBox
                mx={0}
                mt={-3}
                py={1}
                px={2}
                variant="gradient"
                bgColor="info"
                borderRadius="lg"
                coloredShadow="info"
              >
                <MDTypography variant="h6" color="white">
                  직원파출 정보
                </MDTypography>
              </MDBox>
              <MDBox pt={0} sx={tableSx}>
                <table className="recordsheet-table">
                  <thead>
                    <tr>
                      <th>직원명</th>
                      <th>원소속</th>
                      <th>파견업장</th>
                      <th>횟수</th>
                      <th>금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeDispatchRows.map((r, idx) => (
                      <tr key={`${r.name}_${idx}`}>
                        <td>{r.name || "-"}</td>
                        <td>{r.origin || "-"}</td>
                        <td>{r.dispatch || "-"}</td>
                        <td>{r.count > 0 ? `${r.count}회` : "-"}</td>
                        <td>{r.amount ? `${formatMoneyLike(r.amount)}원` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MDBox>
            </Card>
          )}
        </Grid>

        {/* 파출 정보 */}
        <Grid item xs={12} md={6}>
          <Card>
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
              alignItems="center"
              justifyContent="space-between"
            >
              <MDTypography variant="h6" color="white">
                파출 정보 {dispatchLoading ? "(조회중...)" : ""}
              </MDTypography>

              <MDBox display="flex" alignItems="center" gap={1}>
                <Select
                  value={dispatchDelFilter}
                  onChange={(e) => {
                    // ✅ 필터만 바꾸면 useEffect가 자동 재조회 + snapshot 갱신
                    setDispatchDelFilter(e.target.value);
                  }}
                  size="small"
                  sx={{
                    minWidth: isMobile ? 110 : 140,
                    background: "white",
                    borderRadius: 1,
                    "& .MuiSelect-select": {
                      fontSize: isMobile ? "0.75rem" : "0.8rem",
                      py: 0.5,
                    },
                  }}
                >
                  <MenuItem value="N">유지</MenuItem>
                  <MenuItem value="Y">삭제</MenuItem>
                </Select>

                <MDButton
                  variant="gradient"
                  color="warning"
                  size="small"
                  onClick={handleDispatchSave}
                  sx={{ minWidth: 70, fontSize: isMobile ? "0.75rem" : "0.8rem", py: 0.5 }}
                >
                  저장
                </MDButton>

                <MDButton
                  variant="gradient"
                  color="success"
                  size="small"
                  onClick={handleModalOpen}
                  sx={{ minWidth: 90, fontSize: isMobile ? "0.75rem" : "0.8rem", py: 0.5 }}
                >
                  파출등록
                </MDButton>
              </MDBox>
            </MDBox>

            <MDBox pt={0} sx={tableSx}>
              <table className="recordsheet-table">
                <thead>
                  {dispatchTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th key={header.id} style={dispatchColStyle(header.column.id)}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {dispatchTable.getRowModel().rows.map((row) => {
                    const key = getDispatchRowKey(row.original);
                    const isOpen = !!dispatchMemoOpen?.[key];
                    const note = safeTrim(row.original?.note ?? "", "");
                    return (
                      <React.Fragment key={row.id}>
                        <tr>
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} style={dispatchColStyle(cell.column.id)}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                        {isOpen && (
                          <tr>
                            <td
                              colSpan={row.getVisibleCells().length}
                              style={{
                                textAlign: "left",
                                background: "#fafafa",
                                fontSize: "0.75rem",
                                padding: "6px 8px",
                              }}
                            >
                              <b>메모</b> {note || "메모 없음"}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </MDBox>
          </Card>
        </Grid>
      </Grid>

      {/* 등록 모달 */}
      <Modal open={open} onClose={handleModalClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 500,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 5,
          }}
        >
          <MDTypography variant="h6" gutterBottom>
            파출직원 등록
          </MDTypography>

          <TextField
            fullWidth
            margin="normal"
            label="이름"
            name="name"
            value={formData.name}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="연락처"
            name="phone"
            value={formData.phone}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="주민번호"
            name="rrn"
            value={formData.rrn}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="계좌정보"
            name="account_number"
            value={formData.account_number}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            onChange={handleChange}
          />
          <Select
            fullWidth
            size="small"
            name="position_type" // ✅ 중요
            value={formData.position_type || "4"}
            onChange={handleChange} // ✅ 중요 (공용 handleChange 사용)
            displayEmpty
            sx={{ mt: 2, height: 40 }}
          >
            <MenuItem value="4">조리사</MenuItem>
            <MenuItem value="5">조리원</MenuItem>
          </Select>
          <TextField
            fullWidth
            margin="normal"
            label="파출업체"
            name="dispatch_account"
            value={formData.dispatch_account}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="메모"
            name="note"
            value={formData.note}
            InputLabelProps={{ style: { fontSize: "0.7rem" } }}
            onChange={handleChange}
          />

          <Box mt={3} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={handleModalClose}
              sx={{
                bgcolor: "#e8a500",
                color: "#ffffff",
                "&:hover": { bgcolor: "#e8a500", color: "#ffffff" },
              }}
            >
              취소
            </Button>
            <Button variant="contained" onClick={handleSubmit} sx={{ color: "#ffffff" }}>
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
      <Modal open={excelRangeOpen} onClose={() => setExcelRangeOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? "92vw" : 420,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 2,
          }}
        >
          <MDTypography variant="h6" sx={{ mb: 1 }}>
            엑셀 기간 선택
          </MDTypography>
          <MDTypography variant="caption" sx={{ color: "#666" }}>
            월을 넘어도 선택 가능합니다. (예: 2026-02-19 ~ 2026-03-04)
          </MDTypography>

          <Box mt={2} display="flex" gap={1}>
            <TextField
              type="date"
              fullWidth
              label="시작일"
              InputLabelProps={{ shrink: true }}
              value={excelRange.start}
              onChange={(e) => setExcelRange((prev) => ({ ...prev, start: e.target.value }))}
            />
            <TextField
              type="date"
              fullWidth
              label="종료일"
              InputLabelProps={{ shrink: true }}
              value={excelRange.end}
              onChange={(e) => setExcelRange((prev) => ({ ...prev, end: e.target.value }))}
            />
          </Box>

          <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="outlined"
              onClick={() => setExcelRangeOpen(false)}
              sx={excelModalBtn.outline}
            >
              취소
            </Button>
            <Button variant="contained" onClick={handleExcelRangeConfirm} sx={excelModalBtn.solid}>
              다운로드
            </Button>
          </Box>
        </Box>
      </Modal>

      <Modal open={payRangeOpen} onClose={() => setPayRangeOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? "94vw" : 620,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 2,
          }}
        >
          <MDTypography variant="h6" sx={{ mb: 0.5 }}>
            지급 일괄 처리
          </MDTypography>
          <MDTypography variant="caption" sx={{ color: "#666" }}>
            기간을 선택하고 계산을 누르면 파출 급여 합계가 계산됩니다.
          </MDTypography>

          <Box mt={2} display="flex" gap={1}>
            <TextField
              type="date"
              fullWidth
              label="시작일"
              InputLabelProps={{ shrink: true }}
              value={payRange.start}
              onChange={(e) => setPayRange((prev) => ({ ...prev, start: e.target.value }))}
            />
            <TextField
              type="date"
              fullWidth
              label="종료일"
              InputLabelProps={{ shrink: true }}
              value={payRange.end}
              onChange={(e) => setPayRange((prev) => ({ ...prev, end: e.target.value }))}
            />
          </Box>

          <Box mt={1.5} display="flex" justifyContent="flex-end" gap={1}>
            <Button
              variant="outlined"
              onClick={() => setPayRangeOpen(false)}
              sx={payModalBtn.outline}
            >
              닫기
            </Button>
            <Button
              variant="contained"
              onClick={handlePayRangeCompute}
              disabled={payRangeLoading}
              sx={payModalBtn.solid}
            >
              {payRangeLoading ? "계산 중..." : "계산"}
            </Button>
          </Box>

          {payRangeRows.length > 0 && (
            <>
              <Box
                mt={2}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                sx={{ fontSize: "0.8rem" }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <Checkbox
                    size="small"
                    sx={payCheckboxSx}
                    checked={payRangeAllSelected}
                    indeterminate={payRangeSomeSelected}
                    onChange={(e) => handlePayRangeToggleAll(e.target.checked)}
                  />
                  <span>전체선택</span>
                </Box>
                <Box>
                  총 {payRangeSummary.totalCount}명 / 합계{" "}
                  {formatMoneyLike(payRangeSummary.totalSum)}
                  {payRangeSummary.selectedCount > 0 && (
                    <>
                      {" "}
                      | 선택 {payRangeSummary.selectedCount}명 / 선택합계{" "}
                      {formatMoneyLike(payRangeSummary.selectedSum)}
                    </>
                  )}
                </Box>
              </Box>

              <Box
                mt={1}
                sx={{
                  maxHeight: 260,
                  overflow: "auto",
                  border: "1px solid #ddd",
                  borderRadius: 1,
                }}
              >
                <table className="recordsheet-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>선택</th>
                      <th>이름</th>
                      <th>연락처</th>
                      <th>합계</th>
                      <th>지급상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payRangeRows.map((r) => (
                      <tr key={r.member_id}>
                        <td>
                          <Checkbox
                            size="small"
                            sx={payCheckboxSx}
                            checked={!!payRangeSelected?.[r.member_id]}
                            onChange={(e) => handlePayRangeToggleOne(r.member_id, e.target.checked)}
                          />
                        </td>
                        <td>{r.name || ""}</td>
                        <td>{r.phone || ""}</td>
                        <td>{formatMoneyLike(r.total_pay || 0)}</td>
                        <td>
                          {r.pay_status} {r.total_cnt > 0 ? `(${r.paid_cnt}/${r.total_cnt})` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>

              <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
                <Button
                  variant="outlined"
                  onClick={() => handlePayRangeToggleAll(false)}
                  sx={payModalBtn.outline}
                >
                  선택 해제
                </Button>
                <Button variant="contained" onClick={handlePayRangeApply} sx={payModalBtn.solid}>
                  선택 지급
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Modal>
    </DashboardLayout>
  );
}

export default RecordSheet;
