import sys, os, json, shutil, tempfile, subprocess, time
from playwright.sync_api import sync_playwright
D='qa/evidence/T-1acfb3b4db/'
def setup():
    T=tempfile.mkdtemp()
    os.makedirs(T+'/A/sub'); os.makedirs(T+'/B')
    open(T+'/A/alpha.md','w').write('# Alpha\nhi'); open(T+'/B/beta.md','w').write('# Beta')
    return T
def serve(repo,T,port):
    env=dict(os.environ,PORT=str(port))
    return subprocess.Popen(['node',repo+'/server/server.js',T+'/A'],env=env,stdout=subprocess.DEVNULL)
mode=sys.argv[1]
if mode=='before':
    T=setup(); pr=serve(r'<temp dir>/wt_before',T,4618); time.sleep(1.5)
    with sync_playwright() as p:
        b=p.chromium.launch(); pg=b.new_page(viewport={'width':1200,'height':760})
        pg.goto('http://localhost:4618'); pg.wait_for_selector('.tree-item')
        pg.click('.tree-item:has-text("alpha")',button='right'); pg.wait_for_timeout(300)
        pg.screenshot(path=D+'00_before_task.png'); b.close()
    pr.kill(); sys.exit(0)
T=setup(); pr=serve('.',T,4617); time.sleep(1.5); U='http://localhost:4617'
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1200,'height':760})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:(errs.append('native dialog'),d.dismiss()))
    pg.goto(U); pg.wait_for_selector('.tree-item')
    pg.screenshot(path=D+'10_start.png')
    pg.click('#new-note'); pg.wait_for_selector('.tree-input'); pg.wait_for_timeout(300)
    assert os.path.exists(T+'/A/Untitled.md')
    assert pg.evaluate("document.activeElement.className")=='tree-input'
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.click('#new-note'); pg.wait_for_timeout(600)
    assert os.path.exists(T+'/A/Untitled 2.md'); pg.keyboard.press('Escape')
    pg.screenshot(path=D+'11_two_untitled.png')
    # new folder
    pg.click('#new-folder'); pg.wait_for_selector('.tree-input'); pg.keyboard.type('Fresh'); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    assert os.path.isdir(T+'/A/Fresh')
    t0=pg.get_attribute('#sort','title'); pg.click('#sort'); t1=pg.get_attribute('#sort','title'); print('sort',t0,'->',t1); assert t0!=t1
    # open alpha, rename via menu
    pg.click('.tree-item:has-text("alpha")'); pg.wait_for_timeout(500)
    pg.click('.tree-item:has-text("alpha")',button='right'); pg.wait_for_selector('.px-menu')
    pg.screenshot(path=D+'12_context_menu.png')
    pg.click('.px-menu-item:has-text("Rename")'); pg.wait_for_selector('.tree-input')
    pg.keyboard.press('Control+a'); pg.keyboard.type('gamma'); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
    assert os.path.exists(T+'/A/gamma.md') and not os.path.exists(T+'/A/alpha.md')
    tabs=pg.inner_text('body'); assert 'gamma' in pg.inner_text('.tabs, #tabs, [role=tablist]') , tabs[:300]
    pg.screenshot(path=D+'13_renamed_tab_updated.png')
    # move
    pg.click('.tree-item:has-text("gamma")',button='right'); pg.click('.px-menu-item:has-text("Move to")'); pg.wait_for_selector('.px-dialog')
    pg.click('.px-row:has-text("sub")'); pg.screenshot(path=D+'14_move_dialog.png'); pg.click('.px-btn.primary'); pg.wait_for_timeout(700)
    assert os.path.exists(T+'/A/sub/gamma.md')
    pg.click('.tree-item:has-text("sub")'); pg.wait_for_timeout(300); assert pg.query_selector('.tree-item:has-text("gamma")')
    # delete
    pg.click('.tree-item:has-text("gamma")',button='right'); pg.click('.px-menu-item:has-text("Delete")'); pg.wait_for_selector('.px-dialog')
    txt=pg.inner_text('.px-dialog-text'); print(txt); assert txt=='Delete "gamma"? This cannot be undone.' or txt.startswith('Delete "gamma')
    pg.screenshot(path=D+'15_delete_confirm.png')
    pg.click('.px-btn.danger'); pg.wait_for_timeout(700)
    assert not os.path.exists(T+'/A/sub/gamma.md')
    assert 'gamma' not in pg.inner_text('.tabs, #tabs, [role=tablist]')
    # escape menu
    pg.click('.tree-item:has-text("sub")',button='right'); pg.wait_for_selector('.px-menu'); pg.keyboard.press('Escape'); assert not pg.query_selector('.px-menu')
    # open folder
    pg.click('#open-folder'); pg.wait_for_selector('.px-dialog'); pg.wait_for_timeout(500)
    pg.screenshot(path=D+'16_picker.png')
    pg.fill('.px-input',T+'/B'); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    pg.click('.px-dialog-actions .primary'); pg.wait_for_timeout(900)
    assert pg.inner_text('#folder-name')=='B'; assert pg.query_selector('.tree-item:has-text("beta")')
    pg.screenshot(path=D+'99_after_task.png')
    pg.click('#folder-settings'); pg.wait_for_timeout(400); pg.screenshot(path=D+'17_settings.png')
    print('errs',errs); assert not errs
    json.dump({"00_before_task.png":"Before: right-click does nothing","10_start.png":"Folder A","11_two_untitled.png":"Untitled and Untitled 2 created","12_context_menu.png":"Context menu","13_renamed_tab_updated.png":"After rename, tab updated","14_move_dialog.png":"Move dialog","15_delete_confirm.png":"Delete confirm","16_picker.png":"Folder picker","99_after_task.png":"Opened folder B","17_settings.png":"Settings panel"},open(D+'captions.json','w'))
    b.close()
  print('OK')
finally:
  pr.kill()
