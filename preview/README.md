# Reality Fracture Adventure — Web Board

Jace's spiral tower: 100 floors, two realities (warm **Multiverse** / cold **Echoverse**), Fracture Rifts, Reality Coin Flips (Multiverse 60/90, Echoverse 57/88), and the Empower Jace meter. Built from `../BOARD_DESIGN.md`, `../PRIZE_LIST.csv`, `../QUICK_REFERENCE.md` and `../AI_OPERATOR_PROMPT.md`.

It's a plain static site. There's no build step, no server code, no accounts, and no network calls. All art is CSS/SVG made for this board, with no card art.

| File | What it is |
|---|---|
| `index.html` | **Control view**: board, HUD, and control panel. Below 900 px wide (or with `?dock=1`) it switches to a compact controls-only layout for an OBS dock. |
| `index.html?obs=1` / `obs.html` | **Clean OBS overlay** (1920×1080 with a dark-glass background). No controls, no cursor. |
| `index.html?obs=1&transparent=1` / `obs-transparent.html` | The same overlay with a **transparent background**. Tiles and HUD panels stay opaque glass. |
| `prizes.js` | The **prize map**: a verbatim copy of `PRIZE_LIST.csv` inside backticks. Edit the CSV text there and reload. Every tile, banner, rift, and HUD prize comes from it. |
| `app.js`, `style.css` | Board logic and styles. |
| `tests/test_board.py` | Headless Playwright end-to-end test (57 checks). |
| `screenshots/` | Screenshots from the test run. |

`obs.html` and `obs-transparent.html` exist because OBS's **Local file** mode can't take `?obs=1`.

## Controls (control view; the keys also work in the OBS view through OBS's *Interact*)

| Key / button | Action |
|---|---|
| `→` or `Space` / **+1 SPACE** | forward 1 (same as the old board) |
| `←` / **−1** | back 1 |
| `PgUp` / `PgDn` / **+5 −5** | ±5 (same as the old board) |
| **Jump to space** box (`G` focuses it) | go directly to 0–100 (0 = Start) |
| **Move by N** box (`M` focuses it) + Enter | walks N floors step by step. Landing exactly on a rift **auto-applies** it with the shatter/warp animation. Reaching or passing 100 caps at 100 and plays the grand-prize celebration. N = 0 shows "No movement — no prize". |
| `Enter` / `Esc` | apply / dismiss a **rift prompt**. Arrows and jumps never auto-warp. If one ends on a rift space, the board asks "Rift! 32 → 35 — apply?". Passing over a rift does nothing. |
| `L` / **Flip lane** | Multiverse ↔ Echoverse, with a card-flip and glass-shimmer animation |
| `J` / `Shift+J` / **+1 Jace / −1** | Empower Jace meter. At 5 the pips burst, the "BONUS LEVEL 1 SPIN!" banner shows, and the meter resets to 0. |
| **Reset meter** | sets the meter to 0/5 (asks first) |
| `F` / **Flip the Reality Coin** | only enabled on the current lane's coin spaces (Multiverse 60/90, Echoverse 57/88). A 3D coin toss uses `crypto.getRandomValues`. **Heads = 2 Reality Fracture Play Boosters, Tails = 1 Reality Fracture Collector Booster.** Results are logged. A second flip on the same visit asks for confirmation. |
| `Ctrl+Z` / **Undo** | steps back through the last 40 changes. After an auto-rift, the first undo removes only the rift and the second undoes the move. |
| **Reset board…** | opens a dialog. You must type `RESET`. It sends the piece to Start and the lane to Multiverse. The Jace meter is kept unless you tick the box. No single key resets anything. |
| `C` | hide/show the control panel (same as the old board) |
| `+` / `−` / slider | camera zoom 1–3×, which follows the piece. Default is 1× (whole board). |
| **Climber** box | optional customer name shown in the HUD and banners |

The HUD always shows: the current zone (header banner), a big lane badge (MULTIVERSE/ECHOVERSE plus MV/EV text, so lane isn't shown by color alone), the floor number, the active lane's prize (the other lane's prize appears in small print), the Empower Jace meter x/5, and the zone legend. Tiles show the Multiverse prize on top and the Echoverse prize below a crack line. The inactive half is dimmed and frosted. Echoverse halves with a different prize category get a violet glow. Rift tiles are glowing portals labelled "RIFT +N → dest" with animated arc arrows. Markers follow the **active lane**: that lane's booster/spin spaces get the big star medallion, its premium raw draws a small sparkle, and its coin-flip spaces the gold coin medallion. They reshuffle with a short animation on every lane flip (rifts and 100 never move). Prices are never shown.

## How sync works

State (space, lane, meter, rift prompt, coin results, log) is saved in `localStorage` under `rfa-board-state-v1`, with a revision number. A copy served from a `/preview/` folder (or with `?ns=name`) uses `rfa-board-state-v1-preview` (or `-name`) and its own sync channel instead, so it can never disturb the live board on the same origin. Every change is broadcast three ways. Every view listens to all three and keeps the highest revision:

1. `BroadcastChannel('rfa-board-sync')`: instant, between tabs of the same browser profile.
2. The `storage` event: also instant, and it fires between OBS browser sources/docks.
3. A 700 ms `localStorage` poll as a fallback.

Each change carries an event (move, rift, flip, jace, coin, reset), so every view plays the animation itself. A reload or a freshly opened OBS source shows the saved state **without replaying** old animations.

### Important: OBS does not share storage with Chrome

The OBS browser source runs inside OBS's own embedded Chromium (CEF) with its own profile. **A control page open in Chrome/Edge and an overlay in OBS will NOT see each other's localStorage.** They don't sync, even on the same URL. Sync works only between views running **in the same browser profile**.

### Recommended OBS setup (no accounts, no server)

Run **both** views inside OBS so they share OBS's CEF profile:

1. **Overlay:** add a *Browser* source with URL `…/index.html?obs=1` (or `?obs=1&transparent=1`), width 1920, height 1080.
2. **Controls:** *Docks → Custom Browser Docks…*, name it "Tower Control", and use URL `…/index.html?dock=1` from the **same origin** (same host, or the same `http://absolute/...` path).
3. Click into the dock and use the buttons or keys. The overlay updates live.

Why this works: OBS docks and browser sources share one CEF cookie/storage profile. An OBS developer says so on the OBS Ideas board ("browser sources and browser panels/docks already share cookies", https://ideas.obsproject.com/posts/601), and obs-browser issue #245 confirms docks share one localStorage (https://github.com/obsproject/obs-browser/issues/245). Storage is still per **origin**, so both URLs must match. With local files, obs-studio issue #6202 (https://github.com/obsproject/obs-studio/issues/6202) explains that browser sources in "Local file" mode load as `http://absolute/C:/...` while docks typed as `file:///...` get a *different* storage. Type the dock URL as `http://absolute/C:/path/to/board/index.html?dock=1` to match. An OBS forum report says the `storage` event fires between browser sources while BroadcastChannel may not (https://obsproject.com/forum/threads/localstorage-api-trigger.185893/). That's why the board uses all three channels. I couldn't test inside OBS from here, so do a 30-second check before going live: move the piece in the dock and watch the overlay.

Alternatives:
- **Single view, like the old board:** use `index.html` (control view) as the browser source, press `C` to hide the panel, and drive it with right-click → *Interact* (keys and buttons work there). Only one view is involved, so there's nothing to sync.
- **Control from Chrome on another PC or phone:** this needs a shared backend (e.g. a tiny websocket/KV service). It isn't included because it needs an account/server.

## Running locally

```
cd board
python -m http.server 8765        # then open http://localhost:8765/ and http://localhost:8765/?obs=1
python tests/test_board.py         # needs: pip install playwright (uses Chrome/Chromium headless)
```

Opening `index.html` directly from disk also works. Chrome tabs on `file://` may not share storage between files, so a local server or a hosted URL is better.

## Getting a public URL (pick one; each needs Trent's account/approval)

- **GitHub Pages:** free. Needs a GitHub account and a public repo (private repos need GitHub Pro). Push the `board/` contents and turn on Pages (Settings → Pages → Deploy from branch). URL looks like `https://<user>.github.io/<repo>/`.
- **Netlify Drop:** drag the `board` folder onto https://app.netlify.com/drop. You can drop without an account, but it's temporary (password-protected and deleted unless claimed within 1 hour), so Trent should sign in (free) first. URL looks like `https://<name>.netlify.app`. Updates mean dragging the folder in again.
- **Cloudflare Pages:** free Cloudflare account. *Workers & Pages → Create → Pages → Upload assets*, then drop the folder or zip. URL looks like `https://<name>.pages.dev`.
- **Same host as the old board (`*.chatgpt.site`):** that site was published from the owner's ChatGPT/Codex account. Whoever owns it could publish this folder the same way.

A hosted URL gives the OBS source and the OBS dock the same origin automatically. That's the simplest setup.

## Findings about the old Hobbit board (read-only inspection, nothing changed)

- It's hosted on `hobbit-adventure-board.hobokekw.chatgpt.site`, behind Cloudflare. It's a Vite/"vinext" React app with the `codex-preview` meta tag, so it was published from a ChatGPT/Codex "sites" workspace.
- It has **no backend or API for game state**. Position and zoom live only in `localStorage` (`hobbit-position`, `hobbit-zoom`), and the page reads them **once on load**. It has no `storage`/BroadcastChannel listener, so a separate `?obs=1` view only updates after a refresh. In practice it works only when one view is driven directly (e.g. via OBS Interact).
- Keys: `→`/Space +1, `←` −1, PgUp +5, PgDn −5, Home → 1, End → 100, `C` toggles controls, `+`/`−` zoom. It has buttons −5/−1/+1/+5, a jump box, a zoom slider, and a **one-click "Reset" button with no confirmation**. The new board keeps all of these except Home/End and the instant reset, which were removed to prevent accidents.
