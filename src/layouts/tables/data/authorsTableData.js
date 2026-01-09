/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "api/api";
import MDTypography from "components/MDTypography";

// 🔹 각 행의 클릭 이동용 링크 컴포넌트
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

export default function useTableData(accountType) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const MIN_LOADING_TIME = 1000; // 최소 1초 로딩 유지
    const startTime = Date.now();

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get("/Account/AccountList", {
          params: { account_type: accountType || "0" },
        });

        const mapped = res.data.map((item) => ({
          account_id: item.account_id,
          meal_type: item.meal_type,
          account_name: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {item.account_name}
            </MDTypography>
          ),
          account_address: (
            <MDTypography variant="caption" color="text" fontWeight="medium">
              {item.account_address || "-"}
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

          // ✅ 각 버튼별로 독립된 navigate 경로
          info: (
            <NavLink
              to={`/accountinfosheet/${item.account_id}?name=${item.account_name}`}
              color="#896C6C"
              text="상세보기"
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
        }));

        setRows(mapped);
      } catch (error) {
        console.error("데이터 조회 실패:", error);
        setRows([]);
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = MIN_LOADING_TIME - elapsed;
        if (remaining > 0) setTimeout(() => setLoading(false), remaining);
        else setLoading(false);
      }
    };

    fetchData();
  }, [accountType]);

  const columns = [
    { Header: "업장명", accessor: "account_name", size: "3%", align: "left" },
    { Header: "주소", accessor: "account_address", size: "10%", align: "left" },
    { Header: "구분", accessor: "account_type", size: "3%", align: "left" },
    { Header: "필요인원", accessor: "account_rqd_member", size: "3%", align: "center" },
    { Header: "현재인원", accessor: "account_headcount", size: "3%", align: "center" },
    { Header: "상세보기", accessor: "info", size: "3%", align: "center" },
    { Header: "인사기록카드", accessor: "members", size: "3%", align: "center" },
    { Header: "출근부", accessor: "record", size: "3%", align: "center" },
    // { Header: "경관식", accessor: "ceremony", align: "center" },
    { Header: "식수현황", accessor: "dinners", size: "3%", align: "center" },
    // { Header: "재고조사", accessor: "inventory", align: "center" },
  ];

  return { columns, rows, loading };
}
