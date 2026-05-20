import { useCallback, useState } from "react";
import api from "api/api";

export default function useHeadofficeNoticeData() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noticeFiles, setNoticeFiles] = useState([]);

  // GET /HeadOffice/NoticeList
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/HeadOffice/NoticeList");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("공지사항 목록 조회 실패:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // GET /HeadOffice/NoticeDetail?idx={idx}
  const loadDetail = useCallback(async (idx) => {
    setDetailLoading(true);
    try {
      const [detailRes, filesRes] = await Promise.all([
        api.get("/HeadOffice/NoticeDetail", { params: { idx } }),
        api.get("/HeadOffice/NoticeFileList", { params: { notice_idx: idx } }),
      ]);
      setDetail(detailRes.data || null);
      setNoticeFiles(Array.isArray(filesRes.data) ? filesRes.data : []);
      return detailRes.data || null;
    } catch (e) {
      console.error("공지사항 상세 조회 실패:", e);
      setDetail(null);
      setNoticeFiles([]);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // POST /HeadOffice/NoticeSave (upsert)
  // 반환값: { ok: true, idx } | { ok: false }
  const saveNotice = useCallback(async ({ editIdx, title, content, largeType, middleType, expireDt, userId }) => {
    setSaving(true);
    try {
      const res = await api.post("/HeadOffice/NoticeSave", {
        idx: editIdx || null,
        title,
        content,
        large_type: largeType,
        middle_type: middleType,
        expire_dt: expireDt || null,
        user_id: userId,
      });
      const idx = res.data?.idx ? Number(res.data.idx) : (editIdx || null);
      return { ok: true, idx };
    } catch (e) {
      console.error("공지사항 저장 실패:", e);
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, []);

  // POST /HeadOffice/NoticeDelete
  const deleteNotice = useCallback(async ({ idx, userId }) => {
    setLoading(true);
    try {
      await api.post("/HeadOffice/NoticeDelete", { idx, user_id: userId });
      return true;
    } catch (e) {
      console.error("공지사항 삭제 실패:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 첨부파일 동기화: 삭제 대상 삭제 후 신규 파일 업로드
  // pendingFiles: Array<{ file: File, name: string }>
  // deletedFileOrders: Set<number> (삭제할 image_order)
  const syncNoticeFiles = useCallback(async ({ noticeIdx, pendingFiles, deletedFileOrders, existingFiles }) => {
    if (!noticeIdx) return;

    // 삭제
    const toDelete = (existingFiles || []).filter((f) => deletedFileOrders.has(Number(f.image_order)));
    for (const f of toDelete) {
      try {
        await api.delete("/HeadOffice/NoticeFileDelete", {
          params: { notice_idx: noticeIdx, image_order: f.image_order, image_path: f.image_path || "" },
        });
      } catch (e) {
        console.error("공지 파일 삭제 실패:", e);
      }
    }

    // 업로드
    if (pendingFiles && pendingFiles.length > 0) {
      const formData = new FormData();
      formData.append("notice_idx", String(noticeIdx));
      pendingFiles.forEach((pf) => formData.append("files", pf.file));
      try {
        await api.post("/HeadOffice/NoticeFilesUpload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch (e) {
        console.error("공지 파일 업로드 실패:", e);
      }
    }
  }, []);

  // 신규 작성 시 이전 상세 첨부파일 초기화용
  const clearNoticeFiles = useCallback(() => {
    setNoticeFiles([]);
    setDetail(null);
  }, []);

  return {
    rows,
    loading,
    detail,
    detailLoading,
    saving,
    noticeFiles,
    loadList,
    loadDetail,
    saveNotice,
    deleteNotice,
    syncNoticeFiles,
    clearNoticeFiles,
  };
}
