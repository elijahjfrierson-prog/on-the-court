import sys, asyncio
from playwright.async_api import async_playwright
async def main(url, out, wait=6000, w=1600, h=900):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/home/ubuntu/.local/bin/google-chrome', headless=True,
            args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
        pg = await b.new_page(viewport={'width': w, 'height': h})
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.goto(url); await pg.wait_for_timeout(wait)
        await pg.screenshot(path=out)
        for l in [x for x in logs if 'AudioContext' not in x][:40]: print(l)
        await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 6000))
