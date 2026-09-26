import subprocess,os,time,sys
from playwright.sync_api import sync_playwright
E="qa/evidence/T-ca1c0c0b69/"
P=4871
srv=subprocess.Popen(["node","server/server.js",os.environ.get("NOTES","/tmp/nd")],env={**os.environ,"PORT":str(P)})
time.sleep(1.5)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1200,"height":760})
    pg.goto(f"http://localhost:{P}/"); pg.wait_for_timeout(800)
    pg.screenshot(path=E+"01_initial.png")
    pg.click("text=alpha"); pg.wait_for_timeout(500)
    pg.click("#star-toggle"); pg.wait_for_timeout(200)
    assert "starred" in pg.get_attribute("#star-toggle","class")
    pg.hover("#star-toggle"); pg.wait_for_timeout(700)
    pg.screenshot(path=E+"02_starred_tooltip.png")
    pg.click('.ribbon-btn[data-panel=starred]'); pg.wait_for_timeout(200)
    assert pg.locator(".starred-item").count()==1
    assert "active" in pg.get_attribute('.ribbon-btn[data-panel=starred]',"class")
    pg.screenshot(path=E+"03_starred_panel.png")
    pg.reload(); pg.wait_for_timeout(800)
    assert pg.locator("#star-toggle.starred").count()==1
    pg.click("#ribbon-settings"); pg.wait_for_timeout(200)
    assert pg.is_visible("#settings")
    pg.click('[data-setting=textSize] [data-value=large]')
    pg.click('[data-setting=lineWidth] [data-value=wide]')
    pg.click('[data-setting=font] [data-value=ui]')
    pg.click('[data-setting=autosave] [data-value="2000"]')
    pg.click('label[for=setting-extensions]')
    r=pg.evaluate("[getComputedStyle(document.documentElement).getPropertyValue('--text-scale'),getComputedStyle(document.documentElement).getPropertyValue('--line-width')]")
    print(r); assert r[1].strip()=="900px"
    pg.screenshot(path=E+"04_settings_open.png")
    pg.keyboard.press("Escape"); assert not pg.is_visible("#settings")
    pg.click(".ribbon-btn[data-panel=files]"); pg.click("#folder-settings"); assert pg.is_visible("#settings")
    pg.click("#settings-close"); assert not pg.is_visible("#settings")
    pg.click('.ribbon-btn[data-panel=files]'); pg.wait_for_timeout(200)
    assert pg.locator(".tree-row, #tree *").filter(has_text="alpha.md").count()>0
    pg.reload(); pg.wait_for_timeout(800)
    pg.click("#ribbon-settings")
    assert pg.get_attribute('[data-setting=lineWidth] [data-value=wide]',"aria-checked")=="true"
    pg.screenshot(path=E+"05_after_reload_persisted.png")
    pg.keyboard.press("Escape")
    pg.click('.ribbon-btn[data-panel=starred]'); pg.click(".starred-remove",force=True)
    assert pg.locator(".starred-item").count()==0
    pg.screenshot(path=E+"99_after_task.png")
    b.close()
finally: srv.terminate()
