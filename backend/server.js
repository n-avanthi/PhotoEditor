// Nano Banana Backend Server using OpenAI gpt-image-1
// Run: node server.js

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { existsSync, mkdirSync } = fs;
const { writeFile } = require("fs/promises");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

// OpenAI client (CommonJS)
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// helper from the OpenAI SDK to send files
const { toFile } = OpenAI;

// Toggle between image generation and analysis-only mode (for future)
const USE_IMAGE_GENERATION = true;

app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));
app.use("/generated", express.static("generated"));

// 🔍 GLOBAL REQUEST LOGGER
app.use((req, res, next) => {
  console.log(
    `\n🌐 [${new Date().toISOString()}] ${req.method} ${req.url} ` +
    `(content-type: ${req.headers["content-type"] || "n/a"})`
  );
  next();
});

// Create generated directory if it doesn't exist
if (!existsSync("./generated")) {
  mkdirSync("./generated");
}

// Helper: save binary buffer to file
async function saveBinaryFile(filePath, contentBuffer) {
  await writeFile(filePath, contentBuffer);
  console.log(`💾 File saved: ${filePath}`);
}

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "Nano Banana API Server Running (OpenAI)",
    timestamp: new Date(),
    imageGeneration: USE_IMAGE_GENERATION ? "enabled" : "disabled (analysis only)",
    model: "gpt-image-1",
  });
});

// Image editing / generation endpoint
app.post("/edit", upload.single("image"), async (req, res) => {
  console.log("\n----------------------------------------");
  console.log("📥 NEW /edit REQUEST");

  try {
    console.log("🔧 Raw body type:", typeof req.body);
    console.log("🔧 Raw body keys:", Object.keys(req.body || {}));

    const { query, base64Image } = req.body || {};

    if (!query) {
      console.log("❌ Missing 'query' in body");
      return res.status(400).json({ error: "Query required" });
    }

    console.log("👉 Prompt:", query);
    console.log("🖼 base64Image present:", !!base64Image);
    if (base64Image) {
      console.log("🧮 base64 length:", base64Image.length);
    }

    if (!OPENAI_API_KEY) {
      console.log("❌ OPENAI_API_KEY missing");
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }

    const hasImage = !!base64Image;

    if (USE_IMAGE_GENERATION && hasImage) {
      // ---------- IMAGE EDIT MODE (OpenAI gpt-image-1) ----------
      console.log("🛠 Mode: IMAGE EDIT");

      let imageBuffer;
      try {
        imageBuffer = Buffer.from(base64Image, "base64");
        console.log("📦 Image buffer size:", imageBuffer.length, "bytes");
      } catch (err) {
        console.log("❌ Error converting base64 to buffer:", err);
        return res.status(400).json({ error: "Invalid base64 image" });
      }

      // Turn buffer into a "file" that the SDK accepts
      const imageFile = await toFile(imageBuffer, "input.jpg", {
        type: "image/jpeg",
      });

      console.log("⚙ Calling OpenAI images.edit...");
      let result;
      try {
        result = await openai.images.edit({
          model: "gpt-image-1",
          image: imageFile,
          prompt: query,
          size: "1024x1024",
        });
      } catch (err) {
        console.log("❌ OpenAI images.edit ERROR:", err?.response?.data || err.message || err);
        return res.status(500).json({
          error: "OpenAI image edit failed",
          details: err.message || String(err),
        });
      }

      console.log("🎯 OpenAI Response Received");

      const editedFiles = [];
      let b64 = null;

      if (result.data && result.data.length > 0) {
        b64 = result.data[0].b64_json; // base64 string
      }

      if (!b64) {
        console.log("⚠ No b64_json returned from OpenAI.");
        return res.json({
          success: true,
          analysis: "Model returned no image output.",
          editedImages: [],
        });
      }

      const outBuffer = Buffer.from(b64, "base64");
      const outName = `edited_image_${Date.now()}.png`;
      const outPath = path.join("generated", outName);
      await saveBinaryFile(outPath, outBuffer);
      editedFiles.push(`http://192.168.0.146:${PORT}/generated/${outName}`);

      console.log("✅ /edit completed successfully.");
      return res.json({
        success: true,
        analysis: "Image edited using OpenAI gpt-image-1 with your instructions.",
        editedImages: editedFiles,
        message: "Image processed successfully",
      });
    }

    if (USE_IMAGE_GENERATION && !hasImage) {
      // ---------- PURE TEXT-TO-IMAGE GENERATION ----------
      console.log("🛠 Mode: TEXT → IMAGE");

      let result;
      try {
        result = await openai.images.generate({
          model: "gpt-image-1",
          prompt: query,
          n: 1,
          size: "1024x1024",
        });
      } catch (err) {
        console.log("❌ OpenAI images.generate ERROR:", err?.response?.data || err.message || err);
        return res.status(500).json({
          error: "OpenAI image generate failed",
          details: err.message || String(err),
        });
      }

      const generatedFiles = [];
      let b64 = null;

      if (result.data && result.data.length > 0) {
        b64 = result.data[0].b64_json;
      }

      if (!b64) {
        console.log("⚠ No b64_json returned from OpenAI (generate).");
        return res.json({
          success: true,
          analysis: "Model returned no image output.",
          generatedImages: [],
        });
      }

      const buffer = Buffer.from(b64, "base64");
      const outName = `generated_image_${Date.now()}.png`;
      const outPath = path.join("generated", outName);
      await saveBinaryFile(outPath, buffer);
      generatedFiles.push(`/generated/${outName}`);

      console.log("✅ /edit (generate) completed successfully.");
      return res.json({
        success: true,
        analysis: "Image generated using OpenAI gpt-image-1 based on your prompt.",
        generatedImages: generatedFiles,
        message: "Image generated successfully",
      });
    }

    // ---------- ANALYSIS-ONLY FALLBACK ----------
    console.log("ℹ USE_IMAGE_GENERATION is false → analysis-only fallback.");
    return res.json({
      success: true,
      analysis:
        "Analysis-only mode: describe how to adjust brightness, contrast, colors, and composition here.",
      editedImages: [],
      generatedImages: [],
      message: "Analysis-only mode (no images generated).",
    });
  } catch (error) {
    console.log("❌ SERVER ERROR in /edit:", error);

    const message =
      typeof error?.message === "string" ? error.message : String(error);

    if (message.includes("quota") || message.includes("rate limit")) {
      return res.status(429).json({
        error: "OpenAI API quota or rate limit exceeded",
        details: message,
      });
    }

    return res.status(500).json({
      error: "Failed to process image",
      details: message,
    });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🍌 Nano Banana API Server running on port ${PORT} (OpenAI)`);
  console.log(`Access from network: http://192.168.0.146:${PORT}`);
  console.log(
    `Mode: ${USE_IMAGE_GENERATION ? "Image Generation" : "Analysis Only"}`
  );
  console.log(`Model: gpt-image-1`);
  console.log(
    `\nTip: make sure NANO_BANANA_URL in your Expo app points to this server.`
  );
});
