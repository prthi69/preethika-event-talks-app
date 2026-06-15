import hashlib
import time
import requests
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Simple in-memory cache
CACHE_DURATION = 300  # 5 minutes
cache = {
    'data': None,
    'last_updated': 0
}

def fetch_and_parse_feed(force_refresh=False):
    now = time.time()
    if not force_refresh and cache['data'] is not None and (now - cache['last_updated']) < CACHE_DURATION:
        return cache['data']

    feed_url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    try:
        response = requests.get(feed_url, timeout=15)
        response.raise_for_status()
        feed_data = response.text
    except Exception as e:
        print(f"Error fetching feed from source: {e}")
        if cache['data'] is not None:
            # Serve stale cache if fetching fails
            return cache['data']
        raise e

    feed = feedparser.parse(feed_data)
    parsed_updates = []

    for entry in feed.entries:
        date_str = entry.title  # e.g., "June 15, 2026"
        entry_link = entry.get('link', 'https://cloud.google.com/bigquery/docs/release-notes')
        published_timestamp = entry.get('updated', entry.get('published', ''))
        
        # Parse the summary HTML
        soup = BeautifulSoup(entry.summary, 'html.parser')
        
        # Check for <h3> elements which delineate individual notes (Feature, Fix, etc.)
        h3_tags = soup.find_all('h3')
        
        entry_updates = []
        if not h3_tags:
            # Fallback: Treat the entire summary as a single update if no <h3> tags are found
            content_html = str(soup).strip()
            if content_html:
                entry_updates.append(('Update', content_html))
        else:
            current_type = None
            current_content = []
            for child in soup.contents:
                if child.name == 'h3':
                    if current_type:
                        entry_updates.append((
                            current_type,
                            "".join(str(x) for x in current_content).strip()
                        ))
                    current_type = child.get_text(strip=True)
                    current_content = []
                else:
                    if current_type:
                        current_content.append(child)
            
            # Append final section
            if current_type:
                entry_updates.append((
                    current_type,
                    "".join(str(x) for x in current_content).strip()
                ))

        for u_type, u_content in entry_updates:
            # Convert HTML content to clean plain text for Tweet drafting
            u_soup = BeautifulSoup(u_content, 'html.parser')
            
            # Format markdown-like or spaces for links
            for a_tag in u_soup.find_all('a'):
                href = a_tag.get('href', '')
                if href and not href.startswith('http'):
                    # Handle relative paths if any
                    href = 'https://docs.cloud.google.com' + href
                a_tag.replace_with(f"{a_tag.get_text()} ({href})")
                
            plain_text = u_soup.get_text(separator=' ').strip()
            # Clean up extra whitespaces
            plain_text = " ".join(plain_text.split())
            
            # Generate a unique hash for identification
            hash_input = f"{date_str}:{u_type}:{u_content}"
            update_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()
            
            parsed_updates.append({
                'id': update_id,
                'date': date_str,
                'timestamp': published_timestamp,
                'link': entry_link,
                'type': u_type,
                'content': u_content,
                'plain_text': plain_text
            })

    cache['data'] = parsed_updates
    cache['last_updated'] = now
    return parsed_updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    try:
        releases = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            'success': True,
            'releases': releases,
            'last_updated': cache['last_updated']
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
