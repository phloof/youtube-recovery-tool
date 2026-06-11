# UI (ui/) — YouTube Recovery Tool

This is a minimal static UI you can place in the repository at `ui/`. It recognizes and groups recoverable item types:
- Videos
- Channels
- Playlists

How to run
- Open `ui/index.html` directly in a browser (basic functionality works)
- Or run a simple static server:
  - Python: `python -m http.server 8000` (then open http://localhost:8000/ui/)
  - Node: `npx http-server` or any static server

Features
- Drop a recovery JSON file (array or object with `items`, `results`, etc.)
- Paste a YouTube URL and try to recover (the UI will POST to `/api/recover` if you have a backend; otherwise it will locally parse the URL)
- Results are grouped by type (Videos / Channels / Playlists)
- Filter results by type, open links in a new tab, copy links, and export visible/all items as JSON

Backend integration
- The UI will attempt to POST `{ "url": "<youtube-url>" }` to `/api/recover`.
- If your backend returns JSON (array or object with items), the UI will consume and display those items.
- To integrate with your server, change the `endpoint` variable in `ui/app.js` to the correct path and make sure the response format is JSON.
