import subprocess, shutil, tempfile, time, os, json, urllib.request
from playwright.sync_api import sync_playwright
R=os.path.abspath(os.path.join(os.path.dirname(__file__),"..","..",".."))
E=os.path.dirname(os.path.abspath(__file__))
tmp=tempfile.mkdtemp(); notes=os.path.join(tmp,"n"); shutil.copytree(os.path.join(R,"sample-notes"),notes)
env=dict(os.environ,PORT="3457")
p=subprocess.Popen(["node","server/server.js",notes],cwd=R,env=env)
time.sleep(1.5)
U="http://localhost:3457"
def shot(pg,n): pg.screenshot(path=f"{E}/{n}.png")
try:
  with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={"width":1200,"height":800})
    pg.goto(U); pg.wait_for_selector("#tree *"); 
    pg.click("text=Welcome"); pg.wait_for_selector("#note-body:not([hidden])")
    shot(pg,"00_reading"); 
    assert pg.get_attribute("#mode-toggle","title")=="Read"
    pg.keyboard.press("Control+e"); pg.wait_for_selector("#note-editor:not([hidden])")
    assert pg.get_attribute("#mode-toggle","title")=="Edit"
    pg.click("#note-editor"); pg.keyboard.press("Control+End"); pg.keyboard.press("Tab"); pg.keyboard.type("zzz typed")
    assert pg.input_value("#note-editor").endswith("  zzz typed")
    assert "Unsaved" in pg.inner_text("#status-saved")
    shot(pg,"01_editing_unsaved")
    pg.wait_for_function("document.querySelector('#status-saved').innerText.includes('Saved')",timeout=5000)
    words=pg.inner_text("#status-words"); print(words); assert words.startswith("Words: ")
    c=json.load(urllib.request.urlopen(U+"/api/file?path=Welcome.md"))["content"]; assert c.endswith("  zzz typed"),c[-30:]
    shot(pg,"02_saved")
    pg.keyboard.type("Q"); pg.keyboard.press("Control+s"); pg.wait_for_function("document.querySelector('#status-saved').innerText.includes('Saved')")
    assert json.load(urllib.request.urlopen(U+"/api/file?path=Welcome.md"))["content"].endswith("zzz typedQ")
    pg.keyboard.press("Control+e"); pg.wait_for_selector("#note-body:not([hidden])"); assert "zzz typedQ" in pg.inner_text("#note-body")
    shot(pg,"03_back_to_reading")
    pg.reload(); pg.wait_for_selector("#note-body,#note-editor")
    shot(pg,"04_reload")
    pg.keyboard.press("Control+t") if False else None
    pg.click("[aria-label*='New tab'], .tab-new, #new-tab") 
    pg.wait_for_selector("#new-note-name:visible"); shot(pg,"05_new_prompt")
    pg.fill("#new-note-name","Brand New"); pg.keyboard.press("Enter")
    pg.wait_for_selector("#note-editor:not([hidden])")
    assert os.path.exists(os.path.join(notes,"Brand New.md"))
    shot(pg,"99_after_task")
    b.close()
  print("OK")
finally:
  p.terminate(); shutil.rmtree(tmp,ignore_errors=True)
