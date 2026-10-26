import Swal from "sweetalert2";

// 바깥(검은 배경) 클릭으로 닫히지 않는 Swal (버튼으로만 닫힘, 저장·업로드 화면의 알림·확인창에 사용)
// Swal과 같은 방식으로 사용 (LockedSwal.fire, LockedSwal.close 등)
export const LockedSwal = Swal.mixin({ allowOutsideClick: false });

// 저장·업로드 진행 중 로딩 스피너 창 (바깥 클릭·ESC로 닫히지 않음, 결과 알림을 띄우면 그 창으로 교체됨)
export function showSwalLoading(title = "저장 중...", text = "잠시만 기다려 주세요.") {
  Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });
}

// 로딩 창 진행 문구 변경 (showConfirmButton을 다시 지정해야 확인 버튼 없이 스피너 유지)
export function updateSwalLoading(text) {
  Swal.update({ text, showConfirmButton: false });
  Swal.showLoading();
}
