const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwzFs-S4hU3_GJ5vA4VnZ38uj0uWN2fSn37KAsA_mzJo4MJ0pNNHmEABJnCytXmr36Ksw/exec";


let questions = [];
let currentIndex = 0;
let userAnswers = {};
let timer = null;
let timeLeft = 0;
let isSubmitting = false;

async function loadQuestions() {
  try {
    const r = await fetch(WEBAPP_URL);
    const json = await r.json();
    if (json.error) {
      document.getElementById("quiz").innerHTML = `<p>Error loading questions: ${json.error}</p>`;
      return;
    }
    questions = json;
  } catch (err) {
    console.error("Failed to load questions:", err);
    document.getElementById("quiz").innerHTML = "<p>Failed to load questions. Check console.</p>";
  }
}

function startQuiz() {
  const name = document.getElementById("name").value.trim();
  const roll = document.getElementById("roll").value.trim();
  if (!name || !roll) {
    alert("Enter Name and Roll No");
    return;
  }
  document.getElementById("studentInfo").style.display = "none";
  document.getElementById("quizArea").style.display = "block";
  currentIndex = 0;
  userAnswers = {};
  showQuestion();
}

function showQuestion() {
  if (currentIndex >= questions.length) {
    // make sure last answer saved then submit
    saveCurrentAnswer();
    submitQuiz();
    return;
  }
  const q = questions[currentIndex];
  document.getElementById("quiz").innerHTML = `
    <div class="question-card">
      <p class="question-text">${q.text}</p>
      <input type="text" id="answerInput" class="answer-input" placeholder="Your Answer" value="${userAnswers[q.id] ? escapeHtml(userAnswers[q.id]) : ""}">
    </div>
  `;
  const t = (typeof q.timeLimit === "number" && !isNaN(q.timeLimit)) ? q.timeLimit : 30;
  startTimer(t);
  updateNextButtonLabel();
}

function startTimer(seconds) {
  clearInterval(timer);
  timeLeft = Number(seconds) || 30;
  document.getElementById("timer").innerText = `Time left: ${timeLeft}s`;
  timer = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").innerText = `Time left: ${timeLeft}s`;
    if (timeLeft <= 0) {
      saveAnswerAndNext();
    }
  }, 1000);
}

function saveCurrentAnswer() {
  const q = questions[currentIndex];
  const elem = document.getElementById("answerInput");
  if (!q || !elem) return;
  userAnswers[q.id] = elem.value.trim();
}

function saveAnswerAndNext() {
  // save current
  saveCurrentAnswer();
  // advance
  currentIndex++;
  showQuestion();
}

function updateNextButtonLabel() {
  const btn = document.getElementById("nextBtn");
  btn.innerText = (currentIndex === questions.length - 1) ? "Finish" : "Next";
}

async function submitQuiz() {
  if (isSubmitting) return;
  isSubmitting = true;
  clearInterval(timer);
  // ensure current question saved
  if (currentIndex < questions.length) {
    saveCurrentAnswer();
  }
  const name = document.getElementById("name").value.trim();
  const roll = document.getElementById("roll").value.trim();
  // disable UI
  document.getElementById("nextBtn").disabled = true;

  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      body: JSON.stringify({ name, roll, answers: userAnswers }),
      headers: { "Content-Type": "application/json" }
    });
    const txt = await res.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch (e) {
      throw new Error("Invalid JSON from server: " + txt);
    }
    if (json.error) throw new Error(json.error);

    document.getElementById("quizArea").style.display = "none";
    document.getElementById("result").innerHTML = `
      <h2>Your Score: ${json.score} / ${json.total}</h2>
      <a href="${json.pdfUrl}" target="_blank" class="btn">Download Result PDF</a>
    `;
  } catch (err) {
    console.error("Submission error:", err);
    // show helpful message to user and developer info
    document.getElementById("result").innerHTML = `<p>Submission failed: ${escapeHtml(String(err.message || err))}</p><p>Check Apps Script Executions log for details.</p>`;
    // re-enable Next button so teacher can retry
    document.getElementById("nextBtn").disabled = false;
  } finally {
    isSubmitting = false;
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

document.getElementById("startBtn").addEventListener("click", startQuiz);
document.getElementById("nextBtn").addEventListener("click", saveAnswerAndNext);
window.onload = loadQuestions;
