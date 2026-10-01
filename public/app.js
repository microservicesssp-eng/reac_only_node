const form = document.querySelector("#message-form");
const senderInput = document.querySelector("#sender");
const textInput = document.querySelector("#message");
const submitButton = document.querySelector("#submit");
const counter = document.querySelector("#counter");
const messageList = document.querySelector("#message-list");
const messageCount = document.querySelector("#message-count");
const errorBox = document.querySelector("#error");

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "medium"
});

function showError(message = "") {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function renderMessages(messages) {
  messageList.replaceChildren();
  if (messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.textContent = "↙";
    const title = document.createElement("strong");
    title.textContent = "Здесь пока тихо";
    const hint = document.createElement("span");
    hint.append("Отправьте первое сообщение", document.createElement("br"), "из панели слева");
    empty.append(icon, title, hint);
    messageList.append(empty);
  } else {
    for (const message of messages) {
      const card = document.createElement("article");
      card.className = "message-card";
      const meta = document.createElement("div");
      meta.className = "message-meta";
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = Array.from(message.sender)[0].toLocaleUpperCase("ru-RU");
      const name = document.createElement("strong");
      name.textContent = message.sender;
      const time = document.createElement("time");
      time.dateTime = message.receivedAt;
      time.textContent = dateFormatter.format(new Date(message.receivedAt));
      const text = document.createElement("p");
      text.textContent = message.text;
      meta.append(avatar, name, time);
      card.append(meta, text);
      messageList.append(card);
    }
  }

  const count = messages.length;
  const noun = count === 1 ? "сообщение" : count >= 2 && count <= 4 ? "сообщения" : "сообщений";
  messageCount.textContent = `${count} ${noun} в ленте`;
}

async function refreshMessages() {
  try {
    const response = await fetch("/api/messages?limit=100");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Не удалось загрузить сообщения.");
    renderMessages(data);
    showError();
  } catch (error) {
    showError(error.message);
  }
}

textInput.addEventListener("input", () => {
  counter.textContent = `${textInput.value.length} / 2000`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError();
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: senderInput.value,
        text: textInput.value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Не удалось отправить сообщение.");
    textInput.value = "";
    counter.textContent = "0 / 2000";
    await refreshMessages();
  } catch (error) {
    showError(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

refreshMessages();
window.setInterval(refreshMessages, 2000);
