/* eslint-disable react/function-component-definition */
import React, { useCallback, useEffect, useState } from "react";
import { Badge, Divider, Icon, IconButton, Menu } from "@mui/material";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";

import api from "api/api";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import NotificationItem from "examples/Items/NotificationItem";
import PropTypes from "prop-types";

// 현장 영양사 전용 구입요청서 승인·반려 알림 버튼
function FieldBoardPurchaseNotificationButton({ onOpenPurchaseRequest }) {
  // 화면을 새로고침하지 않고 결재 결과를 갱신하기 위한 알림 조회 주기
  const NOTIFICATION_POLL_MS = 30000;
  // 구입요청서 작성자 기준 알림 조회 및 읽음 처리에 사용하는 로그인 사용자 식별값
  const userId = String(localStorage.getItem("user_id") ?? "").trim();
  // 알림 메뉴의 표시 위치와 열림 상태를 관리하는 기준 요소
  const [anchorEl, setAnchorEl] = useState(null);
  // 로그인 영양사가 작성한 FP 구입요청서의 미확인 승인·반려 알림 목록
  const [notifications, setNotifications] = useState([]);

  // 전자결재 알림에서 FP 문서번호의 승인·반려 결과만 추려 표시한다.
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    try {
      // 공통 전자결재 알림과 동일한 호출 방식으로 조회해 실행 중인 기존 백엔드와도 호환한다.
      const response = await api.get("/HeadOffice/ElectronicPaymentNotificationList", {
        params: { user_id: userId, doc_type: "FP" },
      });
      const rows = Array.isArray(response.data) ? response.data : [];
      setNotifications(
        rows.filter((row) => {
          const paymentId = String(row?.payment_id ?? "").trim().toUpperCase();
          const notifyType = String(row?.notify_type ?? "").trim();
          return paymentId.startsWith("FP-") && ["승인", "반려"].includes(notifyType);
        })
      );
    } catch (error) {
      console.error("구입요청서 결재 알림 조회 실패:", error);
      setNotifications([]);
    }
  }, [userId]);

  // 최초 진입, 30초 주기, 브라우저 화면 재활성화 시점의 알림 자동 갱신
  useEffect(() => {
    fetchNotifications();

    // 브라우저 화면이 보이는 동안에만 실행되는 주기적 알림 조회
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchNotifications();
    }, NOTIFICATION_POLL_MS);

    // 다른 탭에서 현장관리 화면으로 돌아온 시점의 즉시 알림 조회
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 화면 이탈 시 알림 조회 타이머와 브라우저 이벤트 정리
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotifications]);

  // 선택한 구입요청서 알림을 읽음 처리한 뒤 작성자 본인의 상신 상세를 연다.
  const handleNotificationClick = async (notification) => {
    // 읽음 처리 대상을 구분하기 위한 결재문서 번호와 알림 유형
    const paymentId = String(notification?.payment_id ?? "").trim();
    const notifyType = String(notification?.notify_type ?? "").trim();
    if (!paymentId || !userId) return;

    try {
      await api.post("/HeadOffice/ElectronicPaymentNotificationReadSave", {
        payment_id: paymentId,
        user_id: userId,
        notify_type: notifyType,
      });
      // 읽음 저장이 완료된 동일 문서번호·알림유형 항목의 화면 목록 제거
      setNotifications((previous) =>
        previous.filter(
          (row) =>
            String(row?.payment_id ?? "").trim() !== paymentId ||
            String(row?.notify_type ?? "").trim() !== notifyType
        )
      );
      setAnchorEl(null);
    } catch (error) {
      console.error("구입요청서 결재 알림 읽음 처리 실패:", error);
    }

    // 읽음 처리 API 실패 여부와 관계없이 사용자가 선택한 문서는 확인할 수 있게 이동한다.
    onOpenPurchaseRequest(paymentId);
  };

  return (
    <>
      {/* 로그아웃 버튼과 간격을 두고 배치한 알림 개수 배지 및 메뉴 열기 버튼 */}
      <IconButton
        size="medium"
        disableRipple
        onClick={(event) => {
          setAnchorEl(event.currentTarget);
          fetchNotifications();
        }}
        aria-controls="fieldboard-purchase-notification-menu"
        aria-haspopup="true"
        sx={{ color: "#fff", mr: 1 }}
      >
        <Badge
          badgeContent={notifications.length}
          color="error"
          max={99}
          invisible={notifications.length === 0}
          sx={{
            "& .MuiBadge-badge": {
              transform: "translate(60%, -34%)",
              ...(notifications.length > 0
                ? {
                  animation: "fieldboardNotificationBlink 1.1s infinite",
                  boxShadow: "0 0 0 0 rgba(255,255,255,0.0)",
                }
                : {}),
            },
            "& .MuiBadge-badge.MuiBadge-invisible": {
              display: "none",
            },
            "@keyframes fieldboardNotificationBlink": {
              "0%": { opacity: 1, boxShadow: "0 0 0 0 rgba(255,255,255,0.0)" },
              "50%": { opacity: 0.9, boxShadow: "0 0 10px 2px rgba(255,255,255,0.55)" },
              "100%": { opacity: 1, boxShadow: "0 0 0 0 rgba(255,255,255,0.0)" },
            },
          }}
        >
          <Icon>notifications</Icon>
        </Badge>
      </IconButton>

      {/* 구입요청서 승인·반려 결과만 표시하는 현장 영양사 전용 알림 메뉴 */}
      <Menu
        id="fieldboard-purchase-notification-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{
          mt: 1,
          "& .MuiPaper-root": {
            width: 440,
            maxWidth: "calc(100vw - 24px)",
            borderRadius: "12px",
          },
          // 긴 문서번호와 결재 결과가 말줄임 없이 여러 줄로 표시되도록 한다.
          "& .MuiMenuItem-root": {
            whiteSpace: "normal",
            px: 2,
            py: 0.75,
          },
          "& .MuiMenuItem-root > .MuiBox-root": {
            width: "100%",
            minWidth: 0,
            alignItems: "flex-start",
          },
          "& .MuiMenuItem-root > .MuiBox-root > .MuiTypography-root:last-child": {
            flex: 1,
            minWidth: 0,
            whiteSpace: "normal",
            overflowWrap: "anywhere",
            lineHeight: 1.45,
          },
        }}
      >
        {/* 알림 메뉴 제목 영역 */}
        <MDBox px={2} py={1}>
          <MDTypography variant="button" fontWeight="bold">
            구입요청 결재 알림
          </MDTypography>
        </MDBox>
        <Divider sx={{ my: 0 }} />

        {/* 미확인 알림 유무에 따른 빈 안내 또는 결재 결과 목록 영역 */}
        {notifications.length === 0 ? (
          <MDBox px={2} py={1.5}>
            <MDTypography variant="button" color="text">
              새로운 알림이 없습니다.
            </MDTypography>
          </MDBox>
        ) : (
          notifications.map((notification, index) => (
            <NotificationItem
              key={`${notification.payment_id || "purchase"}-${notification.notify_type}-${index}`}
              icon={<ArrowRightIcon />}
              title={notification.notify_message || "전자결재 결과가 변경되었습니다."}
              onClick={() => handleNotificationClick(notification)}
            />
          ))
        )}
      </Menu>
    </>
  );
}

FieldBoardPurchaseNotificationButton.propTypes = {
  onOpenPurchaseRequest: PropTypes.func.isRequired,
};

export default FieldBoardPurchaseNotificationButton;
