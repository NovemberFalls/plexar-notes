import subprocess, time, os, json, urllib.request
from playwright.sync_api import sync_playwright
E='qa/evidence/T-f998b4030c/'; P=3918; U=f'http://localhost:{P}'
srv=subprocess.Popen(['node','server/server.js','C:/tmp/sn'],env={**os.environ,'PORT':str(P)}); time.sleep(1.5)
body="# Feat\n\n> [!warning] Careful\n> body text\n\n> [!tip]\n> a tip\n\n- [ ] one\n- [x] two\n\n[[Ghost Note]] and [[Welcome]] and [ext](https://example.com)\n\n![i](assets/x.png)\n\n<script>window.pwn=1</script><img src=x onerror=\"window.pwn=2\">\n\n## Sec Two\n\n[jump](#sec-two)\n\n```sql\nSELECT 1;\n```\n\n```html\n<div class=\"a\">x</div>\n```\n"
req=urllib.request.Request(U+'/api/file',data=json.dumps({'path':'Feat.md','content':body}).encode(),headers={'content-type':'application/json'},method='POST'); urllib.request.urlopen(req)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':1000}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(U); pg.wait_for_timeout(600)
    pg.get_by_text('Feat',exact=True).first.click(); pg.wait_for_timeout(600)
    pg.screenshot(path=E+'10_feat.png',full_page=True)
    assert pg.locator('.callout').count()==2
    assert pg.evaluate('window.pwn')is None
    assert pg.locator('[onerror]').count()==0
    assert pg.locator('#note-body script').count()==0
    print('img',pg.get_attribute('#note-body img','src'),'ext',pg.get_attribute('a[href^=https]','target'),pg.get_attribute('a[href^=https]','rel'),'h2 id',pg.get_attribute('#note-body h2','id'))
    assert pg.locator('#note-body h1').count()==0
    pg.locator('li.task input').nth(0).click(); pg.wait_for_timeout(500)
    c=json.load(urllib.request.urlopen(U+'/api/file?path=Feat.md'))['content']; assert '- [x] one' in c, c
    pg.locator('a.wikilink-missing').click(); pg.wait_for_timeout(300)
    print(pg.inner_text('#confirm-text')); pg.screenshot(path=E+'11_confirm.png')
    pg.click('#confirm-cancel'); assert not pg.locator('#confirm-bar').is_visible()
    pg.locator('a.wikilink-missing').click(); pg.click('#confirm-create'); pg.wait_for_timeout(900)
    print('title',pg.inner_text('#note-title')); assert os.path.exists('C:/tmp/sn/Ghost Note.md')
    pg.screenshot(path=E+'12_created.png')
    print('errs',errs); assert not errs; b.close()
finally: srv.terminate()
