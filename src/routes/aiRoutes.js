import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.get("/chat-completion", async (req, res) => {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: "Explain the importance of fast language models",
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    res.json({ response: chatCompletion.choices[0]?.message?.content || "" });
  } catch (error) {
    console.error("Error fetching chat completion:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

