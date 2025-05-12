// Horizon Japan Bot
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const userFlags = new Map();
const defaultReplyFlags = new Map();
const threadControlledByHuman = new Set();

const cooldownPeriod = 12 * 60 * 60 * 1000; // 12 hours

function hasHumanTimeoutExpired(sender_psid) {
  const lastHuman = userFlags.get(sender_psid);
  if (!lastHuman) return true;
  return Date.now() - lastHuman > 60 * 60 * 1000;
}

function flagHumanInteraction(sender_psid) {
  userFlags.set(sender_psid, Date.now());
}

async function callSendAPI(sender_psid, response, retryCount = 0) {
  const request_body = {
    recipient: { id: sender_psid },
    message: response,
  };

  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      request_body
    );
    console.log("✅ Message sent to PSID:", sender_psid);
  } catch (error) {
    console.error(
      `❌ Unable to send message to PSID ${sender_psid}:`,
      error.response?.data || error.message
    );
    if (retryCount < 3) {
      setTimeout(() => callSendAPI(sender_psid, response, retryCount + 1), 1000 * (retryCount + 1));
    }
  }
}

const defaultReplies = {
  msc: (sender_psid) =>
    callSendAPI(sender_psid, {
      text: `Interested in joining MSC Cruises as crew? 🚢
MSCクルーズのクルーに興味がありますか？🌊`,
      quick_replies: [
        { content_type: "text", title: "Yes", payload: "MSC_YES" },
        { content_type: "text", title: "No", payload: "MSC_NO" },
      ],
    }),

  apply: (sender_psid) =>
    callSendAPI(sender_psid, {
      text: `📝 Here's how to apply for jobs with us:
1. Visit: https://horizonjapan.softr.app/
2. Select the job you're interested in
3. Fill out the application form
📝 応募方法：
1. サイトへアクセス：https://horizonjapan.softr.app/
2. 応募したい仕事を選ぶ
3. 応募フォームに記入してください`,
    }),

  job: (sender_psid) =>
    callSendAPI(sender_psid, {
      text: `💼 We currently have several job openings!
💼 現在、さまざまな求人があります！
➡️ https://horizonjapan.softr.app/`,
    }),

  help: (sender_psid) =>
    callSendAPI(sender_psid, {
      text: `🆘 How can I help you?
🆘 どのようにお手伝いできますか？`,
    }),

  "pre-screening": (sender_psid) =>
    callSendAPI(sender_psid, {
      text: `To complete your pre-screening appointment, click below:
事前面談のご予約はこちら：
👉 https://calendar.google.com/calendar/u/0/appointments/AcZssZ1XWqZlSoUY8C4H7uB9w2Q-NU9fXJ5S7Spgmmc=

ご不明な点がございましたら、お気軽にこちらのメッセージでお問い合わせください。`,
    }),
};

function handleMessage(sender_psid, received_message) {
  if (!sender_psid) {
    console.warn("⚠️ Skipping message: Missing sender_psid");
    return;
  }

  const message = received_message.text?.toLowerCase() || "";
  const quick_reply_payload = received_message.quick_reply?.payload;

  if (threadControlledByHuman.has(sender_psid)) return;
  if (quick_reply_payload) return handleQuickReply(sender_psid, quick_reply_payload);
  if (!hasHumanTimeoutExpired(sender_psid)) return;

  for (const key in defaultReplies) {
    if (message.includes(key)) return defaultReplies[key](sender_psid);
  }

  const lastReply = defaultReplyFlags.get(sender_psid);
  if (!lastReply || Date.now() - lastReply > cooldownPeriod) {
    callSendAPI(sender_psid, {
      text: "🤖 One of our team members will be with you shortly.",
      quick_replies: [
        { content_type: "text", title: "MSC Cruise Jobs", payload: "MSC" },
        { content_type: "text", title: "Current Job Opening", payload: "JOB_OPENING" },
        { content_type: "text", title: "How to Apply", payload: "HOW_TO_APPLY" },
        { content_type: "text", title: "Pre-Screening Appointment", payload: "PRE_SCREENING" },
      ],
    });
    defaultReplyFlags.set(sender_psid, Date.now());
  }
}

function handleQuickReply(sender_psid, payload) {
  const steps = {
    MSC_YES: () =>
      callSendAPI(sender_psid, {
        text: "🤖 Have you ever worked on a cruise ship before?",
        quick_replies: [
          { content_type: "text", title: "Yes", payload: "WORKED_CRUISE_YES" },
          { content_type: "text", title: "No", payload: "WORKED_CRUISE_NO" },
        ],
      }),

    WORKED_CRUISE_YES: () => steps.LANGUAGE(),
    WORKED_CRUISE_NO: () => steps.LANGUAGE(),

    LANGUAGE: () =>
      callSendAPI(sender_psid, {
        text: "🤖 Can you speak Japanese?",
        quick_replies: [
          { content_type: "text", title: "Yes", payload: "JAPANESE_YES" },
          { content_type: "text", title: "No", payload: "JAPANESE_NO" },
        ],
      }),

    JAPANESE_YES: () =>
      callSendAPI(sender_psid, {
        text: `Great! Please register here:\nこちらからご登録ください：\n👉 https://airtable.com/appODQ53LeZaz8bgj/pagGGwD7IdGwlVSlE/form`,
      }),

    JAPANESE_NO: () =>
      callSendAPI(sender_psid, {
        text: `No worries! We have jobs for English speakers too.\n👉 https://horizonjapan.softr.app/`,
      }),

    MSC: () => steps.MSC_YES(),
    JOB_OPENING: () => defaultReplies.job(sender_psid),
    HOW_TO_APPLY: () => defaultReplies.apply(sender_psid),
    PRE_SCREENING: () => defaultReplies["pre-screening"](sender_psid),
    HELP: () => defaultReplies.help(sender_psid),
  };

  if (steps[payload]) steps[payload]();
  else console.warn("⚠️ Unknown quick reply payload:", payload);
}

function handlePostback(sender_psid, received_postback) {
  const payload = received_postback.payload;

  if (payload === "GET_STARTED") {
    callSendAPI(sender_psid, {
      text: `Thanks for messaging us!🙌
Our team will reply soon.
メッセージありがとうございます！🙌
担当者よりすぐにご連絡いたします。`,
      quick_replies: [
        { content_type: "text", title: "MSC Cruise Jobs", payload: "MSC" },
        { content_type: "text", title: "Current Job Opening", payload: "JOB_OPENING" },
        { content_type: "text", title: "How to Apply", payload: "HOW_TO_APPLY" },
        { content_type: "text", title: "Pre-Screening Appointment", payload: "PRE_SCREENING" },
      ],
    });
  } else {
    handleQuickReply(sender_psid, payload);
  }
}

function setPersistentMenu() {
  const menu = {
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          { type: "postback", title: "Current Job Openings", payload: "JOB_OPENING" },
          {
            type: "web_url",
            title: "MSC Cruise Application",
            url: "https://airtable.com/appODQ53LeZaz8bgj/pagGGwD7IdGwlVSlE/form",
            webview_height_ratio: "full",
          },
          {
            type: "web_url",
            title: "Pre-Screening Appointment",
            url: "https://calendar.google.com/calendar/u/0/appointments/AcZssZ1XWqZlSoUY8C4H7uB9w2Q-NU9fXJ5S7Spgmmc=",
            webview_height_ratio: "full",
          },
          {
            type: "web_url",
            title: "Visit Website",
            url: "https://horizonjapan.softr.app/",
            webview_height_ratio: "full",
          },
          { type: "postback", title: "Help", payload: "HELP" },
        ],
      },
    ],
  };

  axios
    .post(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, menu)
    .then(() => console.log("✅ Persistent menu set!"))
    .catch((err) => console.error("Menu error:", err.response?.data || err.message));
}

function setGetStartedButton() {
  axios
    .post(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, {
      get_started: { payload: "GET_STARTED" },
    })
    .then(() => {
      console.log("✅ Get Started button set!");
      setPersistentMenu();
    })
    .catch((err) => console.error("Get Started button error:", err.response?.data || err.message));
}

function checkAndSetup() {
  axios
    .get(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`)
    .then((res) => {
      const hasStart = res.data.data?.some((p) => p.get_started);
      if (!hasStart) setGetStartedButton();
      else setPersistentMenu();
    })
    .catch(() => setGetStartedButton());
}

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) res.status(200).send(challenge);
  else res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  if (req.body.object === "page") {
    res.sendStatus(200);
    req.body.entry.forEach((entry) => {
      const event = entry.messaging[0];
      const sender_psid = event.sender?.id;

      if (!sender_psid) {
        console.warn("⚠️ Skipped event: Missing sender_psid", event);
        return;
      }

      if (event.pass_thread_control) {
        threadControlledByHuman.add(sender_psid);
        return;
      }

      if (event.take_thread_control) {
        threadControlledByHuman.delete(sender_psid);
        return;
      }

      if (event.message) handleMessage(sender_psid, event.message);
      else if (event.postback) handlePostback(sender_psid, event.postback);
    });
  } else res.sendStatus(404);
});

checkAndSetup();
app.listen(3000, () => console.log("🚀 Server running on port 3000"));
