/* eslint-disable react/prop-types */
import React, { useMemo, useEffect, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useLocation, useParams } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { Modal, Box, Select, MenuItem, Button, TextField } from "@mui/material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import api from "api/api";
import dayjs from "dayjs";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import useRecordsheetData from "./data/recordsheetData";
import Swal from "sweetalert2";
import LoadingScreen from "layouts/loading/loadingscreen";

// 근무 타입별 배경색
const typeColors = {
  "1": "#d9f2d9",
  "2": "#fff7cc",
  "3": "#e6d9f2",
  "4": "#f9d9d9",
  "5": "#ffe6cc",
  "6": "#cce6ff",
};

// 출근현황 셀
function AttendanceCell({ getValue, row, column, table, typeOptions }) {
  const val = getValue() || { type: "", start: "", end: "", salary: "", memo: "" };

  const times = [];
  for (let h = 0; h <= 20; h++) {
    for (let m of ["00", "30"]) {
      if (h === 20 && m !== "00") continue;
      times.push(`${h.toString().padStart(2, "")}:${m}`);
    }
  }

  const bgColor = typeColors[val.type] || "#ffefd5";

  const parseTime = (str) => {
    if (!str) return null;
    const [h, m] = str.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return dayjs().hour(h).minute(m).second(0);
  };

  const handleChange = (field, newVal) => {
    const dayKey = column.id;
    const baseValue = row.original[dayKey] || {};
    const updatedValue = { ...baseValue, ...val, [field]: newVal };

    // 초과근무 계산
    if (updatedValue.type === "3" && updatedValue.start && updatedValue.end) {
      const start = parseTime(updatedValue.start);
      const end = parseTime(updatedValue.end);
      const baseStart = parseTime(baseValue.start);
      const baseEnd = parseTime(baseValue.end);

      if (start && end && baseStart && baseEnd) {
        if (updatedValue.start !== baseValue.start || updatedValue.end !== baseValue.end) {
          const diffMinutes = end.diff(start, "minute") - baseEnd.diff(baseStart, "minute");
          updatedValue.memo = diffMinutes > 0
            ? (Math.floor(diffMinutes / 60) + (diffMinutes % 60 >= 30 ? 0.5 : 0)).toString()
            : "";
        } else {
          updatedValue.memo = "";
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
        {typeOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {["1", "2", "3", "5", "6", "7", "9"].includes(val.type) && (
        <>
          <select
            value={val.start}
            onChange={(e) => handleChange("start", e.target.value)}
            style={{ fontSize: "0.725rem", width: "100%" }}
          >
            <option value="">출근</option>
            {times.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={val.end}
            onChange={(e) => handleChange("end", e.target.value)}
            style={{ fontSize: "0.725rem", width: "100%" }}
          >
            <option value="">퇴근</option>
            {times.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </>
      )}
      {["5", "6"].includes(val.type) && (
        <input
          type="text"
          placeholder="급여"
          value={val.salary != null && val.salary !== "" ? Number(val.salary).toLocaleString() : ""}
          onChange={(e) => handleChange("salary", e.target.value.replace(/[^0-9]/g, ""))}
          style={{ fontSize: "0.725rem", textAlign: "center", border: "1px solid black", width: "100%" }}
        />
      )}

      {["3", "10"].includes(val.type) && (
        <input
          type="text"
          placeholder={val.type === "3" ? "초과" : "대체휴무"}
          value={val.note ? val.note.toLocaleString() : ""}
          onChange={(e) => handleChange("note", e.target.value)}
          style={{ fontSize: "0.725rem", textAlign: "center", border: "1px solid black", width: "100%" }}
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

ReadonlyCell.propTypes = {
  getValue: PropTypes.func.isRequired,
};

function RecordSheet() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [defaultTimes, setDefaultTimes] = useState({}); // member_id별 기본 출퇴근 시간
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const account_name = queryParams.get("name");
  //const { account_id } = useParams();

  const handleYearChange = (e) => setYear(Number(e.target.value));
  const handleMonthChange = (e) => setMonth(Number(e.target.value));

  const daysInMonth = dayjs(`${year}-${month}`).daysInMonth();

  // 모달 상태
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
          }).then((result) => {
            if (result.isConfirmed) {
              handleModalClose();
              setOpen(false);
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
    setMemberRows,
    dispatchRows,
    setDispatchRows,
    sheetRows,
    setSheetRows,
    timesRows,
    setTimesRows,
    accountList,
    fetchAllData,
    loading
  } = useRecordsheetData(selectedAccountId, year, month);

  useEffect(() => {
    if (accountList.length > 0 && !selectedAccountId)
      setSelectedAccountId(accountList[0].account_id);
  }, [accountList, selectedAccountId]);

  useEffect(() => {
    if (!sheetRows || !sheetRows.length) return;

    const newAttendance = sheetRows.map(item => {
      const base = { name: item.name, account_id: item.account_id, member_id: item.member_id, day_default: item.day_default || null };
      const dayEntries = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `day_${d}`;
        const source = item[key] || (item.days && item.days[key]) || null;
        dayEntries[key] = source ? {
          ...source,
          start: source.start_time || source.start || "",
          end: source.end_time || source.end || "",
          start_time: source.start_time || "",
          end_time: source.end_time || "",
          salary: source.salary || "",
          memo: source.memo || ""
        } : { account_id: item.account_id, member_id: item.member_id, type: "", start: "", end: "", start_time: "", end_time: "", salary: "", memo: "" };
      }
      return { ...base, ...dayEntries };
    });
    setAttendanceRows(newAttendance);

    const map = {};
    sheetRows.forEach(item => {
      map[item.member_id] = {
        start: item.day_default?.start_time || timesRows.find(t => t.member_id === item.member_id)?.start_time || "",
        end: item.day_default?.end_time || timesRows.find(t => t.member_id === item.member_id)?.end_time || "",
      };
    });
    setDefaultTimes(map);

  }, [sheetRows, timesRows, daysInMonth]);

  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => {
    const date = dayjs(`${year}-${month}-${i + 1}`);
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.day()];

    return {
      header: `${i + 1}일(${weekday})`,
      accessorKey: `day_${i + 1}`,
      cell: (props) => {
        const memberId = props.row.original.member_id;

        // ✅ 해당 직원이 type 5를 갖고 있으면 options 제한
        const isType5Member = Object.keys(props.row.original)
          .filter((k) => k.startsWith("day_"))
          .some((k) => props.row.original[k]?.type === "5");

        const typeOptions = isType5Member
          ? [ 
              { value: "0", label: "-" },
              { value: "5", label: "파출" }
            ]
          : [
              { value: "0", label: "-" },
              { value: "1", label: "영양사" },
              { value: "2", label: "상용" },
              { value: "3", label: "초과" },
              { value: "4", label: "결근" },
              // { value: "5", label: "파출" },
              { value: "6", label: "직원파출" },
              { value: "7", label: "유틸" },
              { value: "8", label: "연차" },
              { value: "9", label: "반차" },
              { value: "10", label: "대체휴무" },
              { value: "11", label: "병가" },
              { value: "12", label: "출산휴가" },
              { value: "13", label: "육아휴직" },
            ];

        return <AttendanceCell {...props} typeOptions={typeOptions} />;
      },
      size: "2%",
    };
  });

  const attendanceColumns = useMemo(
    () => [
      { header: "직원명", accessorKey: "name", size: "2%", cell: (info) => <b>{info.getValue()}</b> },
      ...dayColumns,
    ],
    []
  );

  const attendanceTable = useReactTable({
    data: attendanceRows,
    columns: attendanceColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowIndex, columnId, newValue) => {
        setAttendanceRows(old =>
          old.map((row, index) =>
            index !== rowIndex ? row : { ...row, [columnId]: { ...row[columnId], ...newValue } }
          )
        );
      },
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

  const dispatchTable = useReactTable({ 
    data: dispatchRows, 
    columns: [ 
      { header: "이름", accessorKey: "name", size: "3%", cell: ReadonlyCell }, 
      { header: "주민등록번호", accessorKey: "rrn", size: "3%", cell: ReadonlyCell }, 
      { header: "계좌정보", accessorKey: "account_number", size: "3%", cell: ReadonlyCell }, 
      { header: "금액", accessorKey: "total", size: "20%", cell: ReadonlyCell }, 
    ], 
    getCoreRowModel: getCoreRowModel(), 
  });

  const tableSx = {
    maxHeight: "440px",
    overflow: "auto",
    "& table": {
      borderCollapse: "collapse",
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
      borderSpacing: 0,
      borderCollapse: "separate",
    },
    "& td:first-of-type, & th:first-of-type": {
      position: "sticky",
      left: 0,
      background: "#f0f0f0",
      zIndex: 3,
      borderSpacing: 0,
      borderCollapse: "separate",
      border: "1px solid #686D76",
    },
    "thead th:first-of-type": { zIndex: 5 },
  };

  // ✅ 출퇴근 일괄 적용
  const handleApplyDefaultTime = () => {
    setAttendanceRows(prevRows =>
      prevRows.map(row => {
        const updated = { ...row };
        Object.keys(updated)
          .filter(k => k.startsWith("day_"))
          .forEach(dayKey => {
            const cell = updated[dayKey];
            if (!cell) return;
            const typeNum = Number(cell.type);
            if (typeNum === 1 || typeNum === 2) {
              const applyStart = row.day_default?.start_time || defaultTimes[row.member_id]?.start || "";
              const applyEnd = row.day_default?.end_time || defaultTimes[row.member_id]?.end || "";
              updated[dayKey] = { ...cell, start: applyStart, end: applyEnd, start_time: applyStart, end_time: applyEnd };
            }
          });
        return updated;
      })
    );
  };

  // 저장
  // RecordSheet 컴포넌트 내부의 handleSave 함수
const handleSave = async () => {
    if (!attendanceRows || !attendanceRows.length) return;
    const normalRecords = [];
    const type5Records = [];
    attendanceRows.forEach(row => {
      Object.entries(row)
        .filter(([key]) => key.startsWith("day_"))
        .forEach(([key, val]) => {
          // 1. val이 없거나 type이 없거나 '0'이면 건너뜁니다.
          if (!val || !val.type || val.type === "0") return;

          const dayNum = parseInt(key.replace("day_", ""), 10);

          // 2. dayNum이 유효한 숫자인지 확인합니다. (record_date가 null이 되는 것을 방지)
          if (!isNaN(dayNum) && dayNum !== 0) {
            const recordObj = {
              account_id: val.account_id || row.account_id || "",
              member_id: val.member_id || row.member_id || "",
              record_date: dayNum, // dayNum이 유효한 숫자이므로 null이 아닙니다.
              record_year: year,
              record_month: month,
              type: Number(val.type),
              start_time: val.start || "",
              end_time: val.end || "",
              salary: val.salary ? Number(val.salary.toString().replace(/,/g, "")) : 0,
              note: val.memo || "",
            };

            if (recordObj.type === 5) type5Records.push(recordObj);
            else normalRecords.push(recordObj);
          }
        });
    });
    try {
      const res = await api.post("/Account/AccountRecordSave", { normalRecords, type5Records });
      Swal.fire({ 
        title: "저장", 
        text: "저장 완료", 
        icon: "success" 
      });
    } catch (err) {
      console.error("저장 실패:", err);
      Swal.fire({ 
        title: "실패", 
        text: "저장 실패", 
        icon: "error" 
      });
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <DashboardLayout>
      <MDBox pt={1} pb={5} gap={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TextField
          select
          size="small"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          {(accountList || []).map((row) => (
            <option key={row.account_id} value={row.account_id}>
              {row.account_name}
            </option>
          ))}
        </TextField>
        <Select value={year} onChange={handleYearChange} size="small">
          {Array.from({ length: 10 }, (_, i) => today.year() - 5 + i).map((y) => (
            <MenuItem key={y} value={y}>{y}년</MenuItem>
          ))}
        </Select>
        <Select value={month} onChange={handleMonthChange} size="small">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <MenuItem key={m} value={m}>{m}월</MenuItem>
          ))}
        </Select>
        <MDButton variant="gradient" color="success" onClick={handleApplyDefaultTime}>
          출퇴근 일괄 적용
        </MDButton>
        {/* ✅ 조회 버튼 추가 */}
        <MDButton variant="gradient" color="warning" onClick={fetchAllData}>
          조회
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>
      <Grid container spacing={5}>
        <Grid item xs={12}>
          <Card>
            <MDBox mx={0} mt={-3} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
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
                        <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
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
                          const val = cell.getValue();
                          const type = val?.type || "";
                          bg = typeColors[type] || "";
                        }
                        return (
                          <td key={cell.id} style={{ width: cell.column.columnDef.size, backgroundColor: bg }}>
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

        <Grid item xs={6}>
          <Card>
            <MDBox mx={0} mt={-3} py={1} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
              <MDTypography variant="h6" color="white">직원 정보</MDTypography>
            </MDBox>
            <MDBox pt={0} sx={tableSx}>
              <table className="recordsheet-table">
                <thead>
                  {employeeTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}> {hg.headers.map((header) => (
                      <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
                    ))} </tr>
                  ))}
                </thead>
                <tbody>
                  {memberRows.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, i) => <td key={i}>{val}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </MDBox>
          </Card>
        </Grid>

        <Grid item xs={6}>
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
              alignItems="center"  // 세로 중앙 정렬
              justifyContent="space-between" // 텍스트 왼쪽, 아이콘 오른쪽
            >
              <MDTypography variant="h6" color="white">
                파출 정보
              </MDTypography>

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
            <MDBox pt={0} sx={tableSx}>
              <table className="recordsheet-table">
                <thead>
                  {dispatchTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}> {hg.headers.map((header) => (
                      <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
                    ))} </tr>
                  ))}
                </thead>
                <tbody>
                  {dispatchRows.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, i) => <td key={i}>{val}</td>)}
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
            InputLabelProps={{
              style: { fontSize: "0.7rem" }, // 원하는 크기로
            }}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="주민번호"
            name="rrn"
            value={formData.rrn}
            InputLabelProps={{
              style: { fontSize: "0.7rem" }, // 원하는 크기로
            }}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="계좌정보"
            name="account_number"
            value={formData.account_number}
            InputLabelProps={{
              style: { fontSize: "0.7rem" }, // 원하는 크기로
            }}
            onChange={handleChange}
          />
          <TextField
            fullWidth
            margin="normal"
            label="메모"
            name="account_number"
            value={formData.note}
            InputLabelProps={{
              style: { fontSize: "0.7rem" }, // 원하는 크기로
            }}
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
            <Button
              variant="contained"
              onClick={handleSubmit}
              sx={{ color: "#ffffff" }}
            >
              저장
            </Button>
          </Box>
        </Box>
      </Modal>
    </DashboardLayout>
  );
}

export default RecordSheet;
