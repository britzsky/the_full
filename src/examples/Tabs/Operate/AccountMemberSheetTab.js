/* eslint-disable react/function-component-definition */
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
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

function AccountMemberSheet() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const [activeStatus, setActiveStatus] = useState("N");
  const tableContainerRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [excelDownloading, setExcelDownloading] = useState(false);

  const {
    activeRows,
    setActiveRows,
    originalRows,
    setOriginalRows,
    accountList,
    workSystemList, // ✅ 추가
    originalWorkSystemList, // ✅ 추가
    fetchWorkSystemList, // ✅ 추가
    saveWorkSystemList, // ✅ 추가
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
  // ✅ 이미지 업로드/뷰어 기능 (추가)
  // =========================
  const imageFields = ["employment_contract", "id", "bankbook"];
  const [viewFile, setViewFile] = useState({ src: null, isPdf: false });
  const [pdfScale, setPdfScale] = useState(1);
  const [viewerPos, setViewerPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const fileIconSx = { color: "#1e88e5" };

  const getExt = (p = "") => {
    const clean = String(p).split("?")[0].split("#")[0];
    return clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  };

  const toAbsoluteUrl = (p) => {
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    const base = String(API_BASE_URL || "").replace(/\/$/, "");
    let path = String(p);
    if (!path.startsWith("/")) path = `/${path}`;
    if (base.endsWith("/api") && path.startsWith("/api/")) {
      path = path.replace(/^\/api/, "");
    }
    return `${base}${path}`;
  };
  const isPdfFile = (p) => getExt(p) === "pdf";

  const handleViewImage = async (value) => {
    if (!value) return;
    setPdfScale(1);

    // 파일 객체는 바로 미리보기
    if (typeof value === "object") {
      const url = URL.createObjectURL(value);
      const isPdf = String(value.type || "").toLowerCase().includes("pdf");
      setViewFile({ src: url, isPdf });
      return;
    }

    // 서버 경로는 blob으로 받아서 다운로드 대신 미리보기
    try {
      const absUrl = toAbsoluteUrl(value);
      const res = await api.get(absUrl, { responseType: "blob" });
      const contentType = String(res?.headers?.["content-type"] || "").toLowerCase();
      const isPdf = contentType.includes("pdf") || isPdfFile(value);
      const blobUrl = URL.createObjectURL(res.data);
      setViewFile({ src: blobUrl, isPdf });
    } catch (err) {
      console.error("미리보기 로드 실패:", err);
      const fallbackUrl = toAbsoluteUrl(value);
      if (fallbackUrl) {
        const isPdf = isPdfFile(value);
        setViewFile({ src: fallbackUrl, isPdf });
        return;
      }
      Swal.fire("미리보기 실패", "파일을 불러오지 못했습니다.", "error");
    }
  };
  const handleCloseViewer = () => {
    if (viewFile?.src?.startsWith("blob:")) {
      URL.revokeObjectURL(viewFile.src);
    }
    setViewFile({ src: null, isPdf: false });
    setPdfScale(1);
  };

  useEffect(() => {
    if (!viewFile?.src) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const modalW = isMobile ? w * 0.92 : w * 0.48;
    const modalH = isMobile ? h * 0.92 : h * 0.88;
    setViewerPos({
      x: Math.max(0, (w - modalW) / 2),
      y: Math.max(0, (h - modalH) / 2),
    });
  }, [viewFile?.src, isMobile]);

  const handleDragStart = (e) => {
    e.preventDefault();
    setDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - viewerPos.x,
      y: e.clientY - viewerPos.y,
    };
  };

  const handleDragMove = useCallback(
    (e) => {
      if (!dragging) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const modalW = isMobile ? w * 0.92 : w * 0.48;
      const modalH = isMobile ? h * 0.92 : h * 0.88;
      const nextX = e.clientX - dragOffsetRef.current.x;
      const nextY = e.clientY - dragOffsetRef.current.y;
      setViewerPos({
        x: Math.min(Math.max(0, nextX), Math.max(0, w - modalW)),
        y: Math.min(Math.max(0, nextY), Math.max(0, h - modalH)),
      });
    },
    [dragging, isMobile]
  );

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [dragging, handleDragMove, handleDragEnd]);

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

  // 합계 계산
  const calculateTotal = (row) => {
    const breakfast = parseNumber(row.breakfast);
    const lunch = parseNumber(row.lunch);
    const dinner = parseNumber(row.dinner);
    const ceremony = parseNumber(row.ceremony);
    const avgMeals = (breakfast + lunch + dinner) / 3;
    return Math.round(avgMeals + ceremony);
  };

  // ★★★★★ activeRows 변경 시 loading false 제거
  useEffect(() => {
    if (activeRows && activeRows.length > 0) {
      const updated = activeRows.map((row) => ({
        ...row,
        total: calculateTotal(row),
      }));
      setActiveRows(updated);
      setOriginalRows(updated);
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

  const workSystemLabelMap = useMemo(() => {
    const m = new Map();
    (workSystemList || []).forEach((w) => {
      const key = String(w.idx ?? w.work_system ?? "");
      if (key) m.set(key, w.work_system ?? "");
    });
    return m;
  }, [workSystemList]);

  const mapLabel = (options, v) => {
    const key = String(v ?? "");
    return options.find((o) => String(o.value) === key)?.label ?? key;
  };

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

  const buildExcelRows = (rows) =>
    (rows || []).map((r) => ({
      ...r,
      salary: formatNumber(parseNumber(r.salary)),
      cor_type: mapLabel(corOptions, r.cor_type),
      contract_type: mapLabel(contractOptions, r.contract_type),
      position_type: mapLabel(positionOptions, r.position_type),
      idx: workSystemLabelMap.get(String(r.idx ?? "")) ?? String(r.idx ?? ""),
    }));

  const handleExcelDownloadAllAccounts = async () => {
    if (excelDownloading) return;
    setExcelDownloading(true);

    try {
      Swal.fire({
        title: "엑셀 생성 중...",
        text: "현장 직원관리 데이터를 조회하고 있습니다.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.get("/Operate/AccountMemberAllList", {
        params: { del_yn: activeStatus },
      });
      const rows = buildExcelRows(
        (res.data || []).map((item) => ({
          account_id: item.account_id,
          member_id: item.member_id,
          name: item.name,
          rrn: item.rrn,
          position_type: item.position_type,
          account_number: item.account_number,
          phone: item.phone,
          address: item.address,
          contract_type: item.contract_type,
          join_dt: item.join_dt,
          act_join_dt: item.act_join_dt,
          ret_set_dt: item.ret_set_dt,
          loss_major_insurances: item.loss_major_insurances,
          del_yn: item.del_yn,
          del_dt: item.del_dt,
          del_note: item.del_note,
          salary: parseNumber(item.salary),
          idx: item.idx,
          start_time: normalizeTime(item.start_time),
          end_time: normalizeTime(item.end_time),
          national_pension: item.national_pension,
          health_insurance: item.health_insurance,
          industrial_insurance: item.industrial_insurance,
          employment_insurance: item.employment_insurance,
          employment_contract: item.employment_contract,
          headoffice_note: item.headoffice_note,
          subsidy: item.subsidy,
          note: item.note,
          id: item.id,
          bankbook: item.bankbook,
          cor_type: item.cor_type,
        }))
      );

      const wb = new ExcelJS.Workbook();
      wb.creator = "AccountMemberSheet";

      const ws = wb.addWorksheet("현장 직원관리");
      const cols = columns
        .filter((c) => c.accessorKey)
        .map((c) => ({ header: c.header, key: c.accessorKey, width: 14 }));

      const now = dayjs();
      const y = now.year();
      const m = String(now.month() + 1).padStart(2, "0");
      const accNameMap = new Map();
      (accountList || []).forEach((a) => {
        accNameMap.set(String(a.account_id), a.account_name);
      });

      const addSectionTitle = (title, colCount) => {
        ws.addRow([title]);
        const r = ws.lastRow.number;
        ws.mergeCells(r, 1, r, colCount);
        const cell = ws.getCell(r, 1);
        cell.font = { bold: true, size: 12 };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        ws.getRow(r).height = 26;
      };

      const styleHeaderRow = (rowNum) => {
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

      const styleDataRow = (rowNum) => {
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

      // ✅ 컬럼명 중복 방지: columns에는 header를 쓰지 않고, 아래에서 헤더 row를 직접 추가
      const baseCols = cols.map((c) => ({ key: c.key, width: c.width }));
      ws.columns = baseCols;

      const grouped = new Map();
      rows.forEach((r) => {
        const k = String(r.account_id ?? "");
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k).push(r);
      });

      const header = cols.map((c) => c.header);
      const autoWidthValues = baseCols.map(() => []);

      grouped.forEach((list, accId) => {
        const name = accNameMap.get(accId) || "거래처";
        addSectionTitle(`■ ${name} (${accId})  /  ${y}-${m}`, cols.length);

        ws.addRow(header);
        ws.getRow(ws.lastRow.number).height = 23;
        styleHeaderRow(ws.lastRow.number);
        header.forEach((h, i) => autoWidthValues[i].push(h));

        list.forEach((r) => {
          const row = {};
          cols.forEach((c) => {
            row[c.key] = r[c.key] ?? "";
          });
          ws.addRow(row);
          ws.getRow(ws.lastRow.number).height = 23;
          styleDataRow(ws.lastRow.number);
          cols.forEach((c, i) => autoWidthValues[i].push(row[c.key]));
        });

        ws.addRow([]);
      });

      const calcWidth = (values, min = 15, max = 80) => {
        const longest = Math.max(...values.map((v) => String(v ?? "").length), 0);
        return Math.min(Math.max(longest + 2, min), max);
      };
      autoWidthValues.forEach((vals, i) => {
        ws.getColumn(i + 1).width = calcWidth(vals);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const d = String(now.date()).padStart(2, "0");
      const filename = `현장직원관리_전체_${y}-${m}-${d}.xlsx`;
      saveAs(blob, filename);

      Swal.fire({ title: "완료", text: "엑셀 다운로드가 완료되었습니다.", icon: "success" });
    } catch (e) {
      console.error(e);
      Swal.fire({ title: "실패", text: "엑셀 생성 중 오류가 발생했습니다.", icon: "error" });
    } finally {
      setExcelDownloading(false);
    }
  };

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
      exact || list.find((o) => String(o?.label || "").toLowerCase().includes(qLower));
    if (partial) {
      setSelectedAccountId(partial.value);
      setAccountInput(partial.label || q);
    }
  }, [accountInput, accountOptions]);

  const columns = useMemo(
    () => [
      { header: "구분", accessorKey: "cor_type", size: 100 },
      { header: "성명", accessorKey: "name", size: 100 },
      { header: "주민번호", accessorKey: "rrn", size: 100 },
      { header: "업장명", accessorKey: "account_id", size: 150 },
      { header: "직책", accessorKey: "position_type", size: 100 },
      { header: "계좌번호", accessorKey: "account_number", size: 150 },
      { header: "연락처", accessorKey: "phone", size: 100 },
      { header: "주소", accessorKey: "address", size: 150 },
      { header: "계약형태", accessorKey: "contract_type", size: 50 },
      { header: "실입사일", accessorKey: "act_join_dt", size: 80 },
      { header: "입사일", accessorKey: "join_dt", size: 80 },
      { header: "퇴직정산일", accessorKey: "ret_set_dt", size: 80 },
      { header: "4대보험 상실일", accessorKey: "loss_major_insurances", size: 80 },
      { header: "퇴사여부", accessorKey: "del_yn", size: 80 },
      { header: "퇴사일", accessorKey: "del_dt", size: 80 },
      { header: "퇴사사유", accessorKey: "del_note", size: 100 },
      {
        header: "급여(월)",
        accessorKey: "salary",
        size: 80,
        cell: (info) => formatNumber(info.getValue()),
      },
      { header: "근무형태", accessorKey: "idx", size: 180 },
      { header: "시작", accessorKey: "start_time", size: 60 },
      { header: "마감", accessorKey: "end_time", size: 60 },
      { header: "국민연금", accessorKey: "national_pension", size: 80 },
      { header: "건강보험", accessorKey: "health_insurance", size: 80 },
      { header: "산재보험", accessorKey: "industrial_insurance", size: 80 },
      { header: "고용보험", accessorKey: "employment_insurance", size: 80 },
      { header: "비고", accessorKey: "note", minWidth: 80, maxWidth: 150 },
      { header: "본사노트", accessorKey: "headoffice_note", minWidth: 80, maxWidth: 150 },
      { header: "지원금", accessorKey: "subsidy", minWidth: 80, maxWidth: 150 },

      // ✅ 이미지 컬럼 3개 추가 (RecSheet와 동일 항목명)
      { header: "근로계약서", accessorKey: "employment_contract", size: 120 },
      { header: "신분증", accessorKey: "id", size: 120 },
      { header: "통장사본", accessorKey: "bankbook", size: 120 },
    ],
    []
  );

  const table = useReactTable({
    data: activeRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleSave = async () => {
    const changedRows = activeRows.filter((row, idx) => {
      const original = originalRows[idx];
      if (!original) return true;

      return Object.keys(row).some((key) => {
        // ✅ 이미지 필드: object(File)로 바뀌면 무조건 변경
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

      // ⭐ 빈 문자열 제거 → null 값으로 변환
      const cleanRow = (row) => {
        const newRow = { ...row };
        Object.keys(newRow).forEach((key) => {
          if (newRow[key] === "" || newRow[key] === undefined) {
            newRow[key] = null;
          }
        });
        return newRow;
      };

      // ✅ 이미지가 File이면 업로드 후 경로 문자열로 치환
      const processed = await Promise.all(
        changedRows.map(async (row) => {
          const newRow = cleanRow(row);

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

      const res = await api.post("/Operate/AccountMembersSave", {
        data: processed,
      });

      if (res.data.code === 200) {
        Swal.fire("저장 완료", "변경사항이 저장되었습니다.", "success");
        setOriginalRows([...activeRows]);
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

  const closeWorkSystemModal = () => {
    setWsOpen(false);
  };

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
  // ✅ 유틸관리 모달 로직 (추가)
  // =========================
  const [utilOpen, setUtilOpen] = useState(false);

  // 왼쪽: /Account/AccountUtilMemberList (member_id, position_type)
  const [utilMemberRows, setUtilMemberRows] = useState([]);
  const [utilSelectedMember, setUtilSelectedMember] = useState(null);

  // 가운데: /Account/AccountUtilMappingList (member_id로 조회) -> idx, account_id, member_id, name, position_type
  const [utilMappingRows, setUtilMappingRows] = useState([]);
  const [utilSelectedMappingRowIndex, setUtilSelectedMappingRowIndex] = useState(null); // (추후 삭제 기능에 쓸 수 있음)

  // 오른쪽: /Account/AccountList -> account_id, account_name
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
      // 모달 초기화
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

  const closeUtilModal = () => {
    setUtilOpen(false);
  };

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

    // 중복 방지: 같은 member_id + account_id 이미 있으면 추가 안함
    const exists = (utilMappingRows || []).some(
      (r) =>
        String(r.member_id) === String(member_id) && String(r.account_id) === String(account_id)
    );
    if (exists) {
      Swal.fire("안내", "이미 매핑된 업장입니다.", "info");
      return;
    }

    const newRow = {
      idx: null, // 신규
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
      // 서버 스펙이 명확하지 않아서, member_id + data 함께 전송 (대부분 이 형태로 처리 가능)
      const payload = {
        member_id: utilSelectedMember.member_id,
        data: utilMappingRows || [],
      };

      const res = await api.post("/Account/AccountUtilMemberMappingSave", utilMappingRows);
      const ok = res?.status === 200 || res?.data?.code === 200;

      if (!ok) {
        Swal.fire("저장 실패", res?.data?.message || "서버 오류", "error");
        return;
      }

      Swal.fire("저장 완료", "유틸 매핑이 저장되었습니다.", "success");

      // 저장 후 가운데 재조회
      const latest = await fetchUtilMappingList(utilSelectedMember.member_id);
      setUtilMappingRows(latest || []);
      setUtilOpen(false);
    } catch (err) {
      Swal.fire("저장 실패", err?.message || "오류", "error");
    }
  };

  const handleAddRow = () => {
    const defaultAccountId = selectedAccountId || (accountList?.[0]?.account_id ?? "");
    const defaultWorkSystemIdx = workSystemList?.[0]?.idx ? String(workSystemList[0].idx) : "";

    const defaultPositionType = 1; // 신규 기본 직책

    const newRow = {
      name: "",
      rrn: "",
      // ✅ 유틸(6)이면 null, 아니면 기본 거래처
      account_id: defaultPositionType === 6 ? 2 : defaultAccountId,

      position_type: defaultPositionType,
      account_number: "",
      phone: "",
      address: "",
      contract_type: 1,
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
      headoffice_note: "",
      subsidy: "",
      total: 0,

      employment_contract: "",
      id: "",
      bankbook: "",
      cor_type: 1,
    };

    setActiveRows((prev) => [newRow, ...prev]);
    setOriginalRows((prev) => [newRow, ...prev]);
  };

  const renderTable = (table, rows, originals) => {
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
    ]);
    const nonEditableCols = new Set(["diner_date", "total"]);

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
            left: "200px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(4), & th:nth-of-type(4)": {
            position: "sticky",
            left: "300px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(5), & th:nth-of-type(5)": {
            position: "sticky",
            left: "480px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(6), & th:nth-of-type(6)": {
            // 계좌번호
            position: "sticky",
            left: "580px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "& td:nth-of-type(7), & th:nth-of-type(7)": {
            position: "sticky",
            left: "730px",
            background: "#f0f0f0",
            zIndex: 3,
          },
          "thead th:nth-of-type(-n+7)": { zIndex: 5 },
          "& .edited-cell": { color: "#d32f2f", fontWeight: 500 },
          "td[contenteditable]": { minWidth: "80px", cursor: "text" },
          "& select": {
            fontSize: "12px",
            padding: "4px",
            minWidth: "80px",
            border: "none",
            background: "transparent",
            outline: "none",
            cursor: "pointer",
          },
          "& select.edited-cell": { color: "#d32f2f", fontWeight: 500 },
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
            {table.getHeaderGroups().map((headerGroup) => (
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
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const colKey = cell.column.columnDef.accessorKey;
                  const currentValue = row.getValue(colKey);
                  const originalValue = originals?.[rowIndex]?.[colKey];

                  const isNumeric = numericCols.includes(colKey);
                  const isImage = imageFields.includes(colKey);

                  // ✅ 이미지 변경 판정 포함
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

                      // ✅ position_type 변경 시: 유틸(6)면 account_id = null 처리
                      if (colKey === "position_type") {
                        const nextPos = String(newValue);
                        return {
                          ...r,
                          position_type: newValue,
                          account_id: nextPos === "6" ? 2 : r.account_id ?? selectedAccountId ?? "",
                          total: calculateTotal({ ...r, position_type: newValue }),
                        };
                      }

                      // ✅ work_system 변경 시 start/end 자동 세팅
                      if (colKey === "idx") {
                        const selected = (workSystemList || []).find(
                          (w) => String(w.idx) === String(newValue)
                        );

                        return {
                          ...r,
                          idx: newValue,
                          start_time: selected?.start_time
                            ? normalizeTime(selected.start_time)
                            : r.start_time,
                          end_time: selected?.end_time
                            ? normalizeTime(selected.end_time)
                            : r.end_time,
                          total: calculateTotal({
                            ...r,
                            idx: newValue,
                            start_time: selected?.start_time
                              ? normalizeTime(selected.start_time)
                              : r.start_time,
                            end_time: selected?.end_time
                              ? normalizeTime(selected.end_time)
                              : r.end_time,
                          }),
                        };
                      }

                      return {
                        ...r,
                        [colKey]: newValue,
                        total: calculateTotal({ ...r, [colKey]: newValue }),
                      };
                    });

                    setActiveRows(updatedRows);
                  };

                  // ✅ 이미지 컬럼 렌더링 (RecSheet 방식 그대로)
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
                          accept="image/*,application/pdf"
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

                  return (
                    <td
                      key={cell.id}
                      style={{
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
                            renderOption={(props, option) => (
                              <li
                                {...props}
                                style={{
                                  fontSize: "12px",
                                  paddingTop: 4,
                                  paddingBottom: 4,
                                  color: isChanged ? "#d32f2f" : "inherit",
                                  fontWeight: isChanged ? 600 : 400,
                                }}
                              >
                                {option.label}
                              </li>
                            )}
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
                                renderOption={(props, option) => (
                                  <li
                                    {...props}
                                    style={{
                                      fontSize: "12px",
                                      paddingTop: 4,
                                      paddingBottom: 4,
                                      color: isAccountChanged ? "#d32f2f" : "inherit",
                                      fontWeight: isAccountChanged ? 600 : 400,
                                    }}
                                  >
                                    {option.label}
                                  </li>
                                )}
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
                                  "& .MuiAutocomplete-option": { fontSize: "12px", minHeight: 28 },
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
      {/* 상단 필터 + 버튼 (모바일 대응) */}
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

        {/* ✅ (수정) 거래처 select → Autocomplete(검색 가능) */}
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={selectedAccountOption}
          onChange={(_, opt) => {
            if (!opt) return;
            setLoading(true);
            setSelectedAccountId(opt.value);
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

        <MDButton variant="gradient" color="warning" onClick={openWorkSystemModal}>
          근무형태 관리
        </MDButton>

        {/* ✅ 유틸관리 버튼 추가 */}
        <MDButton variant="gradient" color="warning" onClick={openUtilModal}>
          유틸관리
        </MDButton>

        <MDButton
          variant="gradient"
          color="dark"
          onClick={handleExcelDownloadAllAccounts}
          disabled={excelDownloading}
        >
          전체 거래처 엑셀
        </MDButton>

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
          ✅ 유틸관리 모달 (추가)
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
          ✅ 이미지 뷰어 (추가)
         ========================= */}
      {viewFile?.src && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "transparent",
            zIndex: 9999,
          }}
          onClick={handleCloseViewer}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: viewerPos.x,
              top: viewerPos.y,
              width: isMobile ? "92vw" : "48vw",
              height: isMobile ? "92vh" : "88vh",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.7)",
                borderRadius: 8,
              }}
            />

            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 32,
                cursor: "move",
                zIndex: 1002,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 8px",
                color: "#fff",
                fontSize: 12,
                userSelect: "none",
              }}
              onMouseDown={handleDragStart}
            >
              <span>미리보기</span>
              <button
                onClick={handleCloseViewer}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                X
              </button>
            </div>

            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                zIndex: 1001,
                paddingTop: 32,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              {viewFile.isPdf ? (
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    bgcolor: "#111",
                    overflow: "auto",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      transform: `scale(${pdfScale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <iframe
                      title="pdf-preview"
                      src={`${viewFile.src}#view=FitH`}
                      style={{ width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                </Box>
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "auto",
                    position: "relative",
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
                            pointerEvents: "auto",
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              zoomIn();
                            }}
                            style={{
                              border: "none",
                              padding: isMobile ? "2px 6px" : "4px 8px",
                              cursor: "pointer",
                            }}
                          >
                            +
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              zoomOut();
                            }}
                            style={{
                              border: "none",
                              padding: isMobile ? "2px 6px" : "4px 8px",
                              cursor: "pointer",
                            }}
                          >
                            -
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              resetTransform();
                            }}
                            style={{
                              border: "none",
                              padding: isMobile ? "2px 6px" : "4px 8px",
                              cursor: "pointer",
                            }}
                          >
                            ⟳
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleCloseViewer();
                            }}
                            style={{
                              border: "none",
                              padding: isMobile ? "2px 6px" : "4px 8px",
                              cursor: "pointer",
                            }}
                          >
                            X
                          </button>
                        </div>

                        <TransformComponent>
                          <img
                            src={encodeURI(viewFile.src)}
                            alt="미리보기"
                            style={{
                              maxWidth: "100%",
                              maxHeight: "100%",
                              height: "auto",
                              width: "auto",
                              borderRadius: 8,
                              display: "block",
                            }}
                          />
                        </TransformComponent>
                      </>
                    )}
                  </TransformWrapper>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AccountMemberSheet;
