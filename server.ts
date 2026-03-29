import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAI = () => {
  const fallbackKey = "AIzaSyCXu9WzkjqU3ptpNF7mJqhuBNnGbgTgcyU";
  let apiKey = process.env.GEMINI_API_KEY || 
               process.env.API_KEY || 
               process.env.GOOGLE_API_KEY || 
               process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  // Clean the key (remove quotes, whitespace)
  if (apiKey) {
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
  }

  // Check if the key is a placeholder or invalid
  const isPlaceholder = !apiKey || 
                        apiKey === "undefined" || 
                        apiKey === "null" ||
                        apiKey === "" || 
                        apiKey === "MY_GEMINI_API_KEY" ||
                        apiKey.includes("[object");
  
  const isInvalidFormat = apiKey && !apiKey.startsWith("AIzaSy");

  if (isPlaceholder || isInvalidFormat) {
    console.log(`Using fallback API key (Source: ${isPlaceholder ? 'Placeholder/Missing' : 'Invalid Format'})`);
    apiKey = fallbackKey;
  }
  
  // Final validation
  if (!apiKey || apiKey.length < 10 || apiKey === "MY_GEMINI_API_KEY") {
    console.error("CRITICAL AUTH ERROR: No valid Gemini API key found even after fallback.");
    throw new Error("API_KEY_MISSING: Your Gemini API key is not properly configured. Please set 'GEMINI_API_KEY' in the Secrets panel.");
  }

  // Log masked key for debugging
  const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;
  console.log(`Gemini SDK initialized with key: ${maskedKey}`);
  
  return new GoogleGenAI({ apiKey });
};

export const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// API Routes
app.get("/api/test-key", async (req, res) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Say 'API Key is working!'",
    });
    res.json({ success: true, message: response.text });
  } catch (error: any) {
    console.error("Test Key Error:", error);
    res.status(400).json({ 
      success: false, 
      error: error.message,
      details: error.stack
    });
  }
});

app.post("/api/news", async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getAI();
    
    try {
      // Try with googleSearch first
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are a factual news researcher. Your primary goal is to find REAL, CURRENT news articles and provide their EXACT, WORKING URLs. Never hallucinate or guess a URL structure. If you are unsure of a URL, do not include the item. Return the results as a raw JSON array of objects.",
          tools: [{ googleSearch: {} }],
        }
      });
      return res.json({ text: response.text });
    } catch (searchError: any) {
      console.warn("Search tool failed, falling back to standard generation:", searchError.message);
      
      // Fallback: Standard generation (might be less current but won't crash)
      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${prompt}\n\nNOTE: If you cannot search, use your internal knowledge up to your knowledge cutoff, but prioritize accuracy.`,
        config: {
          systemInstruction: "You are a factual news researcher. Provide the most recent AI news you know about. Return as a JSON array.",
        }
      });
      return res.json({ text: fallbackResponse.text });
    }
  } catch (error) {
    console.error("News API Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, systemInstruction, responseSchema } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error("Generate API Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });
    
    let imageData = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        break;
      }
    }
    
    if (imageData) {
      res.json({ image: `data:image/png;base64,${imageData}` });
    } else {
      res.status(404).json({ error: "No image generated" });
    }
  } catch (error) {
    console.error("Image API Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.VERCEL !== "1") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
