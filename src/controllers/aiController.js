import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const getSortPriority =  async (req, res) => {

  const { input } = req.body;

  const system_prompt = "Rank the JSON meetings based on priority. No extra output, only the meeting names in order of most to least important.";

  

  if (!input) {
    return res.status(400).json({ error: "Missing input" });
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: system_prompt,
        },
        {
          role: "user",
          content: input,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    res.json({ response: chatCompletion.choices[0]?.message?.content || "" });
  } catch (error) {
    console.error("Error fetching chat completion:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

