require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
let usageStats = null;
app.use(cors());
app.use(express.json());

async function generateFocusAdvice(prompt) {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma3:4b",
      prompt,
      stream: false,
    }),
  });

  const data = await response.json();
  return data.response;
}

app.get("/", (req, res) => {
  res.json({ message: "Welcome to StudentOS Backend" });
});
app.post("/api/usage", (req, res) => {
  try {
    usageStats = req.body;
    if (!Array.isArray(usageStats)) {
      return res.status(400).json({ error: "Expected array" });
    }

    console.log("Received apps:", usageStats);
    res.json({
      message: "Usage data received",
      count: usageStats.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Ensure the route handler is marked as 'async'
app.post("/api/focusmode", async (req, res) => {
  try {
    const userData = req.body;

    // Check if userData exists and is not empty
    if (!userData || (Array.isArray(userData) && userData.length === 0)) {
      return res.status(400).json({ error: "No user data provided" });
    }

    console.log("Received user data:", userData);

    const prom = `
      You are an AI study assistant.
CRITICAL OUTPUT RULES (HIGHEST PRIORITY)
The response must be raw JSON text only.
Do NOT wrap the response in backticks or code blocks.
Do NOT include json, or any formatting markers.
Do NOT include newline characters (\n) inside string values.
All text values must be single-line strings.
If backticks, code fences, or newline characters appear, the response is invalid.
You will receive two inputs:
A JSON object named studySession containing subject, topics studied, self-rated understanding (1–5), and study time in hr:min:sec format.
An array of JSON objects named appUsage containing package name, total foreground time in milliseconds, and last used time.
Your task is to analyze both inputs together and return only a valid JSON object in the exact structure below and in the same order:
{
"analysis": "Analysis goes here",
"notes": "Notes go here",
"questions": [
{
"q": "MCQ question with all four options included inside this string",
"a": "correct option text"
}
]
}
Rules for generating content:
Analysis
Write a single encouraging paragraph analyzing the student’s study behavior and focus. Convert study time from hr:min:sec into hours and minutes for reasoning. Convert app usage time from milliseconds into hours and minutes for reasoning. Classify apps into productive and non-productive categories. Treat social media and messaging apps such as WhatsApp, Instagram, Facebook, Twitter/X, Snapchat, TikTok, Messenger, and similar platforms as non-productive. Do not explicitly list productive apps. Focus only on the impact of non-productive app usage and compare that time with the study time. If non-productive app usage is high compared to study time, gently mention distraction in a supportive and non-judgmental way. Always display time using hours and minutes only. End the paragraph with exactly one of the following conclusions: It was a productive day or It was not a very productive day.
Notes
Write a single concise paragraph of beginner-friendly study notes for the given subject and topics, focused only on core concepts. Always include definitions, key ideas, steps, or examples relevant to the topic.
Additionally, include exactly 5 short revision questions inside the notes paragraph. These questions must be definition-based or one-sentence answer questions only. Do not include multiple-choice questions in the notes section. Each embedded question must be immediately followed by its one-sentence correct answer.
Questions
Generate exactly 5 new multiple-choice questions based strictly on the notes content and the one-sentence revision questions included in the notes.
Only MCQs are allowed in this section.
Each MCQ must include the full question and all four topic-relevant options inside the q string.
The a field must contain only the correct option text exactly as written in the q string.
Do not include explanations.
Global rules
Return only the JSON object and nothing else.
Do not include any introduction, explanation, or summary outside the JSON.
Do not use markdown, bullet points, numbering, emojis, symbols, or special formatting.
Do not repeat input data.
Do not ask the user any questions.
Always return analysis, notes, and questions in that exact order.
Always express time in hours and minutes only.
All string values must remain on a single line with no newline characters.
Input data will be provided after this prompt.
Input data:
UserStudyData:
${JSON.stringify(userData)},
AppUsageData:
${JSON.stringify(usageStats)},
    `;

    // You MUST 'await' the result from the Gemini component
    const advice = await generateFocusAdvice(prom);
    console.log(advice);

    res.json({
      message: "Success",
      advice: advice, // This will now contain the actual string from Gemini
    });
  } catch (error) {
    console.error("Route Error:", error);
    res.status(500).json({ err: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
