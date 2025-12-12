// 실용금융 퀴즈 문제 데이터 - 메인 로더
// 각 주차별 파일에서 데이터를 로드합니다

// 모든 주차 문제를 합침
const questions = [
    ...week9Questions,
    ...week11aQuestions,
    ...week11bQuestions,
    ...week13Questions,
    ...week14Questions,
    ...week15Questions
];

// 주차 정보
const weekInfo = {
    "9": { name: "9주차: 신용관리", shortName: "신용관리" },
    "11a": { name: "11주차: 부채관리", shortName: "부채관리" },
    "11b": { name: "11주차: 보험과 위험관리", shortName: "보험/위험관리" },
    "13": { name: "13주차: 노후와 연금", shortName: "노후와 연금" },
    "14": { name: "14주차: 신기술과 금융의변화", shortName: "핀테크" },
    "15": { name: "15주차: 금융소비자보호", shortName: "금융소비자보호" }
};

// 주차별 문제 필터링 함수
function getQuestionsByWeek(week) {
    return questions.filter(q => q.week === week);
}

// 전체 문제 수
function getTotalQuestionCount() {
    return questions.length;
}
