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
  Box,
} from "@mui/material";
import Swal from "sweetalert2";
import api from "api/api";
import Autocomplete from "@mui/material/Autocomplete";
import MenuItem from "@mui/material/MenuItem";

import useAccountMemberRecordMainTableData from "./AccountMemberRecordMainTableData";
import LoadingScreen from "layouts/loading/loadingscreen";

function AccountMemberRecordMainTableTab() {
  // 요일 표시명과 데이터 필드 키 매핑
  const DAY_LABELS = useMemo(() => ["월", "화", "수", "목", "금", "토", "일"], []);
  const DAY_KEYS = useMemo(() => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], []);
  const scheduleKeySet = useMemo(() => new Set(DAY_KEYS), [DAY_KEYS]);

  // 선택값이 없을 때 사용하는 공통 기본 옵션
  const NONE_OPTION = useMemo(() => ({ value: "", label: "지정안됨" }), []);

  // 요일별 인원 입력값을 빈 값으로 초기화하는 기본 스케줄 객체
  const makeEmptySchedule = useCallback(() => {
    const obj = {};
    DAY_KEYS.forEach((k) => {
      obj[k] = "";
    });
    return obj;
  }, [DAY_KEYS]);

  // 기준 인원 테이블의 요일별 입력 컬럼
  const scheduleColumns = useMemo(
    () =>
      DAY_KEYS.map((k, idx) => ({
        header: DAY_LABELS[idx],
        accessorKey: k,
        size: 80,
      })),
    [DAY_KEYS, DAY_LABELS]
  );

  // 거래처 조회 조건과 재직 상태 조건
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const [activeStatus, setActiveStatus] = useState("N");

  // 권역 선택 상태
  const [rootOptions, setRootOptions] = useState([NONE_OPTION]);
  const [selectedRootIdx, setSelectedRootIdx] = useState("");
  const [originalRootIdx, setOriginalRootIdx] = useState("");

  // 부족 항목 클릭 시 표시되는 응급 인력 후보 목록
  const [emergencyRows, setEmergencyRows] = useState([]);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyTitle, setEmergencyTitle] = useState("부족 인력 조회");

  // 응급 인력 채용여부(use_yn) 편집 상태
  const [emergencyUseYnMap, setEmergencyUseYnMap] = useState({});
  const [originalEmergencyUseYnMap, setOriginalEmergencyUseYnMap] = useState({});
  const [savingEmployment, setSavingEmployment] = useState(false);

  // 연락이력(연락일자·연락여부) 상태 관리
  const [emergencyCallMap, setEmergencyCallMap] = useState({});
  const [originalEmergencyCallMap, setOriginalEmergencyCallMap] = useState({});

  // 부족 항목 클릭 시 조회 기준 시작/마감 시간
  const [shortageSelectedShift, setShortageSelectedShift] = useState({
    start_time: "",
    end_time: "",
  });

  const now = new Date();
  // 월별 기준표와 부족 현황 조회 기간
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));

  // 부족 항목 클릭으로 계산된 선택 일자
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState(null);

  // 마지막으로 선택한 부족 항목의 직책 코드
  const [selectedPositionType, setSelectedPositionType] = useState("");
  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const [todayCheckLoading, setTodayCheckLoading] = useState(false);
  const [todayCheckRows, setTodayCheckRows] = useState([]);

  // 기준 인원 테이블 스크롤 컨테이너 참조
  const tableContainerRef = useRef(null);

  // 반응형 화면 처리를 위한 테마와 모바일 여부
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

  // 조회 연도 선택 옵션
  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1].map((v) => String(v));
  }, [now]);

  // 조회 월 선택 옵션
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")),
    []
  );

  // 시작/마감 시간 선택 옵션 생성을 위한 30분 단위 시간 목록 함수
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

  // 기준 근무 시작 시간과 마감 시간 선택 옵션
  const startTimes = generateTimeOptions("5:30", "16:00", 30);
  const endTimes = generateTimeOptions("10:00", "20:00", 30);

  // 고정/대체 구분 선택 옵션
  const corOptions = useMemo(
    () => [
      { value: "1", label: "고정" },
      { value: "2", label: "대체" },
    ],
    []
  );

  // 응급 인력 및 기준표 직책 선택 옵션
  const positionOptions = useMemo(
    () => [
      { value: "4", label: "조리사" },
      { value: "5", label: "조리원" },
    ],
    []
  );

  // 응급 인력 상태 선택 옵션
  const statusOptions = useMemo(
    () => [
      { value: "1", label: "가능" },
      { value: "2", label: "블랙리스트" },
    ],
    []
  );

  // 기준표 행의 요일 필드를 누락 없이 채워주는 보정 함수
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

  // 응급 인력 후보 테이블 표시 라벨 매핑
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

  // 연락여부 선택 옵션 및 색상 매핑
  const callStatusOptions = useMemo(
    () => [
      { value: "0", label: "미수신" },
      { value: "1", label: "콜백대기" },
      { value: "2", label: "기타" },
      { value: "3", label: "연락완료" },
    ],
    []
  );

  const callStatusColorOf = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (s === "0") return "#9e9e9e";
    if (s === "1") return "#FF9760";
    if (s === "2") return "#777";
    if (s === "3") return "#1976d2";
    return "#777";
  }, []);

  const employmentColorOf = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (s === "1") return "#FF9760";
    if (s === "2") return "#d32f2f";
    if (s === "3") return "#1976d2";
    return "#777";
  }, []);

  // 선택값 정규화 유틸
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

  // 연락처 포맷 변환 (000-0000-0000)
  const formatPhone = useCallback((value) => {
    if (value === null || value === undefined) return "";
    const digits = String(value).replace(/\D/g, "").slice(0, 11);
    if (!digits) return "";
    if (digits.length > 7) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    if (digits.length > 3) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return digits;
  }, []);

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

  // 거래처 검색 선택 옵션
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

  // 권역 선택 옵션 조회 함수
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

  // 거래처명 입력값 기반 선택 함수
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

  // 거래처 기준 인원 및 월별 현황 조회 흐름
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

  // 기준 인원 조회 후 권역 코드 자동 매핑
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

  // 응급 인력 채용 확정 중복 확인 함수
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

  // 기준 인원 테이블 컬럼 정의
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

  // 요일 컬럼별 실제 배치 인원 합계 계산 함수
  const getScheduleColumnTotal = useCallback((rows, key) => {
    let total = 0;
    (rows || []).forEach((r) => {
      const raw = r?.[key];
      const n = Number(String(raw ?? "").trim());
      if (!Number.isNaN(n)) total += n;
    });
    return total;
  }, []);

  // 요일별 인원 입력값 숫자 정리 함수
  const onlyDigits = (v) => String(v ?? "").replace(/[^\d]/g, "");

  // 기준 근무 인원 신규 행 추가 함수
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
    setEmergencyCallMap({});
    setOriginalEmergencyCallMap({});
    setEmergencyLoading(false);
    setEmergencyTitle("부족 인력 조회");

    setSelectedDayOfMonth(null);
    setSelectedPositionType("");
    setShortageSelectedShift({ start_time: "", end_time: "" });
  }, [year, month, selectedAccountId, selectedRootIdx]);

  // 기준 인원 및 권역 정보 저장 처리 함수
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

  // 기준 근무표 테이블 렌더링 함수
  const renderTable = (tableArg, rows, originals) => {
    const editableSelectFields = new Set(["cor_type", "position_type", "start_time", "end_time"]);

    const getScheduleBg = (key) => {
      if (!scheduleKeySet.has(key)) return undefined;
      if (key === "sat" || key === "sun") return "#fbe4d5";
      return "#fff";
    };

    return (
      /* 거래처별 기준 근무 인원 설정 테이블 영역 */
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
          {/* 기준 근무 조건 및 요일별 필요 인원 헤더 */}
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

          {/* 기준 근무 조건별 필요 인원 입력 행 목록 */}
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

  // 숫자형 입력값 변환 및 비교 계산 유틸
  const toInt = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s.replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, []);

  // 월별 배치 현황의 주차 번호 변환 함수
  const toWeekNo = useCallback((v) => {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s.replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, []);

  // 근무 제외 표시값 판별 함수
  const isNone = useCallback((v) => {
    const norm = String(v ?? "")
      .replace(/\u00A0/g, " ")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    return norm === "none" || norm === "제외" || norm === "당월x";
  }, []);

  // 부족 계산에서 빈 값과 제외값을 구분하는 정수 변환 함수
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

  // Today 확인 모달에서 사용할 전체 업장 부족 항목 계산 함수
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

  // 현재 선택 거래처의 기준 인원 대비 실제 배치 부족 목록
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

  // 부족 목록을 주차와 요일 기준으로 묶은 화면 표시용 매트릭스
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

  // 당월이 아닌 날짜 표시를 위한 제외 셀 매트릭스
  const excludedMatrixByWeek = useMemo(() => shortageList?.excluded || {}, [shortageList]);

  // 응급 인력 조회에 사용할 최종 권역 코드 계산 함수
  const getEffectiveRootIdx = useCallback(() => {
    const fallbackRoot = activeRows?.[0]?.root_idx != null ? String(activeRows[0].root_idx) : "";
    const root_idx = String(selectedRootIdx ?? "").trim() || String(fallbackRoot ?? "").trim();
    return root_idx;
  }, [activeRows, selectedRootIdx]);

  // 선택 직책의 대표 시작/마감 시간을 기준표에서 찾는 함수
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

  // 권역 코드에 대응하는 화면 표시 라벨 조회 함수
  const rootLabelByValue = useCallback(
    (rootIdx) =>
      rootOptions.find((o) => String(o.value) === String(rootIdx ?? ""))?.label ||
      NONE_OPTION.label,
    [NONE_OPTION.label, rootOptions]
  );

  // 오늘 이후 전체 거래처 부족 항목 확인 모달 실행 함수
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

  // 부족 항목 클릭 시 응급 인력 후보와 연락 이력을 조회하는 함수
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
        setEmergencyCallMap({});
        setOriginalEmergencyCallMap({});

        setEmergencyTitle(
          `${week}주차 ${dayLabel} (${ymd}${dayNum ? `, ${dayNum}일` : ""
          }) / ${posLabel} 부족-${부족} (${rootLabel})${shift?.start_time || shift?.end_time
            ? ` / 시작:${shift?.start_time || "-"} 마감:${shift?.end_time || "-"}`
            : ""
          }`
        );

        // 응급 인력 연락 이력 조회 기준 거래처 코드
        const res = await api.get("/Operate/EmergencyPersonList", {
          params: {
            root_idx,
            position_type,
            account_id: selectedAccountId,
            record_year: Number(year),
            record_month: Number(month),
            record_date: Number(dayNum),
          },
        });

        const list = res?.data?.list ?? res?.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        setEmergencyRows(arr);

        const m = {};
        const cm = {};
        arr.forEach((it) => {
          const id = it?.idx;
          if (id == null) return;
          const sid = String(id);
          m[sid] = String(it?.use_yn ?? "").trim();
          cm[sid] = {
            call_dt: it?.call_dt ? String(it.call_dt).slice(0, 10) : "",
            call_status: it?.call_status != null ? String(it.call_status) : "",
          };
        });

        setEmergencyUseYnMap(m);
        setOriginalEmergencyUseYnMap(m);
        setEmergencyCallMap(cm);
        setOriginalEmergencyCallMap(cm);
      } catch (e) {
        setEmergencyRows([]);
        setEmergencyUseYnMap({});
        setOriginalEmergencyUseYnMap({});
        setEmergencyCallMap({});
        setOriginalEmergencyCallMap({});
        Swal.fire("실패", e?.message || "응급 인력 조회 오류", "error");
      } finally {
        setEmergencyLoading(false);
      }
    },
    [getEffectiveRootIdx, getDateByWeekDay, year, month, formatYMD, rootOptions, getShiftByPosition, selectedAccountId]
  );

  // 응급 인력 후보의 연락 이력과 채용여부 저장 함수
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

      // 저장 직전 채용 확정 중복 방지 조건
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

        const callEntry = emergencyCallMap?.[id] ?? {};
        const call_dt = String(callEntry?.call_dt ?? "").trim();
        const call_status_raw = String(callEntry?.call_status ?? "").trim();
        const call_status = call_status_raw === "" ? null : Number(call_status_raw);

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
          // 연락일자 및 연락여부 저장 이력
          call_dt: call_dt || null,
          call_status,
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
          setOriginalEmergencyCallMap((prev) => ({
            ...(prev || {}),
            [id]: { call_dt, call_status: call_status_raw },
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
      emergencyCallMap,
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
      /* 부족 항목 클릭 결과에 따른 응급 인력 후보 테이블 영역 */
      <MDBox
        mt={0}
        p={1}
        sx={{
          border: "1px solid #0AC4E0",
          borderRadius: 1,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        <MDBox sx={{ fontWeight: 700, mb: 0.5, fontSize: 14, flexShrink: 0 }}>{emergencyTitle}</MDBox>

        {emergencyLoading ? (
          <MDBox sx={{ fontSize: 11, color: "#777" }}>조회 중...</MDBox>
        ) : (emergencyRows || []).length === 0 ? (
          <MDBox sx={{ fontSize: 11, color: "#777" }}>조회된 인원이 없습니다.</MDBox>
        ) : (
          /* 응급 인력 연락 이력 및 채용여부 편집 목록 */
          <Box sx={{ flex: 1, minHeight: 0, borderTop: "1px solid #e0e0e0", overflow: "hidden" }}>
            <MDBox
              sx={{
                height: "100%",
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
                "& th": { background: "#f7fbff", position: "sticky", top: 0, zIndex: 1, borderTop: "none" },
                "& select": {
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 6,
                  border: "1px solid #d0d0d0",
                  outline: "none",
                  cursor: "pointer",
                },
                "& input[type='date']::-webkit-calendar-picker-indicator": {
                  display: "block",
                  opacity: 1,
                  cursor: "pointer",
                },
              }}
            >
              <table>
                {/* 응급 인력 후보 정보와 연락 관리 항목 헤더 */}
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>IDX</th>
                    <th style={{ width: 90 }}>이름</th>
                    <th style={{ width: 60 }}>직책</th>
                    <th style={{ width: 80 }}>급여</th>
                    <th style={{ width: 50 }}>차량</th>
                    <th style={{ width: 80 }}>상태</th>
                    <th style={{ width: 80 }}>구분</th>
                    {/* 응급 인력 연락 이력 입력 항목 */}
                    <th style={{ width: 100 }}>연락처</th>
                    <th style={{ width: 100 }}>연락일자</th>
                    <th style={{ width: 90 }}>연락여부</th>
                    <th style={{ width: 100 }}>비고</th>
                    <th style={{ width: 80 }}>채용여부</th>
                    <th style={{ width: 80 }}>저장</th>
                  </tr>
                </thead>
                {/* 응급 인력 후보별 연락 이력 및 채용 상태 행 목록 */}
                <tbody>
                  {(emergencyRows || []).map((item, idx) => {
                    const rowId = String(item?.idx ?? "");
                    const callDtValue = emergencyCallMap?.[rowId]?.call_dt ?? "";
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
                        <td title={formatPhone(item?.phone)}>{formatPhone(item?.phone)}</td>
                        <td>
                          <input
                            type="date"
                            value={callDtValue}
                            onClick={(e) => e.currentTarget.showPicker?.()}
                            onChange={(e) =>
                              setEmergencyCallMap((prev) => ({
                                ...(prev || {}),
                                [rowId]: { ...(prev?.[rowId] || {}), call_dt: e.target.value },
                              }))
                            }
                            style={{
                              width: "100%",
                              fontSize: 11,
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              color: "#344767",
                              cursor: "pointer",
                            }}
                          />
                        </td>
                        <td>
                          <select
                            value={emergencyCallMap?.[rowId]?.call_status ?? ""}
                            onChange={(e) =>
                              setEmergencyCallMap((prev) => ({
                                ...(prev || {}),
                                [rowId]: { ...(prev?.[rowId] || {}), call_status: e.target.value },
                              }))
                            }
                            style={{
                              color: callStatusColorOf(emergencyCallMap?.[rowId]?.call_status ?? ""),
                              fontWeight: 800,
                              width: "100%",
                              background: "#fff",
                            }}
                          >
                            <option value="">선택</option>
                            {callStatusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
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
          </Box>
        )}
      </MDBox>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 조회 기준 선택 및 저장 버튼 고정 영역 */}
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
                "& input": { paddingLeft: "8px", paddingTop: 0, paddingBottom: 0, lineHeight: 1 },
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

      {/* 거래처 기준표와 부족 인력 현황 본문 영역 */}
      <MDBox pt={0} pb={1}>
        <Grid container spacing={1}>
          {/* 거래처별 요일 기준 인원 입력 테이블 영역 */}
          <Grid item xs={12}>
            {renderTable(table, activeRows, originalRows)}
          </Grid>

          {/* 부족 항목 요약과 응급 인력 후보 조회 영역 */}
          <Grid item xs={12}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "45fr 55fr" }, gap: 1, alignItems: "stretch" }}>
              {/* 주차 및 요일별 부족 인원 현황 카드 영역 */}
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
                            {/* 요일별 부족 직책과 필요 인원 비교 테이블 */}
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
                                        minWidth: 90,
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
                                          verticalAlign: "middle",
                                          padding: "4px",
                                          fontSize: 11,
                                          borderRight:
                                            idx === DAY_KEYS.length - 1 ? "none" : "1px solid #eee",
                                          background: isWeekend ? "#fff7f2" : "#fff",
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

              {/* 선택한 부족 항목에 맞는 응급 인력 후보 영역 */}
              <Box sx={{ position: "relative" }}>
                {renderEmergencyTable()}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </MDBox>

      {/* 오늘 이후 전체 업장 부족 항목 확인 모달 영역 */}
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
              {/* 업장별 예정 부족 항목 목록 테이블 */}
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
