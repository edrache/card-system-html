import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT_DIR = Path("output/browser-smoke")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173/index.html")

BASE_DECK_ORDER = [
    "aggressor-6",
    "aggressor-4",
    "glass-cannon-5",
    "opportunist-3",
    "defender-6",
    "shield-4",
    "reactive-guard-3",
    "buffer-3",
    "fragile-buffer-2",
    "persistent-buffer-4",
]


def format_deck_count(count: int) -> str:
    return f"{count} {'card' if count == 1 else 'cards'}"


def drag_card_to_slot(page, card_index: int, slot_index: int) -> None:
    card = page.locator("#cards .card").nth(card_index)
    slot = page.locator("#slots .slot").nth(slot_index)

    card_box = card.bounding_box()
    slot_box = slot.bounding_box()

    assert card_box is not None, f"missing card bounding box for index {card_index}"
    assert slot_box is not None, f"missing slot bounding box for index {slot_index}"

    page.mouse.move(
        card_box["x"] + card_box["width"] / 2,
        card_box["y"] + card_box["height"] / 2,
    )
    page.mouse.down()
    page.mouse.move(
        slot_box["x"] + slot_box["width"] / 2,
        slot_box["y"] + slot_box["height"] / 2,
        steps=24,
    )
    page.mouse.up()
    page.wait_for_timeout(500)


def get_text_state(page) -> dict:
    return page.evaluate("JSON.parse(window.render_game_to_text())")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        args=["--use-gl=angle", "--use-angle=swiftshader"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 1024})
    page.add_init_script("Math.random = () => 0.2;")

    page_errors = []
    console_errors = []

    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on(
        "console",
        lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
    )

    page.goto(BASE_URL, wait_until="networkidle")

    assert page.locator("#cards .card").count() == 3
    assert page.locator("#enemy-cards .card").count() == 3
    assert page.locator(".column-fight-marker").count() == 3
    assert page.locator(".column-fight-marker__order").count() == 3
    assert page.locator("#btn-resolve").is_enabled() is False
    assert page.locator("#enemy-deck-button").count() == 1
    assert page.locator("#enemy-cemetery-button").count() == 1
    assert page.locator("#player-deck-button").count() == 1
    assert page.locator("#player-cemetery-button").count() == 1

    initial_state = get_text_state(page)
    assert initial_state["playerDeckCount"] == 7
    assert initial_state["playerCemeteryCount"] == 0
    assert initial_state["enemyDeckCount"] == 7
    assert initial_state["enemyCemeteryCount"] == 0
    assert [card["id"] for card in initial_state["playerDeck"]] != BASE_DECK_ORDER[:7]
    player_deck_count_text = page.locator("#player-deck-count").inner_text()
    enemy_deck_count_text = page.locator("#enemy-deck-count").inner_text()
    assert player_deck_count_text.lower() == format_deck_count(initial_state["playerDeckCount"]), player_deck_count_text
    assert enemy_deck_count_text.lower() == format_deck_count(initial_state["enemyDeckCount"]), enemy_deck_count_text

    page.locator("#player-deck-button").click()
    assert page.locator("#deck-overlay-title").inner_text() == "Player Deck"
    assert page.locator(".deck-list-item").count() == 7
    assert page.locator(".deck-list-item").nth(0).inner_text().startswith("#1")
    assert page.locator(".deck-overlay__list").evaluate(
        "el => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)"
    )
    page.locator("#deck-overlay-close").click()
    assert page.locator("#overlay.hidden").count() == 1

    page.locator("#enemy-deck-button").click()
    assert page.locator("#deck-overlay-title").inner_text() == "Opponent Deck"
    assert page.locator(".deck-list-item").count() == 7
    page.locator("#deck-overlay-close").click()
    assert page.locator("#overlay.hidden").count() == 1

    page.locator("#enemy-cemetery-button").click()
    assert page.locator("#deck-overlay-title").inner_text() == "Opponent Cemetery"
    assert page.locator(".deck-overlay__note").inner_text().startswith("Cards in the Cemetery are lost")
    assert page.locator(".deck-overlay__empty").inner_text() == "No enemy cards have been lost yet."
    page.locator("#deck-overlay-close").click()
    assert page.locator("#overlay.hidden").count() == 1

    page.locator("#player-cemetery-button").click()
    assert page.locator("#deck-overlay-title").inner_text() == "Player Cemetery"
    assert page.locator(".deck-overlay__note").inner_text().startswith("Cards in the Cemetery are lost")
    assert page.locator(".deck-overlay__empty").inner_text() == "No cards have been lost yet."
    page.locator("#deck-overlay-close").click()
    assert page.locator("#overlay.hidden").count() == 1

    enemy_card = page.locator("#enemy-cards .card").nth(0)
    enemy_card.hover()
    enemy_tooltip = enemy_card.locator(".card__tooltip")
    assert enemy_tooltip.count() == 1
    enemy_card_box = enemy_card.bounding_box()
    enemy_tooltip_box = enemy_tooltip.bounding_box()
    assert enemy_card_box is not None
    assert enemy_tooltip_box is not None
    assert enemy_tooltip_box["y"] > enemy_card_box["y"] + enemy_card_box["height"] - 2

    page.screenshot(path=str(OUTPUT_DIR / "before-placement.png"), full_page=True)

    drag_card_to_slot(page, 0, 0)
    assert page.locator("#cards .card").nth(0).get_attribute("data-slot-id") == "slot-0"
    assert page.locator("#cards .card").nth(0).locator(".card__preview").count() == 0
    assert page.locator("#cards .card").nth(0).locator(".card__stats").count() == 1
    assert page.locator("#cards .card").nth(0).locator(".card__attack").count() == 1
    assert page.locator("#cards .card").nth(0).locator(".card__hp").count() == 1
    assert page.locator("#cards .card").nth(0).locator(".card__combat-badge").count() == 1
    assert "ME" in page.locator("#cards .card").nth(0).locator(".card__combat-badge").inner_text()
    assert "EN" in page.locator("#cards .card").nth(0).locator(".card__combat-badge").inner_text()

    page.locator("#cards .card").nth(0).hover()
    assert page.locator("#cards .card").nth(0).locator(".card__tooltip").count() == 1
    assert "Base:" in page.locator("#cards .card").nth(0).locator(".card__tooltip").inner_text()
    assert "Current:" in page.locator("#cards .card").nth(0).locator(".card__tooltip").inner_text()
    assert "Your attack" in page.locator("#cards .card").nth(0).locator(".card__tooltip").inner_text()
    assert "Outcome:" in page.locator("#cards .card").nth(0).locator(".card__tooltip").inner_text()

    drag_card_to_slot(page, 1, 1)
    page.locator("#cards .card[data-slot-id='slot-1']").hover()
    assert "Combat:" in page.locator("#cards .card[data-slot-id='slot-1'] .card__tooltip").inner_text()
    drag_card_to_slot(page, 2, 2)

    assert page.locator("#btn-resolve").is_enabled() is True
    assert page_errors == []
    assert console_errors == []

    page.screenshot(path=str(OUTPUT_DIR / "after-placement.png"), full_page=True)

    page.locator("#btn-resolve").click()
    page.wait_for_function(
        """() => {
            const btn = document.querySelector('#btn-resolve');
            return btn && btn.textContent === 'Continue' && !btn.disabled;
        }""",
        timeout=3000,
    )

    assert page.locator("#round-counter").inner_text() == "Round 1"
    assert page.locator("#btn-resolve").inner_text() == "Continue"
    assert page.locator("#btn-resolve").is_enabled() is True
    assert page.locator(".card__resolution-note").count() == 2
    assert page.locator(".slot--resolving").count() == 2

    page.screenshot(path=str(OUTPUT_DIR / "after-first-fight.png"), full_page=True)

    page.locator("#btn-resolve").click()
    page.wait_for_function(
        """() => {
            const btn = document.querySelector('#btn-resolve');
            return btn && btn.textContent === 'Continue' && !btn.disabled;
        }""",
        timeout=3000,
    )

    assert page.locator("#round-counter").inner_text() == "Round 1"
    assert page.locator("#btn-resolve").inner_text() == "Continue"
    assert page.locator("#btn-resolve").is_enabled() is True

    page.locator("#btn-resolve").click()
    page.wait_for_function(
        """() => {
            const btn = document.querySelector('#btn-resolve');
            const round = document.querySelector('#round-counter');
            return btn && round && btn.textContent === 'Resolve' && btn.disabled && round.textContent === 'Round 2';
        }""",
        timeout=5000,
    )

    assert page.locator("#round-counter").inner_text() == "Round 2"
    assert page.locator("#btn-resolve").inner_text() == "Resolve"
    assert page.locator("#btn-resolve").is_enabled() is False
    assert page.locator("#cards .card").count() == 3
    assert page.locator("#enemy-cards .card").count() == 3
    assert page.locator("#cards .card[data-slot-id]").count() == 0
    assert page.locator(".card__resolution-note").count() == 0
    assert page.locator("#overlay.hidden").count() == 1
    final_state = get_text_state(page)
    assert final_state["round"] == 2
    assert final_state["playerDeckCount"] <= initial_state["playerDeckCount"]
    assert final_state["enemyDeckCount"] <= initial_state["enemyDeckCount"]
    assert page.locator("#player-deck-count").inner_text().lower() == format_deck_count(final_state["playerDeckCount"])
    assert page.locator("#enemy-deck-count").inner_text().lower() == format_deck_count(final_state["enemyDeckCount"])
    assert page_errors == []
    assert console_errors == []

    page.screenshot(path=str(OUTPUT_DIR / "after-resolve.png"), full_page=True)
    (OUTPUT_DIR / "state.json").write_text(
        json.dumps(
            {
                "round_counter": page.locator("#round-counter").inner_text(),
                "hand_cards": page.locator("#cards .card").count(),
                "enemy_cards": page.locator("#enemy-cards .card").count(),
                "slotted_cards": page.locator("#cards .card[data-slot-id]").count(),
                "resolve_enabled": page.locator("#btn-resolve").is_enabled(),
                "player_deck_count": final_state["playerDeckCount"],
                "enemy_deck_count": final_state["enemyDeckCount"],
                "page_errors": page_errors,
                "console_errors": console_errors,
            },
            indent=2,
        )
    )

    print("browser smoke ok")
    browser.close()
