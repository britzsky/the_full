import { useState } from "react";
import api from "api/api";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

// @mui material components
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

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

// 🔹 입사일자 달력 (react-datepicker 사용)
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ko from "date-fns/locale/ko"; // 🔹 한글 locale
import "react-datepicker/dist/react-datepicker.css";

registerLocale("ko", ko);

function SignUp() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    user_name: "",
    user_id: "",
    password: "",
    user_type: "",
    util_member_type: "", // "6"(유틸) | "7"(통합)
    phone: "",
    address: "",
    address_detail: "",
    zipcode: "",
    department: "", // 부서 코드
    position: "",   // 직책 코드
    join_dt: "",  // 🔹 입사일자 (YYYY-MM-DD)
    account_id: "", // 🔹 영양사일 때 선택할 거래처
    birth_date: "",  // 🔹 생년월일 추가
  });

  // 🔹 Select 박스 높이를 다른 인풋과 맞추기 위한 공통 스타일
  const selectSx = {
    "& .MuiOutlinedInput-root": {
      height: "40px",
    },
    "& .MuiSelect-select": {
      display: "flex",
      alignItems: "center",
      paddingTop: "10px",
      paddingBottom: "10px",
      fontSize: "0.8rem",
    },
    "& .MuiInputLabel-root": {
      fontSize: "0.7rem",
    },
  };

  // 🔹 부서/직책 라벨 위치 보정
  const selectLabelSx = {
    fontSize: "0.7rem",
    lineHeight: 1.4,
    overflow: "visible",
    transform: "translate(14px, 13px) scale(1)",
    "&.MuiInputLabel-shrink": {
      transform: "translate(14px, -7px) scale(0.75)",
      backgroundColor: "#fff",
      paddingLeft: "4px",
      paddingRight: "4px",
    },
  };

  // 🔹 MDInput 라벨 잘림/겹침 방지 스타일
  const inputSx = {
    "& .MuiInputLabel-root": {
      fontSize: "0.7rem",
      lineHeight: 1.3,
    },
    "& .MuiOutlinedInput-input": {
      paddingTop: "12px",
      paddingBottom: "12px",
      fontSize: "0.85rem",
    },
  };

  // 🔹 달력 팝업이 뒤 요소와 겹치지 않도록 z-index / 배경 보강
  const datePickerSx = {
    "& .react-datepicker-popper": {
      zIndex: 2000,
    },
    "& .react-datepicker": {
      backgroundColor: "#fff",
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      border: "1px solid #e0e0e0",
    },
  };

  const [errors, setErrors] = useState({});
  const [openPostcode, setOpenPostcode] = useState(false);
  const [accountList, setAccountList] = useState([]); // 🔹 영양사용 거래처 목록

  const USER_TYPE_OPTIONS = [
    { label: "ceo", labelKo: "ceo", code: "1" },       // 필요하면 labelKo를 한글로 써도 됨
    { label: "본사", labelKo: "본사", code: "2" },
    { label: "영양사", labelKo: "영양사", code: "3" },
    { label: "통합/유틸", labelKo: "통합/유틸", code: "4" },
  ];

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" })); // 입력 시 에러 초기화
  };

  // 🔹 AccountList 조회 (영양사용)
  const fetchAccountList = async () => {
    try {
      const res = await api.get("/Account/AccountList", {
        params: { account_type: 0 },
      });
      setAccountList(res.data || []);
    } catch (err) {
      console.error("AccountList 조회 실패:", err);
      setAccountList([]);
    }
  };

  // 🔹 user_type 선택 시 부서/직책/거래처 자동 설정 로직
  const handleUserTypeChange = (code) => {
    if (code === "1") {
      // 대표
      setForm((prev) => ({
        ...prev,
        user_type: code,   // 🔹 이제 "1"
        department: "2",   // 대표 부서
        position: "0",     // 대표 직책
        account_id: "",
      }));
    } else if (code === "2") {
      // 본사 → 부서/직책 직접 선택
      setForm((prev) => ({
        ...prev,
        user_type: code,   // 🔹 이제 "2"
        department: "",
        position: "",
        account_id: "",
      }));
    } else if (code === "3") {
      // 영양사 → 현장 + 사원, 거래처 선택
      setForm((prev) => ({
        ...prev,
        user_type: code,   // 🔹 이제 "3"
        department: "7",   // 현장
        position: "8",     // 사원
        account_id: "",
      }));
      fetchAccountList(); // 거래처 목록 조회
    } else if (code === "4") {
      // 통합/유틸
      setForm((prev) => ({
        ...prev,
        user_type: code,
        util_member_type: "",
        department: "7", // 통합/유틸은 현장(7) 고정
        position: "8",   // 통합/유틸도 영양사(8) 고정
        account_id: "",
      }));
    } else {
      setForm((prev) => ({ ...prev, user_type: code }));
    }

    setErrors((prev) => ({
      ...prev,
      user_type: "",
      util_member_type: "",
      department: "",
      position: "",
      account_id: "",
    }));
  };

  // 🔹 입사일자 변경 (Date → YYYY-MM-DD)
  const handleJoinDateChange = (date) => {
    if (!date) {
      handleInputChange("join_dt", "");
      return;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    handleInputChange("join_dt", `${year}-${month}-${day}`);
  };

  // 🔹 생년월일 변경 (Date → YYYY-MM-DD)
  const handleBirthDateChange = (date) => {
    if (!date) {
      handleInputChange("birth_date", "");
      return;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    handleInputChange("birth_date", `${year}-${month}-${day}`);
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

  const handleSubmit = async () => {
    const requiredFields = [
      "user_name",
      "user_id",
      "password",
      "user_type",
      "phone",
      "address",
      "address_detail",
      "join_dt", // 🔹 입사일자는 항상 필수
    ];

    // 본사 → 부서/직책 필수
    if (form.user_type === "2") {
      requiredFields.push("department", "position");
    }

    // 영양사일 때 account_id 필수
    if (form.user_type === "3") {
      requiredFields.push("account_id");
    }
    // 통합/유틸 선택 시 타입 필수
    if (form.user_type === "4") {
      requiredFields.push("util_member_type");
    }

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

    // 🔹 info / detail 로 나눠서 payload 구성
    const info = {
      user_id: form.user_id,
      user_name: form.user_name,
      password: form.password,
      user_type: form.user_type,
      util_member_type: form.util_member_type || null,
      join_dt: form.join_dt,
      department: form.department !== "" ? Number(form.department) : null,
      position: form.position !== "" ? Number(form.position) : null,
    };

    // 영양사일 때만 account_id 포함
    if (form.user_type === "3" && form.account_id) {
      info.account_id = form.account_id;
    }
    // 통합/유틸 회원가입 시 account_id 코드 고정(통합=1, 유틸=2)
    if (form.user_type === "4") {
      const utilAccountId =
        form.util_member_type === "7" ? "1" : form.util_member_type === "6" ? "2" : "";
      // 통합/유틸 회원가입 시 position은 사원(8) 고정 저장
      info.position = 8;
      if (utilAccountId) {
        info.account_id = utilAccountId;
      }
    }

    const detail = {
      user_id: form.user_id,
      phone: form.phone,
      address: form.address,
      address_detail: form.address_detail,
      zipcode: form.zipcode,
      birth_date: form.birth_date || null
    };

    const payload = { info, detail };
    if (form.user_type === "4") {
      payload.account_member = {
        position_type: Number(form.util_member_type), // 유틸:6, 통합:7
      };
    }

    try {
      const res = await api.post("/User/UserRgt", payload);
      const ok = res?.status === 200 && (res?.data?.code === 200 || res?.data?.code === undefined);

      if (!ok) {
        throw new Error(res?.data?.message || "사용자 등록에 실패했습니다.");
      }

      Swal.fire({
        icon: "success",
        title: "사용자 등록 완료!",
        html: `<div style="white-space:pre-line;">
                관리자 승인 후 로그인이 가능합니다.
                관리자에게 문의해주세요.
                </div>`
      }).then(() => navigate("/authentication/sign-in"));
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "사용자 등록 실패",
        text: err?.response?.data?.message || err?.message || "서버에 문제가 발생했습니다.",
      });
    }
  };

  return (
    <BasicLayout>
      <Card>
        <MDBox pt={6} pb={3} px={6} textAlign="center">
          <img src={bgImage2} alt="logo" />
          <MDBox component="form" role="form">
            <MDBox mb={2}>
              <MDInput
                type="text"
                label="이름"
                value={form.user_name}
                onChange={(e) => handleInputChange("user_name", e.target.value)}
                fullWidth
                sx={inputSx}
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
                sx={inputSx}
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
                sx={inputSx}
                error={!!errors.password}
                helperText={errors.password}
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
            </MDBox>

            {/* 🔹 입사일자 (달력) */}
            <MDBox
              mb={2}
              sx={{
                "& .react-datepicker-wrapper": { width: "100%" },
                "& .react-datepicker__input-container": { width: "100%" },
                ...datePickerSx,
              }}
            >
              <DatePicker
                selected={form.join_dt ? new Date(form.join_dt) : null}
                onChange={handleJoinDateChange}
                dateFormat="yyyy-MM-dd"
                locale="ko"  // 🔹 한글 달력 적용
                customInput={
                  <MDInput
                    type="text"
                    label="입사일자"
                    fullWidth
                    sx={inputSx}
                    error={!!errors.join_dt}
                    helperText={errors.join_dt}
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                }
              />
            </MDBox>

            {/* 🔹 생년월일 (달력, 연/월 드롭다운) */}
            <MDBox
              mb={2}
              sx={{
                "& .react-datepicker-wrapper": { width: "100%" },
                "& .react-datepicker__input-container": { width: "100%" },
                ...datePickerSx,
              }}
            >
              <DatePicker
                selected={form.birth_date ? new Date(form.birth_date) : null}
                onChange={handleBirthDateChange}
                dateFormat="yyyy-MM-dd"
                locale="ko"
                showMonthDropdown         // 🔹 월 드롭다운
                showYearDropdown          // 🔹 연도 드롭다운
                dropdownMode="select"     // 🔹 select 박스로 선택
                maxDate={new Date()}      // 🔹 오늘 이후 선택 불가
                minDate={new Date(1950, 0, 1)} // 🔹 최소 1950년 1월 1일
                // 기본으로 열렸을 때 중간 연도로 맞추고 싶으면:
                // openToDate={new Date(1990, 0, 1)}
                customInput={
                  <MDInput
                    type="text"
                    label="생년월일"
                    fullWidth
                    sx={inputSx}
                    error={!!errors.birth_date}
                    helperText={errors.birth_date}
                    InputLabelProps={{ style: { fontSize: "0.7rem" } }}
                  />
                }
              />
            </MDBox>

            {/* 사용자타입 체크박스 */}
            <MDBox mb={2}>
              <MDBox display="flex" justifyContent="space-between">
                {USER_TYPE_OPTIONS.map((opt) => (
                  <MDBox key={opt.code} display="flex" alignItems="center">
                    <Checkbox
                      checked={form.user_type === opt.code}          // 🔹 "1", "2", "3" 비교
                      onChange={() => handleUserTypeChange(opt.code)}// 🔹 코드 전달
                    />
                    <MDTypography variant="body2" sx={{ fontSize: "0.75rem" }}>
                      {opt.labelKo}  {/* 화면에는 ceo / 본사 / 영양사 */}
                    </MDTypography>
                  </MDBox>
                ))}
              </MDBox>
              {errors.user_type && (
                <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                  {errors.user_type}
                </MDTypography>
              )}
            </MDBox>


            {/* 본사 선택 시 부서/직책 */}
            {form.user_type === "2" && (
              <MDBox mb={2} display="flex" gap={1}>
                {/* 부서 */}
                <FormControl
                  fullWidth
                  error={!!errors.department}
                  sx={{ flex: 1, ...selectSx }}
                >
                  <InputLabel sx={selectLabelSx}>부서</InputLabel>
                  <Select
                    label="부서"
                    value={form.department}
                    onChange={(e) => handleInputChange("department", e.target.value)}
                  >
                    <MenuItem value="2">회계팀</MenuItem>
                    <MenuItem value="3">인사팀</MenuItem>
                    <MenuItem value="4">영업팀</MenuItem>
                    <MenuItem value="5">운영팀</MenuItem>
                    <MenuItem value="6">개발팀</MenuItem>
                    {/* <MenuItem value="7">현장</MenuItem> */}
                  </Select>
                  {errors.department && (
                    <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                      {errors.department}
                    </MDTypography>
                  )}
                </FormControl>

                {/* 직책 */}
                <FormControl
                  fullWidth
                  error={!!errors.position}
                  sx={{ flex: 1, ...selectSx }}
                >
                  <InputLabel sx={selectLabelSx}>직책</InputLabel>
                  <Select
                    label="직책"
                    value={form.position}
                    onChange={(e) => handleInputChange("position", e.target.value)}
                  >
                    {/* <MenuItem value="0">대표</MenuItem> */}
                    <MenuItem value="1">팀장</MenuItem>
                    <MenuItem value="2">파트장</MenuItem>
                    <MenuItem value="3">매니저</MenuItem>
                  </Select>
                  {errors.position && (
                    <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                      {errors.position}
                    </MDTypography>
                  )}
                </FormControl>
              </MDBox>
            )}

            {/* 영양사 선택 시 거래처(근무지) 선택 */}
            {form.user_type === "3" && (
              <MDBox mb={2}>
                <FormControl
                  fullWidth
                  error={!!errors.account_id}
                  sx={selectSx}
                >
                  <InputLabel sx={selectLabelSx}>근무지(거래처)</InputLabel>
                  <Select
                    label="근무지(거래처)"
                    value={form.account_id}
                    onChange={(e) => handleInputChange("account_id", e.target.value)}
                  >
                    {accountList.map((account) => (
                      <MenuItem
                        key={account.account_id}
                        value={account.account_id}
                      >
                        {/* API 구조에 맞게 name 부분 필요시 account.account_name 으로 변경 */}
                        {account.name || account.account_name || account.account_id}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.account_id && (
                    <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                      {errors.account_id}
                    </MDTypography>
                  )}
                </FormControl>
              </MDBox>
            )}

            {/* 통합/유틸 선택 시 타입 선택 */}
            {form.user_type === "4" && (
              <MDBox mb={2}>
                <FormControl fullWidth error={!!errors.util_member_type} sx={selectSx}>
                  <InputLabel sx={selectLabelSx}>통합/유틸</InputLabel>
                  <Select
                    label="통합/유틸"
                    value={form.util_member_type}
                    onChange={(e) => handleInputChange("util_member_type", e.target.value)}
                  >
                    <MenuItem value="7">통합</MenuItem>
                    <MenuItem value="6">유틸</MenuItem>
                  </Select>
                  {errors.util_member_type && (
                    <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                      {errors.util_member_type}
                    </MDTypography>
                  )}
                </FormControl>
              </MDBox>
            )}

            <MDBox mb={2}>
              <MDInput
                type="text"
                label="전화번호"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                fullWidth
                sx={inputSx}
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
                sx={inputSx}
                readOnly
                error={!!errors.address}
                helperText={errors.address}
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
              <MDButton
                variant="gradient"
                color="info"
                onClick={() => setOpenPostcode(true)}
                sx={{ ml: 1, padding: "2px" }}
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
                sx={inputSx}
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
                sx={inputSx}
                readOnly
                InputLabelProps={{ style: { fontSize: "0.7rem" } }}
              />
            </MDBox>

            {/* ✅ 사용자 등록 / 취소 버튼 */}
            <MDBox mt={4} mb={1} display="flex" gap={1}>
              <MDButton
                variant="gradient"
                color="info"
                fullWidth
                onClick={handleSubmit}
              >
                사용자 등록
              </MDButton>
              <MDButton
                variant="gradient"
                color="warning"
                fullWidth
                onClick={() => navigate("/authentication/sign-in")}
              >
                취소
              </MDButton>
            </MDBox>
            {/* 주소 검색 모달 */}
            <Dialog
              open={openPostcode}
              onClose={() => setOpenPostcode(false)}
              maxWidth="sm"
              fullWidth
            >
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
