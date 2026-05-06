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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    // Definimos uma resolução alta para o Gemini ver os números pequenos
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    if (!authCode) {
      console.log("Fase 1: Disparando e-mail...");
      await page.waitForSelector('input[type="email"]', { timeout: 20000 });
      await page.type('input[type="email"]', 'pedro.rocha@uncover.co');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 5000));
      await browser.close();
      return res.status(200).json({ status: "aguardando_codigo" });
    }

    // Fase 2: Login e Print
    console.log("Realizando login...");
    await page.waitForSelector('input', { timeout: 20000 });
    await page.type('input', authCode);
    await page.keyboard.press('Enter');
    
    // Espera generosa para o dashboard carregar visualmente
    console.log("Aguardando carregamento visual do dashboard...");
    await new Promise(r => setTimeout(r, 30000)); 

    // Tira um print da tela em base64
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    await browser.close();

    console.log("Enviando imagem para o Gemini 1.5 Pro...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: screenshot, mimeType: "image/png" } }
    ]);

    res.status(200).json({ status: "sucesso", analise: result.response.text() });

  } catch (error) {
    if (browser) await browser.close();
    console.error(error);
    res.status(500).json({ status: "erro", detalhe: error.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => console.log(`Servidor ativo na porta ${port}`));
