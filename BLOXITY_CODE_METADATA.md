---
# Read by the Boxity MCP audit and by reviewers (docs.bloxity.io > Build with the Boxity MCP).
clientDir: .
buildCommand: npm run build
distDir: dist
canDie: false
hasScore: true
rewards: true
badges: true
notApplicable:
  deathScreen: "Nobody can die in Run a Motel. Falling off the map just puts the player back at the motel at once (no loss, no countdown)."
  gems: "Nothing in the game is sold for Gems: every price is in-game money ($). No Gems purchases, Game Store or webhook."
  partyApi: "Hosted on Boxity and connected through the matchmaker (Legion.SDK.net.resolveEndpoint), so Boxity seats parties itself; party.enable/getLaunch are not used."
  playWithFriendsFeature: "Hosted on Boxity with the matchmaker, so CrazyGames Play with friends is automatic; registerFeature('play_with_friends') is for games making their own private rooms."
---

# Run a Motel: Boxity integration notes

- Leaderboard (declared in the browser, scores reported by the game server from the stored save):
  `earned` "Lifetime Earnings", desc, best, compact, weekly reset (with All Time).
- Rewarded ad: "2x CASH" in the Shop (placement `double-cash`), 5 minutes of 2x guest payments,
  granted only after the game server verifies the reward token.
- Screen ads: `panel` (the Upgrades / Hiring / Shop windows and the FURNISH editor) and
  `gameplay` (banners off unless Boxity turns them on).
- Game Ribbons (server-awarded from the stored save): welcome (common), first-guest (uncommon),
  full-house (rare), five-star (epic), millionaire (legendary); emoji icons.
- Profile stats: Cash, Total Earned, Rooms Open, Staff Hired, 5-Star Rooms.
- Rooms: 6 players (seatCap / maxClients 6), one motel plot each, 3 on each side of the main road.
- Remote players: drawn on their own plot with their Boxity look (the character kit dresses the rig
  from their outfit key; otherwise their equipped items, skin and proportions), name tag, the emote
  they play and their chat bubbles. Their motels are drawn from their saved progress.
