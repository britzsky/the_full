import { useCallback, useState } from "react";
import api from "api/api";

// 인사 -> 교육 데이터 관리 커스텀 훅
// 목록/상세/저장/삭제/첨부파일 동기화 기능을 한 곳에서 제공
export default function useEducationData() {
  const [rows, setRows] = useState([]);               // 교육 목록 데이터
  const [loading, setLoading] = useState(false);      // 목록/삭제 로딩 상태
  const [detail, setDetail] = useState(null);         // 선택된 교육 상세 데이터
  const [detailLoading, setDetailLoading] = useState(false); // 상세 조회 로딩 상태
  const [saving, setSaving] = useState(false);        // 저장 중 상태 (버튼 비활성화용)
  const [educationFiles, setEducationFiles] = useState([]); // 상세/수정 뷰의 첨부파일 목록

  // 교육 목록 조회 (GET /Education/EducationList)
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/Education/EducationList");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("교육 목록 조회 실패:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 교육 상세 조회 + 첨부파일 목록 동시 조회 (Promise.all로 병렬 처리)
  // GET /Education/EducationDetail?idx={idx}
  // GET /Education/EducationFileList?education_idx={idx}
  const loadDetail = useCallback(async (idx) => {
    setDetailLoading(true);
    try {
      const [detailRes, filesRes] = await Promise.all([
        api.get("/Education/EducationDetail", { params: { idx } }),
        api.get("/Education/EducationFileList", { params: { education_idx: idx } }),
      ]);
      setDetail(detailRes.data || null);
      setEducationFiles(Array.isArray(filesRes.data) ? filesRes.data : []);
      return detailRes.data || null;
    } catch (e) {
      console.error("교육 상세 조회 실패:", e);
      setDetail(null);
      setEducationFiles([]);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 교육 등록/수정 (POST /Education/EducationSave)
  // editIdx가 null이면 신규 등록, 값이 있으면 수정 (upsert)
  // 반환값: { ok: true, idx } | { ok: false }
  const saveEducation = useCallback(async ({ editIdx, title, content, largeType, userId }) => {
    setSaving(true);
    try {
      const res = await api.post("/Education/EducationSave", {
        idx: editIdx || null,
        title,
        content,
        large_type: largeType,
        user_id: userId,
      });
      // 신규 등록 시 백엔드에서 생성된 idx 반환, 수정 시 기존 editIdx 사용
      const idx = res.data?.idx ? Number(res.data.idx) : (editIdx || null);
      return { ok: true, idx };
    } catch (e) {
      console.error("교육 저장 실패:", e);
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, []);

  // 교육 삭제 (POST /Education/EducationDelete)
  // 실제 삭제가 아닌 del_yn = 'Y' 소프트 삭제
  const deleteEducation = useCallback(async ({ idx, userId }) => {
    setLoading(true);
    try {
      await api.post("/Education/EducationDelete", { idx, user_id: userId });
      return true;
    } catch (e) {
      console.error("교육 삭제 실패:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 첨부파일 동기화: 삭제 예약 파일 먼저 삭제 → 신규 파일 업로드
  // pendingFiles: 새로 선택한 파일 배열 { file, name, previewUrl }
  // deletedFileOrders: 삭제할 기존 파일의 image_order Set
  // existingFiles: 현재 서버에 저장된 파일 목록
  const syncEducationFiles = useCallback(async ({ educationIdx, pendingFiles, deletedFileOrders, existingFiles }) => {
    if (!educationIdx) return;

    // 삭제 예약된 기존 파일 순차 삭제
    const toDelete = (existingFiles || []).filter((f) => deletedFileOrders.has(Number(f.image_order)));
    for (const f of toDelete) {
      try {
        await api.delete("/Education/EducationFileDelete", {
          params: { education_idx: educationIdx, image_order: f.image_order, image_path: f.image_path || "" },
        });
      } catch (e) {
        console.error("교육 파일 삭제 실패:", e);
      }
    }

    // 신규 선택 파일 일괄 업로드 (FormData multipart)
    if (pendingFiles && pendingFiles.length > 0) {
      const formData = new FormData();
      formData.append("education_idx", String(educationIdx));
      pendingFiles.forEach((pf) => formData.append("files", pf.file));
      try {
        await api.post("/Education/EducationFilesUpload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch (e) {
        console.error("교육 파일 업로드 실패:", e);
      }
    }
  }, []);

  // 신규 작성 전환 시 이전 상세 데이터/첨부파일 초기화
  const clearEducationFiles = useCallback(() => {
    setEducationFiles([]);
    setDetail(null);
  }, []);

  return {
    rows,
    loading,
    detail,
    detailLoading,
    saving,
    educationFiles,
    loadList,
    loadDetail,
    saveEducation,
    deleteEducation,
    syncEducationFiles,
    clearEducationFiles,
  };
}
