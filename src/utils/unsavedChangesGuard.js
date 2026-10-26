import Swal from "sweetalert2";

// 미저장 변경 확인 모달 (회계 화면과 같은 문구·버튼)
// 반환값: "save"(저장 후 이동) | "discard"(취소 후 이동) | "cancel"(취소, 그대로 머무름)
export async function askUnsavedChanges() {
  const result = await Swal.fire({
    title: "미저장 변경사항이 있습니다.",
    text: "저장 후 이동하시겠습니까?",
    icon: "warning",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: "저장 후 이동",
    denyButtonText: "취소 후 이동",
    cancelButtonText: "취소",
    confirmButtonColor: "#1976d2",
    denyButtonColor: "#e53935",
    cancelButtonColor: "#9e9e9e",
    // 바깥(검은 배경) 클릭으로 닫히지 않고 버튼으로만 선택
    allowOutsideClick: false,
  });

  if (result.isConfirmed) return "save";
  if (result.isDenied) return "discard";
  return "cancel";
}

// 현재 열린 탭 화면이 등록한 "탭 이동 전 확인" 함수 (true를 돌려주면 이동 가능)
let tabLeaveGuard = null;

// 탭 화면이 이동 전 확인 함수를 등록 (반환값: 등록 해제 함수, useEffect 정리 함수로 사용)
export function setTabLeaveGuard(guard) {
  tabLeaveGuard = guard;
  return () => {
    if (tabLeaveGuard === guard) tabLeaveGuard = null;
  };
}

// 탭 묶음에서 탭을 바꾸기 전에 호출 (등록된 확인 함수가 없으면 바로 이동)
export async function confirmTabLeave() {
  return tabLeaveGuard ? tabLeaveGuard() : true;
}
