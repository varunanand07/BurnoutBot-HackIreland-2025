# 🚀 BurnoutBot

## An AI-Powered Slack Bot: Optimize Your Workday, Protect Your Well-being

### 📌 Inspiration
In today's remote work environment, managing calendars efficiently has become increasingly challenging. Many professionals struggle with back-to-back meetings, lack of breaks, and poor work-life balance. **BurnoutBot** was created to solve this problem by optimizing schedules and protecting mental well-being.

---

## ✨ Features
### 🔥 **Core Functionalities**
✅ **Burnout Detection** – Identifies meeting overload and flags potential burnout risk.  
✅ **Automated Break Scheduling** – Inserts recovery breaks into Google Calendar to optimize work-life balance.  
✅ **Smart Meeting Optimization** – Suggests shorter meetings, merges redundant ones, and auto-allocates focus time.  
✅ **Workload Analysis** – Analyzes calendar health, providing burnout risk assessments and efficiency scores.  
✅ **Team Collaboration Enhancements** – Finds the best meeting slots for teams while preventing overload.  
✅ **Slack-Based Commands** – Users interact seamlessly with BurnoutBot directly in Slack.  

---

## ⚙️ Tech Stack
- **Backend**: Node.js
- **Bot Framework**: Slack Bolt API
- **Calendar Management**: Google Calendar API
- **Storage**: Firebase (for token persistence)
- **AI Intelligence**: OpenAI's GPT-4 (for scheduling suggestions)
- **Time Management**: Moment.js

---

## 💻 Available Commands

| Command | Description |
|---------|-------------|
| `/calendar` | View your calendar events (supports 'week' and 'month' views). |
| `/reschedule` | Get assistance in rescheduling your meetings. |
| `/workload` | Analyze your meeting workload with burnout risk assessment. |
| `/calendar-health` | Get a detailed health report of your calendar. |
| `/optimize-meetings` | Get AI-driven recommendations for meeting efficiency. |
| `/team-workload` | View team-wide meeting load analysis. |
| `/team-availability` | Find optimal meeting times for the whole team. |

---

## 🚀 Getting Started

### 🔧 **Prerequisites**
- Node.js (v16+)
- Firebase account (for token storage)
- Slack workspace with admin permissions
- Google Calendar API credentials

### 🛠 **Setup Instructions**

1️⃣ **Clone the repository**
```bash
 git clone https://github.com/your-username/BurnoutBot.git
 cd BurnoutBot
```

2️⃣ **Install dependencies**
```bash
 npm install
```

3️⃣ **Set up environment variables** (Create a `.env` file)
```env
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_SIGNING_SECRET=your_slack_signing_secret
GOOGLE_CALENDAR_API_KEY=your_google_calendar_api_key
FIREBASE_CREDENTIALS=your_firebase_config_json
```

4️⃣ **Run the bot**
```bash
 npm start
```

---

## 📈 Future Enhancements
✅ **Machine Learning Integration** – Predict optimal meeting times based on past patterns.  
✅ **Cross-Time Zone Support** – Automatically adjust meetings considering participants' locations.  
✅ **Advanced Analytics Dashboard** – Provide deep insights into productivity and burnout risk.  
✅ **Integration with Outlook, iCloud Calendar** – Expand support beyond Google Calendar.  
✅ **Mobile Companion App** – Manage calendar insights on the go.

---

## 🏆 Accomplishments & Challenges
✅ Built an intelligent burnout detection system.  
✅ Optimized complex scheduling algorithms for balancing workload.  
✅ Seamless Slack & Google Calendar integration.  
✅ Solved token persistence issues using Firebase.  
✅ Developed a real-time workload analysis tool.  

---

## 🤝 Contributing
We welcome contributions! If you'd like to improve BurnoutBot:
1. Fork the repository 🍴
2. Create a new branch: `git checkout -b feature-branch`
3. Make your changes and commit: `git commit -m "Added new feature"`
4. Push to the branch: `git push origin feature-branch`
5. Open a Pull Request 🚀

---

## 📝 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📧 Contact
For questions, suggestions, or collaborations, reach out via:
- **Email:** vanand@tcd.ie
- **GitHub Issues:** [Open an issue](https://github.com/varunanand07/BurnoutBot/issues)

---

⭐ If you find BurnoutBot useful, don't forget to **star** this repo! ⭐
