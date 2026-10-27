/* eslint-disable react/function-component-definition */
// 지점업로드 탭 데이터: 거래처 목록·월별 자료 조회, 파일 업로드·저장 API와 자료 판별 헬퍼
import { useState, useEffect, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import api from "api/api";
import { fetchFieldBoardAccountList } from "utils/fieldBoardAccountFilter";
import { buildFileDownloadUrl } from "utils/fileDownloadUrl";
import { compressImageFile } from "utils/HygieneCardBoard";

// 급식 구분 목록 (화면 표시 순서)
const MEAL_TYPES = ["조식", "중식", "석식", "간식"];
// 업로드 자료 종류 (key: 서버 컬럼 접두어, label: 화면 표시명, hint·accept: 등록 카드 안내·허용 형식)
const FILE_KINDS = [
  { key: "menu", label: "식단표", hint: "PDF · 사진 파일", accept: "image/*,application/pdf" },
  { key: "plate", label: "식판 사진", hint: "사진 파일 (JPG · PNG 등)", accept: "image/*" },
];
// 거래처 선택칸의 전체 거래처 값
const ALL_ACCOUNTS = "ALL";
// 다운로드 메뉴 항목 (kinds: ZIP에 담을 자료 종류)
const DOWNLOAD_OPTIONS = [
  { label: "식판 사진만", kinds: ["plate"] },
  { label: "식단표만", kinds: ["menu"] },
  { label: "식단표 + 식판 사진", kinds: ["menu", "plate"] },
];

// 행의 자료 경로·파일명·등록일시 (kind: menu | plate)
const fileOf = (row, kind) =>
  row && row[`${kind}_file_path`]
    ? { path: row[`${kind}_file_path`], name: row[`${kind}_file_name`] || "", regDt: row[`${kind}_reg_dt`] || "" }
    : null;
const isPdf = (path) => /\.pdf$/i.test(path || "");
// 행의 등록된 자료 개수
const countFiles = (row) => FILE_KINDS.filter((k) => fileOf(row, k.key)).length;
const isDone = (row) => countFiles(row) === FILE_KINDS.length;

// 다운로드 파일명 (거래처_일자_구분_자료종류.확장자)
const buildFileName = (row, kind) => {
  const { path } = fileOf(row, kind);
  const ext = path.includes(".") ? path.split(".").pop() : "file";
  const label = FILE_KINDS.find((k) => k.key === kind).label.replace(" ", "");
  return `${row.account_name || row.account_id}_${row.meal_date}_${row.meal_type}_${label}.${ext}`;
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

  // 지정 연월·거래처 자료를 서버에서 받아 접근 가능한 거래처 행만 반환 (account_id 빈 값이면 전체 거래처)
  const fetchBranchUploadRows = useCallback(
    async ({ year, month, account_id }) => {
      const res = await api.get("/Operate/BranchUploadList", { params: { year, month, account_id } });
      return (Array.isArray(res.data) ? res.data : []).filter((row) => accessibleIds.has(String(row.account_id)));
    },
    [accessibleIds]
  );

  // 목록 화면 자료 조회 (거래처 목록을 받은 뒤에만 조회)
  const fetchBranchUploadList = useCallback(
    async (params) => {
      if (accountList.length === 0) return;
      setLoading(true);
      try {
        setRows(await fetchBranchUploadRows(params));
      } catch (err) {
        console.error("지점업로드 조회 실패:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [accountList.length, fetchBranchUploadRows]
  );

  // 같은 거래처·일자·구분으로 이미 등록된 건 조회 (등록 전 중복 확인, 화면 조회 조건과 무관)
  const findExistingRow = async ({ account_id, meal_date, meal_type }) => {
    const d = dayjs(meal_date);
    const res = await api.get("/Operate/BranchUploadList", {
      params: { year: d.year(), month: d.month() + 1, account_id },
    });
    return (Array.isArray(res.data) ? res.data : []).find(
      (row) => row.meal_date === meal_date && row.meal_type === meal_type
    );
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

  // 거래처·일자·구분 1건의 자료를 올리고 경로를 저장 (files: { menu?: File, plate?: File }, 실패 시 예외)
  const saveBranchUpload = async ({ account_id, meal_date, meal_type }, files) => {
    const payload = { account_id, meal_date, meal_type, user_id: localStorage.getItem("user_id") || "" };
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

  return {
    accountList,
    rows,
    loading,
    fetchBranchUploadList,
    fetchBranchUploadRows,
    findExistingRow,
    saveBranchUpload,
  };
}

export {
  MEAL_TYPES,
  FILE_KINDS,
  ALL_ACCOUNTS,
  DOWNLOAD_OPTIONS,
  fileOf,
  isPdf,
  countFiles,
  isDone,
  buildFileName,
  fetchFileBlob,
};
