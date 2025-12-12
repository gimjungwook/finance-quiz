// 실용금융 퀴즈 문제 데이터 - 메인 로더
// 각 주차별 파일에서 데이터를 로드합니다

// 모든 주차 문제를 합침
const questions = [
    ...week1Questions,
    ...week3Questions,
    ...week5Questions,
    ...week7Questions,
    ...week9Questions,
    ...week11aQuestions,
    ...week11bQuestions,
    ...week13Questions,
    ...week14Questions,
    ...week15Questions
];

// 주차 정보
const weekInfo = {
    "1": { name: "1주차: 경제의 순환과 금융", shortName: "경제순환/금융기초" },
    "3": { name: "3주차: 금융지표 및 금융상품", shortName: "금융지표/금융상품" },
    "5": { name: "5주차: 금융투자상품", shortName: "금융투자상품" },
    "7": { name: "7주차: 펀드와 파생상품", shortName: "펀드/파생상품" },
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
