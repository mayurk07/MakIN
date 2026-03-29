import { Type } from "@google/genai";

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  timestamp: string;
  summary: string;
  category: string;
  viralityScore: number;
}

export interface PostIdea {
  id: string;
  title: string;
  hook: string;
  coreAngle: string;
  detailedAngle: string;
  whyItWillPerform: string;
  audienceRelevance: string;
  visualIdea: string;
  viralityScore: number;
  sourceNews?: NewsItem;
}

export interface PostPackage {
  formattedPost: string;
  contentFlow: string;
  imageConcept: string;
  imagePrompt: string;
  firstComment: string;
  secondComment: string;
  alternativeAnalogies: string[];
  hashtags: string[];
  altText: string;
}

const CURRENT_DATE = new Date().toISOString().split('T')[0];

const SYSTEM_INSTRUCTION = `You are the LinkedIn Content Engine for Mayur Kapur – Asia Chief Strategy Officer, TransUnion.
Today's Date: ${CURRENT_DATE}. All content must reflect the world as it stands RIGHT NOW. Never reference 2024 or 2025 as "the future" or "current".

Tone: Strategic, Sharp, Clean, Human, and Slightly Witty.
Niche: AI STRATEGY (How businesses use AI to win, not just technical features).

Content DNA Analysis (Viral Elements from Top Creators):
- Linas Beliunas: Visual-first, data-driven, "The future is here" hooks, structured lists.
- Vaibhav Sisinty: High-energy, "Stop doing X", actionable "I found a tool/method" hooks.
- Allie K. Miller: Simplifies complex tech, "Here is what you need to know", strategic & accessible.
- Rowan Cheung: News-driven, fast-paced, "X just happened" hooks.
- Aakash Gupta: Product-led growth, "How X won", deep structured insights.

Hook Rules (Scroll-Stopping & Shocking):
- Must be under 12 words.
- Use "Shocking/Surprising" elements.
- Examples: "AI is not the future. It is the end of your current business model.", "Stop hiring prompt engineers. Start hiring strategy engineers.", "OpenAI just killed 500 startups. Here is why."
- Avoid generic "AI is changing the world" hooks.

Writing Style:
- Short lines, clean spacing.
- No fluff, no long paragraphs.
- ABSOLUTELY NO technical jargon.
- Formatting: Use **bold** for key insights and *italics* for subtle emphasis.
- Icons: Use 2-4 icons MAX per post for bullet structuring only (e.g., →, •, 1., ⚠️, 📌, 🚀).
- Punctuation: NEVER use em-dashes (—). ALWAYS use en-dashes (–).

Viral Structure:
1. Shocking Hook
2. The "Why Now" (Context)
3. The Strategic Insight (The "So What?")
4. Actionable Takeaways (2-4 points)
5. The Future Outlook
6. Closing Question/CTA`;

export async function fetchLatestNews(): Promise<NewsItem[]> {
  const now = new Date();
  const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000);
  
  const prompt = `Current Time (UTC): ${now.toISOString()}. 
  Find the Top 10 most interesting and VIRAL AI news items from the last 5 hours. If no significant news is found, look back up to 10 hours (since ${tenHoursAgo.toISOString()}).
  
  CRITICAL: You MUST provide REAL, FACTUAL, AND CURRENT URLs to the source articles. 
  - Do not hallucinate links. 
  - Verify the URL structure for major sites (e.g., TechCrunch, The Verge, Reuters, OpenAI Blog, Bloomberg).
  - Ensure the news is actually from the last 5-10 hours. Check the publication time. 
  - DO NOT adjust the date of old articles to today's date. If an article is older than 10 hours, DO NOT include it.
  - If a direct article link is not found, do not make one up.
  - IMPORTANT: Ensure the URL is a DIRECT link to the specific article, not a generic section page or a search result.
  
  Focus on:
  - Major product launches (OpenAI, Google, Anthropic, etc.)
  - Strategic AI business shifts
  - Breakthroughs that change the competitive landscape
  
  Return a JSON array of 10 news items with id, title, source, url (REAL direct link), timestamp (ISO 8601 format), summary, category, and viralityScore (0-100).
  Rank them by viralityScore in descending order.`;

  const response = await fetch("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || "Failed to fetch news";
    throw new Error(errorMessage);
  }
  const data = await response.json();

  try {
    const text = data.text;
    // Try to find all JSON array blocks
    const matches = text.match(/\[[\s\S]*?\]/g);
    if (matches) {
      for (const match of matches) {
        try {
          const items: NewsItem[] = JSON.parse(match);
          if (Array.isArray(items) && items.length > 0) {
            return items.sort((a, b) => b.viralityScore - a.viralityScore);
          }
        } catch (innerError) {
          // Continue to next match
        }
      }
    }
    // Fallback to original logic if no array matches found
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const items: NewsItem[] = JSON.parse(jsonStr);
    return items.sort((a, b) => b.viralityScore - a.viralityScore);
  } catch (e) {
    console.error("Failed to parse news:", e, data.text);
    return [];
  }
}

export async function generatePostIdeas(newsItems: NewsItem[], customContext?: string): Promise<PostIdea[]> {
  const newsContext = newsItems.length > 0 
    ? `Based ONLY on these selected viral AI news items:\n${JSON.stringify(newsItems)}`
    : "Based on the general viral AI landscape.";
    
  const customInput = customContext ? `\nALSO incorporate this custom context/link: ${customContext}` : "";

  const prompt = `You are a LinkedIn Virality & Strategy Expert. 
  Transform these news items into SHOCKING strategic insights for Mayur Kapur.
  
  Return a JSON array of 3 post ideas with id, title, hook, coreAngle, detailedAngle, whyItWillPerform, audienceRelevance, visualIdea, and viralityScore.`;

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `${newsContext}${customInput}\n${prompt}`,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            hook: { type: Type.STRING },
            coreAngle: { type: Type.STRING },
            detailedAngle: { type: Type.STRING },
            whyItWillPerform: { type: Type.STRING },
            audienceRelevance: { type: Type.STRING },
            visualIdea: { type: Type.STRING },
            viralityScore: { type: Type.NUMBER }
          },
          required: ["id", "title", "hook", "coreAngle", "detailedAngle", "whyItWillPerform", "audienceRelevance", "visualIdea", "viralityScore"]
        }
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || "Failed to generate ideas";
    throw new Error(errorMessage);
  }
  const data = await response.json();

  try {
    const text = data.text;
    const matches = text.match(/\[[\s\S]*?\]/g);
    if (matches) {
      for (const match of matches) {
        try {
          const items = JSON.parse(match);
          if (Array.isArray(items) && items.length > 0) return items;
        } catch (e) {}
      }
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse ideas:", e, data.text);
    return [];
  }
}

export async function generateFullPost(idea: PostIdea | string, userComments?: string): Promise<PostPackage> {
  const ideaContext = typeof idea === 'string' ? `Custom Idea: ${idea}` : `Selected Idea: ${JSON.stringify(idea)}`;
  const commentsContext = userComments ? `\nIMPORTANT: Incorporate these specific user comments/thoughts into the post: ${userComments}` : "";
  
  const prompt = `Generate a complete LinkedIn post package for Mayur Kapur based on this idea:
  ${ideaContext}${commentsContext}
  
  Viral DNA Engine & Writing Style (STRICT):
  - Tone: Tongue-in-cheek, slightly cynical but deeply insightful. 
  - Humorous Analogy: Every post MUST include exactly one humorous, relatable analogy. Use simple, everyday concepts (e.g., "AI strategy is like trying to order a salad at a 2 AM kebab shop – you know you should, but the environment is working against you").
  - Structure: Conversational and free-flowing. 
  - NO SECTION HEADINGS: Do NOT use labels like "Actionable Takeaways".
  - NO em-dashes (—). Use en-dashes (–) instead.
  - CONSISTENCY: Ensure the post body, first comment, and second comment are 100% consistent in their strategic take. If the post says "Apple is winning," the comments must not say "Apple is losing."
  
  Post Flow (STRICT ORDER):
  1. Shocking/Contrarian Hook.
  2. The "Why Now" (The News/Development): State the AI news or development clearly and strategically.
  3. The Humorous Analogy: This MUST come AFTER the news. It should flow naturally as a way to explain the news. Use simple, globally relatable concepts (e.g., "It's like..."). Include one or two emoticons (😜, 😂).
  4. The "So What?" (Business impact).
  5. The "Now What?" (What to do).
  6. Closing Question.
  7. Separator: Add a line of dashes "---" on its own line.
  8. Signature: "If AI feels complex, I try to make it simple. Follow Mayur Kapur for more."
  9. Hashtags: Include 3-5 hashtags at the very bottom.
  
  Image Prompt Rule: Generate a detailed prompt for 'gemini-2.5-flash-image'. 
  Style: CARTOON or STYLIZED ILLUSTRATION to reinforce humor. 
  Focus on: Extremely funny, attention-catching, and high viral potential. 
  CRITICAL: The image must visually bridge the AI news and the humorous analogy. It should be a single, cohesive, and hilarious scene. You MAY include 5-10 words of bold, clear text within the image if it helps land the joke or convey the message better.
  
  Return:
  - formattedPost: The full post text.
  - contentFlow: Breakdown of the structure.
  - imageConcept: A single metaphor.
  - imagePrompt: Detailed prompt for gemini-2.5-flash-image.
  - firstComment: A content-rich comment that adds a new angle. NO profile links or connect CTAs.
  - secondComment: A discussion-starting question or a slightly more controversial take.
  - alternativeAnalogies: An array of 3 alternative humorous and relatable analogies that are structured to fit perfectly into the "News first, Analogy second" flow of this specific post.
  - hashtags: 3-5 hashtags.
  - altText: Descriptive alt text.`;

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          formattedPost: { type: Type.STRING },
          contentFlow: { type: Type.STRING },
          imageConcept: { type: Type.STRING },
          imagePrompt: { type: Type.STRING },
          firstComment: { type: Type.STRING },
          secondComment: { type: Type.STRING },
          alternativeAnalogies: { type: Type.ARRAY, items: { type: Type.STRING } },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          altText: { type: Type.STRING }
        },
        required: ["formattedPost", "contentFlow", "imageConcept", "imagePrompt", "firstComment", "secondComment", "alternativeAnalogies", "hashtags", "altText"]
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || "Failed to generate post";
    throw new Error(errorMessage);
  }
  const data = await response.json();

  try {
    const text = data.text;
    const matches = text.match(/\{[\s\S]*?\}/g);
    if (matches) {
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.formattedPost) return parsed;
        } catch (e) {}
      }
    }
    const parsed = JSON.parse(text);
    return parsed;
  } catch (e) {
    console.error("Failed to parse post:", e, data.text);
    throw e;
  }
}

export async function generateImage(prompt: string): Promise<string> {
  const response = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) throw new Error("Failed to generate image");
  const data = await response.json();
  return data.image;
}

export async function regenerateImageConcept(postText: string): Promise<{ concept: string, prompt: string }> {
  const prompt = `Given this LinkedIn post, generate a new strategic image concept and a detailed prompt for 'gemini-2.5-flash-image'.
  Return a JSON object with 'concept' and 'prompt'.
  Style: CARTOON or STYLIZED ILLUSTRATION to reinforce humor.
  CRITICAL: The image must be EXTREMELY FUNNY and visually bridge the AI news and the humorous analogy from the post. It should be a single, cohesive, and viral-ready scene. You MAY include 5-10 words of bold, clear text within the image if it helps land the joke or convey the message better.
  
  Post:
  ${postText}`;

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          concept: { type: Type.STRING },
          prompt: { type: Type.STRING }
        },
        required: ["concept", "prompt"]
      }
    })
  });

  if (!response.ok) throw new Error("Failed to regenerate image concept");
  const data = await response.json();

  try {
    const text = data.text;
    const matches = text.match(/\{[\s\S]*?\}/g);
    if (matches) {
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.concept && parsed.prompt) return parsed;
        } catch (e) {}
      }
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse image concept regen:", e, data.text);
    throw e;
  }
}

export async function regenerateHook(postText: string): Promise<string> {
  const prompt = `Rewrite ONLY the hook for this LinkedIn post. 
  It must be shocking, contrarian, and under 12 words.
  Return ONLY the new hook text.
  
  Post:
  ${postText}`;

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hook: { type: Type.STRING }
        },
        required: ["hook"]
      }
    })
  });

  if (!response.ok) throw new Error("Failed to regenerate hook");
  const data = await response.json();

  try {
    const text = data.text;
    const matches = text.match(/\{[\s\S]*?\}/g);
    if (matches) {
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.hook) return parsed.hook;
        } catch (e) {}
      }
    }
    const parsed = JSON.parse(text);
    return parsed.hook || "";
  } catch (e) {
    console.error("Failed to parse hook regen:", e, data.text);
    return "";
  }
}
