// 거래처 선택칸(TextField) 라벨과 테두리 끊김(노치) 길이를 맞추는 공통 스타일
// 위로 올라간 라벨은 12px의 75%(9px)로 표시되므로, 테두리를 끊는 legend 글자도 9px로 고정해
// 화면마다 입력칸 글자 크기가 달라도 라벨 좌우 여백이 똑같이 보이게 함
const accountLabelSx = {
  "& .MuiInputLabel-root, & .MuiInputLabel-root.MuiInputLabel-shrink": { fontSize: 12 },
  "& .MuiInputLabel-root.MuiInputLabel-shrink ~ .MuiInputBase-root .MuiOutlinedInput-notchedOutline legend": {
    fontSize: "9px",
    paddingRight: 0,
  },
};

export default accountLabelSx;
