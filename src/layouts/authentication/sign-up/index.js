import { useState } from "react";
import api from "api/api";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

// @mui material components
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

// Authentication layout components
import BasicLayout from "layouts/authentication/components/BasicLayout";

// Images
import bgImage2 from "assets/images/thefull-Photoroom.png";

// 주소 검색 (다음 API)
import DaumPostcode from "react-daum-postcode";
import { Padding } from "@mui/icons-material";

function SignUp() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    user_name: "",
    user_id: "",
    password: "",
    user_type: "",
    phone: "",
    address: "",
    address_detail: "",
    zipcode: "",
  });

  const [errors, setErrors] = useState({});
  const [openPostcode, setOpenPostcode] = useState(false);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" })); // 입력 시 에러 초기화
  };

  const handleUserTypeChange = (type) => {
    setForm((prev) => ({ ...prev, user_type: type }));
    setErrors((prev) => ({ ...prev, user_type: "" }));
  };

  const handlePhoneChange = (value) => {
    const num = value.replace(/\D/g, "");
    let formatted = num;
    if (num.length < 4) formatted = num;
    else if (num.length < 7) formatted = `${num.slice(0, 3)}-${num.slice(3)}`;
    else if (num.length < 11)
      formatted = `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
    else formatted = `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`;
    handleInputChange("phone", formatted);
  };

  const handleCompletePostcode = (data) => {
    let fullAddress = data.address;
    let extraAddress = data.buildingName ? ` (${data.buildingName})` : "";
    handleInputChange("address", fullAddress + extraAddress);
    handleInputChange("zipcode", data.zonecode);
    setOpenPostcode(false);
  };

  const handleSubmit = () => {
    const requiredFields = ["user_name", "user_id", "password", "user_type", "phone", "address", "address_detail"];
    const newErrors = {};
    let hasError = false;

    requiredFields.forEach((field) => {
      if (!form[field]) {
        newErrors[field] = "필수 입력 항목입니다.";
        hasError = true;
      }
    });

    setErrors(newErrors);

    if (hasError) {
      Swal.fire({
        icon: "error",
        title: "입력 오류",
        text: "필수 항목을 모두 입력해주세요.",
      });
      return;
    }

    api
      .post("/User/UserRgt", form)
      .then((res) => {
        Swal.fire({
          icon: "success",
          title: "회원가입 완료!",
          text: "로그인 페이지로 이동합니다.",
        }).then(() => navigate("/authentication/sign-in"));
      })
      .catch((err) => {
        console.error(err);
        Swal.fire({
          icon: "error",
          title: "회원가입 실패",
          text: "서버에 문제가 발생했습니다.",
        });
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
                type="text"
                label="이름"
                value={form.user_name}
                onChange={(e) => handleInputChange("user_name", e.target.value)}
                fullWidth
                error={!!errors.user_name}
                helperText={errors.user_name}
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
            </MDBox>

            <MDBox mb={2}>
              <MDInput
                type="text"
                label="아이디"
                value={form.user_id}
                onChange={(e) => handleInputChange("user_id", e.target.value)}
                fullWidth
                error={!!errors.user_id}
                helperText={errors.user_id}
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
            </MDBox>

            <MDBox mb={2}>
              <MDInput
                type="password"
                label="비밀번호"
                value={form.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                fullWidth
                error={!!errors.password}
                helperText={errors.password}
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
            </MDBox>

            {/* 사용자타입 체크박스 */}
            <MDBox mb={2}>
              <MDBox display="flex" justifyContent="space-between">
                {["ceo", "본사직원", "영양사"].map((type) => (
                  <MDBox key={type} display="flex" alignItems="center" >
                    <Checkbox
                      checked={form.user_type === type}
                      onChange={() => handleUserTypeChange(type)}
                    />
                    <MDTypography variant="body2" sx={{ fontSize: "0.75rem" }}>{type}</MDTypography>
                  </MDBox>
                ))}
              </MDBox>
              {errors.user_type && (
                <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                  {errors.user_type}
                </MDTypography>
              )}
            </MDBox>

            <MDBox mb={2}>
              <MDInput
                type="text"
                label="전화번호"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                fullWidth
                error={!!errors.phone}
                helperText={errors.phone}
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
            </MDBox>

            <MDBox mb={2} display="flex">
              <MDInput
                type="text"
                label="주소"
                value={form.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                fullWidth
                readOnly
                error={!!errors.address}
                helperText={errors.address}
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
              <MDButton
                variant="gradient"
                color="info"
                onClick={() => setOpenPostcode(true)}
                sx={{ ml: 1, Padding: "2px" }}
              >
                주소찾기
              </MDButton>
            </MDBox>

            <MDBox mb={2}>
              <MDInput
                type="text"
                label="상세주소"
                value={form.address_detail}
                onChange={(e) => handleInputChange("address_detail", e.target.value)}
                fullWidth
                error={!!errors.address_detail}
                helperText={errors.address_detail}
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
            </MDBox>

            <MDBox mb={2}>
              <MDInput
                type="text"
                label="우편번호"
                value={form.zipcode}
                onChange={(e) => handleInputChange("zipcode", e.target.value)}
                fullWidth
                readOnly
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
            </MDBox>

            <MDBox mt={4} mb={1}>
              <MDButton variant="gradient" color="info" fullWidth onClick={handleSubmit}>
                회원가입
              </MDButton>
            </MDBox>

            {/* 주소 검색 모달 */}
            <Dialog open={openPostcode} onClose={() => setOpenPostcode(false)} maxWidth="sm" fullWidth>
              <DialogContent>
                <DaumPostcode onComplete={handleCompletePostcode} autoClose />
              </DialogContent>
            </Dialog>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}

export default SignUp;
