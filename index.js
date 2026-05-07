const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

// Simulando uma "caixa postal" simples para o teste
let mailbox = {};

app.post('/', async (req, res) => {
  const { url, prompt, apiKey, requestId } = req.body;
  let browser;

  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200 });

    console.log("Iniciando acesso...");
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Passo 1: Digitar E-mail
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'pedro.rocha@uncover.co');
    await page.keyboard.press('Enter');

    console.log("E-mail enviado. Aguardando código via 'caixa postal'...");
    
    // Passo 2: O Loop de Espera (Aguardando você digitar no Apps Script)
    let authCode = null;
    for (let i = 0; i < 60; i++) { // Espera até 120 segundos (60 * 2s)
      await new Promise(r => setTimeout(r, 2000));
      if (mailbox[requestId]) {
        authCode = mailbox[requestId];
        delete mailbox[requestId]; // Limpa a caixa
        break;
      }
    }

    if (!authCode) throw new Error("Tempo esgotado aguardando o código.");

    // Passo 3: Digitar o código na mesma aba
    console.log("Código recebido! Finalizando login...");
    await page.waitForSelector('input:not([type="email"])');
    await page.type('input:not([type="email"])', authCode);
    await page.keyboard.press('Enter');

    // Passo 4: Esperar Dashboard e Analisar
    await new Promise(r => setTimeout(r, 30000));
    const screenshot = await page.screenshot({ encoding: 'base64' });
    await browser.close();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent([prompt, { inlineData: { mimeType: "image/png", data: screenshot } }]);

    res.json({ status: "sucesso", analise: result.response.text() });

  } catch (error) {
    if (browser) await browser.close();
    res.json({ status: "erro", detalhe: error.message });
  }
});

// Endpoint para o Apps Script "entregar" o código
app.post('/deliver', (req, res) => {
  const { requestId, authCode } = req.body;
  mailbox[requestId] = authCode;
  res.json({ status: "recebido" });
});

app.listen(process.env.PORT || 8080, '0.0.0.0');
