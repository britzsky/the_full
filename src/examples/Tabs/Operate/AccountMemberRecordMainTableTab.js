/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery, IconButton, Tooltip } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import Swal from "sweetalert2";
import api from "api/api";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Autocomplete from "@mui/material/Autocomplete";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

import useAccountMembersheetData, { parseNumber, formatNumber } from "./accountMemberSheetData";
import LoadingScreen from "layouts/loading/loadingscreen";
import { API_BASE_URL } from "config";

function AccountMemberRecordMainTableTab() {
  const UTIL_POSITION = "6";
  const UTIL_ACCOUNT_ID = "2"; // ✅ 유틸이면 account_id는 2로 저장/표시

  // =========================
  // ✅ 근무표(월~일) 4주 생성
  // =========================
  const WEEK_DAYS = useMemo(() => ["월", "화", "수", "목", "금", "토", "일"], []);
  const WEEK_COUNT = 1;

  const makeScheduleKey = useCallback((weekIdx, dayIdx) => `wk${weekIdx + 1}_${dayIdx}`, []);

  const scheduleKeySet = useMemo(() => {
    const s = new Set();
    for (let w = 0; w < WEEK_COUNT; w += 1) {
      for (let d = 0; d < 7; d += 1) s.add(`wk${w + 1}_${d}`);
    }
    return s;
  }, []);

  const makeEmptySchedule = useCallback(() => {
    const obj = {};
    for (let w = 0; w < WEEK_COUNT; w += 1) {
      for (let d = 0; d < 7; d += 1) obj[makeScheduleKey(w, d)] = ""; // 기본: 선택
    }
    return obj;
  }, [makeScheduleKey]);

  const scheduleColumns = useMemo(() => {
    const cols = [];
    for (let w = 0; w < WEEK_COUNT; w += 1) {
      for (let d = 0; d < 7; d += 1) {
        cols.push({
          header: WEEK_DAYS[d],
          accessorKey: makeScheduleKey(w, d),
          size: 30, // ✅ 좁게
        });
      }
    }
    return cols;
  }, [WEEK_DAYS, makeScheduleKey]);

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const [activeStatus, setActiveStatus] = useState("N");
  const tableContainerRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,
    accountList,
    workSystemList,
    originalWorkSystemList,
    fetchWorkSystemList,
    saveWorkSystemList,
    saveData,
    fetchAccountMembersAllList,
    loading: hookLoading,
  } = useAccountMembersheetData(selectedAccountId, activeStatus);

  const [loading, setLoading] = useState(true);

  // =========================
  // ✅ 근무형태 관리 Modal 상태
  // =========================
  const [wsOpen, setWsOpen] = useState(false);
  const [wsRows, setWsRows] = useState([]);
  const [wsOriginal, setWsOriginal] = useState([]);

  const numericCols = ["salary"];

  // =========================
  // ✅ 이미지 업로드/뷰어 기능
  // =========================
  const imageFields = ["employment_contract", "id", "bankbook"];
  const [viewImageSrc, setViewImageSrc] = useState(null);
  const fileIconSx = { color: "#1e88e5" };

  const handleViewImage = (value) => {
    if (!value) return;
    if (typeof value === "object") {
      setViewImageSrc(URL.createObjectURL(value));
    } else {
      setViewImageSrc(`${API_BASE_URL}${value}`);
    }
  };
  const handleCloseViewer = () => setViewImageSrc(null);

  const handleDownload = useCallback((path) => {
    if (!path || typeof path !== "string") return;
    const url = `${API_BASE_URL}${path}`;
    const filename = path.split("/").pop() || "download";

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const normalizeTime = (t) => {
    if (!t) return "";
    return String(t)
      .trim()
      .replace(/^0(\d):/, "$1:");
  };

  // hygiene와 동일하게 OperateImgUpload 사용
  const uploadImage = async (file, field, row) => {
    const formData = new FormData();
    formData.append("file", file);

    formData.append("type", "member");
    const gubun = `${field}_${row.member_id || row.rrn || Date.now()}`;
    formData.append("gubun", gubun);
    formData.append("folder", row.account_id || selectedAccountId || "common");

    const res = await api.post("/Operate/OperateImgUpload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.data.code === 200) {
      return res.data.image_path;
    }
    throw new Error(res.data.message || "이미지 업로드 실패");
  };

  // =========================
  // ✅ 유틸이면 account_id=2 강제 (저장/행추가/직책변경 공통 보정)
  // =========================
  const applyUtilAccountId = useCallback(
    (rows) => {
      const list = Array.isArray(rows) ? rows : [];
      return list.map((r) => {
        const pos = String(r?.position_type ?? "");
        const acc = r?.account_id;

        // 유틸이면 무조건 2
        if (pos === UTIL_POSITION) {
          return { ...r, account_id: UTIL_ACCOUNT_ID };
        }

        // 유틸이 아닌데 account_id가 2로 남아있으면 selectedAccountId로 복구(원하면 이 로직 제거 가능)
        if (String(acc ?? "") === UTIL_ACCOUNT_ID) {
          return { ...r, account_id: selectedAccountId || (accountList?.[0]?.account_id ?? "") };
        }

        return r;
      });
    },
    [UTIL_ACCOUNT_ID, UTIL_POSITION, selectedAccountId, accountList]
  );

  // ✅ (월~일) 스케줄 기본 키가 없으면 채워 넣기
  const hydrateSchedule = useCallback(
    (row) => {
      const base = makeEmptySchedule();
      const out = { ...base, ...(row || {}) };
      // 혹시 null 들어오면 빈 값으로
      scheduleKeySet.forEach((k) => {
        if (out[k] == null) out[k] = "";
      });
      return out;
    },
    [makeEmptySchedule, scheduleKeySet]
  );

  useEffect(() => {
    if (selectedAccountId) return;
    if (!Array.isArray(accountList) || accountList.length === 0) return;
    setSelectedAccountId(String(accountList[0].account_id));
  }, [accountList, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;

    setLoading(true);
    Promise.resolve(fetchAccountMembersAllList()).finally(() => setLoading(false));
  }, [selectedAccountId, activeStatus]);

  // 합계 계산 (현재 화면에서는 사실상 의미 없지만 기존 유지)
  const calculateTotal = (row) => {
    const breakfast = parseNumber(row.breakfast);
    const lunch = parseNumber(row.lunch);
    const dinner = parseNumber(row.dinner);
    const ceremony = parseNumber(row.ceremony);
    const avgMeals = (breakfast + lunch + dinner) / 3;
    return Math.round(avgMeals + ceremony);
  };

  // ★★★★★ activeRows 로딩 후 초기 세팅 (유틸 account_id 보정 + 스케줄 키 주입)
  useEffect(() => {
    if (activeRows && activeRows.length > 0) {
      const updated = activeRows.map((row) => {
        const merged = hydrateSchedule(row);
        return {
          ...merged,
          total: calculateTotal(merged),
        };
      });

      const fixed = applyUtilAccountId(updated);
      setActiveRows(fixed);
      setOriginalRows(fixed);
    } else {
      setOriginalRows([]);
    }
  }, [activeRows?.length]);

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

  const positionOptions = [
    { value: "1", label: "영양사" },
    { value: "2", label: "조리팀장" },
    { value: "3", label: "조리장" },
    { value: "4", label: "조리사" },
    { value: "5", label: "조리원" },
    { value: "6", label: "유틸" },
  ];

  const contractOptions = [
    { value: "1", label: "4대보험" },
    { value: "2", label: "프리랜서" },
  ];

  const delOptions = [
    { value: "N", label: "재직" },
    { value: "Y", label: "퇴사" },
  ];

  const corOptions = [
    { value: "1", label: "(주)더채움" },
    { value: "2", label: "더채움" },
  ];

  const formatDateForInput = (val) => {
    if (!val && val !== 0) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    try {
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  // ✅ 거래처 옵션(Autocomplete)
  const accountOptions = useMemo(
    () =>
      (accountList || []).map((a) => ({
        value: String(a.account_id),
        label: a.account_name,
      })),
    [accountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

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

  const columns = useMemo(
    () => [
      { header: "구분", accessorKey: "cor_type", size: 100 },
      { header: "성명", accessorKey: "name", size: 80 },
      { header: "연락처", accessorKey: "phone", size: 100 },
      { header: "입사일", accessorKey: "join_dt", size: 80 },
      {
        header: "급여(월)",
        accessorKey: "salary",
        size: 80,
        cell: (info) => formatNumber(info.getValue()),
      },
      { header: "근무형태", accessorKey: "idx", size: 180 },
      { header: "시작", accessorKey: "start_time", size: 60 },
      { header: "마감", accessorKey: "end_time", size: 60 },

      { header: "비고", accessorKey: "note", minWidth: 80, maxWidth: 150 },

      // ✅ 근무표(월~일) 4주(28칸)
      ...scheduleColumns,
    ],
    [scheduleColumns]
  );

  const table = useReactTable({
    data: activeRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ✅ 저장 로직: 최종 payload에서도 유틸 account_id=2 강제
  const handleSave = async () => {
    const changedRows = activeRows.filter((row, idx) => {
      const original = originalRows[idx];
      if (!original) return true;

      return Object.keys(row).some((key) => {
        if (imageFields.includes(key)) {
          const v = row[key];
          const o = original[key];
          if (typeof v === "object" && v) return true;
          return String(v ?? "") !== String(o ?? "");
        }

        if (numericCols.includes(key)) {
          return Number(row[key] ?? 0) !== Number(original[key] ?? 0);
        }

        return String(row[key] ?? "") !== String(original[key] ?? "");
      });
    });

    if (changedRows.length === 0) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }

    try {
      const userId = localStorage.getItem("user_id");

      const cleanRow = (row) => {
        const newRow = { ...row };
        Object.keys(newRow).forEach((key) => {
          if (newRow[key] === "" || newRow[key] === undefined) {
            newRow[key] = null;
          }
        });
        return newRow;
      };

      const processed = await Promise.all(
        changedRows.map(async (row) => {
          // ✅ 혹시 스케줄 키 누락된 row가 있으면 채워서 저장
          const hydrated = hydrateSchedule(row);
          const newRow = cleanRow(hydrated);

          for (const field of imageFields) {
            if (newRow[field] && typeof newRow[field] === "object") {
              const uploadedPath = await uploadImage(newRow[field], field, newRow);
              newRow[field] = uploadedPath;
            }
          }

          return {
            ...newRow,
            user_id: userId,
          };
        })
      );

      // ✅ 여기서 한번 더 유틸 account_id=2 강제
      const processedFixed = applyUtilAccountId(processed);

      const res = await api.post("/Operate/AccountMembersSave", {
        data: processedFixed,
      });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");

        // 원본 스냅샷도 보정된 상태로 유지
        const fixedAll = applyUtilAccountId(activeRows.map((r) => hydrateSchedule(r)));
        setOriginalRows(fixedAll);

        await fetchAccountMembersAllList();
      } else {
        Swal.fire("저장 실패", res.data.message || "서버 오류", "error");
      }
    } catch (err) {
      Swal.fire("저장 실패", err.message, "error");
    }
  };

  // =========================
  // ✅ 근무형태 모달 로직
  // =========================
  const openWorkSystemModal = async () => {
    const latest = await fetchWorkSystemList({ snapshot: true });
    setWsRows(latest || []);
    setWsOriginal(latest || []);
    setWsOpen(true);
  };

  const closeWorkSystemModal = () => setWsOpen(false);

  const handleWsAddRow = () => {
    const newRow = {
      idx: null,
      work_system: "",
      start_time: startTimes?.[0] ?? "5:30",
      end_time: endTimes?.[0] ?? "10:00",
    };
    setWsRows((prev) => [newRow, ...prev]);
    setWsOriginal((prev) => [newRow, ...prev]);
  };

  const handleWsChange = (rowIndex, key, value) => {
    setWsRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
  };

  const getWsChangedRows = () => {
    const norm = (v) => String(v ?? "");
    return wsRows.filter((r, i) => {
      const o = wsOriginal[i];
      if (!o) return true;

      return (
        norm(r.work_system) !== norm(o.work_system) ||
        norm(r.start_time) !== norm(o.start_time) ||
        norm(r.end_time) !== norm(o.end_time)
      );
    });
  };

  const handleWsSave = async () => {
    const changed = getWsChangedRows();

    if (changed.length === 0) {
      Swal.fire("저장할 변경사항이 없습니다.", "", "info");
      return;
    }

    try {
      const res = await saveWorkSystemList(changed);
      const ok = res?.status === 200 || res?.data?.code === 200;

      if (!ok) {
        Swal.fire("저장 실패", res?.data?.message || "서버 오류", "error");
        return;
      }

      Swal.fire("저장 완료", "근무형태가 저장되었습니다.", "success");

      const latest = await fetchWorkSystemList({ snapshot: true });
      setWsRows(latest || []);
      setWsOriginal(latest || []);

      setWsOpen(false);
    } catch (err) {
      Swal.fire("저장 실패", err?.message || "오류", "error");
    }
  };

  // =========================
  // ✅ 유틸관리 모달 로직 (기존 그대로 - 네 코드 유지)
  // =========================
  const [utilOpen, setUtilOpen] = useState(false);

  const [utilMemberRows, setUtilMemberRows] = useState([]);
  const [utilSelectedMember, setUtilSelectedMember] = useState(null);

  const [utilMappingRows, setUtilMappingRows] = useState([]);
  const [utilSelectedMappingRowIndex, setUtilSelectedMappingRowIndex] = useState(null);

  const [utilAccountRows, setUtilAccountRows] = useState([]);
  const [utilSelectedAccount, setUtilSelectedAccount] = useState(null);

  const fetchUtilMemberList = useCallback(async () => {
    const res = await api.get("/Account/AccountUtilMemberList");
    const list = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(list) ? list : [];
  }, []);

  const fetchUtilMappingList = useCallback(async (memberId) => {
    if (!memberId) return [];
    const res = await api.get("/Account/AccountUtilMappingList", {
      params: { member_id: memberId },
    });
    const list = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(list) ? list : [];
  }, []);

  const fetchUtilAccountList = useCallback(async () => {
    const res = await api.get("/Account/AccountList", {
      params: { account_type: 0 },
    });
    const list = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(list) ? list : [];
  }, []);

  const openUtilModal = async () => {
    try {
      setUtilSelectedMember(null);
      setUtilSelectedAccount(null);
      setUtilSelectedMappingRowIndex(null);
      setUtilMappingRows([]);

      const [members, accounts] = await Promise.all([
        fetchUtilMemberList(),
        fetchUtilAccountList(),
      ]);
      setUtilMemberRows(members || []);
      setUtilAccountRows(accounts || []);

      setUtilOpen(true);
    } catch (err) {
      Swal.fire("조회 실패", err?.message || "오류", "error");
    }
  };

  const closeUtilModal = () => setUtilOpen(false);

  const handleSelectUtilMember = async (row) => {
    try {
      setUtilSelectedMember(row);
      setUtilSelectedMappingRowIndex(null);

      const memberId = row?.member_id;
      if (!memberId) {
        setUtilMappingRows([]);
        return;
      }

      const mappings = await fetchUtilMappingList(memberId);
      setUtilMappingRows(mappings || []);
    } catch (err) {
      Swal.fire("조회 실패", err?.message || "오류", "error");
    }
  };

  const handleAddMappingFromRight = () => {
    if (!utilSelectedMember?.member_id) {
      Swal.fire("안내", "왼쪽에서 유틸 직원을 먼저 선택해주세요.", "info");
      return;
    }
    if (!utilSelectedAccount?.account_id) {
      Swal.fire("안내", "오른쪽에서 업장을 먼저 선택해주세요.", "info");
      return;
    }

    const member_id = utilSelectedMember.member_id;
    const position_type = utilSelectedMember.position_type;
    const account_id = utilSelectedAccount.account_id;

    const exists = (utilMappingRows || []).some(
      (r) =>
        String(r.member_id) === String(member_id) && String(r.account_id) === String(account_id)
    );
    if (exists) {
      Swal.fire("안내", "이미 매핑된 업장입니다.", "info");
      return;
    }

    const newRow = {
      idx: null,
      account_id,
      member_id,
      name: utilSelectedMember.name ?? utilSelectedMember.member_name ?? "",
      position_type,
    };

    setUtilMappingRows((prev) => [newRow, ...(prev || [])]);
  };

  const handleUtilSave = async () => {
    if (!utilSelectedMember?.member_id) {
      Swal.fire("안내", "왼쪽에서 유틸 직원을 먼저 선택해주세요.", "info");
      return;
    }

    try {
      const res = await api.post("/Account/AccountUtilMemberMappingSave", utilMappingRows);
      const ok = res?.status === 200 || res?.data?.code === 200;

      if (!ok) {
        Swal.fire("저장 실패", res?.data?.message || "서버 오류", "error");
        return;
      }

      Swal.fire("저장 완료", "유틸 매핑이 저장되었습니다.", "success");

      const latest = await fetchUtilMappingList(utilSelectedMember.member_id);
      setUtilMappingRows(latest || []);
      setUtilOpen(false);
    } catch (err) {
      Swal.fire("저장 실패", err?.message || "오류", "error");
    }
  };

  // ✅ 행추가: 기본 직책 1. (유틸로 추가하고 싶으면 defaultPositionType을 6으로 바꾸면 됨)
  //    그리고 유틸(6)인 경우 account_id는 무조건 2가 들어가도록 처리
  const handleAddRow = () => {
    const defaultAccountId = selectedAccountId || (accountList?.[0]?.account_id ?? "");
    const defaultWorkSystemIdx = workSystemList?.[0]?.idx ? String(workSystemList[0].idx) : "";

    const defaultPositionType = "1"; // 신규 기본 직책
    const initAccountId =
      defaultPositionType === UTIL_POSITION ? UTIL_ACCOUNT_ID : defaultAccountId;

    const newRow = {
      name: "",
      rrn: "",
      account_id: initAccountId,

      position_type: defaultPositionType,
      account_number: "",
      phone: "",
      address: "",
      contract_type: "1",
      join_dt: "",
      act_join_dt: "",
      ret_set_dt: "",
      loss_major_insurances: "",
      del_yn: activeStatus,
      del_dt: "",
      del_note: "",
      salary: "",
      idx: defaultWorkSystemIdx,
      start_time: workSystemList?.[0]?.start_time
        ? normalizeTime(workSystemList[0].start_time)
        : startTimes?.[0] ?? "5:30",
      end_time: workSystemList?.[0]?.end_time
        ? normalizeTime(workSystemList[0].end_time)
        : endTimes?.[0] ?? "10:00",
      national_pension: "",
      health_insurance: "",
      industrial_insurance: "",
      employment_insurance: "",
      note: "",

      // ✅ 근무표 기본값(28칸)
      ...makeEmptySchedule(),

      headoffice_note: "",
      subsidy: "",
      total: 0,

      employment_contract: "",
      id: "",
      bankbook: "",
      cor_type: "1",
    };

    setActiveRows((prev) => [newRow, ...(prev || [])]);
    setOriginalRows((prev) => [newRow, ...(prev || [])]);
  };

  // ✅ 근무표 합계(출근+파출) 계산
  const getScheduleTotal = useCallback(
    (rows) => {
      let total = 0;

      (rows || []).forEach((r) => {
        scheduleKeySet.forEach((k) => {
          const v = String(r?.[k] ?? "");
          if (v === "1" || v === "2") total += 1; // 출근/파출이면 +1
        });
      });

      return total;
    },
    [scheduleKeySet]
  );

  const renderTable = (tableArg, rows, originals) => {
    const dateFields = new Set([
      "join_dt",
      "act_join_dt",
      "ret_set_dt",
      "loss_major_insurances",
      "del_dt",
      "national_pension",
      "health_insurance",
      "industrial_insurance",
      "employment_insurance",
    ]);

    const selectFields = new Set([
      "position_type",
      "del_yn",
      "contract_type",
      "start_time",
      "end_time",
      "account_id",
      "idx",
      "cor_type",
      // ✅ 스케줄(월~일) 칸도 select
      ...Array.from(scheduleKeySet),
    ]);

    const nonEditableCols = new Set(["diner_date", "total"]);
    const scheduleTotal = getScheduleTotal(rows);

    // ✅ 주말 배경
    const getScheduleBg = (key) => {
      if (!scheduleKeySet.has(key)) return undefined;
      const m = String(key).match(/^wk\d+_(\d)$/);
      const dayIdx = m ? Number(m[1]) : -1;
      if (dayIdx === 5 || dayIdx === 6) return "#fbe4d5"; // 토/일 배경
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
          "& td:nth-of-type(1), & th:nth-of-type(1)": {
            position: "sticky",
            left: 0,
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(2), & th:nth-of-type(2)": {
            position: "sticky",
            left: "100px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(3), & th:nth-of-type(3)": {
            position: "sticky",
            left: "180px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(4), & th:nth-of-type(4)": {
            position: "sticky",
            left: "280px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(5), & th:nth-of-type(5)": {
            position: "sticky",
            left: "392px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(6), & th:nth-of-type(6)": {
            position: "sticky",
            left: "472px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(7), & th:nth-of-type(7)": {
            position: "sticky",
            left: "652px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(8), & th:nth-of-type(8)": {
            position: "sticky",
            left: "732px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(9), & th:nth-of-type(9)": {
            position: "sticky",
            left: "812px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "thead th:nth-of-type(-n+9)": { zIndex: 5 },
          "& .edited-cell": { color: "#d32f2f", fontWeight: 500 },
          "td[contenteditable]": { minWidth: "80px", cursor: "text" },
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
          "& input[type='date']": {
            fontSize: "12px",
            padding: "4px",
            minWidth: "80px",
            border: "none",
            background: "transparent",
          },
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

                  const isNumeric = numericCols.includes(colKey);
                  const isImage = imageFields.includes(colKey);

                  const normCurrent = isImage
                    ? typeof currentValue === "object" && currentValue
                      ? "__FILE__"
                      : String(currentValue ?? "")
                    : isNumeric
                    ? Number(currentValue ?? 0)
                    : String(currentValue ?? "");

                  const normOriginal = isImage
                    ? String(originalValue ?? "")
                    : isNumeric
                    ? Number(originalValue ?? 0)
                    : String(originalValue ?? "");

                  const isChanged = normCurrent !== normOriginal;

                  const isEditable = !nonEditableCols.has(colKey);
                  const isSelect = selectFields.has(colKey);
                  const isDate = dateFields.has(colKey);

                  const handleCellChange = (newValue) => {
                    const updatedRows = rows.map((r, idx) => {
                      if (idx !== rowIndex) return r;

                      // ✅ 직책 변경 시 유틸(6)면 account_id=2 강제
                      if (colKey === "position_type") {
                        const nextPos = String(newValue);
                        const nextAccount =
                          nextPos === UTIL_POSITION
                            ? UTIL_ACCOUNT_ID
                            : String(r.account_id ?? "") === UTIL_ACCOUNT_ID
                            ? selectedAccountId || (accountList?.[0]?.account_id ?? "")
                            : r.account_id;

                        const merged = hydrateSchedule(r);

                        return {
                          ...merged,
                          position_type: newValue,
                          account_id: nextAccount,
                          total: calculateTotal({ ...merged, position_type: newValue }),
                        };
                      }

                      // ✅ work_system 변경 시 start/end 자동 세팅
                      if (colKey === "idx") {
                        const selected = (workSystemList || []).find(
                          (w) => String(w.idx) === String(newValue)
                        );

                        const merged = hydrateSchedule(r);

                        const nextStart = selected?.start_time
                          ? normalizeTime(selected.start_time)
                          : merged.start_time;
                        const nextEnd = selected?.end_time
                          ? normalizeTime(selected.end_time)
                          : merged.end_time;

                        return {
                          ...merged,
                          idx: newValue,
                          start_time: nextStart,
                          end_time: nextEnd,
                          total: calculateTotal({
                            ...merged,
                            idx: newValue,
                            start_time: nextStart,
                            end_time: nextEnd,
                          }),
                        };
                      }

                      const merged = hydrateSchedule(r);
                      return {
                        ...merged,
                        [colKey]: newValue,
                        total: calculateTotal({ ...merged, [colKey]: newValue }),
                      };
                    });

                    // ✅ 혹시 모를 케이스 대비: 한번 더 유틸 account_id 보정
                    setActiveRows(applyUtilAccountId(updatedRows));
                  };

                  // ✅ 이미지 컬럼
                  if (isImage) {
                    const value = currentValue ?? "";
                    const hasImage = !!value;
                    const inputId = `upload-${colKey}-${rowIndex}`;

                    return (
                      <td
                        key={cell.id}
                        className={isChanged ? "edited-cell" : ""}
                        style={{ textAlign: "center" }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          id={inputId}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            handleCellChange(file);
                          }}
                        />

                        {hasImage ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              flexWrap: "nowrap",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {typeof value === "string" && (
                              <Tooltip title="다운로드">
                                <IconButton
                                  size="small"
                                  sx={{ ...fileIconSx, p: 0.5 }}
                                  onClick={() => handleDownload(value)}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            <Tooltip title="미리보기">
                              <IconButton
                                size="small"
                                sx={{ ...fileIconSx, p: 0.5 }}
                                onClick={() => handleViewImage(value)}
                              >
                                <ImageSearchIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <label htmlFor={inputId}>
                              <MDButton
                                size="small"
                                component="span"
                                color="info"
                                sx={{
                                  fontSize: isMobile ? "10px" : "11px",
                                  minWidth: 44,
                                  px: 1,
                                  py: 0.5,
                                  lineHeight: 1.2,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                변경
                              </MDButton>
                            </label>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              flexWrap: "nowrap",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <label htmlFor={inputId} style={{ display: "inline-flex" }}>
                              <MDButton
                                size="small"
                                component="span"
                                color="info"
                                sx={{
                                  fontSize: isMobile ? "10px" : "11px",
                                  minWidth: 44,
                                  px: 1,
                                  py: 0.5,
                                  lineHeight: 1.2,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                업로드
                              </MDButton>
                            </label>
                          </div>
                        )}
                      </td>
                    );
                  }

                  // ✅ 셀 배경 (토/일)
                  const cellBg = getScheduleBg(colKey);

                  return (
                    <td
                      key={cell.id}
                      style={{
                        background: cellBg,
                        textAlign: [
                          "rrn",
                          "account_number",
                          "phone",
                          "contract_type",
                          "join_dt",
                          "act_join_dt",
                          "ret_set_dt",
                          "loss_major_insurances",
                          "del_yn",
                          "del_dt",
                          "idx",
                          "start_time",
                          "end_time",
                          "national_pension",
                          "health_insurance",
                          "industrial_insurance",
                          "employment_insurance",
                        ].includes(colKey)
                          ? "center"
                          : colKey === "salary"
                          ? "right"
                          : scheduleKeySet.has(colKey)
                          ? "center"
                          : "left",
                      }}
                      contentEditable={isEditable && !isSelect && !isDate}
                      suppressContentEditableWarning
                      className={isEditable && isChanged ? "edited-cell" : ""}
                      onBlur={
                        isEditable && !isSelect && !isDate
                          ? (e) => {
                              let newValue = e.target.innerText.trim();
                              if (isNumeric) newValue = parseNumber(newValue);
                              handleCellChange(newValue);

                              if (isNumeric) {
                                e.currentTarget.innerText = formatNumber(newValue);
                              }
                            }
                          : undefined
                      }
                    >
                      {isSelect ? (
                        colKey === "idx" ? (
                          <Autocomplete
                            size="small"
                            options={(workSystemList || []).map((w) => ({
                              value: String(w.idx),
                              label: w.work_system,
                            }))}
                            value={(() => {
                              const v = String(currentValue ?? "");
                              return (
                                (workSystemList || [])
                                  .map((w) => ({ value: String(w.idx), label: w.work_system }))
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
                                placeholder="검색"
                                InputProps={{
                                  ...params.InputProps,
                                  disableUnderline: true,
                                }}
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
                        ) : colKey === "account_id" ? (
                          (() => {
                            const isAccountChanged =
                              String(currentValue ?? "") !== String(originalValue ?? "");

                            return (
                              <Autocomplete
                                size="small"
                                options={accountOptions}
                                value={(() => {
                                  const v = String(currentValue ?? "");
                                  return accountOptions.find((o) => o.value === v) || null;
                                })()}
                                onChange={(_, opt) => handleCellChange(opt ? opt.value : "")}
                                getOptionLabel={(opt) => opt?.label ?? ""}
                                isOptionEqualToValue={(opt, val) => opt.value === val.value}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    variant="standard"
                                    placeholder="검색"
                                    InputProps={{
                                      ...params.InputProps,
                                      disableUnderline: true,
                                    }}
                                    inputProps={{
                                      ...params.inputProps,
                                      style: {
                                        fontSize: "12px",
                                        padding: 0,
                                        color: isAccountChanged ? "#d32f2f" : "inherit",
                                        fontWeight: isAccountChanged ? 600 : 400,
                                      },
                                    }}
                                  />
                                )}
                                sx={{
                                  minWidth: 180,
                                  "& .MuiInputBase-root": { minHeight: 24 },
                                  "& .MuiAutocomplete-input": {
                                    fontSize: "12px",
                                    padding: "0px !important",
                                    color: isAccountChanged ? "#d32f2f" : "inherit",
                                    fontWeight: isAccountChanged ? 600 : 400,
                                  },
                                  "& .MuiSvgIcon-root": {
                                    fontSize: 18,
                                    color: isAccountChanged ? "#d32f2f" : "inherit",
                                  },
                                  "& .MuiAutocomplete-option": {
                                    fontSize: "12px",
                                    minHeight: 28,
                                  },
                                }}
                                ListboxProps={{ style: { fontSize: "12px" } }}
                              />
                            );
                          })()
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
                              textAlign: scheduleKeySet.has(colKey) ? "center" : "left",
                            }}
                          >
                            {colKey === "cor_type" &&
                              corOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}

                            {colKey === "del_yn" &&
                              delOptions.map((opt) => (
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

                            {colKey === "contract_type" &&
                              contractOptions.map((opt) => (
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

                            {/* ✅ 월~일 근무표 칸: 선택/출근/파출 */}
                            {scheduleKeySet.has(colKey) && (
                              <>
                                <option value="">선택</option>
                                <option value="1">출근</option>
                                <option value="2">파출</option>
                              </>
                            )}
                          </select>
                        )
                      ) : isDate ? (
                        <input
                          type="date"
                          value={formatDateForInput(currentValue)}
                          onChange={(e) => handleCellChange(e.target.value)}
                          className={isChanged ? "edited-cell" : ""}
                        />
                      ) : (
                        (isNumeric ? formatNumber(currentValue) : currentValue) ?? ""
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

                // 라벨은 비고(note) 컬럼 위치에 표시
                if (key === "note") {
                  return (
                    <td
                      key={`foot-total-${col.id}`}
                      style={{ fontWeight: 700, background: "#f0f0f0" }}
                    >
                      합계
                    </td>
                  );
                }

                // 근무표 28칸 영역에만 합계 표시
                if (scheduleKeySet.has(key)) {
                  return (
                    <td
                      key={`foot-total-${col.id}`}
                      style={{ fontWeight: 700, background: "#fff" }}
                    >
                      {scheduleTotal}
                    </td>
                  );
                }

                // 나머지는 빈칸
                return <td key={`foot-total-${col.id}`} style={{ background: "#f0f0f0" }} />;
              })}
            </tr>
          </tfoot>
        </table>
      </MDBox>
    );
  };

  // 유틸관리 모달에서 업장명 표시용 맵
  const utilAccountNameMap = useMemo(() => {
    const m = new Map();
    (utilAccountRows || []).forEach((a) => {
      m.set(String(a.account_id), a.account_name);
    });
    return m;
  }, [utilAccountRows]);

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
        <TextField
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

        {/* <MDButton variant="gradient" color="warning" onClick={openWorkSystemModal}>
          근무형태 관리
        </MDButton>

        <MDButton variant="gradient" color="warning" onClick={openUtilModal}>
          유틸관리
        </MDButton>

        <MDButton variant="gradient" color="success" onClick={handleAddRow}>
          행추가
        </MDButton> */}

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

      {/* =========================
          ✅ 근무형태 모달(기존 그대로)
         ========================= */}
      <Modal open={wsOpen} onClose={closeWorkSystemModal}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? "95vw" : 720,
            maxHeight: "85vh",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MDBox
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              bgcolor: "#fff",
              px: 2,
              py: 1,
              borderBottom: "1px solid #e0e0e0",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <MDTypography variant="h6">근무형태 관리</MDTypography>

            <MDBox display="flex" gap={1}>
              <MDButton variant="gradient" color="success" onClick={handleWsAddRow}>
                행추가
              </MDButton>
              <MDButton variant="gradient" color="info" onClick={handleWsSave}>
                저장
              </MDButton>
              <MDButton variant="outlined" color="secondary" onClick={closeWorkSystemModal}>
                닫기
              </MDButton>
            </MDBox>
          </MDBox>

          <MDBox
            sx={{
              flex: 1,
              overflow: "auto",
              WebkitOverflowScrolling: "touch",
              bgcolor: "#fff",
            }}
          >
            <MDBox
              sx={{
                p: 2,
                "& table": {
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                },
                "& th, & td": {
                  border: "1px solid #686D76",
                  padding: "6px",
                  fontSize: "12px",
                  textAlign: "center",
                  backgroundColor: "#fff",
                },
                "& thead th": {
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  backgroundColor: "#f0f0f0",
                  boxShadow: "0 1px 0 rgba(0,0,0,0.12)",
                  backgroundClip: "padding-box",
                },
                "& input, & select": {
                  width: "100%",
                  fontSize: "12px",
                  padding: "6px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                },
                "& .edited-cell": { color: "#d32f2f", fontWeight: 600 },
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>idx</th>
                    <th>근무형태명</th>
                    <th style={{ width: 140 }}>시작</th>
                    <th style={{ width: 140 }}>마감</th>
                  </tr>
                </thead>

                <tbody>
                  {(wsRows || []).map((r, i) => {
                    const o = wsOriginal?.[i] || {};
                    const isNewRow = r.idx == null || !wsOriginal?.[i];

                    const changedWorkSystem =
                      String(r.work_system ?? "") !== String(o.work_system ?? "");
                    const changedStartTime =
                      String(r.start_time ?? "") !== String(o.start_time ?? "");
                    const changedEndTime = String(r.end_time ?? "") !== String(o.end_time ?? "");

                    return (
                      <tr key={`${r.idx ?? "new"}-${i}`} className={isNewRow ? "edited-cell" : ""}>
                        <td className={isNewRow ? "edited-cell" : ""}>{r.idx ?? ""}</td>

                        <td className={isNewRow || changedWorkSystem ? "edited-cell" : ""}>
                          <input
                            style={{ fontSize: "10px" }}
                            value={r.work_system ?? ""}
                            onChange={(e) => handleWsChange(i, "work_system", e.target.value)}
                            placeholder="예) 주5일(09~18)"
                            className={isNewRow || changedWorkSystem ? "edited-cell" : ""}
                          />
                        </td>

                        <td className={isNewRow || changedStartTime ? "edited-cell" : ""}>
                          <select
                            value={r.start_time ?? ""}
                            onChange={(e) => handleWsChange(i, "start_time", e.target.value)}
                            className={isNewRow || changedStartTime ? "edited-cell" : ""}
                          >
                            <option value="">없음</option>
                            {startTimes.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className={isNewRow || changedEndTime ? "edited-cell" : ""}>
                          <select
                            value={r.end_time ?? ""}
                            onChange={(e) => handleWsChange(i, "end_time", e.target.value)}
                            className={isNewRow || changedEndTime ? "edited-cell" : ""}
                          >
                            <option value="">없음</option>
                            {endTimes.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </MDBox>
          </MDBox>
        </Box>
      </Modal>

      {/* =========================
          ✅ 유틸관리 모달 (네 코드 그대로)
         ========================= */}
      <Modal open={utilOpen} onClose={closeUtilModal}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: isMobile ? "98vw" : "92vw",
            maxWidth: 1200,
            height: isMobile ? "90vh" : "80vh",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MDBox
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              bgcolor: "#fff",
              px: 2,
              py: 1,
              borderBottom: "1px solid #e0e0e0",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <MDTypography variant="h6">유틸관리</MDTypography>

            <MDBox display="flex" gap={1}>
              <MDButton variant="gradient" color="info" onClick={handleUtilSave}>
                저장
              </MDButton>
              <MDButton variant="outlined" color="secondary" onClick={closeUtilModal}>
                닫기
              </MDButton>
            </MDBox>
          </MDBox>

          <MDBox
            sx={{
              flex: 1,
              display: "flex",
              gap: 1,
              p: 1.5,
              overflow: "hidden",
              bgcolor: "#fff",
            }}
          >
            {/* 왼쪽 테이블 */}
            <MDBox
              sx={{
                flex: 1,
                minWidth: 240,
                border: "1px solid #e0e0e0",
                borderRadius: 1.5,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <MDBox sx={{ px: 1.5, py: 1, borderBottom: "1px solid #eee" }}>
                <MDTypography variant="button" fontWeight="bold">
                  유틸 직원 목록
                </MDTypography>
                <MDTypography variant="caption" sx={{ display: "block", color: "#666" }}>
                  행 클릭 → 가운데 매핑 조회
                </MDTypography>
              </MDBox>

              <MDBox
                sx={{
                  flex: 1,
                  overflow: "auto",
                  WebkitOverflowScrolling: "touch",
                  "& table": { width: "100%", borderCollapse: "collapse" },
                  "& th, & td": {
                    borderBottom: "1px solid #eee",
                    padding: "8px 6px",
                    fontSize: 12,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  },
                  "& th": {
                    position: "sticky",
                    top: 0,
                    bgcolor: "#f7f7f7",
                    zIndex: 2,
                  },
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>성명</th>
                      <th style={{ width: 90 }}>직책</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(utilMemberRows || []).map((r, i) => {
                      const selected =
                        String(utilSelectedMember?.member_id ?? "") === String(r.member_id ?? "");
                      const posLabel =
                        positionOptions.find((p) => String(p.value) === String(r.position_type))
                          ?.label ?? String(r.position_type ?? "");

                      return (
                        <tr
                          key={`${r.member_id ?? "m"}-${i}`}
                          onClick={() => handleSelectUtilMember(r)}
                          style={{
                            cursor: "pointer",
                            backgroundColor: selected ? "rgba(30,136,229,0.10)" : "#fff",
                          }}
                        >
                          <td style={{ fontWeight: selected ? 700 : 400 }}>{r.name ?? ""}</td>
                          <td style={{ fontWeight: selected ? 700 : 400 }}>{posLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </MDBox>
            </MDBox>

            {/* 가운데 테이블 */}
            <MDBox
              sx={{
                flex: 1.2,
                minWidth: 360,
                border: "1px solid #e0e0e0",
                borderRadius: 1.5,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <MDBox sx={{ px: 1.5, py: 1, borderBottom: "1px solid #eee" }}>
                <MDTypography variant="button" fontWeight="bold">
                  매핑 목록 (가운데)
                </MDTypography>
                <MDTypography variant="caption" sx={{ display: "block", color: "#666" }}>
                  선택된 유틸:{" "}
                  <b>{utilSelectedMember?.member_id ? utilSelectedMember.member_id : "-"}</b>
                </MDTypography>
              </MDBox>

              <MDBox
                sx={{
                  flex: 1,
                  overflow: "auto",
                  WebkitOverflowScrolling: "touch",
                  "& table": { width: "100%", borderCollapse: "collapse" },
                  "& th, & td": {
                    borderBottom: "1px solid #eee",
                    padding: "8px 6px",
                    fontSize: 12,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  },
                  "& th": {
                    position: "sticky",
                    top: 0,
                    bgcolor: "#f7f7f7",
                    zIndex: 2,
                  },
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>순번</th>
                      <th style={{ width: 120 }}>고객사</th>
                      <th style={{ width: 110 }}>성명</th>
                      <th style={{ width: 90 }}>직책</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(utilMappingRows || []).map((r, i) => {
                      const selected = utilSelectedMappingRowIndex === i;
                      const posLabel =
                        positionOptions.find((p) => String(p.value) === String(r.position_type))
                          ?.label ?? String(r.position_type ?? "");
                      const accName = utilAccountNameMap.get(String(r.account_id ?? "")) ?? "";
                      const accText = accName
                        ? `${r.account_id ?? ""} (${accName})`
                        : String(r.account_id ?? "");

                      return (
                        <tr
                          key={`${r.idx ?? "new"}-${r.account_id ?? "a"}-${i}`}
                          onClick={() => setUtilSelectedMappingRowIndex(i)}
                          style={{
                            cursor: "pointer",
                            backgroundColor: selected ? "rgba(255,193,7,0.12)" : "#fff",
                          }}
                        >
                          <td>{r.idx ?? ""}</td>
                          <td style={{ textAlign: "left" }}>{accText}</td>
                          <td>{r.name ?? ""}</td>
                          <td>{posLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </MDBox>
            </MDBox>

            {/* 가운데-오른쪽 컨트롤 */}
            <MDBox
              sx={{
                width: isMobile ? 54 : 70,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <MDButton
                variant="gradient"
                color="info"
                onClick={handleAddMappingFromRight}
                sx={{ minWidth: isMobile ? 46 : 56, px: 0 }}
              >
                {"<"}
              </MDButton>
              <MDTypography variant="caption" sx={{ color: "#666", textAlign: "center" }}>
                업장 → 매핑
              </MDTypography>
            </MDBox>

            {/* 오른쪽 테이블 */}
            <MDBox
              sx={{
                flex: 1,
                minWidth: 300,
                border: "1px solid #e0e0e0",
                borderRadius: 1.5,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <MDBox sx={{ px: 1.5, py: 1, borderBottom: "1px solid #eee" }}>
                <MDTypography variant="button" fontWeight="bold">
                  업장 목록
                </MDTypography>
                <MDTypography variant="caption" sx={{ display: "block", color: "#666" }}>
                  행 선택 후 &lt; 버튼
                </MDTypography>
              </MDBox>

              <MDBox
                sx={{
                  flex: 1,
                  overflow: "auto",
                  WebkitOverflowScrolling: "touch",
                  "& table": { width: "100%", borderCollapse: "collapse" },
                  "& th, & td": {
                    borderBottom: "1px solid #eee",
                    padding: "8px 6px",
                    fontSize: 12,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  },
                  "& th": {
                    position: "sticky",
                    top: 0,
                    bgcolor: "#f7f7f7",
                    zIndex: 2,
                  },
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>고객사</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(utilAccountRows || []).map((r, i) => {
                      const selected =
                        String(utilSelectedAccount?.account_id ?? "") ===
                        String(r.account_id ?? "");
                      return (
                        <tr
                          key={`${r.account_id ?? "a"}-${i}`}
                          onClick={() => setUtilSelectedAccount(r)}
                          style={{
                            cursor: "pointer",
                            backgroundColor: selected ? "rgba(30,136,229,0.10)" : "#fff",
                          }}
                        >
                          <td style={{ textAlign: "left", fontWeight: selected ? 700 : 400 }}>
                            {r.account_name ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </MDBox>
            </MDBox>
          </MDBox>
        </Box>
      </Modal>

      {/* =========================
          ✅ 이미지 뷰어
         ========================= */}
      {viewImageSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "50vw",
            height: "90vh",
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={handleCloseViewer}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: isMobile ? "95%" : "80%",
              maxHeight: isMobile ? "90%" : "80%",
            }}
          >
            <TransformWrapper initialScale={1} minScale={0.5} maxScale={5} centerOnInit>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      zIndex: 1000,
                    }}
                  >
                    <button
                      onClick={zoomIn}
                      style={{ border: "none", padding: 6, cursor: "pointer" }}
                    >
                      +
                    </button>
                    <button
                      onClick={zoomOut}
                      style={{ border: "none", padding: 6, cursor: "pointer" }}
                    >
                      -
                    </button>
                    <button
                      onClick={resetTransform}
                      style={{ border: "none", padding: 6, cursor: "pointer" }}
                    >
                      ⟳
                    </button>
                    <button
                      onClick={handleCloseViewer}
                      style={{ border: "none", padding: 6, cursor: "pointer" }}
                    >
                      X
                    </button>
                  </div>

                  <TransformComponent>
                    <img
                      src={encodeURI(viewImageSrc)}
                      alt="미리보기"
                      style={{ maxWidth: "70%", maxHeight: "100%", borderRadius: 8 }}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}
    </>
  );
}

export default AccountMemberRecordMainTableTab;
