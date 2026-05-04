import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const awsGatewayUrl = "http://ec2-18-231-115-154.sa-east-1.compute.amazonaws.com";
const gatewayTarget = process.env.VITE_GATEWAY_URL ?? awsGatewayUrl;
const apiPrefixes = ["/clube", "/jogador", "/jogos"];
const ignoredHeaders = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "expect",
  "host",
  "transfer-encoding",
]);

function isApiPath(pathname: string) {
  return apiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isBodylessMethod(method = "GET") {
  return method === "GET" || method === "HEAD";
}

async function bufferBody(body: AsyncIterable<Buffer | Uint8Array | string>) {
  const chunks: Buffer[] = [];

  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function requestHeaders(headers: NodeJS.Dict<string | string[]>) {
  const nextHeaders = new Headers();

  Object.entries(headers).forEach(([key, value]) => {
    if (!value || ignoredHeaders.has(key.toLowerCase())) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => nextHeaders.append(key, item));
    } else {
      nextHeaders.set(key, value);
    }
  });

  return nextHeaders;
}

function responseHeaders(headers: Headers, bodyLength: number) {
  const nextHeaders: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (!ignoredHeaders.has(key.toLowerCase()) && key.toLowerCase() !== "content-encoding") {
      nextHeaders[key] = value;
    }
  });

  nextHeaders["content-length"] = String(bodyLength);
  return nextHeaders;
}

function awsApiProxy(): Plugin {
  return {
    name: "aws-api-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const originalUrl = req.url ?? "/";
        const pathname = originalUrl.split("?")[0] ?? "/";

        if (!isApiPath(pathname)) {
          next();
          return;
        }

        try {
          const targetUrl = new URL(originalUrl, `${gatewayTarget}/`);
          const method = req.method ?? "GET";
          const body = isBodylessMethod(method) ? undefined : await bufferBody(req);
          const response = await fetch(targetUrl, {
            method,
            headers: requestHeaders(req.headers),
            body,
          });
          const responseBody = Buffer.from(await response.arrayBuffer());

          res.writeHead(
            response.status,
            response.statusText,
            responseHeaders(response.headers, responseBody.length),
          );
          res.end(responseBody);
        } catch (error) {
          console.error("AWS API proxy error:", error);
          res.writeHead(502, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "AWS API proxy error" }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [awsApiProxy(), react()],
});
