// Google Apps Script backend
const QUESTIONS_SHEET_NAME = "Questions";
const RESPONSES_SHEET_NAME = "Responses";
const PDF_FOLDER_NAME = "Quiz_PDFs";
const DEFAULT_TIME_LIMIT_SEC = 30;

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(QUESTIONS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const questions = [];
  for (let i = 1; i < data.length; i++) {
    const qid = String(data[i][0]).trim();
    const text = String(data[i][1]).trim();
    const timeLimit = data[i][3] ? Number(data[i][3]) : DEFAULT_TIME_LIMIT_SEC;
    if (text) questions.push({ id: qid, text: text, timeLimit: timeLimit });
  }
  return ContentService.createTextOutput(JSON.stringify(questions)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const name = payload.name;
  const roll = payload.roll;
  const answers = payload.answers;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const qSheet = ss.getSheetByName(QUESTIONS_SHEET_NAME);
  const rSheet = ss.getSheetByName(RESPONSES_SHEET_NAME);

  const qData = qSheet.getDataRange().getValues();
  let score = 0;
  const results = [];
  for (let i = 1; i < qData.length; i++) {
    const qid = String(qData[i][0]).trim();
    const question = qData[i][1];
    const correct = String(qData[i][2]).trim().toUpperCase();
    const userAns = (answers[qid] || "").trim().toUpperCase();
    const isCorrect = userAns === correct;
    if (isCorrect) score++;
    results.push({ question, correctAnswer: correct, userAnswer: userAns || "No Answer", isCorrect });
  }

  const row = [new Date(), name, roll];
  for (let i = 1; i < qData.length; i++) {
    const qid = String(qData[i][0]).trim();
    row.push(answers[qid] || "");
  }
  row.push(score);
  rSheet.appendRow(row);

  const pdfFile = generateResultPdf(name, roll, results, score, qData.length - 1);
  const lastRow = rSheet.getLastRow();
  rSheet.getRange(lastRow, row.length + 1).setValue(pdfFile.getUrl());

  return ContentService.createTextOutput(JSON.stringify({ score: score, total: qData.length - 1, pdfUrl: pdfFile.getUrl() })).setMimeType(ContentService.MimeType.JSON);
}

function generateResultPdf(name, roll, results, score, totalQuestions) {
  const doc = DocumentApp.create("QuizResult_" + name);
  const body = doc.getBody();
  body.appendParagraph("Quiz Result").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("Name: " + name);
  body.appendParagraph("Roll: " + roll);
  body.appendParagraph("Score: " + score + " / " + totalQuestions);
  body.appendParagraph("-------------------------");
  results.forEach((r, idx) => {
    body.appendParagraph((idx+1) + ". " + r.question).setBold(true);
    let ua = body.appendParagraph("Your Answer: " + r.userAnswer);
    ua.setForegroundColor(r.isCorrect ? "green" : "red");
    body.appendParagraph("Correct Answer: " + r.correctAnswer);
    body.appendParagraph(" ");
  });
  doc.saveAndClose();
  const pdf = DriveApp.getFileById(doc.getId()).getAs("application/pdf");
  const folder = DriveApp.getFoldersByName(PDF_FOLDER_NAME).hasNext() ? DriveApp.getFoldersByName(PDF_FOLDER_NAME).next() : DriveApp.createFolder(PDF_FOLDER_NAME);
  const pdfFile = folder.createFile(pdf).setName("Result_" + name + "_" + roll + ".pdf");
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return pdfFile;
}
