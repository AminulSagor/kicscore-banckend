import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { IosWorldCupInterceptor } from './common/interceptors/ios-world-cup.interceptor';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  try {
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
    app.useGlobalInterceptors(
      new ResponseInterceptor(),
      iosWorldCupInterceptor,
    );

    const port = process.env.PORT ? Number(process.env.PORT) : 9000;

    await app.listen(port);

    logger.log(`Server is running on port ${port}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const trace = error instanceof Error ? error.stack : undefined;

    logger.error(`Failed to bootstrap application: ${message}`, trace);

    process.exit(1);
  }
}

void bootstrap();
