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
| getAdjacentAllies() w combat.js | 🔲 |
| activateSupportOnPlacement() | 🔲 |
| activateSupportPostCombat() | 🔲 |
| Edge case: Fragile Buffer (buffAmount: 2) | 🔲 |
| Edge case: Persistent Buffer (ghostBuffer po śmierci) | 🔲 |

---

## Blok G — Persystencja HP (Faza 5) 🔲

| Zadanie | Status |
|---|---|
| card.hp nie resetuje się między rundami | ✅ (game.js nie resetuje hp — karty mutowane in-place) |
| Death check — usunięcie martwych kart z board + DOM | ✅ (resolveRound w game.js) |
| Przeżyłe karty wracają do ręki gracza | ✅ (resolveRound w game.js) |
| Re-render kart z aktualnym HP | 🔲 (renderHand re-renderuje karty, ale HP label nie jest aktualizowany po walce) |

---

## Blok H — UX czytelność (Faza 6) 🔲

| Zadanie | Status |
|---|---|
| Combat preview na placement (projected damage overlay) | ✅ zrobione poza kolejnością (patrz sekcja Visual polish) |
| Kolorowanie slotów wg RPS: zielony/żółty/czerwony | 🔲 (CSS klasy już istnieją: `.slot--advantage`, `.slot--neutral`, `.slot--disadvantage`) |
| Numeracja kolejności rozstrzygania na kartach wroga | 🔲 |

---

## Blok I — Struktura runu (Faza 7) 🔲

| Zadanie | Status |
|---|---|
| Reward screen (wybór 1 z 3 kart) | 🔲 |
| Ekran przegranej z Restart | ✅ (loss overlay z btn-restart w main.js) |
| game.js resetRun() | ✅ (resetRun zaimplementowany, używa location.reload()) |
