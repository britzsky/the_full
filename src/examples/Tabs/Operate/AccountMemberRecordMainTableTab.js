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

import useAccountMemberRecordMainTableData from "./AccountMemberRecordMainTableData";
import LoadingScreen from "layouts/loading/loadingscreen";

function AccountMemberRecordMainTableTab() {
  // =========================
  // ✅ 근무표(월~일) key: mon, tue ...
  // =========================
  const DAY_LABELS = useMemo(() => ["월", "화", "수", "목", "금", "토", "일"], []);
  const DAY_KEYS = useMemo(() => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], []);

  const scheduleKeySet = useMemo(() => new Set(DAY_KEYS), [DAY_KEYS]);

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
        size: 60,
      })),
    [DAY_KEYS, DAY_LABELS]
  );

  const [selectedAccountId, setSelectedAccountId] = useState(""); // ✅ 기본: 전체
  const [accountInput, setAccountInput] = useState("");
  const [activeStatus, setActiveStatus] = useState("N");
  const [sidoOptions, setSidoOptions] = useState([]); // [{value,label}]
  const [sigunguOptions, setSigunguOptions] = useState([]); // [{value,label}]
  const [selectedSidoCode, setSelectedSidoCode] = useState("");
  const [selectedSigunguCode, setSelectedSigunguCode] = useState("");
  const [originalSidoCode, setOriginalSidoCode] = useState("");
  const [originalSigunguCode, setOriginalSigunguCode] = useState("");

  const tableContainerRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,
    accountList,
    fetchAccountMembersAllList,
  } = useAccountMemberRecordMainTableData(selectedAccountId, activeStatus);

  const [loading, setLoading] = useState(true);

  const normalizeTime = (t) => {
    if (!t) return "";
    return String(t)
      .trim()
      .replace(/^0(\d):/, "$1:");
  };

  // 시간 옵션
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

  const corOptions = [
    { value: "1", label: "(주)더채움" },
    { value: "2", label: "더채움" },
  ];

  // ✅ 직책 옵션 (필드명은 idx 그대로 사용)
  const positionOptions = useMemo(
    () => [
      { value: "4", label: "조리사" },
      { value: "5", label: "조리원" },
    ],
    []
  );

  // ✅ (mon~sun) 스케줄 기본 키가 없으면 채워 넣기
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

  const accountOptions = useMemo(() => {
    return (accountList || []).map((a) => ({
      value: String(a.account_id),
      label: a.account_name,
    }));
  }, [accountList]);

  // 첫 거래처 자동 선택 (전체 없음)
  useEffect(() => {
    if (!selectedAccountId && accountOptions.length > 0) {
      setSelectedAccountId(accountOptions[0].value);
      setAccountInput(accountOptions[0].label);
    }
  }, [accountOptions.length]);

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  const fetchSidoOptions = useCallback(async () => {
    try {
      const res = await api.get("/Operate/SidoList");
      const opts = (res.data || []).map((x) => ({
        value: String(x.sido_code),
        label: x.sido_name,
      }));
      setSidoOptions(opts);

      // 첫 시도 자동 선택
      if (!selectedSidoCode && opts.length > 0) {
        setSelectedSidoCode(opts[0].value);
      }
    } catch (e) {
      console.error(e);
      setSidoOptions([]);
    }
  }, [selectedSidoCode]);

  const fetchSigunguOptions = useCallback(async (sido_code) => {
    if (!sido_code) {
      setSigunguOptions([]);
      setSelectedSigunguCode("");
      return;
    }

    try {
      const res = await api.get("/Operate/SigunguList", { params: { sido_code } });
      const opts = (res.data || []).map((x) => ({
        value: String(x.sigungu_code),
        label: x.sigungu_name,
      }));
      setSigunguOptions(opts);

      // 첫 시군구 자동 선택
      setSelectedSigunguCode(opts[0]?.value || "");
    } catch (e) {
      console.error(e);
      setSigunguOptions([]);
      setSelectedSigunguCode("");
    }
  }, []);

  useEffect(() => {
    fetchSidoOptions();
  }, [fetchSidoOptions]);

  useEffect(() => {
    fetchSigunguOptions(selectedSidoCode);
  }, [selectedSidoCode, fetchSigunguOptions]);

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

  // ✅ 조회
  useEffect(() => {
    setLoading(true);
    Promise.resolve(fetchAccountMembersAllList()).finally(() => setLoading(false));
  }, [selectedAccountId, activeStatus]);

  // ✅ activeRows 로딩 후 스케줄 키 주입 + 원본 스냅샷 갱신
  useEffect(() => {
    if (Array.isArray(activeRows) && activeRows.length > 0) {
      const updated = activeRows.map((row) => hydrateSchedule(row));
      setActiveRows(updated);
      setOriginalRows(updated);

      // ✅ 조회 결과에서 sido/sigungu 대표값 뽑기 (첫 행 기준)
      const first = updated[0] || {};
      const nextSido = first.sido_code != null ? String(first.sido_code) : "";
      const nextSigungu = first.sigungu_code != null ? String(first.sigungu_code) : "";

      // ✅ 시도/시군구 옵션 로드된 후에 값 세팅이 안전
      if (nextSido) {
        setSelectedSidoCode(nextSido);
        setOriginalSidoCode(nextSido);
      }
      if (nextSigungu) {
        setSelectedSigunguCode(nextSigungu);
        setOriginalSigunguCode(nextSigungu);
      }
    } else {
      setOriginalRows([]);
    }
  }, [activeRows?.length]);

  const isSidoChanged = String(selectedSidoCode ?? "") !== String(originalSidoCode ?? "");
  const isSigunguChanged = String(selectedSigunguCode ?? "") !== String(originalSigunguCode ?? "");
  const isRegionChanged = isSidoChanged || isSigunguChanged;

  const columns = useMemo(
    () => [
      { header: "구분", accessorKey: "account_id", size: 180 },
      { header: "직책", accessorKey: "position_type", size: 120 }, // ✅ 근무형태 → 직책
      { header: "시작", accessorKey: "start_time", size: 80 },
      { header: "마감", accessorKey: "end_time", size: 80 },
      ...scheduleColumns,
    ],
    [scheduleColumns]
  );

  const table = useReactTable({
    data: activeRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ✅ 저장 로직
  const handleSave = async () => {
    const changedRows = (activeRows || []).filter((row, idx) => {
      const original = originalRows?.[idx];
      if (!original) return true;

      return Object.keys(row).some(
        (key) => String(row?.[key] ?? "") !== String(original?.[key] ?? "")
      );
    });

    const isSidoChanged = String(selectedSidoCode ?? "") !== String(originalSidoCode ?? "");
    const isSigunguChanged =
      String(selectedSigunguCode ?? "") !== String(originalSigunguCode ?? "");
    const isRegionChanged = isSidoChanged || isSigunguChanged;

    // ✅ row 변경도 없고, 지역 변경도 없으면 저장 안 함
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

      // ✅ region 변경만 있는 경우도 저장되어야 하므로,
      // changedRows가 0이면 "전체 rows"에 region을 붙여서 보냄(또는 서버 정책에 맞게 최소 1개만 보내도 됨)
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

      const res = await api.post("/Operate/AccountRecordStandardSave", {
        data: processed,
      });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");

        const snapshot = (activeRows || []).map((r) => hydrateSchedule(r));
        setOriginalRows(snapshot);

        // ✅ 지역 select 원본도 갱신 (빨간색 해제)
        setOriginalSidoCode(String(selectedSidoCode ?? ""));
        setOriginalSigunguCode(String(selectedSigunguCode ?? ""));

        await fetchAccountMembersAllList();
      } else {
        Swal.fire("저장 실패", res.data.message || "서버 오류", "error");
      }
    } catch (err) {
      Swal.fire("저장 실패", err?.message || "오류", "error");
    }
  };

  // ✅ 행추가
  const handleAddRow = () => {
    const firstRealAccount = (accountOptions || []).find((o) => o.value !== "");
    const defaultAccountId =
      String(selectedAccountId ?? "") !== ""
        ? String(selectedAccountId)
        : String(firstRealAccount?.value ?? "");

    const newRow = {
      account_id: defaultAccountId, // ✅ 첫 거래처
      cor_type: "1",
      position_type: "4", // ✅ 기본 직책: 조리사
      start_time: startTimes?.[0] ?? "5:30",
      end_time: endTimes?.[0] ?? "10:00",
      ...makeEmptySchedule(), // ✅ mon~sun = "" (숫자 입력)
    };

    setActiveRows((prev) => [newRow, ...(prev || [])]);
    setOriginalRows((prev) => [newRow, ...(prev || [])]);
  };

  // ✅ 근무표 합계: 요일 컬럼 숫자 합계
  const getScheduleColumnTotal = useCallback((rows, key) => {
    let total = 0;
    (rows || []).forEach((r) => {
      const raw = r?.[key];
      const n = Number(String(raw ?? "").trim());
      if (!Number.isNaN(n)) total += n;
    });
    return total;
  }, []);

  // ✅ 숫자만 남기는 유틸
  const onlyDigits = (v) => String(v ?? "").replace(/[^\d]/g, "");

  const renderTable = (tableArg, rows, originals) => {
    // ✅ select 로 처리할 컬럼들 (요일 mon~sun 은 input)
    const selectFields = new Set([
      "account_id",
      "cor_type",
      "position_type",
      "start_time",
      "end_time",
    ]);

    // ✅ 주말 배경
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
          maxHeight: isMobile ? "55vh" : "75vh",
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
            fontSize: "12px",
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
            fontSize: "12px",
            padding: "4px",
            minWidth: "40px",
            border: "none",
            background: "transparent",
            outline: "none",
            cursor: "pointer",
          },
          "& select.edited-cell": { color: "#d32f2f", fontWeight: 600 },

          // ✅ input 스타일 (요일칸)
          "& input.day-num": {
            width: "100%",
            fontSize: "12px",
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

                  const isSelect = selectFields.has(colKey);

                  const handleCellChange = (newValue) => {
                    const updatedRows = (rows || []).map((r, idx) => {
                      if (idx !== rowIndex) return r;
                      const merged = hydrateSchedule(r);
                      return { ...merged, [colKey]: newValue };
                    });
                    setActiveRows(updatedRows);
                  };

                  const cellBg = getScheduleBg(colKey);

                  return (
                    <td
                      key={cell.id}
                      style={{
                        background: cellBg,
                        textAlign: scheduleKeySet.has(colKey) ? "center" : "left",
                      }}
                      className={isChanged ? "edited-cell" : ""}
                    >
                      {/* ✅ 요일(mon~sun)은 숫자 입력 input */}
                      {scheduleKeySet.has(colKey) ? (
                        <input
                          className={`day-num ${isChanged ? "edited-cell" : ""}`}
                          value={currentValue ?? ""}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          onChange={(e) => handleCellChange(onlyDigits(e.target.value))}
                          onBlur={(e) => {
                            // 000 -> 0 같은 정리(원치 않으면 삭제 가능)
                            const cleaned = onlyDigits(e.target.value);
                            const normalized = cleaned === "" ? "" : String(Number(cleaned));
                            if (normalized !== String(currentValue ?? "")) {
                              handleCellChange(normalized);
                            }
                          }}
                        />
                      ) : isSelect ? (
                        // ✅ 구분(account_id) = 거래처 선택 Autocomplete
                        colKey === "account_id" ? (
                          <Autocomplete
                            size="small"
                            options={accountOptions.filter((o) => o.value !== "")} // 행 단위 선택에서는 "전체" 제외
                            value={(() => {
                              const v = String(currentValue ?? "");
                              return (
                                accountOptions
                                  .filter((o) => o.value !== "")
                                  .find((o) => o.value === v) || null
                              );
                            })()}
                            onChange={(_, opt) => handleCellChange(opt ? opt.value : "")}
                            getOptionLabel={(opt) => opt?.label ?? ""}
                            isOptionEqualToValue={(opt, val) => opt.value === val.value}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                variant="standard"
                                placeholder="거래처 선택"
                                InputProps={{ ...params.InputProps, disableUnderline: true }}
                                inputProps={{
                                  ...params.inputProps,
                                  style: {
                                    fontSize: "12px",
                                    padding: 0,
                                    color: isChanged ? "#d32f2f" : "inherit",
                                    fontWeight: isChanged ? 600 : 400,
                                  },
                                }}
                              />
                            )}
                            sx={{
                              minWidth: 180,
                              width: "100%",
                              "& .MuiInputBase-root": { minHeight: 24 },
                              "& .MuiAutocomplete-input": {
                                fontSize: "12px",
                                padding: "0px !important",
                                color: isChanged ? "#d32f2f" : "inherit",
                                fontWeight: isChanged ? 600 : 400,
                              },
                              "& .MuiSvgIcon-root": {
                                fontSize: 18,
                                color: isChanged ? "#d32f2f" : "inherit",
                              },
                              "& .MuiAutocomplete-option": { fontSize: "12px", minHeight: 28 },
                            }}
                            ListboxProps={{ style: { fontSize: "12px" } }}
                          />
                        ) : (
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
                            {/* ✅ 업체 */}
                            {colKey === "cor_type" &&
                              corOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}

                            {/* ✅ 직책(idx) */}
                            {colKey === "position_type" && (
                              <>
                                {positionOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </>
                            )}

                            {/* ✅ 시작/마감은 그대로 */}
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
                        )
                      ) : (
                        currentValue ?? ""
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

                // ✅ 요일은 숫자 합계 표시
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

  if (loading) return <LoadingScreen />;

  return (
    <>
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          flexWrap: isMobile ? "wrap" : "nowrap",
          position: "sticky",
          zIndex: 10,
          top: 78,
          backgroundColor: "#ffffff",
        }}
      >
        {/* <TextField
          select
          size="small"
          value={activeStatus}
          onChange={(e) => {
            setLoading(true);
            setActiveStatus(e.target.value);
          }}
          sx={{ minWidth: 150 }}
          SelectProps={{ native: true }}
        >
          <option value="N">재직자</option>
          <option value="Y">퇴사자</option>
        </TextField> */}

        <TextField
          select
          size="small"
          label="시도"
          value={selectedSidoCode}
          onChange={(e) => setSelectedSidoCode(e.target.value)}
          sx={{
            minWidth: 140,
            "& select": {
              color: isSidoChanged ? "#d32f2f" : "inherit",
              fontWeight: isSidoChanged ? 700 : 400,
            },
            "& label": {
              color: isSidoChanged ? "#d32f2f" : "inherit",
              fontWeight: isSidoChanged ? 700 : 400,
            },
          }}
          SelectProps={{ native: true }}
        >
          {(sidoOptions || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
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
            "& select": {
              color: isSigunguChanged ? "#d32f2f" : "inherit",
              fontWeight: isSigunguChanged ? 700 : 400,
            },
            "& label": {
              color: isSigunguChanged ? "#d32f2f" : "inherit",
              fontWeight: isSigunguChanged ? 700 : 400,
            },
          }}
          SelectProps={{ native: true }}
          disabled={!selectedSidoCode || (sigunguOptions || []).length === 0}
        >
          {(sigunguOptions || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </TextField>

        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={selectedAccountOption}
          onChange={(_, opt) => {
            setLoading(true);
            setSelectedAccountId(opt ? opt.value : "");
          }}
          inputValue={accountInput}
          onInputChange={(_, newValue) => setAccountInput(newValue)}
          getOptionLabel={(opt) => opt?.label ?? ""}
          isOptionEqualToValue={(opt, val) => opt.value === val.value}
          filterOptions={(options, state) => {
            const q = (state.inputValue ?? "").trim().toLowerCase();
            if (!q) return options;
            return options.filter((o) => (o.label ?? "").toLowerCase().includes(q));
          }}
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

        <MDButton variant="gradient" color="success" onClick={handleAddRow}>
          행추가
        </MDButton>

        <MDButton variant="gradient" color="info" onClick={handleSave}>
          저장
        </MDButton>
      </MDBox>

      <MDBox pt={1} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            {renderTable(table, activeRows, originalRows)}
          </Grid>
        </Grid>
      </MDBox>
    </>
  );
}

export default AccountMemberRecordMainTableTab;
