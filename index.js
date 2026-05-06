const express = require('express');
const puppeteer = require('puppeteer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  const { url, prompt, apiKey, authCode } = req.body;
  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    if (!authCode) {
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.type('input[type="email"]', 'pedro.rocha@uncover.co');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 3000));
      await browser.close();
      return res.status(200).json({ status: "aguardando_codigo" });
    }

    await page.waitForSelector('input', { timeout: 10000 });
    await page.type('input', authCode);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const content = await page.content();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`Analise: ${content.substring(0, 10000)}. Instrução: ${prompt}`);
    
    await browser.close();
    res.status(200).json({ status: "sucesso", analise: result.response.text() });

  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ status: "erro", detalhe: error.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor pronto na porta ${port}`);
});
