const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Catch console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.movie-card', { timeout: 10000 });
  
  // Click on a movie card to open details modal
  await page.click('.movie-card');
  
  // Wait for the details modal to open and the search trailer button to appear
  await page.waitForSelector('button', { timeout: 10000 });
  
  // Find the button that says "Искать трейлер" or similar
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('трейлер') || text.includes('Trailer') || text.includes('trailer')) {
      console.log('Clicking button:', text);
      await btn.click();
      break;
    }
  }
  
  // Wait a bit for the modal to crash
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
