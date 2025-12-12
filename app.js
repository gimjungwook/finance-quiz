// ============================
// 실용금융 퀴즈 앱 - app.js
// ============================

// 상태 관리
const state = {
    currentMode: null,      // 'weekly', 'review', 'infinite'
    selectedWeeks: [],      // 선택된 주차들
    questions: [],          // 현재 세션의 문제들
    currentIndex: 0,        // 현재 문제 인덱스
    correctCount: 0,        // 맞은 개수
    wrongQuestions: [],     // 틀린 문제들 (현재 세션)
    userAnswer: null,       // 사용자가 선택한 답
    isAnswered: false,      // 답변 완료 여부
    // 무한 모드 전용
    infinitePool: [],       // 무한 모드 문제 풀
    infiniteSolved: 0,      // 무한 모드에서 푼 문제 수
    currentQuestion: null,  // 현재 문제 (무한 모드용)
    // 선택지 섞기용
    shuffledOptions: [],    // 섞인 선택지
    shuffledAnswerIndex: 0, // 섞인 후 정답 인덱스
    originalToShuffled: {}  // 원본 인덱스 -> 섞인 인덱스 매핑
};

// localStorage 키
const STORAGE_KEY = 'finance_quiz_stats';

// ============================
// 해설 포맷팅
// ============================

// Mermaid 초기화
let mermaidInitialized = false;
function initMermaid() {
    if (!mermaidInitialized && typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
                primaryColor: '#e7f3ff',
                primaryTextColor: '#37352f',
                primaryBorderColor: '#2383e2',
                lineColor: '#6b6b6b',
                secondaryColor: '#f7f6f3',
                tertiaryColor: '#dbeddb',
                fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif'
            },
            flowchart: { useMaxWidth: true, htmlLabels: true },
            mindmap: { useMaxWidth: true }
        });
        mermaidInitialized = true;
    }
}

// Mermaid 다이어그램 렌더링
let mermaidCounter = 0;
async function renderMermaidDiagrams() {
    initMermaid();
    const diagrams = document.querySelectorAll('.mermaid-diagram:not([data-processed])');
    for (const el of diagrams) {
        try {
            const id = `mermaid-${++mermaidCounter}`;
            const code = el.textContent;
            const { svg } = await mermaid.render(id, code);
            el.innerHTML = svg;
            el.setAttribute('data-processed', 'true');
        } catch (e) {
            console.error('Mermaid render error:', e);
            el.innerHTML = '<div class="mermaid-error">다이어그램 렌더링 실패</div>';
        }
    }
}

function formatExplanation(text) {
    if (!text) return '';

    let html = text;

    // Mermaid 코드 블록 처리 (```mermaid ... ```)
    html = html.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
        return `<div class="mermaid-container"><div class="mermaid-diagram">${code.trim()}</div></div>`;
    });

    // 마크다운 테이블을 HTML 테이블로 변환
    const tableRegex = /\|(.+)\|\n\|[-\s|]+\|\n((?:\|.+\|\n?)+)/g;
    html = html.replace(tableRegex, (match, header, body) => {
        const headers = header.split('|').filter(h => h.trim());
        const rows = body.trim().split('\n').map(row =>
            row.split('|').filter(cell => cell.trim())
        );

        let table = '<table class="explanation-table"><thead><tr>';
        headers.forEach(h => table += `<th>${h.trim()}</th>`);
        table += '</tr></thead><tbody>';
        rows.forEach(row => {
            table += '<tr>';
            row.forEach(cell => table += `<td>${cell.trim()}</td>`);
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    });

    // 섹션 헤더 스타일링
    html = html.replace(/^(📚[^\n]+)/gm, '<div class="exp-section-title concept">$1</div>');
    html = html.replace(/^(✅[^\n]+)/gm, '<div class="exp-section-title correct">$1</div>');
    html = html.replace(/^(❌[^\n]+)/gm, '<div class="exp-section-title wrong">$1</div>');
    html = html.replace(/^(💡[^\n]+)/gm, '<div class="exp-section-title tip">$1</div>');
    html = html.replace(/^(🔍[^\n]+)/gm, '<div class="exp-section-title info">$1</div>');
    html = html.replace(/^(📊[^\n]+)/gm, '<div class="exp-section-title chart">$1</div>');

    // 【정답: ...】 형식 제거 (이미 정답 섹션에 표시됨)
    html = html.replace(/【정답:[^】]+】\n?/g, '');

    // 불릿 포인트 스타일링
    html = html.replace(/^• (.+)$/gm, '<div class="exp-bullet">$1</div>');

    // 줄바꿈 처리
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
}

// ============================
// 통계 관리
// ============================

function loadStats() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    return {
        questionStats: {},  // { questionId: { correct: 0, wrong: 0 } }
        totalSolved: 0,
        totalCorrect: 0
    };
}

function saveStats(stats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function updateStats(questionId, isCorrect) {
    const stats = loadStats();

    if (!stats.questionStats[questionId]) {
        stats.questionStats[questionId] = { correct: 0, wrong: 0 };
    }

    if (isCorrect) {
        stats.questionStats[questionId].correct++;
        stats.totalCorrect++;
    } else {
        stats.questionStats[questionId].wrong++;
    }
    stats.totalSolved++;

    saveStats(stats);
}

function getQuestionStats(questionId) {
    const stats = loadStats();
    return stats.questionStats[questionId] || { correct: 0, wrong: 0 };
}

// ============================
// UI 업데이트
// ============================

function updateMainStats() {
    const stats = loadStats();
    document.getElementById('total-solved').textContent = stats.totalSolved;

    const accuracy = stats.totalSolved > 0
        ? Math.round((stats.totalCorrect / stats.totalSolved) * 100)
        : 0;
    document.getElementById('total-accuracy').textContent = accuracy + '%';
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function updateStartSection() {
    const startSection = document.getElementById('start-section');
    const selectedInfo = document.getElementById('selected-info');

    if (state.currentMode && state.selectedWeeks.length > 0) {
        const modeNames = {
            'weekly': '주차별 퀴즈',
            'review': '틀린 문제 복습',
            'infinite': '무한 모드'
        };

        const weekNames = state.selectedWeeks.map(w => weekInfo[w]?.name || w + '주차').join(', ');
        selectedInfo.textContent = `${weekNames} / ${modeNames[state.currentMode]}`;
        startSection.style.display = 'block';
    } else {
        startSection.style.display = 'none';
    }
}

// ============================
// 문제 선택 로직
// ============================

function getQuestionsForWeeks(weeks) {
    return questions.filter(q => weeks.includes(q.week));
}

function getWrongQuestions(weeks) {
    const stats = loadStats();
    const weekQuestions = getQuestionsForWeeks(weeks);

    return weekQuestions.filter(q => {
        const qStats = stats.questionStats[q.id];
        return qStats && qStats.wrong > 0;
    });
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 선택지 섞기 함수 (정답 인덱스도 함께 추적)
function shuffleOptionsWithAnswer(options, correctAnswerIndex) {
    // 원본 인덱스와 함께 선택지 배열 생성
    const optionsWithIndex = options.map((opt, idx) => ({ text: opt, originalIndex: idx }));

    // Fisher-Yates 셔플
    for (let i = optionsWithIndex.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
    }

    // 섞인 선택지와 새로운 정답 인덱스 계산
    const shuffledOptions = optionsWithIndex.map(item => item.text);
    const newAnswerIndex = optionsWithIndex.findIndex(item => item.originalIndex === correctAnswerIndex);

    // 원본 -> 섞인 인덱스 매핑 생성
    const originalToShuffled = {};
    optionsWithIndex.forEach((item, newIdx) => {
        originalToShuffled[item.originalIndex] = newIdx;
    });

    return {
        options: shuffledOptions,
        answerIndex: newAnswerIndex,
        originalToShuffled: originalToShuffled
    };
}

function weightedRandomSelect(questionsPool, count) {
    const stats = loadStats();
    const selected = [];
    const available = [...questionsPool];

    for (let i = 0; i < count && available.length > 0; i++) {
        // 가중치 계산
        const weights = available.map(q => {
            const qStats = stats.questionStats[q.id];
            if (qStats && qStats.wrong > 0) {
                return 3; // 틀린 문제: 3배 가중치
            }
            return 1;
        });

        // 가중치 합계
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        // 랜덤 선택
        let random = Math.random() * totalWeight;
        let selectedIndex = 0;

        for (let j = 0; j < weights.length; j++) {
            random -= weights[j];
            if (random <= 0) {
                selectedIndex = j;
                break;
            }
        }

        selected.push(available[selectedIndex]);
        available.splice(selectedIndex, 1);
    }

    return selected;
}

// 무한 모드: 풀에서 가중치 기반으로 1문제 선택
function selectFromInfinitePool() {
    const stats = loadStats();
    const pool = state.infinitePool;

    if (pool.length === 0) return null;

    // 가중치 계산: 틀린 문제는 3배
    const weights = pool.map(q => {
        const qStats = stats.questionStats[q.id];
        if (qStats && qStats.wrong > 0) {
            return 3;
        }
        return 1;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return { question: pool[i], index: i };
        }
    }

    return { question: pool[0], index: 0 };
}

function prepareQuestions() {
    const weekQuestions = getQuestionsForWeeks(state.selectedWeeks);

    switch (state.currentMode) {
        case 'weekly':
            // 순서대로 (섞지 않음)
            state.questions = [...weekQuestions];
            break;

        case 'review':
            // 틀린 문제만
            const wrongOnes = getWrongQuestions(state.selectedWeeks);
            state.questions = shuffleArray(wrongOnes);
            break;

        case 'infinite':
            // 무한 모드: 풀 초기화
            state.infinitePool = [...weekQuestions];
            state.infiniteSolved = 0;
            state.correctCount = 0;
            return state.infinitePool.length > 0;
    }

    return state.questions.length > 0;
}

// ============================
// 퀴즈 진행
// ============================

function startQuiz() {
    if (!prepareQuestions()) {
        if (state.currentMode === 'review') {
            alert('틀린 문제가 없습니다! 다른 모드를 선택해주세요.');
        } else {
            alert('선택한 주차에 문제가 없습니다.');
        }
        return;
    }

    state.currentIndex = 0;
    state.correctCount = 0;
    state.wrongQuestions = [];

    showScreen('quiz-screen');

    if (state.currentMode === 'infinite') {
        displayInfiniteQuestion();
    } else {
        displayQuestion();
    }
}

function displayQuestion() {
    const question = state.questions[state.currentIndex];
    state.isAnswered = false;
    state.userAnswer = null;

    // 진행률 업데이트
    document.getElementById('question-number').textContent = state.currentIndex + 1;
    document.getElementById('total-questions').textContent = state.questions.length;

    const progress = ((state.currentIndex) / state.questions.length) * 100;
    document.getElementById('progress-fill').style.width = progress + '%';

    // 모드 뱃지
    const modeBadge = document.getElementById('current-mode-badge');
    const modeNames = { 'weekly': '주차별', 'review': '복습', 'infinite': '무한' };
    modeBadge.textContent = modeNames[state.currentMode];

    // 문제 유형 뱃지
    const typeBadge = document.getElementById('question-type-badge');
    typeBadge.textContent = question.type === 'ox' ? 'O/X' : '객관식';

    // 틀렸던 문제 배지
    const wrongBadge = document.getElementById('previously-wrong-badge');
    const qStats = getQuestionStats(question.id);
    if (qStats.wrong > 0) {
        wrongBadge.classList.add('show');
    } else {
        wrongBadge.classList.remove('show');
    }

    // 문제 텍스트
    document.getElementById('question-text').textContent = question.question;

    // 선택지 생성
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    if (question.type === 'fill') {
        // 빈칸 채우기 문제
        container.innerHTML = `
            <div class="fill-container">
                <div class="fill-input-wrapper">
                    <input type="text" class="fill-input" id="fill-answer" placeholder="정답을 입력하세요..." autocomplete="off">
                    <button class="fill-submit-btn" id="fill-submit">제출</button>
                </div>
                <div class="fill-hint">
                    <span class="key-hint">Enter</span> 제출 &nbsp;&nbsp;
                    <span class="key-hint">Space</span> 모르겠음
                </div>
            </div>
        `;

        const fillInput = document.getElementById('fill-answer');
        const fillSubmit = document.getElementById('fill-submit');

        fillInput.focus();

        fillSubmit.addEventListener('click', () => submitFillAnswer(question, fillInput, false));
        fillInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !state.isAnswered) {
                e.preventDefault();
                submitFillAnswer(question, fillInput, false);
            }
        });
    } else if (question.type === 'ox') {
        // O/X 문제
        container.innerHTML = `
            <div class="ox-container">
                <button class="ox-btn o" data-answer="true"><span class="key-hint">A</span> O</button>
                <button class="ox-btn x" data-answer="false"><span class="key-hint">S</span> X</button>
            </div>
            <button class="option-btn skip" data-answer="skip"><span class="key-hint">Space</span> 🤷 모르겠음</button>
        `;

        container.querySelectorAll('.ox-btn').forEach(btn => {
            btn.addEventListener('click', () => selectOXAnswer(btn));
        });
    } else {
        // 객관식 문제 - 선택지 섞기
        const shuffled = shuffleOptionsWithAnswer(question.options, question.answer);
        state.shuffledOptions = shuffled.options;
        state.shuffledAnswerIndex = shuffled.answerIndex;
        state.originalToShuffled = shuffled.originalToShuffled;

        const keys = ['A', 'S', 'D', 'F'];
        shuffled.options.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="key-hint">${keys[index]}</span> ${option}`;
            btn.dataset.answer = index;
            btn.addEventListener('click', () => selectAnswer(btn, index));
            container.appendChild(btn);
        });

        // 모르겠음 버튼
        const skipBtn = document.createElement('button');
        skipBtn.className = 'option-btn skip';
        skipBtn.innerHTML = '<span class="key-hint">Space</span> 🤷 모르겠음';
        skipBtn.dataset.answer = 'skip';
        skipBtn.addEventListener('click', () => selectAnswer(skipBtn, 'skip'));
        container.appendChild(skipBtn);
    }
}

// 무한 모드 전용 문제 표시
function displayInfiniteQuestion() {
    const selected = selectFromInfinitePool();

    if (!selected) {
        // 모든 문제를 맞춤!
        showInfiniteComplete();
        return;
    }

    state.currentQuestion = selected.question;
    state.currentQuestionIndex = selected.index;
    state.isAnswered = false;
    state.userAnswer = null;

    const question = state.currentQuestion;

    // 진행 정보 업데이트 (무한 모드)
    document.getElementById('question-number').textContent = state.infiniteSolved + 1;
    document.getElementById('total-questions').textContent = `남은 ${state.infinitePool.length}`;

    // 프로그레스 바: 남은 문제 비율
    const weekQuestions = getQuestionsForWeeks(state.selectedWeeks);
    const completedRatio = ((weekQuestions.length - state.infinitePool.length) / weekQuestions.length) * 100;
    document.getElementById('progress-fill').style.width = completedRatio + '%';

    // 모드 뱃지
    const modeBadge = document.getElementById('current-mode-badge');
    modeBadge.textContent = `♾️ ${state.correctCount}/${state.infiniteSolved}`;

    // 문제 유형 뱃지
    const typeBadge = document.getElementById('question-type-badge');
    typeBadge.textContent = question.type === 'ox' ? 'O/X' : '객관식';

    // 틀렸던 문제 배지
    const wrongBadge = document.getElementById('previously-wrong-badge');
    const qStats = getQuestionStats(question.id);
    if (qStats.wrong > 0) {
        wrongBadge.classList.add('show');
    } else {
        wrongBadge.classList.remove('show');
    }

    // 문제 텍스트
    document.getElementById('question-text').textContent = question.question;

    // 선택지 생성
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    if (question.type === 'fill') {
        // 빈칸 채우기 문제
        container.innerHTML = `
            <div class="fill-container">
                <div class="fill-input-wrapper">
                    <input type="text" class="fill-input" id="fill-answer" placeholder="정답을 입력하세요..." autocomplete="off">
                    <button class="fill-submit-btn" id="fill-submit">제출</button>
                </div>
                <div class="fill-hint">
                    <span class="key-hint">Enter</span> 제출 &nbsp;&nbsp;
                    <span class="key-hint">Space</span> 모르겠음
                </div>
            </div>
        `;

        const fillInput = document.getElementById('fill-answer');
        const fillSubmit = document.getElementById('fill-submit');

        fillInput.focus();

        fillSubmit.addEventListener('click', () => submitFillAnswer(question, fillInput, true));
        fillInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !state.isAnswered) {
                e.preventDefault();
                submitFillAnswer(question, fillInput, true);
            }
        });
    } else if (question.type === 'ox') {
        container.innerHTML = `
            <div class="ox-container">
                <button class="ox-btn o" data-answer="true"><span class="key-hint">A</span> O</button>
                <button class="ox-btn x" data-answer="false"><span class="key-hint">S</span> X</button>
            </div>
            <button class="option-btn skip" data-answer="skip"><span class="key-hint">Space</span> 🤷 모르겠음</button>
        `;

        container.querySelectorAll('.ox-btn').forEach(btn => {
            btn.addEventListener('click', () => selectInfiniteOXAnswer(btn));
        });
    } else {
        // 객관식 문제 - 선택지 섞기
        const shuffled = shuffleOptionsWithAnswer(question.options, question.answer);
        state.shuffledOptions = shuffled.options;
        state.shuffledAnswerIndex = shuffled.answerIndex;
        state.originalToShuffled = shuffled.originalToShuffled;

        const keys = ['A', 'S', 'D', 'F'];
        shuffled.options.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="key-hint">${keys[index]}</span> ${option}`;
            btn.dataset.answer = index;
            btn.addEventListener('click', () => selectInfiniteAnswer(btn, index));
            container.appendChild(btn);
        });

        const skipBtn = document.createElement('button');
        skipBtn.className = 'option-btn skip';
        skipBtn.innerHTML = '<span class="key-hint">Space</span> 🤷 모르겠음';
        skipBtn.dataset.answer = 'skip';
        skipBtn.addEventListener('click', () => selectInfiniteAnswer(skipBtn, 'skip'));
        container.appendChild(skipBtn);
    }
}

// 빈칸 채우기 답변 제출
function submitFillAnswer(question, fillInput, isInfiniteMode) {
    if (state.isAnswered) return;

    const userAnswer = fillInput.value.trim();
    const isSkip = userAnswer === '';

    state.isAnswered = true;
    state.userAnswer = userAnswer;

    // 정답 확인 (대소문자 무시, 공백 제거 후 비교)
    const normalizeAnswer = (str) => str.toLowerCase().replace(/\s+/g, '');
    const correctAnswer = question.answer;
    const alternatives = question.alternatives || [];
    const allCorrectAnswers = [correctAnswer, ...alternatives];

    const isCorrect = !isSkip && allCorrectAnswers.some(
        ans => normalizeAnswer(String(ans)) === normalizeAnswer(userAnswer)
    );

    // 입력 필드 상태 업데이트
    fillInput.disabled = true;
    document.getElementById('fill-submit').disabled = true;

    if (isSkip) {
        fillInput.classList.add('wrong');
        fillInput.value = '(미입력)';
    } else if (isCorrect) {
        fillInput.classList.add('correct');
    } else {
        fillInput.classList.add('wrong');
    }

    // 통계 업데이트
    updateStats(question.id, isCorrect);

    if (isInfiniteMode) {
        state.infiniteSolved++;
        if (isCorrect) {
            state.correctCount++;
            state.infinitePool.splice(state.currentQuestionIndex, 1);
        }
        setTimeout(() => showInfiniteExplanation(question, isCorrect, isSkip), 500);
    } else {
        if (isCorrect) {
            state.correctCount++;
        } else {
            state.wrongQuestions.push(question);
        }
        setTimeout(() => showExplanation(question, isCorrect, isSkip), 500);
    }
}

// 무한 모드: 객관식 답변 선택
function selectInfiniteAnswer(btn, answer) {
    if (state.isAnswered) return;
    state.isAnswered = true;
    state.userAnswer = answer;

    const question = state.currentQuestion;
    // 섞인 인덱스와 비교
    const isCorrect = answer === state.shuffledAnswerIndex;
    const isSkip = answer === 'skip';

    // 버튼 상태 업데이트 (섞인 정답 인덱스 사용)
    document.querySelectorAll('.option-btn').forEach(b => {
        b.disabled = true;
        const idx = parseInt(b.dataset.answer);
        if (idx === state.shuffledAnswerIndex) {
            b.classList.add('correct');
        } else if (b === btn && !isCorrect) {
            b.classList.add('wrong');
        }
    });

    // 통계 업데이트
    updateStats(question.id, isCorrect && !isSkip);
    state.infiniteSolved++;

    if (isCorrect && !isSkip) {
        state.correctCount++;
        // 맞추면 풀에서 제거
        state.infinitePool.splice(state.currentQuestionIndex, 1);
    }
    // 틀리면 풀에 그대로 유지 (다시 나올 수 있음)

    setTimeout(() => showInfiniteExplanation(question, isCorrect, isSkip), 500);
}

// 무한 모드: O/X 답변 선택
function selectInfiniteOXAnswer(btn) {
    if (state.isAnswered) return;
    state.isAnswered = true;

    const answer = btn.dataset.answer === 'true';
    state.userAnswer = answer;

    const question = state.currentQuestion;
    const isCorrect = answer === question.answer;

    document.querySelectorAll('.ox-btn, .option-btn').forEach(b => {
        b.disabled = true;
    });

    btn.classList.add('selected');

    const correctBtn = question.answer ? document.querySelector('.ox-btn.o') : document.querySelector('.ox-btn.x');
    if (isCorrect) {
        btn.classList.add('correct');
    } else {
        btn.classList.add('wrong');
        correctBtn.classList.add('correct');
    }

    updateStats(question.id, isCorrect);
    state.infiniteSolved++;

    if (isCorrect) {
        state.correctCount++;
        state.infinitePool.splice(state.currentQuestionIndex, 1);
    }

    setTimeout(() => showInfiniteExplanation(question, isCorrect, false), 500);
}

// 무한 모드: 해설 표시
function showInfiniteExplanation(question, isCorrect, isSkip) {
    showScreen('explanation-screen');

    const header = document.getElementById('result-header');
    if (isSkip) {
        header.className = 'result-header wrong';
        header.textContent = '🤷 모르겠음 선택 (오답 처리)';
    } else if (isCorrect) {
        header.className = 'result-header correct';
        header.textContent = '✅ 정답입니다! (풀에서 제거됨)';
    } else {
        header.className = 'result-header wrong';
        header.textContent = '❌ 오답입니다! (다시 출제됨)';
    }

    // 문제 텍스트 표시
    document.getElementById('question-review-text').textContent = question.question;

    let correctAnswerText;
    if (question.type === 'ox') {
        correctAnswerText = question.answer ? 'O (참)' : 'X (거짓)';
    } else if (question.type === 'fill') {
        correctAnswerText = question.answer;
        if (question.alternatives && question.alternatives.length > 0) {
            correctAnswerText += ` (또는: ${question.alternatives.join(', ')})`;
        }
    } else {
        correctAnswerText = question.options[question.answer];
    }
    document.getElementById('correct-answer').textContent = correctAnswerText;

    const yourAnswerSection = document.getElementById('your-answer-section');
    if (!isCorrect && !isSkip) {
        yourAnswerSection.style.display = 'block';
        let userAnswerText;
        if (question.type === 'ox') {
            userAnswerText = state.userAnswer ? 'O (참)' : 'X (거짓)';
        } else if (question.type === 'fill') {
            userAnswerText = state.userAnswer || '(미입력)';
        } else {
            // 섞인 선택지에서 사용자가 선택한 텍스트 가져오기
            userAnswerText = state.shuffledOptions[state.userAnswer];
        }
        document.getElementById('your-answer').textContent = userAnswerText;
    } else {
        yourAnswerSection.style.display = 'none';
    }

    document.getElementById('explanation-text').innerHTML = formatExplanation(question.explanation);

    // Mermaid 다이어그램 렌더링
    renderMermaidDiagrams();

    const tipSection = document.getElementById('tip-section');
    if (question.tip) {
        tipSection.style.display = 'block';
        document.getElementById('tip-text').textContent = question.tip;
    } else {
        tipSection.style.display = 'none';
    }

    const nextBtn = document.getElementById('next-question');
    if (state.infinitePool.length === 0) {
        nextBtn.textContent = '🎉 완료! 결과 보기';
    } else {
        nextBtn.textContent = `다음 문제 → (남은 ${state.infinitePool.length}개)`;
    }
}

// 무한 모드 완료
function showInfiniteComplete() {
    showScreen('result-screen');

    document.getElementById('result-score').textContent = state.correctCount;
    document.getElementById('result-total').textContent = '/ ' + state.infiniteSolved;

    const percentage = state.infiniteSolved > 0
        ? Math.round((state.correctCount / state.infiniteSolved) * 100)
        : 0;
    document.getElementById('result-percentage').textContent = percentage + '%';

    document.getElementById('result-message').textContent = '🎉 모든 문제를 마스터했습니다!';

    document.getElementById('retry-wrong').style.display = 'none';

    updateMainStats();
}

function selectAnswer(btn, answer) {
    if (state.isAnswered) return;
    state.isAnswered = true;
    state.userAnswer = answer;

    const question = state.questions[state.currentIndex];
    // 섞인 인덱스와 비교
    const isCorrect = answer === state.shuffledAnswerIndex;
    const isSkip = answer === 'skip';

    // 버튼 상태 업데이트 (섞인 정답 인덱스 사용)
    document.querySelectorAll('.option-btn').forEach(b => {
        b.disabled = true;
        const idx = parseInt(b.dataset.answer);
        if (idx === state.shuffledAnswerIndex) {
            b.classList.add('correct');
        } else if (b === btn && !isCorrect) {
            b.classList.add('wrong');
        }
    });

    // 통계 업데이트
    updateStats(question.id, isCorrect && !isSkip);

    if (isCorrect && !isSkip) {
        state.correctCount++;
    } else {
        state.wrongQuestions.push(question);
    }

    // 해설 화면으로 이동
    setTimeout(() => showExplanation(question, isCorrect, isSkip), 500);
}

function selectOXAnswer(btn) {
    if (state.isAnswered) return;
    state.isAnswered = true;

    const answer = btn.dataset.answer === 'true';
    state.userAnswer = answer;

    const question = state.questions[state.currentIndex];
    const isCorrect = answer === question.answer;

    // 버튼 상태 업데이트
    document.querySelectorAll('.ox-btn, .option-btn').forEach(b => {
        b.disabled = true;
    });

    btn.classList.add('selected');

    // 정답/오답 표시
    const correctBtn = question.answer ? document.querySelector('.ox-btn.o') : document.querySelector('.ox-btn.x');
    if (isCorrect) {
        btn.classList.add('correct');
    } else {
        btn.classList.add('wrong');
        correctBtn.classList.add('correct');
    }

    // 통계 업데이트
    updateStats(question.id, isCorrect);

    if (isCorrect) {
        state.correctCount++;
    } else {
        state.wrongQuestions.push(question);
    }

    // 해설 화면으로 이동
    setTimeout(() => showExplanation(question, isCorrect, false), 500);
}

// 모르겠음 선택 (O/X용)
document.addEventListener('click', (e) => {
    if (e.target.matches('.option-btn.skip') && !state.isAnswered) {
        // 무한 모드
        if (state.currentMode === 'infinite') {
            const question = state.currentQuestion;
            if (question && question.type === 'ox') {
                state.isAnswered = true;
                state.userAnswer = 'skip';

                document.querySelectorAll('.ox-btn, .option-btn').forEach(b => {
                    b.disabled = true;
                });

                e.target.classList.add('selected');

                const correctBtn = question.answer ? document.querySelector('.ox-btn.o') : document.querySelector('.ox-btn.x');
                correctBtn.classList.add('correct');

                updateStats(question.id, false);
                state.infiniteSolved++;
                // 틀렸으므로 풀에서 제거하지 않음

                setTimeout(() => showInfiniteExplanation(question, false, true), 500);
            }
            return;
        }

        // 일반 모드
        const question = state.questions[state.currentIndex];

        if (question.type === 'ox') {
            state.isAnswered = true;
            state.userAnswer = 'skip';

            document.querySelectorAll('.ox-btn, .option-btn').forEach(b => {
                b.disabled = true;
            });

            e.target.classList.add('selected');

            // 정답 표시
            const correctBtn = question.answer ? document.querySelector('.ox-btn.o') : document.querySelector('.ox-btn.x');
            correctBtn.classList.add('correct');

            // 통계 업데이트 (틀림으로 처리)
            updateStats(question.id, false);
            state.wrongQuestions.push(question);

            setTimeout(() => showExplanation(question, false, true), 500);
        }
    }
});

function showExplanation(question, isCorrect, isSkip) {
    showScreen('explanation-screen');

    // 결과 헤더
    const header = document.getElementById('result-header');
    if (isSkip) {
        header.className = 'result-header wrong';
        header.textContent = '🤷 모르겠음 선택 (오답 처리)';
    } else if (isCorrect) {
        header.className = 'result-header correct';
        header.textContent = '✅ 정답입니다!';
    } else {
        header.className = 'result-header wrong';
        header.textContent = '❌ 오답입니다!';
    }

    // 문제 텍스트 표시
    document.getElementById('question-review-text').textContent = question.question;

    // 정답 표시
    let correctAnswerText;
    if (question.type === 'ox') {
        correctAnswerText = question.answer ? 'O (참)' : 'X (거짓)';
    } else if (question.type === 'fill') {
        correctAnswerText = question.answer;
        if (question.alternatives && question.alternatives.length > 0) {
            correctAnswerText += ` (또는: ${question.alternatives.join(', ')})`;
        }
    } else {
        correctAnswerText = question.options[question.answer];
    }
    document.getElementById('correct-answer').textContent = correctAnswerText;

    // 사용자 답변 표시 (오답인 경우)
    const yourAnswerSection = document.getElementById('your-answer-section');
    if (!isCorrect && !isSkip) {
        yourAnswerSection.style.display = 'block';
        let userAnswerText;
        if (question.type === 'ox') {
            userAnswerText = state.userAnswer ? 'O (참)' : 'X (거짓)';
        } else if (question.type === 'fill') {
            userAnswerText = state.userAnswer || '(미입력)';
        } else {
            // 섞인 선택지에서 사용자가 선택한 텍스트 가져오기
            userAnswerText = state.shuffledOptions[state.userAnswer];
        }
        document.getElementById('your-answer').textContent = userAnswerText;
    } else {
        yourAnswerSection.style.display = 'none';
    }

    // 해설 (포맷팅 적용)
    document.getElementById('explanation-text').innerHTML = formatExplanation(question.explanation);

    // Mermaid 다이어그램 렌더링
    renderMermaidDiagrams();

    // 팁 (있는 경우)
    const tipSection = document.getElementById('tip-section');
    if (question.tip) {
        tipSection.style.display = 'block';
        document.getElementById('tip-text').textContent = question.tip;
    } else {
        tipSection.style.display = 'none';
    }

    // 다음 버튼 텍스트
    const nextBtn = document.getElementById('next-question');
    if (state.currentIndex >= state.questions.length - 1) {
        nextBtn.textContent = '결과 보기 →';
    } else {
        nextBtn.textContent = '다음 문제 →';
    }
}

function nextQuestion() {
    // 무한 모드
    if (state.currentMode === 'infinite') {
        if (state.infinitePool.length === 0) {
            showInfiniteComplete();
        } else {
            showScreen('quiz-screen');
            displayInfiniteQuestion();
        }
        return;
    }

    // 일반 모드
    state.currentIndex++;

    if (state.currentIndex >= state.questions.length) {
        showResults();
    } else {
        showScreen('quiz-screen');
        displayQuestion();
    }
}

function showResults() {
    showScreen('result-screen');

    const total = state.questions.length;
    const correct = state.correctCount;
    const percentage = Math.round((correct / total) * 100);

    document.getElementById('result-score').textContent = correct;
    document.getElementById('result-total').textContent = '/ ' + total;
    document.getElementById('result-percentage').textContent = percentage + '%';

    // 결과 메시지
    let message;
    if (percentage >= 90) {
        message = '🎉 완벽해요! 시험 준비 완료!';
    } else if (percentage >= 70) {
        message = '👍 잘하고 있어요! 조금만 더 복습하면 완벽!';
    } else if (percentage >= 50) {
        message = '📚 복습이 필요해요. 틀린 문제를 다시 풀어보세요!';
    } else {
        message = '💪 포기하지 마세요! 반복 학습이 중요해요!';
    }
    document.getElementById('result-message').textContent = message;

    // 틀린 문제 다시 풀기 버튼 표시/숨김
    const retryWrongBtn = document.getElementById('retry-wrong');
    if (state.wrongQuestions.length > 0) {
        retryWrongBtn.style.display = 'block';
        retryWrongBtn.textContent = `🔄 틀린 문제만 다시 풀기 (${state.wrongQuestions.length}문제)`;
    } else {
        retryWrongBtn.style.display = 'none';
    }

    // 메인 통계 업데이트
    updateMainStats();
}

// ============================
// 이벤트 리스너
// ============================

document.addEventListener('DOMContentLoaded', () => {
    // 메인 통계 업데이트
    updateMainStats();

    // 주차 버튼
    document.querySelectorAll('.week-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const week = btn.dataset.week;

            if (btn.classList.contains('selected')) {
                btn.classList.remove('selected');
                state.selectedWeeks = state.selectedWeeks.filter(w => w !== week);
            } else {
                btn.classList.add('selected');
                state.selectedWeeks.push(week);
            }

            updateStartSection();
        });
    });

    // 모드 버튼
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            if (btn.id === 'mode-weekly') {
                state.currentMode = 'weekly';
            } else if (btn.id === 'mode-review') {
                state.currentMode = 'review';
            } else if (btn.id === 'mode-infinite') {
                state.currentMode = 'infinite';
            }

            updateStartSection();
        });
    });

    // 시작 버튼
    document.getElementById('start-quiz').addEventListener('click', startQuiz);

    // 메인으로 버튼
    document.getElementById('back-to-main').addEventListener('click', () => {
        if (confirm('정말 메인으로 돌아가시겠습니까? 현재 진행 상황이 저장되지 않습니다.')) {
            showScreen('main-screen');
            updateMainStats();
        }
    });

    // 다음 문제 버튼
    document.getElementById('next-question').addEventListener('click', nextQuestion);

    // 결과 화면 버튼들
    document.getElementById('retry-wrong').addEventListener('click', () => {
        if (state.wrongQuestions.length > 0) {
            state.questions = shuffleArray([...state.wrongQuestions]);
            state.currentIndex = 0;
            state.correctCount = 0;
            state.wrongQuestions = [];
            showScreen('quiz-screen');
            displayQuestion();
        }
    });

    document.getElementById('retry-all').addEventListener('click', () => {
        state.currentIndex = 0;
        state.correctCount = 0;
        state.wrongQuestions = [];

        // 현재 모드에 따라 문제 재준비
        if (state.currentMode === 'infinite') {
            prepareQuestions(); // 무한 모드는 새로 가중치 계산
        } else {
            state.questions = shuffleArray([...state.questions]);
        }

        showScreen('quiz-screen');
        displayQuestion();
    });

    document.getElementById('go-main').addEventListener('click', () => {
        showScreen('main-screen');
        updateMainStats();

        // 선택 초기화
        document.querySelectorAll('.week-btn').forEach(b => b.classList.remove('selected'));
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        state.selectedWeeks = [];
        state.currentMode = null;
        updateStartSection();
    });

    // ============================
    // 키보드 단축키
    // ============================
    document.addEventListener('keydown', (e) => {
        const quizScreen = document.getElementById('quiz-screen');
        const explanationScreen = document.getElementById('explanation-screen');

        // 퀴즈 화면에서 답 선택
        if (quizScreen.classList.contains('active') && !state.isAnswered) {
            const question = state.currentMode === 'infinite' ? state.currentQuestion : state.questions[state.currentIndex];
            if (!question) return;

            if (question.type === 'fill') {
                // 빈칸 채우기: Space=모르겠음 (빈 제출)
                if (e.key === ' ' && document.activeElement.id !== 'fill-answer') {
                    e.preventDefault();
                    const fillInput = document.getElementById('fill-answer');
                    const isInfiniteMode = state.currentMode === 'infinite';
                    if (fillInput) {
                        fillInput.value = '';
                        submitFillAnswer(question, fillInput, isInfiniteMode);
                    }
                }
            } else if (question.type === 'ox') {
                // O/X 문제: A=O, S=X, Space=모르겠음
                if (e.key === 'a' || e.key === 'A') {
                    const oBtn = document.querySelector('.ox-btn.o');
                    if (oBtn) oBtn.click();
                } else if (e.key === 's' || e.key === 'S') {
                    const xBtn = document.querySelector('.ox-btn.x');
                    if (xBtn) xBtn.click();
                } else if (e.key === ' ') {
                    e.preventDefault();
                    const skipBtn = document.querySelector('.option-btn.skip');
                    if (skipBtn) skipBtn.click();
                }
            } else {
                // 객관식: A, S, D, F, Space=모르겠음
                const keyMap = { 'a': 0, 's': 1, 'd': 2, 'f': 3 };
                const lowerKey = e.key.toLowerCase();
                if (keyMap.hasOwnProperty(lowerKey)) {
                    const optionBtns = document.querySelectorAll('.option-btn:not(.skip)');
                    if (optionBtns[keyMap[lowerKey]]) {
                        optionBtns[keyMap[lowerKey]].click();
                    }
                } else if (e.key === ' ') {
                    e.preventDefault();
                    const skipBtn = document.querySelector('.option-btn.skip');
                    if (skipBtn) skipBtn.click();
                }
            }
        }

        // 해설 화면에서 다음 문제 (Enter 또는 Space)
        if (explanationScreen.classList.contains('active')) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('next-question').click();
            }
        }
    });
});
