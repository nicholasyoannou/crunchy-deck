import { test, expect, type Page } from '@playwright/test'

// Simulate the browser Gamepad API, keeping the real animation loop, command routing,
// Svelte overlays and DOM focus navigation. No production input functions are mocked.
// Time runs on Playwright's paused fake clock, so the poller's frames and its millisecond
// repeat timers stay in step however slow the machine is.
async function button(page: Page, slot: number, index: number, pressed: boolean) {
  await page.evaluate(({ slot, index, pressed }) => {
    const p = (window as any).__pads[slot]
    p.buttons[index] = { pressed, touched: pressed, value: Number(pressed) }
  }, { slot, index, pressed })
}
async function frames(page: Page, count = 20) {
  await page.clock.runFor(count * 16)
}
async function commands(page: Page, command: string) {
  return page.evaluate((command) => (window as any).__logs.filter((s: string) => s.startsWith(`[cmd] ${command} @`)).length, command)
}

for (const activeSlot of [0, 1]) {
  test.describe(`active controller in slot ${activeSlot}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as any
        w.__logs = []
        w.cr = { log: (s: string) => w.__logs.push(s) }
        w.__pads = [
          { id: 'Sony DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: 0 },
          { id: 'Steam Deck Controller (STANDARD GAMEPAD Vendor: 28de Product: 1205)', index: 1 }
        ].map(p => ({ ...p, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) }))
        Object.defineProperty(navigator, 'getGamepads', { value: () => w.__pads })
      })
      await page.clock.install()
      await page.goto('/demo')
      // Generous timeout: on a cold Vite cache the first load re-optimizes deps and reloads.
      await expect(page.locator('#cw-0')).toBeFocused({ timeout: 30_000 })
      // The clock keeps running until paused; aim 1s ahead so a busy machine can't overshoot it.
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    })

    test('one D-pad press moves exactly one card, with release/repress working', async ({ page }) => {
      await button(page, activeSlot, 15, true)
      await frames(page, 40)
      await expect(page.locator('#cw-1')).toBeFocused()
      expect(await commands(page, 'right')).toBe(1)
      await button(page, activeSlot, 15, false)
      await frames(page, 2)
      await button(page, activeSlot, 15, true)
      await frames(page)
      await expect(page.locator('#cw-2')).toBeFocused()
      expect(await commands(page, 'right')).toBe(2)
    })

    test('holding confirm clicks once and holding menu opens once', async ({ page }) => {
      await page.locator('#cw-0').evaluate(el => {
        el.addEventListener('click', () => { (window as any).__clicks = ((window as any).__clicks ?? 0) + 1 })
      })
      await button(page, activeSlot, 0, true)
      await frames(page, 40)
      expect(await page.evaluate(() => (window as any).__clicks)).toBe(1)
      await button(page, activeSlot, 0, false)
      await button(page, activeSlot, 9, true)
      await frames(page, 40)
      await expect(page.getByRole('navigation')).toBeVisible()
      expect(await commands(page, 'menu')).toBe(1)
      await button(page, activeSlot, 9, false)
      await frames(page, 2)
      await button(page, activeSlot, 1, true)
      await frames(page, 40)
      await expect(page.getByRole('navigation')).toHaveCount(0)
      await expect(page).toHaveURL(/\/demo$/)
      expect(await commands(page, 'cancel')).toBe(1)
    })

    test('stick moves once before repeat delay and stops on release', async ({ page }) => {
      await page.evaluate(slot => { (window as any).__pads[slot].axes[0] = 0.8 }, activeSlot)
      await frames(page, 5)
      await expect(page.locator('#cw-1')).toBeFocused()
      expect(await commands(page, 'right')).toBe(1)
      await frames(page, 35)
      expect(await commands(page, 'right')).toBeGreaterThan(1)
      await page.evaluate(slot => { (window as any).__pads[slot].axes[0] = 0 }, activeSlot)
      await frames(page, 2)
      const count = await commands(page, 'right')
      await frames(page, 30)
      expect(await commands(page, 'right')).toBe(count)
    })
  })
}
