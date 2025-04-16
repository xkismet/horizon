const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

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

  if (received_message.text) {
    const userText = received_message.text.toLowerCase();

    if (
      userText.includes("msc") &&
      (userText.includes("crew") ||
       userText.includes("apply") ||
       userText.trim() === "msc")
    ) {
      response = {
        text: `Interested in joining MSC Cruises as crew? 🚢  
Just fill out this short form to register!👇  
MSCクルーズのクルーに興味がありますか？🌊  
簡単な登録フォームはこちらからどうぞ👇  
https://airtable.com/appODQ53LeZaz8bgj/pagGGwD7IdGwlVSlE/form/`
      };
    } else {
      response = { text: `You said: "${received_message.text}"` };
    }
  }

  callSendAPI(sender_psid, response);
}


// Handle postbacks
function handlePostback(sender_psid, received_postback) {
  let response;
  const payload = received_postback.payload;

  if (payload === "GET_STARTED") {
    response = { text: `Thanks for messaging us!🙌
Our team will reply soon.
メッセージありがとうございます！🙌
担当者よりすぐにご連絡いたします。` };
  } else if (payload === "JOB_OPENING") {
    response = { text: `Feel free to visit our website to check out the latest job openings!
最新の募集情報はこちらのウェブサイトでチェックしてくださいね！
https://horizonjapan.softr.app/` };
  } else if (payload === "HELP") {
    response = { text: "How can I help you?" };
  }

  callSendAPI(sender_psid, response);
}

// Add persistent menu
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
    .then(() => console.log("Persistent menu set!"))
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
      console.log("Get Started button set!");
      // After setting up Get Started, set the Persistent Menu
      setPersistentMenu();
    })
    .catch(err => console.error("Error configuring Get Started button:", err.response.data));
}

// Check if the Get Started button and Persistent Menu are set
function checkAndSetup() {
  axios.get(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`)
    .then(response => {
      const data = response.data;
      if (!data.data || !data.data.some(profile => profile.get_started)) {
        // If Get Started button is not set, set it
        setGetStartedButton();
      } else {
        // If it's already set, set the Persistent Menu
        setPersistentMenu();
      }
    })
    .catch(err => {
      console.error("Error checking Messenger Profile:", err);
      setGetStartedButton();
    });
}

// Run the checkAndSetup once, then start the server
checkAndSetup();

app.listen(3000, () => {
  console.log("🚀 Server is running on port 3000");
});
