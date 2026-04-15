/* eslint-disable react/function-component-definition */
// src/layouts/account/accountPurchaseTallyData.js
import { useState } from "react";
import api from "api/api";

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

// 상세 응답에서 필드명이 다를 수 있어 대소문자 구분 없이 값을 조회
const pickField = (obj, keys) => {
  if (!obj || typeof obj !== "object") return "";

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }

  const entries = Object.entries(obj);
  for (const key of keys) {
    const found = entries.find(([k]) => String(k).toLowerCase() === String(key).toLowerCase());
    if (found && found[1] !== undefined && found[1] !== null) return found[1];
  }

  return "";
};

const hasValue = (v) => !(v === null || v === undefined || String(v).trim() === "");

const normalizeItemType = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "1" || s.includes("식재료")) return "1";
  if (s === "2" || s.includes("소모품")) return "2";
  if (s === "3" || s.includes("경관식")) return "3";
  return "";
};

const normalizeTaxType = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "1" || s.includes("과세")) return "1";
  if (s === "2" || s.includes("면세")) return "2";
  return "";
};

// 상세(itemtype/taxtype) 기준으로 상단 집계 컬럼을 계산
const summarizeTallyByDetail = (detailRows) => {
  const sum = {
    expen_tax: 0,
    expen_vat: 0,
    expen_taxFree: 0,
    expen_total: 0,
    food_tax: 0,
    food_vat: 0,
    food_taxFree: 0,
    food_total: 0,
    scenic_tax: 0,
    scenic_vat: 0,
    scenic_taxFree: 0,
    scenic_total: 0,
    expen_item_rows: 0,
    food_item_rows: 0,
    scenic_item_rows: 0,
    expen_tax_rows: 0,
    food_tax_rows: 0,
    scenic_tax_rows: 0,
  };

  (detailRows || []).forEach((item) => {
    const itemType = normalizeItemType(pickField(item, ["itemType", "itemtype", "item_type"]));
    const taxType = normalizeTaxType(pickField(item, ["taxType", "taxtype", "tax_type"]));

    // itemtype: 1=식재료, 2=소모품, 3=경관식
    if (itemType !== "1" && itemType !== "2" && itemType !== "3") return;

    const amountRaw = pickField(item, ["amount", "total_amount", "totalAmount"]);
    const qtyRaw = pickField(item, ["qty", "quantity"]);
    const unitPriceRaw = pickField(item, ["unitPrice", "unitprice", "unit_price"]);
    const qty = parseNumber(qtyRaw);
    const unitPrice = parseNumber(unitPriceRaw);
    const amount = hasValue(amountRaw)
      ? parseNumber(amountRaw)
      : (qty > 0 ? qty * unitPrice : unitPrice);

    const prefix = itemType === "1" ? "food" : itemType === "3" ? "scenic" : "expen";
    sum[`${prefix}_item_rows`] += 1;

    // taxtype: 1=과세, 2=면세
    if (taxType === "1") {
      // 과세는 상세 금액 기준으로 자동 계산 (VAT=amount/11, TAX=amount-VAT)
      const vat = Math.floor(amount / 11);
      const tax = Math.max(amount - vat, 0);
      sum[`${prefix}_tax_rows`] += 1;
      sum[`${prefix}_tax`] += tax;
      sum[`${prefix}_vat`] += vat;
      sum[`${prefix}_total`] += amount;
      return;
    }

    if (taxType === "2") {
      sum[`${prefix}_tax_rows`] += 1;
      sum[`${prefix}_taxFree`] += amount;
      sum[`${prefix}_total`] += amount;
      return;
    }

    // 알수없음 등 기타 타입은 합계에만 반영
    sum[`${prefix}_total`] += amount;
  });

  return sum;
};

export default function useAccountPurchaseTallyData() {
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);

  const [partnerList, setPartnerList] = useState([]);
  const [mappingRows, setMappingRows] = useState([]);

  const [loading, setLoading] = useState(false);

  /**
   * 매입 집계 조회
   * - AccountPurchaseTallyForTallyTab API 사용
   *   (일반 타입: tb_account_purchase_tally/_detail, 1002/1003: 본사 법인카드 결제 테이블 기준)
   * - saleDate(YYYY-MM)를 fromDate(월 1일)~toDate(월 말일)로 변환해서 전송
   * - type이 "0"이면 전체 타입 조회
   * @param {Object} filters - { type, saleDate(YYYY-MM), account_id, ... }
   */
  const fetchPurchaseList = async (filters) => {
    setLoading(true);
    try {
      // ✅ year/month를 그대로 전달 (SQL에서 YEAR/MONTH 함수로 처리)
      // "0" = 전체 조회, 숫자면 해당 연/월만 조회
      // "0"은 전체 선택 값 → 빈값("")으로 변환해서 SQL <if> 조건에서 제외되게 함
      const toParam = (v) => (!v || v === "0" ? "" : v);
      const params = {
        account_id: toParam(filters?.account_id),
        type:       toParam(filters?.type),
        year:       toParam(filters?.year),
        month:      toParam(filters?.month),
      };

      const res = await api.get("/Account/AccountPurchaseTallyForTallyTab", { params });

      const list = Array.isArray(res.data) ? res.data : res.data?.rows || [];
      const mappedBase = (list || []).map((item) => ({
        account_id: item.account_id ?? item.accountId ?? "",
        account_name: item.account_name || "",
        sale_id: item.sale_id ?? item.saleId ?? "",
        type: item.type ?? item.mapping_type ?? "",
        type_name: item.type_name || "",
        saleDate: item.saleDate || item.sale_date || "",
        // 소모품(itemType=2): 과세 공급가 / 부가세 / 면세 / 합계
        expen_tax:     formatNumber(item.expen_tax),
        expen_vat:     formatNumber(item.expen_vat),
        expen_taxFree: formatNumber(item.expen_taxFree),
        expen_total:   formatNumber(item.expen_total),
        // 식재료(itemType=1): 과세 공급가 / 부가세 / 면세 / 합계
        food_tax:     formatNumber(item.food_tax),
        food_vat:     formatNumber(item.food_vat),
        food_taxFree: formatNumber(item.food_taxFree),
        food_total:   formatNumber(item.food_total),
        // 경관식(itemType=3): 과세 공급가 / 부가세 / 면세 / 합계
        scenic_tax:     formatNumber(item.scenic_tax),
        scenic_vat:     formatNumber(item.scenic_vat),
        scenic_taxFree: formatNumber(item.scenic_taxFree),
        scenic_total:   formatNumber(item.scenic_total),
        use_name: item.use_name || "",
        note: item.note || "",
        bizNo: item.bizNo || "",
        ceo_name: item.ceo_name || "",
        reg_dt: item.reg_dt || "",
      }));

      const hasSaleIdRow = mappedBase.some((row) => String(row?.sale_id ?? "").trim() !== "");
      if (!hasSaleIdRow) {
        setRows(mappedBase);
        setOriginalRows(mappedBase.map((r) => ({ ...r })));
        return;
      }

      // ✅ 성능 최적화:
      // - 전체 조회(account_id 미선택)에서 행 수가 많으면 상세 API N회 호출이 매우 느려진다.
      // - 이 경우 서버 집계(AccountPurchaseTallyForTallyTab) 값을 그대로 사용한다.
      const isAllAccountQuery = String(toParam(filters?.account_id)) === "";
      const isAllTypeQuery = String(toParam(filters?.type)) === "";
      const isBroadQuery = isAllAccountQuery && isAllTypeQuery;
      const useDetailRecalc = !isBroadQuery && (!isAllAccountQuery || mappedBase.length <= 300);
      if (!useDetailRecalc) {
        setRows(mappedBase);
        setOriginalRows(mappedBase.map((r) => ({ ...r })));
        return;
      }

      // sale_id 기준으로 상세를 조회해 itemtype/taxtype 집계값을 우선 반영
      // 병렬 폭주로 상세 API가 실패하지 않도록 순차 조회
      const detailSummaryCache = new Map();
      const mapped = [];
      for (const row of mappedBase) {
        const saleId = String(row?.sale_id ?? "").trim();
        if (!saleId) {
          mapped.push(row);
          continue;
        }

        const cacheKey = saleId;
        if (!detailSummaryCache.has(cacheKey)) {
          const req = api
            .get("/Account/AccountPurchaseDetailList_tmp", {
              params: { sale_id: saleId },
            })
            .then((r) => {
              const detailList = Array.isArray(r.data) ? r.data : r.data?.rows || r.data?.data || [];
              if (!Array.isArray(detailList) || detailList.length === 0) {
                return null;
              }
              return summarizeTallyByDetail(detailList);
            })
            .catch((err) => {
              console.error("매입 상세 집계 조회 실패:", err);
              return null;
            });
          detailSummaryCache.set(cacheKey, req);
        }

        const summary = await detailSummaryCache.get(cacheKey);
        if (!summary) {
          mapped.push(row);
          continue;
        }

        mapped.push({
          ...row,
          // ✅ 소모품: itemType=2 상세가 있을 때만 total 반영
          expen_total:
            summary.expen_item_rows > 0 ? formatNumber(summary.expen_total) : row.expen_total,
          // ✅ 소모품 과세/면세는 taxType 1/2가 있을 때만 덮어쓰기 (없으면 기존값 유지)
          expen_tax:
            summary.expen_tax_rows > 0 ? formatNumber(summary.expen_tax) : row.expen_tax,
          expen_vat:
            summary.expen_tax_rows > 0 ? formatNumber(summary.expen_vat) : row.expen_vat,
          expen_taxFree:
            summary.expen_tax_rows > 0 ? formatNumber(summary.expen_taxFree) : row.expen_taxFree,

          // ✅ 식재료: itemType=1 상세가 있을 때만 total 반영
          food_total:
            summary.food_item_rows > 0 ? formatNumber(summary.food_total) : row.food_total,
          // ✅ 식재료 과세/면세는 taxType 1/2가 있을 때만 덮어쓰기 (없으면 기존값 유지)
          food_tax:
            summary.food_tax_rows > 0 ? formatNumber(summary.food_tax) : row.food_tax,
          food_vat:
            summary.food_tax_rows > 0 ? formatNumber(summary.food_vat) : row.food_vat,
          food_taxFree:
            summary.food_tax_rows > 0 ? formatNumber(summary.food_taxFree) : row.food_taxFree,

          // ✅ 경관식: itemType=3 상세가 있을 때만 반영
          scenic_total:
            summary.scenic_item_rows > 0 ? formatNumber(summary.scenic_total) : row.scenic_total,
          scenic_tax:
            summary.scenic_tax_rows > 0 ? formatNumber(summary.scenic_tax) : row.scenic_tax,
          scenic_vat:
            summary.scenic_tax_rows > 0 ? formatNumber(summary.scenic_vat) : row.scenic_vat,
          scenic_taxFree:
            summary.scenic_tax_rows > 0 ? formatNumber(summary.scenic_taxFree) : row.scenic_taxFree,
        });
      }

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

  /**
   * ✅ 구매처 매핑 리스트
   * - 이 값이 구매처 select 구성값이 됨
   * - [{type, name}, ...]
   */
  const fetchMappingList = async (filters) => {
    setLoading(true);
    try {
      // account_id가 있으면 해당 거래처 매핑(V2), 없으면 전체 매핑 목록
      const hasAccountId = filters?.account_id && String(filters.account_id).trim() !== "";
      const url = hasAccountId ? "/Operate/AccountMappingV2List" : "/Operate/AccountMappingList";

      const res = await api.get(url, {
        params: hasAccountId
          ? { account_id: filters.account_id, _ts: Date.now() }
          : { _ts: Date.now() },
      });

      const list = Array.isArray(res.data) ? res.data : res.data?.rows || res.data?.data || [];

      const mapped = (list || [])
        .filter((item) => String(item?.del_yn ?? "N") !== "Y")
        .map((item) => ({
          type: item.type,
          name: item.name,
        }));

      const has1002 = mapped.some((item) => String(item?.type ?? "") === "1002");
      const has1003 = mapped.some((item) => String(item?.type ?? "") === "1003");
      const blocked1002 = (list || []).some(
        (item) => String(item?.type ?? "") === "1002" && String(item?.del_yn ?? "N") === "Y"
      );
      const blocked1003 = (list || []).some(
        (item) => String(item?.type ?? "") === "1003" && String(item?.del_yn ?? "N") === "Y"
      );

      if (!has1002 && !blocked1002) {
        mapped.push({ type: "1002", name: "기타경비" });
      }
      if (!has1003 && !blocked1003) {
        mapped.push({ type: "1003", name: "기타" });
      }

      mapped.sort((a, b) => {
        const an = Number(a?.type);
        const bn = Number(b?.type);
        const aNum = Number.isFinite(an);
        const bNum = Number.isFinite(bn);
        if (aNum && bNum) return an - bn;
        return String(a?.type ?? "").localeCompare(String(b?.type ?? ""), "ko");
      });

      setMappingRows(mapped.map((r) => ({ ...r })));
    } catch (err) {
      console.error("AccountMappingList 조회 실패:", err);
      setMappingRows([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    rows,
    setRows,
    originalRows,
    mappingRows,
    partnerList,
    loading,
    fetchPurchaseList,
    fetchMappingList,
  };
}

export { parseNumber, formatNumber };
