/* eslint-disable react/function-component-definition */
import { useState, useCallback } from "react";
import api from "api/api";

// 강남(20250819193630) 삼성웰스토리 type 3/4 예외 라벨
const GANGNAM_ACCOUNT_ID = "20250819193630";
const GANGNAM_TYPE_LABELS = { "3": "삼성웰스토리(주) 3층", "4": "삼성웰스토리(주) 7층" };

// 타입 옵션 정규화: 서버 응답 → [{value, label}] 변환 + 강남 예외처리 + 1002/1003 보강
const normalizeTypeOptions = (data, accountId) => {
  const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

  const mapped = arr
    .map((x) => {
      const value = x?.type ?? x?.account_type ?? x?.mapping_type ?? x?.code ?? x?.value ?? x?.id;
      const delYn = String(x?.del_yn ?? "N");
      const label =
        x?.type_name ?? x?.account_type_name ?? x?.mapping_name ?? x?.name ?? x?.label ??
        x?.text ?? x?.value_name ?? x?.type ?? x?.account_type ?? x?.code ?? x?.value;
      if (value === null || value === undefined || String(value).trim() === "") return null;

      const strValue = String(value);
      const resolvedLabel =
        String(accountId) === GANGNAM_ACCOUNT_ID && GANGNAM_TYPE_LABELS[strValue]
          ? GANGNAM_TYPE_LABELS[strValue]
          : String(label ?? value);

      return { value: strValue, label: resolvedLabel, del_yn: delYn };
    })
    .filter((x) => x && String(x.del_yn) !== "Y");

  // 중복 제거
  const uniq = [];
  const seen = new Set();
  for (const o of mapped) {
    if (seen.has(o.value)) continue;
    seen.add(o.value);
    uniq.push({ value: o.value, label: o.label });
  }

  // 기타 타입(1002/1003)이 응답에서 누락됐으나 del_yn=Y도 아닌 경우 기본값 보강
  const blockedSpecial = new Set(
    arr
      .map((x) => ({ type: String(x?.type ?? x?.value ?? ""), del_yn: String(x?.del_yn ?? "N") }))
      .filter((x) => (x.type === "1002" || x.type === "1003") && x.del_yn === "Y")
      .map((x) => x.type)
  );
  if (!seen.has("1002") && !blockedSpecial.has("1002")) {
    uniq.push({ value: "1002", label: "기타경비" });
  }
  if (!seen.has("1003") && !blockedSpecial.has("1003")) {
    uniq.push({ value: "1003", label: "기타" });
  }

  uniq.sort((a, b) => {
    const an = Number(a.value);
    const bn = Number(b.value);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return String(a.value).localeCompare(String(b.value), "ko");
  });
  return uniq;
};

// 숫자 파싱
const parseNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/,/g, "")) || 0;
};

// 숫자 포맷
const formatNumber = (value) => {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString();
};

export default function useAccountPurchaseDeadlineData() {
  // 🔹 매입 집계 테이블 데이터
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);

  // 🔹 조회 조건에서 쓸 거래처 리스트 (필요시 사용)
  const [partnerList, setPartnerList] = useState([]);

  const [loading, setLoading] = useState(false);

  // 🔹 타입 옵션 (거래처 선택 시 서버에서 조회)
  const [typeOptions, setTypeOptions] = useState([]);
  const [typeLoading, setTypeLoading] = useState(false);

  const fetchTypeOptions = useCallback(async (accountId) => {
    if (!accountId) {
      setTypeOptions([]);
      return [];
    }
    try {
      setTypeLoading(true);
      const res = await api.get("/Operate/AccountMappingV2List", {
        params: { account_id: accountId, _ts: Date.now() },
      });
      const opts = normalizeTypeOptions(res?.data, accountId);
      setTypeOptions(opts);
      return opts;
    } catch (e) {
      console.error("타입 옵션 조회 실패(/Operate/AccountMappingV2List):", e);
      setTypeOptions([]);
      return [];
    } finally {
      setTypeLoading(false);
    }
  }, []);

  /**
   * 매입 집계 조회
   * @param {Object} filters - { bizType, type, fromDate, toDate, account_id, payType, ... }
   */
  const fetchPurchaseList = async (filters) => {
    setLoading(true);
    try {
      // "0" = 전체 선택 값 → 빈값("")으로 변환해서 SQL <if> 조건에서 제외되게 함
      const toParam = (v) => (!v || v === "0" ? "" : v);
      const params = {
        account_id: toParam(filters?.account_id),
        type:       toParam(filters?.type),
        year:       toParam(filters?.year),
        month:      toParam(filters?.month),
        payType:    toParam(filters?.payType),
      };
      const res = await api.get("/Account/AccountPurchaseTallyList", {
        params,
      });

      let list = [];

      // ✅ 1) 백엔드가 배열로 바로 주는 경우 (지금 너가 보여준 형태)
      if (Array.isArray(res.data)) {
        list = res.data;
      }
      // ✅ 2) 혹시 나중에 { code: 200, rows: [...] } 구조로 바꾸더라도 대응
      else if (res.data && res.data.code === 200) {
        list = res.data.rows || [];
        setPartnerList(res.data.partners || []);
      }

      const mapped = (list || []).map((item) => {
        // payType 보정: 1/2 아닌 경우 기본 1
        const pt = String(item.payType ?? "").trim();
        return {
          sale_id: item.sale_id,
          account_id: item.account_id,
          account_name: item.account_name || "",
          use_name: item.use_name || "",
          bizNo: item.bizNo || "",
          ceo_name: item.ceo_name || "",
          saleDate: item.saleDate || "",
          total:     formatNumber(item.total),
          vat:       formatNumber(item.vat),
          taxFree:   formatNumber(item.taxFree),
          tax:       formatNumber(item.tax),
          totalCash: formatNumber(item.totalCash),
          totalCard: formatNumber(item.totalCard),
          payType: pt === "1" || pt === "2" ? pt : "1",
          receipt_type: item.receipt_type || "",
          receipt_image: item.receipt_image || "",
          note: item.note || "",
          reg_dt: item.reg_dt || "",
          type: String(item.type ?? ""),
          type_name: item.type_name || "",
        };
      });

      setRows(mapped);
      setOriginalRows(mapped.map((r) => ({ ...r })));
    } catch (err) {
      console.error("매입 집계 조회 실패:", err);
      setRows([]);
      setOriginalRows([]);
      setPartnerList([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    rows,
    setRows,
    originalRows,
    setOriginalRows,
    partnerList,
    loading,
    fetchPurchaseList,
    typeOptions,
    setTypeOptions,
    typeLoading,
    fetchTypeOptions,
  };
}

export { parseNumber, formatNumber };
