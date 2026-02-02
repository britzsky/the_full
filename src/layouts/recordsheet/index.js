/* eslint-disable react/prop-types */
import React, { useMemo, useEffect, useState, useCallback } from "react";
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
};

const TYPE_LABEL = {
  0: "-",
  1: "영양사",
  2: "상용",
  3: "초과",
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
};

const safeStr = (v, fallback = "") => (v == null ? fallback : String(v));
const safeTrim = (v, fallback = "") => safeStr(v, fallback).trim();

// ✅ 계좌정보에서 은행명 추출
// 예) "농협 130033-52-192654" -> "농협"
// 예) "국민은행 123-456-789" -> "국민은행"
// 예) "신한 110-..." -> "신한"
// 예) "카카오뱅크 3333-..." -> "카카오뱅크"
// ✅ 은행명 추출
const extractBankName = (accountNumber) => {
  const s = safeTrim(accountNumber, "");
  if (!s) return "";

  // 앞 토큰이 보통 은행명
  const firstToken = s.split(/\s+/)[0] || "";

  // "농협", "국민은행", "NH농협", "IBK기업" 등 대응
  const m = s.match(/^([A-Za-z가-힣]+(?:은행)?)/) || firstToken.match(/^([A-Za-z가-힣]+(?:은행)?)/);

  return safeTrim(m?.[1] ?? firstToken, "");
};

// ✅ 계좌번호만 추출 (은행명 제거 + 숫자/하이픈만 남기기)
const extractAccountOnly = (accountNumber) => {
  const s = safeTrim(accountNumber, "");
  if (!s) return "";

  // 1) 은행명 부분 제거(앞쪽)
  const bank = extractBankName(s);
  let rest = s;
  if (bank) {
    // "은행명 " 또는 "은행명" 제거
    rest = rest.replace(new RegExp(`^\\s*${bank}\\s*`), "");
  }

  // 2) 남은 문자열에서 숫자/하이픈만 추출
  //    (띄어쓰기, 괄호, 기타 문자 제거)
  const only = rest.replace(/[^0-9-]/g, "").trim();

  // 3) 혹시 bank 제거 후 아무것도 안 남으면(은행명 없이 계좌번호만 있었던 케이스)
  //    원본에서 다시 추출
  if (!only) {
    return s.replace(/[^0-9-]/g, "").trim();
  }

  return only;
};

// ✅ 숫자/문자 모두 보기좋게(엑셀 셀) 표시
const formatMoneyLike = (v) => {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";

  // 이미 "6회, 520000원" 같은 문자열이면 그대로
  if (/[가-힣]/.test(s) || /회/.test(s) || /원/.test(s)) return s;

  // 숫자로만 들어오면 콤마
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isNaN(n)) return n.toLocaleString();

  return s;
};

// ✅ 셀 비교용 헬퍼
const normalizeCell = (cell) => {
  if (!cell) return { type: "", start: "", end: "", salary: 0, memo: "" };

  const toNum = (v) => {
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  return {
    type: cell.type ?? "",
    start: cell.start || cell.start_time || "",
    end: cell.end || cell.end_time || "",
    salary: toNum(cell.salary),
    memo: cell.memo ?? cell.note ?? "",
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
    na.memo === nb.memo
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
  const val = getValue() || { type: "", start: "", end: "", salary: "", memo: "" };

  const times = [];
  for (let h = 5; h <= 20; h++) {
    for (let m of ["00", "30"]) {
      if (h === 20 && m !== "00") continue;
      times.push(`${h.toString().padStart(2, "0")}:${m}`);
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

      gubun_raw: baseValue.gubun ?? val.gubun ?? rowGubun,

      [field]: newVal,
    };

    // ✅ type을 0/-로 내리면 나머지 초기화
    if (field === "type" && (newVal === "0" || newVal === "")) {
      updatedValue.start = "";
      updatedValue.end = "";
      updatedValue.start_time = "";
      updatedValue.end_time = "";
      updatedValue.salary = "";
      updatedValue.memo = "";
    }

    // 🔹 초과근무 자동 계산
    if (
      updatedValue.type === "3" &&
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
        const diffMinutes = end.diff(start, "minute") - baseEnd.diff(baseStart, "minute");

        updatedValue.memo =
          diffMinutes > 0
            ? (Math.floor(diffMinutes / 60) + (diffMinutes % 60 >= 30 ? 0.5 : 0)).toString()
            : "";
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
        padding: "2px",
        borderRadius: "4px",
        width: "100%",
      }}
    >
      <select
        value={val.type}
        onChange={(e) => handleChange("type", e.target.value)}
        style={{ fontSize: "0.75rem", textAlign: "center", width: "100%" }}
      >
        {typeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {["1", "2", "3", "5", "6", "7", "8"].includes(val.type) && (
        <>
          <select
            value={val.start}
            onChange={(e) => handleChange("start", e.target.value)}
            style={{ fontSize: "0.725rem", width: "100%" }}
          >
            <option value="">출근</option>
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={val.end}
            onChange={(e) => handleChange("end", e.target.value)}
            style={{ fontSize: "0.725rem", width: "100%" }}
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

      {["5", "6"].includes(val.type) && (
        <input
          type="text"
          placeholder="급여"
          value={val.salary != null && val.salary !== "" ? Number(val.salary).toLocaleString() : ""}
          onChange={(e) => handleChange("salary", e.target.value.replace(/[^0-9]/g, ""))}
          style={{
            fontSize: "0.725rem",
            textAlign: "center",
            border: "1px solid black",
            width: "100%",
          }}
        />
      )}

      {["3", "11"].includes(val.type) && (
        <input
          type="text"
          placeholder={val.type === "3" ? "초과" : "대체휴무"}
          value={val.memo ?? ""}
          onChange={(e) => handleChange("memo", e.target.value)}
          style={{
            fontSize: "0.725rem",
            textAlign: "center",
            border: "1px solid black",
            width: "100%",
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

// ✅ 파출 삭제/복원 버튼 셀
function DispatchActionCell({ row, onToggle }) {
  const delYn = row.original?.del_yn ?? "N";
  const isDeleted = delYn === "Y";

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

function RecordSheet() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const [attendanceRows, setAttendanceRows] = useState([]);
  const [originalAttendanceRows, setOriginalAttendanceRows] = useState([]);
  const [defaultTimes, setDefaultTimes] = useState({});
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [dispatchDelFilter, setDispatchDelFilter] = useState("N");

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const account_name = queryParams.get("name");

  const { account_id } = useParams();
  const daysInMonth = dayjs(`${year}-${month}`).daysInMonth();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [open, setOpen] = useState(false);
  const handleModalOpen = () => setOpen(true);

  const [excelDownloading, setExcelDownloading] = useState(false);

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

  // ✅ type 키가 record_type/work_type 등으로 올 수 있어서 통일
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
        item.days.find((x) => Number(x?.record_date) === d) ||
        item.days.find((x) => Number(x?.record_day) === d) ||
        item.days.find((x) => Number(x?.day) === d) ||
        item.days.find((x) => Number(x?.date) === d);
      if (found) return found;
    }

    const key2 = `day_${String(d).padStart(2, "0")}`;
    if (item[key2]) return item[key2];
    if (item.days && typeof item.days === "object" && item.days[key2]) return item.days[key2];

    return null;
  };

  // =========================
  // ✅ 3) long 형태(record_date 1줄=하루)을 pivot 형태(day_1..day_N)로 변환
  // =========================
  const normalizeSheetRows = (rows, daysInMonthArg) => {
    const arr = Array.isArray(rows) ? rows : [];
    if (arr.length === 0) return [];

    const sample = arr[0] || {};
    const keys = Object.keys(sample);

    const hasPivotDayKey = keys.some((k) => /^day_\d+$/.test(k));
    const hasDaysField = sample.days && typeof sample.days === "object";
    if (hasPivotDayKey || hasDaysField) return arr;

    const hasLongDay =
      sample.record_date != null ||
      sample.record_day != null ||
      sample.day != null ||
      sample.date != null;

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
          gubun: r.gubun ?? "nor",
          position_type: r.position_type ?? "",
          day_default: r.day_default || null,
        });
      }

      const g = map.get(mid);
      const dayNum = Number(r.record_date ?? r.record_day ?? r.day ?? r.date);

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

    const newAttendance = (normalizedSheetRows || []).map((item) => {
      const member = (memberRowsArg || []).find((m) => m.member_id === item.member_id);

      const baseGubun = safeTrim(item.gubun ?? item.day_default?.gubun, "nor");
      const basePt = safeTrim(item.position_type ?? item.day_default?.position_type, "");

      const base = {
        name: item.name,
        account_id: item.account_id,
        member_id: item.member_id,
        position: item.position || member?.position || "",
        gubun: baseGubun,
        position_type: basePt,
        day_default: item.day_default || null,
      };

      const dayEntries = {};
      for (let d = 1; d <= daysInMonthArg; d++) {
        const key = `day_${d}`;
        const source = getDaySource(item, d) || item[key] || null;

        const t = pickType(source);

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
              memo: source.memo ?? source.note ?? "",
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
              memo: "",
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

  // ✅ 거래처 1개에 대한 모든 데이터 조회 함수 (엑셀 전체다운용)
  const fetchBundleForAccount = async (accountId) => {
    const sheetRes = await api.get("/Account/AccountRecordSheetList", {
      params: { account_id: accountId, year, month },
    });
    const sheetRowsArg = extractArray(sheetRes.data);

    const memberRes = await api.get("/Account/AccountRecordMemberList", {
      params: { account_id: accountId, year, month },
    });
    const memberRowsArg = extractArray(memberRes.data);

    const timeRes = await api.get("/Account/AccountMemberRecordTime", {
      params: { account_id: accountId, year, month },
    });
    const timesRowsArg = extractArray(timeRes.data);

    const [disN, disY] = await Promise.all([
      api.get("/Account/AccountRecordDispatchList", {
        params: { account_id: accountId, year, month, del_yn: "N" },
      }),
      api.get("/Account/AccountRecordDispatchList", {
        params: { account_id: accountId, year, month, del_yn: "Y" },
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

  // ✅ 엑셀 셀 출력 문자열
  function formatDayCell(cell) {
    const t = safeTrim(cell?.type, "");
    if (!cell || !t || t === "0") return "";

    const typeLabel = TYPE_LABEL[String(t)] ?? String(t);

    const start = cell.start || cell.start_time || "";
    const end = cell.end || cell.end_time || "";
    const salary =
      cell.salary != null && String(cell.salary).trim() !== ""
        ? Number(String(cell.salary).replace(/,/g, "")).toLocaleString()
        : "";
    const memo = cell.memo ?? cell.note ?? "";

    const lines = [
      typeLabel,
      start || end ? `${start}~${end}` : "",
      salary ? `급여: ${salary}` : "",
      memo ? `메모: ${memo}` : "",
    ].filter(Boolean);

    return lines.join("\n");
  }

  // ✅ 거래처 전체 엑셀 다운로드 (2시트: 출근현황/파출정보)
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

      const filename = `출근부_전체거래처_${year}-${String(month).padStart(2, "0")}.xlsx`;

      const wsAttend = wb.addWorksheet("출근현황(전체)");
      const wsDispatch = wb.addWorksheet("파출정보(전체)");

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

      // =========================
      // ✅ 출근현황(전체) : 기존처럼 업장별 섹션 유지
      // =========================
      const attendColCount = 1 + daysInMonth;
      wsAttend.columns = [
        { width: 14 },
        ...Array.from({ length: daysInMonth }, () => ({ width: 14 })),
      ];

      // =========================
      // ✅ 파출정보(전체) : 업장별 섹션 제거 + 한 번에 쭉
      //    + 은행 컬럼 추가
      //    + 금액은 total 대신 salary 사용
      // =========================
      const dispatchHeader = [
        "거래처",
        "이름",
        "연락처",
        "주민등록번호",
        "은행",
        "계좌정보",
        "급여", // ✅ total 대신 salary
        "삭제여부(del_yn)",
      ];

      wsDispatch.columns = [
        { width: 18 }, // 거래처
        { width: 12 }, // 이름
        { width: 14 }, // 연락처
        { width: 18 }, // 주민등록번호
        { width: 12 }, // 은행
        { width: 28 }, // 계좌정보
        { width: 14 }, // 급여
        { width: 14 }, // 삭제여부
      ];

      // ✅ 파출정보 제목(한 번만)
      addSectionTitle(
        wsDispatch,
        `■ 파출정보 / ${year}-${String(month).padStart(2, "0")}`,
        dispatchHeader.length
      );
      wsDispatch.addRow(dispatchHeader);
      styleHeaderRow(wsDispatch, wsDispatch.lastRow.number);

      // ✅ 파출정보 누적 rows
      const allDispatchRows = [];

      for (let i = 0; i < accountList.length; i++) {
        const acc = accountList[i];
        const accId = acc.account_id;
        const accName = acc.account_name || accId;

        const { sheetRowsArg, memberRowsArg, timesRowsArg, dispatchRowsArg } =
          await fetchBundleForAccount(accId);

        // ----- 출근현황 섹션 (기존 그대로) -----
        const { attendanceRowsBuilt } = buildAttendanceRowsFromSheet(
          sheetRowsArg,
          memberRowsArg,
          timesRowsArg,
          daysInMonth
        );

        addSectionTitle(
          wsAttend,
          `■ ${accName} (${accId})  /  ${year}-${String(month).padStart(2, "0")}`,
          attendColCount
        );

        const header = ["직원명", ...Array.from({ length: daysInMonth }, (_, d) => `${d + 1}일`)];
        wsAttend.addRow(header);
        styleHeaderRow(wsAttend, wsAttend.lastRow.number);

        (attendanceRowsBuilt || []).forEach((row) => {
          const r = [row.name || ""];
          for (let d = 1; d <= daysInMonth; d++) {
            const key = `day_${d}`;
            r.push(formatDayCell(row[key]));
          }
          wsAttend.addRow(r);
          styleDataRow(wsAttend, wsAttend.lastRow.number);
        });

        wsAttend.addRow([]);
        wsAttend.addRow([]);

        // ----- 파출정보는 "모아서 한 번에" -----
        (dispatchRowsArg || []).forEach((d) => {
          allDispatchRows.push({
            accName,
            name: d.name || "",
            phone: d.phone || "",
            rrn: d.rrn || "",
            account_number: d.account_number || "",
            salary: d.salary ?? "", // ✅ salary 우선
            total: d.total ?? "",
            del_yn: d.del_yn ?? "N",
          });
        });
      }

      // ✅ 파출정보 시트에 누적된 데이터 한 번에 출력
      allDispatchRows.forEach((d) => {
        const bank = extractBankName(d.account_number);
        const accountOnly = extractAccountOnly(d.account_number); // ✅ 추가
        const pay = d.salary !== "" && d.salary != null ? d.salary : d.total;

        wsDispatch.addRow([
          d.accName,
          d.name,
          d.phone,
          d.rrn,
          bank,
          accountOnly, // ✅ 여기: 계좌정보는 계좌번호만
          formatMoneyLike(pay),
          d.del_yn,
        ]);

        styleDataRow(wsDispatch, wsDispatch.lastRow.number);
      });

      wsAttend.views = [{ state: "frozen", xSplit: 0, ySplit: 0 }];
      wsDispatch.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }]; // 제목+헤더 고정 느낌

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
  const COUNT_TYPES = new Set(["1", "2", "3", "5", "6", "7", "8"]);
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
    note: "",
  });

  const handleModalClose = () => {
    setFormData({
      account_id: selectedAccountId,
      name: "",
      phone: "",
      rrn: "",
      account_number: "",
      note: "",
    });
    setOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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

    formData.del_yn = "N";

    api
      .post("/Account/AccountDispatchMemberSave", formData, {
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
              await fetchDispatchOnly(dispatchDelFilter);
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

  const {
    memberRows,
    dispatchRows,
    setDispatchRows,
    sheetRows,
    timesRows,
    accountList,
    fetchAllData,
    loading,
  } = useRecordsheetData(selectedAccountId, year, month);

  const fetchDispatchOnly = useCallback(
    async (overrideDelYn) => {
      if (!selectedAccountId) return;

      const del_yn = overrideDelYn ?? dispatchDelFilter;

      try {
        const res = await api.get("/Account/AccountRecordDispatchList", {
          params: { account_id: selectedAccountId, year, month, del_yn },
        });

        const list = extractArray(res.data);

        setDispatchRows(
          (Array.isArray(list) ? list : []).map((item) => ({
            ...item,
            account_id: item.account_id,
            member_id: item.member_id,
            name: item.name,
            rrn: item.rrn,
            account_number: item.account_number,
            total: item.total,
            salary: item.salary, // ✅ 혹시 백엔드가 주면 화면에서도 쓸 수 있게 유지
            del_yn: item.del_yn ?? "N",
            dispatch_id: item.dispatch_id ?? item.id,
          }))
        );
      } catch (err) {
        console.error("파출 재조회 실패:", err);
        Swal.fire({
          title: "오류",
          text: "파출직원 조회 중 오류가 발생했습니다.",
          icon: "error",
        });
      }
    },
    [selectedAccountId, year, month, dispatchDelFilter, setDispatchRows]
  );

  const handleToggleDispatch = useCallback(
    async (row) => {
      const cur = row?.del_yn ?? "N";
      const next = cur === "Y" ? "N" : "Y";
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
      const account_id2 = row.account_id;

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

      api
        .post(
          "/Account/AccountDispatchMemberSave",
          {
            account_id: account_id2,
            member_id,
            del_yn: next,
            name: row.name,
            rrn: row.rrn,
            account_number: row.account_number,
            total: row.total,
            salary: row.salary, // ✅ 같이 보냄(백엔드가 받으면 사용)
            phone: row.phone,
          },
          { headers: { "Content-Type": "multipart/form-data" } }
        )
        .then((response) => {
          if (response.data?.code === 200) {
            Swal.fire({
              title: "저장",
              text: `${actionLabel} 처리되었습니다.`,
              icon: "success",
              confirmButtonColor: "#d33",
              confirmButtonText: "확인",
            }).then(async (result) => {
              if (result.isConfirmed) {
                await fetchDispatchOnly(dispatchDelFilter);
              }
            });
          } else {
            Swal.fire({
              title: "실패",
              text: `${actionLabel} 저장에 실패했습니다.`,
              icon: "error",
              confirmButtonColor: "#d33",
              confirmButtonText: "확인",
            });
          }
        })
        .catch(() => {
          Swal.fire({
            title: "실패",
            text: `${actionLabel} 저장에 실패했습니다.`,
            icon: "error",
            confirmButtonColor: "#d33",
            confirmButtonText: "확인",
          });
        });
    },
    [dispatchDelFilter, fetchDispatchOnly]
  );

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

  // ✅ 화면도 buildAttendanceRowsFromSheet 로 통일 (pivot/long 모두 대응)
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
                { value: "4", label: "결근" },
                { value: "5", label: "파출" },
                { value: "6", label: "직원파출" },
                { value: "7", label: "유틸" },
                { value: "8", label: "대체근무" },
                { value: "9", label: "연차" },
                { value: "10", label: "반차" },
                { value: "11", label: "대체휴무" },
                { value: "12", label: "병가" },
                { value: "13", label: "출산휴가" },
                { value: "14", label: "육아휴직" },
                { value: "15", label: "하계휴가" },
              ];
            })();

            return <AttendanceCell {...props} typeOptions={typeOptions} />;
          },
          size: "2%",
        };
      }),
    [daysInMonth, year, month]
  );

  const attendanceColumns = useMemo(
    () => [
      {
        header: "직원명",
        accessorKey: "name",
        size: "2%",
        cell: (info) => <b>{info.getValue()}</b>,
      },
      ...dayColumns,
    ],
    [dayColumns]
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
    },
  });

  const employeeTable = useReactTable({
    data: memberRows,
    columns: [
      { header: "직원명", accessorKey: "name", size: "3%", cell: ReadonlyCell },
      { header: "직책", accessorKey: "position", size: "3%", cell: ReadonlyCell },
      { header: "근로일수", accessorKey: "working_day", size: "3%", cell: ReadonlyCell },
      { header: "직원파출", accessorKey: "employ_dispatch", size: "3%", cell: ReadonlyCell },
      { header: "초과", accessorKey: "over_work", size: "3%", cell: ReadonlyCell },
      { header: "결근", accessorKey: "non_work", size: "3%", cell: ReadonlyCell },
      { header: "비고", accessorKey: "note", size: "20%", cell: ReadonlyCell },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  const dispatchTable = useReactTable({
    data: dispatchRows,
    columns: [
      { header: "이름", accessorKey: "name", size: "3%", cell: ReadonlyCell },
      { header: "연락처", accessorKey: "phone", size: "3%", cell: ReadonlyCell },
      { header: "주민등록번호", accessorKey: "rrn", size: "3%", cell: ReadonlyCell },
      { header: "계좌정보", accessorKey: "account_number", size: "3%", cell: ReadonlyCell },
      { header: "금액", accessorKey: "total", size: "15%", cell: ReadonlyCell }, // 화면은 기존 유지
      {
        header: "관리",
        id: "actions",
        size: "1%",
        cell: ({ row }) => <DispatchActionCell row={row} onToggle={handleToggleDispatch} />,
      },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

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

  // ✅ 저장
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

          if (cleared) {
            const recordObj = {
              gubun,
              account_id: val?.account_id || row.account_id || "",
              member_id: val?.member_id || row.member_id || "",
              position_type: pt,
              positionType: pt,
              record_date: dayNum,
              record_year: year,
              record_month: month,
              type: 0,
              start_time: "",
              end_time: "",
              salary: 0,
              note: "",
              position: row.position || "",
              org_start_time,
              org_end_time,
            };

            const g = safeTrim(recordObj.gubun, "nor").toLowerCase();
            if (g === "dis") disRecords.push(recordObj);
            else if (g === "rec") recRecords.push(recordObj);
            else normalRecords.push(recordObj);
            return;
          }

          if (!val || !curType || curType === "0") return;

          const recordObj = {
            gubun,
            account_id: val.account_id || row.account_id || "",
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
            note: val.memo || "",
            position: row.position || "",
            org_start_time,
            org_end_time,
          };

          const g = safeTrim(recordObj.gubun, "nor").toLowerCase();
          if (g === "dis") disRecords.push(recordObj);
          else if (g === "rec") recRecords.push(recordObj);
          else normalRecords.push(recordObj);
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
        setOriginalAttendanceRows(JSON.parse(JSON.stringify(attendanceRows)));
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
              getOptionLabel={(opt) => opt?.account_name || ""}
              isOptionEqualToValue={(opt, val) => opt?.account_id === val?.account_id}
              sx={{ minWidth: 200 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="거래처 검색"
                  placeholder="거래처명을 입력"
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
              onClick={handleExcelDownloadAllAccounts}
              disabled={excelDownloading}
              sx={{
                fontSize: isMobile ? "0.7rem" : "0.8rem",
                minWidth: isMobile ? 90 : 140,
                px: isMobile ? 1 : 2,
                opacity: excelDownloading ? 0.6 : 1,
              }}
            >
              전체 거래처 엑셀
            </MDButton>

            <MDButton
              variant="gradient"
              color="warning"
              onClick={async () => {
                await fetchAllData?.();
                await fetchDispatchOnly(dispatchDelFilter);
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
              <table className="recordsheet-table">
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
                        let bg = "";
                        if (cell.column.id.startsWith("day_")) {
                          const v = cell.getValue();
                          bg = typeColors[v?.type || ""] || "";
                        }
                        return (
                          <td
                            key={cell.id}
                            style={{
                              width: cell.column.columnDef.size,
                              backgroundColor: bg,
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
                파출 정보
              </MDTypography>

              <MDBox display="flex" alignItems="center" gap={1}>
                <Select
                  value={dispatchDelFilter}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setDispatchDelFilter(v);
                    await fetchDispatchOnly(v);
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

                <MDBox
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  width="1.5rem"
                  height="1.5rem"
                  bgColor="white"
                  shadow="sm"
                  borderRadius="50%"
                  color="warning"
                  sx={{ cursor: "pointer" }}
                  onClick={handleModalOpen}
                >
                  <Icon fontSize="large" color="inherit">
                    add
                  </Icon>
                </MDBox>
              </MDBox>
            </MDBox>

            <MDBox pt={0} sx={tableSx}>
              <table className="recordsheet-table">
                <thead>
                  {dispatchTable.getHeaderGroups().map((hg) => (
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
                  {dispatchTable.getRowModel().rows.map((row) => (
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
    </DashboardLayout>
  );
}

export default RecordSheet;
