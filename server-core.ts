import express from "express";
import cookieParser from "cookie-parser";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "1020364618895-ep52i7snv25erskv3a176d052i4reu40.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

const app = express();

app.use(cookieParser());
app.use(express.json());

app.get("/api/auth/url", (req, res) => {
  const rawHost = req.headers['x-forwarded-host'] || req.get('host');
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  const rawProtocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
  const protocol = Array.isArray(rawProtocol) ? rawProtocol[0] : rawProtocol;
  const redirectUri = `${protocol}://${host}/auth/callback`;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  const rawHost = req.headers['x-forwarded-host'] || req.get('host');
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  const rawProtocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
  const protocol = Array.isArray(rawProtocol) ? rawProtocol[0] : rawProtocol;
  const redirectUri = `${protocol}://${host}/auth/callback`;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return res.status(400).send(`Auth error: ${tokenData.error_description}`);
    }

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();

    res.cookie('auth_token', tokenData.access_token, {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    res.cookie('user_info', encodeURIComponent(JSON.stringify(userData)), {
      secure: true,
      sameSite: 'none',
      httpOnly: false,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Internal Server Error during authentication');
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('auth_token', { secure: true, sameSite: 'none', httpOnly: true, path: '/' });
  res.clearCookie('user_info', { secure: true, sameSite: 'none', httpOnly: false, path: '/' });
  res.json({ success: true });
});

export default app;
