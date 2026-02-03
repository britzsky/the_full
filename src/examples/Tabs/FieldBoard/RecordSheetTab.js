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
  useTheme,
  useMediaQuery,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import api from "api/api";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import useRecordsheetData from "./recordSheetData";
import Swal from "sweetalert2";
import LoadingScreen from "layouts/loading/loadingscreen";

// 근무 타입별 배경색
const typeColors = {
  1: "#d9f2d9",
  2: "#fff7cc",
  3: "#e6d9f2",
  4: "#f9d9d9",
  5: "#ffe6cc",
  6: "#cce6ff",
};

const safeStr = (v, fallback = "") => (v == null ? fallback : String(v));
const safeTrim = (v, fallback = "") => safeStr(v, fallback).trim();

// ✅ 셀 비교용 헬퍼: 조회 당시 vs 현재 값이 같은지 판단
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

// ✅ 출근현황 셀 (gubun/position_type 유지 포함)
function AttendanceCell({ getValue, row, column, table, typeOptions }) {
  const val = getValue() || {
    type: "",
    start: "",
    end: "",
    salary: "",
    memo: "",
    gubun: "",
    position_type: "",
  };

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
    const dayKey = column.id;

    const baseValue = row.original?.[dayKey] || {};
    const baseGubun = String(
      baseValue.gubun ??
        val.gubun ??
        row.original?.gubun ??
        row.original?.day_default?.gubun ??
        "nor"
    )
      .trim()
      .toLowerCase();

    const basePosType = String(
      baseValue.position_type ??
        val.position_type ??
        row.original?.position_type ??
        row.original?.day_default?.position_type ??
        ""
    ).trim();

    const updatedValue = {
      ...baseValue,
      ...val,
      gubun: baseGubun,
      position_type: basePosType,
      [field]: newVal,
    };

    // ✅ type을 0으로 내리면 나머지 값도 초기화
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
}

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
// ✅ 파출 테이블: AccountMemberRecSheet 방식 적용
//   - _rid로 매칭
//   - originalMap으로 변경감지(빨간/검정)
//   - 변경분만 저장
//   - year/month/filter 바뀌면 자동 재조회
//   - 레이스 컨디션 방지(마지막 응답만 반영)
// =======================================================

const ensureDispatchRid = (row) => {
  if (!row) return row;
  if (row._rid) return row;

  const base = row.dispatch_id ?? row.member_id ?? row.id ?? "";
  if (base) return { ...row, _rid: String(base) };

  return { ...row, _rid: `DIS_${Date.now()}_${Math.random().toString(16).slice(2)}` };
};

const normalizeDispatchValue = (field, v) => {
  const s = String(v ?? "");
  if (field === "phone" || field === "rrn") return s.replace(/[^0-9]/g, "");
  if (field === "account_number") return s.replace(/\s/g, "");
  if (field === "del_yn") return s.trim().toUpperCase();
  return s.trim();
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
        fontSize: "0.75rem",
        textAlign: "center",
        border: "1px solid #ccc",
        borderRadius: 4,
        padding: "2px 4px",
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

function RecordSheet() {
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");
  const [originalSelectedAccountId, setOriginalSelectedAccountId] = useState(
    () => localAccountId || ""
  );

  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const [attendanceRows, setAttendanceRows] = useState([]);
  const [originalAttendanceRows, setOriginalAttendanceRows] = useState([]);
  const [defaultTimes, setDefaultTimes] = useState({});

  // ✅ 파출 state / snapshot
  const [dispatchRows, setDispatchRows] = useState([]);
  const [originalDispatchRows, setOriginalDispatchRows] = useState([]);
  const [dispatchDelFilter, setDispatchDelFilter] = useState("N");
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // ✅ 레이스 컨디션 방지용 seq
  const dispatchReqSeqRef = useRef(0);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const account_name = queryParams.get("name"); // (미사용이어도 유지)
  const { account_id } = useParams();

  const daysInMonth = dayjs(`${year}-${month}`).daysInMonth();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [open, setOpen] = useState(false);
  const handleModalOpen = () => setOpen(true);

  // ✅ "출근한 사람"으로 카운트할 타입들
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

    const payload = {
      ...formData,
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
              // ✅ 등록 성공 후 파출 자동 재조회
              // (useEffect 자동 재조회가 있으니, 즉시 반영 원하면 여기서도 호출)
              // fetchDispatchOnly(dispatchDelFilter);
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

  const { memberRows, sheetRows, timesRows, accountList, fetchAllData, loading } =
    useRecordsheetData(selectedAccountId, year, month);

  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter((row) => String(row.account_id) === String(localAccountId));
  }, [accountList, localAccountId]);

  const selectedAccountOption = useMemo(() => {
    if (!selectedAccountId) return null;
    return (
      (filteredAccountList || []).find((a) => String(a.account_id) === String(selectedAccountId)) ||
      null
    );
  }, [filteredAccountList, selectedAccountId]);

  // ✅ 백엔드 응답에서 배열 안전 추출 (중첩까지)
  const extractList = (payload) => {
    let x =
      payload?.data ??
      payload?.result ??
      payload?.list ??
      payload?.rows ??
      payload?.items ??
      payload;

    if (Array.isArray(x)) return x;

    if (x && typeof x === "object") {
      const y = x.data ?? x.result ?? x.list ?? x.rows ?? x.items;
      if (Array.isArray(y)) return y;
    }
    return [];
  };

  // ✅ 파출만 조회 (레이스 방지 포함)
  const fetchDispatchOnly = useCallback(
    async (del_yn) => {
      if (!selectedAccountId) return;

      const mySeq = ++dispatchReqSeqRef.current;
      setDispatchLoading(true);

      try {
        const res = await api.get("/Account/AccountRecordDispatchList", {
          params: { account_id: selectedAccountId, year, month, del_yn },
        });

        // ✅ 마지막 요청만 반영
        if (mySeq !== dispatchReqSeqRef.current) return;

        const list = extractList(res?.data);
        const listMapped = (list || []).map((item) => {
          const row = {
            ...item,
            account_id: item.account_id,
            member_id: item.member_id,
            name: item.name,
            phone: item.phone ?? "",
            rrn: item.rrn ?? "",
            account_number: item.account_number ?? "",
            total: item.total,
            del_yn: item.del_yn ?? "N",
            dispatch_id: item.dispatch_id ?? item.id,
          };
          return ensureDispatchRid(row);
        });

        setDispatchRows(listMapped);
        setOriginalDispatchRows(listMapped.map((r) => ({ ...r })));
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
    [selectedAccountId, year, month]
  );

  // ✅ 핵심: year/month/selectedAccountId/filter 바뀌면 자동으로 파출 재조회
  useEffect(() => {
    if (!selectedAccountId) return;
    fetchDispatchOnly(dispatchDelFilter);
  }, [selectedAccountId, year, month, dispatchDelFilter, fetchDispatchOnly]);

  // ✅ 파출 삭제/복원 (즉시 저장 방식 유지)
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
      const account_id_row = row.account_id;

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
        fd.append("account_id", account_id_row ?? selectedAccountId ?? "");
        fd.append("member_id", member_id ?? "");
        fd.append("del_yn", next);
        fd.append("name", row.name ?? "");
        fd.append("rrn", row.rrn ?? "");
        fd.append("account_number", row.account_number ?? "");
        fd.append("total", row.total ?? "");
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

          // ✅ 삭제/복원 후 즉시 재조회(현재 필터 기준)
          fetchDispatchOnly(dispatchDelFilter);
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
    [dispatchDelFilter, fetchDispatchOnly, year, month, selectedAccountId]
  );

  // ✅ 파출 originalMap (_rid 매칭)
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

    const editableFields = ["phone", "rrn", "account_number"];

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
        fd.append("total", r.total || "");
        fd.append("del_yn", r.del_yn ?? "N");
        fd.append("record_year", String(year));
        fd.append("record_month", String(month));

        await api.post("/Account/AccountDispatchMemberSave", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      Swal.fire({ title: "저장", text: "저장 완료", icon: "success" });
      fetchDispatchOnly(dispatchDelFilter);
    } catch (e) {
      Swal.fire({ title: "오류", text: e.message || "저장 중 오류", icon: "error" });
    }
  }, [
    dispatchRows,
    originalDispatchMap,
    selectedAccountId,
    year,
    month,
    dispatchDelFilter,
    fetchDispatchOnly,
  ]);

  // ✅ accountList 로딩 후 selectedAccountId 결정
  useEffect(() => {
    if (!accountList || accountList.length === 0) return;

    if (localAccountId) {
      setSelectedAccountId(localAccountId);
      setOriginalSelectedAccountId(localAccountId);
      return;
    }

    setSelectedAccountId((prev) => {
      if (prev) return prev;

      if (account_id && accountList.some((row) => String(row.account_id) === String(account_id))) {
        setOriginalSelectedAccountId(String(account_id));
        return account_id;
      }
      setOriginalSelectedAccountId(String(accountList[0].account_id));
      return accountList[0].account_id;
    });
  }, [accountList, account_id, localAccountId]);

  // ✅ 선택된 거래처가 바뀌면 formData.account_id 맞추기
  useEffect(() => {
    setFormData((prev) => ({ ...prev, account_id: selectedAccountId }));
  }, [selectedAccountId]);

  // ✅ sheetRows → attendanceRows 구성
  useEffect(() => {
    if (!sheetRows || !sheetRows.length) return;

    const newAttendance = sheetRows.map((item) => {
      const member = memberRows.find((m) => m.member_id === item.member_id);

      const baseGubun = String(item.day_default?.gubun ?? item.gubun ?? "nor")
        .trim()
        .toLowerCase();

      const basePosType = String(
        item.day_default?.position_type ?? item.position_type ?? ""
      ).trim();

      const base = {
        name: item.name,
        account_id: item.account_id,
        member_id: item.member_id,
        position: item.position || member?.position || "",
        gubun: baseGubun,
        position_type: basePosType,
        day_default: item.day_default || null,
      };

      const dayEntries = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `day_${d}`;
        const source = item[key] || (item.days && item.days[key]) || null;

        dayEntries[key] = source
          ? {
              ...source,
              gubun: String(source.gubun ?? baseGubun)
                .trim()
                .toLowerCase(),
              position_type: String(source.position_type ?? basePosType).trim(),
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
              position_type: basePosType,
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

    setAttendanceRows(newAttendance);
    setOriginalAttendanceRows(JSON.parse(JSON.stringify(newAttendance)));

    const map = {};
    sheetRows.forEach((item) => {
      map[item.member_id] = {
        start:
          item.day_default?.start_time ||
          timesRows.find((t) => t.member_id === item.member_id)?.start_time ||
          "",
        end:
          item.day_default?.end_time ||
          timesRows.find((t) => t.member_id === item.member_id)?.end_time ||
          "",
      };
    });
    setDefaultTimes(map);
  }, [sheetRows, timesRows, daysInMonth, memberRows]);

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
                .some((k) => props.row.original[k]?.type === "5");

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

  const getOrgTimes = (row, defaultTimesObj) => {
    const orgStart = row.day_default?.start_time || defaultTimesObj[row.member_id]?.start || "";
    const orgEnd = row.day_default?.end_time || defaultTimesObj[row.member_id]?.end || "";
    return { org_start_time: orgStart, org_end_time: orgEnd };
  };

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
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  const dispatchColumns = useMemo(
    () => [
      { header: "이름", accessorKey: "name", size: "3%", cell: ReadonlyCell },
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
      { header: "금액", accessorKey: "total", size: "15%", cell: ReadonlyCell },
      {
        header: "관리",
        id: "actions",
        size: "1%",
        cell: ({ row }) => <DispatchActionCell row={row} onToggle={handleToggleDispatch} />,
      },
    ],
    [handleToggleDispatch]
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

  const tableSx = {
    maxHeight: "440px",
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
    <>
      <MDBox
        pt={1}
        pb={1}
        gap={1}
        sx={{
          display: "flex",
          flexWrap: isMobile ? "wrap" : "nowrap",
          justifyContent: isMobile ? "flex-start" : "flex-end",
          position: "sticky",
          zIndex: 10,
          top: 75,
          backgroundColor: "#ffffff",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
        }}
      >
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={filteredAccountList || []}
          value={selectedAccountOption}
          onChange={(_, newValue) => setSelectedAccountId(newValue ? newValue.account_id : "")}
          getOptionLabel={(opt) => (opt?.account_name ? String(opt.account_name) : "")}
          isOptionEqualToValue={(opt, val) => String(opt?.account_id) === String(val?.account_id)}
          disableClearable={!!localAccountId}
          disabled={!!localAccountId}
          renderInput={(params) => (
            <TextField
              {...params}
              label="거래처 검색"
              placeholder="거래처명을 입력"
              sx={{
                "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                "& input": { padding: "0 8px" },
              }}
            />
          )}
        />

        <TextField
          select
          size="small"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ minWidth: isMobile ? 140 : 150 }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          sx={{ minWidth: isMobile ? 140 : 150 }}
          SelectProps={{ native: true }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </TextField>

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
          color="warning"
          onClick={async () => {
            await fetchAllData?.();
            // ✅ 파출은 useEffect로 자동 재조회되지만,
            // "조회 버튼 누르면 즉시" 체감 원하면 아래도 유지 가능
            // fetchDispatchOnly(dispatchDelFilter);
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
                            style={{ width: cell.column.columnDef.size, backgroundColor: bg }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

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
                파출 정보 {dispatchLoading ? "(조회중...)" : ""}
              </MDTypography>

              <MDBox display="flex" alignItems="center" gap={1}>
                <Select
                  value={dispatchDelFilter}
                  onChange={(e) => {
                    // ✅ 필터만 바꾸면 useEffect가 자동으로 fetchDispatchOnly 호출
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
    </>
  );
}

export default RecordSheet;
