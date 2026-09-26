import subprocess, sys, os, time, shutil, tempfile, json
from playwright.sync_api import sync_playwright
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.dirname(os.path.abspath(__file__))
def boot(repo, port, folder):
    p = subprocess.Popen(["node", "server/server.js", folder], cwd=repo, env={**os.environ, "PORT": str(port)}, stdout=subprocess.DEVNULL)
    time.sleep(1.5); return p
tmp = tempfile.mkdtemp()
notes = os.path.join(tmp, "notes"); shutil.copytree(os.path.join(REPO, "sample-notes"), notes)
before_dir = sys.argv[1] if len(sys.argv) > 1 else None
caps = {}
with sync_playwright() as pw:
    b = pw.chromium.launch()
    if before_dir:
        s = boot(before_dir, 3917, notes)
        pg = b.new_page(viewport={"width":1300,"height":800}); pg.goto("http://localhost:3917"); pg.wait_for_timeout(800)
        pg.click("#search"); pg.keyboard.type("table"); pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/00_before_task.png"); s.kill()
    s = boot(REPO, 3918, notes)
    try:
        pg = b.new_page(viewport={"width":1300,"height":800})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:3918"); pg.wait_for_timeout(800)
        pg.keyboard.press("Control+p")
        assert pg.get_attribute("#search","placeholder")=="Open file"
        pg.keyboard.type("table"); pg.wait_for_timeout(600)
        assert pg.is_visible("#search-results")
        assert pg.locator(".search-snippet").count()==0
        pg.screenshot(path=f"{OUT}/01_file_mode_table.png")
        pg.keyboard.press("Control+Shift+f")
        assert pg.get_attribute("#search","placeholder")=="Search in files"
        pg.wait_for_timeout(600)
        assert pg.locator(".search-snippet").count()>0
        assert pg.locator(".search-hit").count()>0
        pg.screenshot(path=f"{OUT}/02_text_mode_snippets.png")
        pg.keyboard.press("ArrowDown"); 
        assert pg.locator(".search-item.selected").count()==1
        pg.keyboard.press("Escape")
        assert not pg.is_visible("#search-results") and pg.input_value("#search")==""
        pg.click('.ribbon-btn[data-panel="search"]') if pg.locator('.ribbon-btn[data-panel="search"]').count() else None
        pg.click("#search"); pg.fill("#search","roadmap"); pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/03_roadmap.png")
        pg.keyboard.press("Enter"); pg.wait_for_timeout(1000)
        assert not pg.is_visible("#search-results")
        pg.screenshot(path=f"{OUT}/04_opened_roadmap.png")
        pg.click("#search"); pg.fill("#search","zzzqqq"); pg.wait_for_timeout(600)
        assert "No results" in pg.inner_text("#search-results")
        pg.screenshot(path=f"{OUT}/05_no_results.png")
        pg.mouse.click(600,500); pg.wait_for_timeout(200)
        assert not pg.is_visible("#search-results")
        pg.click("#search"); pg.wait_for_timeout(300)
        pg.fill("#search",""); pg.wait_for_timeout(300)
        assert not pg.is_visible("#search-results")
        # ribbon
        pg.click("#search"); pg.keyboard.press("Escape")
        btn = pg.locator('.ribbon-btn[data-panel="search"]'); assert btn.count()==1
        btn.click(); assert pg.evaluate("document.activeElement.id")=="search"
        pg.fill("#search","table"); pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/99_after_task.png")
        assert not errs, errs
        print("OK")
    finally: s.kill()
    b.close()
json.dump({"00_before_task.png":"Before: typing 'table' in the search box shows no dropdown","01_file_mode_table.png":"Ctrl+P: 'Open file' mode, titles only","02_text_mode_snippets.png":"Ctrl+Shift+F: 'Search in files', snippets with bold hits","03_roadmap.png":"'roadmap' results, first selected","04_opened_roadmap.png":"Enter opened the note, dropdown closed","05_no_results.png":"No results state","99_after_task.png":"Ribbon Search focused box; 'table' results"}, open(f"{OUT}/captions.json","w"))
