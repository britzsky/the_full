import { useCallback, useState } from "react";
import api from "api/api";

export default function useEvaluationTypeSettingData() {
  const [saving, setSaving] = useState(false);

  // 평가문서 설정 목록을 조회하는 함수
  const fetchEvaluationTypeList = useCallback(async () => {
    try {
      const res = await api.get("/HeadOffice/EvaluationTypeList");
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error("평가문서 설정 목록 조회 실패:", e);
      return [];
    }
  }, []);

  // 평가문서 설정을 등록하거나 수정하는 함수
  const saveEvaluationType = useCallback(async (payload) => {
    setSaving(true);
    try {
      const res = await api.post("/HeadOffice/EvaluationTypeSave", payload);
      return res.data?.code === 200;
    } catch (e) {
      console.error("평가문서 설정 저장 실패:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // 선택한 평가문서 설정을 삭제 처리하는 함수
  const deleteEvaluationType = useCallback(async ({ docId }) => {
    setSaving(true);
    try {
      const res = await api.post("/HeadOffice/EvaluationTypeDelete", { doc_id: docId });
      return res.data?.code === 200;
    } catch (e) {
      console.error("평가문서 설정 삭제 실패:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    saving,
    fetchEvaluationTypeList,
    saveEvaluationType,
    deleteEvaluationType,
  };
}
