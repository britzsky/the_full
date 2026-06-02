import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { clearSharedAuthCookies } from "utils/sharedAuthSession";

function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    // 로그인 세션과 자동 로그인 정보를 함께 정리하는 로그아웃 화면
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_type");
    localStorage.removeItem("position");
    localStorage.removeItem("department");
    localStorage.removeItem("account_id");
    localStorage.removeItem("web_position");
    localStorage.removeItem("login_session_id");
    localStorage.removeItem("position_name");
    localStorage.removeItem("user_name");
    localStorage.removeItem("autoLogin");
    localStorage.removeItem("autoLoginUserId");
    localStorage.removeItem("autoLoginPassword");
    sessionStorage.removeItem("login_session_id");
    sessionStorage.removeItem("login_user_id");
    clearSharedAuthCookies();

    navigate("/authentication/sign-in", { replace: true });
  }, [navigate]);

  return null;
}

export default Logout;
