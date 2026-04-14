/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import {
  TextField,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import Swal from "sweetalert2";
import api from "api/api";
import Autocomplete from "@mui/material/Autocomplete";
import MenuItem from "@mui/material/MenuItem";

import useAccountMemberRecordMainTableData from "./AccountMemberRecordMainTableData";
import LoadingScreen from "layouts/loading/loadingscreen";

function AccountMemberRecordMainTableTab() {
  const DAY_LABELS = useMemo(() => ["월", "화", "수", "목", "금", "토", "일"], []);
  const DAY_KEYS = useMemo(() => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], []);
  const scheduleKeySet = useMemo(() => new Set(DAY_KEYS), [DAY_KEYS]);

  const NONE_OPTION = useMemo(() => ({ value: "", label: "지정안됨" }), []);

  const makeEmptySchedule = useCallback(() => {
    const obj = {};
    DAY_KEYS.forEach((k) => {
      obj[k] = "";
    });
    return obj;
  }, [DAY_KEYS]);

  const scheduleColumns = useMemo(
    () =>
      DAY_KEYS.map((k, idx) => ({
        header: DAY_LABELS[idx],
        accessorKey: k,
        size: 80,
      })),
    [DAY_KEYS, DAY_LABELS]
  );

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const [activeStatus, setActiveStatus] = useState("N");

  // ✅ Root select
  const [rootOptions, setRootOptions] = useState([NONE_OPTION]);
  const [selectedRootIdx, setSelectedRootIdx] = useState("");
  const [originalRootIdx, setOriginalRootIdx] = useState("");

  // ✅ 부족 클릭 시 오른쪽 응급 인력 리스트
  const [emergencyRows, setEmergencyRows] = useState([]);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyTitle, setEmergencyTitle] = useState("부족 인력 조회");

  // ✅ 채용여부(use_yn) 수정용
  const [emergencyUseYnMap, setEmergencyUseYnMap] = useState({});
  const [originalEmergencyUseYnMap, setOriginalEmergencyUseYnMap] = useState({});
  const [savingEmployment, setSavingEmployment] = useState(false);

  // ✅ 부족항목 클릭 시 시작/마감 보관
  const [shortageSelectedShift, setShortageSelectedShift] = useState({
    start_time: "",
    end_time: "",
  });

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));

  // ✅ 부족항목 클릭에서 계산된 일자
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState(null);

  // ✅ 마지막 클릭 부족항목의 position_type
  const [selectedPositionType, setSelectedPositionType] = useState("");
  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const [todayCheckLoading, setTodayCheckLoading] = useState(false);
  const [todayCheckRows, setTodayCheckRows] = useState([]);

  const tableContainerRef = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,

    simulationRows,
    setSimulationRows,

    accountList,
    fetchAccountStandardList,
    fetchAccountRecordSituationList,
  } = useAccountMemberRecordMainTableData(selectedAccountId, activeStatus);

  const [loading, setLoading] = useState(true);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1].map((v) => String(v));
  }, [now]);

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    []
  );

  const generateTimeOptions = (startHHMM, endHHMM, stepMinutes = 30) => {
    const toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const start = toMinutes(startHHMM);
    const end = toMinutes(endHHMM);
    const arr = [];
    for (let t = start; t <= end; t += stepMinutes) {
      const hh = Math.floor(t / 60);
      const mm = t % 60;
      arr.push(`${hh}:${pad(mm)}`);
    }
    return arr;
  };

  const startTimes = generateTimeOptions("5:30", "16:00", 30);
  const endTimes = generateTimeOptions("10:00", "20:00", 30);

  const corOptions = useMemo(
    () => [
      { value: "1", label: "고정" },
      { value: "2", label: "대체" },
    ],
    []
  );

  const positionOptions = useMemo(
    () => [
      { value: "4", label: "조리사" },
      { value: "5", label: "조리원" },
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      { value: "1", label: "가능" },
      { value: "2", label: "블랙리스트" },
    ],
    []
  );

  const hydrateSchedule = useCallback(
    (row) => {
      const base = makeEmptySchedule();
      const out = { ...base, ...(row || {}) };
      scheduleKeySet.forEach((k) => {
        if (out[k] == null) out[k] = "";
      });
      return out;
    },
    [makeEmptySchedule, scheduleKeySet]
  );

  // =========================
  // ✅ 표시 라벨 매핑(오른쪽 테이블)
  // =========================
  const positionLabelOf = useCallback(
    (pos) =>
      positionOptions.find((p) => String(p.value) === String(pos))?.label ?? String(pos ?? ""),
    [positionOptions]
  );

  const statusLabelOf = useCallback(
    (pos) => statusOptions.find((p) => String(p.value) === String(pos))?.label ?? String(pos ?? ""),
    [statusOptions]
  );

  const statusColorOf = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (s === "1") return "#1976d2";
    if (s === "2") return "#d32f2f";
    return "inherit";
  }, []);

  const manpowerTypeLabelOf = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (s === "1") return "내부대체";
    if (s === "2") return "외부대체";
    if (s === "3") return "퇴사자";
    if (s === "4") return "파출";
    return s;
  }, []);

  const employmentOptions = useMemo(
    () => [
      { value: "1", label: "보류" },
      { value: "2", label: "불가" },
      { value: "3", label: "확정" },
    ],
    []
  );

  const employmentColorOf = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (s === "1") return "#FF9760";
    if (s === "2") return "#d32f2f";
    if (s === "3") return "#1976d2";
    return "#777";
  }, []);

  // =========================
  // ✅ 유틸
  // =========================
  const isValueInOptions = useCallback((val, opts) => {
    const v = String(val ?? "");
    return (opts || []).some((o) => String(o.value) === v);
  }, []);

  const normalizeToOptionValue = useCallback(
    (raw, opts) => {
      let v = String(raw ?? "").trim();
      if (!v) return "";

      const optsArr = Array.isArray(opts) ? opts : [];
      if (isValueInOptions(v, optsArr)) return v;

      const sample = optsArr.find((o) => String(o.value ?? "") !== "")?.value;
      const len = sample ? String(sample).length : 0;

      if (len > 0 && v.length < len) {
        const padded = v.padStart(len, "0");
        if (isValueInOptions(padded, optsArr)) return padded;
      }

      if (len > 0 && v.length > len) {
        const tail = v.slice(-len);
        if (isValueInOptions(tail, optsArr)) return tail;
      }

      const noLeading = v.replace(/^0+/, "");
      if (noLeading && isValueInOptions(noLeading, optsArr)) return noLeading;

      const vv = v.replace(/[^\d]/g, "");
      if (vv) {
        const hit1 = optsArr.find((o) => String(o?.value ?? "").startsWith(vv));
        if (hit1) return String(hit1.value);

        const hit2 = optsArr.find((o) => vv.startsWith(String(o?.value ?? "")));
        if (hit2) return String(hit2.value);
      }

      return "";
    },
    [isValueInOptions]
  );

  const pad2 = (n) => String(n).padStart(2, "0");
  const formatYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const startOfDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const getDateByWeekDay = useCallback(
    (y, mm, week, dayKey) => {
      const m = Number(mm);
      const w = Number(week);
      const dayIndex = DAY_KEYS.indexOf(dayKey);
      if (!Number.isFinite(m) || !Number.isFinite(w) || dayIndex < 0) return null;

      const first = new Date(y, m - 1, 1);
      const firstDow = first.getDay();
      const mondayBased = (firstDow + 6) % 7;
      const firstWeekMonday = new Date(y, m - 1, 1 - mondayBased);

      const target = new Date(firstWeekMonday);
      target.setDate(firstWeekMonday.getDate() + (w - 1) * 7 + dayIndex);
      return target;
    },
    [DAY_KEYS]
  );

  // =========================
  // ✅ 거래처 옵션
  // =========================
  const accountOptions = useMemo(() => {
    return (accountList || []).map((a) => ({
      value: String(a.account_id),
      label: a.account_name,
    }));
  }, [accountList]);

  useEffect(() => {
    if (!selectedAccountId && accountOptions.length > 0) {
      setSelectedAccountId(accountOptions[0].value);
      setAccountInput(accountOptions[0].label);
    }
  }, [accountOptions, selectedAccountId]);

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  // =========================
  // ✅ RootList 옵션 fetch
  // =========================
  const fetchRootList = useCallback(async () => {
    const res = await api.get("/Operate/RootList");
    const opts = (res.data || []).map((x) => {
      const sido = String(x?.sido_name ?? "").trim();
      const sigungu = String(x?.sigungu_name ?? "").trim();
      const emd = String(x?.emd_name ?? "").trim();
      const label = [sido, sigungu, emd].filter(Boolean).join(" ");
      return {
        value: String(x.root_idx),
        label: label || String(x.root_idx),
      };
    });
    return [NONE_OPTION, ...opts];
  }, [NONE_OPTION]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchRootList();
        if (!alive) return;
        setRootOptions(list);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setRootOptions([NONE_OPTION]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchRootList, NONE_OPTION]);

  // =========================
  // ✅ 거래처 입력으로 선택
  // =========================
  const selectAccountByInput = useCallback(() => {
    const q = String(accountInput || "").trim();
    if (!q) return;

    const list = accountOptions || [];
    const qLower = q.toLowerCase();

    const exact = list.find((o) => String(o?.label || "").toLowerCase() === qLower);
    const partial =
      exact ||
      list.find((o) =>
        String(o?.label || "")
          .toLowerCase()
          .includes(qLower)
      );

    if (partial) {
      setSelectedAccountId(partial.value);
      setAccountInput(partial.label || q);
    }
  }, [accountInput, accountOptions]);

  // =========================
  // ✅ 조회
  // =========================
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const standardRows = await fetchAccountStandardList();
        if (!alive) return;

        const hydratedRows = (standardRows || []).map((row) => hydrateSchedule(row));
        setActiveRows(hydratedRows);
        setOriginalRows(hydratedRows);

        const incomingRootIdx = String(hydratedRows?.[0]?.root_idx ?? "").trim();
        setOriginalRootIdx(incomingRootIdx);
        setSelectedRootIdx(normalizeToOptionValue(incomingRootIdx, rootOptions || []));

        if (selectedAccountId) {
          await fetchAccountRecordSituationList({
            account_id: selectedAccountId,
            year,
            month,
          });
        } else {
          setSimulationRows([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    selectedAccountId,
    activeStatus,
    year,
    month,
    fetchAccountStandardList,
    fetchAccountRecordSituationList,
    setSimulationRows,
    hydrateSchedule,
    normalizeToOptionValue,
    rootOptions,
    setActiveRows,
    setOriginalRows,
  ]);

  // =========================
  // ✅ activeRows 로딩 후 root_idx 자동매핑
  // =========================
  useEffect(() => {
    const fixed = normalizeToOptionValue(originalRootIdx, rootOptions || []);
    setSelectedRootIdx((prev) => {
      const prevStr = String(prev ?? "");
      const origStr = String(originalRootIdx ?? "");
      if (!prevStr) return fixed;
      if (prevStr === origStr) return fixed;
      return prevStr;
    });
  }, [originalRootIdx, rootOptions, normalizeToOptionValue]);

  const isRootChanged = String(selectedRootIdx ?? "") !== String(originalRootIdx ?? "");

  // =========================
  // ✅ 확정 중복 체크
  // =========================
  const hasAnotherConfirmedEmployment = useCallback(
    (targetRowId) => {
      const targetId = String(targetRowId ?? "").trim();

      return (emergencyRows || []).some((row) => {
        const rowId = String(row?.idx ?? "").trim();
        if (!rowId || rowId === targetId) return false;

        const currentUseYn = String(
          emergencyUseYnMap?.[rowId] ?? originalEmergencyUseYnMap?.[rowId] ?? row?.use_yn ?? ""
        ).trim();

        return currentUseYn === "3";
      });
    },
    [emergencyRows, emergencyUseYnMap, originalEmergencyUseYnMap]
  );

  // =========================
  // ✅ 테이블 정의
  // =========================
  const columns = useMemo(
    () => [
      { header: "구분", accessorKey: "account_id", size: 150 },
      { header: "직책", accessorKey: "position_type", size: 80 },
      { header: "시작", accessorKey: "start_time", size: 80 },
      { header: "마감", accessorKey: "end_time", size: 80 },
      ...scheduleColumns,
    ],
    [scheduleColumns]
  );

  const columns2 = useMemo(
    () => [
      { header: "직책", accessorKey: "position_type", size: 80 },
      { header: "주차", accessorKey: "week_number", size: 80 },
      ...scheduleColumns,
    ],
    [scheduleColumns]
  );

  const table = useReactTable({
    data: activeRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const simulationTable = useReactTable({
    data: simulationRows || [],
    columns: columns2,
    getCoreRowModel: getCoreRowModel(),
  });

  const getScheduleColumnTotal = useCallback((rows, key) => {
    let total = 0;
    (rows || []).forEach((r) => {
      const raw = r?.[key];
      const n = Number(String(raw ?? "").trim());
      if (!Number.isNaN(n)) total += n;
    });
    return total;
  }, []);

  const onlyDigits = (v) => String(v ?? "").replace(/[^\d]/g, "");

  const handleAddRow = () => {
    const firstRealAccount = (accountOptions || []).find((o) => o.value !== "");
    const defaultAccountId =
      String(selectedAccountId ?? "") !== ""
        ? String(selectedAccountId)
        : String(firstRealAccount?.value ?? "");

    const newRow = {
      account_id: defaultAccountId,
      cor_type: "1",
      position_type: "4",
      start_time: startTimes?.[0] ?? "5:30",
      end_time: endTimes?.[0] ?? "10:00",
      ...makeEmptySchedule(),
    };

    setActiveRows((prev) => [newRow, ...(prev || [])]);
    setOriginalRows((prev) => [newRow, ...(prev || [])]);
  };

  useEffect(() => {
    setEmergencyRows([]);
    setEmergencyUseYnMap({});
    setOriginalEmergencyUseYnMap({});
    setEmergencyLoading(false);
    setEmergencyTitle("부족 인력 조회");

    setSelectedDayOfMonth(null);
    setSelectedPositionType("");
    setShortageSelectedShift({ start_time: "", end_time: "" });
  }, [year, month, selectedAccountId, selectedRootIdx]);

  // ✅ 저장 로직(root_idx만 저장)
  const handleSave = async () => {
    if (!String(selectedRootIdx ?? "").trim()) {
      Swal.fire("안내", "업장 지역(root)을 선택하세요.", "info");
      return;
    }

    const changedRows = (activeRows || []).filter((row, idx) => {
      const original = originalRows?.[idx];
      if (!original) return true;

      return Object.keys(row).some(
        (key) => String(row?.[key] ?? "") !== String(original?.[key] ?? "")
      );
    });

    const _isRootChanged = String(selectedRootIdx ?? "") !== String(originalRootIdx ?? "");

    if (changedRows.length === 0 && !_isRootChanged) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }

    try {
      const userId = localStorage.getItem("user_id");

      const cleanRow = (row) => {
        const newRow = { ...row };
        Object.keys(newRow).forEach((key) => {
          if (newRow[key] === "" || newRow[key] === undefined) newRow[key] = null;
        });
        return newRow;
      };

      const targetRows = changedRows.length > 0 ? changedRows : activeRows || [];

      const processed = targetRows.map((row) => {
        const hydrated = hydrateSchedule(row);
        const newRow = cleanRow(hydrated);
        return {
          ...newRow,
          user_id: userId,
          root_idx: selectedRootIdx ? Number(selectedRootIdx) : null,
        };
      });

      const res = await api.post("/Operate/AccountRecordStandardSave", { data: processed });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");

        const snapshot = (activeRows || []).map((r) => hydrateSchedule(r));
        setOriginalRows(snapshot);
        setOriginalRootIdx(String(selectedRootIdx ?? ""));

        await fetchAccountStandardList();
      } else {
        Swal.fire("저장 실패", res.data.message || "서버 오류", "error");
      }
    } catch (err) {
      Swal.fire("저장 실패", err?.message || "오류", "error");
    }
  };

  const renderTable = (tableArg, rows, originals) => {
    const editableSelectFields = new Set(["cor_type", "position_type", "start_time", "end_time"]);

    const getScheduleBg = (key) => {
      if (!scheduleKeySet.has(key)) return undefined;
      if (key === "sat" || key === "sun") return "#fbe4d5";
      return "#fff";
    };

    return (
      <MDBox
        ref={tableContainerRef}
        pt={0}
        sx={{
          flex: 1,
          minHeight: 0,
          maxHeight: isMobile ? "30vh" : "30vh",
          overflowX: "auto",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          "& table": {
            borderCollapse: "separate",
            width: "max-content",
            minWidth: "100%",
            borderSpacing: 0,
            tableLayout: "fixed",
            fontSize: "9px",
          },
          "& th, & td": {
            border: "1px solid #686D76",
            textAlign: "center",
            padding: "4px",
            whiteSpace: "nowrap",
            fontSize: "11px",
            verticalAlign: "middle",
          },
          "& th": {
            backgroundColor: "#f0f0f0",
            position: "sticky",
            top: 0,
            zIndex: 2,
          },
          "& .edited-cell": { color: "#d32f2f", fontWeight: 500 },
          "& select": {
            fontSize: "11px",
            padding: "4px",
            minWidth: "40px",
            border: "none",
            background: "transparent",
            outline: "none",
            cursor: "pointer",
          },
          "& select.edited-cell": { color: "#d32f2f", fontWeight: 600 },

          "& input.day-num": {
            width: "100%",
            fontSize: "11px",
            padding: "0px",
            border: "none",
            outline: "none",
            background: "transparent",
            textAlign: "center",
          },
          "& input.day-num.edited-cell": { color: "#d32f2f", fontWeight: 600 },
        }}
      >
        <table className="dinersheet-table">
          <thead>
            {tableArg.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ width: header.column.columnDef.size }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {tableArg.getRowModel().rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const colKey = cell.column.columnDef.accessorKey;
                  const currentValue = row.getValue(colKey);
                  const originalValue = originals?.[rowIndex]?.[colKey];

                  const normCurrent = String(currentValue ?? "");
                  const normOriginal = String(originalValue ?? "");
                  const isChanged = normCurrent !== normOriginal;

                  const cellBg = getScheduleBg(colKey);

                  const handleCellChange = (newValue) => {
                    const updatedRows = (rows || []).map((r, idx) => {
                      if (idx !== rowIndex) return r;
                      const merged = hydrateSchedule(r);
                      return { ...merged, [colKey]: newValue };
                    });
                    setActiveRows(updatedRows);
                  };

                  return (
                    <td
                      key={cell.id}
                      style={{
                        background: cellBg,
                        textAlign: scheduleKeySet.has(colKey) ? "center" : "left",
                      }}
                      className={isChanged ? "edited-cell" : ""}
                    >
                      {scheduleKeySet.has(colKey) ? (
                        <input
                          className={`day-num ${isChanged ? "edited-cell" : ""}`}
                          value={currentValue ?? ""}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          onChange={(e) => handleCellChange(onlyDigits(e.target.value))}
                          onBlur={(e) => {
                            const cleaned = onlyDigits(e.target.value);
                            const normalized = cleaned === "" ? "" : String(Number(cleaned));
                            if (normalized !== String(currentValue ?? "")) {
                              handleCellChange(normalized);
                            }
                          }}
                        />
                      ) : colKey === "account_id" ? (
                        (() => {
                          const v = String(currentValue ?? "");
                          const label = accountOptions.find((o) => o.value === v)?.label ?? v;
                          return <span>{label}</span>;
                        })()
                      ) : editableSelectFields.has(colKey) ? (
                        <select
                          value={currentValue ?? ""}
                          onChange={(e) => handleCellChange(e.target.value)}
                          className={isChanged ? "edited-cell" : ""}
                          style={{
                            width: "100%",
                            background: "transparent",
                            cursor: "pointer",
                            border: "none",
                            textAlign: "left",
                          }}
                        >
                          {colKey === "cor_type" &&
                            corOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}

                          {colKey === "position_type" &&
                            positionOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}

                          {colKey === "start_time" && (
                            <>
                              <option value="">없음</option>
                              {startTimes.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </>
                          )}

                          {colKey === "end_time" && (
                            <>
                              <option value="">없음</option>
                              {endTimes.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      ) : (
                        String(currentValue ?? "")
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              {tableArg.getVisibleFlatColumns().map((col) => {
                const key = col.columnDef.accessorKey;

                if (key === "account_id") {
                  return (
                    <td
                      key={`foot-label-${col.id}`}
                      style={{ fontWeight: 700, background: "#f0f0f0" }}
                    >
                      합계
                    </td>
                  );
                }

                if (scheduleKeySet.has(key)) {
                  const colTotal = getScheduleColumnTotal(rows, key);
                  return (
                    <td
                      key={`foot-total-${col.id}`}
                      style={{ fontWeight: 700, background: "#fff" }}
                    >
                      {colTotal}
                    </td>
                  );
                }

                return <td key={`foot-empty-${col.id}`} style={{ background: "#f0f0f0" }} />;
              })}
            </tr>
          </tfoot>
        </table>
      </MDBox>
    );
  };

  const toInt = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s.replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, []);

  const toWeekNo = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s.replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, []);

  const isNone = useCallback((v) => {
    const norm = String(v ?? "")
      .replace(/\u00A0/g, " ")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    return norm === "none" || norm === "제외" || norm === "당월x";
  }, []);

  const toIntOrNull = useCallback(
    (v) => {
      if (isNone(v)) return null;
      const s = String(v ?? "")
        .replace(/\u00A0/g, " ")
        .trim();
      if (!s) return 0;
      const n = Number(s.replace(/[^\d-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },
    [isNone]
  );

  const buildTodayShortagePayload = useCallback(
    (standardRows = [], situationRows = []) => {
      const requiredByPosDay = {};
      const actualByWeekPosDay = {};
      const excludedByWeekDay = {};

      (standardRows || []).forEach((r) => {
        const pos = String(r?.position_type ?? "").trim();
        if (!pos) return;

        if (!requiredByPosDay[pos]) requiredByPosDay[pos] = {};
        DAY_KEYS.forEach((dayKey) => {
          requiredByPosDay[pos][dayKey] = (requiredByPosDay[pos][dayKey] || 0) + toInt(r?.[dayKey]);
        });
      });

      const requiredPosList = Object.keys(requiredByPosDay);
      if (requiredPosList.length === 0) return [];

      (situationRows || []).forEach((r) => {
        const week = toWeekNo(r?.week_number);
        const pos = String(r?.position_type ?? "").trim();
        if (!week || !pos) return;

        if (!actualByWeekPosDay[week]) actualByWeekPosDay[week] = {};
        if (!actualByWeekPosDay[week][pos]) actualByWeekPosDay[week][pos] = {};

        if (!excludedByWeekDay[week]) excludedByWeekDay[week] = {};

        DAY_KEYS.forEach((dayKey) => {
          const v = r?.[dayKey];

          if (isNone(v)) {
            excludedByWeekDay[week][dayKey] = true;
            return;
          }

          const n = toIntOrNull(v);
          if (n == null) {
            excludedByWeekDay[week][dayKey] = true;
            return;
          }

          actualByWeekPosDay[week][pos][dayKey] = (actualByWeekPosDay[week][pos][dayKey] || 0) + n;
        });
      });

      const result = [];
      Object.keys(actualByWeekPosDay || {}).forEach((weekKey) => {
        const week = Number(weekKey);
        if (!Number.isFinite(week) || week <= 0) return;

        requiredPosList.forEach((pos) => {
          DAY_KEYS.forEach((dayKey) => {
            if (excludedByWeekDay?.[week]?.[dayKey]) return;

            const req = requiredByPosDay?.[pos]?.[dayKey] || 0;
            const act = actualByWeekPosDay?.[week]?.[pos]?.[dayKey] || 0;
            const diff = req - act;

            if (diff > 0) {
              result.push({
                week,
                dayKey,
                position_type: pos,
                shortage: diff,
                required: req,
                actual: act,
              });
            }
          });
        });
      });

      return result;
    },
    [DAY_KEYS, isNone, toInt, toIntOrNull, toWeekNo]
  );

  const shortageList = useMemo(() => {
    const requiredByPosDay = {};
    const actualByWeekPosDay = {};
    const excludedByWeekDay = {};

    (activeRows || []).forEach((r) => {
      const pos = String(r?.position_type ?? "").trim();
      if (!pos) return;

      if (!requiredByPosDay[pos]) requiredByPosDay[pos] = {};
      DAY_KEYS.forEach((dayKey) => {
        requiredByPosDay[pos][dayKey] = (requiredByPosDay[pos][dayKey] || 0) + toInt(r?.[dayKey]);
      });
    });

    const requiredPosList = Object.keys(requiredByPosDay);
    if (requiredPosList.length === 0) return { list: [], excluded: {} };

    (simulationRows || []).forEach((r) => {
      const week = toWeekNo(r?.week_number);
      const pos = String(r?.position_type ?? "").trim();
      if (!week || !pos) return;

      if (!actualByWeekPosDay[week]) actualByWeekPosDay[week] = {};
      if (!actualByWeekPosDay[week][pos]) actualByWeekPosDay[week][pos] = {};

      if (!excludedByWeekDay[week]) excludedByWeekDay[week] = {};

      DAY_KEYS.forEach((dayKey) => {
        const v = r?.[dayKey];

        if (isNone(v)) {
          excludedByWeekDay[week][dayKey] = true;
          return;
        }

        const n = toIntOrNull(v);
        if (n == null) {
          excludedByWeekDay[week][dayKey] = true;
          return;
        }

        actualByWeekPosDay[week][pos][dayKey] = (actualByWeekPosDay[week][pos][dayKey] || 0) + n;
      });
    });

    const weeks = Array.from(
      new Set([...Object.keys(actualByWeekPosDay || {}), ...Object.keys(excludedByWeekDay || {})])
    )
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    if (weeks.length === 0) return { list: [], excluded: excludedByWeekDay };

    const result = [];
    weeks.forEach((week) => {
      requiredPosList.forEach((pos) => {
        DAY_KEYS.forEach((dayKey) => {
          const isExcluded = !!excludedByWeekDay?.[week]?.[dayKey];
          if (isExcluded) return;

          const req = requiredByPosDay?.[pos]?.[dayKey] || 0;
          const act = actualByWeekPosDay?.[week]?.[pos]?.[dayKey] || 0;
          const diff = req - act;

          if (diff > 0) {
            result.push({
              week,
              dayKey,
              position_type: pos,
              부족: diff,
              required: req,
              actual: act,
            });
          }
        });
      });
    });

    const dayOrder = Object.fromEntries(DAY_KEYS.map((k, i) => [k, i]));
    result.sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      if (dayOrder[a.dayKey] !== dayOrder[b.dayKey]) return dayOrder[a.dayKey] - dayOrder[b.dayKey];
      return String(a.position_type).localeCompare(String(b.position_type));
    });

    return { list: result, excluded: excludedByWeekDay };
  }, [activeRows, simulationRows, DAY_KEYS, toInt, toWeekNo, isNone, toIntOrNull]);

  const shortageMatrixByWeek = useMemo(() => {
    const map = {};
    (shortageList?.list || []).forEach((x) => {
      const w = x.week;
      const d = x.dayKey;
      if (!map[w]) map[w] = {};
      if (!map[w][d]) map[w][d] = [];

      const posLabel =
        positionOptions.find((p) => String(p.value) === String(x.position_type))?.label ??
        String(x.position_type);

      map[w][d].push({
        posLabel,
        부족: x.부족,
        required: x.required,
        actual: x.actual,
        position_type: x.position_type,
      });
    });

    Object.keys(map).forEach((w) => {
      Object.keys(map[w]).forEach((d) => {
        map[w][d].sort((a, b) => a.posLabel.localeCompare(b.posLabel));
      });
    });

    return map;
  }, [shortageList, positionOptions]);

  const excludedMatrixByWeek = useMemo(() => shortageList?.excluded || {}, [shortageList]);

  const getEffectiveRootIdx = useCallback(() => {
    const fallbackRoot = activeRows?.[0]?.root_idx != null ? String(activeRows[0].root_idx) : "";
    const root_idx = String(selectedRootIdx ?? "").trim() || String(fallbackRoot ?? "").trim();
    return root_idx;
  }, [activeRows, selectedRootIdx]);

  const getShiftByPosition = useCallback(
    (position_type) => {
      const pos = String(position_type ?? "").trim();
      if (!pos) return { start_time: "", end_time: "" };

      const list = (activeRows || []).filter((r) => String(r?.position_type ?? "").trim() === pos);

      const pickMostCommon = (arr) => {
        const freq = {};
        arr.forEach((v) => {
          const s = String(v ?? "").trim();
          if (!s) return;
          freq[s] = (freq[s] || 0) + 1;
        });
        const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        return entries.length ? entries[0][0] : "";
      };

      const startCandidates = list.map((r) => r?.start_time);
      const endCandidates = list.map((r) => r?.end_time);

      const start_time =
        pickMostCommon(startCandidates) ||
        String(startCandidates.find((v) => String(v ?? "").trim()) ?? "");
      const end_time =
        pickMostCommon(endCandidates) ||
        String(endCandidates.find((v) => String(v ?? "").trim()) ?? "");

      return { start_time, end_time };
    },
    [activeRows]
  );

  const rootLabelByValue = useCallback(
    (rootIdx) =>
      rootOptions.find((o) => String(o.value) === String(rootIdx ?? ""))?.label ||
      NONE_OPTION.label,
    [NONE_OPTION.label, rootOptions]
  );

  const handleOpenTodayCheck = useCallback(async () => {
    if ((accountList || []).length === 0) {
      Swal.fire("안내", "거래처 목록이 아직 준비되지 않았습니다.", "info");
      return;
    }

    setTodayModalOpen(true);
    setTodayCheckLoading(true);

    try {
      const today = startOfDate(new Date());

      const allRows = await Promise.all(
        (accountList || []).map(async (account) => {
          const accountId = String(account?.account_id ?? "").trim();
          if (!accountId) return [];

          const [standardRes, situationRes] = await Promise.all([
            api.get("/Operate/AccountRecordStandardList", {
              params: { account_id: accountId, del_yn: activeStatus },
            }),
            api.get("/Operate/RecordSituationList", {
              params: { account_id: accountId, year, month },
            }),
          ]);

          const standardRows = (standardRes?.data || []).map((item) =>
            hydrateSchedule({
              master_idx: item.master_idx,
              account_id: item.account_id,
              work_system: item.work_system,
              position_type: item.position_type,
              start_time: item.start_time,
              end_time: item.end_time,
              mon: item.mon,
              tue: item.tue,
              wed: item.wed,
              thu: item.thu,
              fri: item.fri,
              sat: item.sat,
              sun: item.sun,
              root_idx: item.root_idx,
            })
          );

          const situationRows = (situationRes?.data || []).map((item) => ({
            week_number: item.week_number,
            position_type: item.position_type,
            mon: item.mon,
            tue: item.tue,
            wed: item.wed,
            thu: item.thu,
            fri: item.fri,
            sat: item.sat,
            sun: item.sun,
          }));

          const rootIdx = String(standardRows?.[0]?.root_idx ?? "").trim();
          const normalizedRootIdx = normalizeToOptionValue(rootIdx, rootOptions || []);
          const rootLabel = rootLabelByValue(normalizedRootIdx);
          const getShiftByPositionForRows = (positionType) => {
            const pos = String(positionType ?? "").trim();
            if (!pos) return { start_time: "", end_time: "" };

            const list = (standardRows || []).filter(
              (r) => String(r?.position_type ?? "").trim() === pos
            );

            const pickMostCommon = (arr) => {
              const freq = {};
              arr.forEach((v) => {
                const s = String(v ?? "").trim();
                if (!s) return;
                freq[s] = (freq[s] || 0) + 1;
              });
              const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
              return entries.length ? entries[0][0] : "";
            };

            const startCandidates = list.map((r) => r?.start_time);
            const endCandidates = list.map((r) => r?.end_time);

            return {
              start_time:
                pickMostCommon(startCandidates) ||
                String(startCandidates.find((v) => String(v ?? "").trim()) ?? ""),
              end_time:
                pickMostCommon(endCandidates) ||
                String(endCandidates.find((v) => String(v ?? "").trim()) ?? ""),
            };
          };

          return buildTodayShortagePayload(standardRows, situationRows)
            .map((item) => {
              const targetDate = getDateByWeekDay(year, month, item.week, item.dayKey);
              if (!targetDate) return null;

              const normalizedDate = startOfDate(targetDate);
              const daysLeft = Math.floor(
                (normalizedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );

              if (daysLeft < 0) return null;

              const shift = getShiftByPositionForRows(item.position_type);

              return {
                account_id: accountId,
                account_name: account?.account_name || accountId,
                root_label: rootLabel,
                shortage_date: formatYMD(normalizedDate),
                position_label: positionLabelOf(item.position_type),
                start_time: shift.start_time || "-",
                end_time: shift.end_time || "-",
                days_left: daysLeft,
                week: item.week,
                day_order: DAY_KEYS.indexOf(item.dayKey),
              };
            })
            .filter(Boolean);
        })
      );

      const flattened = allRows.flat().sort((a, b) => {
        if (String(a.account_id) !== String(b.account_id)) {
          return String(a.account_id).localeCompare(String(b.account_id), undefined, {
            numeric: true,
          });
        }
        if (a.days_left !== b.days_left) return a.days_left - b.days_left;
        if (a.shortage_date !== b.shortage_date) {
          return String(a.shortage_date).localeCompare(String(b.shortage_date));
        }
        if (a.week !== b.week) return a.week - b.week;
        return a.day_order - b.day_order;
      });

      setTodayCheckRows(flattened);
    } catch (e) {
      console.error(e);
      setTodayCheckRows([]);
      Swal.fire("실패", e?.message || "Today 확인 조회 중 오류가 발생했습니다.", "error");
    } finally {
      setTodayCheckLoading(false);
    }
  }, [
    DAY_KEYS,
    accountList,
    activeStatus,
    buildTodayShortagePayload,
    formatYMD,
    getDateByWeekDay,
    hydrateSchedule,
    month,
    normalizeToOptionValue,
    positionLabelOf,
    rootLabelByValue,
    rootOptions,
    year,
  ]);

  const handleClickShortageItem = useCallback(
    async ({ position_type, week, dayKey, dayLabel, posLabel, 부족 }) => {
      const root_idx = getEffectiveRootIdx();

      if (!root_idx) {
        Swal.fire("안내", "root_idx가 없습니다. 상단 Root 선택을 확인하세요.", "info");
        return;
      }
      if (!position_type) {
        Swal.fire("안내", "직책(position_type)이 없습니다.", "info");
        return;
      }

      setSelectedPositionType(String(position_type));

      const d = getDateByWeekDay(year, month, week, dayKey);
      const ymd = d ? formatYMD(d) : "";
      const dayNum = d ? d.getDate() : null;
      setSelectedDayOfMonth(dayNum);

      const shift = getShiftByPosition(position_type);
      setShortageSelectedShift(shift);

      const rootLabel =
        rootOptions.find((o) => String(o.value) === String(root_idx))?.label ?? `root:${root_idx}`;

      try {
        setEmergencyLoading(true);
        setEmergencyRows([]);
        setEmergencyUseYnMap({});
        setOriginalEmergencyUseYnMap({});

        setEmergencyTitle(
          `${week}주차 ${dayLabel} (${ymd}${
            dayNum ? `, ${dayNum}일` : ""
          }) / ${posLabel} 부족-${부족} (${rootLabel})${
            shift?.start_time || shift?.end_time
              ? ` / 시작:${shift?.start_time || "-"} 마감:${shift?.end_time || "-"}`
              : ""
          }`
        );

        const res = await api.get("/Operate/EmergencyPersonList", {
          params: {
            root_idx,
            position_type,
            record_year: Number(year),
            record_month: Number(month),
            record_date: Number(dayNum),
          },
        });

        const list = res?.data?.list ?? res?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        setEmergencyRows(arr);

        const m = {};
        arr.forEach((it) => {
          const id = it?.idx;
          if (id == null) return;
          const v = String(it?.use_yn ?? "").trim();
          m[String(id)] = v;
        });

        setEmergencyUseYnMap(m);
        setOriginalEmergencyUseYnMap(m);
      } catch (e) {
        setEmergencyRows([]);
        setEmergencyUseYnMap({});
        setOriginalEmergencyUseYnMap({});
        Swal.fire("실패", e?.message || "응급 인력 조회 오류", "error");
      } finally {
        setEmergencyLoading(false);
      }
    },
    [getEffectiveRootIdx, getDateByWeekDay, year, month, formatYMD, rootOptions, getShiftByPosition]
  );

  const handleSaveEmployment = useCallback(
    async (idx, item) => {
      const id = String(idx ?? "").trim();
      if (!id) return;

      const account_id = String(selectedAccountId ?? "").trim();
      if (!account_id) {
        Swal.fire("안내", "거래처(account)를 선택하세요.", "info");
        return;
      }

      const member_id_raw = item?.member_id ?? item?.memberId ?? null;
      const member_id = member_id_raw ?? null;
      const name = item?.name ?? null;

      const useYnRaw = String(emergencyUseYnMap?.[id] ?? "").trim();

      // ✅ 저장 직전에도 확정 중복 방지
      if (useYnRaw === "3" && hasAnotherConfirmedEmployment(id)) {
        Swal.fire("안내", "이미 채용 확정된 인력이 있습니다.", "info");
        setEmergencyUseYnMap((prev) => ({
          ...(prev || {}),
          [id]: String(originalEmergencyUseYnMap?.[id] ?? item?.use_yn ?? "").trim(),
        }));
        return;
      }

      const use_yn = useYnRaw === "" ? null : Number(useYnRaw);

      const salaryRaw = item?.salary ?? null;
      const salary =
        salaryRaw == null || String(salaryRaw).trim() === ""
          ? null
          : Number(String(salaryRaw).replace(/[^\d-]/g, ""));

      if (!selectedDayOfMonth) {
        Swal.fire(
          "안내",
          "일자 정보가 없습니다. 부족항목을 클릭해서 날짜를 먼저 선택하세요.",
          "info"
        );
        return;
      }

      const start_time = String(shortageSelectedShift?.start_time ?? "").trim();
      const end_time = String(shortageSelectedShift?.end_time ?? "").trim();
      if (!start_time || !end_time) {
        Swal.fire("안내", "시작/마감 시간이 없습니다. 부족항목을 다시 클릭해 주세요.", "info");
        return;
      }

      try {
        setSavingEmployment(true);

        const userId = localStorage.getItem("user_id");

        const payload = {
          idx: Number(id),
          account_id: Number(account_id),
          member_id,
          salary,
          record_year: Number(year),
          record_month: Number(month),
          record_date: Number(selectedDayOfMonth),
          use_yn,
          name,
          start_time,
          end_time,
          user_id: userId,
        };

        const res = await api.post("/Operate/EmergencyPersonEmployment", payload);

        const ok = res?.data?.code === 200 || res?.data?.success === true || res?.status === 200;

        if (ok) {
          Swal.fire("저장 완료", "채용여부가 저장되었습니다.", "success");

          setOriginalEmergencyUseYnMap((prev) => ({
            ...(prev || {}),
            [id]: useYnRaw,
          }));

          setEmergencyUseYnMap((prev) => ({
            ...(prev || {}),
            [id]: useYnRaw,
          }));
        } else {
          Swal.fire("저장 실패", res?.data?.message || "서버 오류", "error");
        }
      } catch (e) {
        Swal.fire("저장 실패", e?.message || "오류", "error");
      } finally {
        setSavingEmployment(false);
      }
    },
    [
      emergencyUseYnMap,
      selectedDayOfMonth,
      year,
      month,
      shortageSelectedShift,
      selectedAccountId,
      hasAnotherConfirmedEmployment,
      originalEmergencyUseYnMap,
    ]
  );

  const renderEmergencyTable = () => {
    return (
      <MDBox mt={0} p={1} sx={{ border: "1px solid #0AC4E0", borderRadius: 1, height: "100%" }}>
        <MDBox sx={{ fontWeight: 700, mb: 0.5, fontSize: 14 }}>{emergencyTitle}</MDBox>

        {emergencyLoading ? (
          <MDBox sx={{ fontSize: 11, color: "#777" }}>조회 중...</MDBox>
        ) : (emergencyRows || []).length === 0 ? (
          <MDBox sx={{ fontSize: 11, color: "#777" }}>조회된 인원이 없습니다.</MDBox>
        ) : (
          <MDBox
            sx={{
              maxHeight: isMobile ? "45vh" : "45vh",
              overflowY: "auto",
              overflowX: "auto",
              "& table": { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
              "& th, & td": {
                border: "1px solid #e0e0e0",
                padding: "6px",
                fontSize: 11,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: "center",
              },
              "& th": { background: "#f7fbff", position: "sticky", top: 0, zIndex: 1 },
              "& select": {
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 6,
                border: "1px solid #d0d0d0",
                outline: "none",
                cursor: "pointer",
              },
            }}
          >
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>IDX</th>
                  <th style={{ width: 90 }}>이름</th>
                  <th style={{ width: 60 }}>직책</th>
                  <th style={{ width: 80 }}>급여</th>
                  <th style={{ width: 50 }}>차량</th>
                  <th style={{ width: 80 }}>상태</th>
                  <th style={{ width: 80 }}>구분</th>
                  <th style={{ width: 100 }}>비고</th>
                  <th style={{ width: 80 }}>채용여부</th>
                  <th style={{ width: 80 }}>저장</th>
                </tr>
              </thead>
              <tbody>
                {(emergencyRows || []).map((item, idx) => {
                  const rowId = String(item?.idx ?? "");
                  const useYnVal = String(
                    emergencyUseYnMap?.[rowId] ?? String(item?.use_yn ?? "")
                  ).trim();
                  const originalUseYnVal = String(
                    originalEmergencyUseYnMap?.[rowId] ?? String(item?.use_yn ?? "")
                  ).trim();
                  const isEmploymentChanged = useYnVal !== originalUseYnVal;

                  return (
                    <tr key={`${item?.idx ?? "x"}-${idx}`}>
                      <td title={String(item?.idx ?? "")}>{item?.idx ?? ""}</td>
                      <td title={String(item?.name ?? "")}>{item?.name ?? ""}</td>
                      <td title={String(item?.position_type ?? "")}>
                        {positionLabelOf(item?.position_type)}
                      </td>
                      <td title={String(item?.salary ?? "")}>{item?.salary ?? ""}</td>
                      <td title={String(item?.car_yn ?? "")}>{item?.car_yn ?? ""}</td>
                      <td
                        title={String(item?.status ?? "")}
                        style={{ color: statusColorOf(item?.status), fontWeight: 800 }}
                      >
                        {statusLabelOf(item?.status)}
                      </td>
                      <td title={String(item?.manpower_type ?? "")}>
                        {manpowerTypeLabelOf(item?.manpower_type)}
                      </td>
                      <td title={String(item?.note ?? "")} style={{ textAlign: "left" }}>
                        {item?.note ?? ""}
                      </td>
                      <td>
                        <select
                          value={useYnVal || ""}
                          onChange={(e) => {
                            const v = String(e.target.value ?? "").trim();

                            if (v === "3" && hasAnotherConfirmedEmployment(rowId)) {
                              Swal.fire("안내", "이미 채용 확정된 인력이 있습니다.", "info");
                              return;
                            }

                            setEmergencyUseYnMap((prev) => ({ ...(prev || {}), [rowId]: v }));
                          }}
                          style={{
                            color: employmentColorOf(useYnVal),
                            fontWeight: 800,
                            width: "100%",
                            background: "#fff",
                          }}
                        >
                          <option value="">선택</option>
                          {employmentOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleSaveEmployment(item?.idx, item)}
                          disabled={savingEmployment}
                          style={{
                            width: "100%",
                            padding: "4px 8px",
                            borderRadius: 8,
                            border: isEmploymentChanged ? "1px solid #d32f2f" : "1px solid #0AC4E0",
                            background: isEmploymentChanged ? "#ffebee" : "#fff",
                            color: isEmploymentChanged ? "#d32f2f" : "#111",
                            cursor: savingEmployment ? "not-allowed" : "pointer",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                          title="채용여부 저장"
                        >
                          저장
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </MDBox>
        )}
      </MDBox>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          flexWrap: "wrap",
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        <TextField
          select
          size="small"
          label="연도"
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ minWidth: 110 }}
          SelectProps={{ native: true }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="월"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          sx={{ minWidth: 90 }}
          SelectProps={{ native: true }}
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </TextField>

        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={selectedAccountOption}
          onChange={(_, opt) => {
            // 입력 비움 시 거래처 선택 유지
            if (!opt) return;
            setSelectedAccountId(opt.value);
            setLoading(true);
          }}
          inputValue={accountInput}
          onInputChange={(_, newValue) => setAccountInput(newValue)}
          getOptionLabel={(opt) => opt?.label ?? ""}
          isOptionEqualToValue={(opt, val) => opt.value === val.value}
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
                "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                "& input": { padding: "0 8px" },
              }}
            />
          )}
        />

        <TextField
          select
          size="small"
          value={selectedRootIdx}
          onChange={(e) => setSelectedRootIdx(e.target.value)}
          sx={{
            minWidth: 260,
            "& .MuiInputBase-root": { height: 35 },
            "& .MuiSelect-select": {
              display: "flex",
              alignItems: "center",
              height: "100%",
              paddingTop: 0,
              paddingBottom: 0,
              color: isRootChanged ? "#d32f2f" : "inherit",
              fontWeight: isRootChanged ? 700 : 400,
            },
            "& .MuiInputLabel-root": {
              top: -2,
              color: isRootChanged ? "#d32f2f" : "inherit",
              fontWeight: isRootChanged ? 700 : 400,
            },
            "& .MuiInputLabel-shrink": { top: 0 },
          }}
          SelectProps={{ displayEmpty: true }}
        >
          {(rootOptions || []).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <MDButton
          variant="outlined"
          color="dark"
          size="small"
          onClick={handleOpenTodayCheck}
          disabled={todayCheckLoading}
        >
          Today확인
        </MDButton>
        <MDButton variant="contained" color="success" size="small" onClick={handleAddRow}>
          행추가
        </MDButton>
        <MDButton variant="contained" color="info" size="small" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      <MDBox pt={0} pb={1}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            {renderTable(table, activeRows, originalRows)}
          </Grid>

          <Grid item xs={12} md={6}>
            <MDBox mt={0} p={1} sx={{ border: "1px solid #519A66", borderRadius: 1 }}>
              <MDBox sx={{ fontWeight: 700, mb: 0.5, fontSize: 14 }}>
                부족 항목(기준: 위 테이블)
              </MDBox>

              {(shortageList?.list || []).length === 0 ? (
                <MDBox sx={{ fontSize: 11, color: "#2e7d32" }}>부족한 항목이 없습니다.</MDBox>
              ) : (
                <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {Object.keys({
                    ...shortageMatrixByWeek,
                    ...(excludedMatrixByWeek || {}),
                  })
                    .map((x) => Number(x))
                    .filter((n) => Number.isFinite(n) && n > 0)
                    .sort((a, b) => a - b)
                    .map((week) => (
                      <MDBox
                        key={`week-card-${week}`}
                        sx={{ border: "1px solid #e0e0e0", borderRadius: 1, overflow: "hidden" }}
                      >
                        <MDBox
                          sx={{
                            px: 1.2,
                            py: 0.8,
                            fontWeight: 700,
                            background: "#f7f7f7",
                            borderBottom: "1px solid #e0e0e0",
                            fontSize: 11,
                          }}
                        >
                          {week}주차 부족 현황
                        </MDBox>

                        <MDBox sx={{ overflowX: "auto" }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              tableLayout: "fixed",
                            }}
                          >
                            <thead>
                              <tr>
                                {DAY_LABELS.map((d) => (
                                  <th
                                    key={`h-${week}-${d}`}
                                    style={{
                                      borderRight: "1px solid #eee",
                                      borderBottom: "1px solid #eee",
                                      padding: "4px",
                                      fontSize: 11,
                                      background: "#FF9760",
                                      whiteSpace: "nowrap",
                                      color: "white",
                                    }}
                                  >
                                    {d}
                                  </th>
                                ))}
                              </tr>
                            </thead>

                            <tbody>
                              <tr>
                                {DAY_KEYS.map((dayKey, idx) => {
                                  const items = shortageMatrixByWeek?.[week]?.[dayKey] || [];
                                  const isExcludedCell = !!excludedMatrixByWeek?.[week]?.[dayKey];
                                  const isWeekend = dayKey === "sat" || dayKey === "sun";

                                  return (
                                    <td
                                      key={`c-${week}-${dayKey}`}
                                      style={{
                                        verticalAlign: "top",
                                        padding: "4px",
                                        fontSize: 11,
                                        borderRight:
                                          idx === DAY_KEYS.length - 1 ? "none" : "1px solid #eee",
                                        background: isWeekend ? "#fff7f2" : "#fff",
                                        height: 30,
                                      }}
                                    >
                                      {isExcludedCell ? (
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            border: "1px dashed #e0e0e0",
                                            borderRadius: 6,
                                            padding: "6px 6px",
                                            background: "#fafafa",
                                            color: "#777",
                                            fontSize: 11,
                                            fontWeight: 700,
                                          }}
                                        >
                                          당월X
                                        </div>
                                      ) : items.length === 0 ? (
                                        <div style={{ color: "#999" }}>-</div>
                                      ) : (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "row",
                                            flexWrap: "wrap",
                                            gap: 6,
                                            alignItems: "center",
                                          }}
                                        >
                                          {items.map((it, i) => (
                                            <div
                                              key={`it-${week}-${dayKey}-${it.posLabel}-${i}`}
                                              onClick={() =>
                                                handleClickShortageItem({
                                                  week,
                                                  dayKey,
                                                  dayLabel: DAY_LABELS[idx],
                                                  position_type: it.position_type,
                                                  posLabel: it.posLabel,
                                                  부족: it.부족,
                                                })
                                              }
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                                border: "1px solid #0AC4E0",
                                                borderRadius: 999,
                                                padding: "3px 8px",
                                                background: "#fff",
                                                cursor: "pointer",
                                                userSelect: "none",
                                                lineHeight: 1,
                                                fontSize: 11,
                                                whiteSpace: "nowrap",
                                              }}
                                              title="클릭해서 오른쪽 응급인력 조회"
                                            >
                                              <span style={{ fontWeight: 700 }}>{it.posLabel}</span>
                                              <span style={{ fontWeight: 700, color: "#d32f2f" }}>
                                                -{it.부족}
                                              </span>
                                              <span style={{ color: "#777" }}>
                                                {it.actual}/{it.required}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </MDBox>
                      </MDBox>
                    ))}
                </MDBox>
              )}
            </MDBox>
          </Grid>

          <Grid item xs={12} md={6}>
            {renderEmergencyTable()}
          </Grid>
        </Grid>
      </MDBox>

      <Dialog
        open={todayModalOpen}
        onClose={() => setTodayModalOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>{`Today확인 (${year}-${month})`}</DialogTitle>
        <DialogContent>
          {todayCheckLoading ? (
            <MDBox sx={{ py: 2, fontSize: 13, color: "#555" }}>
              전체 업장 부족 항목 계산 중...
            </MDBox>
          ) : todayCheckRows.length === 0 ? (
            <MDBox sx={{ py: 2, fontSize: 13, color: "#555" }}>
              오늘 이후 기준으로 부족한 항목이 없습니다.
            </MDBox>
          ) : (
            <MDBox
              sx={{
                maxHeight: isMobile ? "60vh" : "70vh",
                overflow: "auto",
                "& table": { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
                "& th, & td": {
                  border: "1px solid #e0e0e0",
                  padding: "8px 6px",
                  fontSize: 12,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                },
                "& th": {
                  background: "#f7fbff",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  fontWeight: 700,
                },
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "20%" }}>거래처</th>
                    <th style={{ width: "22%" }}>권역</th>
                    <th style={{ width: "14%" }}>부족한 일자</th>
                    <th style={{ width: "12%" }}>구분</th>
                    <th style={{ width: "10%" }}>시작</th>
                    <th style={{ width: "10%" }}>마감</th>
                    <th style={{ width: "12%" }}>남은 일수</th>
                  </tr>
                </thead>
                <tbody>
                  {todayCheckRows.map((row, idx) => (
                    <tr key={`${row.account_id}-${row.shortage_date}-${row.position_label}-${idx}`}>
                      <td title={row.account_name}>{row.account_name}</td>
                      <td title={row.root_label}>{row.root_label}</td>
                      <td>{row.shortage_date}</td>
                      <td>{row.position_label}</td>
                      <td>{row.start_time}</td>
                      <td>{row.end_time}</td>
                      <td
                        style={{ color: row.days_left <= 10 ? "#d32f2f" : "#111", fontWeight: 700 }}
                      >
                        {row.days_left}일
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MDBox>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AccountMemberRecordMainTableTab;
