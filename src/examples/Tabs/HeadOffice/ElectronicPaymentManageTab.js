/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TextField, Modal, Box, useTheme, useMediaQuery } from "@mui/material";
import PropTypes from "prop-types";
import Swal from "sweetalert2";
import { useLocation, useNavigate } from "react-router-dom";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import LoadingScreen from "layouts/loading/loadingscreen";

import { getDetailDocumentComponent } from "./electronicPaymentDocument";
import useElectronicPaymentManageData, {
  DOC_KIND,
  getDocNameByType,
  getDocTypeByKind,
  isDocKind,
} from "./electronicPaymentManageData";

// TODO: 소모품 고정 결재자/특수 조회 사용자 ID는 운영 정책에 맞춰 변경 가능
const EXPENDABLE_SPECIAL_USER_ID = "iy1";

// 공백/undefined 안전 문자열 변환
function asText(v) {
  return String(v ?? "").trim();
}

// DB 결재 상태 코드(2/3/4)를 화면 문구로 변환
function toSignText(v) {
  const s = asText(v);
  if (s === "4") return "결재";
  if (s === "3") return "반려";
  if (s === "2") return "검토";
  return "대기";
}

// 문서타입 코드 -> 문서명 표시 변환
// - 기준: tb_electronic_payment_type.doc_type/doc_name
function toDocTypeText(v, docTypeList) {
  return getDocNameByType(v, docTypeList, "-");
}

// 직책 코드 fallback 변환
function toPositionText(positionCode) {
  const p = Number(positionCode);
  if (p === 0) return "대표";
  if (p === 1) return "팀장";
  if (p === 2) return "파트장";
  if (p >= 3 && p <= 7) return "매니저";
  if (p === 8) return "영양사";
  return "";
}

// 문서타입별 결재권자 범위를 type.position 값으로 계산한다.
// - 0: 팀장 -> 대표
// - 1: 팀장
// - 2: 결재자
function getRequiredRolesByDocPosition(pos, docType, docTypeList) {
  // 소모품 구매 품의서는 결재자 1명(고정)만 사용한다.
  // position 값과 무관하게 payer 단계만 남긴다.
  if (isDocKind(docType, docTypeList, DOC_KIND.EXPENDABLE)) return ["payer"];
  if (pos === 0) return ["tm", "ceo"];
  if (pos === 1) return ["tm"];
  if (pos === 2) return ["payer"];
  return [];
}

const DEPARTMENT_NAME_BY_CODE = {
  "0": "대표",
  // "1": "신사업팀",
  "2": "회계팀",
  "3": "인사팀",
  "4": "영업팀",
  "5": "운영팀",
  "6": "개발팀",
  // "7": "현장",
};

// 부서코드 라벨 변환
function toDepartmentLabel(codeLike) {
  const raw = asText(codeLike);
  if (!raw) return "";
  if (DEPARTMENT_NAME_BY_CODE[raw]) return DEPARTMENT_NAME_BY_CODE[raw];

  const n = Number(raw);
  if (Number.isInteger(n) && DEPARTMENT_NAME_BY_CODE[String(n)]) {
    return DEPARTMENT_NAME_BY_CODE[String(n)];
  }

  return raw;
}

const RETENTION_LABEL_BY_CODE = {
  "1": "1년",
  "2": "2년",
  "3": "3년",
  "4": "4년",
  "5": "5년",
  "6": "10년",
  "7": "영구",
};

const ACCESS_LEVEL_LABEL_BY_CODE = {
  "1": "1등급",
  "2": "2등급",
  "3": "3등급",
  "4": "4등급",
  "5": "5등급",
};

// 보존연한 코드 라벨 변환
function toRetentionText(value) {
  const raw = asText(value);
  if (!raw) return "-";
  if (RETENTION_LABEL_BY_CODE[raw]) return RETENTION_LABEL_BY_CODE[raw];

  const n = Number(raw);
  return Number.isInteger(n) && RETENTION_LABEL_BY_CODE[String(n)]
    ? RETENTION_LABEL_BY_CODE[String(n)]
    : raw;
}

// 열람등급 코드 라벨 변환
function toAccessLevelText(value) {
  const raw = asText(value);
  if (!raw) return "-";
  if (ACCESS_LEVEL_LABEL_BY_CODE[raw]) return ACCESS_LEVEL_LABEL_BY_CODE[raw];

  const n = Number(raw);
  return Number.isInteger(n) && ACCESS_LEVEL_LABEL_BY_CODE[String(n)]
    ? ACCESS_LEVEL_LABEL_BY_CODE[String(n)]
    : raw;
}

// 상세/목록 응답에서 부서명(또는 부서코드) 표시값 추출
function getDepartmentText(row) {
  const deptName = asText(
    row?.dept_name ??
    row?.department_name ??
    row?.department_nm ??
    row?.draft_dept_name ??
    row?.reg_dept_name
  );
  if (deptName) return toDepartmentLabel(deptName);

  const deptCode = asText(
    row?.department ??
    row?.dept_code ??
    row?.dept_id ??
    row?.draft_department ??
    row?.reg_department
  );
  return deptCode ? toDepartmentLabel(deptCode) : "-";
}

// 상세(main) 데이터만으로 진행상태 텍스트 계산
function getProgressStatusText(main, requiredRoles) {
  const tmUser = asText(main?.tm_user);
  const tmSign = asText(main?.tm_sign);
  const payerSign = asText(main?.payer_sign);
  const ceoSign = asText(main?.ceo_sign);
  const ceoUser = asText(main?.ceo_user);
  const payerUser = asText(main?.payer_user);
  const needTM = requiredRoles?.needTM ?? !!tmUser;
  const needPayer = requiredRoles?.needPayer ?? !!payerUser;
  const needCeo = requiredRoles?.needCeo ?? !!ceoUser;

  if (tmSign === "3" || payerSign === "3" || ceoSign === "3") return "반려";
  const tmDone = !needTM || !tmUser || tmSign === "4";
  const payerDone = !needPayer || !payerUser || payerSign === "4";
  const ceoDone = !needCeo || !ceoUser || ceoSign === "4";

  if (tmDone && payerDone && ceoDone) return "승인완료";

  if (needTM && !tmDone) return tmSign === "2" ? "검토중(팀장)" : "결재대기(팀장)";

  if (needPayer && payerUser && !payerDone) {
    return payerSign === "2" ? "검토중(결재자)" : "결재대기(결재자)";
  }

  if (needCeo && ceoUser && !ceoDone) {
    return ceoSign === "2" ? "검토중(대표)" : "결재대기(대표)";
  }

  if (needTM) return "결재대기(팀장)";
  if (needPayer) return "결재대기(결재자)";
  if (needCeo) return "결재대기(대표)";
  return "-";
}

// 목록 행 결재권자 필요 단계 계산
function getRowRequiredRoleFlags(row, docTypeList) {
  const rowRequiredRoles = getRequiredRolesByDocPosition(Number(row?.position ?? -1), row?.doc_type, docTypeList);
  const hasRowRoleMapping = rowRequiredRoles.length > 0;
  const hasRowTMUser = !!asText(row?.tm_user);
  const hasRowPayerUser = !!asText(row?.payer_user);
  const hasRowCeoUser = !!asText(row?.ceo_user);
  const needTM = hasRowRoleMapping ? rowRequiredRoles.includes("tm") || hasRowTMUser : hasRowTMUser;
  const needPayer = hasRowRoleMapping
    ? rowRequiredRoles.includes("payer") || hasRowPayerUser
    : hasRowPayerUser;
  const needCeo = hasRowRoleMapping ? rowRequiredRoles.includes("ceo") || hasRowCeoUser : hasRowCeoUser;
  return { needTM, needPayer, needCeo };
}

// 목록 행 진행상태 계산
function getRowProgressStatusText(row, docTypeList) {
  return getProgressStatusText(row, getRowRequiredRoleFlags(row, docTypeList));
}

// 지출결의서 생성 체크 금지 상태 판정
function isBlockedExpenseCheckStatus(statusText) {
  const text = asText(statusText);
  return text.includes("반려") || text.includes("결재대기") || text.includes("결재 대기");
}

// 소모품 문서 체크 허용 여부 판정
function isExpenseRowCheckAllowed(row, docTypeList) {
  if (!isDocKind(row?.doc_type, docTypeList, DOC_KIND.EXPENDABLE)) return false;
  const statusText = getRowProgressStatusText(row, docTypeList);
  return !isBlockedExpenseCheckStatus(statusText);
}

// 결재자 미지정이면 '-'를 표시하고, 지정된 경우에만 상태 텍스트 표시
function getSignTextByUser(signValue, approverUserId) {
  if (!asText(approverUserId)) return "-";
  return toSignText(signValue);
}

// 목록 상태 필터용 완료 판정
// - 승인완료/반려는 "완료"
// - 그 외는 "결재 중"
function isCompletedRow(row) {
  const statusCode = Number(asText(row?.status));
  if (statusCode === 3 || statusCode === 4) return true;

  const statusText = asText(row?.progress_status_text);
  return statusText === "승인완료" || statusText.includes("반려");
}

// 결재/반려 완료 상태일 때만 결재시각 노출
function isFinishedSign(text) {
  const value = asText(text);
  return value === "결재" || value === "반려";
}

// 결재시각 표시는 항상 초까지 맞춘다.
// - yyyy-mm-dd hh:mm 형태면 :00 보정
// - ISO(T) 포맷이면 공백 포맷으로 정리
function toSecondPrecisionText(value) {
  const raw = asText(value);
  if (!raw) return "";

  const normalized = raw.replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(normalized)) return `${normalized}:00`;
  return normalized;
}

// accountissuesheettab 결과 컬럼 톤 적용
// - 승인/결재: 초록
// - 반려: 노랑
// - 대기/검토/기타: 회색
function getStatusTone(text) {
  const value = asText(text);
  if (value.includes("반려")) {
    return { backgroundColor: "#fff2cc", color: "#8a5d00" };
  }
  if (value.includes("대기") || value.includes("검토") || value === "-") {
    return { backgroundColor: "#f1f3f5", color: "#495057" };
  }
  if (value.includes("승인") || value === "결재") {
    return { backgroundColor: "#dff3e0", color: "#1b5e20" };
  }
  return { backgroundColor: "#f1f3f5", color: "#495057" };
}

// 전자결재 관리 탭
// - 목록: 내가 볼 수 있는 결재문서 조회
// - 상세: 문서 클릭 시 모달로 메인/품목 확인
// - 처리: 결재 권한이 있는 사용자만 결재/반려 실행
export default function ElectronicPaymentManageTab({ initialPaymentId, initialOpenToken }) {
  // 반응형 기준값 (모바일에서 폰트/폭 조정)
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();
  const navigate = useNavigate();

  // 로그인 사용자 ID (권한 판단, 목록/상세 조회 파라미터에 사용)
  const loginUserId = useMemo(() => String(localStorage.getItem("user_id") || "").trim(), []);

  // 데이터 훅에서 목록/상세/저장 상태 및 함수 수신
  const {
    docTypeList,
    loading,
    rows,
    detailLoading,
    detailMain,
    detailItems,
    detailFiles,
    saving,
    userMetaMap,
    fetchManageList,
    fetchManageDetail,
    saveSign,
    saveItemBuyYn,
    fetchUserMetaMap,
  } = useElectronicPaymentManageData();

  // 타입테이블에서 지출결의서/소모품 문서의 실제 doc_type 코드를 조회한다.
  const paymentDocType = useMemo(
    () => getDocTypeByKind(docTypeList, DOC_KIND.PAYMENT),
    [docTypeList]
  );

  // UI 상태
  // - openDetail: 상세 모달 오픈 여부
  // - actionStatus: 결재 선택 값("" | "4" | "3")
  const [openDetail, setOpenDetail] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [listStatusFilter, setListStatusFilter] = useState("all");
  const [checkedExpenseMap, setCheckedExpenseMap] = useState({});
  const [contextMenu, setContextMenu] = useState({
    open: false,
    mouseX: 0,
    mouseY: 0,
  });
  const [buyYnSavingIdx, setBuyYnSavingIdx] = useState("");

  // 로그인 사용자 기준 목록 로딩
  const loadList = useCallback(async () => {
    await fetchManageList(loginUserId);
  }, [fetchManageList, loginUserId]);

  // 상세에서 처리 완료 후에는 관리탭(tab=1) URL로 정리해 재오픈을 방지한다.
  const moveToManageTab = useCallback(() => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("tab", "1");
    nextParams.delete("payment_id");
    nextParams.delete("open_ts");

    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "?tab=1",
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate]);

  // 탭 최초 진입 시 목록 자동 조회
  useEffect(() => {
    loadList();
  }, [loadList]);

  // 결재선 사용자명/직책 표기를 위한 사용자 메타 선조회
  useEffect(() => {
    fetchUserMetaMap();
  }, [fetchUserMetaMap]);

  // 목록 행 클릭/딥링크 진입 시 상세 모달 오픈
  // 모달 열 때 결재 선택값은 기본 "결재(4)"로 초기화
  const openDetailModal = useCallback(
    async (paymentId) => {
      if (!paymentId) return;
      setOpenDetail(true);
      setActionStatus("");
      await fetchManageDetail(paymentId, loginUserId);
    },
    [fetchManageDetail, loginUserId]
  );

  // 네비 알림에서 ?payment_id=... 로 진입했을 때 자동 상세 오픈
  useEffect(() => {
    if (!initialPaymentId) return;
    openDetailModal(initialPaymentId);
  }, [initialPaymentId, initialOpenToken, openDetailModal]);

  // user_id를 "이름 직책" 형태로 변환 (메타 없으면 ID fallback)
  const getUserLabel = useCallback(
    (userId) => {
      const uid = asText(userId);
      if (!uid) return "-";

      const meta = userMetaMap?.[uid];
      if (!meta) return uid;

      const userName = asText(meta.user_name);
      if (!userName) return uid;
      const positionName = asText(meta.position_name) || toPositionText(meta.position);
      return positionName ? `${userName} ${positionName}` : userName;
    },
    [userMetaMap]
  );

  // user_id를 도장용 이름(직책 제외)으로 변환 (메타 없으면 fallback/ID 사용)
  const getUserName = useCallback(
    (userId, fallback = "") => {
      const uid = asText(userId);
      if (!uid) return asText(fallback) || "-";

      const meta = userMetaMap?.[uid];
      const userName = asText(meta?.user_name);
      return userName || asText(fallback) || uid;
    },
    [userMetaMap]
  );

  // 상세 본문 컴포넌트 선택
  // - 1차: doc_type + type테이블 매핑
  // - 2차: 상세 rows 데이터 형태 기반 보정(소모품으로 잘못 fallback되는 케이스 방지)
  const DetailDocumentComponent = useMemo(
    () => getDetailDocumentComponent(detailMain?.doc_type, docTypeList, detailItems),
    [detailMain?.doc_type, docTypeList, detailItems]
  );

  // 목록 상태 필터 적용
  const filteredRows = useMemo(() => {
    const source = Array.isArray(rows) ? rows : [];
    if (listStatusFilter === "all") return source;
    if (listStatusFilter === "done") return source.filter((row) => isCompletedRow(row));
    return source.filter((row) => !isCompletedRow(row));
  }, [rows, listStatusFilter]);
  // 소모품 특수 사용자 여부 판정
  const isExpendableSpecialUser = loginUserId === EXPENDABLE_SPECIAL_USER_ID;

  // 체크된 소모품 문서 키 목록
  const checkedExpenseIds = useMemo(
    () => Object.keys(checkedExpenseMap).filter((paymentId) => !!checkedExpenseMap[paymentId]),
    [checkedExpenseMap]
  );

  useEffect(() => {
    if (!isExpendableSpecialUser) {
      setCheckedExpenseMap({});
      return;
    }

    // 목록 재조회 후 사라진 문서는 체크 상태를 자동 정리한다.
    setCheckedExpenseMap((prev) => {
      const validSet = new Set(
        (Array.isArray(rows) ? rows : [])
          .filter((row) => isExpenseRowCheckAllowed(row, docTypeList))
          .map((row) => asText(row?.payment_id))
          .filter(Boolean)
      );

      const next = {};
      Object.keys(prev || {}).forEach((paymentId) => {
        if (validSet.has(paymentId) && prev[paymentId]) {
          next[paymentId] = true;
        }
      });
      return next;
    });
  }, [rows, docTypeList, isExpendableSpecialUser]);

  // 우클릭 컨텍스트 메뉴 종료
  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, open: false }));
  }, []);

  // 소모품 문서 체크 상태 토글
  const toggleExpenseRowCheck = useCallback(
    (row, checked) => {
      if (!isExpendableSpecialUser) return;
      if (!isExpenseRowCheckAllowed(row, docTypeList)) return;

      const paymentId = asText(row?.payment_id);
      if (!paymentId) return;

      setCheckedExpenseMap((prev) => ({
        ...prev,
        [paymentId]: !!checked,
      }));
    },
    [docTypeList, isExpendableSpecialUser]
  );

  // 소모품 체크 행 우클릭 메뉴 오픈
  const handleExpenseRowContextMenu = useCallback(
    (e, row) => {
      if (!isExpendableSpecialUser) return;
      if (!isDocKind(row?.doc_type, docTypeList, DOC_KIND.EXPENDABLE)) return;

      e.preventDefault();
      const paymentId = asText(row?.payment_id);
      if (!paymentId || !checkedExpenseMap[paymentId]) {
        closeContextMenu();
        return;
      }

      setContextMenu({
        open: true,
        mouseX: e.clientX,
        mouseY: e.clientY,
      });
    },
    [checkedExpenseMap, closeContextMenu, docTypeList, isExpendableSpecialUser]
  );

  // 지출결의서 작성 화면 이동
  const handleCreateExpenseDocument = useCallback(() => {
    if (checkedExpenseIds.length === 0) {
      closeContextMenu();
      Swal.fire({ title: "확인", text: "체크된 소모품 문서를 선택해주세요.", icon: "warning" });
      return;
    }

    if (!paymentDocType) {
      closeContextMenu();
      Swal.fire({
        title: "확인",
        text: "지출결의서 문서타입 코드를 찾지 못했습니다. 문서타입 설정을 확인해주세요.",
        icon: "warning",
      });
      return;
    }

    const nextParams = new URLSearchParams(location.search);
    nextParams.set("tab", "0");
    nextParams.set("doc_type", paymentDocType);
    nextParams.set("source_payment_ids", checkedExpenseIds.join(","));
    nextParams.delete("payment_id");
    nextParams.delete("open_ts");

    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: false }
    );
    closeContextMenu();
  }, [checkedExpenseIds, closeContextMenu, location.pathname, location.search, navigate, paymentDocType]);

  // 상세 결재권자 역할 목록 계산
  const detailRequiredRoles = useMemo(
    () => getRequiredRolesByDocPosition(Number(detailMain?.position ?? -1), detailMain?.doc_type, docTypeList),
    [detailMain?.position, detailMain?.doc_type, docTypeList]
  );
  const hasDetailRoleMapping = detailRequiredRoles.length > 0;
  const hasDetailTMUser = !!asText(detailMain?.tm_user);
  const hasDetailPayerUser = !!asText(detailMain?.payer_user);
  const hasDetailCeoUser = !!asText(detailMain?.ceo_user);
  const needTM = hasDetailRoleMapping
    ? detailRequiredRoles.includes("tm") || hasDetailTMUser
    : hasDetailTMUser;
  const needPayer = hasDetailRoleMapping
    ? detailRequiredRoles.includes("payer") || hasDetailPayerUser
    : hasDetailPayerUser;
  const needCeo = hasDetailRoleMapping
    ? detailRequiredRoles.includes("ceo") || hasDetailCeoUser
    : hasDetailCeoUser;

  // 팀장 결재 가능 여부
  const canSignTM = useMemo(() => {
    if (!detailMain || !needTM) return false;
    const regUser = asText(detailMain.reg_user_id);
    const tmUser = asText(detailMain.tm_user);
    const tmSign = asText(detailMain.tm_sign);
    // 조건:
    // 1) 로그인 사용자가 기안자가 아니어야 함(기안자는 조회 전용)
    // 2) 로그인 사용자가 팀장 결재자여야 함
    // 3) 팀장 결재 상태가 이미 완료/반려가 아니어야 함
    return regUser !== loginUserId && tmUser === loginUserId && tmSign !== "3" && tmSign !== "4";
  }, [detailMain, loginUserId, needTM]);

  // 대표 결재 가능 여부 (팀장/결재자 결재 완료 후)
  const canSignCEO = useMemo(() => {
    if (!detailMain || !needCeo) return false;
    const regUser = asText(detailMain.reg_user_id);
    const tmUser = asText(detailMain.tm_user);
    const ceoUser = asText(detailMain.ceo_user);
    const tmSign = asText(detailMain.tm_sign);
    const payerUser = asText(detailMain.payer_user);
    const payerSign = asText(detailMain.payer_sign);
    const ceoSign = asText(detailMain.ceo_sign);
    const tmReady = !needTM || !tmUser || tmSign === "4";
    const payerReady = !needPayer || !payerUser || payerSign === "4";
    // 조건:
    // 1) 기안자는 제외
    // 2) 로그인 사용자가 대표 결재자와 일치
    // 3) 팀장/결재자 결재가 완료된 이후
    // 4) 대표 결재가 미완료 상태
    return (
      regUser !== loginUserId &&
      ceoUser === loginUserId &&
      tmReady &&
      payerReady &&
      ceoSign !== "3" &&
      ceoSign !== "4"
    );
  }, [detailMain, loginUserId, needCeo, needTM, needPayer]);

  // 결재자 결재 가능 여부 (팀장 결재 후)
  const canSignPayer = useMemo(() => {
    if (!detailMain || !needPayer) return false;
    const regUser = asText(detailMain.reg_user_id);
    const tmUser = asText(detailMain.tm_user);
    const payerUser = asText(detailMain.payer_user);
    const tmSign = asText(detailMain.tm_sign);
    const payerSign = asText(detailMain.payer_sign);
    const tmReady = !needTM || !tmUser || tmSign === "4";

    // 조건:
    // 1) 기안자 제외
    // 2) 로그인 사용자가 결재자와 일치
    // 3) 팀장 결재 완료
    // 4) 결재자 상태 미완료
    return (
      regUser !== loginUserId &&
      payerUser === loginUserId &&
      tmReady &&
      payerSign !== "3" &&
      payerSign !== "4"
    );
  }, [detailMain, loginUserId, needPayer, needTM]);

  // 팀장/대표/결재자 중 현재 사용자 결재 가능 여부
  const canAction = canSignTM || canSignCEO || canSignPayer;
  // 팀장이 없고 결재자만 있으면 결재자를 팀장 칸으로 이동
  const movePayerToTmSlot = !needTM && needPayer;
  // 결재자가 없고 대표만 있으면 대표를 결재자 칸으로 이동
  const moveCeoToPayerSlot = !needPayer && needCeo;
  // 결재 액션 코드 정규화
  const selectedActionSign = actionStatus === "4" || actionStatus === "3" ? actionStatus : "";
  // 구매여부 컬럼 노출 여부
  const showBuyYnColumn = isExpendableSpecialUser;
  // 결재자 결재완료 상태 판정
  const isPayerApproved = asText(detailMain?.payer_sign) === "4";
  // 반려 상태 판정
  const isRejectedDocument =
    asText(detailMain?.status) === "3" ||
    asText(detailMain?.tm_sign) === "3" ||
    asText(detailMain?.payer_sign) === "3" ||
    asText(detailMain?.ceo_sign) === "3";
  // 구매여부 수정 가능 여부
  const canEditBuyYn =
    isDocKind(detailMain?.doc_type, docTypeList, DOC_KIND.EXPENDABLE) &&
    isExpendableSpecialUser &&
    !isPayerApproved &&
    !isRejectedDocument;

  // 상세 모달 진행상태 텍스트 (문서 타입별 결재권자 범위를 반영)
  const detailStatusText = useMemo(() => {
    if (!detailMain) return "-";
    return getProgressStatusText(detailMain, { needTM, needPayer, needCeo });
  }, [detailMain, needTM, needPayer, needCeo]);

  // 결재 처리 미리보기 상태값 계산
  const tmSignForDisplay = canSignTM && selectedActionSign ? selectedActionSign : detailMain?.tm_sign;
  const payerSignForDisplay =
    canSignPayer && selectedActionSign ? selectedActionSign : detailMain?.payer_sign;
  const ceoSignForDisplay = canSignCEO && selectedActionSign ? selectedActionSign : detailMain?.ceo_sign;

  // 도장/상태 뱃지 렌더 분기
  const renderStampOrStatus = (name, signValue) => {
    const sign = asText(signValue);
    if (sign === "4") return <Stamp name={name} mode="approve" />;
    if (sign === "3") return <Stamp name={name} mode="reject" />;
    if (sign === "2") return <StatusBadge text="검토" />;
    return <StatusBadge text="-" />;
  };

  // 결재 칸 도장 셀 렌더
  const renderRoleStampCell = ({ need, userName, signValue, width, hideWhenNotNeed }) => {
    const sign = asText(signValue);
    const hasStamp = sign === "4" || sign === "3";

    if (!need && hideWhenNotNeed) {
      return (
        <td style={{ ...tdCellCenter, width, visibility: "hidden", pointerEvents: "none" }}>
          <div>hidden</div>
        </td>
      );
    }

    if (!need) {
      return (
        <td style={{ ...tdCellCenter, width }}>
          <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <MDBox sx={{ fontSize: 10, fontWeight: 700 }}>{userName || "-"}</MDBox>
            <StatusBadge text="-" />
          </MDBox>
        </td>
      );
    }

    return (
      <td style={{ ...tdCellCenter, width }}>
        <MDBox sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {!hasStamp && <MDBox sx={{ fontSize: 10, fontWeight: 700 }}>{userName || "-"}</MDBox>}
          <MDBox>{renderStampOrStatus(userName, signValue)}</MDBox>
        </MDBox>
      </td>
    );
  };

  // 구매여부 토글 저장
  const handleToggleBuyYn = useCallback(
    async (item, checked) => {
      if (!canEditBuyYn) return;
      const paymentId = asText(detailMain?.payment_id);
      const itemIdx = asText(item?.idx);
      if (!paymentId || !itemIdx) return;

      setBuyYnSavingIdx(itemIdx);
      const ok = await saveItemBuyYn({
        payment_id: paymentId,
        idx: itemIdx,
        user_id: loginUserId,
        buy_yn: checked ? "Y" : "N",
      });
      setBuyYnSavingIdx("");

      if (!ok) {
        Swal.fire({ title: "실패", text: "구매여부 저장 중 오류가 발생했습니다.", icon: "error" });
      }
    },
    [canEditBuyYn, detailMain?.payment_id, loginUserId, saveItemBuyYn]
  );

  // 결재/반려 저장
  const handleSaveAction = async () => {
    if (!detailMain?.payment_id) return;
    if (!selectedActionSign) {
      Swal.fire({ title: "확인", text: "결재 상태를 선택해주세요.", icon: "warning" });
      return;
    }

    const isApproveAction = selectedActionSign === "4";
    const confirmResult = await Swal.fire({
      title: isApproveAction ? "결재승인 하시겠습니까?" : "반려 하시겠습니까?",
      text: "처리 후에는 수정하기 어렵습니다.",
      icon: isApproveAction ? "question" : "warning",
      showCancelButton: true,
      confirmButtonText: isApproveAction ? "결재승인" : "반려",
      cancelButtonText: "취소",
      confirmButtonColor: isApproveAction ? "#2e7d32" : "#d32f2f",
    });
    if (!confirmResult.isConfirmed) return;

    // 현재 문서 기준으로 결재 처리 저장
    const ok = await saveSign({
      payment_id: detailMain.payment_id,
      user_id: loginUserId,
      action_status: selectedActionSign,
    });

    if (!ok) {
      Swal.fire({ title: "실패", text: "저장 중 오류가 발생했습니다.", icon: "error" });
      return;
    }

    // 저장 직후 네비바 전자결재 알림을 즉시 갱신한다.
    window.dispatchEvent(new Event("electronic-payment-notification-refresh"));

    await Swal.fire({
      title: "저장",
      text: selectedActionSign === "4" ? "결재 처리되었습니다." : "반려 처리되었습니다.",
      icon: "success",
      confirmButtonText: "확인",
    });

    // 저장 성공 후 목록을 최신화하고 상세를 닫은 뒤 관리 탭으로 복귀
    await loadList();
    setOpenDetail(false);
    moveToManageTab();
  };

  // 목록 로딩 중에는 공통 로딩 화면 사용
  if (loading) return <LoadingScreen />;

  return (
    <>
      {/* 상단 제목/새로고침 액션 바 */}
      <MDBox
        pt={0}
        pb={1}
        px={1}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <MDBox sx={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: "#1f4e79" }}>
          전자결재 관리
        </MDBox>

        <MDBox sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField
            select
            size="small"
            value={listStatusFilter}
            onChange={(e) => setListStatusFilter(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: isMobile ? 112 : 130 }}
          >
            <option value="all">전체</option>
            <option value="progress">결제 중</option>
            <option value="done">완료</option>
          </TextField>
          <MDButton
            variant="gradient"
            color="info"
            onClick={loadList}
            sx={{ fontSize: isMobile ? 11 : 13, minWidth: isMobile ? 90 : 110 }}
          >
            새로고침
          </MDButton>
        </MDBox>
      </MDBox>

      {/* 목록 영역: 내가 확인 가능한 문서와 진행상태 표시 */}
      <MDBox sx={sheetWrapSx(isMobile)}>
        <MDBox sx={sectionTitleSx}>목록</MDBox>
        <MDBox sx={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: isExpendableSpecialUser ? 1120 : 1060,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              {isExpendableSpecialUser && <col style={{ width: 60 }} />}
              <col style={{ width: 170 }} />
              <col style={{ width: 148 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
            </colgroup>
            <thead>
              <tr>
                {isExpendableSpecialUser && <th style={th2Cell}>구분</th>}
                <th style={th2Cell}>문서번호</th>
                <th style={th2Cell}>기안일자</th>
                <th style={th2Cell}>문서타입</th>
                <th style={th2Cell}>부서</th>
                <th style={th2Cell}>상신자</th>
                <th style={th2Cell}>결재상태</th>
                <th style={th2Cell}>팀장</th>
                <th style={th2Cell}>결재자</th>
                <th style={th2Cell}>대표이사</th>
              </tr>
            </thead>
            <tbody>
              {/* 목록이 비었을 때 안내 행 */}
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    style={{ ...td2CellCenter, padding: "16px" }}
                    colSpan={isExpendableSpecialUser ? 10 : 9}
                  >
                    조회 가능한 문서가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const rowRequiredFlags = getRowRequiredRoleFlags(row, docTypeList);
                  const statusText = getRowProgressStatusText(row, docTypeList);
                  const tmSignText = rowRequiredFlags.needTM
                    ? getSignTextByUser(row.tm_sign, row.tm_user)
                    : "-";
                  const payerSignText = rowRequiredFlags.needPayer
                    ? getSignTextByUser(row.payer_sign, row.payer_user)
                    : "-";
                  const ceoSignText = rowRequiredFlags.needCeo
                    ? getSignTextByUser(row.ceo_sign, row.ceo_user)
                    : "-";
                  const paymentId = asText(row.payment_id);
                  const isExpendableRow = isDocKind(row.doc_type, docTypeList, DOC_KIND.EXPENDABLE);
                  const isCheckDisabled = isExpendableRow && isBlockedExpenseCheckStatus(statusText);
                  const isCheckedExpenseRow = !!checkedExpenseMap[paymentId];
                  return (
                    // 행 클릭 시 상세 모달 오픈
                    <tr
                      key={`${row.payment_id}-${idx}`}
                      onClick={() => openDetailModal(row.payment_id)}
                      onContextMenu={(e) => handleExpenseRowContextMenu(e, row)}
                      style={{
                        cursor: isExpendableSpecialUser && isCheckedExpenseRow ? "context-menu" : "pointer",
                        verticalAlign: "middle",
                      }}
                    >
                      {isExpendableSpecialUser && (
                        <td
                          style={{ ...td2CellCenter, cursor: "default" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MDBox sx={tableCellCenterInnerSx}>
                            {isExpendableRow ? (
                              <input
                                type="checkbox"
                                checked={isCheckedExpenseRow}
                                disabled={isCheckDisabled}
                                style={{
                                  ...nativeCheckboxCenterStyle,
                                  cursor: isCheckDisabled ? "not-allowed" : "pointer",
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (isCheckDisabled) return;
                                  toggleExpenseRowCheck(row, e.target.checked);
                                }}
                              />
                            ) : (
                              "-"
                            )}
                          </MDBox>
                        </td>
                      )}
                      <td style={td2CellCenter}>{asText(row.payment_id) || "-"}</td>
                      <td style={td2CellCenter}>{asText(row.draft_dt) || "-"}</td>
                      <td style={td2CellCenter}>{toDocTypeText(row.doc_type, docTypeList)}</td>
                      <td style={td2CellCenter}>{getDepartmentText(row)}</td>
                      <td style={td2CellCenter}>{getUserLabel(row.reg_user_id)}</td>
                      <td style={td2CellCenter}>
                        <MDBox sx={statusBadgeSx(getStatusTone(statusText))}>{statusText}</MDBox>
                      </td>
                      <td style={td2CellCenter}>
                        <SignStatusCell text={tmSignText} signedAt={row.tm_dt} />
                      </td>
                      <td style={td2CellCenter}>
                        <SignStatusCell text={payerSignText} signedAt={row.payer_dt} />
                      </td>
                      <td style={td2CellCenter}>
                        <SignStatusCell text={ceoSignText} signedAt={row.ceo_dt} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </MDBox>
      </MDBox>

      {contextMenu.open && (
        <div
          onClick={closeContextMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeContextMenu();
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: contextMenu.mouseY,
              left: contextMenu.mouseX,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
              minWidth: 160,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={handleCreateExpenseDocument}
            >
              지출결의서 작성
            </button>
          </div>
        </div>
      )}

      {/* 상세 모달: 문서 전체 조회 + 결재처리 */}
      <Modal open={openDetail} onClose={() => setOpenDetail(false)}>
        <Box sx={modalSx(isMobile)}>
          <MDBox sx={{ fontWeight: 800, mb: 0.5, fontSize: 16 }}>전자결재 관리 상세</MDBox>

          {/* 스크롤은 모달 내부 컨텐츠 영역에서만 동작하도록 고정 */}
          <MDBox
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              px: 0.5,
              pb: 0.5,
              scrollbarGutter: "stable",
            }}
          >
            {/* 상세 데이터 로딩/없음/정상 케이스 분기 */}
            {detailLoading ? (
              <MDBox sx={{ py: 2 }}>불러오는 중...</MDBox>
            ) : !detailMain ? (
              <MDBox sx={{ py: 2 }}>상세 정보를 찾을 수 없습니다.</MDBox>
            ) : (
              <>
                {/* 문서 정보 */}
                <MDBox sx={sectionSx}>
                  <MDBox sx={sectionTitleSx}>요청 정보</MDBox>
                  <table style={summaryTableSx}>
                    <colgroup>
                      <col style={summaryThColSx(isMobile)} />
                      <col />
                      <col style={summaryThColSx(isMobile)} />
                      <col />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td style={thCell}>문서번호</td>
                        <td style={tdCell}>{asText(detailMain.payment_id) || "-"}</td>
                        <td style={thCell}>기안일자</td>
                        <td style={tdCell}>{asText(detailMain.draft_dt) || "-"}</td>
                      </tr>
                      <tr>
                        <td style={thCell}>시행일자</td>
                        <td style={tdCell} colSpan={3}>
                          {asText(detailMain.start_dt) || "-"}
                        </td>
                      </tr>
                      <tr>
                        <td style={thCell}>문서타입</td>
                        <td style={tdCell}>{toDocTypeText(detailMain.doc_type, docTypeList)}</td>
                        <td style={thCell}>결재상태</td>
                        <td style={tdCellCenter}>
                          <MDBox sx={tableCellCenterStatusSx}>
                            <MDBox sx={statusBadgeSx(getStatusTone(detailStatusText))}>
                              {detailStatusText}
                            </MDBox>
                          </MDBox>
                        </td>
                      </tr>
                      <tr>
                        <td style={thCell}>기안부서</td>
                        <td style={tdCell}>{getDepartmentText(detailMain)}</td>
                        <td style={thCell}>작성자</td>
                        <td style={tdCell}>{getUserLabel(detailMain.user_id || detailMain.reg_user_id)}</td>
                      </tr>
                      <tr>
                        <td style={thCell}>보존연한</td>
                        <td style={tdCell}>{toRetentionText(detailMain.retention_dt)}</td>
                        <td style={thCell}>열람등급</td>
                        <td style={tdCell}>{toAccessLevelText(detailMain.access_level)}</td>
                      </tr>
                    </tbody>
                  </table>
                </MDBox>

                {/* 결재선: 팀장 -> 결재자 -> 대표 순으로 노출 */}
                <MDBox sx={sectionSx}>
                  <MDBox sx={sectionTitleSx}>결재 라인</MDBox>
                  <table style={summaryTableSx}>
                    <colgroup>
                      <col style={summaryThColSx(isMobile)} />
                      <col />
                      <col style={summaryThColSx(isMobile)} />
                      <col />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td style={thCell}>팀장</td>
                        <td style={tdCell}>{getUserLabel(detailMain.tm_user)}</td>
                        <td style={thCell}>팀장결재</td>
                        <td style={tdCellCenter}>
                          <SignStatusCell
                            text={getSignTextByUser(detailMain.tm_sign, detailMain.tm_user)}
                            signedAt={detailMain.tm_dt}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={thCell}>결재자</td>
                        <td style={tdCell}>{getUserLabel(detailMain.payer_user)}</td>
                        <td style={thCell}>결재자결재</td>
                        <td style={tdCellCenter}>
                          <SignStatusCell
                            text={getSignTextByUser(detailMain.payer_sign, detailMain.payer_user)}
                            signedAt={detailMain.payer_dt}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td style={thCell}>대표</td>
                        <td style={tdCell}>{getUserLabel(detailMain.ceo_user)}</td>
                        <td style={thCell}>대표결재</td>
                        <td style={tdCellCenter}>
                          <SignStatusCell
                            text={getSignTextByUser(detailMain.ceo_sign, detailMain.ceo_user)}
                            signedAt={detailMain.ceo_dt}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </MDBox>

                <DetailDocumentComponent
                  detailItems={detailItems}
                  detailFiles={detailFiles}
                  asText={asText}
                  sectionSx={sectionSx}
                  sectionTitleSx={sectionTitleSx}
                  thCell={thCell}
                  tdCell={tdCell}
                  th2Cell={th2Cell}
                  td2CellCenter={td2CellCenter}
                  td2CellWrap={td2CellWrap}
                  td2CellLink={td2CellLink}
                  totalAmountRowSx={totalAmountRowSx}
                  requestNoteBodySx={requestNoteBodySx}
                  showBuyYnColumn={showBuyYnColumn}
                  editableBuyYn={canEditBuyYn}
                  buyYnSavingIdx={buyYnSavingIdx}
                  onToggleBuyYn={handleToggleBuyYn}
                />

                {/* 결재 처리: 작성 탭과 동일한 도장형 결재표 + 결재/반려 액션 */}
                <MDBox sx={{ mt: 1.5, p: 1, border: "1px solid #cfd8e3", borderRadius: 2 }}>
                  <MDBox sx={{ mb: 1, fontWeight: 700, color: "#1f4e79" }}>결재 처리</MDBox>

                  <MDBox sx={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        tableLayout: "fixed",
                        minWidth: 700,
                      }}
                    >
                      <tbody>
                        <tr>
                          <td style={{ ...thCell, width: 80 }} rowSpan={2}>
                            결재
                          </td>

                          <td style={{ ...thCell, width: "23%" }}>담당</td>
                          <td
                            style={{
                              ...thCell,
                              width: "23%",
                              ...(needTM || movePayerToTmSlot ? {} : { visibility: "hidden" }),
                            }}
                          >
                            {movePayerToTmSlot ? "결재자" : "팀장"}
                          </td>
                          <td
                            style={{
                              ...thCell,
                              width: "23%",
                              ...((needPayer && !movePayerToTmSlot) || moveCeoToPayerSlot
                                ? {}
                                : { visibility: "hidden" }),
                            }}
                          >
                            {moveCeoToPayerSlot ? "대표" : "결재자"}
                          </td>
                          <td
                            style={{
                              ...thCell,
                              width: "23%",
                              ...((needCeo && !moveCeoToPayerSlot) ? {} : { visibility: "hidden" }),
                            }}
                          >
                            대표
                          </td>
                        </tr>

                        <tr>
                          <td style={{ ...tdCellCenter, width: "23%" }}>
                            <Stamp
                              name={
                                getUserName(detailMain.user_id || detailMain.reg_user_id, "작성자")
                              }
                              mode="approve"
                            />
                          </td>

                          {renderRoleStampCell({
                            need: needTM || movePayerToTmSlot,
                            userName: movePayerToTmSlot
                              ? getUserName(detailMain.payer_user, "결재자")
                              : getUserName(detailMain.tm_user, "팀장"),
                            signValue: movePayerToTmSlot ? payerSignForDisplay : tmSignForDisplay,
                            width: "23%",
                            hideWhenNotNeed: true,
                          })}

                          {renderRoleStampCell({
                            need: (needPayer && !movePayerToTmSlot) || moveCeoToPayerSlot,
                            userName: moveCeoToPayerSlot
                              ? getUserName(detailMain.ceo_user, "대표")
                              : getUserName(detailMain.payer_user, "결재자"),
                            signValue: moveCeoToPayerSlot ? ceoSignForDisplay : payerSignForDisplay,
                            width: "23%",
                            hideWhenNotNeed: true,
                          })}

                          {renderRoleStampCell({
                            need: needCeo && !moveCeoToPayerSlot,
                            userName: getUserName(detailMain.ceo_user, "대표"),
                            signValue: ceoSignForDisplay,
                            width: "23%",
                            hideWhenNotNeed: true,
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </MDBox>

                  {canAction && (
                    <MDBox
                      sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "center",
                        flexWrap: "wrap",
                        mt: 1,
                        justifyContent: "flex-end",
                      }}
                    >
                      {/* 결재 결과 선택: 4=결재, 3=반려 */}
                      <TextField
                        select
                        size="small"
                        value={actionStatus}
                        onChange={(e) => setActionStatus(e.target.value)}
                        SelectProps={{ native: true }}
                        sx={{ minWidth: 140 }}
                      >
                        <option value="">선택</option>
                        <option value="4">결재</option>
                        <option value="3">반려</option>
                      </TextField>

                      {/* 저장 중에는 버튼 비활성화 + 텍스트 변경 */}
                      <MDButton
                        variant="gradient"
                        color={actionStatus === "3" ? "error" : actionStatus === "4" ? "success" : "info"}
                        onClick={handleSaveAction}
                        disabled={saving || !selectedActionSign}
                      >
                        {saving ? "저장중..." : "저장"}
                      </MDButton>
                    </MDBox>
                  )}
                </MDBox>
              </>
            )}
          </MDBox>

          {/* 모달 닫기 버튼 */}
          <MDBox
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              mt: 1.5,
              pt: 1,
              borderTop: "1px solid #e7ecf4",
              background: "#fff",
            }}
          >
            <MDButton variant="outlined" color="secondary" onClick={() => setOpenDetail(false)}>
              닫기
            </MDButton>
          </MDBox>
        </Box>
      </Modal>
    </>
  );
}

ElectronicPaymentManageTab.defaultProps = {
  // 네비에서 특정 문서로 진입하지 않은 기본 케이스
  initialPaymentId: "",
  initialOpenToken: "",
};

ElectronicPaymentManageTab.propTypes = {
  // 네비 알림 클릭 시 전달되는 결재문서 키
  initialPaymentId: PropTypes.string,
  // 알림 클릭 시마다 갱신되는 오픈 토큰(동일 payment_id 재오픈 보장)
  initialOpenToken: PropTypes.string,
};

// 결재 상태 + 결재시각 표시 셀
function SignStatusCell({ text, signedAt }) {
  const timeText = toSecondPrecisionText(signedAt);
  const showTime = isFinishedSign(text) && !!timeText;

  return (
    <MDBox
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        minHeight: 34,
      }}
    >
      <MDBox
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: showTime ? 0.25 : 0,
          transform: showTime ? "translateY(1px)" : "none",
        }}
      >
        <MDBox sx={statusBadgeSx(getStatusTone(text))}>{text}</MDBox>
        {showTime && (
          <MDBox
            component="div"
            sx={{ fontSize: 11, color: "#5f6b7a", lineHeight: 1.15, whiteSpace: "nowrap" }}
          >
            {timeText}
          </MDBox>
        )}
      </MDBox>
    </MDBox>
  );
}

SignStatusCell.propTypes = {
  text: PropTypes.string,
  signedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

SignStatusCell.defaultProps = {
  text: "-",
  signedAt: "",
};

function Stamp({ name, mode }) {
  const isReject = mode === "reject";
  const label = asText(name) || "결재";
  const stampText = isReject ? "반려" : label;

  return (
    <div
      style={{
        display: "inline-flex",
        width: 82,
        height: 52,
        borderRadius: 999,
        border: `2px solid ${isReject ? "#ef6c00" : "#d32f2f"}`,
        alignItems: "center",
        justifyContent: "center",
        color: isReject ? "#ef6c00" : "#d32f2f",
        fontWeight: 900,
        fontSize: 11,
        letterSpacing: 0.5,
        lineHeight: 1.1,
        textAlign: "center",
        whiteSpace: "pre-line",
        transform: "rotate(-6deg)",
        background: isReject ? "rgba(239,108,0,0.08)" : "rgba(211,47,47,0.06)",
        userSelect: "none",
        padding: "0 6px",
      }}
    >
      {stampText}
    </div>
  );
}

Stamp.propTypes = {
  name: PropTypes.string,
  mode: PropTypes.oneOf(["approve", "reject"]),
};

Stamp.defaultProps = {
  name: "",
  mode: "approve",
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
        fontSize: 11,
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

// 상세 모달 공통 레이아웃 스타일
// - 모바일은 viewport 기준 폭 사용
// - 데스크톱은 고정 폭 사용
const modalSx = (isMobile) => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: isMobile ? "99vw" : "98vw",
  maxWidth: 1500,
  height: isMobile ? "92vh" : "90vh",
  maxHeight: "92vh",
  overflow: "hidden",
  backgroundColor: "#fff",
  borderRadius: 8,
  boxShadow: 24,
  padding: isMobile ? 3 : 4,
  display: "flex",
  flexDirection: "column",
  fontSize: 12,
});

// 목록 래퍼 스타일 (작성 탭 톤과 유사한 테이블 박스)
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

// 섹션 상단 구분선
const sectionSx = {
  borderTop: "1px solid #cfd8e3",
  borderLeft: "1px solid #cfd8e3",
  borderRight: "1px solid #cfd8e3",
};

// 섹션 타이틀 행 스타일
const sectionTitleSx = {
  background: "#e9f0fb",
  borderBottom: "1px solid #cfd8e3",
  padding: "4px 6px",
  fontWeight: 800,
  color: "#1f4e79",
};

// 상세 테이블 헤더 셀
const thCell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "4px 5px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

// 상세 테이블 본문 셀
const tdCell = {
  border: "1px solid #cfd8e3",
  padding: "4px 5px",
  background: "#fff",
};

// 상세 테이블 본문 셀(가운데 정렬)
const tdCellCenter = {
  ...tdCell,
  textAlign: "center",
  verticalAlign: "middle",
};

// 목록/품목 테이블 헤더 셀
const th2Cell = {
  border: "1px solid #cfd8e3",
  background: "#f3f6fb",
  padding: "4px 5px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

// 목록/품목 테이블 중앙 정렬 본문 셀
const td2CellCenter = {
  border: "1px solid #cfd8e3",
  padding: "4px 5px",
  textAlign: "center",
  verticalAlign: "middle",
  background: "#fff",
};

// 상세 상단 표(요청 정보/결재 라인) 공통 폭 정렬용
const summaryTableSx = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const summaryThColSx = (isMobile) => ({
  width: isMobile ? 82 : 94,
});

// 상세 품목 셀 기본 줄바꿈
const td2CellWrap = {
  ...td2CellCenter,
  textAlign: "left",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

// 링크는 긴 문자열이 많아 강제 분할
const td2CellLink = {
  ...td2CellWrap,
  wordBreak: "break-all",
};

// 품목 금액 합계 표시 영역
const totalAmountRowSx = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 1.25,
  padding: "5px 8px",
  borderTop: "1px solid #cfd8e3",
  borderBottom: "1px solid #cfd8e3",
  background: "#f7f9fd",
};

const requestNoteBodySx = {
  p: 1,
  fontSize: 12,
  lineHeight: 1.5,
  minHeight: 56,
  whiteSpace: "pre-wrap",
  borderBottom: "1px solid #cfd8e3",
  background: "#fff",
};

// 상태 텍스트를 accountissuesheettab 결과 컬럼 톤으로 표시하기 위한 공통 배지 스타일
const statusBadgeSx = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 44,
  padding: "2px 7px",
  borderRadius: 1,
  fontWeight: 700,
  fontSize: "inherit",
  lineHeight: 1.2,
  ...tone,
});

// 체크박스 셀 중앙 정렬 래퍼 스타일
const tableCellCenterInnerSx = {
  width: "100%",
  minHeight: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

// 상태 배지 셀 중앙 정렬 래퍼 스타일
const tableCellCenterStatusSx = {
  width: "100%",
  height: "100%",
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

// 체크박스 기본 스타일
const nativeCheckboxCenterStyle = {
  display: "block",
  margin: 0,
  verticalAlign: "middle",
  width: 18,
  height: 18,
  accentColor: "#1f4e79",
  cursor: "pointer",
};
