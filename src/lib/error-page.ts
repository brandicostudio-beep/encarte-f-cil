function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderErrorPage(error?: unknown): string {
  let errorDetails = "";
  if (error) {
    let msg = "";
    if (error instanceof Error) {
      msg = `${error.name}: ${error.message}\n${error.stack || ""}`;
    } else if (typeof error === "string") {
      msg = error;
    } else {
      try {
        msg = JSON.stringify(error, null, 2);
      } catch {
        msg = String(error);
      }
    }

    if (msg.trim()) {
      errorDetails = `
        <details style="text-align: left; margin: 1rem 0; font-size: 12px;">
          <summary style="cursor: pointer; color: #b91c1c; font-weight: 600; padding: 0.25rem 0;">Ver detalhes técnicos do erro</summary>
          <pre style="background: #f1f5f9; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #cbd5e1; overflow-x: auto; max-height: 200px; white-space: pre-wrap; word-break: break-all; margin-top: 0.5rem; color: #334155;">${escapeHtml(msg)}</pre>
        </details>
      `;
    }
  }

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Não foi possível carregar a página</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 32rem; width: 100%; text-align: center; padding: 2rem; background: #ffffff; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); border: 1px solid #e5e7eb; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #111827; }
      p { color: #4b5563; margin: 0 0 1.5rem; font-size: 0.95rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-top: 1.25rem; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; font-weight: 500; font-size: 0.875rem; }
      .primary { background: #dc2626; color: #fff; }
      .primary:hover { background: #b91c1c; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
      .secondary:hover { background: #f3f4f6; }
      .danger { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
      .danger:hover { background: #fee2e2; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Não foi possível carregar a página</h1>
      <p>Ocorreu um erro no processamento da página ou há dados locais corrompidos. Você pode tentar recarregar ou limpar os dados salvos.</p>
      ${errorDetails}
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar novamente</button>
        <button class="danger" onclick="if(confirm('Isso apaga os produtos e configurações salvos neste navegador. Deseja continuar?')){try{localStorage.clear();sessionStorage.clear();}catch(e){}location.href='/';}">Resetar Dados Salvos</button>
        <a class="secondary" href="/">Voltar ao início</a>
      </div>
    </div>
  </body>
</html>`;
}
