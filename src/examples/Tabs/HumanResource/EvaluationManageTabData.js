import { useCallback, useState } from "react";
import api from "api/api";

export default function useEvaluationManageData() {
  const [rows, setRows]                   = useState([]);
  const [loading, setLoading]             = useState(false);
  const [detail, setDetail]               = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [evaluationFiles, setEvaluationFiles] = useState([]);

  const loadList = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await api.get("/HeadOffice/EvaluationList", { params });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("평가 목록 조회 실패:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (idx) => {
    setDetailLoading(true);
    try {
      const res = await api.get("/HeadOffice/EvaluationDetailWithFiles", { params: { idx } });
      const detailData = Array.isArray(res.data?.detail) ? res.data.detail : [];
      const filesData  = Array.isArray(res.data?.files)  ? res.data.files  : [];
      setDetail(detailData);
      setEvaluationFiles(filesData);
      return detailData;
    } catch (e) {
      console.error("평가 상세 조회 실패:", e);
      setDetail([]);
      setEvaluationFiles([]);
      return [];
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const deleteEvaluation = useCallback(async ({ idx }) => {
    setLoading(true);
    try {
      await api.post("/HeadOffice/EvaluationDelete", { idx });
      return true;
    } catch (e) {
      console.error("평가 삭제 실패:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmTeamLeader = useCallback(async ({ idx, userName, opinion }) => {
    setSaving(true);
    try {
      await api.post("/HeadOffice/EvaluationTeamLeaderConfirm", {
        idx, user_name: userName, opinion: opinion || "",
      });
      return true;
    } catch (e) {
      console.error("팀장 확인 처리 실패:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const confirmHpLeader = useCallback(async ({ idx, userName, opinion }) => {
    setSaving(true);
    try {
      await api.post("/HeadOffice/EvaluationHpLeaderConfirm", {
        idx, user_name: userName, opinion: opinion || "",
      });
      return true;
    } catch (e) {
      console.error("실장 확인 처리 실패:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const confirmHrLeader = useCallback(async ({ idx, userName }) => {
    setSaving(true);
    try {
      await api.post("/HeadOffice/EvaluationHrLeaderConfirm", { idx, user_name: userName });
      return true;
    } catch (e) {
      console.error("인사팀장 확인 처리 실패:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const confirmCeoLeader = useCallback(async ({ idx, userName }) => {
    setSaving(true);
    try {
      await api.post("/HeadOffice/EvaluationCeoLeaderConfirm", { idx, user_name: userName });
      return true;
    } catch (e) {
      console.error("대표 확인 처리 실패:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updatePerformance = useCallback(async ({ items }) => {
    setSaving(true);
    try {
      await api.post("/HeadOffice/EvaluationPerformanceUpdate", { items });
      return true;
    } catch (e) {
      console.error("실적 업데이트 실패:", e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const clearEvaluationFiles = useCallback(() => {
    setEvaluationFiles([]);
    setDetail(null);
  }, []);

  const fetchEvaluationNotifications = useCallback(async (userId) => {
    if (!userId) return [];
    try {
      const res = await api.get("/HeadOffice/EvaluationNotificationList", {
        params: { user_id: userId },
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error("KPI 평가 알림 조회 실패:", e);
      return [];
    }
  }, []);

  const markEvaluationNotificationRead = useCallback(async ({ idx, userId, notifyType }) => {
    if (!idx || !userId || !notifyType) return;
    try {
      await api.post("/HeadOffice/EvaluationNotificationReadSave", {
        idx, user_id: userId, notify_type: notifyType,
      });
    } catch (e) {
      console.error("KPI 평가 알림 읽음 처리 실패:", e);
    }
  }, []);

  return {
    rows, loading, detail, detailLoading, saving, evaluationFiles,
    loadList, loadDetail, deleteEvaluation,
    confirmTeamLeader, confirmHpLeader, confirmHrLeader, confirmCeoLeader,
    updatePerformance, clearEvaluationFiles,
    fetchEvaluationNotifications, markEvaluationNotificationRead,
  };
}
