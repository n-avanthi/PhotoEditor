// 🚀 Nano Banana Backend – Analysis Only (GPT-4o Mini Vision)

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Health Check
app.get("/", (req, res) => {
  res.json({
    status: "Running ✔️",
    mode: "AI Photo Analysis",
    model: "gpt-4o-mini",
    timestamp: new Date(),
  });
});

// ---- MAIN AI ENDPOINT ----
app.post("/edit", upload.single("image"), async (req, res) => {
  try {
    const { query, base64Image } = req.body;

    if (!query?.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing",
        fix: "Add it inside your .env file",
      });
    }

    console.log("📸 Processing request using GPT-4o Mini Vision...");

    // ---- BUILD MESSAGE ----
    const messages = [
      {
        role: "system",
        content:
          "You are a professional photo editing expert, aesthetic evaluator, and photography advisor.",
      },
    ];

    if (base64Image) {
      messages.push({
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
          {
            type: "text",
            text: `
Analyze this photo.

User request: "${query}"

Return in this structure:

📌 Summary (1–2 lines)
📌 Aesthetic Score (0–100)
📌 Editing Style (cinematic, pastel, warm tones, moody, HDR, retro, clean)
📌 Suggested Filters (VSCO or Lightroom style names)
📌 Editing adjustments:
   - Exposure
   - Contrast
   - Temperature
   - Highlights
   - Shadows
   - Sharpness
   - Vibrance/Saturation
📌 Composition & Cropping Tips
📌 Mood keywords (5–8)
📌 3 Caption ideas
📌 10 Hashtags
`,
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `User request: "${query}" (No image provided). Return general guidance.`,
      });
    }

    // ---- CALL OPENAI ----
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 900,
      temperature: 0.9,
    });

    const analysis = completion.choices[0].message.content;

    return res.json({
      success: true,
      analysis,
      editedImages: [],
      generatedImages: [],
      message: "AI analysis complete!",
    });

  } catch (error) {
    console.error("❌ SERVER ERROR:", error);

    return res.status(500).json({
      error: "Failed to process request",
      details: error?.response?.data || error.message,
    });
  }
});

// ---- START SERVER ----
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🍌 Nano Banana running on port ${PORT}`);
  console.log(`📡 Access: http://YOUR_LOCAL_IP:${PORT}`);
});
