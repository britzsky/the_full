/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery } from "@mui/material";
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

  const [sidoOptions, setSidoOptions] = useState([NONE_OPTION]);
  const [sigunguOptions, setSigunguOptions] = useState([NONE_OPTION]);
  const [selectedSidoCode, setSelectedSidoCode] = useState("");
  const [selectedSigunguCode, setSelectedSigunguCode] = useState("");
  const [originalSidoCode, setOriginalSidoCode] = useState("");
  const [originalSigunguCode, setOriginalSigunguCode] = useState("");

  // ✅ 부족 클릭 시 오른쪽에 보여줄 응급 인력 리스트
  const [emergencyRows, setEmergencyRows] = useState([]);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyTitle, setEmergencyTitle] = useState("부족 인력 조회");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));

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
      { value: "1", label: "(주)더채움" },
      { value: "2", label: "더채움" },
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
  // ✅ 코드/날짜 유틸
  // =========================
  const normCode = useCallback((v) => {
    const s = String(v ?? "").trim();
    return s === "" ? "" : s;
  }, []);

  const isValueInOptions = useCallback((val, opts) => {
    const v = String(val ?? "");
    return (opts || []).some((o) => String(o.value) === v);
  }, []);

  const pad2 = (n) => String(n).padStart(2, "0");
  const formatYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  // 월의 week(1..n) + 요일(mon..sun) → 날짜 계산(월 기준, 주 시작=월요일)
  // * 달력 규칙이 회사/데이터와 100% 동일하진 않을 수 있지만 “몇일인지” 확인용으로 유용
  const getDateByWeekDay = useCallback(
    (y, mm, week, dayKey) => {
      const m = Number(mm); // 1..12
      const w = Number(week);
      const dayIndex = DAY_KEYS.indexOf(dayKey); // mon=0..sun=6
      if (!Number.isFinite(m) || !Number.isFinite(w) || dayIndex < 0) return null;

      // 1일
      const first = new Date(y, m - 1, 1);
      // JS: 일=0..토=6 → 월요일 기준 offset
      const firstDow = first.getDay(); // 0..6
      const mondayBased = (firstDow + 6) % 7; // 월=0..일=6
      // “1일이 포함된 주”의 월요일 날짜
      const firstWeekMonday = new Date(y, m - 1, 1 - mondayBased);

      // week(1) = firstWeekMonday 주
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

  // 첫 거래처 자동 선택
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
  // ✅ 시도/시군구 옵션 조회
  // =========================
  const fetchSidoOptions = useCallback(async () => {
    try {
      const res = await api.get("/Operate/SidoList");
      const opts = (res.data || []).map((x) => ({
        value: String(x.sido_code),
        label: x.sido_name,
      }));

      const merged = [NONE_OPTION, ...opts];
      setSidoOptions(merged);

      // ✅ 현재 선택값이 옵션에 없으면 "지정안됨"으로
      setSelectedSidoCode((prev) => {
        const v = normCode(prev);
        if (v === "") return "";
        return isValueInOptions(v, merged) ? v : "";
      });
    } catch (e) {
      console.error(e);
      setSidoOptions([NONE_OPTION]);
      setSelectedSidoCode("");
    }
  }, [NONE_OPTION, isValueInOptions, normCode]);

  const fetchSigunguOptions = useCallback(
    async (sido_code) => {
      const sido = normCode(sido_code);

      if (!sido) {
        setSigunguOptions([NONE_OPTION]);
        setSelectedSigunguCode("");
        return;
      }

      try {
        const res = await api.get("/Operate/SigunguList", { params: { sido_code: sido } });
        const opts = (res.data || []).map((x) => ({
          value: String(x.sigungu_code),
          label: x.sigungu_name,
        }));

        const merged = [NONE_OPTION, ...opts];
        setSigunguOptions(merged);

        // ✅ 핵심: 기존값을 무조건 ""로 지우지 말고,
        // 현재 선택값이 options에 있으면 유지, 없으면 ""로
        setSelectedSigunguCode((prev) => {
          const v = normCode(prev);
          if (v === "") return "";
          return isValueInOptions(v, merged) ? v : "";
        });
      } catch (e) {
        console.error(e);
        setSigunguOptions([NONE_OPTION]);
        setSelectedSigunguCode("");
      }
    },
    [NONE_OPTION, isValueInOptions, normCode]
  );

  useEffect(() => {
    fetchSidoOptions();
  }, [fetchSidoOptions]);

  useEffect(() => {
    fetchSigunguOptions(selectedSidoCode);
  }, [selectedSidoCode, fetchSigunguOptions]);

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
  // ✅ 조회: 표준 + 상황(연/월) 같이 조회
  // =========================
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        await fetchAccountStandardList();

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
  ]);

  // =========================
  // ✅ activeRows 로딩 후 스케줄 키 주입 + 원본 스냅샷 갱신 + 지역 매핑
  // =========================
  useEffect(() => {
    if (Array.isArray(activeRows) && activeRows.length > 0) {
      const updated = activeRows.map((row) => hydrateSchedule(row));
      setActiveRows(updated);
      setOriginalRows(updated);

      const first = updated[0] || {};

      const nextSido = normCode(first.sido_code);
      const nextSigungu = normCode(first.sigungu_code);

      // ✅ sido: 값이 있으면 옵션에 있는지 체크(없으면 지정안됨)
      setSelectedSidoCode((prev) => {
        const target = nextSido; // 서버값 우선
        if (target === "") return "";
        return isValueInOptions(target, sidoOptions) ? target : "";
      });
      setOriginalSidoCode(nextSido);

      // ✅ sigungu: 우선 값 세팅해두고, fetchSigunguOptions에서 옵션 로딩 후 유지/초기화 판단
      setSelectedSigunguCode(nextSigungu);
      setOriginalSigunguCode(nextSigungu);
    } else {
      setOriginalRows([]);
      // 데이터가 없을 때는 지역도 지정안됨
      setSelectedSidoCode("");
      setSelectedSigunguCode("");
      setOriginalSidoCode("");
      setOriginalSigunguCode("");
    }
    // length 기준 유지
  }, [
    activeRows?.length,
    hydrateSchedule,
    setActiveRows,
    setOriginalRows,
    normCode,
    isValueInOptions,
    sidoOptions,
  ]);

  // ✅ sido가 "지정안됨"으로 바뀌면 sigungu도 같이 지정안됨 처리
  useEffect(() => {
    if (!String(selectedSidoCode ?? "").trim()) {
      setSigunguOptions([NONE_OPTION]);
      setSelectedSigunguCode("");
    }
  }, [selectedSidoCode, NONE_OPTION]);

  const isSidoChanged = String(selectedSidoCode ?? "") !== String(originalSidoCode ?? "");
  const isSigunguChanged = String(selectedSigunguCode ?? "") !== String(originalSigunguCode ?? "");

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
    // ✅ 전체 조회(거래처 미선택/전체)면 오른쪽 응급인력 영역 초기화
    if (!String(selectedAccountId ?? "").trim()) {
      setEmergencyRows([]);
      setEmergencyLoading(false);
      setEmergencyTitle("부족 인력 조회");
    }
  }, [selectedAccountId]);

  // ✅ 저장 로직
  const handleSave = async () => {
    if (!String(selectedSidoCode ?? "").trim() || !String(selectedSigunguCode ?? "").trim()) {
      Swal.fire("안내", "업장 지역(시도/시군구)을 선택하세요.", "info");
      return;
    }

    const changedRows = (activeRows || []).filter((row, idx) => {
      const original = originalRows?.[idx];
      if (!original) return true;

      return Object.keys(row).some(
        (key) => String(row?.[key] ?? "") !== String(original?.[key] ?? "")
      );
    });

    const _isSidoChanged = String(selectedSidoCode ?? "") !== String(originalSidoCode ?? "");
    const _isSigunguChanged =
      String(selectedSigunguCode ?? "") !== String(originalSigunguCode ?? "");
    const isRegionChanged = _isSidoChanged || _isSigunguChanged;

    if (changedRows.length === 0 && !isRegionChanged) {
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
          sido_code: selectedSidoCode ? Number(selectedSidoCode) : null,
          sigungu_code: selectedSigunguCode ? Number(selectedSigunguCode) : null,
        };
      });

      const res = await api.post("/Operate/AccountRecordStandardSave", { data: processed });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");

        const snapshot = (activeRows || []).map((r) => hydrateSchedule(r));
        setOriginalRows(snapshot);

        setOriginalSidoCode(String(selectedSidoCode ?? ""));
        setOriginalSigunguCode(String(selectedSigunguCode ?? ""));

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
          maxHeight: isMobile ? "55vh" : "70vh",
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

  // ✅ 숫자 파서
  const toInt = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s.replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, []);

  // ✅ 주차 파서
  const toWeekNo = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s.replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, []);

  // ✅ none 판별
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

  // ✅ 부족 목록 생성
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

  // =========================================
  // ✅ 부족 항목 클릭 → 응급인력 조회
  // =========================================
  const getEffectiveSidoSigungu = useCallback(() => {
    const fallbackSido = activeRows?.[0]?.sido_code != null ? String(activeRows[0].sido_code) : "";
    const fallbackSigungu =
      activeRows?.[0]?.sigungu_code != null ? String(activeRows[0].sigungu_code) : "";

    const sido_code = String(selectedSidoCode ?? "").trim() || fallbackSido;
    const sigungu_code = String(selectedSigunguCode ?? "").trim() || fallbackSigungu;

    return { sido_code, sigungu_code };
  }, [activeRows, selectedSidoCode, selectedSigunguCode]);

  const handleClickShortageItem = useCallback(
    async ({ position_type, week, dayKey, dayLabel, posLabel, 부족 }) => {
      const { sido_code, sigungu_code } = getEffectiveSidoSigungu();

      if (!sido_code || !sigungu_code) {
        Swal.fire("안내", "시도/시군구 코드가 없습니다. 상단 지역 선택을 확인하세요.", "info");
        return;
      }
      if (!position_type) {
        Swal.fire("안내", "직책(position_type)이 없습니다.", "info");
        return;
      }

      // ✅ “몇일인지” 계산
      const d = getDateByWeekDay(year, month, week, dayKey);
      const ymd = d ? formatYMD(d) : "";
      const dayNum = d ? `${d.getDate()}일` : "";

      try {
        setEmergencyLoading(true);
        setEmergencyRows([]);

        setEmergencyTitle(
          `${week}주차 ${dayLabel} (${ymd}${
            dayNum ? `, ${dayNum}` : ""
          }) / ${posLabel} 부족-${부족} (시도:${sido_code}, 시군구:${sigungu_code})`
        );

        const res = await api.get("/Operate/EmergencyPersonList", {
          params: {
            sido_code,
            sigungu_code,
            position_type,
          },
        });

        const list = res?.data?.list ?? res?.data ?? [];
        setEmergencyRows(Array.isArray(list) ? list : []);
      } catch (e) {
        setEmergencyRows([]);
        Swal.fire("실패", e?.message || "응급 인력 조회 오류", "error");
      } finally {
        setEmergencyLoading(false);
      }
    },
    [getEffectiveSidoSigungu, getDateByWeekDay, year, month]
  );

  // =========================================
  // ✅ 오른쪽 응급인력 테이블 렌더
  // =========================================
  const renderEmergencyTable = () => {
    return (
      <MDBox mt={0} p={1} sx={{ border: "1px solid #0AC4E0", borderRadius: 1, height: "100%" }}>
        <MDBox sx={{ fontWeight: 700, mb: 0.5, fontSize: 14 }}>{emergencyTitle}</MDBox>

        {emergencyLoading ? (
          <MDBox sx={{ fontSize: 12, color: "#777" }}>조회 중...</MDBox>
        ) : (emergencyRows || []).length === 0 ? (
          <MDBox sx={{ fontSize: 12, color: "#777" }}>조회된 인원이 없습니다.</MDBox>
        ) : (
          <MDBox
            sx={{
              maxHeight: isMobile ? "45vh" : "60vh",
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
            }}
          >
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>IDX</th>
                  <th style={{ width: 90 }}>이름</th>
                  <th style={{ width: 70 }}>직책</th>
                  <th style={{ width: 80 }}>급여</th>
                  <th style={{ width: 60 }}>차량</th>
                  <th style={{ width: 90 }}>상태</th>
                  <th style={{ width: 90 }}>구분</th>
                  <th style={{ width: 140 }}>비고</th>
                </tr>
              </thead>
              <tbody>
                {(emergencyRows || []).map((item, idx) => (
                  <tr key={`${item?.idx ?? "x"}-${idx}`}>
                    <td title={String(item?.idx ?? "")}>{item?.idx ?? ""}</td>
                    <td title={String(item?.name ?? "")}>{item?.name ?? ""}</td>
                    <td title={String(item?.position_type ?? "")}>{item?.position_type ?? ""}</td>
                    <td title={String(item?.salary ?? "")}>{item?.salary ?? ""}</td>
                    <td title={String(item?.car_yn ?? "")}>{item?.car_yn ?? ""}</td>
                    <td title={String(item?.status ?? "")}>{item?.status ?? ""}</td>
                    <td title={String(item?.manpower_type ?? "")}>{item?.manpower_type ?? ""}</td>
                    <td title={String(item?.note ?? "")} style={{ textAlign: "left" }}>
                      {item?.note ?? ""}
                    </td>
                  </tr>
                ))}
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
      {/* 상단 컨트롤 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          // ✅ 왼쪽 정렬
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
            setSelectedAccountId(opt ? opt.value : "");
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
          label="시도"
          value={selectedSidoCode}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedSidoCode(v);
            // ✅ 시도 바꾸면 시군구는 지정안됨으로 리셋
            setSelectedSigunguCode("");
          }}
          sx={{
            minWidth: 140,
            "& .MuiInputBase-root": { height: 35 },
            "& .MuiSelect-select": {
              display: "flex",
              alignItems: "center",
              height: "100%",
              paddingTop: 0,
              paddingBottom: 0,
              color: isSidoChanged ? "#d32f2f" : "inherit",
              fontWeight: isSidoChanged ? 700 : 400,
            },
            "& .MuiInputLabel-root": {
              top: -2,
              color: isSidoChanged ? "#d32f2f" : "inherit",
              fontWeight: isSidoChanged ? 700 : 400,
            },
            "& .MuiInputLabel-shrink": { top: 0 },
          }}
          SelectProps={{ displayEmpty: true }}
        >
          {(sidoOptions || []).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="시군구"
          value={selectedSigunguCode}
          onChange={(e) => setSelectedSigunguCode(e.target.value)}
          sx={{
            minWidth: 160,
            "& .MuiInputBase-root": { height: 35 },
            "& .MuiSelect-select": {
              display: "flex",
              alignItems: "center",
              height: "100%",
              paddingTop: 0,
              paddingBottom: 0,
              color: isSigunguChanged ? "#d32f2f" : "inherit",
              fontWeight: isSigunguChanged ? 700 : 400,
            },
            "& .MuiInputLabel-root": {
              top: -2,
              color: isSigunguChanged ? "#d32f2f" : "inherit",
              fontWeight: isSigunguChanged ? 700 : 400,
            },
            "& .MuiInputLabel-shrink": { top: 0 },
          }}
          SelectProps={{ displayEmpty: true }}
          disabled={!selectedSidoCode || (sigunguOptions || []).length === 0}
        >
          {(sigunguOptions || []).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <MDButton variant="contained" color="success" size="small" onClick={handleAddRow}>
          행추가
        </MDButton>

        <MDButton variant="contained" color="info" size="small" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      {/* 테이블들 */}
      <MDBox pt={0} pb={1}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            {renderTable(table, activeRows, originalRows)}
          </Grid>

          {/* ✅ 아래 영역: 왼쪽(부족항목) + 오른쪽(응급인력) */}
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
                                                  dayKey, // ✅ 날짜 계산용
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

          {/* ✅ 부족항목 오른쪽: 응급 인력 리스트 */}
          <Grid item xs={12} md={6}>
            {renderEmergencyTable()}
          </Grid>
        </Grid>
      </MDBox>
    </>
  );
}

export default AccountMemberRecordMainTableTab;
