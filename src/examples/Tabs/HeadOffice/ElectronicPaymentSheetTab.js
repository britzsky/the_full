// src/layouts/handover/ElectronicPaymentSheetTab.js
/* eslint-disable react/function-component-definition */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { TextField, useTheme, useMediaQuery, Modal, Box } from "@mui/material";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import Swal from "sweetalert2";
import dayjs from "dayjs";
import api from "api/api";
import LoadingScreen from "layouts/loading/loadingscreen";
import logo from "assets/images/the-full-logo2.png";
import useElectronicPaymentSheetData from "./electronicPaymentSheetData";
import PropTypes from "prop-types";

const STATUS_OPTIONS = [
  { v: "", t: "선택" },
  { v: "2", t: "검토" },
  { v: "3", t: "반려" },
  { v: "4", t: "결재" },
];

// ✅ position 규칙
// 0이면 0,1 / 1이면 1 / 2면 2
const getRequiredRoles = (pos) => {
  if (pos === 0) return ["tm", "ceo"];
  if (pos === 1) return ["tm"];
  if (pos === 2) return ["payer"];
  return [];
};

export default function ElectronicPaymentSheetTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const loginUserId = useMemo(() => String(localStorage.getItem("user_id") || ""), []);

  const { docTypeList, loading, fetchDepartments, fetchUsersByDepartment, fetchCompanyTree } =
    useElectronicPaymentSheetData();

  const [docType, setDocType] = useState("");
  const selectedDocMeta = useMemo(
    () => (docTypeList || []).find((d) => String(d.doc_type) === String(docType)),
    [docTypeList, docType]
  );
  const requiredRoles = useMemo(
    () => getRequiredRoles(Number(selectedDocMeta?.position ?? -1)),
    [selectedDocMeta]
  );

  // ✅ 부서/작성자
  const [department, setDepartment] = useState("");
  const [departmentList, setDepartmentList] = useState([]);
  const [writerId, setWriterId] = useState("");
  const [writerList, setWriterList] = useState([]);

  const writerName = useMemo(() => {
    const u = (writerList || []).find((x) => String(x.user_id) === String(writerId));
    return u?.user_name || "";
  }, [writerList, writerId]);

  // ✅ 기안일자
  const [draftDt, setDraftDt] = useState(() => dayjs().format("YYYY-MM-DDTHH:mm:ss"));

  // ✅ 요청사유
  const [paymentNote, setPaymentNote] = useState("");

  // ✅ 품목내역
  const [items, setItems] = useState(() =>
    Array.from({ length: 15 }).map((_, i) => ({
      no: i + 1,
      item_name: "",
      qty: "",
      price: "",
      use_note: "",
      link: "",
      note: "",
    }))
  );

  // ✅ 결재라인(실제 값은 user_id)
  const [approvalLine, setApprovalLine] = useState({
    tm_user: "",
    tm_user_name: "",
    payer_user: "",
    payer_user_name: "",
    ceo_user: "",
    ceo_user_name: "",
  });

  // ✅ 결재 상태(status)
  const [status, setStatus] = useState({
    tm_status: "",
    payer_status: "",
    ceo_status: "",
  });

  // ✅ 요청번호
  const requestNo = useMemo(() => {
    if (!docType) return "";
    const d = dayjs(draftDt);
    if (!d.isValid()) return `${docType}-`;
    return `${docType}-${d.format("YYYYMMDDHHmmss")}00`;
  }, [docType, draftDt]);

  // ✅ 부서 목록 로드
  useEffect(() => {
    (async () => {
      const deps = await fetchDepartments();
      setDepartmentList(deps || []);
    })();
  }, [fetchDepartments]);

  // ✅ 부서가 바뀌면 작성자 목록 로드 + tm_user 자동 설정(부서의 position==1인 사람)
  useEffect(() => {
    (async () => {
      if (!department) {
        setWriterList([]);
        setWriterId("");
        setApprovalLine((prev) => ({
          ...prev,
          tm_user: "",
          tm_user_name: "",
        }));
        return;
      }

      const users = await fetchUsersByDepartment(department);
      setWriterList(users || []);

      // 작성자 자동 선택(첫번째)
      if ((users || []).length > 0) setWriterId(String(users[0].user_id));
      else setWriterId("");

      // ✅ tm_user 자동: department 내 position==1인 사람(팀장)
      const tm = (users || []).find((u) => Number(u.position) === 1);
      if (tm) {
        setApprovalLine((prev) => ({
          ...prev,
          tm_user: String(tm.user_id),
          tm_user_name: String(tm.user_name),
        }));
      } else {
        setApprovalLine((prev) => ({ ...prev, tm_user: "", tm_user_name: "" }));
      }
    })();
  }, [department, fetchUsersByDepartment]);

  // ✅ docType이 position==0(대표 필요)이면 ceo 자동 세팅(회사 트리에서 position==0 찾기)
  useEffect(() => {
    (async () => {
      const needCeo = requiredRoles.includes("ceo");
      if (!needCeo) {
        // 대표 필요 없으면 값 비움
        setApprovalLine((prev) => ({ ...prev, ceo_user: "", ceo_user_name: "" }));
        setStatus((prev) => ({ ...prev, ceo_status: "" }));
        return;
      }

      // 이미 들어있으면 유지
      if (approvalLine.ceo_user) return;

      const tree = await fetchCompanyTree();
      let found = null;

      for (const dept of tree || []) {
        const users = dept.users || dept.user_list || [];
        const ceo = (users || []).find((u) => Number(u.position ?? u.pos ?? 99) === 0);
        if (ceo) {
          found = {
            user_id: String(ceo.user_id ?? ceo.id ?? ""),
            user_name: String(ceo.user_name ?? ceo.name ?? ""),
          };
          break;
        }
      }

      if (found?.user_id) {
        setApprovalLine((prev) => ({
          ...prev,
          ceo_user: found.user_id,
          ceo_user_name: found.user_name,
        }));
      }
    })();
  }, [requiredRoles, fetchCompanyTree, approvalLine.ceo_user]);

  const onChangeItem = (idx, key) => (e) => {
    const value = e.target.value;
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const openLink = useCallback((url) => {
    if (!url) return;
    const trimmed = String(url).trim();
    if (!trimmed) return;

    const finalUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;

    window.open(finalUrl, "_blank", "noopener,noreferrer");
  }, []);

  // ✅ 결재라인 추가 모달(payer_user만 선택)
  const [openLineModal, setOpenLineModal] = useState(false);
  const [companyTree, setCompanyTree] = useState([]);
  const [selectedPayer, setSelectedPayer] = useState({ user_id: "", user_name: "", dept: "" });

  const openApprovalModal = async () => {
    const tree = await fetchCompanyTree();
    setCompanyTree(tree || []);
    setSelectedPayer({
      user_id: approvalLine.payer_user || "",
      user_name: approvalLine.payer_user_name || "",
      dept: "",
    });
    setOpenLineModal(true);
  };

  const saveApprovalLine = () => {
    if (!selectedPayer.user_id) {
      Swal.fire({ title: "확인", text: "처리부서 팀장을 선택해주세요.", icon: "warning" });
      return;
    }

    setApprovalLine((prev) => ({
      ...prev,
      payer_user: String(selectedPayer.user_id),
      payer_user_name: String(selectedPayer.user_name),
    }));

    // payer가 바뀌면 payer_status 초기화(원하면 유지도 가능)
    setStatus((prev) => ({ ...prev, payer_status: "" }));
    setOpenLineModal(false);
  };

  // ✅ status 변경(권한 체크 포함)
  const setRoleStatus = (roleKey, value) => {
    setStatus((prev) => ({ ...prev, [roleKey]: value }));
  };

  const canSignTM = useMemo(
    () => approvalLine.tm_user && loginUserId === String(approvalLine.tm_user),
    [approvalLine.tm_user, loginUserId]
  );
  const canSignPayer = useMemo(
    () => approvalLine.payer_user && loginUserId === String(approvalLine.payer_user),
    [approvalLine.payer_user, loginUserId]
  );
  const canSignCeo = useMemo(
    () => approvalLine.ceo_user && loginUserId === String(approvalLine.ceo_user),
    [approvalLine.ceo_user, loginUserId]
  );

  // ✅ 저장 payload: main / item 분리
  const handleSave = async () => {
    if (!docType) {
      Swal.fire({ title: "확인", text: "문서 타입을 선택해주세요.", icon: "warning" });
      return;
    }
    if (!department) {
      Swal.fire({ title: "확인", text: "부서를 선택해주세요.", icon: "warning" });
      return;
    }
    if (!writerId) {
      Swal.fire({ title: "확인", text: "작성자를 선택해주세요.", icon: "warning" });
      return;
    }

    // ✅ 필요한 결재라인 존재 체크
    if (requiredRoles.includes("tm") && !approvalLine.tm_user) {
      Swal.fire({
        title: "확인",
        text: "부서 팀장(tm_user)이 자동 지정되지 않았습니다.",
        icon: "warning",
      });
      return;
    }
    if (requiredRoles.includes("payer") && !approvalLine.payer_user) {
      Swal.fire({
        title: "확인",
        text: "결재라인 추가에서 처리부서 팀장(payer_user)을 지정해주세요.",
        icon: "warning",
      });
      return;
    }
    if (requiredRoles.includes("ceo") && !approvalLine.ceo_user) {
      Swal.fire({
        title: "확인",
        text: "대표(ceo_user)가 자동 지정되지 않았습니다.",
        icon: "warning",
      });
      return;
    }

    const clean = (v) => String(v ?? "").trim();

    const filteredItems = (items || [])
      .map((r) => ({
        no: r.no,
        item_name: clean(r.item_name),
        qty: clean(r.qty),
        price: clean(r.price),
        use_note: clean(r.use_note),
        link: clean(r.link),
        note: clean(r.note),
      }))
      // ✅ 여기! (map 다음, payload 넣기 전)
      .filter((r) => r.item_name !== "");
    // ✅ 한 칸이라도 입력됐으면 통과
    // .filter((r) =>
    //   [r.item_name, r.qty, r.price, r.use_note, r.link, r.note].some((v) => v !== "")
    // );

    const payload = {
      main: {
        doc_type: docType,
        doc_position: Number(selectedDocMeta?.position ?? -1),
        request_no: requestNo,

        department,
        user_id: writerId, // 작성자 user_id
        draft_dt: dayjs(draftDt).format("YYYY-MM-DD HH:mm:ss"),
        payment_note: paymentNote,

        // ✅ 결재라인(실제 값 user_id)
        tm_user: approvalLine.tm_user,
        payer_user: approvalLine.payer_user,
        ceo_user: approvalLine.ceo_user,

        // ✅ status
        tm_status: status.tm_status,
        payer_status: status.payer_status,
        ceo_status: status.ceo_status,

        reg_user_id: localStorage.getItem("user_id") || "",
      },
      item: filteredItems,
    };

    try {
      await api.post("/Operate/ElectronicPaymentSave", payload);

      Swal.fire({
        title: "저장",
        text: "저장되었습니다.",
        icon: "success",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    } catch (err) {
      Swal.fire({
        title: "실패",
        text: err?.message || "저장 중 오류 발생",
        icon: "error",
        confirmButtonColor: "#d33",
        confirmButtonText: "확인",
      });
    }
  };

  if (loading) return <LoadingScreen />;

  const renderByDocType = () => {
    if (docType === "e") return renderSuppliesPurchaseForm();
    if (!docType) return renderEmptyState("문서 타입을 선택하면 화면이 표시됩니다.");
    return renderEmptyState(`"${docType}" 타입 화면은 아직 템플릿이 없습니다. (추가 예정)`);
  };

  const renderEmptyState = (msg) => (
    <MDBox p={1} sx={{ border: "1px dashed #bbb", borderRadius: 2, background: "#fafafa" }}>
      {msg}
    </MDBox>
  );

  const renderStampOrStatus = (name, st) => {
    if (String(st) === "4") return <Stamp name={name} />;
    if (String(st) === "2") return <StatusBadge text="검토" />;
    if (String(st) === "3") return <StatusBadge text="반려" />;
    return <StatusBadge text="-" />;
  };

  const renderStatusSelect = (value, onChange, disabled) => (
    <TextField
      select
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      SelectProps={{ native: true }}
      disabled={disabled}
      fullWidth
      sx={inputSx(isMobile)}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.v} value={o.v}>
          {o.t}
        </option>
      ))}
    </TextField>
  );

  const needTM = requiredRoles.includes("tm");
  const needPayer = requiredRoles.includes("payer");
  const needCeo = requiredRoles.includes("ceo");

  const renderRoleCell = ({ need, canSign, userName, stValue, stKey, width, hideWhenNotNeed }) => {
    // ✅ 대표처럼 "칸은 유지 + 내용만 숨김" 옵션
    if (!need && hideWhenNotNeed) {
      return (
        <td style={{ ...tdCellCenter, width, visibility: "hidden", pointerEvents: "none" }}>
          <div>hidden</div>
        </td>
      );
    }

    // 필요 없으면: 사용안함(칸은 유지)
    if (!need) {
      return (
        <td style={{ ...tdCellCenter, width }}>
          <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5, opacity: 0.6 }}>
            <MDBox sx={{ fontSize: 11, fontWeight: 700 }}>{userName || "-"}</MDBox>
            <StatusBadge text="사용안함" />
          </MDBox>
        </td>
      );
    }

    // 필요하면 정상 렌더
    return (
      <td style={{ ...tdCellCenter, width }}>
        <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <MDBox sx={{ fontSize: 11, fontWeight: 700 }}>{userName || "-"}</MDBox>

          {renderStatusSelect(stValue, (v) => setRoleStatus(stKey, v), !canSign)}

          <MDBox>{renderStampOrStatus(userName, stValue)}</MDBox>
        </MDBox>
      </td>
    );
  };

  renderRoleCell.propTypes = {
    need: PropTypes.bool,
    canSign: PropTypes.bool,
    userName: PropTypes.string,
    stValue: PropTypes.string,
    stKey: PropTypes.string,
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hideWhenNotNeed: PropTypes.bool,
  };

  const renderSuppliesPurchaseForm = () => {
    return (
      <MDBox sx={sheetWrapSx(isMobile)}>
        {/* 헤더 */}
        <MDBox sx={headerBarSx}>
          <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <img src={logo} alt="logo" style={{ height: isMobile ? 24 : 30 }} />
          </MDBox>
          <MDBox sx={titleSx(isMobile)}>소모품 구매 품의서</MDBox>
          <MDBox sx={{ width: isMobile ? 90 : 110 }} />
        </MDBox>

        {/* 요청 정보 */}
        <MDBox sx={sectionSx}>
          <MDBox sx={sectionTitleSx}>요청 정보</MDBox>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={thCell}>부서</td>
                <td style={tdCell}>
                  <TextField
                    select
                    size="small"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    SelectProps={{ native: true }}
                    fullWidth
                    sx={inputSx(isMobile)}
                  >
                    <option value="" disabled>
                      선택
                    </option>
                    {(departmentList || []).map((d) => (
                      <option key={String(d.department)} value={String(d.department)}>
                        {String(d.dept_name)}
                      </option>
                    ))}
                  </TextField>
                </td>

                <td style={thCell}>작성자</td>
                <td style={tdCell}>
                  <TextField
                    select
                    size="small"
                    value={writerId}
                    onChange={(e) => setWriterId(e.target.value)}
                    SelectProps={{ native: true }}
                    fullWidth
                    sx={inputSx(isMobile)}
                    disabled={!department}
                  >
                    <option value="" disabled>
                      선택
                    </option>
                    {(writerList || []).map((u) => (
                      <option key={String(u.user_id)} value={String(u.user_id)}>
                        {String(u.user_name)}
                      </option>
                    ))}
                  </TextField>
                </td>

                <td style={thCell}>기안일자</td>
                <td style={tdCell}>
                  <TextField
                    type="datetime-local"
                    size="small"
                    value={draftDt}
                    onChange={(e) => setDraftDt(e.target.value)}
                    fullWidth
                    inputProps={{ step: 1 }}
                    sx={inputSx(isMobile)}
                  />
                </td>

                <td style={thCell}>요청번호</td>
                <td style={tdCell}>
                  <TextField
                    size="small"
                    value={requestNo}
                    fullWidth
                    sx={inputSx(isMobile)}
                    InputProps={{ readOnly: true }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </MDBox>

        {/* 품목 내역 */}
        <MDBox sx={sectionSx}>
          <MDBox sx={sectionTitleSx}>품목 내역</MDBox>
          <MDBox sx={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={th2Cell}>No</th>
                  <th style={th2Cell}>품목명</th>
                  <th style={th2Cell}>수량</th>
                  <th style={th2Cell}>금액(원)</th>
                  <th style={th2Cell}>사용처/용도</th>
                  <th style={th2Cell}>구매링크</th>
                  <th style={th2Cell}>비고</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={r.no}>
                    <td style={td2CellCenter}>{r.no}</td>

                    <td style={td2Cell}>
                      <TextField
                        size="small"
                        value={r.item_name}
                        onChange={onChangeItem(idx, "item_name")}
                        fullWidth
                        sx={gridInputSx(isMobile)}
                      />
                    </td>

                    <td style={td2Cell}>
                      <TextField
                        size="small"
                        value={r.qty}
                        onChange={onChangeItem(idx, "qty")}
                        fullWidth
                        sx={gridInputSx(isMobile)}
                      />
                    </td>

                    <td style={td2Cell}>
                      <TextField
                        size="small"
                        value={r.price}
                        onChange={onChangeItem(idx, "price")}
                        fullWidth
                        sx={gridInputSx(isMobile)}
                      />
                    </td>

                    <td style={td2Cell}>
                      <TextField
                        size="small"
                        value={r.use_note}
                        onChange={onChangeItem(idx, "use_note")}
                        fullWidth
                        sx={gridInputSx(isMobile)}
                      />
                    </td>

                    <td style={td2Cell}>
                      <MDBox sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        <TextField
                          size="small"
                          value={r.link}
                          onChange={onChangeItem(idx, "link")}
                          fullWidth
                          sx={gridInputSx(isMobile)}
                        />
                        <MDButton
                          variant="gradient"
                          color="info"
                          size="small"
                          disabled={!String(r.link || "").trim()}
                          onClick={() => openLink(r.link)}
                          sx={{
                            minWidth: isMobile ? 48 : 56,
                            px: 1,
                            fontSize: isMobile ? 10 : 11,
                          }}
                        >
                          열기
                        </MDButton>
                      </MDBox>
                    </td>

                    <td style={td2Cell}>
                      <TextField
                        size="small"
                        value={r.note}
                        onChange={onChangeItem(idx, "note")}
                        fullWidth
                        sx={gridInputSx(isMobile)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MDBox>
        </MDBox>

        {/* 요청 사유 */}
        <MDBox sx={sectionSx}>
          <MDBox sx={sectionTitleSx}>요청 사유</MDBox>
          <MDBox sx={{ p: 1 }}>
            <TextField
              multiline
              rows={3}
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              fullWidth
              sx={inputSx(isMobile)}
              placeholder="요청사유"
            />
          </MDBox>

          {/* ✅ 결재 라인(담당/팀장/부서장/대표) - position에 따라 표시 */}
          <MDBox sx={{ p: 1 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed", // ✅ 핵심: 칸 고정
              }}
            >
              <tbody>
                <tr>
                  <td style={{ ...thCell, width: 80 }} rowSpan={2}>
                    결재
                  </td>

                  <td style={{ ...thCell, width: "23%" }}>담당</td>
                  <td style={{ ...thCell, width: "23%" }}>팀장</td>
                  <td style={{ ...thCell, width: "23%" }}>결재자</td>
                  {/* 대표는 position===0일 때만 "표시" */}
                  <td
                    style={{
                      ...thCell,
                      width: "23%",
                      ...(needCeo ? {} : { visibility: "hidden" }),
                    }}
                  >
                    대표
                  </td>
                </tr>

                <tr>
                  {/* 담당 */}
                  <td style={{ ...tdCellCenter, width: "23%" }}>
                    <Stamp name={writerName || "작성자"} />
                  </td>

                  {/* 팀장 */}
                  {renderRoleCell({
                    need: needTM,
                    canSign: canSignTM,
                    userName: approvalLine.tm_user_name,
                    stValue: status.tm_status,
                    stKey: "tm_status",
                    width: "23%",
                  })}

                  {/* 부서장(처리부서 팀장) */}
                  {renderRoleCell({
                    need: needPayer,
                    canSign: canSignPayer,
                    userName: approvalLine.payer_user_name,
                    stValue: status.payer_status,
                    stKey: "payer_status",
                    width: "23%",
                  })}

                  {/* 대표: position===0일 때만 "보이게" (칸은 유지) */}
                  {renderRoleCell({
                    need: needCeo, // ✅ position==0일 때만 true
                    canSign: canSignCeo,
                    userName: approvalLine.ceo_user_name,
                    stValue: status.ceo_status,
                    stKey: "ceo_status",
                    width: "23%",
                    hideWhenNotNeed: true, // ✅ 내용 숨김 옵션
                  })}
                </tr>
              </tbody>
            </table>
          </MDBox>
        </MDBox>

        {/* ✅ 결재라인 추가 모달(처리부서 팀장 선택) */}
        <Modal open={openLineModal} onClose={() => setOpenLineModal(false)}>
          <Box sx={modalSx(isMobile)}>
            <MDBox sx={{ fontWeight: 800, mb: 1 }}>결재라인 추가 (처리부서 팀장 선택)</MDBox>

            <MDBox sx={{ display: "flex", gap: 2, flexDirection: isMobile ? "column" : "row" }}>
              {/* 왼쪽: 현재 선택 */}
              <MDBox sx={{ flex: 1, border: "1px solid #ddd", borderRadius: 2, p: 1 }}>
                <MDBox sx={{ fontWeight: 700, mb: 1 }}>payer_user</MDBox>
                <MDBox sx={{ fontSize: 13 }}>
                  {selectedPayer.user_name ? (
                    <>
                      <span style={{ fontWeight: 700 }}>{selectedPayer.user_name}</span>
                      <span style={{ marginLeft: 8, color: "#666" }}>
                        ({selectedPayer.user_id})
                      </span>
                    </>
                  ) : (
                    "선택 없음"
                  )}
                </MDBox>
                <MDBox sx={{ mt: 1, color: "#666", fontSize: 12 }}>
                  * doc position이 2일 때만 실제로 payer가 필요해요.
                </MDBox>
              </MDBox>

              {/* 오른쪽: 트리(간단 구현) */}
              <MDBox
                sx={{
                  flex: 2,
                  border: "1px solid #ddd",
                  borderRadius: 2,
                  p: 1,
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                {(companyTree || []).map((dept, i) => {
                  const deptName =
                    dept.dept_name ||
                    dept.department_name ||
                    dept.name ||
                    dept.department ||
                    "부서";
                  const users = dept.users || dept.user_list || [];
                  return (
                    <MDBox key={i} sx={{ mb: 1.5 }}>
                      <MDBox sx={{ fontWeight: 800, color: "#1f4e79", mb: 0.5 }}>{deptName}</MDBox>
                      <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {users.map((u, idx) => {
                          const uid = String(u.user_id ?? u.id ?? "");
                          const uname = String(u.user_name ?? u.name ?? "");
                          const posName = String(u.position_name ?? u.rank_name ?? "");
                          if (!uid || !uname) return null;

                          return (
                            <MDBox
                              key={idx}
                              onClick={() =>
                                setSelectedPayer({ user_id: uid, user_name: uname, dept: deptName })
                              }
                              sx={{
                                cursor: "pointer",
                                p: "6px 8px",
                                borderRadius: 1.5,
                                border:
                                  selectedPayer.user_id === uid
                                    ? "1px solid #1f4e79"
                                    : "1px solid transparent",
                                background: selectedPayer.user_id === uid ? "#e9f0fb" : "#f8f8f8",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>{uname}</span>
                              <span style={{ color: "#666", fontSize: 12 }}>
                                {posName || ""} {posName ? "· " : ""}
                                {uid}
                              </span>
                            </MDBox>
                          );
                        })}
                      </MDBox>
                    </MDBox>
                  );
                })}
              </MDBox>
            </MDBox>

            <MDBox sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
              <MDButton
                variant="outlined"
                color="secondary"
                onClick={() => setOpenLineModal(false)}
              >
                닫기
              </MDButton>
              <MDButton variant="gradient" color="info" onClick={saveApprovalLine}>
                저장
              </MDButton>
            </MDBox>
          </Box>
        </Modal>
      </MDBox>
    );
  };

  // ✅ 상단 바(문서 타입 셀렉트 + 버튼 + 결재라인 추가)
  return (
    <>
      <MDBox
        pt={1}
        pb={1}
        px={1}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          position: "sticky",
          top: 78,
          zIndex: 20,
          backgroundColor: "#fff",
        }}
      >
        <MDBox sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          {/* 문서 타입 select */}
          <TextField
            select
            size="small"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: isMobile ? 170 : 240 }}
          >
            <option value="" disabled>
              문서 선택
            </option>
            {(docTypeList || []).map((d) => (
              <option key={String(d.doc_type)} value={String(d.doc_type)}>
                {String(d.doc_name)}
              </option>
            ))}
          </TextField>

          {/* ✅ 결재라인 추가 (payer_user 선택) */}
          <MDButton
            variant="gradient"
            color="success"
            onClick={openApprovalModal}
            sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 120 : 150 }}
          >
            결재라인 추가
          </MDButton>
        </MDBox>

        <MDBox sx={{ display: "flex", gap: 1 }}>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 90 : 110 }}
          >
            저장
          </MDButton>
        </MDBox>
      </MDBox>

      {renderByDocType()}
    </>
  );
}

/* -------------------- 작은 컴포넌트 -------------------- */

function Stamp({ name }) {
  const n = String(name || "").trim() || "결재";
  return (
    <div
      style={{
        display: "inline-flex",
        width: 86,
        height: 56,
        borderRadius: 999,
        border: "2px solid #d32f2f",
        alignItems: "center",
        justifyContent: "center",
        color: "#d32f2f",
        fontWeight: 900,
        letterSpacing: 1,
        transform: "rotate(-6deg)",
        background: "rgba(211,47,47,0.06)",
        userSelect: "none",
      }}
    >
      {n}
    </div>
  );
}

Stamp.propTypes = {
  name: PropTypes.string,
};

function StatusBadge({ text }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #999",
        fontWeight: 700,
        fontSize: 12,
        color: "#333",
        background: "#fafafa",
        alignSelf: "center",
      }}
    >
      {text}
    </div>
  );
}

StatusBadge.propTypes = {
  text: PropTypes.string.isRequired,
};

/* -------------------- styles -------------------- */

const modalSx = (isMobile) => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: isMobile ? "92vw" : 900,
  backgroundColor: "#fff",
  borderRadius: 12,
  boxShadow: 24,
  padding: 16,
});

const sheetWrapSx = (isMobile) => ({
  border: "1px solid #cfd8e3",
  borderRadius: 2,
  overflow: "hidden",
  background: "#fff",
  mx: 1,
  mb: 2,
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  fontSize: isMobile ? 11 : 12,
});

const headerBarSx = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr",
  alignItems: "center",
  gap: 8,
  background: "#1f4e79",
  padding: "4px 4px",
};

const titleSx = (isMobile) => ({
  textAlign: "center",
  color: "#fff",
  fontWeight: 800,
  letterSpacing: 1,
  fontSize: isMobile ? 16 : 20,
});

const sectionSx = {
  borderTop: "1px solid #cfd8e3",
};

const sectionTitleSx = {
  background: "#e9f0fb",
  borderBottom: "1px solid #cfd8e3",
  padding: "8px 10px",
  fontWeight: 800,
  color: "#1f4e79",
};

const thCell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tdCell = {
  border: "1px solid #cfd8e3",
  padding: "4px 4px",
  background: "#fff",
  minWidth: 140,
};

const tdCellCenter = {
  border: "1px solid #cfd8e3",
  padding: "10px 8px",
  background: "#fff",
  textAlign: "center",
};

const th2Cell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const td2CellCenter = {
  border: "1px solid #cfd8e3",
  padding: "4px 4px",
  textAlign: "center",
  background: "#fff",
};

const td2Cell = {
  border: "1px solid #cfd8e3",
  padding: "4px 4px",
  background: "#fff",
};

const inputSx = (isMobile) => ({
  "& .MuiInputBase-input": {
    fontSize: isMobile ? 11 : 12,
    padding: isMobile ? "6px 8px" : "7px 10px",
  },
  "& .MuiInputBase-inputMultiline": {
    fontSize: isMobile ? 11 : 12,
  },
});

const gridInputSx = (isMobile) => ({
  "& .MuiInputBase-input": {
    fontSize: isMobile ? 11 : 12,
    padding: isMobile ? "6px 8px" : "6px 10px",
  },
});
