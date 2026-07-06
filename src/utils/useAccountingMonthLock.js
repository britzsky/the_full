import { useState, useEffect, useCallback, useMemo } from "react";
import dayjs from "dayjs";
import api from "api/api";
import Swal from "sweetalert2";

// 수정권한 부여 가능한 user_id 목록
const OVERRIDE_USERS = ["hh2", "mh3", "ww1", "britzsky", "ceo"];

/**
 * 회계 월 마감 잠금 훅
 *
 * type 구분 (숫자):
 *   1 = 거래처 자료 입력   (AccountPurchaseDeadlineTab)
 *   2 = 본사 법인카드      (corporatecardsheet)
 *   3 = 현장 법인카드      (accountcorporatecardsheet)
 *   4 = 개인구매 관리      (accountpersonpurchasesheet)
 *
 * - 선택한 연월의 말일이 지나면 자동으로 잠금 (isAutoLocked)
 * - DB override가 있으면 잠금 해제 (isOverride)
 * - isLocked = isAutoLocked && !isOverride
 * - OVERRIDE_USERS에 속한 user_id만 toggleOverride 가능 (canOverride)
 *
 *   GET  /Accounting/MonthLockOverride?account_id=&year=&month=&type=
 *        → { is_override: 0 | 1 }
 *   POST /Accounting/MonthLockOverride
 *        → body: { account_id, year, month, type, is_override, user_id }
 *
 * DB 테이블: tb_account_month_lock
 *   id          INT          PK AUTO_INCREMENT
 *   account_id  VARCHAR(50)  거래처 ID
 *   year        VARCHAR(4)   연도 (예: "2026")
 *   month       VARCHAR(2)   월 (예: "5", "12")
 *   type        INT          1=거래처 자료 입력, 2=본사 법인카드, 3=현장 법인카드, 4=개인구매 관리
 *   is_override INT(1)       0=잠금유지, 1=수정허용
 *   updated_by  VARCHAR(50)  수정한 user_id
 *   updated_at  DATETIME     마지막 변경 일시
 *   UNIQUE KEY uk_lock (account_id, year, month, type)
 */
export default function useAccountingMonthLock({ accountId, year, month, type }) {
  const userId = useMemo(() => localStorage.getItem("user_id") || "", []);
  const canOverride = useMemo(() => OVERRIDE_USERS.includes(userId), [userId]);

  // 자동 마감: 현재 날짜가 선택 연월의 말일을 지났는가
  // ⚠️ [잠금 임시 해제] 아래 블록 주석을 해제하면 다음 달 4일부터 자동 잠금 재활성화됨
  const isAutoLocked = false;
  /* === 잠금 로직 (복원 시 아래 주석 해제 + 위 isAutoLocked = false 줄 삭제) ===
  const isAutoLocked = useMemo(() => {
    if (!year || !month) return false;
    const lockDate = dayjs(`${year}-${String(month).padStart(2, "0")}-01`)
      .add(1, "month")
      .date(3);
    return dayjs().isAfter(lockDate, "day");
  }, [year, month]);
  === 잠금 로직 끝 === */

  const [isOverride, setIsOverride] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);

  const fetchOverride = useCallback(async () => {
    if (!accountId || !year || !month || !type || !isAutoLocked) {
      setIsOverride(false);
      return;
    }
    try {
      const res = await api.get("/Accounting/MonthLockOverride", {
        params: { account_id: accountId, year: String(year), month: String(month), type },
      });
      setIsOverride(res.data?.is_override === 1 || res.data?.is_override === true);
    } catch {
      setIsOverride(false);
    }
  }, [accountId, year, month, type, isAutoLocked]);

  useEffect(() => {
    fetchOverride();
  }, [fetchOverride]);

  // 자동 잠금이면서 override가 없을 때만 진짜 잠김
  const isLocked = isAutoLocked && !isOverride;

  const toggleOverride = useCallback(async () => {
    if (!canOverride || !accountId || !year || !month || !type) return;

    const next = !isOverride;
    // 낙관적 업데이트: UI 먼저 반영
    setIsOverride(next);
    setOverrideLoading(true);
    try {
      await api.post("/Accounting/MonthLockOverride", {
        account_id: accountId,
        year: String(year),
        month: String(month),
        type,
        is_override: next ? 1 : 0,
        user_id: userId,
      });
    } catch (e) {
      // 실패 시 원상 복구
      setIsOverride(!next);
      Swal.fire("오류", e?.response?.data?.message || "수정권한 변경에 실패했습니다.", "error");
    } finally {
      setOverrideLoading(false);
    }
  }, [canOverride, accountId, year, month, type, isOverride, userId]);

  // 저장 완료 후 수정권한 자동 회수
  const revokeOverride = useCallback(async () => {
    if (!isOverride || !accountId || !year || !month || !type) return;
    setIsOverride(false);
    try {
      await api.post("/Accounting/MonthLockOverride", {
        account_id: accountId,
        year: String(year),
        month: String(month),
        type,
        is_override: 0,
        user_id: userId,
      });
    } catch {
      // 실패해도 UI는 잠금 상태 유지
    }
  }, [isOverride, accountId, year, month, type, userId]);

  return { isLocked, isAutoLocked, isOverride, canOverride, toggleOverride, overrideLoading, revokeOverride };
}
