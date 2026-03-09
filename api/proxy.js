export default async function handler(req, res) {
  const { base, path } = req.query || {};

  if (!base || !path) {
    res.status(400).json({ error: "Missing base or path" });
    return;
  }

  const target = `${base}${path}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        ...req.headers,
        host: undefined,
        "x-forwarded-host": undefined,
        "x-vercel-deployment-url": undefined,
      },
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body ?? {}),
    });

    const text = await upstream.text();

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "Proxy failed", details: e.message });
  }
}

