/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */
/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "api/api";

// Material Dashboard 2 React components
import MDTypography from "components/MDTypography";

export default function useTableData() {

  const [rows, setRows] = useState([]);
  const navigate = useNavigate();

  // API 조회
  useEffect(() => {
    api
      .get("/Account/AccountDirectList") // 👉 실제 API 엔드포인트로 교체
      .then((res) => {
        // res.data 예시:
        // [{ account_id:"20250819193455", account_name:"한결", account_address:"인천..." }]
        const mapped = res.data.map((item) => ({
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
          info: (
            <MDTypography
              component="a"
              onClick={() => navigate(`/accountinfosheet/${item.account_id}?name=${item.account_name}`)}
              variant="caption"
              sx={{ color: "#896C6C", cursor: "pointer" }}
              fontWeight="medium"
            >
              상세보기
            </MDTypography>
          ),
          members: (
            <MDTypography
              component="a"
              onClick={() => navigate(`/membersheet/${item.account_id}?name=${item.account_name}`)}
              variant="caption"
              sx={{ color: "#FF6600", cursor: "pointer" }}
              fontWeight="medium"
            >
              확인
            </MDTypography>
          ),
          record: (
            <MDTypography
              component="a"
              onClick={() => navigate(`/recordsheet/${item.account_id}?name=${item.account_name}`)}
              variant="caption"
              sx={{ color: "#FFC107", cursor: "pointer" }}
              fontWeight="medium"
            >
              확인
            </MDTypography>
          ),
          ceremony: (
            <MDTypography
              component="a"
              onClick={() => navigate(`/ceremonysheet/${item.account_id}?name=${item.account_name}`)}
              variant="caption"
              sx={{ color: "#36BA98", cursor: "pointer" }}
              fontWeight="medium"
            >
              확인
            </MDTypography>
          ),
          dinners: (
            <MDTypography
              component="a"
              onClick={() => navigate(`/dinersnumbersheet/${item.account_id}?name=${item.account_name}`)}
              variant="caption"
              sx={{ color: "#0D92F4", cursor: "pointer" }}
              fontWeight="medium"
            >
              확인
            </MDTypography>
          ),
          wares: (
            <MDTypography
              component="a"
              onClick={() => navigate(`/propertysheet/${item.account_id}?name=${item.account_name}`)}
              variant="caption"
              sx={{ color: "#125B9A", cursor: "pointer" }}
              fontWeight="medium"
            >
              확인
            </MDTypography>
          ),
          inventory: (
            <MDTypography
              component="a"
              onClick={() => navigate(`/dinersnumbersheet/${item.account_id}?name=${item.account_name}`)}
              variant="caption"
              sx={{ color: "#9112BC", cursor: "pointer" }}
              fontWeight="medium"
            >
              확인
            </MDTypography>
          ),
        }));
        setRows(mapped);
      })
      .catch((err) => {
        console.error("데이터 조회 실패:", err);
      });
  }, []);

  return {
    columns: [
      { Header: "업장명", accessor: "account_name", size: "3%", align: "left" },
      { Header: "주소", accessor: "account_address", size: "10%", align: "left" },
      { Header: "구분", accessor: "account_type", size: "3%", align: "left" },
      { Header: "필요인원", accessor: "account_rqd_member", align: "center" },
      { Header: "현재인원", accessor: "account_headcount", align: "center" },
      { Header: "상세보기", accessor: "info", align: "center" },
      { Header: "인사기록카드", accessor: "members", align: "center" },
      { Header: "출근부", accessor: "record", align: "center" },
      { Header: "경관식", accessor: "ceremony", align: "center" },
      { Header: "식수현황", accessor: "dinners", align: "center" },
      { Header: "기물현황", accessor: "wares", align: "center" },
      { Header: "재고조사", accessor: "inventory", align: "center" },
    ],
    rows,
  };
}
