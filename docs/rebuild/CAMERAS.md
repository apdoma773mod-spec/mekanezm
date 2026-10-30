# Cameras + face attendance — design (2026-10-30, not built yet)

## Owner's facts
- Shop has a **Hikvision DVR** (app Hik-Connect, version 7.0.200) with 8 channels: 01, 03, 05, 07 inside (ceiling, looking down — bad for faces); **02 and 08 are OUTSIDE** (street) ; 04 and 06 show «NO VIDEO». Device name in the app: «عبده».
- A separate **Mercusys** wifi camera (app «mekanezm», SD card) looking at the counter. The owner will bring its model to the shop PC later.
- The owner will MOVE cameras so faces are seen well. Rule from him: **the outside cameras (02, 08) decide who opened and who closed the shop.** Face recognition for workers matters most; customers are optional (put a «المكان متراقب بالكاميرات» sign).
- Cameras are on the same Wi-Fi/LAN as the shop PC.

## Proven today (feasibility test in `C:\mk-cam-test`, scratch, not in the repo)
`@vladmandic/human` 3.3.6 + `@vladmandic/human-models` + `@tensorflow/tfjs-backend-wasm` + `jpeg-js` runs on Node 24 on this PC: model load 0.7 s, one face found in ~1.1 s, embedding length 1024, same photo → similarity 1.000. Gotchas: import `file:///…/node_modules/@vladmandic/human/dist/human.node-wasm.js` directly (package `exports` is broken); install `@tensorflow/tfjs-core, -converter, -backend-cpu, -data, -layers` too; Node 24's fetch cannot read `file://` so serve `human-models/models` over a tiny local `http.createServer` and pass that URL as `modelBasePath`; `wasmPath` = plain folder path + separator. Detection runs on the main thread (~1 s) → run it in a `worker_threads` worker or in the bridge process, never in the API process.
No ffmpeg on the PC — not needed: Hikvision gives a JPEG per request: `GET http://<DVR-IP>/ISAPI/Streaming/channels/<N>01/picture` (digest auth; channel 2 = `201`, channel 8 = `801`). RTSP `rtsp://user:pass@IP:554/Streaming/Channels/201` would need ffmpeg — avoid.

## Architecture (decided)
1. **Camera bridge** = small Node program on the SHOP PC (own folder like `C:\mekanizm-camera`, NOT inside `C:\mekanizm-whatsapp`, which belongs to another session). Reads `camera.config.json` that the OWNER fills by hand on that PC (DVR IP, a read-only DVR user + password, channel numbers, which channel is «دخول»/«خروج»): the password must never be typed in chat or committed. Every ~1.5 s per channel: grab a snapshot, skip if unchanged (simple pixel diff = motion), detect faces, match against enrolled embeddings, post matches to the backend.
2. **Enrolment** in the staff file: «📸 صور الوش» (2–5 photos from the phone/webcam). Backend stores the photos; the bridge computes embeddings for new photos and posts them back (or the backend does it in a worker). Threshold start: similarity ≥ 0.6 (tune with real photos); a match needs 2 frames in a row; ignore the same person for 10 minutes.
3. **Backend** (`modules/camera`, bridge secret like `/bridge/*`): `GET /bridge/camera/faces` (staff + embeddings), `POST /bridge/camera/seen {staffId, camera, score, at}` → reuse the existing QR punch path (`staff` attendance in/out, late > 10 min rule, 🔔 attendance alert «👷 X حضر الساعة … — متأخر N دقيقة») + NEW «🔓 X فتح المحل» for the first punch-in of the day and «🔒 X قفل المحل» when the last person leaves (outside camera sees him go out after closing time; decide the exact rule with the owner).
4. **Screen**: «📷 الكاميرات» (admin): status of each channel (last snapshot, last seen), today's list «مين دخل الساعة كام», unknown-face snapshots to name (→ a customer visit or a new worker), threshold slider, switch on/off.
5. **Customers (phase 2, only if the owner confirms)**: unknown faces on the entrance camera are kept as «زبون جديد» with a snapshot; recognised again → «الزبون ده جه N مرات», link to a contact file by hand.

## Needs from the owner (asked 2026-10-30)
DVR local IP (from the router or Hik-Connect → device info), a new DVR user for the system (read-only), confirm channels 02 and 08 are the entrance/exit sides, and a PC at the shop that stays on. The system itself (:4000 on the dev PC) is not at the shop: the bridge must call the backend through the tunnel/hosting URL until the hosting decision is made.
