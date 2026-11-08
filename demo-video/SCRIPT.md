# Tandem: Devpost demo video script

Video: `demo-video/tandem-devpost.mp4` (3:47, silent; you talk over it). Captions: `demo-video/tandem-devpost.srt`.
Start talking at the times below. The pace is about 144 words a minute. If a line runs long, drop words rather than pauses, because the video won't wait.

Falah 14 lines (~94 s) · Hunter 13 lines (~106 s)

## 1. The problem (0:00–0:21)

_On screen: Headline over the Calgary skyline, then three stat cards_

- **0:00.5 Falah:** Calgary has something on every night. The hard part isn’t finding an event. It’s walking in alone.
- **0:08.0 Hunter:** Nearly one in four young Canadians often feels lonely. More than one in four lives with a disability. And Calgary is growing faster than it has in forty years.

## 2. Meet Tandem (0:21–0:33)

_On screen: Tandem logo, tagline and three principles_

- **0:21.4 Falah:** Tandem is a group-first way to find people to do things with. No follower counts, no feeds, and we rate events, never people.

## 3. Sign up (0:33–0:45)

_On screen: Sign-up page: Google button, then "Visiting Calgary"_

- **0:33.2 Hunter:** Meet Riley: visiting Calgary for ten days, and anxious in big groups.
- **0:39.2 Falah:** Sign-up is one tap with Google, and choosing “Visiting Calgary” turns on travel mode.

## 4. Interests & comfort (0:45–1:00)

_On screen: Interests, then Comfort & Access settings and Ease Into It_

- **0:45.6 Hunter:** Riley picks a few interests.
- **0:48.2 Falah:** Comfort needs stay private, and they’re never medical labels: small groups, quiet, beginner-friendly.
- **0:54.1 Hunter:** And Ease Into It moves low-pressure events to the top of every list.

## 5. Search (1:00–1:17)

_On screen: Plain-language search, voice button, filtered results_

- **1:00.4 Falah:** Now Riley just types what they want, or says it out loud.
- **1:05.7 Hunter:** Our parser turns plain words into real filters, and accessibility filters only count what organizers have confirmed.
- **1:13.1 Falah:** And every result explains why it was picked.

## 6. Map (1:17–1:29)

_On screen: Map with the same filters, then the event popup_

- **1:17.2 Hunter:** The map runs on the exact same filters, so the list and the map always agree. Tap a pin, and you can join right from the map.

## 7. Event & join (1:29–1:50)

_On screen: Match breakdown, Join, First-Time Friendly, access info_

- **1:29.3 Falah:** Riley can see exactly how this match was scored: interests, timing, distance, access and budget. It’s rule-based, with no tracking.
- **1:38.7 Hunter:** One tap, and Riley’s going. The page says what to expect, that it’s First-Time Friendly, and which access features the host has actually confirmed.

## 8. Chat on two devices (1:50–2:08)

_On screen: Laptop and phone side by side, synced through the server_

- **1:50.2 Falah:** Joining unlocks the group chat, so Riley can say hi before ever walking in.
- **1:56.8 Hunter:** And that reply came from the host’s phone. Our Tandem Live server streams each change to every device in about a tenth of a second.

## 9. Server goes down (2:08–2:19)

_On screen: Server turns grey, message waits, then arrives on the phone_

- **2:08.0 Falah:** If the server goes down, Riley can keep chatting. Messages are saved on the device and delivered once the server’s back.

## 10. Explore Like a Local (2:19–2:30)

_On screen: Weekend planner, then Join all_

- **2:19.3 Hunter:** Because Riley’s visiting, Explore Like a Local plans the weekend around their interests and comfort settings. One tap joins the whole plan.

## 11. After the event (2:30–2:50)

_On screen: Confirm attendance, Tandem Miles, star rating, leaderboard_

- **2:29.8 Falah:** After the book club, Riley confirms they went, and earns Tandem Miles for showing up, not for popularity.
- **2:37.6 Falah:** Then Riley rates the event. Never the people.
- **2:41.3 Hunter:** The leaderboard uses a Bayesian average, so a handful of five-star reviews can’t outrank an event that’s consistently great.

## 12. Accessibility (2:50–3:06)

_On screen: Display menu: text size, readable font, high contrast; read aloud_

- **2:50.0 Falah:** Here’s the bigger picture: accessibility isn’t hidden in a settings page. Bigger text, a font designed for low vision, and high contrast change every screen instantly. And any page can be read aloud.

## 13. Privacy & data (3:06–3:16)

_On screen: Privacy settings, download / delete, nothing sensitive stored_

- **3:05.8 Hunter:** Riley decides who sees what, and can download or delete their data any time. Passwords, IDs and medical details are never stored.

## 14. How it is built (3:16–3:38)

_On screen: Architecture diagram, then test results_

- **3:16.6 Hunter:** Under the hood: React 19 and TypeScript, with every rule a pure, tested function. Live sync is our own Node server in Docker, and Supabase is ready for city scale.
- **3:30.3 Falah:** Every core workflow is tested end to end, with zero automated accessibility violations across 18 pages.

## 15. Close (3:38–3:47)

_On screen: Logo, closing line, team_

- **3:38.1 Falah:** Tandem doesn’t measure how many people follow you.
- **3:41.6 Hunter:** It helps you find people to go somewhere with.

## Sources for the numbers

- 23% of Canadians aged 15–24 always or often feel lonely (13% of all 15+): Statistics Canada, Canadian Social Survey (2021), <https://www150.statcan.gc.ca/n1/daily-quotidien/211124/dq211124e-eng.htm>
- 27% of Canadians aged 15+ (8.0 million) have a disability: Statistics Canada, Canadian Survey on Disability (2022), <https://www150.statcan.gc.ca/n1/daily-quotidien/231201/dq231201b-eng.htm>
- Calgary grew 5.6% in 2023, the most since the early 1980s: City of Calgary, Spring 2024 Population Outlook, <https://calgary.ca/content/dam/www/cfod/finance/documents/corporate-economics/calgary-and-region-economic-outlook/spring-2024-calgary-and-region-population-outlook-2024-2029.pdf>

_Generated by `node demo-video/script-tools.mjs` from `demo-video/submission-script.js`._
