# Game Prototype — Implementation Progress

Branch: `feature/game-RPS`  
Plan source: `docs/prototype-implementation-plan.md`

---

## Blok A — Czysta logika ✅

**Cel:** Czyste funkcje testowalne w konsoli, bez DOM.

| Plik | Status | Uwagi |
|---|---|---|
| `config/game.config.js` | ✅ done | Wszystkie stałe gry (RPS_MODIFIER, ATTACK_BONUS, itp.) |
| `js/cards-data.js` | ✅ done | 10 kart prototypu z pełną definicją (id, rps, value, role, effect, hp, buffs) |
| `js/combat.js` | ✅ done | getRpsResult, calcDamage, applyDamage, resolvePair — czyste funkcje |

**Decyzje:**
- Kart jest 10 (nie 9 jak błędnie podano w planie) — pełna lista w `cards-data.js`
- `calcDamage` uwzględnia: RPS modifier, role attack/defense, efekty kart (Opportunist, Shield, Reactive Guard, Glass Cannon)
- Damage minimum = 0 (nie ma leczenia przez combat)

---

## Blok B — DOM i layout ✅

**Cel:** Nowa struktura HTML i layout wizualny zweryfikowany w przeglądarce przed logiką gry.

| Plik | Status | Uwagi |
|---|---|---|
| `index.html` | ✅ done | Nowa struktura: #enemy-board, #player-board, #hud, #overlay |
| `config/layout.config.js` | ✅ done | Usunięto hardcoded x/y, dodano cardGap + enemySlotRowY/playerSlotRowY |
| `css/style.css` | ✅ done | Nowe style: enemy-slot, #hud, #btn-resolve, #overlay, RPS slot highlights |
| `js/main.js` | ✅ done (częściowo) | calcSlotRow() — dynamiczne centrowanie slotów na viewport |
| `js/interactions.js` | ✅ done (patch) | findNearestFreeSlot filtruje `.enemy-slot` — gracz nie może snapować do wrogich slotów |

**Decyzje:**
- Kontenery `#enemy-board` / `#player-board` mają `inset: 0` — są grupami z-index, nie dzielą ekranu 50/50
- Pozycje slotów obliczane dynamicznie w `main.js` z `window.innerWidth` / `window.innerHeight`
- Enemy slots: `enemySlotRowY: 0.12` (~12% od góry)
- Player slots: `playerSlotRowY: 0.44` (~44% od góry)
- Ręka gracza: `window.innerHeight - CARD.height - 50`

---

## Blok C — Game state + enemy ✅

**Cel:** Logika stanu gry i talii przeciwnika.

| Plik | Status | Uwagi |
|---|---|---|
| `js/enemy.js` | ✅ done | shuffleDeck (Fisher-Yates), createEnemyDeck, enemyRefillBoard |
| `js/game.js` | ✅ done | gameState, initRun, drawCards, placeCard, unplaceCard, canResolve, resolveRound |

**Decyzje:**
- `placeCard()` sprawdza first-card bonus przy ustawieniu — jeśli cofniesz kartę, bonus jest zerowany
- `resolveRound()` po śmierci: żyjące karty gracza wracają do ręki, enemy refilluje board
- Warunek końca: brak kart gracza = loss, brak kart wroga = win
- Wyniki rundy logowane do `console.log` (UI zostanie dodane w Bloku D)

---

## Blok D — Wiring ✅

**Cel:** Połączenie logiki gry z DOM.

| Plik | Status | Uwagi |
|---|---|---|
| `js/interactions.js` | ✅ done | Dodano callbacks: onSnap(slotEl, cardEl) i onUnsnap(slotEl, cardEl) do initDrag() |
| `js/main.js` | ✅ done | Podłączono game.js — initRun, drawCards, placeCard, resolveRound; renderHand, renderEnemyBoard |
| `js/ui.js` | ✅ done | syncResolveButton, updateRoundCounter, setCardHpLabel, showOverlay, logRoundResult |

**Decyzje:**
- `onSnap` → `placeCard()`, `onUnsnap` → `unplaceCard()` — game state i DOM zawsze zsynchronizowane
- Enemy cards renderowane bez drag (cursor: default, bez initDrag)
- Na tym etapie wyniki rundy widoczne w `console.log`
- Win/loss pokazuje overlay; loss → reload strony (pełny restart)

**Checkpoint:** ✅ Gra startuje, karty draggowalne, Resolve aktywny gdy 3 sloty zajęte, wyniki w konsoli

---

## Poza planem — Visual polish ✅

Zmiany wizualne wykonane na żądanie, poza oryginalną kolejnością bloków.

### Nowy wygląd kart
| Plik | Zmiana |
|---|---|
| `index.html` | Nowe fonty: Bricolage Grotesque + Barlow Condensed |
| `js/cards-data.js` | Dodano `effectText` do każdej z 10 kart |
| `js/main.js` | Przepisano `createCardEl` — nowy layout: name top, RPS icon center, effect bottom |
| `css/style.css` | Nowe klasy: `.card__top`, `.card__name`, `.card__role`, `.card__mid`, `.card__rps-icon`, `.card__bot`, `.card__effect`, `.card__hp` |

**Fonty:**
- `Bricolage Grotesque` 700 — nazwa karty (top)
- `Barlow Condensed` italic — opis efektu (bottom), role tag, preview overlay
- `IM Fell English SC` — HUD, round counter, rules panel

### Enemy card red tint
- `.card--enemy` — tło `oklch(91% 0.025 15)` (lekki różowo-kremowy odcień)
- Nazwa i HP w cieplejszym czerwonawym kolorze
- Przekazywane przez `createCardEl(card, isEnemy = true)`

### Placement preview overlay
Pojawia się na karcie gracza po snapnięciu do slotu (znika po podniesieniu):
- `↑ WIN` / `= TIE` / `↓ LOSE` — wynik RPS (zielony / złoty / czerwony)
- `+X buff` — bonus za pierwszą kartę (jeśli dotyczy)
- `11 ↔ 5` — damage dealt ↔ damage taken
- `♥ 6 → 1` — HP po walce (zielony = przeżyje, czerwony = zginie)

**Implementacja:** `showPlacementPreview(cardEl, playerCard, slotIndex)` i `clearPlacementPreview(cardEl)` w `main.js`. Używa `calcDamage` read-only z aktualnym stanem kart (po aplikacji first-card bonus).

### Column Y reordering
Kolumny (para: enemy slot + player slot) sortowane wg siły przeciwnika każdą rundę:
- Najsilniejszy enemy → najwyżej na ekranie (y offset ujemny)
- Najsłabszy / pusty slot → najniżej (y offset dodatni)
- Remis = ta sama pozycja Y
- Animowane przez GSAP (`power2.inOut`, 0.65s)
- Spread: ±55px od pozycji bazowej (max 110px między kolumnami)

**Implementacja:** `reorderColumns()` w `main.js`. Wywoływane po `initRun()` i po każdym `resolveRound()`. Śledzi `playerSlotEls[]`, `enemySlotEls[]`, `enemyCardEls[]` jako tablice refs indeksowane numerem slotu.

**Formuła rankingu:** dense rank wg siły (value + buffs), puste sloty zawsze ostatnie. Offset = `(rank / maxRank) * 2 * SPREAD - SPREAD`.

### Rules panel
`<aside id="rules-panel">` — stały panel po lewej stronie planszy (160px szerokości):
- Sekcje: Flow, Combat, First Card, Column Order, RPS
- Font: `IM Fell English SC` (tytuły) + `Barlow Condensed` (tekst)
- Kolor: subtelny, dopasowany do planszy (`oklch(70% 0.03 265 / 0.45)`)
- `pointer-events: none` — nie blokuje gry

---

## Blok E — Pętla gracza (Faza 2) 🔲

| Zadanie | Status |
|---|---|
| drawCards() — dobieranie kart do ręki | ✅ (zaimplementowane w game.js w Bloku C) |
| Hand rendering (createCardEl z game cards) | ✅ (zaimplementowane w main.js w Bloku D) |
| Placement confirmation (gameState.playerBoard[slotIndex] = card) | ✅ (zaimplementowane w game.js w Bloku C) |
| Tracking placementOrder (first-card bonus) | ✅ (zaimplementowane w game.js w Bloku C) |
| applyPlacementBonus() | ✅ (zaimplementowane w game.js w Bloku C) |
| Resolve button aktywny gdy wszystkie sloty zajęte | ✅ (syncResolveButton w ui.js) |

> Blok E faktycznie zrealizowany w trakcie Bloków C i D. Gra jest grywalna end-to-end.

**Checkpoint:** ✅ Gra grywalny od początku do końca jednego starcia

---

## Blok F — System wsparcia i buffów (Faza 4) 🔲

| Zadanie | Status |
|---|---|
| getAdjacentAllies() w combat.js | ✅ |
| activateSupportOnPlacement() | ✅ |
| activateSupportPostCombat() | ✅ |
| Edge case: Fragile Buffer (buffAmount: 2) | ✅ |
| Edge case: Persistent Buffer (ghostBuffer po śmierci) | 🔲 |

---

## Blok G — Persystencja HP (Faza 5) 🔲

| Zadanie | Status |
|---|---|
| card.hp nie resetuje się między rundami | ✅ (game.js nie resetuje hp — karty mutowane in-place) |
| Death check — usunięcie martwych kart z board + DOM | ✅ (resolveRound w game.js) |
| Przeżyłe karty wracają do ręki gracza | ✅ (resolveRound w game.js) |
| Re-render kart z aktualnym HP | ✅ (po resolve hand i board renderują jawne `ATK/HP`) |

---

## Blok H — UX czytelność (Faza 6) 🔲

| Zadanie | Status |
|---|---|
| Combat preview na placement (projected damage overlay) | ✅ (zamiast starego overlayu: badge na karcie + pełny hover breakdown) |
| Kolorowanie slotów wg RPS: zielony/żółty/czerwony | 🔲 (CSS klasy już istnieją: `.slot--advantage`, `.slot--neutral`, `.slot--disadvantage`) |
| Numeracja kolejności rozstrzygania na kartach wroga | ✅ (marker `⚔️` + `1st/2nd/3rd`, spięte z kolejnością resolve) |
| Jawne pochodzenie modyfikatorów na kartach | ✅ |

---

## Blok I — Struktura runu (Faza 7) 🔲

| Zadanie | Status |
|---|---|
| Reward screen (wybór 1 z 3 kart) | 🔲 |
| Ekran przegranej z Restart | ✅ (loss overlay z btn-restart w main.js) |
| game.js resetRun() | ✅ (resetRun zaimplementowany, używa location.reload()) |

---

## 2026-04-05 Verification + bugfix

- Fixed a real drag-and-drop regression in `js/interactions.js`: `snapCardToSlot()` called `callbacks.onSnap` without receiving `callbacks`, which caused `ReferenceError: callbacks is not defined` after placing a card.
- Added `tests/game-logic-smoke.mjs` for fast module-level verification of combat, placement bonus, draw flow, round resolution, and win state.
- Added `tests/rps_browser_smoke.py` for Playwright browser smoke coverage of the live prototype: load page, drag 3 cards into slots, assert no page/runtime errors, and confirm `Resolve` becomes enabled.
- Extended `tests/rps_browser_smoke.py` to click `Resolve` and verify post-combat rerender (`Round 2`, new hand, refreshed enemy board, no slotted cards left, no runtime errors).
- Browser smoke passed with artifacts written to `output/browser-smoke/`:
  - `after-placement.png`
  - `after-resolve.png`
  - `state.json` (`slotted_cards: 3`, `resolve_enabled: true`, no console/page errors)

---

## 2026-04-05 Buff provenance + support readability

- Added runtime `buffSources` tracking in `js/buffs.js` so card modifiers are no longer opaque integer mutations; each buff now carries `amount`, `label`, `description`, and `scope`.
- Reworked `game.js` to recalculate temporary placement buffs deterministically after each place/unplace/refill:
  - first-card bonus is now temporary and no longer leaks permanently into later rounds
  - support cards now buff adjacent allies on placement
  - surviving support cards now grant persistent post-combat buffs to adjacent survivors
  - Fragile Buffer now uses `effect.buffAmount` for its stronger adjacency buff
- Added visible value badges to cards in `main.js` / `css/style.css`:
  - base value + active buffs shown as the current value
  - modified values get a highlighted circular badge and `+N` delta chip
  - hover tooltip lists base value, every active modifier source, buff-cap reduction (if any), and current HP
- Browser smoke extended to assert the new value badge + tooltip DOM is present after card placement.
- Module smoke extended to verify:
  - support adjacency buffs are applied
  - first-card bonus is cleared after round resolution
  - post-combat support buffs persist onto surviving cards

**Open follow-up:** `Persistent Buffer` ghost behavior (`persistBuffTurns`) is still not implemented; current provenance system is ready for it, but the death-phase board retention logic still needs to be added.

---

## 2026-04-05 Combat preview UX pass

- Removed the old on-card `card__preview` combat overlay from placement; it obscured the card face too much.
- Added a compact persistent combat badge on slotted player cards (`WIN` / `LOSE` / `TRADE` / `CLASH`) so the expected fight result is visible without hover.
- Moved the detailed fight preview into the hover tooltip:
  - player attack breakdown
  - player defense / reduction breakdown
  - enemy attack breakdown
  - HP change for both sides after the projected combat
- Added `getDamageBreakdown()` in `js/combat.js` as the shared source for tooltip combat explanations and future combat-debug UX.

---

## 2026-04-05 Slow resolve flow

- Reworked round resolution into a staged flow in `js/game.js`:
  - `prepareResolveRound()` locks the board and captures fight order
  - `resolveCombatStep(slotIndex)` resolves exactly one pair
  - `finalizeResolveRound()` applies cleanup / return-to-hand / enemy refill
  - `resolveRound()` still exists as a compatibility wrapper for logic tests
- Rebuilt `Resolve` UX in `js/main.js`:
  - first click starts combat and immediately resolves only the first fight
  - the same button becomes `Continue` for the next fight
  - already-resolved slots stop showing projected combat badges
  - player hand is interaction-locked during the staged combat flow
- Added step-readability feedback in `css/style.css` + `js/main.js`:
  - active slot pair gets a dedicated resolve highlight
  - each resolved card shows a short note (`Stays` / `Destroyed`, HP delta, dealt damage)
  - destroyed cards tilt to `30deg` and stay visibly "broken" until cleanup
- Added end-of-round transition animation:
  - surviving player cards animate from board back into the hand
  - newly drawn player cards animate in from the bottom-center draw origin
  - newly spawned enemy cards animate in from the top-center draw origin
  - column reordering still runs after the cleanup animation settles
- Extended browser smoke coverage in `tests/rps_browser_smoke.py`:
  - asserts `Resolve -> Continue`
  - verifies first-fight UI state before cleanup
  - clicks through all three fights and confirms only then the game advances to `Round 2`
- New visual smoke artifact:
  - `output/browser-smoke/after-first-fight.png`

**Verified on 2026-04-05**
- `node tests/game-logic-smoke.mjs`
- `python3 tests/rps_browser_smoke.py`

**Potential follow-up**
- The per-fight note currently overlaps the lower part of the card art by design. If we want a more minimal combat readout later, this is the first place to simplify.

## 2026-04-05 Documentation sync

- Updated `README.md` so the public repo description now matches the staged combat flow shipped in this branch.
- `Current Prototype` now explicitly describes `Resolve -> Continue -> cleanup`.
- README test notes now mention the first-fight staged UI and new visual artifact `after-first-fight.png`.
- README open work now includes the possible follow-up to reduce the visual weight of the per-fight result note.

---

## 2026-04-05 ATK / HP split branch

- Created branch `feature/rps-atk-hp-split` for the stat-clarity pass.
- Card face now shows explicit `ATK/HP` instead of a single ambiguous number:
  - first number = current attack value used for damage calculation
  - second number = current HP used for survival
- Hover tooltip text updated from generic `Value` wording to explicit `Base ATK` / `Current HP`.
- Tooltip footer now explicitly states that attack buffs do not increase HP.

---

## 2026-04-05 ATK / HP notation polish + board spacing

- Unified effect text, tooltip copy, and rules panel around the `ATK/HP` delta notation:
  - attack bonuses shown as `+X/+0`
  - incoming HP loss shown as `+0/-Y`
  - block kept as separate wording instead of forcing it into fake HP text
- Replaced the old `WIN / LOSE / TRADE / CLASH` on-card marker with concrete per-side result text:
  - `ME +0/-X`
  - `EN +0/-Y`
- Improved tooltip formatting:
  - section labels are underlined
  - stat changes render inside thin 1px framed chips
- Moved enemy and player rows closer together in `config/layout.config.js`.
- Added per-column fight markers between rows:
  - `⚔️`
  - resolve order label (`1st`, `2nd`, `3rd`)
  - order is now sourced from the same ranking used by `resolveRound()`
- Lowered fight markers below enemy cards and their tooltips in z-order.
- Enemy card tooltips now open below the enemy card; player card tooltips remain above the player card.
- Raised hovered cards above other cards so enemy tooltips are no longer obscured by player cards.

**Current readability state:**
- Card face: quick `ATK/HP`
- Slotted card badge: immediate projected HP deltas for both sides
- Hover: full provenance + combat breakdown
- Column center: fight marker + true resolve order
