/* eslint-disable react/function-component-definition */
// 지점업로드 탭 데이터: 거래처 목록·주차별 자료 조회, 파일 업로드·저장 API와 주차·자료 판별 헬퍼
// 저장 구조: 하루 1행(구분 '일일' 고정), 주간 식단표는 그 주 월요일 행에, 식판 사진은 날짜별 행에 저장
import { useState, useEffect, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import api from "api/api";
import { fetchFieldBoardAccountList } from "utils/fieldBoardAccountFilter";
import { buildFileDownloadUrl } from "utils/fileDownloadUrl";
import { compressImageFile } from "utils/HygieneCardBoard";

// 하루 1행 저장 시 쓰는 구분 값 (UNIQUE 키: 거래처+일자+구분)
const DAILY_MEAL_TYPE = "일일";
// 식판 사진을 올리는 요일 (월~일)
const WEEK_DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 업로드 자료 종류 (key: 서버 컬럼 접두어, label: 화면 표시명, hint·accept: 등록 카드 안내·허용 형식)
const FILE_KINDS = [
  { key: "menu", label: "식단표", hint: "주 1장 · 엑셀 · PDF · 사진 파일", accept: "image/*,application/pdf,.xlsx,.xls" },
  { key: "plate", label: "식판 사진", hint: "매일 1장 · 사진 파일", accept: "image/*" },
];
// 거래처 선택칸의 전체 거래처 값
const ALL_ACCOUNTS = "ALL";
// 다운로드 메뉴 항목 (kinds: ZIP에 담을 자료 종류)
const DOWNLOAD_OPTIONS = [
  { label: "식판 사진만", kinds: ["plate"] },
  { label: "식단표만", kinds: ["menu"] },
  { label: "식단표 + 식판 사진", kinds: ["menu", "plate"] },
];

// 날짜가 속한 주의 월요일 (일요일은 그 주의 마지막 날)
const mondayOf = (date) => {
  const d = dayjs(date);
  return d.subtract((d.day() + 6) % 7, "day").format("YYYY-MM-DD");
};
// 월요일부터 일요일까지 7일 날짜 목록
const weekDates = (monday) => WEEK_DAY_LABELS.map((_, i) => dayjs(monday).add(i, "day").format("YYYY-MM-DD"));

// 선택 연월의 주차 목록 (월요일이 그 달인 주만 포함, 월 경계 주는 월요일이 속한 달에서 일요일까지 표시)
// 반환: [{ no: 주차 번호, start: 월요일, end: 일요일, dates: 월~일 날짜 }]
const monthWeeks = (year, month) => {
  const first = dayjs(new Date(year, month - 1, 1));
  const last = first.endOf("month");
  const weeks = [];
  let monday = dayjs(mondayOf(first));
  // 1일이 월요일이 아니면 그 주는 전월 주차이므로 다음 월요일부터 시작
  if (monday.isBefore(first, "day")) monday = monday.add(7, "day");
  while (!monday.isAfter(last, "day")) {
    const start = monday.format("YYYY-MM-DD");
    weeks.push({ no: weeks.length + 1, start, end: monday.add(6, "day").format("YYYY-MM-DD"), dates: weekDates(start) });
    monday = monday.add(7, "day");
  }
  return weeks;
};

// 행의 자료 경로·파일명·등록일시 (kind: menu | plate)
const fileOf = (row, kind) =>
  row && row[`${kind}_file_path`]
    ? { path: row[`${kind}_file_path`], name: row[`${kind}_file_name`] || "", regDt: row[`${kind}_reg_dt`] || "" }
    : null;
const isPdf = (path) => /\.pdf$/i.test(path || "");
const isExcel = (path) => /\.xlsx?$/i.test(path || "");
// 미리보기 종류 (PreviewOverlay kind: pdf | excel | image, value: 서버 경로 또는 새로 고른 File)
const previewKindOf = (value) => {
  const name = typeof value === "string" ? value : value?.name;
  if (isPdf(name)) return "pdf";
  if (isExcel(name)) return "excel";
  return "image";
};

// 조회 행을 거래처·주차 단위로 묶은 목록
// accountIds: 자료가 없어도 주차 줄을 만들 거래처 (단일 거래처 조회), 없으면 자료가 있는 거래처·주차만
// 반환: [{ key, account_id, account_name, week, menuRow: 월요일 행, dayRows: { 날짜: 행 } }]
const groupWeekRows = (rows, weeks, accountIds = [], accountNames = {}) => {
  const map = {};
  const ensure = (accountId, week, name) => {
    const key = `${accountId}|${week.start}`;
    if (!map[key]) map[key] = { key, account_id: accountId, account_name: name || accountNames[accountId] || accountId, week, menuRow: null, dayRows: {} };
    return map[key];
  };
  accountIds.forEach((id) => weeks.forEach((week) => ensure(String(id), week)));
  rows.forEach((row) => {
    const week = weeks.find((w) => row.meal_date >= w.start && row.meal_date <= w.end);
    if (!week) return;
    const item = ensure(String(row.account_id), week, row.account_name);
    item.dayRows[row.meal_date] = row;
    if (row.meal_date === week.start && fileOf(row, "menu")) item.menuRow = row;
  });
  // 주차 순(1주차부터), 같은 주차는 거래처명 순
  return Object.values(map).sort(
    (a, b) => a.week.start.localeCompare(b.week.start) || String(a.account_name).localeCompare(String(b.account_name), "ko")
  );
};
// 주차 묶음에 포함된 실제 행 목록 (다운로드 대상)
const weekRowsOf = (item) => item.week.dates.map((date) => item.dayRows[date]).filter(Boolean);

// 다운로드 파일명 (식단표: 거래처_주시작일_주간식단표, 식판 사진: 거래처_일자_식판사진)
const buildFileName = (row, kind) => {
  const { path } = fileOf(row, kind);
  const ext = path.includes(".") ? path.split(".").pop() : "file";
  const label = kind === "menu" ? "주간식단표" : "식판사진";
  return `${row.account_name || row.account_id}_${row.meal_date}_${label}.${ext}`;
};

// 서버 파일을 Blob으로 받아오는 함수 (ZIP 묶음용, 오류 응답이면 예외)
const fetchFileBlob = async (path) => {
  const res = await fetch(buildFileDownloadUrl(path), { credentials: "include" });
  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok || contentType.includes("xml") || contentType.includes("html") || contentType.includes("json")) {
    throw new Error("파일을 불러오지 못했습니다.");
  }
  return res.blob();
};

// isHeadOffice: 본사 메뉴 화면 여부 (전체 거래처 목록 사용)
export default function useBranchUploadData(isHeadOffice) {
  // 거래처 목록, 조회한 자료 행 목록, 목록 조회 중 여부
  const [accountList, setAccountList] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // 거래처 목록 조회 (본사 화면: 전체 거래처, 현장 화면: 로그인 사용자 접근 가능 거래처)
  useEffect(() => {
    const load = isHeadOffice
      ? api
          .get("/Account/AccountList", { params: { account_type: "0" } })
          .then((res) =>
            (Array.isArray(res.data) ? res.data : []).sort((a, b) =>
              String(a.account_name || "").localeCompare(String(b.account_name || ""), "ko")
            )
          )
      : fetchFieldBoardAccountList({ endpoint: "/Account/AccountList", accountType: "0" });
    load
      .then((list) => setAccountList(list || []))
      .catch((err) => {
        console.error("데이터 조회 실패 (AccountList):", err);
        setAccountList([]);
      });
  }, [isHeadOffice]);

  // 접근 가능한 거래처 id 목록 (전체 조회 결과를 이 범위로 제한)
  const accessibleIds = useMemo(() => new Set(accountList.map((acc) => String(acc.account_id))), [accountList]);

  // 지정 기간·거래처 자료를 서버에서 받아 접근 가능한 거래처 행만 반환 (account_id 빈 값이면 전체 거래처)
  const fetchBranchUploadRows = useCallback(
    async ({ start_date, end_date, account_id }) => {
      const res = await api.get("/Operate/BranchUploadList", { params: { start_date, end_date, account_id } });
      return (Array.isArray(res.data) ? res.data : []).filter((row) => accessibleIds.has(String(row.account_id)));
    },
    [accessibleIds]
  );

  // 목록 화면 자료 조회 (거래처 목록을 받은 뒤에만 조회)
  // silent: 저장 직후 다시 조회할 때 기존 표를 그대로 두고 데이터만 교체 (불러오는 중 표시·사진 재로딩 없음)
  const fetchBranchUploadList = useCallback(
    async (params, { silent = false } = {}) => {
      if (accountList.length === 0) return;
      if (!silent) setLoading(true);
      try {
        setRows(await fetchBranchUploadRows(params));
      } catch (err) {
        console.error("지점업로드 조회 실패:", err);
        if (!silent) setRows([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [accountList.length, fetchBranchUploadRows]
  );

  // 같은 거래처·주차(월~일)에 이미 등록된 행 조회 (등록 전 중복 확인, 화면 조회 조건과 무관)
  const findWeekRows = async ({ account_id, week_start }) => {
    const res = await api.get("/Operate/BranchUploadList", {
      params: { start_date: week_start, end_date: dayjs(week_start).add(6, "day").format("YYYY-MM-DD"), account_id },
    });
    return Array.isArray(res.data) ? res.data : [];
  };

  // 파일 1개를 서버에 올리고 저장 경로 반환 (사진은 축소, 식단표 사진은 글씨가 보이도록 크게 유지)
  const uploadBranchFile = async (file, kind, accountId, mealDate) => {
    const upload = kind === "menu" ? await compressImageFile(file, 2400, 0.9) : await compressImageFile(file);
    const formData = new FormData();
    formData.append("file", upload);
    formData.append("type", "branch_upload");
    formData.append("gubun", mealDate.slice(0, 7).replace("-", ""));
    formData.append("folder", accountId);
    const res = await api.post("/Operate/OperateImgUpload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (res.data?.code !== 200) throw new Error("파일 업로드 실패");
    return res.data.image_path;
  };

  // 거래처·일자 1건의 자료를 올리고 경로를 저장 (실패 시 예외)
  // files: { menu?: File, plate?: File, menuDelete?: true, plateDelete?: true } (Delete: 기존 파일 경로 비우기)
  const saveBranchUpload = async ({ account_id, meal_date }, files) => {
    const payload = { account_id, meal_date, meal_type: DAILY_MEAL_TYPE, user_id: localStorage.getItem("user_id") || "" };
    FILE_KINDS.forEach(({ key }) => {
      if (files[`${key}Delete`] && !files[key]) payload[`${key}_delete`] = "Y";
    });
    // eslint-disable-next-line no-restricted-syntax
    for (const { key } of FILE_KINDS) {
      if (files[key]) {
        // eslint-disable-next-line no-await-in-loop
        payload[`${key}_file_path`] = await uploadBranchFile(files[key], key, account_id, meal_date);
        payload[`${key}_file_name`] = files[key].name;
      }
    }
    const res = await api.post("/Operate/BranchUploadSave", payload);
    if (res.data?.code !== 200) throw new Error(res.data?.message || "저장 실패");
  };

  // 주차 1개의 자료를 일자별로 나눠 저장
  // menu: 월요일 행 식단표, plates: { 날짜: File }, deleteMenu: 식단표 삭제, deletePlates: { 날짜: true } 식판 사진 삭제
  const saveWeekUpload = async ({ account_id, week_start, menu, plates, deleteMenu, deletePlates }) => {
    const byDate = {};
    const put = (date, key, value) => {
      byDate[date] = { ...(byDate[date] || {}), [key]: value };
    };
    if (menu) put(week_start, "menu", menu);
    else if (deleteMenu) put(week_start, "menuDelete", true);
    Object.entries(plates || {}).forEach(([date, file]) => {
      if (file) put(date, "plate", file);
    });
    Object.entries(deletePlates || {}).forEach(([date, on]) => {
      if (on && !(plates || {})[date]) put(date, "plateDelete", true);
    });
    // eslint-disable-next-line no-restricted-syntax
    for (const [meal_date, files] of Object.entries(byDate)) {
      // eslint-disable-next-line no-await-in-loop
      await saveBranchUpload({ account_id, meal_date }, files);
    }
  };

  return {
    accountList,
    rows,
    loading,
    fetchBranchUploadList,
    fetchBranchUploadRows,
    findWeekRows,
    saveBranchUpload,
    saveWeekUpload,
  };
}

export {
  WEEK_DAY_LABELS,
  FILE_KINDS,
  ALL_ACCOUNTS,
  DOWNLOAD_OPTIONS,
  mondayOf,
  monthWeeks,
  fileOf,
  isPdf,
  previewKindOf,
  groupWeekRows,
  weekRowsOf,
  buildFileName,
  fetchFileBlob,
};
