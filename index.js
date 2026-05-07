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
    // Definimos uma resolução alta para garantir que o Gemini leia os números pequenos
    await page.setViewport({ width: 1600, height: 1200 });

    console.log("Acessando a plataforma...");
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // FASE 1: Solicitação de E-mail
    if (!authCode) {
      console.log("Fase 1: Inserindo e-mail para disparo do código...");
      await page.waitForSelector('input[type="email"]', { timeout: 20000 });
      await page.type('input[type="email"]', 'pedro.rocha@uncover.co');
      await page.keyboard.press('Enter');
      
      // Aguarda confirmação visual do envio
      await new Promise(r => setTimeout(r, 5000));
      await browser.close();
      return res.json({ status: "aguardando_codigo" });
    }

    // FASE 2: Login Real e Seleção de Cliente
    console.log("Fase 2: Iniciando login com código de autenticação...");
    
    // Passo A: Reinserir e-mail (necessário pois o container reiniciou)
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    await page.type('input[type="email"]', 'pedro.rocha@uncover.co');
    await page.keyboard.press('Enter');

    // Passo B: Inserir o Código (esperamos o campo que NÃO é o de e-mail)
    console.log("Aguardando campo do código...");
    await page.waitForSelector('input:not([type="email"])', { timeout: 20000 });
    await page.type('input:not([type="email"])', authCode);
    await page.keyboard.press('Enter');

    // Passo C: Seleção de Cliente (Ação necessária para sair da lista e ir ao relatório)
    console.log("Login feito. Buscando link do relatório...");
    await new Promise(r => setTimeout(r, 10000)); // Espera a lista carregar

    await page.evaluate(() => {
      // Procura por links que contenham 'report' ou o nome da plataforma
      const links = Array.from(document.querySelectorAll('a, button'));
      const target = links.find(el => 
        el.href?.includes('report') || 
        el.innerText?.toLowerCase().includes('uncover') ||
        el.innerText?.toLowerCase().includes('dashboard')
      );
      if (target) target.click();
    });

    // Tempo para o dashboard carregar as métricas e gráficos (crucial)
    console.log("Aguardando carregamento final dos gráficos...");
    await new Promise(r => setTimeout(r, 30000));

    // Captura o screenshot da tela inteira para análise visual
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    await browser.close();

    console.log("Enviando para o Gemini 2.5 Pro...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: "image/png", data: screenshot } }
    ]);

    res.json({ status: "sucesso", analise: result.response.text() });

  } catch (error) {
    if (browser) await browser.close();
    console.error("Erro no Robô:", error.message);
    res.json({ status: "erro", detalhe: error.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => console.log(`Jarvis online na porta ${port}`));
