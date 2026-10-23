# Run doc — Project Agora (static site)

Static multi-page site: `index.html`, `data-view.html`, `more.html`, `404.html`, shared `styles.css`, SVG art under `assets/penpot/` (desktop + mobile variants). Links between pages are relative and invisible hotspot overlays are positioned over the SVG art.

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
- Poll until it answers: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/index.html` (expect 200). Also spot-check `/styles.css`, `/assets/penpot/home-desktop.svg`, `/data-view.html`.
- Register the preview with `http://127.0.0.1:8000/index.html` and the printed pid. Leave the server running; only stop it on request.

## Known quirk

The `Start-Process` one-liner may not return before a short shell timeout, but the detached child survives and serves. Verify liveness via `Get-Process`/`netstat` instead of retrying — a retry would just fail on the occupied port.
