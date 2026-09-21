// ✅ src/examples/Tabs/Operate/AccountMembersFilesTab.js
// FieldBoard/AccountMembersFilesTab.js(현장 화면, 거래처 고정)와 같은 백엔드를 쓰는
// 운영자용 화면 — 거래처를 고정하지 않고 전체 거래처 중 검색/선택해서 관리한다.
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { TextField, useTheme, useMediaQuery, IconButton, Tooltip, Autocomplete } from "@mui/material";
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
const COLUMN_WIDTHS = ["10%", "10%", "9%", "14%", "14%", "11%", "32%"];

// ✅ 페이지당 회원 수 — 회원 단위로 페이징(문서종류별로 3~4행을 쓰기 때문)
const MEMBERS_PER_PAGE = 4;

// ✅ 거래처 검색 Autocomplete — 다른 Operate 탭(PropertySheetTab 등)과 동일한 패턴.
//    inputValue를 내부에서 selectedAccountOption과 동기화해서, 거래처를 바꿔도 검색창 표시가 어긋나지 않게 함
const AccountSearchAutocomplete = React.memo(function AccountSearchAutocomplete({
  accountOptions,
  selectedAccountOption,
  onSelectAccount,
}) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const nextLabel = String(selectedAccountOption?.label || "");
    setInputValue((prev) => (prev === nextLabel ? prev : nextLabel));
  }, [selectedAccountOption]);

  const selectAccountByInput = useCallback(() => {
    const q = String(inputValue || "").trim().toLowerCase();
    if (!q) return;
    const exact = accountOptions.find((o) => String(o?.label || "").toLowerCase() === q);
    const partial =
      exact || accountOptions.find((o) => String(o?.label || "").toLowerCase().includes(q));
    if (!partial) return;
    onSelectAccount(partial.value);
    setInputValue(partial.label || q);
  }, [accountOptions, inputValue, onSelectAccount]);

  return (
    <Autocomplete
      size="small"
      sx={{ minWidth: 200 }}
      options={accountOptions}
      value={selectedAccountOption}
      onChange={(_, opt) => {
        if (!opt) return;
        onSelectAccount(opt.value);
        setInputValue(opt.label || "");
      }}
      inputValue={inputValue}
      onInputChange={(_, newValue) => setInputValue(newValue)}
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
            "& .MuiInputLabel-root": { fontSize: 12 },
            "& input": { paddingLeft: "8px", paddingTop: 0, paddingBottom: 0, lineHeight: 1 },
          }}
        />
      )}
    />
  );
});

AccountSearchAutocomplete.propTypes = {
  accountOptions: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })
  ).isRequired,
  selectedAccountOption: PropTypes.shape({ value: PropTypes.string, label: PropTypes.string }),
  onSelectAccount: PropTypes.func.isRequired,
};

AccountSearchAutocomplete.defaultProps = {
  selectedAccountOption: null,
};

function AccountMembersFilesTab() {
  const { membersFilesListRows, accountList, loading, fetcMembersFilesList } =
    useMembersFilesData();

  const [selectedAccountId, setSelectedAccountId] = useState("");
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

  // ✅ 거래처 옵션(Autocomplete) — 운영자 화면은 거래처 고정 없이 전체를 검색/선택
  const accountOptions = useMemo(
    () => (accountList || []).map((acc) => ({ value: String(acc.account_id), label: acc.account_name })),
    [accountList]
  );

  const selectedAccountOption = useMemo(() => {
    const v = String(selectedAccountId ?? "");
    return accountOptions.find((o) => o.value === v) || null;
  }, [accountOptions, selectedAccountId]);

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

  // ✅ 최초 진입 시 거래처 목록 첫 번째를 기본 선택
  useEffect(() => {
    if ((accountList || []).length === 0) return;
    if (!selectedAccountId) setSelectedAccountId(String(accountList[0].account_id));
  }, [accountList, selectedAccountId]);

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
    //    취급해야 신규 업로드/입력이 dirty(빨간색)로 잡힌다.
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
          docs: { ...row.docs, [typeValue]: { ...currentDoc, [field]: value } },
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
      setPreviewFiles([{ url, name: value.name || "첨부파일", kind: getPreviewKind(value) }]);
    } else {
      const fileName = String(value).split("/").pop() || "첨부파일";
      setPreviewFiles([{ url: toPreviewUrl(value), name: fileName, kind: getPreviewKind(value), path: value }]);
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

          if (isChanged) changedEntries.push({ row, typeValue: t.value, doc: currentDoc });
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
  const stickyHeaderWrapSx = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#ffffff",
    "& th": { backgroundColor: "#f0f0f0" },
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
          position: isMobile ? "static" : "sticky",
          zIndex: isMobile ? "auto" : 10,
          top: isMobile ? "auto" : 78,
          backgroundColor: "#ffffff",
        }}
      >
        <AccountSearchAutocomplete
          accountOptions={accountOptions}
          selectedAccountOption={selectedAccountOption}
          onSelectAccount={setSelectedAccountId}
        />

        <MDButton
          color="info"
          onClick={handleSave}
          sx={{ fontSize: isMobile ? "11px" : "13px", minWidth: isMobile ? 80 : 100 }}
        >
          저장
        </MDButton>
      </MDBox>

      {/* 헤더+본문을 한 스크롤 박스 안에 같이 둬서 스크롤바가 헤더 옆까지 이어지게 함 */}
      <MDBox pt={1} pb={3} sx={scrollBoxSx}>
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
              const rowIndex = page * MEMBERS_PER_PAGE + localIndex;
              const applicableTypes = DOC_TYPES.filter((t) => isDocTypeApplicable(row.position, t.value));

              return applicableTypes.map((t, typeIdx) => {
                const doc = row.docs?.[t.value] || emptyDoc();
                const hasImage = !!doc.file_path;
                const inputId = `upload-${t.value}-${rowIndex}`;
                const isFirstType = typeIdx === 0;
                const isLastType = typeIdx === applicableTypes.length - 1;
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

                    <td style={{ width: 70, color: "black" }}>{t.label}</td>

                    <td
                      style={{
                        width: 110,
                        ...getCellStyle(rowIndex, t.value, "issue_dt", doc.issue_dt),
                      }}
                    >
                      <input
                        type="date"
                        value={String(doc.issue_dt || "")}
                        onChange={(e) => handleDocFieldChange(rowIndex, t.value, "issue_dt", e.target.value)}
                        style={inputLikeStyle(
                          getCellStyle(rowIndex, t.value, "issue_dt", doc.issue_dt).color
                        )}
                      />
                    </td>

                    <td
                      style={{
                        width: 110,
                        ...getCellStyle(rowIndex, t.value, "expiry_dt", doc.expiry_dt),
                      }}
                    >
                      <input
                        type="date"
                        value={String(doc.expiry_dt || "")}
                        onChange={(e) => handleDocFieldChange(rowIndex, t.value, "expiry_dt", e.target.value)}
                        style={inputLikeStyle(
                          getCellStyle(rowIndex, t.value, "expiry_dt", doc.expiry_dt).color
                        )}
                      />
                    </td>

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
                                handleDocFieldChange(rowIndex, t.value, "file_path", e.target.files?.[0])
                              }
                            />

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

                            <label htmlFor={inputId}>
                              <MDButton
                                size="small"
                                color={isFileDirty ? "error" : "info"}
                                component="span"
                                sx={{ fontSize: isMobile ? "10px" : "12px", minWidth: isMobile ? 60 : 80 }}
                              >
                                {hasImage ? "재업로드" : "업로드"}
                              </MDButton>
                            </label>
                          </div>
                        );
                      })()}
                    </td>

                    <td
                      style={{ width: 250, ...getCellStyle(rowIndex, t.value, "note", doc.note) }}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleDocFieldChange(rowIndex, t.value, "note", e.currentTarget.innerText)}
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

      {/* ✅ 페이징 — 회원 단위로 이전/다음, 총 인원수 표시 */}
      {rows.length > 0 && (
        <MDBox
          pt={1}
          pb={1}
          sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: isMobile ? 1 : 2 }}
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
