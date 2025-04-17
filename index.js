const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const HUMAN_KEYWORDS = ["hello", "hi", "good day", "konnichiwa"];
const humanPausedUsers = new Map();

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    console.log("WEBHOOK_VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook handler
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach(entry => {
      const webhook_event = entry.messaging[0];
      const sender_psid = webhook_event.sender.id;

      if (isBotPaused(sender_psid)) return;

      if (webhook_event.message) {
        if (detectHumanMessage(webhook_event.message.text)) {
          pauseBotForUser(sender_psid);
        } else {
          handleMessage(sender_psid, webhook_event.message);
        }
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

function isBotPaused(sender_psid) {
  const timeout = humanPausedUsers.get(sender_psid);
  if (!timeout) return false;
  if (Date.now() > timeout) {
    humanPausedUsers.delete(sender_psid);
    return false;
  }
  return true;
}

function pauseBotForUser(sender_psid) {
  humanPausedUsers.set(sender_psid, Date.now() + 3600000); // 1 hour pause
  console.log(`Bot paused for user ${sender_psid} for 1 hour.`);
}

function detectHumanMessage(text = "") {
  return HUMAN_KEYWORDS.some(keyword => text.toLowerCase().includes(keyword));
}

// Send text message
function callSendAPI(sender_psid, response) {
  const request_body = {
    recipient: { id: sender_psid },
    message: response
  };

  axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body)
    .then(() => console.log("Message sent!"))
    .catch(err => console.error("Unable to send message:" + err));
}

// Handle messages
function handleMessage(sender_psid, received_message) {
  let response;
  const message = received_message.text.toLowerCase();

  if (message.includes("msc") || message.includes("cruise")) {
    response = {
      text: `Interested in joining MSC Cruises as crew? 🚢\nJust fill out this short form to register!👇\nMSCクルーズのクルーに興味がありますか？🌊\n簡単な登録フォームはこちらからどうぞ👇\nhttps://airtable.com/appODQ53LeZaz8bgj/pagGGwD7IdGwlVSlE/form/`
    };
  } else if (
    message.includes("apply") ||
    message.includes("how to apply") ||
    message.includes("応募") ||
    message.includes("申し込み")
  ) {
    response = {
      text: `📝 Here's how to apply for jobs with us:\n1. Visit: https://horizonjapan.softr.app/\n2. Select the job you're interested in\n3. Fill out the application form\n📝 応募方法：\n1. サイトへアクセス：https://horizonjapan.softr.app/\n2. 応募したい仕事を選ぶ\n3. 応募フォームに記入してください`
    };
  } else if (
    message.includes("job") ||
    message.includes("openings") ||
    message.includes("求人") ||
    message.includes("募集")
  ) {
    response = {
      text: `💼 We currently have several job openings! View them here:\n💼 現在、さまざまな求人があります！こちらからご覧いただけます：\n➡️ https://horizonjapan.softr.app/`
    };
  } else if (message.includes("help") || message.includes("support")) {
    response = {
      text: `🆘 How can I help you?\n🆘 どのようにお手伝いできますか？`
    };
  } else {
    response = {
      text: `🤖 You said: \"${received_message.text}\"`
    };
  }

  callSendAPI(sender_psid, response);
}

// Handle postbacks
function handlePostback(sender_psid, received_postback) {
  const payload = received_postback.payload;

  if (payload === "GET_STARTED") {
    const welcomeMessage = {
      text: `Thanks for messaging us!🙌\nOur team will reply soon.\nメッセージありがとうございます！🙌\n担当者よりすぐにご連絡いたします。`
    };

    const quickReplyMessage = {
      text: "How can I assist you today?\n本日どのようにお手伝いできますか？",
      quick_replies: [
        {
          content_type: "text",
          title: "✅ MSC Cruise Jobs",
          payload: "MSC_CRUISE"
        },
        {
          content_type: "text",
          title: "📋 All Openings",
          payload: "ALL_OPENINGS"
        },
        {
          content_type: "text",
          title: "📝 How to Apply",
          payload: "HOW_TO_APPLY"
        }
      ]
    };

    callSendAPI(sender_psid, welcomeMessage);
    setTimeout(() => {
      callSendAPI(sender_psid, quickReplyMessage);
    }, 1000);
  } else if (payload === "JOB_OPENING") {
    callSendAPI(sender_psid, {
      text: `Feel free to visit our website to check out the latest job openings!\n最新の募集情報はこちらのウェブサイトでチェックしてくださいね！\nhttps://horizonjapan.softr.app/`
    });
  } else if (payload === "HELP") {
    callSendAPI(sender_psid, { text: "How can I help you?" });
  }
}

// Set persistent menu
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
    .then(() => console.log("✅Persistent menu set!"))
    .catch(err => console.error("Menu error:", err.response.data));
}

// Set the Get Started button
function setGetStartedButton() {
  const getStartedData = {
    get_started: {
      payload: "GET_STARTED"
    }
  };

  axios.post(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, getStartedData)
    .then(() => {
      console.log("✅Get Started button set!");
      setPersistentMenu();
    })
    .catch(err => console.error("Error configuring Get Started button:", err.response.data));
}

// Initial setup
function checkAndSetup() {
  axios.get(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`)
    .then(response => {
      const data = response.data;
      if (!data.data || !data.data.some(profile => profile.get_started)) {
        setGetStartedButton();
      } else {
        setPersistentMenu();
      }
    })
    .catch(err => {
      console.error("Error checking Messenger Profile:", err);
      setGetStartedButton();
    });
}

checkAndSetup();

app.listen(3000, () => {
  console.log("🚀 Server is running on port 3000");
});
