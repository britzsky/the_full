// ✅ src/layouts/membersFiles/AccountMembersFilesTab.js
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery, IconButton, Tooltip } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import DownloadIcon from "@mui/icons-material/Download";
import ImageSearchIcon from "@mui/icons-material/ImageSearch";
import useMembersFilesData from "./accountMembersFilesData";
import LoadingScreen from "layouts/loading/loadingscreen";
import api from "api/api";
import Swal from "sweetalert2";
import { API_BASE_URL } from "config";
import { buildFileDownloadUrl } from "utils/fileDownloadUrl";
import PreviewOverlay from "utils/PreviewOverlay";

// ✅ 문서종류 고정 4종 — 회원 1명당 이 순서대로 세로 행이 생김(면허증/보건증/위생교육/보수교육)
const DOC_TYPES = [
  { value: "1", label: "면허증" },
  { value: "2", label: "보건증" },
  { value: "3", label: "위생교육" },
  { value: "4", label: "보수교육" },
];

// ✅ 직급별 문서종류 적용 여부 — 보수교육은 영양사만 해당
const isDocTypeApplicable = (position, typeValue) => typeValue !== "4" || position === "영양사";

// ✅ 문서 빈 값(업로드 전 상태)
const emptyDoc = () => ({ doc_id: "", file_path: "", issue_dt: "", expiry_dt: "", note: "" });

// ✅ 컬럼 폭(%) — 헤더 테이블/본문 테이블 두 개를 분리해서 그리므로, colgroup으로 두 테이블 폭을 강제로 맞춘다
//    (이름/직급/문서종류/발급일/만료일/파일/비고) — %로 주고 테이블을 100%로 채워서, 화면 폭에 맞춰
//    전 컬럼이 같은 비율로 늘어나게 함(비고만 커지거나 표가 왼쪽에 좁게 붙는 문제 방지)
const COLUMN_WIDTHS = ["10%", "10%", "9%", "14%", "14%", "11%", "32%"];

// ✅ 페이지당 회원 수 — 행이 아니라 "회원" 단위로 페이징한다. 회원 1명이 문서종류에 따라
//    3~4행을 쓰기 때문에, 행 기준으로 자르면 한 회원의 문서종류 그룹이 페이지 중간에서
//    잘려 보일 수 있어서다. 페이지마다 실제 행 수는 조금씩 달라도 회원 단위는 항상 온전함
//    — 4명이면 최대 16행 정도라 카드 스크롤 없이 한 화면에 다 보임
const MEMBERS_PER_PAGE = 4;

function AccountMembersFilesTab() {
  const { membersFilesListRows, accountList, loading, fetcMembersFilesList } =
    useMembersFilesData();

  // ✅ 로그인 시 저장된 account_id로 거래처 고정(현장 화면은 소속 업장만 보이면 됨)
  const localAccountId = useMemo(() => localStorage.getItem("account_id") || "", []);
  const isAccountLocked = !!localAccountId;
  const [selectedAccountId, setSelectedAccountId] = useState(() => localAccountId || "");
  const [accountInput, setAccountInput] = useState("");
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  // ✅ 페이징 — 화면엔 회원 단위로 한 페이지씩만 보여주고, rows/originalRows(저장용 전체 데이터)는
  //    그대로 유지한다. 이렇게 해야 다른 페이지에서 고친 내용이 페이지를 넘겨도 안 날아감
  const [page, setPage] = useState(0);
  const [previewFiles, setPreviewFiles] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewObjectUrlRef = useRef("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ✅ 로그인 계정이 고정돼 있으면 거래처 목록도 그 업장 하나만 남긴다
  const filteredAccountList = useMemo(() => {
    if (!localAccountId) return accountList || [];
    return (accountList || []).filter(
      (acc) => String(acc.account_id) === String(localAccountId)
    );
  }, [accountList, localAccountId]);

  // ✅ 거래처 옵션(Autocomplete)
  const accountOptions = useMemo(
    () =>
      (filteredAccountList || []).map((acc) => ({
        value: String(acc.account_id),
        label: acc.account_name,
      })),
    [filteredAccountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

  const selectAccountByInput = useCallback(() => {
    if (isAccountLocked) return;
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
  }, [accountInput, accountOptions, isAccountLocked]);

  // ✅ 계정 변경 시 조회 — 거래처를 바꿀 때만 1페이지로 리셋(저장 후 재조회에서는 유지)
  useEffect(() => {
    if (selectedAccountId) fetcMembersFilesList(selectedAccountId);
    else {
      setRows([]);
      setOriginalRows([]);
    }
    setPage(0);
  }, [selectedAccountId]);

  // ✅ 조회 → rows/originalRows 동기화 (docs까지 깊은 복사)
  //    저장 후에도 이 effect가 실행되는데, 여기서 페이지를 리셋해버리면 저장하고 나서
  //    보고 있던 페이지가 1페이지로 튕겨서 "방금 저장한 내용이 사라졌다"처럼 보였음
  useEffect(() => {
    const cloneRow = (r) => ({ ...r, docs: { ...(r.docs || {}) } });
    setRows((membersFilesListRows || []).map(cloneRow));
    setOriginalRows((membersFilesListRows || []).map(cloneRow));
  }, [membersFilesListRows]);

  // ✅ 총 페이지 수
  const totalPages = Math.max(1, Math.ceil(rows.length / MEMBERS_PER_PAGE));

  // ✅ 저장/삭제 등으로 rows 길이가 줄어서 현재 페이지가 범위를 벗어나면 보정
  useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [page, totalPages]);

  // ✅ 화면엔 현재 페이지에 해당하는 회원만 — rows/originalRows(저장용)는 그대로 둠
  const pagedRows = useMemo(
    () => rows.slice(page * MEMBERS_PER_PAGE, (page + 1) * MEMBERS_PER_PAGE),
    [rows, page]
  );

  // ✅ 계정 자동 선택 — 로그인 업장이 있으면 그걸로 고정, 없으면 목록 첫 번째
  useEffect(() => {
    if ((accountList || []).length === 0) return;
    if (localAccountId) {
      setSelectedAccountId((prev) => prev || String(localAccountId));
      return;
    }
    if (!selectedAccountId) {
      setSelectedAccountId(String(accountList[0].account_id));
    }
  }, [accountList, selectedAccountId, localAccountId]);

  // ✅ 거래처가 고정된 경우 검색창에 업장명을 표시
  useEffect(() => {
    if (!isAccountLocked || !selectedAccountId) return;
    const matched = (accountList || []).find(
      (acc) => String(acc.account_id) === String(selectedAccountId)
    );
    if (matched) setAccountInput(matched.account_name || "");
  }, [accountList, isAccountLocked, selectedAccountId]);

  // ✅ normalize (공백/개행 차이 무시)
  const normalize = (value) => {
    if (typeof value !== "string") return value ?? "";
    return value.replace(/\s+/g, " ").trim();
  };

  // ✅ 비교용 값 표준화
  const toCompare = (field, v) => {
    if (v === null || v === undefined) return "";

    if (field === "file_path" && typeof v === "object") return "__FILE_OBJECT__";

    if (field === "issue_dt" || field === "expiry_dt") {
      const s = String(v);
      return s.length >= 10 ? s.slice(0, 10) : s;
    }

    if (typeof v === "string") return normalize(v);

    return String(v);
  };

  // ✅ 문서종류별 셀 변경 비교 스타일
  const getCellStyle = (rowIndex, typeValue, field, value) => {
    // ✅ 이 문서종류로 등록된 이력이 아예 없던 회원(originalDoc가 없음)도 emptyDoc()으로
    //    취급해야 신규 업로드/입력이 dirty(빨간색)로 잡힌다. 예전엔 여기서 그냥 black을
    //    반환해버려서, 기존 문서가 하나도 없던 사람의 최초 업로드는 dirty 표시가 전혀 안 됐음
    const originalDoc = originalRows[rowIndex]?.docs?.[typeValue] || emptyDoc();

    const a = toCompare(field, originalDoc[field]);
    const b = toCompare(field, value);

    return a !== b ? { color: "red" } : { color: "black" };
  };

  // ✅ 문서종류별 값 변경
  const handleDocFieldChange = (rowIndex, typeValue, field, value) => {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const currentDoc = row.docs?.[typeValue] || emptyDoc();
        return {
          ...row,
          docs: {
            ...row.docs,
            [typeValue]: { ...currentDoc, [field]: value },
          },
        };
      })
    );
  };

  // ✅ 업로드
  const uploadImage = async (file, member_id, account_id) => {
    if (!file) return "";
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "memberFile");
      formData.append("gubun", member_id);
      formData.append("folder", account_id);

      const res = await api.post(`/Operate/OperateImgUpload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.code === 200) return res.data.image_path;
      return "";
    } catch (err) {
      Swal.fire("실패", "이미지 업로드 실패", "error");
      return "";
    }
  };

  // ✅ 다운로드
  const handleDownload = useCallback((path) => {
    if (!path || typeof path !== "string") return;
    const url = buildFileDownloadUrl(path);
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

  const getExt = (p = "") => {
    const clean = String(p).split("?")[0].split("#")[0];
    return clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  };

  const toPreviewUrl = (p) => {
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    const base = String(API_BASE_URL || "").replace(/\/$/, "");
    const params = new URLSearchParams();
    const path = String(p).startsWith("/") ? String(p) : `/${p}`;
    params.set("file_path", path);
    return `${base}/Account/AccountStoredFileView?${params.toString()}`;
  };

  // 파일 확장자와 MIME 타입을 기준으로 공통 미리보기 형식을 구분하는 함수
  const getPreviewKind = (value) => {
    const mimeType = typeof value === "object" ? String(value?.type || "").toLowerCase() : "";
    const extension = getExt(typeof value === "object" ? value?.name : value);

    if (mimeType.includes("pdf") || extension === "pdf") return "pdf";
    if (mimeType.includes("spreadsheet") || ["xls", "xlsx"].includes(extension)) return "excel";
    return "image";
  };

  const clearPreviewObjectUrl = useCallback(() => {
    if (!previewObjectUrlRef.current) return;
    URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = "";
  }, []);

  // 선택한 문서를 공통 미리보기 오버레이로 표시하는 함수
  const handlePreview = (value) => {
    if (!value) return;

    clearPreviewObjectUrl();

    if (typeof value === "object") {
      const url = URL.createObjectURL(value);
      previewObjectUrlRef.current = url;
      setPreviewFiles([
        {
          url,
          name: value.name || "첨부파일",
          kind: getPreviewKind(value),
        },
      ]);
    } else {
      const fileName = String(value).split("/").pop() || "첨부파일";
      setPreviewFiles([
        {
          url: toPreviewUrl(value),
          name: fileName,
          kind: getPreviewKind(value),
          path: value,
        },
      ]);
    }
    setPreviewIndex(0);
  };

  const handleClosePreview = useCallback(() => {
    setPreviewFiles([]);
    setPreviewIndex(0);
    clearPreviewObjectUrl();
  }, [clearPreviewObjectUrl]);

  useEffect(() => () => clearPreviewObjectUrl(), [clearPreviewObjectUrl]);

  // ✅ 문서종류 1행의 실제 높이(px) — 이름/직급을 그룹 전체 높이 기준으로 정가운데 정렬할 때 씀
  //    (td padding 위/아래 + 테두리 위/아래 + 날짜 인풋 높이를 그대로 더한 값)
  const ROW_HEIGHT_PX = isMobile ? 28 + 3 * 2 + 1 * 2 : 30 + 4 * 2 + 1 * 2;

  // ✅ td 꽉 차는 입력 UI 스타일
  const inputLikeStyle = (color) => ({
    width: "100%",
    height: isMobile ? 28 : 30,
    boxSizing: "border-box",
    padding: "0 6px",
    fontSize: isMobile ? 10 : 12,
    border: "1px solid #cfcfcf",
    borderRadius: 4,
    background: "#fff",
    outline: "none",
    color,
  });

  // ✅ 저장 — 회원 × 문서종류 조합 중 변경된 것만 모아서 전송
  const handleSave = async () => {
    try {
      const userId = localStorage.getItem("user_id");

      // 변경된 (rowIndex, docType) 조합 수집
      const changedEntries = [];
      rows.forEach((row, rowIndex) => {
        DOC_TYPES.forEach((t) => {
          if (!isDocTypeApplicable(row.position, t.value)) return;

          const currentDoc = row.docs?.[t.value] || emptyDoc();
          const originalDoc = originalRows[rowIndex]?.docs?.[t.value] || emptyDoc();

          const isChanged = Object.keys(emptyDoc()).some((field) => {
            const a = toCompare(field, originalDoc[field]);
            const b = toCompare(field, currentDoc[field]);
            return a !== b;
          });

          if (isChanged) {
            changedEntries.push({ row, typeValue: t.value, doc: currentDoc });
          }
        });
      });

      if (changedEntries.length === 0) {
        Swal.fire("안내", "변경된 내용이 없습니다.", "info");
        return;
      }

      const modifiedRows = await Promise.all(
        changedEntries.map(async ({ row, typeValue, doc }) => {
          let filePath = doc.file_path;

          if (filePath && typeof filePath === "object") {
            const uploadedPath = await uploadImage(filePath, row.member_id, selectedAccountId);
            filePath = uploadedPath || "";
          }

          return {
            member_id: row.member_id,
            doc_type_id: typeValue,
            file_path: filePath,
            issue_dt: doc.issue_dt,
            expiry_dt: doc.expiry_dt,
            note: doc.note,
            account_id: selectedAccountId,
            user_id: userId,
          };
        })
      );

      const payload = modifiedRows.filter(Boolean);

      const res = await api.post(`/Operate/AccountMembersFilesSave`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.data?.code === 200) {
        Swal.fire("저장 완료", "성공적으로 저장되었습니다.", "success");
        await fetcMembersFilesList(selectedAccountId);
      } else {
        Swal.fire("오류", res.data?.message || "저장 실패", "error");
      }
    } catch (err) {
      Swal.fire("오류", "저장 중 오류가 발생했습니다.", "error");
      console.error(err);
    }
  };

  // ✅ 테이블 셀 공통 스타일
  const sharedCellSx = {
    "& table": {
      borderCollapse: "separate",
      tableLayout: "fixed",
      width: "100%",
      minWidth: isMobile ? "700px" : "auto",
      borderSpacing: 0,
    },
    "& th, & td": {
      border: "1px solid #686D76",
      textAlign: "center",
      padding: isMobile ? "3px" : "4px",
      fontSize: isMobile ? "10px" : "12px",
      verticalAlign: "middle",
    },
  };

  // ✅ 헤더+본문을 한 스크롤 박스 안에 같이 둬서, 스크롤바가 헤더 옆까지 이어지게 함
  const scrollBoxSx = {
    ...sharedCellSx,
    flex: 1,
    maxHeight: isMobile ? "55vh" : "75vh",
    overflowX: "auto",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  };

  // ✅ 헤더 테이블을 감싸는 div — 여기에 sticky를 줌(th/thead에는 안 줌)
  //    sticky를 테이블 셀에 직접 주면 스크롤 중 테두리가 떨리거나 아래 행이 위로 비쳐
  //    보이는 브라우저 렌더링 버그가 있어, 감싸는 일반 div(MDBox)에 줘서 회피함
  const stickyHeaderWrapSx = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#ffffff",
    "& th": {
      backgroundColor: "#f0f0f0",
    },
  };

  const fileIconSx = { color: "#1e88e5" };

  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 */}
      <MDBox
        pt={1}
        pb={1}
        sx={{
          display: "flex",
          justifyContent: isMobile ? "space-between" : "flex-end",
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
          gap: isMobile ? 1 : 2,
          // 모바일에서는 검색/버튼 영역도 본문과 함께 스크롤
          position: isMobile ? "static" : "sticky",
          zIndex: isMobile ? "auto" : 10,
          top: isMobile ? "auto" : 78,
          backgroundColor: "#ffffff",
        }}
      >
        {/* ✅ 거래처 Select → 검색 가능한 Autocomplete (로그인 업장이 있으면 고정되어 비활성화) */}
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={accountOptions}
          value={selectedAccountOption}
          disabled={isAccountLocked}
          onChange={(_, opt) => {
            if (isAccountLocked) return;
            // 입력 비움 시 거래처 선택 유지
            if (!opt) return;
            setSelectedAccountId(opt.value);
          }}
          inputValue={accountInput}
          onInputChange={(_, newValue) => {
            if (isAccountLocked) return;
            setAccountInput(newValue);
          }}
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
              label={isAccountLocked ? "거래처(고정)" : "거래처 검색"}
              placeholder={isAccountLocked ? "거래처가 고정되어 있습니다" : "거래처명을 입력"}
              onKeyDown={(e) => {
                if (isAccountLocked) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  selectAccountByInput();
                }
              }}
              sx={{
                "& .MuiInputBase-root": { height: 35, fontSize: 12 },
                  "& .MuiInputLabel-root": { fontSize: 12 },
                "& input": { paddingLeft: "8px", paddingTop: 0, paddingBottom: 0, lineHeight: 1 },
              }}
            />
          )}
        />

        <MDButton
          color="info"
          onClick={handleSave}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            minWidth: isMobile ? 80 : 100,
          }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* 헤더+본문을 한 스크롤 박스 안에 같이 둬서 스크롤바가 헤더 옆까지 이어지게 함 */}
      <MDBox pt={1} pb={3} sx={scrollBoxSx}>
        {/* 헤더 — 이 박스 안에서 div(sticky)로 고정, 테이블 셀에는 sticky를 안 줌 */}
        <MDBox sx={stickyHeaderWrapSx}>
          <table>
            <colgroup>
              {COLUMN_WIDTHS.map((w, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <col key={i} style={w ? { width: w } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>이름</th>
                <th>직급</th>
                <th>문서종류</th>
                <th>발급일</th>
                <th>만료일</th>
                <th>파일</th>
                <th>비고</th>
              </tr>
            </thead>
          </table>
        </MDBox>

        <table>
          <colgroup>
            {COLUMN_WIDTHS.map((w, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <col key={i} style={w ? { width: w } : undefined} />
            ))}
          </colgroup>
          <tbody>
            {pagedRows.map((row, localIndex) => {
              // ✅ 페이지 안에서의 인덱스가 아니라 rows/originalRows 전체 배열 기준 인덱스를 써야
              //    handleDocFieldChange/getCellStyle이 엉뚱한 회원을 고치지 않는다
              const rowIndex = page * MEMBERS_PER_PAGE + localIndex;
              // ✅ 이 회원의 직급에서 실제로 적용되는 문서종류만 (보수교육은 영양사만)
              const applicableTypes = DOC_TYPES.filter((t) =>
                isDocTypeApplicable(row.position, t.value)
              );

              return applicableTypes.map((t, typeIdx) => {
                const doc = row.docs?.[t.value] || emptyDoc();
                const hasImage = !!doc.file_path;
                const inputId = `upload-${t.value}-${rowIndex}`;
                const isFirstType = typeIdx === 0;
                const isLastType = typeIdx === applicableTypes.length - 1;
                // ✅ 이름/직급 — rowSpan을 쓰면 스크롤 중 같은 그룹의 다른 행이 헤더 위로
                //    잘못 그려지는 브라우저 렌더링 버그가 (sticky를 어디에 주든) 반복돼서 못 씀.
                //    대신 위/아래 테두리만 지워 시각적으로 병합하고, 첫 행의 셀 안에 그룹 전체
                //    높이(ROW_HEIGHT_PX × 행수)만큼의 절대위치 박스를 깔아 그 안에서 진짜
                //    가운데 정렬한다(홀/짝수 행 수 상관없이 정확히 중앙에 옴)
                const mergedCellStyle = {
                  width: 80,
                  color: "black",
                  position: "relative",
                  borderTop: isFirstType ? undefined : "none",
                  borderBottom: isLastType ? undefined : "none",
                };
                const groupOverlaySx = {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT_PX * applicableTypes.length,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  pointerEvents: "none",
                };

                return (
                  <tr key={`${row.member_id || rowIndex}-${t.value}`}>
                    <td style={mergedCellStyle}>
                      {isFirstType && <div style={groupOverlaySx}>{row.name}</div>}
                    </td>
                    <td style={mergedCellStyle}>
                      {isFirstType && <div style={groupOverlaySx}>{row.position}</div>}
                    </td>

                    {/* 문서종류 — 행 자체가 고정이므로 라벨만 표시 */}
                    <td style={{ width: 70, color: "black" }}>{t.label}</td>

                    {/* 발급일 */}
                    <td
                      style={{
                        width: 110,
                        ...getCellStyle(rowIndex, t.value, "issue_dt", doc.issue_dt),
                      }}
                    >
                      <input
                        type="date"
                        value={String(doc.issue_dt || "")}
                        onChange={(e) =>
                          handleDocFieldChange(rowIndex, t.value, "issue_dt", e.target.value)
                        }
                        style={inputLikeStyle(
                          getCellStyle(rowIndex, t.value, "issue_dt", doc.issue_dt).color
                        )}
                      />
                    </td>

                    {/* 만료일 */}
                    <td
                      style={{
                        width: 110,
                        ...getCellStyle(rowIndex, t.value, "expiry_dt", doc.expiry_dt),
                      }}
                    >
                      <input
                        type="date"
                        value={String(doc.expiry_dt || "")}
                        onChange={(e) =>
                          handleDocFieldChange(rowIndex, t.value, "expiry_dt", e.target.value)
                        }
                        style={inputLikeStyle(
                          getCellStyle(rowIndex, t.value, "expiry_dt", doc.expiry_dt).color
                        )}
                      />
                    </td>

                    {/* 파일 — 새로 고른 파일(저장 전)이면 dirty로 보고 재업로드/미리보기를 빨간색으로 강조 */}
                    <td style={{ width: 90, verticalAlign: "middle" }}>
                      {(() => {
                        const isFileDirty =
                          getCellStyle(rowIndex, t.value, "file_path", doc.file_path).color === "red";
                        const dirtyIconSx = { color: isFileDirty ? "#d32f2f" : "#1e88e5" };

                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              flexWrap: isMobile ? "wrap" : "nowrap",
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              id={inputId}
                              style={{ display: "none" }}
                              onChange={(e) =>
                                handleDocFieldChange(
                                  rowIndex,
                                  t.value,
                                  "file_path",
                                  e.target.files?.[0]
                                )
                              }
                            />

                            {/* 다운로드 — 서버에 이미 저장된 파일(string 경로)일 때만 노출 */}
                            {hasImage && typeof doc.file_path === "string" && (
                              <Tooltip title="다운로드">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownload(doc.file_path)}
                                  sx={fileIconSx}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* 미리보기 — 저장 전 새 파일이면 빨간색으로 저장 필요함을 표시 */}
                            {hasImage && (
                              <Tooltip title="미리보기">
                                <IconButton
                                  size="small"
                                  onClick={() => handlePreview(doc.file_path)}
                                  sx={dirtyIconSx}
                                >
                                  <ImageSearchIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* 재업로드/업로드 — 파일이 있어도 교체할 수 있게 항상 노출 */}
                            <label htmlFor={inputId}>
                              <MDButton
                                size="small"
                                color={isFileDirty ? "error" : "info"}
                                component="span"
                                sx={{
                                  fontSize: isMobile ? "10px" : "12px",
                                  minWidth: isMobile ? 60 : 80,
                                }}
                              >
                                {hasImage ? "재업로드" : "업로드"}
                              </MDButton>
                            </label>
                          </div>
                        );
                      })()}
                    </td>

                    {/* 비고 — 문서종류별로 각자 저장 */}
                    <td
                      style={{
                        width: 250,
                        ...getCellStyle(rowIndex, t.value, "note", doc.note),
                      }}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        handleDocFieldChange(rowIndex, t.value, "note", e.currentTarget.innerText)
                      }
                    >
                      {doc.note}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </MDBox>

      {/* ✅ 페이징 — 회원 단위(10명씩)로 이전/다음, 총 인원수 표시 */}
      {rows.length > 0 && (
        <MDBox
          pt={1}
          pb={1}
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: isMobile ? 1 : 2,
          }}
        >
          <MDButton
            size="small"
            color="info"
            variant="outlined"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            sx={{ fontSize: isMobile ? "10px" : "12px", minWidth: isMobile ? 50 : 70 }}
          >
            이전
          </MDButton>

          <MDBox component="span" sx={{ fontSize: isMobile ? "11px" : "13px", color: "#555" }}>
            {page + 1} / {totalPages} 페이지 (전체 {rows.length}명)
          </MDBox>

          <MDButton
            size="small"
            color="info"
            variant="outlined"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            sx={{ fontSize: isMobile ? "10px" : "12px", minWidth: isMobile ? 50 : 70 }}
          >
            다음
          </MDButton>
        </MDBox>
      )}

      {/* 구성원 문서 공통 미리보기 오버레이 */}
      <PreviewOverlay
        open={previewFiles.length > 0}
        files={previewFiles}
        currentIndex={previewIndex}
        onChangeIndex={setPreviewIndex}
        onClose={handleClosePreview}
      />
    </>
  );
}

export default AccountMembersFilesTab;
