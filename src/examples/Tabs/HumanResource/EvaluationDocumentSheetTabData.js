import { useCallback, useState } from "react";
import api from "api/api";

export default function useEvaluationDocumentSheetData() {
  const [saving, setSaving]               = useState(false);
  const [evaluationFiles, setEvaluationFiles] = useState([]);

  const saveEvaluation = useCallback(async ({ userId, startTime, endTime, items, docType, chargeSign, tmUser, hrUser, hpUser, ceoUser, editIdx }) => {
    setSaving(true);
    try {
      const res = await api.post("/HeadOffice/EvaluationSave", {
        user_id:     userId,
        start_time:  startTime,
        end_time:    endTime,
        items,
        doc_type:    docType    || "",
        charge_sign: chargeSign || "",
        tm_user:     tmUser     || "",
        hr_user:     hrUser     || "",
        hp_user:     hpUser     || "",
        ceo_user:    ceoUser    || "",
        edit_idx:    editIdx    || "",
      });
      const firstIdx = res.data?.first_idx ? Number(res.data.first_idx) : null;
      return { ok: true, idx: firstIdx };
    } catch (e) {
      console.error("평가 저장 실패:", e);
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, []);

  const syncEvaluationFiles = useCallback(async ({
    evaluationIdx, pendingFiles, deletedFileOrders, existingFiles,
  }) => {
    if (!evaluationIdx) return;

    const toDelete = (existingFiles || []).filter(
      (f) => deletedFileOrders.has(Number(f.image_order))
    );
    for (const f of toDelete) {
      try {
        await api.delete("/HeadOffice/EvaluationFileDelete", {
          params: {
            evaluation_idx: evaluationIdx,
            image_order:    f.image_order,
            image_path:     f.image_path || "",
          },
        });
      } catch (e) {
        console.error("평가 파일 삭제 실패:", e);
      }
    }

    if (pendingFiles && pendingFiles.length > 0) {
      const formData = new FormData();
      formData.append("evaluation_idx", String(evaluationIdx));
      pendingFiles.forEach((pf) => {
        formData.append("files", pf.file);
        formData.append("kpi_rows", String(pf.kpiRowIndex));
      });
      try {
        await api.post("/HeadOffice/EvaluationFilesUpload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch (e) {
        console.error("평가 파일 업로드 실패:", e);
      }
    }
  }, []);

  const fetchEvaluationFormInit = useCallback(async () => {
    try {
      const res = await api.get("/HeadOffice/EvaluationFormInit");
      return {
        types: Array.isArray(res.data?.types) ? res.data.types : [],
        users: Array.isArray(res.data?.users) ? res.data.users : [],
      };
    } catch (e) {
      console.error("평가 폼 초기화 실패:", e);
      return { types: [], users: [] };
    }
  }, []);

  return {
    saving, evaluationFiles, setEvaluationFiles,
    saveEvaluation, syncEvaluationFiles, fetchEvaluationFormInit,
  };
}
