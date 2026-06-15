import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import env from "./config/env.js";

async function bootstrap() {
  try {
    await connectDatabase();

    app.listen(env.port, () => {
      console.info(`[server] Listening on port ${env.port}`);
    });
  } catch (error) {
    console.error("[server] Failed to start application.");
    console.error(error instanceof Error ? error.message : error);

    if (error instanceof Error && error.cause) {
      console.error("[server] Root cause:", error.cause);
    }

    process.exit(1);
  }
}

bootstrap();
