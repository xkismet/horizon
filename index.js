const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const userFlags = new Map();

const HUMAN_KEYWORDS = ["hello", "good day", "konnichiwa"];

function isHumanMessage(text) {
  const lower = text.toLowerCase();
  return HUMAN_KEYWORDS.some(keyword => lower.includes(keyword));
}

function hasHumanTimeoutExpired(sender_psid) {
  const lastHuman = userFlags.get(sender_psid);
  if (!lastHuman) return true;
  return Date.now() - lastHuman > 60 * 60 * 1000;
}

function flagHumanInteraction(sender_psid) {
  userFlags.set(sender_psid, Date.now());
}

function callSendAPI(sender_psid, response) {
  const request_body = {
    recipient: { id: sender_psid },
    message: response,
  };
  axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body)
    .then(() => console.log("Message sent!"))
    .catch(err => console.error("Unable to send message:" + err));
}

function handleMessage(sender_psid, received_message) {
  const message = received_message.text?.toLowerCase() || "";
  if (isHumanMessage(message)) {
    flagHumanInteraction(sender_psid);
    return;
  }

  if (!hasHumanTimeoutExpired(sender_psid)) return;

  if (message.includes("msc")) {
    callSendAPI(sender_psid, {
      text: "Interested in joining MSC Cruises as crew? 🚢\nMSCクルーズのクルーに興味がありますか？🌊",
      quick_replies: [
        { content_type: "text", title: "Yes", payload: "MSC_YES" },
        { content_type: "text", title: "No", payload: "MSC_NO" }
      ]
    });
  } else if (message.includes("apply") || message.includes("応募") || message.includes("申し込み")) {
    callSendAPI(sender_psid, {
      text: `📝 Here's how to apply for jobs with us:
1. Visit: https://horizonjapan.softr.app/
2. Select the job you're interested in
3. Fill out the application form
📝 応募方法：
1. サイトへアクセス：https://horizonjapan.softr.app/
2. 応募したい仕事を選ぶ
3. 応募フォームに記入してください`
    });
  } else if (message.includes("job") || message.includes("opening") || message.includes("求人") || message.includes("募集")) {
    callSendAPI(sender_psid, {
      text: `💼 We currently have several job openings! View them here:\n💼 現在、さまざまな求人があります！こちらからご覧いただけます：\n➡️ https://horizonjapan.softr.app/`
    });
  } else if (message.includes("help")) {
    callSendAPI(sender_psid, { text: "🆘 How can I help you?\n🆘 どのようにお手伝いできますか？" });
  } else {
    callSendAPI(sender_psid, {
      text: "One of our team members will be with you shortly.",
      quick_replies: [
        { content_type: "text", title: "MSC Cruise Jobs", payload: "MSC" },
        { content_type: "text", title: "Current Job Opening", payload: "JOB_OPENING" },
        { content_type: "text", title: "How to Apply", payload: "HOW_TO_APPLY" }
      ]
    });
  }
}

function handlePostback(sender_psid, received_postback) {
  const payload = received_postback.payload;

  if (payload === "GET_STARTED") {
    callSendAPI(sender_psid, {
      text: `Thanks for messaging us!🙌\nOur team will reply soon.\nメッセージありがとうございます！🙌\n担当者よりすぐにご連絡いたします。`,
      quick_replies: [
        { content_type: "text", title: "MSC Cruise Jobs", payload: "MSC" },
        { content_type: "text", title: "Current Job Opening", payload: "JOB_OPENING" },
        { content_type: "text", title: "How to Apply", payload: "HOW_TO_APPLY" }
      ]
    });
  } else if (payload === "JOB_OPENING") {
    callSendAPI(sender_psid, {
      text: `Feel free to visit our website to check out the latest job openings!\n最新の募集情報はこちらのウェブサイトでチェックしてくださいね！\nhttps://horizonjapan.softr.app/`
    });
  } else if (payload === "MSC") {
    callSendAPI(sender_psid, {
      text: "Interested in joining MSC Cruises as crew? 🚢\nMSCクルーズのクルーに興味がありますか？🌊",
      quick_replies: [
        { content_type: "text", title: "Yes", payload: "MSC_YES" },
        { content_type: "text", title: "No", payload: "MSC_NO" }
      ]
    });
  } else if (payload === "MSC_YES") {
    callSendAPI(sender_psid, {
      text: "Have you ever worked on a cruise ship before?",
      quick_replies: [
        { content_type: "text", title: "Yes", payload: "WORKED_CRUISE_YES" },
        { content_type: "text", title: "No", payload: "WORKED_CRUISE_NO" }
      ]
    });
  } else if (payload === "WORKED_CRUISE_NO" || payload === "WORKED_CRUISE_YES") {
    callSendAPI(sender_psid, {
      text: "Can you speak Japanese?",
      quick_replies: [
        { content_type: "text", title: "Yes", payload: "JAPANESE_YES" },
        { content_type: "text", title: "No", payload: "JAPANESE_NO" }
      ]
    });
  } else if (payload === "JAPANESE_NO") {
    callSendAPI(sender_psid, {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "No problem! Here are more ways we can help:",
          buttons: [
            { type: "web_url", url: "https://horizonjapan.softr.app/", title: "🚀 View More Jobs" },
            { type: "web_url", url: "https://horizonjapan.softr.app/", title: "🔗 Horizon Japan Website" },
            { type: "postback", title: "👩‍💼 Contact Support", payload: "CONTACT_SUPPORT" }
          ]
        }
      }
    });
  } else if (payload === "JAPANESE_YES") {
    callSendAPI(sender_psid, {
      text: "Just fill out this short form to register!👇\n簡単な登録フォームはこちらからどうぞ👇\nhttps://airtable.com/appODQ53LeZaz8bgj/pagGGwD7IdGwlVSlE/form/"
    });
  } else if (payload === "HOW_TO_APPLY") {
    callSendAPI(sender_psid, {
      text: `📝 Here's how to apply for jobs with us:
1. Visit: https://horizonjapan.softr.app/
2. Select the job you're interested in
3. Fill out the application form
📝 応募方法：
1. サイトへアクセス：https://horizonjapan.softr.app/
2. 応募したい仕事を選ぶ
3. 応募フォームに記入してください`
    });
  } else if (payload === "CONTACT_SUPPORT") {
    callSendAPI(sender_psid, { text: "One of our team members will be with you shortly." });
  }
}

function setPersistentMenu() {
  const menuData = {
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          {
            type: "postback",
            title: "Current Job Openings",
            payload: "JOB_OPENING"
          },
          {
            type: "web_url",
            title: "MSC Cruise Application",
            url: "https://airtable.com/appODQ53LeZaz8bgj/pagGGwD7IdGwlVSlE/form",
            webview_height_ratio: "full"
          },
          {
            type: "web_url",
            title: "Visit Website",
            url: "https://horizonjapan.softr.app/",
            webview_height_ratio: "full"
          },
          {
            type: "postback",
            title: "Help",
            payload: "HELP"
          }
        ]
      }
    ]
  };

  axios.post(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, menuData)
    .then(() => console.log("✅ Persistent menu set!"))
    .catch(err => console.error("Menu error:", err.response?.data || err.message));
}

function setGetStartedButton() {
  axios.post(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, {
    get_started: { payload: "GET_STARTED" }
  }).then(() => {
    console.log("✅ Get Started button set!");
    setPersistentMenu();
  }).catch(err => console.error("Get Started button error:", err.response?.data || err.message));
}

function checkAndSetup() {
  axios.get(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`)
    .then(response => {
      if (!response.data.data || !response.data.data.some(p => p.get_started)) {
        setGetStartedButton();
      } else {
        setPersistentMenu();
      }
    })
    .catch(() => setGetStartedButton());
}

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", (req, res) => {
  if (req.body.object === "page") {
    req.body.entry.forEach(entry => {
      const webhook_event = entry.messaging[0];
      const sender_psid = webhook_event.sender.id;

      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

checkAndSetup();

app.listen(3000, () => console.log("🚀 Server running on port 3000"));
