/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "api/api";
import MDTypography from "components/MDTypography";

// 계약일자 문자열 정규화
const normalizeYmd = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return "";
};

// 계약기간 표시 문자열 변환
const formatContractPeriod = (start, end) => {
  const startText = normalizeYmd(start);
  const endText = normalizeYmd(end);
  if (!startText || !endText) return "-";
  return `${startText}~${endText}`;
};

// 빈값 화면 표시 문자열 변환
const formatEmpty = (value) => {
  if (value == null) return "-";
  const text = String(value).trim();
  return text ? value : "-";
};

// 금액 천단위 표시 문자열 변환
const formatPrice = (value) => {
  if (formatEmpty(value) === "-") return "-";
  const numeric = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(numeric)) return value;
  return numeric.toLocaleString("ko-KR");
};

// 행 이동 링크 컴포넌트
function NavLink({ to, color, text }) {
  const navigate = useNavigate();
  return (
    <MDTypography
      component="a"
      onClick={() => navigate(to)}
      variant="caption"
      sx={{ color, cursor: "pointer" }}
      fontWeight="medium"
    >
      {text}
    </MDTypography>
  );
}

export default function useTableData(accountType, refreshKey = 0) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get("/Account/AccountListV2", {
          params: {
            account_type: accountType || "0",
            // 삭제여부 필터는 테이블 화면에서 처리하므로 목록은 항상 전체로 조회
            del_yn: "ALL",
          },
        });

        const list = Array.isArray(res?.data) ? res.data : [];
        const mapped = list.map((item) => ({
          account_id: item.account_id,
          meal_type: item.meal_type,
          del_yn: item.del_yn, // 삭제여부 원본값 유지

          account_name: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {item.account_name}
            </MDTypography>
          ),
          account_address: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {formatEmpty(item.account_address)}
            </MDTypography>
          ),
          // 고객사 정보 확장 컬럼 표시값
          full_room: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {formatEmpty(item.full_room)}
            </MDTypography>
          ),
          diet_price: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {formatPrice(item.diet_price)}
            </MDTypography>
          ),
          normal: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {formatEmpty(item.normal)}
            </MDTypography>
          ),
          contract_period: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {formatContractPeriod(item.contract_start, item.contract_end)}
            </MDTypography>
          ),
          account_type: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {item.account_type || "-"}
            </MDTypography>
          ),
          account_rqd_member: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {item.account_rqd_member ?? "-"}
            </MDTypography>
          ),
          account_headcount: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {item.account_headcount ?? "-"}
            </MDTypography>
          ),

          // 화면별 상세 링크 경로
          info: (
            <NavLink
              to={`/account/${item.account_id}?name=${item.account_name}`}
              color="#896C6C"
              text="이동"
            />
          ),
          members: (
            <NavLink
              to={`/membersheet/${item.account_id}?name=${item.account_name}`}
              color="#FF6600"
              text="확인"
            />
          ),
          record: (
            <NavLink
              to={`/recordsheet/${item.account_id}?name=${item.account_name}`}
              color="#FFC107"
              text="확인"
            />
          ),
          ceremony: (
            <NavLink
              to={`/ceremonysheet/${item.account_id}?name=${item.account_name}`}
              color="#36BA98"
              text="확인"
            />
          ),
          dinners: (
            <NavLink
              to={`/dinersnumbersheet/${item.account_id}?name=${item.account_name}`}
              color="#0D92F4"
              text="확인"
            />
          ),
          wares: (
            <NavLink
              to={`/propertysheet/${item.account_id}?name=${item.account_name}`}
              color="#125B9A"
              text="확인"
            />
          ),
          inventory: (
            <NavLink
              to={`/inventorysheet/${item.account_id}?name=${item.account_name}`}
              color="#9112BC"
              text="확인"
            />
          ),
          tally: (
            <NavLink
              to={`/tallysheet/${item.account_id}?name=${item.account_name}`}
              color="#0D92F4"
              text="확인"
            />
          ),
        }));

        if (!active) return;
        setRows(mapped);
      } catch (error) {
        console.error("데이터 조회 실패:", error);
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
    // 조회조건 변경 기반 재조회 트리거
  }, [accountType, refreshKey]);

  const columns = [
    { Header: "업장명", accessor: "account_name", size: "3%", align: "left" },
    { Header: "주소", accessor: "account_address", size: "10%", align: "left" },
    { Header: "만실인원", accessor: "full_room", size: "3%", align: "center" },
    { Header: "현 식단가", accessor: "diet_price", size: "3%", align: "center" },
    { Header: "현 식수", accessor: "normal", size: "3%", align: "center" },
    { Header: "계약기간", accessor: "contract_period", size: "6%", align: "left" },
    { Header: "구분", accessor: "account_type", size: "3%", align: "left" },
    { Header: "필요조리인력", accessor: "account_rqd_member", size: "3%", align: "center" },
    { Header: "현재인력", accessor: "account_headcount", size: "3%", align: "center" },
    { Header: "삭제여부", accessor: "del_yn", size: "3%", align: "center" },
    { Header: "상세정보", accessor: "info", size: "3%", align: "center" },
    { Header: "집계표", accessor: "tally", size: "3%", align: "center" },
    // { Header: "인사기록카드", accessor: "members", size: "3%", align: "center" },
    // { Header: "출근부", accessor: "record", size: "3%", align: "center" },
    // { Header: "경관식", accessor: "ceremony", align: "center" },
    // { Header: "식수현황", accessor: "dinners", size: "3%", align: "center" },
    // { Header: "재고조사", accessor: "inventory", align: "center" },
  ];

  return { columns, rows, loading };
}
