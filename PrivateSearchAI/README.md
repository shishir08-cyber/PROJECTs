# PrivateSearch AI

A small private search tool: paste a webpage URL, it extracts the title and text, stores them in your own Supabase (PostgreSQL) database, and lets you search with PostgreSQL full-text search. Optional AI summaries use the Anthropic API.

**Stack:** Python 3.12, Streamlit, Supabase PostgreSQL, BeautifulSoup, Requests.

## 1. Set up Supabase

1. Create a free project at <https://supabase.com> and remember the **database password** you set.
2. Open **SQL Editor** → **New query**, paste the contents of `schema.sql`, and click **Run**.
3. Click **Connect** (top of the dashboard) and copy the **Session pooler** connection string.
   Use the pooler, not "Direct connection": direct connections are IPv6-only on the free plan and often fail on Windows home networks.
4. Replace `[YOUR-PASSWORD]` in that string with your password. If the password contains special characters (`@ : / # ?`), URL-encode them (for example `@` becomes `%40`).

## 2. Install (Windows 10/11, PowerShell)

Install Python 3.12 from <https://www.python.org/downloads/> (tick **Add python.exe to PATH**), then:

```powershell
cd path\to\privatesearch-ai
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
notepad .env
```

If PowerShell blocks `Activate.ps1`, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt and `.venv\Scripts\activate.bat` instead.

In `.env`, set `DATABASE_URL` to your connection string. `.env` is git-ignored; never share or commit it.

## 3. Run

```powershell
streamlit run app.py
```

Your browser opens at <http://localhost:8501>.

- **Index a page** tab: enter a URL (`https://` is added if you omit it) and click *Fetch and index*. Re-indexing the same URL updates it.
- **Search** tab: type keywords. You can use `"exact phrases"`, `OR`, and `-excluded` words. Results are ranked (title matches count more than body matches) and show an excerpt with matches in **bold**.

## Optional: AI summaries

Leave `ANTHROPIC_API_KEY` empty in `.env` and the app works exactly the same, just without summary buttons. To enable them, create a key at <https://console.anthropic.com/>, paste it into `.env`, and restart the app. Search results then show a **Summarize** button; summaries are saved to the database so each page is summarized only once. Only the page's first ~12,000 characters are sent to the API. The default model is `claude-haiku-5-5`; set `ANTHROPIC_MODEL` to change it.

## Tests

```powershell
python -m pytest -q
```

URL validation, HTML extraction, error handling, and the summarizer run with no setup. The search/database tests are skipped unless you point `TEST_DATABASE_URL` at a **throwaway** PostgreSQL database (they empty the `pages` table):

```powershell
$env:TEST_DATABASE_URL = "postgresql://user:password@localhost:5432/test_db"
python -m pytest -q
```

## Files

| File | Purpose |
|---|---|
| `app.py` | Streamlit UI |
| `crawler.py` | URL validation, fetching, title/text extraction |
| `database.py` | Supabase/PostgreSQL access |
| `search.py` | Full-text search and ranking |
| `summarizer.py` | Optional Anthropic summaries |
| `schema.sql` | Table, search index, row-level security |

## Notes

- Only use this on pages you are allowed to fetch. It does not crawl links, run JavaScript, or handle logins; JavaScript-only pages may yield little text.
- Secrets live only in `.env`. Error messages shown in the app never include your connection string or API key.
