# Run doc — Project Agora (static site)

Static multi-page site: `index.html`, `data-view.html`, `more.html`, `404.html`, shared `styles.css`, SVG art under `assets/penpot/` (desktop + mobile variants). Links between pages are relative and invisible hotspot overlays are positioned over the SVG art.

Two newer standalone pages each ship their own CSS and (for the landing page) a JS file, plus root-level SVG/PNG art:

- `landing.html` → `assets/landing/landing.css`, `assets/landing/landing.js`, `logoblue.svg`, `logo-blank.svg`, `cmp-*.png`
- `kalender.html` → `assets/kalender/kalender.css`, `kalender-page.svg`

Both load Google Fonts (Archivo, IBM Plex Mono) over the network; the pages still render with fallback fonts offline.

## Reproduce artifacts

Nothing to build. No `package.json`, no lockfile, no dependencies, no `.env` files — a fresh checkout of the repo files is the complete artifact.

## Run the server

Serve the repo root with Python's built-in static server (Python 3.10 at
`C:\Users\gamer\AppData\Local\Programs\Python\Python310\python.exe`). Default port 8000, loopback only.
Detach with PowerShell `Start-Process`; stdout and stderr MUST go to different files:

```
powershell -NoProfile -Command "(Start-Process -FilePath 'C:\Users\gamer\AppData\Local\Programs\Python\Python310\python.exe' -ArgumentList '-m','http.server','8000','--bind','127.0.0.1' -WorkingDirectory '<repo root>' -RedirectStandardOutput '<repo root>\.freebuff\preview.log' -RedirectStandardError '<repo root>\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```

- If port 8000 is busy (`netstat -ano | findstr :8000`), pick a free port and change the first http.server argument. Log paths stay as-is per session.
- Confirm the printed pid is alive: `powershell -NoProfile -Command "Get-Process -Id <pid>"`.
- Poll until it answers: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/index.html` (expect 200). Also spot-check `/styles.css`, `/assets/penpot/home-desktop.svg`, `/data-view.html`, `/landing.html`, `/assets/landing/landing.css`, `/kalender.html`, `/assets/kalender/kalender.css`.
- Register the preview with `http://127.0.0.1:8000/index.html` and the printed pid. Leave the server running; only stop it on request.

## Known quirk

The `Start-Process` one-liner does not return before a 30s shell timeout (observed consistently), but the detached child survives, listens and serves. Do not retry — a retry just fails on the occupied port. Instead recover the pid and pid readiness from the OS:

- `netstat -ano | findstr :8000` → the last column is the serving pid.
- `powershell -NoProfile -Command "Get-Process -Id <pid> | Select-Object Id,ProcessName,StartTime"` → confirms it is the python process.

Then register with that pid.
