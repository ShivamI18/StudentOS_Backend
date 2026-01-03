require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
const fetch = require("node-fetch");
const https = require("https");
let usageStats = null;
app.use(cors());
app.use(express.json());

const agent = new https.Agent({ family: 4 });

async function generateFocusAdvice(prompt) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = "models/gemini-2.5-flash";

  if (!API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      agent,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Gemini API error");
  }

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response generated."
  );
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
Internally follow this sequence of reasoning, but execute everything in one run and return only the final JSON output.
Step 1: Parse and normalize time
Convert study time from hr:min:sec into total minutes. Convert app foreground time from milliseconds into total minutes. For display purposes: If time is less than 60 minutes, show as X minutes only. If time is 60 minutes or more, show as X hours Y minutes (omit minutes if 0). Examples: 25 minutes, 45 minutes, 1 hour 15 minutes, 2 hours.
Step 2: Analyze focus and productivity
Classify app usage into productive and non-productive categories. Treat social media and messaging apps such as WhatsApp, Instagram, Facebook, Twitter/X, Snapchat, TikTok, Messenger, and similar platforms as non-productive. Do not name productive apps. Compare total non-productive time with study time.
Step 3: Generate analysis text
Write one encouraging paragraph summarizing study behavior and focus. When mentioning time, use the display format from Step 1: show only minutes if less than 60 minutes, otherwise show hours and minutes. If non-productive time is high relative to study time, gently acknowledge distraction without judgment. End the paragraph with exactly one sentence: It was a productive day or It was not a very productive day.
Step 4: Generate notes
Write a single concise paragraph of beginner-friendly study notes for the given subject and topics, focused strictly on core concepts. Include definitions, key ideas, steps, or simple examples.
Within this same paragraph, embed exactly 5 short revision questions. These questions must be definition-based or one-sentence answer questions only. Each question must be immediately followed by its one-sentence correct answer. Do not include multiple-choice questions in the notes.
Step 5: Generate questions
Create exactly 5 multiple-choice questions based strictly on the notes content and the revision questions included in the notes. These must be new questions.
Each question must include the full MCQ inside the q value, with exactly four realistic and topic-relevant options included in the same string.
The a value must contain only the correct option text exactly as it appears in the q value.
Do not include explanations.
Final output format
After completing all steps internally, return only one JSON object in this exact structure and order:
{
"analysis": "Analysis goes here",
"notes": "Notes go here",
"questions": [
{
"q": "MCQ question with four options included inside this string",
"a": "correct option text"
}
]
}
Global rules
Return only the JSON object and nothing else.
Do not include any introduction or explanation outside the JSON.
Do not use markdown, bullet points, numbering, emojis, symbols, or special formatting.
Do not repeat input data.
Do not ask the user any questions.
Always return analysis, notes, and questions in that exact order.
All string values must remain single-line.
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
