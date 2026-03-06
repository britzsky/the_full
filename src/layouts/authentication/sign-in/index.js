import { useState, useEffect } from "react";
import api from "api/api";

// react-router-dom components
import { Link, useNavigate } from "react-router-dom";

// @mui material components
import Card from "@mui/material/Card";
import Switch from "@mui/material/Switch";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

// Authentication layout components
import BasicLayout from "layouts/authentication/components/BasicLayout";

// Images
import bgImage2 from "assets/images/thefull_sign_1.png";
import Swal from "sweetalert2";

function Basic() {
  const [rememberMe, setRememberMe] = useState(false);
  const handleSetRememberMe = () => setRememberMe(!rememberMe);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // ✅ 로그인 처리 함수 (직접 입력 / 자동 로그인 둘 다 사용)
  const handleLogin = (id = userId, pw = password) => {
    // 아이디/비밀번호 빈값 체크 (옵션)
    if (!id || !pw) {
      Swal.fire({
        title: "알림",
        text: "ID와 PASSWORD를 입력해 주세요.",
        icon: "warning",
        confirmButtonText: "확인",
      });
      return;
    }

    api
      .post("/User/Login", {
        userId: id,
        password: pw,
      })
      .then((response) => {
        if (response.data.code == "400") {
          Swal.fire({
            title: "실패",
            text: response.data.msg,
            icon: "error",
            confirmButtonColor: "#d33",
            confirmButtonText: "확인",
          });
          return;
        } else if (response.data.code == "403") {
          const useYn = String(response.data.use_yn ?? "").toUpperCase();
          // ✅ use_yn이 N인 사람만 "승인 필요" 팝업 표시
          if (useYn === "N") {
            Swal.fire({
              title: "승인 대기",
              html: "승인 요청 중입니다.<br/>관리자에게 문의해주세요.",
              icon: "warning",
              confirmButtonText: "확인",
              confirmButtonColor: "#d33",
            });
          } else {
            // ✅ use_yn이 N이 아닌데 403이 내려오는 케이스가 있다면(정책에 맞게 처리)
            Swal.fire({
              title: "로그인 불가",
              text: response.data.msg || "로그인할 수 없습니다.",
              icon: "error",
              confirmButtonText: "확인",
            });
          }
          return;
        } else {
          // 🔐 자동로그인 체크 여부에 따라 localStorage에 계정정보 저장
          if (rememberMe) {
            localStorage.setItem("autoLogin", "true");
            localStorage.setItem("autoLoginUserId", id);
            localStorage.setItem("autoLoginPassword", pw);
          } else {
            localStorage.removeItem("autoLogin");
            localStorage.removeItem("autoLoginUserId");
            localStorage.removeItem("autoLoginPassword");
          }

          // 로그인 정보를 저장.
          localStorage.setItem("position_name", response.data.position_name);
          localStorage.setItem("user_name", response.data.user_name);
          localStorage.setItem("user_id", response.data.user_id);
          localStorage.setItem("user_type", response.data.user_type);
          localStorage.setItem("position", response.data.position);
          localStorage.setItem("department", response.data.department);
          localStorage.setItem("account_id", response.data.account_id);
          const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
          localStorage.setItem("login_session_id", sessionId);

          const department = response.data.department;

          if (department == "7") {
            navigate("/fieldboard/fieldbordtab", {
              state: { fieldboardLogin: true },
            });
          } else {
            navigate("/Dashboard");
          }
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };

  // ✅ 브라우저에 저장된 자동로그인 정보가 있으면 자동 로그인 시도
  useEffect(() => {
    const savedAutoLogin = localStorage.getItem("autoLogin") === "true";
    const savedUserId = localStorage.getItem("autoLoginUserId");
    const savedPassword = localStorage.getItem("autoLoginPassword");

    if (savedAutoLogin && savedUserId && savedPassword) {
      setRememberMe(true);
      setUserId(savedUserId);
      setPassword(savedPassword);
      // 바로 자동 로그인 시도
      handleLogin(savedUserId, savedPassword);
    }
  }, []); // 처음 한번만 실행

  // ✅ 엔터키로 로그인되도록 form onSubmit 처리
  const handleSubmit = (e) => {
    e.preventDefault(); // 새로고침 방지
    handleLogin();
  };

  return (
    <BasicLayout>
      <Card
        sx={{
          border: "1px solid #FFDCDC",
          boxShadow:
            "0rem 1.25rem 1.575rem -0.025rem #FFDCDC, 0rem 0.125rem 0.25rem -0.0625rem rgba(0, 0, 0, 0.06);",
        }}
      >
        <MDBox pt={6} pb={3} px={6} textAlign="center">
          <img src={bgImage2} alt="logo" />
          <MDBox component="form" role="form" onSubmit={handleSubmit}>
            <MDBox mb={2}>
              <MDInput
                type="text" // ID 입력이므로 text 타입 사용
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

            {/* 자동 로그인 스위치 */}
            <MDBox display="flex" alignItems="center" ml={-1} mb={1}>
              <Switch checked={rememberMe} onChange={handleSetRememberMe} />
              <MDTypography
                variant="button"
                fontWeight="regular"
                color="text"
                onClick={handleSetRememberMe}
                sx={{ cursor: "pointer", userSelect: "none", ml: -1 }}
              >
                &nbsp;&nbsp;자동 로그인
              </MDTypography>
            </MDBox>

            <MDBox mt={4} mb={1}>
              <MDButton
                type="submit" // 🔥 엔터/클릭 모두 submit로 처리
                variant="gradient"
                fullWidth
                sx={{ bgcolor: "#FFC107", color: "#fff" }}
              >
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
