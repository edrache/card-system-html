import json
from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT_DIR = Path("output/browser-smoke")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


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


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        args=["--use-gl=angle", "--use-angle=swiftshader"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 1024})

    page_errors = []
    console_errors = []

    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on(
        "console",
        lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
    )

    page.goto("http://127.0.0.1:4173/index.html", wait_until="networkidle")

    assert page.locator("#cards .card").count() == 3
    assert page.locator("#enemy-cards .card").count() == 3
    assert page.locator(".column-fight-marker").count() == 3
    assert page.locator(".column-fight-marker__order").count() == 3
    assert page.locator("#btn-resolve").is_enabled() is False

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
    drag_card_to_slot(page, 2, 2)

    assert page.locator("#btn-resolve").is_enabled() is True
    assert page_errors == []
    assert console_errors == []

    page.screenshot(path=str(OUTPUT_DIR / "after-placement.png"), full_page=True)

    page.locator("#btn-resolve").click()
    page.wait_for_timeout(1000)

    assert page.locator("#round-counter").inner_text() == "Round 2"
    assert page.locator("#btn-resolve").is_enabled() is False
    assert page.locator("#cards .card").count() == 3
    assert page.locator("#enemy-cards .card").count() == 3
    assert page.locator("#cards .card[data-slot-id]").count() == 0
    assert page.locator("#overlay.hidden").count() == 1
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
                "page_errors": page_errors,
                "console_errors": console_errors,
            },
            indent=2,
        )
    )

    print("browser smoke ok")
    browser.close()
