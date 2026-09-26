import sys, subprocess, time, json
from playwright.sync_api import sync_playwright
E='qa/evidence/T-f998b4030c/'
P=3917
srv=subprocess.Popen(['node','server/server.js','/tmp/sn'],env={**__import__('os').environ,'PORT':str(P)})
time.sleep(1.5)
U=f'http://localhost:{P}'
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.context.grant_permissions(['clipboard-read','clipboard-write'])
    pg.goto(U); pg.wait_for_timeout(800)
    pg.screenshot(path=E+'01_empty.png')
    def open_(name):
      pg.get_by_text(name,exact=True).first.click(); pg.wait_for_timeout(600)
    for f in ['Reference','Projects']:
      pg.get_by_text(f,exact=True).first.click()
    open_('Code samples'); pg.screenshot(path=E+'02_code_samples.png',full_page=True)
    assert pg.locator('#note-body .codeblock').count()>=3
    assert pg.locator('#note-body .hljs-keyword').count()>0
    btn=pg.locator('.copy').first; pg.locator('.codeblock').first.hover(); btn.click()
    assert 'Copied' in btn.inner_text()
    pg.screenshot(path=E+'03_copied.png')
    open_('Plexar Notes'); pg.screenshot(path=E+'04_plexar_notes.png',full_page=True)
    print('callouts',pg.locator('.callout').count(),'tables',pg.locator('table').count(),'tasks',pg.locator('li.task').count(),'missing',pg.locator('.wikilink-missing').count(),'wl',pg.locator('a.wikilink[data-path]').count())
    cb=pg.locator('li.task input[type=checkbox]').first
    if cb.count():
      before=cb.is_checked(); cb.click(); pg.wait_for_timeout(500)
      r=pg.evaluate("fetch('/api/file?path='+encodeURIComponent('Projects/Plexar Notes.md')).then(r=>r.json())")
      print('toggled',before,'->',cb.is_checked())
    m=pg.locator('a.wikilink-missing')
    if m.count():
      m.first.click(); pg.wait_for_timeout(300)
      assert pg.locator('#confirm-bar').is_visible(); print(pg.inner_text('#confirm-text'))
      pg.screenshot(path=E+'05_confirm.png')
      pg.click('#confirm-create'); pg.wait_for_timeout(800)
      print('title after create',pg.inner_text('#note-title'))
      pg.screenshot(path=E+'06_created.png')
    w=pg.locator('a.wikilink[data-path]')
    if w.count():
      w.first.click(modifiers=['Control']); pg.wait_for_timeout(400)
      pg.screenshot(path=E+'07_ctrl_click.png')
    print('errs',errs)
    assert not errs
    b.close()
finally:
  srv.terminate()
