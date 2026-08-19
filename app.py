from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from functools import wraps
from groq import Groq
from dotenv import load_dotenv
from database import init_db
import os
import sqlite3
from PyPDF2 import PdfReader
from docx import Document
import pandas as pd
import re #regular expression
import json
from tavily import TavilyClient
from datetime import datetime

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

init_db()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def clean_code_output(text):
    text = text.strip()
    text = re.sub(r'^```[a-zA-Z0-9+]*\n', '', text)
    text = re.sub(r'\n```$', '', text)
    return text.strip()

def web_search(query):
    try:
        results = tavily_client.search(query, max_results=3)
        combined = ""
        sources = []
        for r in results.get('results', []):
            combined += f"Source: {r['title']}\n{r['content']}\n\n"
            sources.append({'title': r['title'], 'url': r['url']})
        return combined.strip(), sources
    except Exception as e:
        return "", []

@app.route('/')
@login_required
def home():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if username == os.getenv("APP_USERNAME") and password == os.getenv("APP_PASSWORD"):
            session['logged_in'] = True
            return redirect(url_for('home'))
        else:
            error = "Invalid username or password"

    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get('message')

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": f"You are a helpful assistant. Today's date is {datetime.now().strftime('%Y-%m-%d')}. Respond ONLY with valid JSON in this exact format, nothing else:\n\n{{\"intent\": \"task\" or \"note\" or \"query_data\" or \"none\", \"task_content\": \"...\" (only if intent is task), \"task_due_date\": \"YYYY-MM-DD\" or null (only if intent is task and a date/day is mentioned or implied, e.g. 'tomorrow', 'Friday', 'next week' - calculate the actual date based on today's date), \"note_title\": \"...\" (only if intent is note), \"note_content\": \"...\" (only if intent is note), \"needs_search\": true or false, \"search_query\": \"a short search query\" (only if needs_search is true), \"reply\": \"your normal conversational reply\" (only needed if intent is 'none' or 'task' or 'note' and needs_search is false)}}\n\nSet intent to 'query_data' ONLY if the user is asking about THEIR OWN saved tasks or notes. Set needs_search to true ONLY if the question needs current, real-time, or very recent public information. Only set intent to 'task' if the user clearly wants a reminder/to-do added. Only set intent to 'note' if they clearly want something saved for reference. Otherwise intent is 'none'."},
            {"role": "user", "content": user_message}
        ]
    )

    raw_result = response.choices[0].message.content.strip()
    raw_result = clean_code_output(raw_result)

    try:
        result = json.loads(raw_result)
    except:
        result = {"intent": "none", "needs_search": False, "reply": "Sorry, I had trouble understanding that. Could you rephrase?"}

    action_taken = None

    if result.get('intent') == 'task':
        conn = sqlite3.connect('workspace.db')
        cursor = conn.cursor()
        cursor.execute('INSERT INTO tasks (text, completed, due_date) VALUES (?, 0, ?)', (result.get('task_content', user_message), result.get('task_due_date')))
        conn.commit()
        conn.close()
        action_taken = 'task'

    elif result.get('intent') == 'note':
        conn = sqlite3.connect('workspace.db')
        cursor = conn.cursor()
        cursor.execute('INSERT INTO notes (title, content) VALUES (?, ?)', (result.get('note_title', 'Untitled'), result.get('note_content', user_message)))
        conn.commit()
        conn.close()
        action_taken = 'note'

    elif result.get('intent') == 'query_data':
        conn = sqlite3.connect('workspace.db')
        cursor = conn.cursor()
        cursor.execute('SELECT text, completed FROM tasks')
        tasks_rows = cursor.fetchall()
        cursor.execute('SELECT title, content FROM notes')
        notes_rows = cursor.fetchall()
        conn.close()

        tasks_summary = "\n".join([f"- {t[0]} ({'Done' if t[1] else 'Pending'})" for t in tasks_rows]) or "No tasks saved."
        notes_summary = "\n".join([f"- {n[0]}: {n[1]}" for n in notes_rows]) or "No notes saved."

        data_response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Answer the user's question using the actual tasks and notes data provided below. Be concise and clear, using plain text with hyphens for lists - no markdown symbols."},
                {"role": "user", "content": f"My Tasks:\n{tasks_summary}\n\nMy Notes:\n{notes_summary}\n\nQuestion: {user_message}"}
            ]
        )
        result['reply'] = data_response.choices[0].message.content

    if result.get('needs_search'):
        search_query = result.get('search_query', user_message)
        search_results, sources = web_search(search_query)

        if search_results:
            followup = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant. Use the provided web search results to answer the user's question accurately and concisely. Mention that this is based on current web information if relevant."},
                    {"role": "user", "content": f"Search results:\n{search_results}\n\nQuestion: {user_message}"}
                ]
            )
            ai_reply = followup.choices[0].message.content
        else:
            ai_reply = "I tried to search for current information but couldn't retrieve results. Here's what I know: " + result.get('reply', '')
    else:
        ai_reply = result.get('reply', "Sorry, I couldn't process that.")

    if action_taken == 'task':
        ai_reply = f"✅ Added to your Tasks: \"{result.get('task_content')}\"\n\n{ai_reply}"
    elif action_taken == 'note':
        ai_reply = f"📝 Saved as a Note: \"{result.get('note_title')}\"\n\n{ai_reply}"

    conversation_id = request.json.get('conversation_id')

    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()

    if conversation_id is None:
        title = user_message[:40] + ('...' if len(user_message) > 40 else '')
        cursor.execute('INSERT INTO conversations (title) VALUES (?)', (title,))
        conversation_id = cursor.lastrowid

    cursor.execute('INSERT INTO chat_history (conversation_id, message, reply) VALUES (?, ?, ?)', (conversation_id, user_message, ai_reply))
    conn.commit()
    conn.close()

    return jsonify({'reply': ai_reply, 'action': action_taken, 'conversation_id': conversation_id})
    
@app.route('/conversations', methods=['GET'])
def get_conversations():
    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, title FROM conversations ORDER BY id DESC')
    rows = cursor.fetchall()
    conn.close()

    conversations = [{'id': row[0], 'title': row[1]} for row in rows]
    return jsonify(conversations)


@app.route('/conversations/<int:conversation_id>/messages', methods=['GET'])
def get_conversation_messages(conversation_id):
    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('SELECT message, reply FROM chat_history WHERE conversation_id = ? ORDER BY id ASC', (conversation_id,))
    rows = cursor.fetchall()
    conn.close()

    messages = [{'message': row[0], 'reply': row[1]} for row in rows]
    return jsonify(messages)


@app.route('/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM chat_history WHERE conversation_id = ?', (conversation_id,))
    cursor.execute('DELETE FROM conversations WHERE id = ?', (conversation_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Conversation deleted'})

@app.route('/tasks', methods=['GET'])
def get_tasks():
    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, text, completed, timestamp, due_date FROM tasks')
    rows = cursor.fetchall()
    conn.close()

    tasks = []
    for row in rows:
        tasks.append({
            'id': row[0],
            'text': row[1],
            'completed': bool(row[2]),
            'timestamp': row[3],
            'due_date': row[4]
        })

    return jsonify(tasks)

@app.route('/tasks', methods=['POST'])
def add_task():
    task_text = request.json.get('text')
    due_date = request.json.get('due_date')

    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('INSERT INTO tasks (text, completed, due_date) VALUES (?, 0, ?)', (task_text, due_date))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task added successfully'})

@app.route('/tasks/<int:task_id>/complete', methods=['PUT'])
def complete_task(task_id):
    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('SELECT completed FROM tasks WHERE id = ?', (task_id,))
    current = cursor.fetchone()[0]
    new_status = 0 if current else 1
    cursor.execute('UPDATE tasks SET completed = ? WHERE id = ?', (new_status, task_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task updated'})


@app.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task deleted'})

@app.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    new_text = request.json.get('text')
    new_due_date = request.json.get('due_date')

    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    if new_due_date is not None:
        cursor.execute('UPDATE tasks SET text = ?, due_date = ? WHERE id = ?', (new_text, new_due_date, task_id))
    else:
        cursor.execute('UPDATE tasks SET text = ? WHERE id = ?', (new_text, task_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Task updated'})

@app.route('/notes', methods=['GET'])
def get_notes():
    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, title, content, timestamp FROM notes ORDER BY id DESC')
    rows = cursor.fetchall()
    conn.close()

    notes = []
    for row in rows:
        notes.append({
            'id': row[0],
            'title': row[1],
            'content': row[2],
            'timestamp': row[3]
        })

    return jsonify(notes)
# note edit
@app.route('/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    title = request.json.get('title')
    content = request.json.get('content')

    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('UPDATE notes SET title = ?, content = ? WHERE id = ?', (title, content, note_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Note updated'})


@app.route('/notes', methods=['POST'])
def add_note():
    title = request.json.get('title')
    content = request.json.get('content')

    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('INSERT INTO notes (title, content) VALUES (?, ?)', (title, content))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Note added successfully'})


@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    conn = sqlite3.connect('workspace.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM notes WHERE id = ?', (note_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Note deleted'})

@app.route('/generate-code', methods=['POST'])
def generate_code():
    user_prompt = request.json.get('prompt')
    language = request.json.get('language', 'python')

    system_prompt = f"You are a code generator. Write the code in {language}. When the user describes what they need, respond ONLY with clean, working code and brief comments where necessary. Do not add long explanations outside the code — a short comment above the code is enough."

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )

    generated_code = response.choices[0].message.content
    generated_code = clean_code_output(generated_code)

    return jsonify({'code': generated_code})
    
@app.route('/generate-content', methods=['POST'])
def generate_content():
    topic = request.json.get('topic')
    content_type = request.json.get('content_type')
    tone = request.json.get('tone')

    if content_type == "email":
        system_prompt = f"You are a professional email writer. Write a {tone} email based on what the user describes. Include a proper subject line at the top (as 'Subject: ...'), a greeting, a clear body with proper structure, and a suitable sign-off. Return ONLY the email content, no extra explanation."

    elif content_type == "social media post":
        system_prompt = f"You are a social media content creator. Write a {tone} social media post based on what the user describes. Keep it short, engaging, and platform-friendly. You may include relevant hashtags and emojis if appropriate for the tone. Do not include a subject line, greeting, or sign-off. Return ONLY the post content."

    elif content_type == "message":
        system_prompt = f"You are writing a short {tone} message (like a text message), based on what the user describes. Keep it brief, natural, and conversational. Do not include a subject line, greeting, or formal sign-off. Return ONLY the message content."

    else:
        system_prompt = f"You are a professional content writer. Write a {tone} {content_type} based on what the user describes. Return ONLY the content, no extra explanation."

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": topic}
        ]
    )

    generated_content = response.choices[0].message.content
    return jsonify({'content': generated_content})

@app.route('/summarize', methods=['POST'])
def summarize():
    document_text = request.json.get('text')
    length = request.json.get('length', 'medium')

    length_instructions = {
        'short': 'Keep the summary very brief - 2-3 sentences maximum.',
        'medium': 'Keep the summary moderate length - a short paragraph or a few bullet points.',
        'detailed': 'Provide a detailed summary covering all key points, using bullet points where helpful.'
    }

    system_prompt = f"You are a summarization assistant. Read the given text and provide a clear summary covering the key points. {length_instructions.get(length, length_instructions['medium'])} Use plain text only - no markdown symbols like asterisks or hashes. Do not add opinions or extra information not present in the original text."

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": document_text}
        ]
    )

    summary = response.choices[0].message.content
    return jsonify({'summary': summary})

@app.route('/extract-file', methods=['POST'])
def extract_file():
    uploaded_file = request.files.get('file')
    filename = uploaded_file.filename

    if filename.endswith('.txt'):
        text = uploaded_file.read().decode('utf-8')

    elif filename.endswith('.pdf'):
        reader = PdfReader(uploaded_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"

    elif filename.endswith('.docx'):
        doc = Document(uploaded_file)
        text = "\n".join([para.text for para in doc.paragraphs])

    elif filename.endswith('.xlsx'):
        df = pd.read_excel(uploaded_file)
        text = df.to_string(index=False)

    elif filename.endswith('.csv'):
        df = pd.read_csv(uploaded_file)
        text = df.to_string(index=False)

    else:
        return jsonify({'error': 'Unsupported file type'}), 400

    return jsonify({'text': text})

@app.route('/enhance-prompt', methods=['POST'])
def enhance_prompt():
    original_prompt = request.json.get('prompt')

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": "You are a prompt enhancer. Rewrite the user's input to be clearer, more specific, and more effective as a prompt for an AI assistant, while preserving their original intent. Return ONLY the improved prompt text, nothing else — no explanations, no quotes around it."},
            {"role": "user", "content": original_prompt}
        ]
    )

    enhanced = response.choices[0].message.content
    return jsonify({'enhanced_prompt': enhanced})

# AI notes write route
@app.route('/generate-notes', methods=['POST'])
def generate_notes():
    topic = request.json.get('topic')

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
{"role": "system", "content": "You are a note-taking assistant. Given a topic, write clear, well-organized study/reference notes on it — NOT a conversational answer. Format using PLAIN TEXT only: use a hyphen (-) for bullet points, write headings as plain capitalized text followed by a colon, and leave a blank line between sections. Do NOT use Markdown symbols like asterisks (*), double asterisks (**), hashes (#), or plus signs (+) anywhere in the response. Keep it clean and readable as plain text. Return ONLY the notes content."},            {"role": "user", "content": topic}
        ]
    )

    notes_content = response.choices[0].message.content
    return jsonify({'notes': notes_content})

@app.route('/explain-code', methods=['POST'])
def explain_code():
    code = request.json.get('code')

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": "You are a code explainer. Given a piece of code, explain in plain, simple language what it does, step by step. Avoid jargon where possible. Keep it concise but clear. Do not repeat the code itself, just explain it."},
            {"role": "user", "content": code}
        ]
    )

    explanation = response.choices[0].message.content
    return jsonify({'explanation': explanation})
# debugger in code generator
@app.route('/fix-code', methods=['POST'])
def fix_code():
    code = request.json.get('code')

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": "You are a code debugger. Given code, find the bug and fix it. Respond in this exact format:\n\nFIXED_CODE:\n<the corrected code only, no explanations inside this part>\n\nEXPLANATION:\n<a short, 1-3 sentence explanation of what was wrong and what you fixed>"},
            {"role": "user", "content": code}
        ]
    )

    result = response.choices[0].message.content

    fixed_code = result
    explanation = "See code for fix."

    if "FIXED_CODE:" in result and "EXPLANATION:" in result:
        parts = result.split("EXPLANATION:")
        fixed_code = parts[0].replace("FIXED_CODE:", "").strip()
        fixed_code = clean_code_output(fixed_code)
        explanation = parts[1].strip()

    return jsonify({'fixed_code': fixed_code, 'explanation': explanation})

# ask about document
@app.route('/ask-document', methods=['POST'])
def ask_document():
    document_text = request.json.get('document_text')
    question = request.json.get('question')

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": "You are a document assistant. Answer the user's question using ONLY the information in the provided document. If the answer isn't in the document, say so clearly instead of guessing. Format your answer clearly using plain text only - use a hyphen (-) for bullet points and short paragraphs where helpful. Do NOT use Markdown symbols like asterisks, double asterisks, or hashes."},
            {"role": "user", "content": f"Document:\n{document_text}\n\nQuestion: {question}"}
        ]
    )

    answer = response.choices[0].message.content
    return jsonify({'answer': answer})

@app.route('/research', methods=['POST'])
def research():
    topic = request.json.get('topic')
    document_text = request.json.get('document_text', '')

    search_results, sources = web_search(topic)

    context = ""
    if document_text.strip() != '':
        context += f"Attached document content:\n{document_text}\n\n"
    if search_results:
        context += f"Web search results:\n{search_results}\n\n"

    if context.strip() == '':
        return jsonify({'research': "Sorry, I couldn't find information on this topic. Please try a different or more specific topic, or attach a relevant document."})

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": "You are a research assistant. Using the provided context (which may include an attached document and/or web search results), write a well-organized research summary on the topic. Structure it with clear section headings (plain text, followed by a colon) and bullet points (using hyphens) under each. Cover key facts, trends, and relevant details. Use plain text only - no markdown symbols like asterisks or hashes."},
            {"role": "user", "content": f"Topic: {topic}\n\n{context}"}
        ]
    )

    research_content = response.choices[0].message.content

    if sources:
        research_content += "\n\nSources:\n"
        for s in sources:
            research_content += f"- {s['title']}: {s['url']}\n"

    return jsonify({'research': research_content})

@app.route('/ask-research', methods=['POST'])
def ask_research():
    research_content = request.json.get('research_text')
    question = request.json.get('question')

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": "You are a research assistant. The user has generated a research summary (provided below) and is now asking follow-up questions. Use the research content as your primary reference, but you may also use your general knowledge to provide a complete, helpful answer if the research doesn't fully cover it. Format your answer clearly using plain text only - use a hyphen (-) for bullet points and short paragraphs where helpful. Do NOT use Markdown symbols like asterisks, double asterisks, or hashes."},
            {"role": "user", "content": f"Research content:\n{research_content}\n\nFollow-up question: {question}"}
        ]
    )

    answer = response.choices[0].message.content
    return jsonify({'answer': answer})

if __name__ == '__main__':
    app.run(debug=True)
