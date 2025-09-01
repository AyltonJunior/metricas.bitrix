export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const targetUrl = 'http://147.182.191.150:4000/getlist';
    
    console.log('Fazendo proxy para:', targetUrl);
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('Proxy bem-sucedido, dados recebidos:', data.length, 'itens');
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Erro no proxy:', error);
    return res.status(500).json({ 
      error: 'Erro ao conectar com a API',
      message: error.message 
    });
  }
}
