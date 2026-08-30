import { createFileRoute } from "@tanstack/react-router";
import { proxyRequest } from "@/lib/proxy";

const handler = ({ request }: { request: Request }) => proxyRequest(request);

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PUT: handler,
      PATCH: handler,
      DELETE: handler,
      OPTIONS: handler,
      HEAD: handler,
    },
  },
});
