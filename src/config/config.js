import path from "path";
import dotenv from "dotenv";

dotenv.config();

export default {
  firebaseServiceAccount: path.resolve("src/config/firebaseServiceAccount.json"), // Load Firebase JSON
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
};
