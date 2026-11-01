from flask import Flask, request, jsonify, render_template_string
import sqlite3
import requests

app = Flask(__name__)

DB_NAME = "memory.db"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3"

# ----------------------------
# DATABASE
# ----------------------------

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT,
            content TEXT
        )
    """)

    conn.commit()
    conn.close()

# ----------------------------
# SAVE MESSAGE
# ----------------------------

def save_message(role, content):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO messages (role, content) VALUES (?, ?)",
        (role, content)
    )

    conn.commit()
    conn.close()

# ----------------------------
# GET MEMORY
# ----------------------------

def get_memory(limit=10):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT role, content FROM messages ORDER BY id DESC LIMIT ?",
        (limit,)
    )

    rows = cursor.fetchall()
    conn.close()

    rows.reverse()

    memory = ""

    for role, content in rows:
        memory += f"{role}: {content}\n"

    return memory

# ----------------------------
# HTML PAGE
# ----------------------------

HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>AI Chatbot</title>

    <style>
        body {
            background: #111;
            color: white;
            font-family: Arial;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }

        .chat-container {
            width: 600px;
            background: #1e1e1e;
            padding: 20px;
            border-radius: 10px;
        }

        #chat {
            height: 400px;
            overflow-y: auto;
            border: 1px solid #333;
            padding: 10px;
            margin-bottom: 10px;
        }

        input {
            width: 80%;
            padding: 10px;
        }

        button {
            padding: 10px;
        }

        .user {
            color: #4fc3f7;
            margin: 10px 0;
        }

        .bot {
            color: #81c784;
            margin: 10px 0;
        }
    </style>
</head>

<body>

<div class="chat-container">
    <h2>Local AI Chatbot</h2>

    <div id="chat"></div>

    <input type="text" id="message" placeholder="Type message...">
    <button onclick="sendMessage()">Send</button>
</div>

<script>

async function sendMessage() {

    const input = document.getElementById("message");
    const chat = document.getElementById("chat");

    const message = input.value;

    if (!message) return;

    // USER MESSAGE
    chat.innerHTML += `
        <div class="user">
            <b>You:</b> ${message}
        </div>
    `;

    input.value = "";

    // LOADING MESSAGE
    const loadingId = "loading-" + Date.now();

    chat.innerHTML += `
        <div class="bot" id="${loadingId}">
            <b>AI:</b>
            <span class="thinking">Thinking</span>
            <span id="dots"></span>
        </div>
    `;

    chat.scrollTop = chat.scrollHeight;

    // ANIMATED DOTS
    let dots = 0;

    const dotInterval = setInterval(() => {

        dots = (dots + 1) % 4;

        const dotsElement = document.getElementById("dots");

        if (dotsElement) {
            dotsElement.innerText = ".".repeat(dots);
        }

    }, 500);

    try {

        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();

        // STOP ANIMATION
        clearInterval(dotInterval);

        // REPLACE LOADING WITH AI RESPONSE
        document.getElementById(loadingId).innerHTML = `
            <b>AI:</b> ${data.response}
        `;

        chat.scrollTop = chat.scrollHeight;

    } catch (error) {

        clearInterval(dotInterval);

        document.getElementById(loadingId).innerHTML = `
            <b>AI:</b> Error getting response.
        `;
    }
}

</script>
</body>
</html>
"""

# ----------------------------
# HOME
# ----------------------------

@app.route('/')
def home():
    return render_template_string(HTML_PAGE)

# ----------------------------
# CHAT API
# ----------------------------

@app.route('/chat', methods=['POST'])
def chat():

    user_message = request.json['message']

    save_message('User', user_message)

    memory = get_memory()

    prompt = f"""
You are a helpful AI assistant.

Conversation Memory:
{memory}

User: {user_message}

AI:
"""

    response = requests.post(
        OLLAMA_URL,
        json={
            'model': MODEL_NAME,
            'prompt': prompt,
            'stream': False
        }
    )

    ai_response = response.json()['response']

    save_message('AI', ai_response)

    return jsonify({
        'response': ai_response
    })

# ----------------------------
# START APP
# ----------------------------

if __name__ == '__main__':
    init_db()
    app.run(debug=True)