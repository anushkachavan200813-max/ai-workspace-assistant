const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Remove active class from all nav items and sections
        navItems.forEach(nav => nav.classList.remove('active'));
        sections.forEach(sec => sec.classList.remove('active'));

        // Add active class to clicked item
        item.classList.add('active');

        // Show corresponding section
        const target = item.getAttribute('data-target');
        document.getElementById(target).classList.add('active');
    });
});
//chatbot
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('chat-send-btn');

function addMessage(text, sender) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', sender === 'user' ? 'user-wrapper' : 'bot-wrapper');

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    msgDiv.appendChild(textSpan);

    if (sender === 'bot') {
        const copyIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        const checkIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;

        const copyBtn = document.createElement('button');
        copyBtn.classList.add('msg-copy-btn');
        copyBtn.innerHTML = copyIconSVG;
        copyBtn.title = 'Copy response';

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = checkIconSVG;
                setTimeout(() => {
                    copyBtn.innerHTML = copyIconSVG;
                }, 1200);
            });
        });

        msgDiv.appendChild(copyBtn);
    }

    wrapper.appendChild(msgDiv);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text === '' && attachedFileText === '') return;

    let messageToSend = text;
    let displayMessage = text;

    if (attachedFileText !== '') {
        messageToSend = `${text}\n\n[Attached file: ${attachedFileName}]\n${attachedFileText}`;
        displayMessage = `${text} 📎 ${attachedFileName}`;
    }

    addMessage(displayMessage, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';

    const preview = document.getElementById('attachment-preview');
    if (preview) preview.remove();
    attachedFileText = '';
    attachedFileName = '';
    chatFileInput.value = '';

    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend, conversation_id: currentConversationId })
    })
    .then(response => response.json())
    .then(data => {
        addMessage(data.reply, 'bot');
        currentConversationId = data.conversation_id;
        loadConversations();

        if (data.action === 'task') {
            loadTasks();
        } else if (data.action === 'note') {
            loadNotes();
        }
    })
    .catch(error => {
        addMessage("Error: could not reach AI.", 'bot');
        console.error(error);
    });
});

// Allow pressing Enter to send message
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});
//textarea grow as taller my text will become
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
});


// task manager
const taskInput = document.getElementById('task-input');
const taskAddBtn = document.getElementById('task-add-btn');
const taskList = document.getElementById('task-list');

function renderTask(task) {
    const li = document.createElement('li');
    li.classList.add('task-item');
    if (task.completed) li.classList.add('completed');

    const checkIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    const trashIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    const editIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`;

    const completeBtn = document.createElement('button');
    completeBtn.classList.add('task-icon-btn', 'complete-icon-btn');
    completeBtn.innerHTML = checkIconSVG;
    completeBtn.title = 'Mark complete';
    completeBtn.addEventListener('click', () => {
        fetch(`/tasks/${task.id}/complete`, { method: 'PUT' })
            .then(() => loadTasks());
    });

    const span = document.createElement('span');
    span.classList.add('task-text');
    span.textContent = task.text;

    const timeSpan = document.createElement('span');
    timeSpan.classList.add('task-timestamp');
    timeSpan.textContent = formatTaskTime(task.timestamp);

    const dueDateSpan = document.createElement('span');
    dueDateSpan.classList.add('task-due-date');
    if (task.due_date) {
        const today = new Date().toISOString().split('T')[0];
        const isOverdue = task.due_date < today && !task.completed;
        if (isOverdue) dueDateSpan.classList.add('overdue');
        dueDateSpan.textContent = isOverdue ? `Overdue: ${task.due_date}` : `Due: ${task.due_date}`;
    }

    const editBtn = document.createElement('button');
    editBtn.classList.add('task-icon-btn', 'edit-icon-btn');
    editBtn.innerHTML = editIconSVG;
    editBtn.title = 'Edit task';
    editBtn.addEventListener('click', () => {
        enterEditMode(li, span, task);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('task-icon-btn', 'delete-icon-btn');
    deleteBtn.innerHTML = trashIconSVG;
    deleteBtn.title = 'Delete task';
    deleteBtn.addEventListener('click', () => {
        fetch(`/tasks/${task.id}`, { method: 'DELETE' })
            .then(() => loadTasks());
    });

    li.appendChild(completeBtn);
    li.appendChild(span);
    li.appendChild(timeSpan);
    li.appendChild(dueDateSpan);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
}

function enterEditMode(li, span, task) {
    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('task-edit-input');
    input.value = task.text;

    li.replaceChild(input, span);
    input.focus();

    function saveEdit() {
        const newText = input.value.trim();
        if (newText === '') return;

        fetch(`/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: newText })
        })
        .then(() => loadTasks());
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        }
    });

    input.addEventListener('blur', saveEdit);
}

function formatTaskTime(timestamp) {
    const date = new Date(timestamp + ' UTC');
    return date.toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function loadTasks() {
    fetch('/tasks')
        .then(response => response.json())
        .then(tasks => {
            taskList.innerHTML = '';
            tasks.forEach(task => renderTask(task));
        });
}

const taskDueDate = document.getElementById('task-due-date');

taskAddBtn.addEventListener('click', () => {
    const text = taskInput.value.trim();
    if (text === '') return;

    const dueDate = taskDueDate.value || null;

    fetch('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, due_date: dueDate })
    })
    .then(() => {
        taskInput.value = '';
        taskInput.style.height = 'auto';
        taskDueDate.value = '';
        loadTasks();
    });
});

taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        taskAddBtn.click();
    }
});

taskInput.addEventListener('input', () => {
    taskInput.style.height = 'auto';
    taskInput.style.height = taskInput.scrollHeight + 'px';
});

loadTasks(); // load tasks from database when page opens


//notes
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');
const noteAddBtn = document.getElementById('note-add-btn');
const noteList = document.getElementById('note-list');

function renderNote(note) {
    const card = document.createElement('div');
    card.classList.add('note-card');

    const editIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`;
    const trashIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

    const title = document.createElement('h3');
    title.textContent = note.title;

    const content = document.createElement('p');
    content.textContent = note.content;

    const footer = document.createElement('div');
    footer.classList.add('note-footer');

    const timeSpan = document.createElement('span');
    timeSpan.classList.add('note-timestamp');
    timeSpan.textContent = formatTaskTime(note.timestamp);

    const buttonsDiv = document.createElement('div');
    buttonsDiv.classList.add('note-buttons');

    const editBtn = document.createElement('button');
    editBtn.classList.add('task-icon-btn', 'edit-icon-btn');
    editBtn.innerHTML = editIconSVG;
    editBtn.title = 'Edit note';
    editBtn.addEventListener('click', () => {
        enterNoteEditMode(card, title, content, note);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('task-icon-btn', 'delete-icon-btn');
    deleteBtn.innerHTML = trashIconSVG;
    deleteBtn.title = 'Delete note';
    deleteBtn.addEventListener('click', () => {
        fetch(`/notes/${note.id}`, { method: 'DELETE' })
            .then(() => loadNotes());
    });

    buttonsDiv.appendChild(editBtn);
    buttonsDiv.appendChild(deleteBtn);

    footer.appendChild(timeSpan);
    footer.appendChild(buttonsDiv);

    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(footer);
    noteList.appendChild(card);
}

function enterNoteEditMode(card, titleEl, contentEl, note) {
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.classList.add('note-edit-title');
    titleInput.value = note.title;

    const contentInput = document.createElement('textarea');
    contentInput.classList.add('note-edit-content');
    contentInput.value = note.content;
    contentInput.rows = 4;

    card.replaceChild(contentInput, contentEl);
    card.replaceChild(titleInput, titleEl);
    titleInput.focus();

    function saveNoteEdit() {
        const newTitle = titleInput.value.trim();
        const newContent = contentInput.value.trim();
        if (newTitle === '') return;

        fetch(`/notes/${note.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, content: newContent })
        })
        .then(() => loadNotes());
    }

    contentInput.addEventListener('blur', () => {
        setTimeout(saveNoteEdit, 150);
    });
}

function loadNotes() {
    fetch('/notes')
        .then(response => response.json())
        .then(notes => {
            noteList.innerHTML = '';
            notes.forEach(note => renderNote(note));
        });
}

noteAddBtn.addEventListener('click', () => {
    const title = noteTitle.value.trim();
    const content = noteContent.value.trim();
    if (title === '') return;

    fetch('/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, content: content })
    })
    .then(() => {
        noteTitle.value = '';
        noteContent.value = '';
        loadNotes();
    });
});

loadNotes(); // load notes from database when page opens

//code generator
const codePrompt = document.getElementById('code-prompt');
const codeGenerateBtn = document.getElementById('code-generate-btn');
const codeOutput = document.getElementById('code-output');

const codeLanguage = document.getElementById('code-language');

codeGenerateBtn.addEventListener('click', () => {
    const prompt = codePrompt.value.trim();
    if (prompt === '') return;

    codeOutput.textContent = 'Generating code...';

    fetch('/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, language: codeLanguage.value })
    })
    .then(response => response.json())
    .then(data => {
        codeOutput.textContent = data.code;
    })
    .catch(error => {
        codeOutput.textContent = 'Error: could not generate code.';
        console.error(error);
    });
});
//explain button in code generator
const explainCodeBtn = document.getElementById('explain-code-btn');
const explanationBox = document.getElementById('explanation-box');
const explanationText = document.getElementById('explanation-text');

explainCodeBtn.addEventListener('click', () => {
    const code = codeOutput.textContent.trim();
    if (code === '' || code === 'Your generated code will appear here.') {
        alert('Generate some code first before asking for an explanation.');
        return;
    }

    explanationBox.style.display = 'block';
    explanationText.textContent = 'Explaining...';

    fetch('/explain-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
    })
    .then(response => response.json())
    .then(data => {
        explanationText.textContent = data.explanation;
    })
    .catch(error => {
        explanationText.textContent = 'Error explaining code.';
        console.error(error);
    });
});
//debugger in code section
const debugCodeInput = document.getElementById('debug-code');
const debugFixBtn = document.getElementById('debug-fix-btn');
const fixedOutput = document.getElementById('fixed-output');
const fixExplanationBox = document.getElementById('fix-explanation-box');
const fixExplanationText = document.getElementById('fix-explanation-text');

debugFixBtn.addEventListener('click', () => {
    const code = debugCodeInput.value.trim();
    if (code === '') return;

    fixedOutput.textContent = 'Fixing code...';
    fixExplanationBox.style.display = 'none';

    fetch('/fix-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
    })
    .then(response => response.json())
    .then(data => {
        fixedOutput.textContent = data.fixed_code;
        fixExplanationText.textContent = data.explanation;
        fixExplanationBox.style.display = 'block';
    })
    .catch(error => {
        fixedOutput.textContent = 'Error fixing code.';
        console.error(error);
    });
});
//copy button
function setupCopyButton(buttonId, outputElement) {
    const btn = document.getElementById(buttonId);
    btn.addEventListener('click', () => {
        const text = outputElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const original = btn.innerHTML;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
            setTimeout(() => {
                btn.innerHTML = original;
            }, 1200);
        });
    });
}

setupCopyButton('copy-code-btn', codeOutput);
setupCopyButton('copy-fixed-btn', fixedOutput);
//download as file in code section
function downloadAsFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const languageExtensions = {
    'python': 'py',
    'javascript': 'js',
    'java': 'java',
    'c++': 'cpp',
    'html/css': 'html',
    'sql': 'sql'
};

document.getElementById('download-code-btn').addEventListener('click', () => {
    const code = codeOutput.textContent;
    if (code === '' || code === 'Your generated code will appear here.') return;

    const ext = languageExtensions[codeLanguage.value] || 'txt';
    downloadAsFile(code, `generated_code.${ext}`);
});

document.getElementById('download-fixed-btn').addEventListener('click', () => {
    const code = fixedOutput.textContent;
    if (code === '' || code === 'Fixed code will appear here.') return;
    downloadAsFile(code, 'fixed_code.txt');
});
//email and content
const emailSubject = document.getElementById('email-subject');
const contentType = document.getElementById('content-type');
const emailTone = document.getElementById('email-tone');
const emailGenerateBtn = document.getElementById('email-generate-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const emailOutput = document.getElementById('email-output');

function generateContent() {
    const topic = emailSubject.value.trim();
    if (topic === '') return;

    emailOutput.textContent = 'Generating...';

    fetch('/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            topic: topic,
            content_type: contentType.value,
            tone: emailTone.value
        })
    })
    .then(response => response.json())
    .then(data => {
        emailOutput.textContent = data.content;
    })
    .catch(error => {
        emailOutput.textContent = 'Error: could not generate content.';
        console.error(error);
    });
}

emailGenerateBtn.addEventListener('click', generateContent);
regenerateBtn.addEventListener('click', generateContent);

const summaryInput = document.getElementById('summary-input');
const summaryGenerateBtn = document.getElementById('summary-generate-btn');
const summaryOutput = document.getElementById('summary-output');
const copySummaryBtn = document.getElementById('copy-summary-btn');

const summaryLength = document.getElementById('summary-length');
const summaryOutputCard = document.getElementById('summary-output-card');
const askDocSection = document.getElementById('ask-doc-section');

summaryGenerateBtn.addEventListener('click', () => {
    const text = summaryInput.value.trim();
    if (text === '') return;

    currentDocumentText = text;

    summaryOutputCard.style.display = 'block';
    summaryOutput.textContent = 'Summarizing...';

    fetch('/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, length: summaryLength.value })
    })
    .then(response => response.json())
    .then(data => {
        summaryOutput.textContent = data.summary;
        askDocSection.style.display = 'block';
    })
    .catch(error => {
        summaryOutput.textContent = 'Error: could not generate summary.';
        console.error(error);
    });
});

copySummaryBtn.addEventListener('click', () => {
    const summaryText = summaryOutput.textContent;

    navigator.clipboard.writeText(summaryText)
        .then(() => {
            copySummaryBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copySummaryBtn.textContent = '📋 Copy';
            }, 1500);
        })
        .catch(error => {
            console.error('Copy failed:', error);
        });
});
//summary
const uploadZone = document.getElementById('upload-zone');
const summaryFileInput = document.getElementById('summary-file');
let currentDocumentText = '';

uploadZone.addEventListener('click', () => {
    summaryFileInput.click();
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
});

summaryFileInput.addEventListener('change', () => {
    const file = summaryFileInput.files[0];
    if (file) handleFileUpload(file);
});

function handleFileUpload(file) {
    summaryInput.value = 'Extracting text from file...';

    const formData = new FormData();
    formData.append('file', file);

    fetch('/extract-file', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            summaryInput.value = '';
            alert(data.error);
        } else {
            summaryInput.value = data.text;
        }
    })
    .catch(error => {
        summaryInput.value = '';
        alert('Error extracting file text.');
        console.error(error);
    });
}
//sidebar
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});
// sidebar of chatBox
const historyToggle = document.getElementById('history-toggle');
const chatHistoryPanel = document.getElementById('chat-history-panel');

historyToggle.addEventListener('click', () => {
    chatHistoryPanel.classList.toggle('collapsed');
});

const chatHistoryList = document.getElementById('chat-history-list');
const newChatBtn = document.getElementById('new-chat-btn');
let currentConversationId = null;

function loadConversations() {
    fetch('/conversations')
        .then(response => response.json())
        .then(conversations => {
            chatHistoryList.innerHTML = '';
            conversations.forEach(conv => renderConversationItem(conv));
        });
}

function renderConversationItem(conv) {
    const item = document.createElement('div');
    item.classList.add('history-item');
    if (conv.id === currentConversationId) item.classList.add('active-conversation');

    const preview = document.createElement('span');
    preview.classList.add('history-preview');
    preview.textContent = conv.title;

    const deleteBtn = document.createElement('button');
    const trashIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    deleteBtn.innerHTML = trashIconSVG;
    deleteBtn.classList.add('history-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fetch(`/conversations/${conv.id}`, { method: 'DELETE' })
            .then(() => {
                if (currentConversationId === conv.id) {
                    startNewChat();
                }
                loadConversations();
            });
    });

    item.addEventListener('click', () => {
        loadConversationMessages(conv.id);
    });

    item.appendChild(preview);
    item.appendChild(deleteBtn);
    chatHistoryList.appendChild(item);
}

function loadConversationMessages(conversationId) {
    fetch(`/conversations/${conversationId}/messages`)
        .then(response => response.json())
        .then(messages => {
            chatBox.innerHTML = '';
            messages.forEach(m => {
                addMessage(m.message, 'user');
                addMessage(m.reply, 'bot');
            });
            currentConversationId = conversationId;
            loadConversations();
        });
}

function startNewChat() {
    currentConversationId = null;
    chatBox.innerHTML = '';
    loadConversations();
}

newChatBtn.addEventListener('click', startNewChat);

loadConversations();

//prompt enhance button-chatbot
const enhanceBtn = document.getElementById('enhance-btn');

enhanceBtn.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text === '') return;

    enhanceBtn.disabled = true;
    chatInput.value = 'Enhancing prompt...';

    fetch('/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text })
    })
    .then(response => response.json())
    .then(data => {
        chatInput.value = data.enhanced_prompt;
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
        enhanceBtn.disabled = false;
    })
    .catch(error => {
        chatInput.value = text; // restore original if it fails
        enhanceBtn.disabled = false;
        console.error(error);
    });
});

const voiceBtn = document.getElementById('voice-btn');
let isListening = false;
let recognition;

//voice command-chatbot
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    };

    recognition.onend = () => {
        isListening = false;
        voiceBtn.classList.remove('listening');
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        voiceBtn.classList.remove('listening');
    };

    voiceBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
            isListening = true;
            voiceBtn.classList.add('listening');
        }
    });

} else {
    voiceBtn.addEventListener('click', () => {
        alert('Voice input is not supported in this browser. Try Chrome or Edge.');
    });
}
//file attach at chatbot
const attachBtn = document.getElementById('attach-btn');
const chatFileInput = document.getElementById('chat-file-input');
let attachedFileText = '';
let attachedFileName = '';

attachBtn.addEventListener('click', () => {
    chatFileInput.click();
});

chatFileInput.addEventListener('change', () => {
    const file = chatFileInput.files[0];
    if (!file) return;

    attachedFileName = file.name;
    showAttachmentPreview(attachedFileName, 'Reading file...');

    const formData = new FormData();
    formData.append('file', file);

    fetch('/extract-file', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            attachedFileText = '';
            showAttachmentPreview(attachedFileName, 'Could not read this file type');
        } else {
            attachedFileText = data.text;
            showAttachmentPreview(attachedFileName, 'Ready to send');
        }
    })
    .catch(error => {
        attachedFileText = '';
        showAttachmentPreview(attachedFileName, 'Error reading file');
        console.error(error);
    });
});

function showAttachmentPreview(filename, status) {
    let preview = document.getElementById('attachment-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'attachment-preview';
        document.querySelector('.chat-input-card').prepend(preview);
    }
    preview.innerHTML = `📎 ${filename} <span class="attachment-status">(${status})</span> <button id="remove-attachment">✕</button>`;

    document.getElementById('remove-attachment').addEventListener('click', () => {
        attachedFileText = '';
        attachedFileName = '';
        preview.remove();
        chatFileInput.value = '';
    });
}
//toggle expand - notes section
const aiWriteToggle = document.getElementById('ai-write-toggle');
const aiWritePanel = document.getElementById('ai-write-panel');

aiWriteToggle.addEventListener('click', () => {
    aiWritePanel.classList.toggle('expanded');
    if (aiWritePanel.classList.contains('expanded')) {
        document.getElementById('ai-note-topic').focus();
    }
});
// ai notes
const aiNoteTopic = document.getElementById('ai-note-topic');
const noteAiSendBtn = document.getElementById('note-ai-send-btn');

noteAiSendBtn.addEventListener('click', () => {
    const topic = aiNoteTopic.value.trim();
    if (topic === '') return;

    noteContent.value = 'Generating notes...';
    noteTitle.value = topic;

    fetch('/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic })
    })
    .then(response => response.json())
    .then(data => {
        noteContent.value = data.notes;
        aiNoteTopic.value = '';
        aiWritePanel.classList.remove('expanded');
    })
    .catch(error => {
        noteContent.value = 'Error generating notes.';
        console.error(error);
    });
});

aiNoteTopic.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        noteAiSendBtn.click();
    }
});
//voice input for notes
const noteVoiceBtn = document.getElementById('note-voice-btn');
let isNoteListening = false;
let noteRecognition;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    noteRecognition = new SpeechRecognition();
    noteRecognition.continuous = false;
    noteRecognition.interimResults = false;
    noteRecognition.lang = 'en-US';

    noteRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        aiNoteTopic.value = transcript;
    };

    noteRecognition.onend = () => {
        isNoteListening = false;
        noteVoiceBtn.classList.remove('listening');
    };

    noteRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isNoteListening = false;
        noteVoiceBtn.classList.remove('listening');
    };

    noteVoiceBtn.addEventListener('click', () => {
        if (isNoteListening) {
            noteRecognition.stop();
        } else {
            noteRecognition.start();
            isNoteListening = true;
            noteVoiceBtn.classList.add('listening');
        }
    });

} else {
    noteVoiceBtn.addEventListener('click', () => {
        alert('Voice input is not supported in this browser. Try Chrome or Edge.');
    });
}
// prompt enhance for notes
const noteEnhanceBtn = document.getElementById('note-enhance-btn');

noteEnhanceBtn.addEventListener('click', () => {
    const text = aiNoteTopic.value.trim();
    if (text === '') return;

    noteEnhanceBtn.disabled = true;
    aiNoteTopic.value = 'Enhancing...';

    fetch('/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text })
    })
    .then(response => response.json())
    .then(data => {
        aiNoteTopic.value = data.enhanced_prompt;
        noteEnhanceBtn.disabled = false;
    })
    .catch(error => {
        aiNoteTopic.value = text;
        noteEnhanceBtn.disabled = false;
        console.error(error);
    });
});
//tab switch in code generator section
const codeTabs = document.querySelectorAll('.code-tab');
const codeTabContents = document.querySelectorAll('.code-tab-content');

codeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        codeTabs.forEach(t => t.classList.remove('active'));
        codeTabContents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        document.getElementById(`${target}-tab`).classList.add('active');
    });
});
//ask question about document
const askDocBox = document.getElementById('ask-doc-box');
const askDocInput = document.getElementById('ask-doc-input');
const askDocSendBtn = document.getElementById('ask-doc-send-btn');

function addAskDocMessage(text, sender) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', sender === 'user' ? 'user-wrapper' : 'bot-wrapper');

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    msgDiv.textContent = text;

    wrapper.appendChild(msgDiv);
    askDocBox.appendChild(wrapper);
    askDocBox.scrollTop = askDocBox.scrollHeight;
}

function sendDocQuestion() {
    const question = askDocInput.value.trim();
    if (question === '') return;

    addAskDocMessage(question, 'user');
    askDocInput.value = '';

    fetch('/ask-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_text: currentDocumentText, question: question })
    })
    .then(response => response.json())
    .then(data => {
        addAskDocMessage(data.answer, 'bot');
    })
    .catch(error => {
        addAskDocMessage('Error getting answer.', 'bot');
        console.error(error);
    });
}

askDocSendBtn.addEventListener('click', sendDocQuestion);

askDocInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendDocQuestion();
    }
});
//open in email
const openInEmailBtn = document.getElementById('open-in-email-btn');

openInEmailBtn.addEventListener('click', () => {
    const content = emailOutput.textContent.trim();
    if (content === '') return;

    let subject = '';
    let body = content;

    const subjectMatch = content.match(/^Subject:\s*(.+)/i);
    if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = content.replace(/^Subject:\s*.+\n*/i, '').trim();
    }

    const gmailComposeLink = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailComposeLink, '_blank');
});
//research section
const researchTopic = document.getElementById('research-topic');
const researchGenerateBtn = document.getElementById('research-generate-btn');
const researchOutputCard = document.getElementById('research-output-card');
const researchOutput = document.getElementById('research-output');
const researchOutputTitle = document.getElementById('research-output-title');
const researchAskSection = document.getElementById('research-ask-section');
let currentResearchText = '';

researchGenerateBtn.addEventListener('click', () => {
    const topic = researchTopic.value.trim();
    if (topic === '') return;

    researchOutputCard.style.display = 'block';
    researchOutputTitle.textContent = `Research: ${topic}`;
    researchOutput.textContent = 'Researching... this may take a few seconds.';

    fetch('/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic, document_text: researchAttachedText })
    })
    .then(response => response.json())
    .then(data => {
        researchOutput.innerHTML = linkifyText(data.research);
        currentResearchText = data.research;
        researchAskSection.style.display = 'block';
    })
    .catch(error => {
        researchOutput.textContent = 'Error generating research.';
        console.error(error);
    });
});
researchTopic.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        researchGenerateBtn.click();
    }
});

setupCopyButton('copy-research-btn', researchOutput);

const researchAskBox = document.getElementById('research-ask-box');
const researchAskInput = document.getElementById('research-ask-input');
const researchAskSendBtn = document.getElementById('research-ask-send-btn');

function addResearchAskMessage(text, sender) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', sender === 'user' ? 'user-wrapper' : 'bot-wrapper');

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    msgDiv.textContent = text;

    wrapper.appendChild(msgDiv);
    researchAskBox.appendChild(wrapper);
    researchAskBox.scrollTop = researchAskBox.scrollHeight;
}

function sendResearchQuestion() {
    const question = researchAskInput.value.trim();
    if (question === '') return;

    addResearchAskMessage(question, 'user');
    researchAskInput.value = '';

    fetch('/ask-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ research_text: currentResearchText, question: question })
    })
    .then(response => response.json())
    .then(data => {
        addResearchAskMessage(data.answer, 'bot');
    })
    .catch(error => {
        addResearchAskMessage('Error getting answer.', 'bot');
        console.error(error);
    });
}

researchAskSendBtn.addEventListener('click', sendResearchQuestion);

researchAskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendResearchQuestion();
    }
});
//file attach to research 
const researchAttachBtn = document.getElementById('research-attach-btn');
const researchFileInput = document.getElementById('research-file-input');
const researchAttachmentPreview = document.getElementById('research-attachment-preview');
let researchAttachedText = '';
let researchAttachedName = '';

researchAttachBtn.addEventListener('click', () => {
    researchFileInput.click();
});

researchFileInput.addEventListener('change', () => {
    const file = researchFileInput.files[0];
    if (!file) return;

    researchAttachedName = file.name;
    showResearchAttachmentPreview(researchAttachedName, 'Reading file...');

    const formData = new FormData();
    formData.append('file', file);

    fetch('/extract-file', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            researchAttachedText = '';
            showResearchAttachmentPreview(researchAttachedName, 'Could not read this file type');
        } else {
            researchAttachedText = data.text;
            showResearchAttachmentPreview(researchAttachedName, 'Ready');
        }
    })
    .catch(error => {
        researchAttachedText = '';
        showResearchAttachmentPreview(researchAttachedName, 'Error reading file');
        console.error(error);
    });
});

function showResearchAttachmentPreview(filename, status) {
    researchAttachmentPreview.style.display = 'flex';
    researchAttachmentPreview.innerHTML = `📎 ${filename} <span class="attachment-status">(${status})</span> <button id="remove-research-attachment">✕</button>`;

    document.getElementById('remove-research-attachment').addEventListener('click', () => {
        researchAttachedText = '';
        researchAttachedName = '';
        researchAttachmentPreview.style.display = 'none';
        researchFileInput.value = '';
    });
}
//helper function for url
function linkifyText(text) {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escaped.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}