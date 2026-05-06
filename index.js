// index.js corrigido com lições do projeto Slides
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  const { url, prompt, apiKey, authCode } = req.body;
  let browser;

  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Fase 1: Login
    if (!authCode) {
      await page.waitForSelector('input[type="email"]');
      await page.type('input[type="email"]', 'pedro.rocha@uncover.co');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 5000));
      await browser.close();
      return res.json({ status: "aguardando_codigo" });
    }

    // Fase 2: Autenticação e Visão
    await page.waitForSelector('input');
    await page.type('input', authCode);
    await page.keyboard.press('Enter');
    
    // Tempo para o dashboard carregar (lição do timeout)
    await new Promise(r => setTimeout(r, 20000)); 

    const screenshot = await page.screenshot({ encoding: 'base64' });
    await browser.close();

    const genAI = new GoogleGenerativeAI(apiKey);
    // Usando o modelo Flash que provou ser mais estável no seu projeto de Slides
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: "image/png", data: screenshot } }
    ]);

    res.json({ status: "sucesso", analise: result.response.text() });

  } catch (error) {
    if (browser) await browser.close();
    res.json({ status: "erro", detalhe: error.message });
  }
});

app.listen(process.env.PORT || 8080, '0.0.0.0');
