import { useState } from "react";
import api from "api/api";

// react-router-dom components
import { Link, useNavigate } from "react-router-dom";

// @mui material components
import Card from "@mui/material/Card";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

// Authentication layout components
import BasicLayout from "layouts/authentication/components/BasicLayout";

// Images
import bgImage2 from "assets/images/thefull-Photoroom.png";
import Swal from "sweetalert2";

function Basic() {
  const [rememberMe, setRememberMe] = useState(false);
  const handleSetRememberMe = () => setRememberMe(!rememberMe);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = () => {
    api
      .post("/User/Login",
      {
        userId: userId,
        password: password
      })
      .then((response) => {
        if (response.data.code == "400") {
          Swal.fire({
            title: "실패",
            text: response.data.msg,
            icon: "error",
            confirmButtonColor: "#d33",
            confirmButtonText: "확인",
          }).then((result) => {
            if (result.isConfirmed) {
              return;
            }
          });
        } else {
          // 로그인 정보를 저장.
          localStorage.setItem("user_id", response.data.user_id);
          localStorage.setItem("user_type", response.data.user_type);
          localStorage.setItem("position", response.data.position);
          localStorage.setItem("department", response.data.department);
          localStorage.setItem("account_id", response.data.account_id);

          const department = response.data.department;
          
          if (department == '7') {
            navigate("/fieldboard/fieldbordtab");  
          } else {
            navigate("/Dashboard");
          }
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };

  return (
    <BasicLayout>
      <Card>
        <MDBox pt={6} pb={3} px={6} textAlign="center">
          <img src={bgImage2} />
          <MDBox component="form" role="form">
            <MDBox mb={2}>
              <MDInput
                type="email"
                label="ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                fullWidth
              />
            </MDBox>
            <MDBox mb={2}>
              <MDInput
                type="password"
                label="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
              />
            </MDBox>
            {/* <MDBox display="flex" alignItems="center" ml={-1}>
              <Switch checked={rememberMe} onChange={handleSetRememberMe} />
              <MDTypography
                variant="button"
                fontWeight="regular"
                color="text"
                onClick={handleSetRememberMe}
                sx={{ cursor: "pointer", userSelect: "none", ml: -1 }}
              >
                &nbsp;&nbsp;Remember me
              </MDTypography>
            </MDBox> */}
            <MDBox mt={4} mb={1}>
              <MDButton variant="gradient" color="info" fullWidth onClick={handleLogin}>
                Log In
              </MDButton>
            </MDBox>
            <MDBox mt={3} mb={1} textAlign="center">
              <MDTypography variant="button" color="text">
                계정이 없으신가요?{" "}
                <MDTypography
                  component={Link}
                  to="/authentication/sign-up"
                  variant="button"
                  color="info"
                  fontWeight="medium"
                  textGradient
                >
                  사용자등록
                </MDTypography>
              </MDTypography>
            </MDBox>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}

export default Basic;
