import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/", upload.single("photo"), async (req, res) => {
  try {
    const imageBase64 = fs.readFileSync(req.file.path, { encoding: "base64" });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert in analyzing monuments and historical places from photos.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Identify this monument and give a short history.",
            },
            {
              type: "input_image",
              image_base64: imageBase64,
            },
          ],
        },
      ],
    });

    res.json({ response: response.choices[0].message.content });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Photo analysis failed" });
  }
});

export default router;
