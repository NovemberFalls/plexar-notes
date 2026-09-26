import subprocess,os,time,tempfile,sys
from playwright.sync_api import sync_playwright
E="qa/evidence/T-ca1c0c0b69/"; P=4903
d=tempfile.mkdtemp(); os.makedirs(d+"/sub"); open(d+"/alpha.md","w").write("# Alpha\nhi"); open(d+"/sub/beta.md","w").write("# Beta")
srv=subprocess.Popen(["node","server/server.js",d],env={**os.environ,"PORT":str(P)}); time.sleep(1.5)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1200,"height":760})
    pg.goto(f"http://localhost:{P}/"); pg.wait_for_timeout(800)
    pg.click("text=sub"); pg.click("text=beta"); pg.wait_for_timeout(400)
    pg.click("#star-toggle"); pg.click("text=alpha"); pg.wait_for_timeout(300); pg.click("#star-toggle")
    pg.click('.ribbon-btn[data-panel=starred]'); pg.wait_for_timeout(200)
    assert pg.locator(".starred-item").count()==2
    assert pg.inner_text(".panel[data-panel=starred] .panel-title")=="Starred"
    c=pg.evaluate("getComputedStyle(document.querySelector('.starred-path')).color")
    print("path colour",c)
    pg.screenshot(path=E+"v1_starred_panel.png")
    pg.click(".starred-open >> nth=0"); pg.wait_for_timeout(300)
    pg.hover("#star-toggle"); pg.wait_for_timeout(800)
    tip=pg.evaluate("getComputedStyle(document.querySelector('#star-toggle'),'::after').content"); print("tip",tip); assert "nstar" in tip
    pg.screenshot(path=E+"v2_tooltip.png")
    pg.click("#folder-settings") if pg.is_visible("#folder-settings") else (pg.click('.ribbon-btn[data-panel=files]'),pg.click("#folder-settings"))
    assert pg.is_visible("#settings")
    pg.click('[data-setting=textSize] [data-value=large]')
    print(pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--text-scale')"))
    pg.click('[data-setting=lineWidth] [data-value=wide]')
    pg.click('label[for=setting-extensions]')
    pg.screenshot(path=E+"v3_settings.png")
    pg.keyboard.press("Escape"); assert not pg.is_visible("#settings")
    pg.reload(); pg.wait_for_timeout(800)
    assert pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--line-width')").strip()=="900px"
    assert pg.locator("#tree").inner_text().count(".md")>=1, pg.locator("#tree").inner_text()
    pg.screenshot(path=E+"v4_reload_ext.png")
    b.close()
finally: srv.terminate()
print("OK")
