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
import HeaderWithLogout from "components/Common/HeaderWithLogout";
import api from "api/api";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import useRecordsheetData from "./recordSheetData";
import Swal from "sweetalert2";
import LoadingScreen from "layouts/loading/loadingscreen";

// ✅ 너네 백엔드에 맞게 수정해야 하는 API 2개
const DISPATCH_LIST_API = "/Account/AccountDispatchMemberList"; // 파출 목록 조회 (del_yn 포함)
const DISPATCH_DEL_SAVE_API = "/Account/AccountDispatchMemberDelYnSave"; // del_yn 저장(삭제/복원)

// 근무 타입별 배경색
const typeColors = {
  1: "#d9f2d9",
  2: "#fff7cc",
  3: "#e6d9f2",
  4: "#f9d9d9",
  5: "#ffe6cc",
  6: "#cce6ff",
};

// ✅ 셀 비교용 헬퍼: 조회 당시 vs 현재 값이 같은지 판단
const normalizeCell = (cell) => {
  if (!cell) {
    return { type: "", start: "", end: "", salary: 0, memo: "" };
  }

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

    // ✅ baseValue(셀의 원본) / row.original(행 기본값) / 현재 val 순서로 상속
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

      // ✅ 핵심: gubun / position_type “항상 유지”
      gubun: baseGubun,
      position_type: basePosType,

      [field]: newVal,
    };

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
  // ✅ localStorage account_id로 거래처 고정 + 셀렉트 필터링
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

  // ✅ 파출 조회 필터 (유지:N / 삭제:Y)
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

  const [formData, setFormData] = useState({
    account_id: selectedAccountId,
    name: "",
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

  // ✅ localStorage account_id 기준으로 accountList 필터링
  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter((row) => String(row.account_id) === String(localAccountId));
  }, [accountList, localAccountId]);

  // ✅ Autocomplete value
  const selectedAccountOption = useMemo(() => {
    if (!selectedAccountId) return null;
    return (
      (filteredAccountList || []).find((a) => String(a.account_id) === String(selectedAccountId)) ||
      null
    );
  }, [filteredAccountList, selectedAccountId]);

  // ✅ 파출만 재조회 함수 (del_yn 조건 포함)
  const fetchDispatchOnly = useCallback(
    async (overrideDelYn) => {
      if (!selectedAccountId) return;
      const del_yn = overrideDelYn ?? dispatchDelFilter;

      try {
        const res = await api.get("/Account/AccountRecordDispatchList", {
          params: { account_id: selectedAccountId, year, month, del_yn },
        });

        const list = res.data?.data || res.data?.list || res.data || [];

        setDispatchRows(
          (Array.isArray(list) ? list : []).map((item) => ({
            ...item,
            account_id: item.account_id,
            member_id: item.member_id,
            name: item.name,
            rrn: item.rrn,
            account_number: item.account_number,
            total: item.total,
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

  // ✅ 파출 삭제/복원 버튼 핸들러
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

      api
        .post(
          "/Account/AccountDispatchMemberSave",
          {
            account_id: account_id_row,
            member_id,
            del_yn: next,
            name: row.name,
            rrn: row.rrn,
            account_number: row.account_number,
            total: row.total,
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

  // ✅ sheetRows → attendanceRows 구성 (gubun/position_type 포함)
  useEffect(() => {
    if (!sheetRows || !sheetRows.length) return;

    const newAttendance = sheetRows.map((item) => {
      const member = memberRows.find((m) => m.member_id === item.member_id);

      // ✅ baseGubun: day_default가 있으면 그걸 최우선
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

        // ✅ 행 기본값으로도 들고 있게
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

              // ✅ 핵심: source에 없으면 base로 상속
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

              // ✅ 빈 날도 gubun/position_type 유지 (이게 저장 때 중요)
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

    // ✅ defaultTimes 맵
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
      { header: "직원파출", accessorKey: "employ_dispatch", size: "3%", cell: ReadonlyCell },
      { header: "초과", accessorKey: "over_work", size: "3%", cell: ReadonlyCell },
      { header: "결근", accessorKey: "non_work", size: "3%", cell: ReadonlyCell },
      { header: "비고", accessorKey: "note", size: "20%", cell: ReadonlyCell },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  // ✅ 파출 테이블
  const dispatchTable = useReactTable({
    data: dispatchRows,
    columns: [
      { header: "이름", accessorKey: "name", size: "3%", cell: ReadonlyCell },
      { header: "연락처", accessorKey: "phone", size: "3%", cell: ReadonlyCell },
      { header: "주민등록번호", accessorKey: "rrn", size: "3%", cell: ReadonlyCell },
      { header: "계좌정보", accessorKey: "account_number", size: "3%", cell: ReadonlyCell },
      { header: "금액", accessorKey: "total", size: "15%", cell: ReadonlyCell },
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

  // ✅ 출퇴근 일괄 적용
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

  // ✅ 저장 (gubun + position_type 포함, rec/dis/nor 분리)
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

      Object.entries(row)
        .filter(([key]) => key.startsWith("day_"))
        .forEach(([key, val]) => {
          const dayNum = parseInt(key.replace("day_", ""), 10);
          if (Number.isNaN(dayNum) || dayNum === 0) return;

          if (useDiffMode) {
            const originalVal = originalRow ? originalRow[key] : null;
            if (isCellEqual(val, originalVal)) return;
          }

          if (!val || !val.type || val.type === "0") return;

          const gubun = String(val.gubun ?? row.gubun ?? row.day_default?.gubun ?? "nor")
            .trim()
            .toLowerCase();

          const pt = String(
            val.position_type ?? row.position_type ?? row.day_default?.position_type ?? ""
          ).trim();

          const recordObj = {
            gubun,
            account_id: val.account_id || row.account_id || "",
            member_id: val.member_id || row.member_id || "",

            // ✅ 둘 다 전송
            position_type: pt,
            positionType: pt,

            record_date: dayNum,
            record_year: year,
            record_month: month,
            type: Number(val.type),
            start_time: val.start || "",
            end_time: val.end || "",
            salary: val.salary ? Number(String(val.salary).replace(/,/g, "")) : 0,
            note: val.memo || "",
            position: row.position || "",
            org_start_time,
            org_end_time,
          };

          if (gubun === "dis") disRecords.push(recordObj);
          else if (gubun === "rec") recRecords.push(recordObj);
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
        {/* ✅ 거래처 */}
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
    </>
  );
}

export default RecordSheet;
