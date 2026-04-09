export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }

  const { base, path } = req.query || {};

  if (!base || !path) {
    res.status(400).json({ error: "Missing base or path" });
    return;
  }

  const target = `${base}${path}`;
  const isBodyMethod = !["GET", "HEAD"].includes(req.method);
  const body = isBodyMethod
    ? typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body ?? {})
    : undefined;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      body,
    });

    const text = await upstream.text();

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Forward response headers (skip problematic ones)
    const skip = new Set(["content-encoding", "transfer-encoding", "connection", "content-length"]);
    upstream.headers.forEach((value, key) => {
      if (!skip.has(key.toLowerCase())) res.setHeader(key, value);
    });

    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(502).json({ error: "Proxy failed", details: e.message, target });
  }
}

