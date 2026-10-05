const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>bharris.app</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: 100%;
      max-width: 420px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 28px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
    }
    .mark {
      width: 56px;
      height: 56px;
      margin: 0 auto 16px;
      border-radius: 18px;
      background: #ecfdf5;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mark svg { width: 28px; height: 28px; }
    h1 { margin: 0; font-size: 28px; letter-spacing: -0.03em; }
    p { margin: 12px 0 0; color: #475569; line-height: 1.5; }
    a.button {
      display: block;
      margin-top: 24px;
      background: #0f172a;
      color: #fff;
      text-decoration: none;
      border-radius: 16px;
      padding: 16px 18px;
      font-weight: 600;
      font-size: 17px;
    }
    a.quiet {
      display: inline-block;
      margin-top: 16px;
      color: #0f172a;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2"></rect>
        <path d="M8 11V8a4 4 0 0 1 8 0v3"></path>
      </svg>
    </div>
    <h1>Password updated</h1>
    <p>Your bharris.app password is saved. Open the app and sign in with the new one.</p>
    <a class="button" href="bharris://signin">Open bharris.app</a>
    <a class="quiet" href="/app/#/account/signin">Sign in in the browser</a>
  </main>
</body>
</html>`;

export function passwordResetRedirect(url) {
  if (url.pathname !== '/__/auth/action') return null;
  if (url.searchParams.get('mode') !== 'resetPassword') return null;
  const code = url.searchParams.get('oobCode') || '';
  if (!code) return null;
  const dest = new URL('/app/', url.origin);
  dest.searchParams.set('mode', 'resetPassword');
  dest.searchParams.set('oobCode', code);
  return new Response(null, {
    status: 302,
    headers: {
      Location: dest.toString(),
      'cache-control': 'no-store',
    },
  });
}

export function openAppPage(url) {
  if (url.pathname !== '/open-app') return null;
  return new Response(PAGE, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
