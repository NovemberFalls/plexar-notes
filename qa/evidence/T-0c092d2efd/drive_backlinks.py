import sys, json
from playwright.sync_api import sync_playwright
E_=sys.argv[1] if len(sys.argv)>1 else "http://localhost:4587"
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1200,"height":760})
    pg.goto(E_); pg.wait_for_selector("#statusbar")
    pg.wait_for_timeout(500)
    if E_.endswith("4588"):
        pg.screenshot(path="00_before_task.png"); b.close(); sys.exit(0)
    pg.get_by_text("Welcome", exact=True).first.click()
    pg.wait_for_function("document.querySelector('#status-backlinks').textContent.includes('4')")
    btn=pg.locator("#status-backlinks")
    assert btn.inner_text()=="Backlinks: 4", btn.inner_text()
    assert pg.locator("#backlinks").is_hidden()
    pg.screenshot(path="01_count_4_closed.png")
    btn.click()
    assert pg.locator("#backlinks").is_visible()
    assert "active" in btn.get_attribute("class")
    t=pg.locator("#backlinks").inner_text(); assert "Linked mentions" in t.title() or "LINKED" in t.upper()
    assert pg.locator(".backlink").count()==4
    assert pg.locator(".backlink-link").count()>=4
    pg.screenshot(path="99_after_task.png")
    pg.locator(".backlink-title").first.click()
    pg.wait_for_timeout(600)
    pg.screenshot(path="02_opened_source.png")
    print("after open:", btn.inner_text(), pg.locator("#note-title").inner_text())
    pg.keyboard.press("Escape")
    assert pg.locator("#backlinks").is_hidden() and "active" not in btn.get_attribute("class")
    btn.click(); btn.click(); assert pg.locator("#backlinks").is_hidden()
    # empty state: Welcome's source note likely has 0
    btn.click(); print("empty:", pg.locator("#backlinks").inner_text()); 
    assert "No notes link here yet" in pg.locator("#backlinks").inner_text() or btn.inner_text()!="Backlinks: 0"
    pg.screenshot(path="03_other_note_panel.png")
    b.close(); print("OK")
