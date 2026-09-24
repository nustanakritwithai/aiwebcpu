"""Browser regression against repository assets, not a live host or physical phone."""
from __future__ import annotations
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'browser-release-evidence'
OUTPUT.mkdir(exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
results = []
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width, height in [(1440, 1000), (390, 844)]:
            page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=2 if width == 390 else 1)
            page.set_default_timeout(10000)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin + '/') else route.abort())
            try:
                page.goto(origin + '/brain/?node=integration:pocketmonster-pirate-fruit', wait_until='networkidle')
                page.wait_for_selector('#detail .release-evidence')
                assert page.locator('#detail .release-evidence details').count() == 9
                assert 'Authenticated gameplay host' in page.locator('#detail').inner_text()
                assert 'UNKNOWN' in page.locator('#detail').inner_text()
                page.locator('#detail .release-evidence summary').first.click()
                assert page.locator('#detail .release-evidence details').first.get_attribute('open') is not None
                page.screenshot(path=str(OUTPUT / f'field-map-{width}.png'))
                page.evaluate("document.dispatchEvent(new CustomEvent('project-brain:select-node',{detail:{id:'repo:pocketmonster'}}))")
                page.wait_for_selector('#detail .cross-partner-button')
                assert page.locator('#detail .release-evidence').count() == 1
                page.locator('#detail .cross-partner-button').click()
                page.wait_for_function("document.querySelector('#detail .detail-id')?.textContent==='repo:pirate-fruit'")
                assert page.locator('#detail .release-evidence').count() == 1
                page.locator('#detail [data-detail-focus]').click()
                page.wait_for_function("document.body.classList.contains('ux-focus')")
                blur = page.locator('#detail-backdrop').evaluate('(el)=>getComputedStyle(el).backdropFilter')
                assert blur in ('none', ''), blur
                page.locator('#detail [data-detail-focus]').click()
                assert page.locator('#detail .detail-id').inner_text() == 'repo:pirate-fruit'
                assert not errors, errors
                results.append({'width': width, 'height': height, 'verdict': 'SAT', 'fieldGroups': 9, 'partnerNavigation': True, 'focusPreservesSelection': True, 'backdropFilter': blur, 'pageErrors': errors})
            except Exception:
                page.screenshot(path=str(OUTPUT / f'failure-{width}.png'))
                raise
            finally:
                page.close()
        browser.close()
finally:
    server.shutdown()
    (OUTPUT / 'report.json').write_text(json.dumps({'scope': 'Repository assets in CI Chromium. External API calls blocked; not physical Android or a live website test.', 'results': results}, indent=2), encoding='utf-8')
print(json.dumps(results))
