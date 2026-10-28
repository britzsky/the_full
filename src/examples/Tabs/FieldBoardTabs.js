import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Tabs,
  Tab,
  Box,
  Card,
  Dialog,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Button,
  IconButton,
  Popper,
  Paper,
  MenuList,
  MenuItem,
  ClickAwayListener,
} from "@mui/material";
import { X, ZoomIn, ChevronDown } from "lucide-react";
import MDBox from "components/MDBox";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "layouts/loading/loadingscreen";
import dayjs from "dayjs";

import RecordSheetTab from "./FieldBoard/RecordSheetTab";
import TallySheetTab from "./FieldBoard/TallySheetTab";
import DinersNumberSheetTab from "./FieldBoard/DinersNumberSheetTab";
import HandoverSheetTab from "./FieldBoard/HandoverSheetTab";
import HygieneSheetTab from "./FieldBoard/HygieneSheetTab";
import PropertySheetTab from "./FieldBoard/PropertySheetTab";
import MenuManagementTab from "./FieldBoard/MenuManagementTab";
// 자격/보건 서류 관리 탭 (면허증/보건증/위생교육/보수교육)
import AccountMembersFilesTab from "./FieldBoard/AccountMembersFilesTab";
// 구입요청 탭 (현장 영양사 구입요청서 작성)
import PurchaseRequestTab from "./FieldBoard/PurchaseRequestTab";
// 지점업로드 탭 (급식일자·구분별 식단표/식판 사진 업로드)
import BranchUploadTab from "./FieldBoard/BranchUploadTab";
import FieldBoardPurchaseNotificationButton from "utils/FieldBoardPurchaseNotificationButton";

import HeaderWithLogout from "components/Common/HeaderWithLogout";
import { clearSharedAuthCookies } from "utils/sharedAuthSession";
import PreviewOverlay from "utils/PreviewOverlay";
import { confirmTabLeave } from "utils/unsavedChangesGuard";

// 현장관리 진입 공지 팝업 이미지 (public/fieldboard-notice.png 파일을 교체해서 사용, 없으면 이미지 영역 숨김)
const NOTICE_IMAGE_SRC = `${process.env.PUBLIC_URL}/fieldboard-notice.png`;
// 이번 달 집계표 입력 마감 시각 (말일 밤 11시)
const TALLY_CLOSE_AT = dayjs().endOf("month").hour(23).minute(0).second(0).millisecond(0);
// 마감 안내 노출 시작 시각 (말일이 속한 주의 월요일 0시, 마지막 주 시작)
const NOTICE_START_AT = TALLY_CLOSE_AT.startOf("day")
  .subtract((TALLY_CLOSE_AT.day() + 6) % 7, "day")
  .valueOf();
// 공지 노출 마감 시각 (집계표 마감 시각까지 표시)
const NOTICE_END_AT = TALLY_CLOSE_AT.valueOf();

// 공지 본문 강조 스타일 (빨간 강조)
const noticeRed = { color: "#d32f2f", fontWeight: 700 };

// 마감 일시 표시 문구 (예: 10월 31일(토) 밤 11시 (23:00))
const TALLY_CLOSE_LABEL = `${TALLY_CLOSE_AT.month() + 1}월 ${TALLY_CLOSE_AT.date()}일(${"일월화수목금토"[TALLY_CLOSE_AT.day()]
  }) 밤 11시 (23:00)`;

// 공지 팝업 제목과 본문 (이미지와 본문이 모두 없으면 팝업이 뜨지 않음)
const NOTICE_TITLE = "📢 월말 집계표 입력 마감 및 시스템 통제 안내";
const NOTICE_CONTENT = (
  <>
    <p style={{ margin: "0 0 10px" }}> 월말 마감 작업에 따른 시스템 통제 일정을 안내해 드립니다.</p>
    <p style={{ margin: "0 0 14px" }}>
      마감 시간 이후에는 자료 입력 및 수정이 불가능하오니, 기한 내에 빠짐없이 등록을 완료해 주시기
      바랍니다.
    </p>

    {/* 마감 대상 및 마감 일시 영역 */}
    <ul style={{ margin: "0 0 14px", paddingLeft: 4, listStyle: "none", display: "grid", gap: 4 }}>
      <li>
        📋 <b>마감 대상:</b> 이번 달 전체 집계표 등록 건
      </li>
      <li>
        ⏰ <b>마감 일시:</b> <span style={noticeRed}>{TALLY_CLOSE_LABEL}</span>
      </li>
    </ul>

    <p style={{ margin: "0 0 10px" }}>
      <span style={noticeRed}>🔒 마감 시각 이후에는 시스템이 자동으로 통제되어 추가 입력이 불가합니다.</span>
    </p>
    <p style={{ margin: 0 }}>
      ✅ 자료 누락으로 인한 불이익이 발생하지 않도록 마감 시각 전에 최종 등록 및 확인을 부탁드립니다.
    </p>
  </>
);
// 알림 종 목록에 고정으로 보여줄 공지 문구 (공지 기간에만 표시)
const NOTICE_BELL_LABEL = `월말 집계표 입력 마감 안내 (${TALLY_CLOSE_AT.format("M/D")} 23:00)`;
// 현재 시각이 공지 노출 기간(마지막 주 시작 ~ 마감 시각)인지 확인하는 함수
const isNoticePeriod = () => Date.now() >= NOTICE_START_AT && Date.now() <= NOTICE_END_AT;

// "24시간 동안 안보이기"를 누른 시각을 저장하는 localStorage 키
const NOTICE_HIDE_KEY = "fieldboard_notice_hide_at";
const NOTICE_HIDE_MS = 24 * 60 * 60 * 1000;

// 마지막 주 시작 ~ 마감 시각 사이이고, 숨김 시각으로부터 24시간이 지났는지 확인해 팝업 노출 여부를 정하는 함수
const shouldShowNotice = () => {
  if (!isNoticePeriod()) return false;
  try {
    const hideAt = Number(localStorage.getItem(NOTICE_HIDE_KEY) || 0);
    return Date.now() - hideAt >= NOTICE_HIDE_MS;
  } catch (e) {
    return true;
  }
};

function FieldBoardTabs() {
  // 진입 공지 팝업 열림 여부와 "24시간 동안 안보이기" 체크 상태
  const [noticeOpen, setNoticeOpen] = useState(shouldShowNotice);
  const [noticeHideToday, setNoticeHideToday] = useState(false);
  // 공지 이미지 로드 실패 여부와 이미지 미리보기 오버레이 열림 여부
  const [noticeImageError, setNoticeImageError] = useState(false);
  const [noticeImageLoaded, setNoticeImageLoaded] = useState(false);
  const [noticePreviewOpen, setNoticePreviewOpen] = useState(false);
  const noticePreviewFiles = useMemo(
    () => [{ url: NOTICE_IMAGE_SRC, name: NOTICE_TITLE || "공지", kind: "image" }],
    []
  );
  const [tabIndex, setTabIndex] = useState(0);
  const [contentTabIndex, setContentTabIndex] = useState(0);
  const [tabSwitchLoading, setTabSwitchLoading] = useState(false);
  const [, startTransition] = useTransition();
  const switchTimerRef = useRef(null);
  const TAB_SWITCH_DELAY_MS = 320;
  const navigate = useNavigate();
  // 묶음 탭 하위 메뉴의 기준 탭 요소, 묶음 번호와 닫힘 지연 타이머
  const [groupMenu, setGroupMenu] = useState({ anchor: null, groupIndex: -1 });
  const groupMenuTimerRef = useRef(null);
  // 구입요청 알림에서 선택한 작성 문서를 자동으로 여는 대상과 실행 토큰
  const [purchaseNotificationTarget, setPurchaseNotificationTarget] = useState({
    paymentId: "",
    token: 0,
  });

  // 탭 변경 (현재 탭 화면에 미저장 변경이 있으면 저장 후 이동 / 취소 후 이동 / 취소 확인)
  const handleTabChange = async (_, newValue) => {
    if (newValue === tabIndex) return;
    if (!(await confirmTabLeave())) return;

    setTabIndex(newValue);
    setTabSwitchLoading(true);

    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(() => {
      startTransition(() => {
        setContentTabIndex(newValue);
      });
    }, TAB_SWITCH_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
      clearTimeout(groupMenuTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (contentTabIndex === tabIndex && tabSwitchLoading) {
      setTabSwitchLoading(false);
    }
  }, [contentTabIndex, tabIndex, tabSwitchLoading]);

  // 공지 이미지를 미리 불러와 존재 여부를 확인한 뒤 팝업을 띄운다.
  // 숨김 상태로 진입한 뒤 알림 종에서 다시 열 때도 이미지 확인을 거치도록 noticeOpen 기준으로 실행
  useEffect(() => {
    if (!noticeOpen || noticeImageLoaded || noticeImageError) return undefined;
    let cancelled = false;
    const img = new Image();
    img.onload = () => !cancelled && setNoticeImageLoaded(true);
    img.onerror = () => !cancelled && setNoticeImageError(true);
    img.src = NOTICE_IMAGE_SRC;
    return () => {
      cancelled = true;
    };
  }, [noticeOpen]);

  // 공지 팝업 닫기:체크했으면 현재 시각을 저장해 24시간 동안 숨긴다.
  const handleNoticeClose = () => {
    if (noticeHideToday) {
      try {
        localStorage.setItem(NOTICE_HIDE_KEY, String(Date.now()));
      } catch (e) {
        // 저장 실패 시 다음 진입 때 다시 표시
      }
    }
    setNoticeOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_type");
    localStorage.removeItem("position");
    localStorage.removeItem("department");
    localStorage.removeItem("account_id");
    localStorage.removeItem("web_position");
    localStorage.removeItem("login_session_id");
    localStorage.removeItem("position_name");
    localStorage.removeItem("user_name");
    localStorage.removeItem("autoLogin");
    localStorage.removeItem("autoLoginUserId");
    localStorage.removeItem("autoLoginPassword");
    sessionStorage.removeItem("login_session_id");
    sessionStorage.removeItem("login_user_id");
    clearSharedAuthCookies();

    navigate("/authentication/sign-in", { replace: true });
  };

  const tabLabels = [
    "🔁 인수인계",
    "🧹 위생점검",
    "📦 기물관리",
    // "🍽️ 식단표 관리",
    "📋 자격/보건 서류 관리",
    "📅 출근부",
    "📋 집계표",
    "🍽️ 식수현황",
    "📤 지점업로드",
    "🛒 구매요청",
  ];

  // 상단 탭 구성: children은 마우스 오버/클릭 시 하위 메뉴로 펼쳐지는 묶음 탭, index는 단일 탭
  const tabGroups = [
    { label: "🏢 운영관리", children: [0, 1, 2, 3] },
    { index: 4 },
    { index: 5 },
    { index: 6 },
    { index: 7 },
    { index: 8 },
  ];
  // 현재 선택된 화면이 속한 상단 탭 번호
  const topTabIndex = tabGroups.findIndex((g) =>
    g.children ? g.children.includes(tabIndex) : g.index === tabIndex
  );

  // 묶음 탭 하위 메뉴를 여는 함수 (닫힘 대기 중이면 취소)
  const openGroupMenu = (anchor, groupIndex) => {
    clearTimeout(groupMenuTimerRef.current);
    setGroupMenu({ anchor, groupIndex });
  };
  // 하위 메뉴를 즉시 닫는 함수
  const closeGroupMenu = () => {
    clearTimeout(groupMenuTimerRef.current);
    setGroupMenu({ anchor: null, groupIndex: -1 });
  };
  // 탭에서 메뉴로 마우스를 옮기는 동안 닫히지 않도록 잠시 뒤에 닫는 함수
  const closeGroupMenuSoon = () => {
    clearTimeout(groupMenuTimerRef.current);
    groupMenuTimerRef.current = setTimeout(closeGroupMenu, 150);
  };

  // 상단 단일 탭 클릭 시 해당 화면으로 전환 (묶음 탭은 하위 메뉴에서 선택)
  const handleTopTabChange = (event, newTop) => {
    const group = tabGroups[newTop];
    if (group.children) return;
    handleTabChange(event, group.index);
  };

  // 하위 메뉴에서 화면을 선택해 전환하는 함수
  const handleGroupItemClick = (index) => {
    closeGroupMenu();
    handleTabChange(null, index);
  };

  // 구입요청 탭 인덱스를 배열에서 동적으로 찾아 하드코딩 없이 사용한다.
  // MenuManagementTab 주석 해제 시에도 자동으로 올바른 인덱스를 가리킨다.
  const PURCHASE_TAB_INDEX = tabLabels.findIndex((l) => l.includes("구매요청"));

  const tabComponents = [
    <HandoverSheetTab key="handover" />,
    <HygieneSheetTab key="hygiene" />,
    <PropertySheetTab key="property" />,
    // <MenuManagementTab key="menu-management" />,
    <AccountMembersFilesTab key="account-files" />,
    <RecordSheetTab key="record" />,
    <TallySheetTab key="tally" />,
    <DinersNumberSheetTab key="diner" />,
    <BranchUploadTab key="branch-upload" />,
    <PurchaseRequestTab
      key="purchase-request"
      isActive={tabIndex === PURCHASE_TAB_INDEX}
      openHistoryPaymentId={purchaseNotificationTarget.paymentId}
      openHistoryToken={purchaseNotificationTarget.token}
    />,
  ];

  // 승인·반려 알림을 누르면 구입요청 탭으로 전환하고 해당 상신 문서를 연다.
  const handleOpenPurchaseRequest = (paymentId) => {
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    setTabIndex(PURCHASE_TAB_INDEX);
    setContentTabIndex(PURCHASE_TAB_INDEX);
    setTabSwitchLoading(false);
    setPurchaseNotificationTarget({ paymentId, token: Date.now() });
  };
  const activeTabComponent = tabComponents[contentTabIndex] ?? tabComponents[tabIndex];

  return (
    <Card
      sx={{
        borderRadius: "16px",
        boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
      }}
    >
      <MDBox
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eee",
        }}
      >
        <HeaderWithLogout
          showMenuButton
          title="현장관리"
          rightContent={(
            <FieldBoardPurchaseNotificationButton
              onOpenPurchaseRequest={handleOpenPurchaseRequest}
              notice={isNoticePeriod() ? NOTICE_BELL_LABEL : ""}
              onOpenNotice={() => {
                setNoticeHideToday(false);
                setNoticeOpen(true);
              }}
            />
          )}
          onLogout={handleLogout}
        />

        <Tabs
          value={topTabIndex}
          onChange={handleTopTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            backgroundColor: "#f7f7f7",
            borderRadius: "0 0 0 0",
            "& .MuiTabs-indicator": {
              backgroundColor: "#ff9800",
              height: "3px",
              borderRadius: "3px",
            },
          }}
        >
          {tabGroups.map((group, groupIndex) => {
            const isGroup = Boolean(group.children);
            const active = topTabIndex === groupIndex;
            const label = isGroup ? group.label : tabLabels[group.index];
            return (
              <Tab
                key={isGroup ? group.label : label}
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <span>{label}</span>
                    {isGroup && <ChevronDown size={14} />}
                  </Box>
                }
                {...(isGroup && {
                  onClick: (e) => openGroupMenu(e.currentTarget, groupIndex),
                  onMouseEnter: (e) => openGroupMenu(e.currentTarget, groupIndex),
                  onMouseLeave: closeGroupMenuSoon,
                })}
                sx={{
                  fontSize: "0.8rem",
                  minWidth: 120,
                  textTransform: "none",
                  color: active ? "#ff9800" : "#666",
                  fontWeight: "bold",
                  transition: "0.2s",
                  "&:hover": {
                    color: "#ff9800",
                    opacity: 0.8,
                  },
                }}
              />
            );
          })}
        </Tabs>

        {/* 묶음 탭 하위 메뉴 (마우스 오버 또는 클릭 시 펼침) */}
        <Popper
          open={Boolean(groupMenu.anchor)}
          anchorEl={groupMenu.anchor}
          placement="bottom-start"
          sx={{ zIndex: 1300 }}
        >
          <ClickAwayListener
            onClickAway={(e) => {
              if (groupMenu.anchor?.contains(e.target)) return;
              closeGroupMenu();
            }}
          >
            <Paper
              onMouseEnter={() => clearTimeout(groupMenuTimerRef.current)}
              onMouseLeave={closeGroupMenuSoon}
              sx={{
                minWidth: groupMenu.anchor?.offsetWidth || 160,
                borderRadius: "10px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                overflow: "hidden",
              }}
            >
              <MenuList sx={{ py: 0.5 }}>
                {(tabGroups[groupMenu.groupIndex]?.children || []).map((index) => (
                  <MenuItem
                    key={tabLabels[index]}
                    selected={tabIndex === index}
                    onClick={() => handleGroupItemClick(index)}
                    sx={{
                      // 테마 MenuItem 기본값(minHeight unset, 좁은 여백)보다 우선 적용
                      minHeight: "44px !important",
                      py: "10px !important",
                      px: 2,
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                      color: tabIndex === index ? "#ff9800 !important" : "#666",
                      "&:hover": { color: "#ff9800 !important" },
                    }}
                  >
                    {tabLabels[index]}
                  </MenuItem>
                ))}
              </MenuList>
            </Paper>
          </ClickAwayListener>
        </Popper>
      </MDBox>

      <MDBox p={2} sx={{ position: "relative" }}>
        {activeTabComponent}
        {tabSwitchLoading && (
          <MDBox
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              "& .loading-container": {
                height: "100%",
              },
            }}
          >
            <LoadingScreen />
          </MDBox>
        )}
      </MDBox>

      {/* 현장관리 진입 공지 팝업 (이미지 + 제목/본문) */}
      <Dialog
        open={noticeOpen && (noticeImageLoaded || (noticeImageError && Boolean(NOTICE_CONTENT)))}
        onClose={handleNoticeClose}
        PaperProps={{
          sx: {
            width: "100%",
            maxWidth: 600,
            m: 2,
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(120, 70, 0, 0.18)",
          },
        }}
      >
        {/* 공지 상단 라벨, 제목 및 닫기 아이콘 영역 */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.5, pt: 2.25, pb: 1.5 }}>
          <Box
            sx={{
              flexShrink: 0,
              px: 1,
              py: 0.25,
              borderRadius: "999px",
              backgroundColor: "#fff3e0",
              color: "#e65100",
              fontSize: "0.72rem",
              fontWeight: 700,
            }}
          >
            공지
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, fontSize: "1.05rem", fontWeight: 700, color: "#222", wordBreak: "keep-all" }}>
            {NOTICE_TITLE}
          </Box>
          <IconButton size="small" onClick={handleNoticeClose} sx={{ color: "#888" }} aria-label="닫기">
            <X size={18} />
          </IconButton>
        </Box>

        <DialogContent sx={{ px: 2.5, pt: 0, pb: 2.5 }}>
          {/* 공지 이미지 영역: 누르면 공용 미리보기로 확대 */}
          {!noticeImageError && (
            <Box
              onClick={() => setNoticePreviewOpen(true)}
              sx={{
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid #f0e6da",
                backgroundColor: "#fafafa",
                cursor: "zoom-in",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": { transform: "translateY(-1px)", boxShadow: "0 8px 20px rgba(120, 70, 0, 0.12)" },
              }}
            >
              <img
                src={NOTICE_IMAGE_SRC}
                alt={NOTICE_TITLE || "공지 이미지"}
                style={{ display: "block", width: "100%", maxHeight: "55vh", objectFit: "contain" }}
                onError={() => setNoticeImageError(true)}
              />
            </Box>
          )}
          {!noticeImageError && (
            <Box
              sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5, mt: 0.75, color: "#999", fontSize: "0.75rem" }}
            >
              <ZoomIn size={13} />
              이미지를 누르면 크게 볼 수 있습니다
            </Box>
          )}
          {/* 공지 본문 영역 */}
          {NOTICE_CONTENT && (
            <Box
              sx={{
                mt: noticeImageError ? 0 : 1.5,
                fontSize: "0.875rem",
                lineHeight: 1.7,
                color: "#4b4b4b",
                wordBreak: "keep-all",
              }}
            >
              {NOTICE_CONTENT}
            </Box>
          )}
        </DialogContent>
        {/* 24시간 동안 안보이기 체크 및 닫기 버튼 영역 */}
        <DialogActions
          sx={{
            justifyContent: "space-between",
            px: 2.5,
            py: 1.25,
            borderTop: "1px solid #f2f2f2",
            backgroundColor: "#fcfcfc",
          }}
        >
          <FormControlLabel
            control={(
              <Checkbox
                size="small"
                checked={noticeHideToday}
                onChange={(e) => setNoticeHideToday(e.target.checked)}
                sx={{ p: 0.5, mr: 0.5, color: "#bbb", "&.Mui-checked": { color: "#ff9800" } }}
              />
            )}
            label="24시간 동안 안보이기"
            sx={{
              m: 0,
              display: "flex",
              alignItems: "center",
              "& .MuiFormControlLabel-label": { fontSize: "0.85rem", lineHeight: 1, color: "#666" },
            }}
          />
          <Button
            variant="contained"
            onClick={handleNoticeClose}
            sx={{
              minWidth: 84,
              borderRadius: "8px",
              boxShadow: "none",
              backgroundColor: "#ff9800",
              color: "#fff !important",
              fontWeight: 700,
              "&:hover": { backgroundColor: "#f57c00", boxShadow: "none" },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 공지 이미지 확대 미리보기 */}
      <PreviewOverlay
        open={noticePreviewOpen}
        files={noticePreviewFiles}
        currentIndex={0}
        onClose={() => setNoticePreviewOpen(false)}
        anchorX={1 / 2}
      />
    </Card>
  );
}

export default FieldBoardTabs;
