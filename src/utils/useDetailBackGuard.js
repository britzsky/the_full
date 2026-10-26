import { useEffect, useRef } from "react";

// 상세 화면에서 브라우저 뒤로가기를 누르면 페이지를 떠나지 않고 전체(요약) 화면으로 돌아가게 하는 훅
// 상세 화면에 들어갈 때 같은 주소로 기록을 하나 쌓아 두고, 뒤로가기(popstate) 때 onBack을 호출
// isDetail: 상세 화면 여부
// onBack: 전체 화면으로 이동하는 함수 (미저장 확인에서 취소하면 false 반환 → 상세 화면 유지)
// 법인차량·위생관리(운영·현장) 상세 화면에서 사용
export default function useDetailBackGuard(isDetail, onBack) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isDetail) return undefined;

    // 라우터 기록 정보(state)는 그대로 두고 상세 화면 표시만 덧붙여 같은 주소로 기록 추가
    const pushDetailState = () => window.history.pushState({ ...window.history.state, detailView: true }, "");
    pushDetailState();

    const handlePopState = async () => {
      const moved = await onBackRef.current();
      // 미저장 확인에서 취소: 상세 화면 유지, 다음 뒤로가기도 다시 막도록 기록 재추가
      if (moved === false) pushDetailState();
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // 전체로 이동 버튼 등 뒤로가기 없이 상세 화면을 벗어나면 쌓아 둔 기록 제거
      // (다른 메뉴로 이동해 현재 기록이 바뀐 경우는 제거하지 않음)
      if (window.history.state?.detailView) window.history.back();
    };
  }, [isDetail]);
}
