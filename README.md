# BigQuery Pulse 🚀

BigQuery Pulse is a sleek, modern web application built with a **Python Flask** backend and a custom, responsive **vanilla HTML/JS/CSS** frontend. It fetches, parses, and segments the official Google Cloud BigQuery Release Notes, allowing users to search, filter, select, and instantly draft and share updates on X (Twitter).

---

## ✨ Features

- **Granular Feed Segmentation**: Instead of displaying large daily feed blocks, the application splits entries by section headers (`Feature`, `Fix`, etc.) to show individual updates.
- **Real-Time Interactive Search**: Filter release notes instantly by category badges or text keywords.
- **Multi-Selection Drawer**: Check one or multiple updates to compile them into a unified list.
- **Smart Twitter/X intent builder**:
  - Live character counts (280-character limit check).
  - SVG progress ring indicating limit thresholds (warning states at $\le 20$ chars, error states at $\le 0$).
  - Layout toggle options (Bullet Points vs. Compact Outlines).
  - Smart truncation logic ensuring source links are never truncated.
- **Performance Caching**: 5-minute server-side memory caching to reduce API fetch times and rate-limiting.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, Flask, BeautifulSoup4, Feedparser, Requests.
- **Frontend**: Vanilla HTML5, Vanilla JavaScript, Vanilla CSS (Glassmorphism design language).

---

## 📂 File Structure

```text
bq-release-notes/
│
├── static/
│   ├── app.js          # Core frontend state, filter rendering, and tweet logic
│   └── style.css       # Deep space indigo theme, glassmorphic layout, animations
│
├── templates/
│   └── index.html      # Main user interface (header, toolbar, cards, modals)
│
├── app.py              # Flask server, feed fetcher, and RSS segmenter API
├── .gitignore          # File exclusion rules for Git
├── README.md           # Project documentation (this file)
└── venv/               # Python virtual environment (ignored)
```

---

## 🚀 Quick Start

### 1. Prerequisite Checks
Ensure you have **Python 3.10+** installed on your system.

### 2. Set Up Virtual Environment
Initialize a clean Python virtual environment inside the directory:
```bash
# Create environment
python -m venv venv

# Activate on Windows (Command Prompt/PowerShell)
.\venv\Scripts\activate

# Activate on Unix/macOS
source venv/bin/activate
```

### 3. Install Dependencies
Install Flask, BeautifulSoup4, and feed parsers:
```bash
pip install flask feedparser requests beautifulsoup4
```

### 4. Run the Server
Start the Flask development server:
```bash
python app.py
```

### 5. Access the Web Application
Open your web browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**
