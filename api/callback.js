// Recibe el código de GitHub, lo cambia por un token y se lo entrega al panel
// (paso 2 de 2). Devuelve una pequeña página que avisa al CMS y se cierra.

function sendResult(res, status, content) {
  const payload = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Conectando…</title></head>
<body>
<script>
(function () {
  function receiveMessage(e) {
    window.opener && window.opener.postMessage(${JSON.stringify(payload)}, e.origin);
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener && window.opener.postMessage('authorizing:github', '*');
})();
</script>
<p style="font-family:sans-serif">Conectando con GitHub… ya puedes cerrar esta ventana.</p>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

export default async function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const { code, state } = req.query;

  const cookies = Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const i = c.indexOf('=');
        return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
      }),
  );

  if (!clientId || !clientSecret) {
    return sendResult(res, 'error', {
      error: 'Faltan GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET en Vercel.',
    });
  }
  if (!code) {
    return sendResult(res, 'error', { error: 'GitHub no devolvió un código.' });
  }
  if (!state || state !== cookies.oauth_state) {
    return sendResult(res, 'error', {
      error: 'Verificación de seguridad fallida (state). Intenta de nuevo.',
    });
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const data = await tokenRes.json();

    if (data.error || !data.access_token) {
      return sendResult(res, 'error', {
        error: data.error_description || 'No se pudo obtener el token de GitHub.',
      });
    }

    return sendResult(res, 'success', { token: data.access_token, provider: 'github' });
  } catch (err) {
    return sendResult(res, 'error', { error: 'Error contactando GitHub: ' + err.message });
  }
}
