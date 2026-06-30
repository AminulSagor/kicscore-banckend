import { Logger, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { IosWorldCupInterceptor } from './common/interceptors/ios-world-cup.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

const logger = new Logger('Bootstrap');

@Module({})
class LegacyProxyModule {}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function getPort(): number {
  const port = Number(process.env.PORT ?? 9000);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a valid positive integer');
  }

  return port;
}

function getLegacyProxyTarget(): string {
  const configuredTarget = process.env.LEGACY_PROXY_TARGET?.trim();

  if (!configuredTarget) {
    throw new Error(
      'LEGACY_PROXY_TARGET is required when LEGACY_PROXY_MODE=true',
    );
  }

  const targetUrl = new URL(configuredTarget);

  if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
    throw new Error('LEGACY_PROXY_TARGET must use http or https');
  }

  if (targetUrl.hostname === 'kicscore-banckend-production.up.railway.app') {
    throw new Error('LEGACY_PROXY_TARGET cannot point to the old backend URL');
  }

  /*
   * The target should contain only the backend origin.
   * Existing request paths and query parameters are preserved.
   */
  return `${targetUrl.protocol}//${targetUrl.host}`;
}

async function startLegacyProxy(): Promise<void> {
  const target = getLegacyProxyTarget();
  const port = getPort();

  /*
   * Disable body parsing so JSON, multipart uploads and other request
   * bodies are streamed directly to the new backend without alteration.
   */
  const app = await NestFactory.create(LegacyProxyModule, {
    bodyParser: false,
  });

  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.disable('x-powered-by');

  /*
   * Keep this endpoint local to the old Railway service.
   * Configure Railway's health-check path to:
   *
   * /_legacy-proxy/health
   */
  expressApp.get(
    '/_legacy-proxy/health',
    (_request: Request, response: Response) => {
      response.status(200).json({
        status: 'ok',
        mode: 'legacy-proxy',
        target,
      });
    },
  );

  const legacyProxy = createProxyMiddleware<Request, Response>({
    target,

    /*
     * Sends the new backend hostname in the Host header.
     */
    changeOrigin: true,

    /*
     * Adds X-Forwarded-For, X-Forwarded-Host and
     * X-Forwarded-Proto headers.
     */
    xfwd: true,

    /*
     * Verify HTTPS certificates on the new backend.
     */
    secure: true,

    /*
     * If the new backend returns a redirect, rewrite its host
     * to the hostname used by the old app.
     */
    autoRewrite: true,

    /*
     * Remove an explicit cookie Domain attribute so cookies can
     * continue working through the old hostname.
     */
    cookieDomainRewrite: '',

    /*
     * Time allowed while waiting for the new backend.
     */
    proxyTimeout: 60_000,
    timeout: 65_000,

    on: {
      error: (error) => {
        logger.error(
          `Legacy proxy request failed: ${error.message}`,
          error.stack,
        );
      },
    },
  });

  /*
   * Every route other than the local health route is forwarded.
   *
   * Example:
   * OLD /football/leagues/top
   * becomes:
   * NEW /football/leagues/top
   *
   * Query parameters, request method, body and headers are preserved.
   */
  expressApp.use(legacyProxy);

  await app.listen(port);

  logger.log(`Legacy API proxy is running on port ${port}`);

  logger.log(`Forwarding legacy API traffic to ${target}`);
}

async function startMainApplication(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const iosWorldCupInterceptor = app.get(IosWorldCupInterceptor);

  app.useGlobalInterceptors(new ResponseInterceptor(), iosWorldCupInterceptor);

  const port = getPort();

  await app.listen(port);

  logger.log(`Main backend is running on port ${port}`);
}

async function bootstrap(): Promise<void> {
  try {
    if (isEnabled(process.env.LEGACY_PROXY_MODE)) {
      await startLegacyProxy();
      return;
    }

    await startMainApplication();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    const trace = error instanceof Error ? error.stack : undefined;

    logger.error(`Failed to bootstrap application: ${message}`, trace);

    process.exit(1);
  }
}

void bootstrap();
