// Tunables for the Upgrades, Hiring and Shop windows (src/ui/*) and the motel economy
// (src/economy.js). Everything is bought with money ($): the game has no premium currency, so the
// shop items the reference priced in Robux carry a (slightly high) money price instead.

// --- Motel rules the windows need (the money loop itself is the game's, src/game/*) ------
// Starting money, room prices and room furniture live in config.js ECONOMY.
export const MOTEL = {
  roomsAtStart: [101], // the rest open at their doors (config ECONOMY.unlockRoom)
  floor2Rooms: [201, 202, 203, 204], // the 2nd floor upgrade opens these
  nextRooms: [205, 206, 207], // then Next Room opens one more each time
  deluxeStars: 5,
  // Food prices live in config.js FOOD; premiumBeans multiplies the coffee price.
  offlineMinutes: [0, 15, 30], // Gus the night porter's level -> minutes of offline income
  nightShiftMinutes: 60, // the Night Shift pass
  incomeWindow: 600, // s of recent earnings the offline income rate is averaged over
}

// --- Upgrades window: three tabs. `lock` = what has to happen first (economy.js isUnlocked). ----
// kind: 'once' (bought once), 'boost' (timed, stacks its time), 'repeat' (bought again and again).
export const UPGRADES = {
  coffee: {
    title: 'FOOD & COFFEE',
    tab: 'FOOD',
    items: [
      { id: 'hotdogStand', name: 'HOT DOG STAND', desc: 'Sell hot dogs: $12 · grill, bun, ketchup & mustard', price: 220, kind: 'once', art: 'hotdog' },
      { id: 'autoCoffee', name: 'AUTO CAFE', desc: 'The coffee machine makes coffee by itself', price: 380, kind: 'once', art: 'autoMachine' },
      { id: 'premiumBeans', name: 'PREMIUM BEANS', desc: 'Coffee x2 · $12 a cup', price: 450, kind: 'once', coffee: 2, art: 'barista' },
      { id: 'burgerGrill', name: 'BURGER GRILL', desc: 'Sell burgers: $20 · grill, stack, wrap', price: 700, kind: 'once', lock: { owns: 'hotdogStand' }, art: 'burger' },
      { id: 'autoHotdog', name: 'HOT DOG ROLLER', desc: 'Grills and builds hot dogs by itself', price: 900, kind: 'once', lock: { owns: 'hotdogStand' }, art: 'hotdog' },
      { id: 'autoBurger', name: 'BURGER ROBOT', desc: 'Grills, stacks and wraps burgers by itself', price: 1800, kind: 'once', lock: { owns: 'burgerGrill' }, art: 'burger' },
    ],
  },
  rooms: {
    title: 'ROOMS',
    tab: 'ROOMS',
    items: [
      { id: 'nextRoom', name: 'NEXT ROOM', desc: 'More rooms upstairs - fix up the 2nd floor', price: 3000, grow: 1.6, kind: 'repeat', lock: { owns: 'floor2' }, art: 'door' },
      { id: 'towelElephant', name: 'TOWEL ELEPHANT', desc: 'Fold 4-step towel animals · tips up to 20%', price: 400, kind: 'once', tips: 0.2, lock: { comfort: 1 }, art: 'towels' },
      { id: 'towelPeacock', name: 'TOWEL PEACOCK', desc: 'Fold 5-step towel birds · tips up to 30%', price: 1100, kind: 'once', tips: 0.3, lock: { owns: 'towelElephant' }, art: 'towels' },
      { id: 'floor2', name: '2ND FLOOR', desc: 'Fix up the stairs: 4 more rooms upstairs', price: 9000, kind: 'once', lock: { owns: 'pool' }, art: 'floor2' },
    ],
  },
  ads: {
    title: 'ADVERTISING',
    tab: 'ADS',
    items: [
      { id: 'flyers', name: 'FLYERS', desc: 'A bus every 15-20 s for 2 min', price: 40, kind: 'boost', seconds: 120, guestEvery: [15, 20], art: 'flyers' },
      { id: 'radio', name: 'RADIO AD', desc: 'A bus every 15-20 s for 4 min', price: 150, kind: 'boost', seconds: 240, guestEvery: [15, 20], art: 'radio' },
      { id: 'billboard', name: 'BILLBOARD', desc: 'A bus at least every 30 s - for ever', price: 1500, kind: 'once', guestMax: 30, lock: { comfort: 1 }, art: 'billboard' },
    ],
  },
}
export const UPGRADE_TABS = ['coffee', 'rooms', 'ads']

// Lock texts, as the reference words them.
export const LOCK_TEXT = {
  comfort: (n) => (n === 1 ? 'after 1 Comfort room' : `${n} COMFORT ROOMS`),
  rooms: (n) => `${n} ROOMS`,
  owns: {
    hotdogStand: 'after the Hot Dog Stand',
    burgerGrill: 'after the Burger Grill',
    towelElephant: 'after the towel elephant',
    floor2: 'after the 2nd floor',
    pool: 'after the POOL',
  },
  pool: 'THE POOL',
}

// --- Hiring window -----------------------------------------------------------------
// levels: speed upgrades after the hire (+speedStep each); `levelPrice[i]` buys level i+1.
export const STAFF = [
  { id: 'lou', name: 'LOU · LAUNDRY HAND', desc: 'Washes all the linen · faster: +20%', price: 600, levels: 5, levelPrice: [450, 700, 1000, 1400, 2000], art: 'lou' },
  { id: 'rose', name: 'ROSE · HOUSEKEEPER', desc: 'Cleans the rooms and makes the beds · faster: +20%', price: 600, levels: 5, levelPrice: [450, 700, 1000, 1400, 2000], small: true, art: 'rose' },
  { id: 'mia', name: 'MIA · FOOD AND ROOM SERVICE', desc: 'Answers the phone, makes the food and serves it · faster: +20%', price: 900, levels: 5, levelPrice: [500, 800, 1100, 1500, 2100], lock: { owns: 'hotdogStand' }, art: 'mia' },
  { id: 'sam', name: 'SAM · FRONT DESK', desc: 'Talks to guests, hands out keys and takes the money · faster: +20%', price: 1100, levels: 5, levelPrice: [500, 800, 1100, 1500, 2100], lock: { rooms: 3 }, tip: 0.1, art: 'sam' },
  { id: 'coby', name: 'COBY · POOL ATTENDANT', desc: 'Hands out towels, washes them and cleans the water', price: 2000, lock: { pool: true }, perGuest: 4, small: true, art: 'coby' },
  { id: 'jade', name: 'JADE · POOL BARTENDER', desc: 'Makes drinks at the pool bar next to you', price: 2500, lock: { pool: true }, perGuest: 8, art: 'jade' },
  // Gus starts on duty at level 1; one more level doubles his night.
  { id: 'gus', name: 'GUS · NIGHT PORTER', desc: "While you're away: up to 30 min of income", startLevel: 1, maxLevel: 2, levelPrice: [0, 1200], art: 'gus' },
]
export const SPEED_STEP = 0.2 // +20% per speed level

// --- NEXT card: the goal chain (economy.js nextGoal) ---------------------------------
export const POOL_PRICE = 3500

// --- Franchise (rebirth): sell the finished motel, start a new one that earns more for good. -----
// Ready once the run's last building upgrade is owned and the run earned enough; each level
// needs grow x more than the last (runs get longer) and makes heat (pacing.js) a bit higher.
export const FRANCHISE = {
  needs: 'floor2', // owned this run
  earn: 40000, // $ earned this run for level 1
  grow: 2.5, // x per level
  payPerLevel: 0.5, // every guest and every order pays x(1 + level x payPerLevel), for good
  startCash: 300, // + level x startCash on the new motel
  max: 25,
}

// --- Shop window --------------------------------------------------------------------
// Money prices replace the reference's Robux ones (fair, a little high). Sections:
//  forever  - owned for good
//  now      - used up (charges, timed boosts, one-off deals)
//  cash     - cash investments: pay now, collect a bigger sum when the timer ends
//  empire   - the Hotel Empire deal: a big cash investment + 4 forever gifts
export const SHOP = {
  forever: [
    { id: 'autoCash', name: 'AUTO CASH', desc: 'Cash on the counter flies to you', price: 1200, art: 'autoCash' },
    { id: 'cash50', name: '+50% CASH', desc: 'Every guest pays 1.5x', price: 2500, ribbon: 'BEST', pay: 1.5, art: 'cash50' },
    { id: 'cash2x', name: 'DOUBLE CASH', desc: 'Every guest pays 2x', price: 6000, pay: 2, art: 'cash2x' },
    { id: 'superVacuum', name: 'SUPER TOOLS', desc: 'Vacuum, mop, brush and scrub 3x faster', price: 3000, small: true, art: 'vacuum' },
    { id: 'fastRose', name: 'FAST ROSE', desc: 'Rose cleans 2x faster', price: 1800, art: 'fastRose' },
    { id: 'nightShift', name: 'NIGHT SHIFT', desc: "Up to 60 min of income while you're away", price: 1800, small: true, art: 'nightShift' },
    { id: 'laundryChute', name: 'LAUNDRY CHUTE', desc: 'Used sheets slide into the washer and come back clean by themselves · washes 1.6x faster', price: 400, art: 'chute' },
    { id: 'megaBag', name: 'MEGA BAG', desc: 'A huge trash bag', price: 600, art: 'megaBag' },
  ],
  now: [
    { id: 'starter', name: 'STARTER BUNDLE', desc: '$1,500 + golden lamp + dog bandana', price: 2000, ribbon: 'BEST DEAL', once: true, cash: 1500, cosmetics: ['goldenLamp', 'dogBandana'], small: true, art: 'starter' },
    { id: 'rushWash', name: 'RUSH WASH', desc: '5 instant loads', price: 90, charges: 5, art: 'rushWash' },
    { id: 'callBus', name: 'CALL THE BUS', desc: '3 tourists now', price: 150, tourists: 3, art: 'bus' },
    { id: 'magicBed', name: 'MAGIC BED', desc: 'Makes itself · 3 stars', price: 300, wide: true, art: 'magicBed' },
    { id: 'fastRun', name: 'FAST RUN', desc: 'Run 1.5x faster for 15 min', price: 180, seconds: 900, run: 1.5, wide: true, art: 'shoes' },
  ],
  cash: [
    { id: 'cashStack', name: 'CASH STACK', value: 350, price: 300, seconds: 120, art: 'cashStack' },
    { id: 'cashSuitcase', name: 'CASH SUITCASE', value: 1200, price: 1000, seconds: 300, ribbon: 'POPULAR', art: 'cashBag' },
    { id: 'cashVault', name: 'CASH VAULT', value: 3300, price: 2700, seconds: 600, art: 'vault' },
    { id: 'cashCrate', name: 'CASH CRATE', value: 10000, price: 8000, seconds: 1200, wide: true, art: 'crate' },
    { id: 'cashTruck', name: 'CASH TRUCK', value: 35000, price: 27000, seconds: 2700, ribbon: 'BIG', wide: true, art: 'truck' },
  ],
  empire: { id: 'empire', name: 'HOTEL EMPIRE', value: 150000, price: 155000, seconds: 3600, ribbon: 'MEGA', gifts: ['fastRose', 'superVacuum', 'magicBed', 'autoCash'], art: 'empire' },
}
// The rewarded-ad reward (Boxity Legion.SDK.ads.showRewarded, checked by the game server): a free
// timed boost, never sold. placement: Boxity's reporting name (lowercase, digits, hyphens).
export const AD_REWARD = { id: 'adCash2x', placement: 'double-cash', name: '2x CASH', desc: 'Watch an ad: every guest pays 2x for 5 min', seconds: 300, pay: 2, art: 'cash2x' }

export const SHOP_SECTIONS = [
  { key: 'forever', title: 'FOREVER' },
  { key: 'now', title: 'RIGHT NOW' },
  { key: 'cash', title: 'CASH' },
  { key: 'empire', title: 'HOTEL EMPIRE' },
]
