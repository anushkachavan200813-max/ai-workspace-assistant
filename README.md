# AI Workspace Assistant

An AI-powered workspace assistant built with Flask that combines AI chat, task management, notes, file processing, and web search in a single workspace.

## Features

- AI-powered chat using Groq
- Conversation history
- Task management
- Notes management
- File upload and processing
- PDF document processing
- DOCX document processing
- CSV and Excel file processing
- Web search using Tavily
- User login and logout
- SQLite database for storing application data
- Web-based workspace interface

## Technology Stack

### Backend

- Python
- Flask
- SQLite

### Frontend

- HTML
- CSS
- JavaScript

### AI and External APIs

- Groq API
- Tavily API

### File Processing

- PyPDF2
- python-docx
- pandas
- openpyxl

### Deployment

- Gunicorn
- Render

## Project Structure
ai-workspace-assistant/
│
├── app.py
├── database.py
├── requirements.txt
├── README.md
├── .gitignore
├── workspace.db
│
├── templates/
│   └── index.html
│
└── static/
    ├── script.js
    └── style.css

